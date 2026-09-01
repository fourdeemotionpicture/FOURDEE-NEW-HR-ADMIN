import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { leaveRequests, attendance, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { format, parseISO, eachDayOfInterval, getDay } from "date-fns";
import { sendEmail } from "@/lib/email";
import { getUserLeaveBalances } from "@/lib/leave-balances";

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

    // Get current CL & CO Balances for the logged-in user or requested user
    const targetUserId = userId || currentUser.userId;
    const balances = await getUserLeaveBalances(targetUserId);

    return NextResponse.json({
      requests: enriched,
      clBalance: balances.clBalance,
      coBalance: balances.coBalance,
    });
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
    const { startDate, endDate, type, reason, isHalfDay = false } = body;

    if (!startDate || !endDate || !type) {
      return NextResponse.json({ error: "Start date, end date, and type are required" }, { status: 400 });
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysInterval = eachDayOfInterval({ start, end });
    const fullDaysCount = daysInterval.filter((d) => getDay(d) !== 0).length; // Exclude Sundays

    if (fullDaysCount <= 0) {
      return NextResponse.json({ error: "Selected dates fall entirely on Sunday (Week Off)" }, { status: 400 });
    }

    const effectiveRequestedDays = isHalfDay ? 0.5 : fullDaysCount;

    const isAdmin = currentUser.role === "super_admin" || currentUser.role === "owner_admin";
    let status = "pending";

    const balances = await getUserLeaveBalances(currentUser.userId);

    // Leave Type Tag
    const leaveTypeToSave = isHalfDay && type === "CL" ? "HD_CL" : type;

    // Quota validation for CL & CO
    if ((type === "CL" || leaveTypeToSave === "HD_CL") && !isAdmin) {
      // Auto-approve if they have sufficient CL quota left
      if (balances.clBalance.available >= effectiveRequestedDays) {
        status = "approved";
      }
    } else if (type === "CO" && !isAdmin) {
      // Auto-approve if they have sufficient Comp Off (CO) balance earned from Holidays/Sundays
      if (balances.coBalance.available >= effectiveRequestedDays) {
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
      type: leaveTypeToSave,
      reason: reason ? `${isHalfDay ? "[Half Day 0.5 CL] " : ""}${reason}` : (isHalfDay ? "Half Day 0.5 CL applied" : null),
      status,
      updatedAt: new Date(),
    }).returning();

    // If approved, create/update attendance entries
    if (status === "approved") {
      for (const day of daysInterval) {
        if (getDay(day) === 0) continue; // Skip Sundays

        const dateStr = format(day, "yyyy-MM-dd");

        const existing = await db.select().from(attendance).where(
          and(eq(attendance.userId, currentUser.userId), eq(attendance.date, dateStr))
        );

        if (leaveTypeToSave === "HD_CL") {
          // Half Day + 0.5 CL applied
          if (existing.length > 0) {
            await db.update(attendance).set({
              status: "HD_CL",
              source: existing[0].source || "manual",
              notes: `Half Day + 0.5 CL Applied: ${reason || ""}`,
              updatedAt: new Date(),
            }).where(eq(attendance.id, existing[0].id));
          } else {
            await db.insert(attendance).values({
              userId: currentUser.userId,
              date: dateStr,
              status: "HD_CL",
              source: "manual",
              workingHours: "4.00",
              notes: `Half Day + 0.5 CL Applied: ${reason || ""}`,
            });
          }
        } else {
          // Full Day Leave
          if (existing.length > 0) {
            await db.update(attendance).set({
              status: type, // CL, SL, CO, H
              source: "manual",
              inTime: null,
              outTime: null,
              workingHours: "0.00",
              lateMinutes: 0,
              overtimeMinutes: 0,
              notes: `Leave Auto-Approved (${type}): ${reason || ""}`,
              updatedAt: new Date(),
            }).where(eq(attendance.id, existing[0].id));
          } else {
            await db.insert(attendance).values({
              userId: currentUser.userId,
              date: dateStr,
              status: type,
              source: "manual",
              notes: `Leave Auto-Approved (${type}): ${reason || ""}`,
            });
          }
        }
      }
    }

    // Email notification if pending
    if (status === "pending") {
      const [empUser] = await db.select().from(users).where(eq(users.id, currentUser.userId)).limit(1);
      const superAdmins = await db.select({ email: users.email }).from(users).where(eq(users.role, "super_admin"));
      const adminEmails = superAdmins.map((a) => a.email).filter(Boolean);

      if (adminEmails.length > 0 && empUser) {
        await sendEmail({
          to: adminEmails.join(","),
          subject: `New Leave Request from ${empUser.name}`,
          html: `<h3>New Leave Request Pending Approval</h3>
                 <p><b>Employee:</b> ${empUser.name}</p>
                 <p><b>Type:</b> ${leaveTypeToSave} (${effectiveRequestedDays} day(s))</p>
                 <p><b>Dates:</b> ${startDate} to ${endDate}</p>
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
        if (getDay(day) === 0) continue; // Skip Sundays

        const dateStr = format(day, "yyyy-MM-dd");

        const existing = await db.select().from(attendance).where(
          and(eq(attendance.userId, leaveReq.userId), eq(attendance.date, dateStr))
        );

        if (leaveReq.type === "HD_CL") {
          if (existing.length > 0) {
            await db.update(attendance).set({
              status: "HD_CL",
              notes: `Half Day + 0.5 CL Approved: ${leaveReq.reason || ""}`,
              updatedAt: new Date(),
            }).where(eq(attendance.id, existing[0].id));
          } else {
            await db.insert(attendance).values({
              userId: leaveReq.userId,
              date: dateStr,
              status: "HD_CL",
              source: "manual",
              workingHours: "4.00",
              notes: `Half Day + 0.5 CL Approved: ${leaveReq.reason || ""}`,
            });
          }
        } else {
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
    }

    // Email employee about Admin decision
    if (employee && (employee.personalEmail || employee.email)) {
      await sendEmail({
        to: employee.personalEmail || employee.email,
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
