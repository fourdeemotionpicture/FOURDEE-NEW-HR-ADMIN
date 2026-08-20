import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { leaveRequests, attendance, users } from "@/db/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { format, parseISO, eachDayOfInterval, getDay, differenceInDays } from "date-fns";
import { sendEmail } from "@/lib/email";

// Helper to compute CL Balance
async function getCLBalance(userId: string, targetDate: Date = new Date()) {
  const currentMonth = targetDate.getMonth() + 1; // 1 to 12
  const currentYear = targetDate.getFullYear();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { accrued: 0, used: 0, available: 0 };

  let startMonth = 1;
  const joinDate = new Date(user.createdAt);
  if (joinDate.getFullYear() === currentYear) {
    startMonth = joinDate.getMonth() + 1;
  }

  // Earn 1 CL per month accrued in the calendar year
  const accrued = Math.max(1, currentMonth - startMonth + 1);

  // Get approved CL days in attendance for this calendar year
  const approvedCLs = await db.select().from(attendance).where(
    and(
      eq(attendance.userId, userId),
      eq(attendance.status, "CL"),
      gte(attendance.date, `${currentYear}-01-01`),
      lte(attendance.date, `${currentYear}-12-31`)
    )
  );

  const used = approvedCLs.length;
  const available = Math.max(0, accrued - used);
  return { accrued, used, available };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";

    let requests;
    if (currentUser.role === "super_admin" || currentUser.role === "owner_admin") {
      if (userId) {
        requests = await db.select().from(leaveRequests)
          .where(eq(leaveRequests.userId, userId))
          .orderBy(desc(leaveRequests.createdAt));
      } else {
        requests = await db.select().from(leaveRequests)
          .orderBy(desc(leaveRequests.createdAt));
      }
    } else {
      // Employees only see their own requests
      requests = await db.select().from(leaveRequests)
        .where(eq(leaveRequests.userId, currentUser.userId))
        .orderBy(desc(leaveRequests.createdAt));
    }

    // Enrich with user names
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

    const enriched = requests.map((r) => ({
      ...r,
      userName: userMap[r.userId] || "Unknown",
    }));

    // Get current CL Balance for the logged-in user or requested user
    const targetUserId = userId || currentUser.userId;
    const balance = await getCLBalance(targetUserId);

    return NextResponse.json({ requests: enriched, clBalance: balance });
  } catch (error) {
    console.error("Leave requests GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { startDate, endDate, type, reason } = body;

    if (!startDate || !endDate || !type) {
      return NextResponse.json({ error: "Start date, end date, and type are required" }, { status: 400 });
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysInterval = eachDayOfInterval({ start, end });
    const requestedDays = daysInterval.length;

    const isAdmin = currentUser.role === "super_admin" || currentUser.role === "owner_admin";
    let status = "pending";

    // Quota validation for CL
    if (type === "CL" && !isAdmin) {
      const clBalance = await getCLBalance(currentUser.userId);
      // Auto-approve if they have sufficient CL quota left
      if (clBalance.available >= requestedDays) {
        status = "approved";
      }
    } else if (isAdmin) {
      // Admin requests are always auto-approved
      status = "approved";
    }

    // Save request
    const [newRequest] = await db.insert(leaveRequests).values({
      userId: currentUser.userId,
      startDate,
      endDate,
      type,
      reason: reason || null,
      status,
      updatedAt: new Date(),
    }).returning();

    // If approved, create attendance entries for each day (excluding Sundays)
    if (status === "approved") {
      for (const day of daysInterval) {
        // Skip Sundays as they are Week Off (WO)
        if (getDay(day) === 0) continue;

        const dateStr = format(day, "yyyy-MM-dd");

        // Upsert attendance record
        const existing = await db.select().from(attendance).where(
          and(eq(attendance.userId, currentUser.userId), eq(attendance.date, dateStr))
        );

        if (existing.length > 0) {
          await db.update(attendance).set({
            status: type, // CL, SL, CO, H
            source: "manual",
            inTime: null,
            outTime: null,
            workingHours: "0.00",
            lateMinutes: 0,
            overtimeMinutes: 0,
            notes: `Leave Approved: ${type} - ${reason || ""}`,
            updatedAt: new Date(),
          }).where(eq(attendance.id, existing[0].id));
        } else {
          await db.insert(attendance).values({
            userId: currentUser.userId,
            date: dateStr,
            status: type,
            source: "manual",
            notes: `Leave Approved: ${type} - ${reason || ""}`,
          });
        }
      }

      // Notify Admin and Employee
      const [empUser] = await db.select().from(users).where(eq(users.id, currentUser.userId)).limit(1);
      if (empUser && empUser.email) {
        await sendEmail({
          to: empUser.email,
          subject: `Leave Auto-Approved: ${type}`,
          html: `<h3>Hello ${empUser.name},</h3>
                 <p>Your requested leave of type <b>${type}</b> from <b>${startDate}</b> to <b>${endDate}</b> has been <b>Auto-Approved</b> based on your available Casual Leave quota.</p>
                 <p>Reason: ${reason || "Not specified"}</p>`,
        });
      }
    } else {
      // Pending request: Send notification email to all Admins
      const admins = await db.select().from(users).where(inArray(users.role, ["super_admin", "owner_admin"]));
      const adminEmails = admins.map((a) => a.email).filter(Boolean);
      
      const [empUser] = await db.select().from(users).where(eq(users.id, currentUser.userId)).limit(1);

      if (adminEmails.length > 0 && empUser) {
        await sendEmail({
          to: adminEmails.join(","),
          subject: `New Leave Request from ${empUser.name}`,
          html: `<h3>New Leave Request Pending Approval</h3>
                 <p><b>Employee:</b> ${empUser.name}</p>
                 <p><b>Type:</b> ${type}</p>
                 <p><b>Dates:</b> ${startDate} to ${endDate} (${requestedDays} day(s))</p>
                 <p><b>Reason:</b> ${reason || "Not specified"}</p>
                 <p>Please log in to the HR Portal to approve or reject this request.</p>`,
        });
      }
    }

    return NextResponse.json({ success: true, request: newRequest });
  } catch (error) {
    console.error("Leave request POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Admin Action: Approve/Reject
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "super_admin" && currentUser.role !== "owner_admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json({ error: "Request ID and status are required" }, { status: 400 });
    }

    const [leaveReq] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, requestId)).limit(1);
    if (!leaveReq) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Update status
    const [updatedReq] = await db.update(leaveRequests).set({
      status,
      reviewedBy: currentUser.userId,
      updatedAt: new Date(),
    }).where(eq(leaveRequests.id, requestId)).returning();

    const [employee] = await db.select().from(users).where(eq(users.id, leaveReq.userId)).limit(1);

    if (status === "approved") {
      const start = parseISO(leaveReq.startDate);
      const end = parseISO(leaveReq.endDate);
      const daysInterval = eachDayOfInterval({ start, end });

      for (const day of daysInterval) {
        // Skip Sundays
        if (getDay(day) === 0) continue;

        const dateStr = format(day, "yyyy-MM-dd");

        const existing = await db.select().from(attendance).where(
          and(eq(attendance.userId, leaveReq.userId), eq(attendance.date, dateStr))
        );

        if (existing.length > 0) {
          await db.update(attendance).set({
            status: leaveReq.type,
            source: "manual",
            inTime: null,
            outTime: null,
            workingHours: "0.00",
            lateMinutes: 0,
            overtimeMinutes: 0,
            notes: `Leave Approved: ${leaveReq.type} - ${leaveReq.reason || ""}`,
            updatedAt: new Date(),
          }).where(eq(attendance.id, existing[0].id));
        } else {
          await db.insert(attendance).values({
            userId: leaveReq.userId,
            date: dateStr,
            status: leaveReq.type,
            source: "manual",
            notes: `Leave Approved: ${leaveReq.type} - ${leaveReq.reason || ""}`,
          });
        }
      }
    }

    // Email employee about Admin decision
    if (employee && employee.email) {
      await sendEmail({
        to: employee.email,
        subject: `Leave Request ${status.toUpperCase()}: ${leaveReq.type}`,
        html: `<h3>Hello ${employee.name},</h3>
               <p>Your leave request of type <b>${leaveReq.type}</b> from <b>${leaveReq.startDate}</b> to <b>${leaveReq.endDate}</b> has been <b>${status.toUpperCase()}</b> by Admin.</p>
               <p>Reason: ${leaveReq.reason || "Not specified"}</p>`,
      });
    }

    return NextResponse.json({ success: true, request: updatedReq });
  } catch (error) {
    console.error("Leave request PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

