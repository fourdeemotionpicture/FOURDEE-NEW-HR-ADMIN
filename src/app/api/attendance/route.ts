import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { attendance, users, auditLogs } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, differenceInMinutes, parse } from "date-fns";

// Office timing constants
const OFFICE_START = "10:00";
const GRACE_PERIOD_END = "10:15";
const REQUIRED_WORKING_HOURS = 8;

export function calculateAttendance(inTime: string, outTime: string) {
  const cleanIn = inTime.slice(0, 5);
  const cleanOut = outTime.slice(0, 5);
  const inDate = parse(cleanIn, "HH:mm", new Date());
  const outDate = parse(cleanOut, "HH:mm", new Date());

  const totalMinutes = differenceInMinutes(outDate, inDate);
  const workingHours = Math.max(0, totalMinutes / 60);

  let lateMinutes = 0;
  let status = "present";

  if (workingHours >= 8.0) {
    // 8 Hours completed: Full present, no late minutes!
    status = "present";
    lateMinutes = 0;
  } else {
    // Less than 8 hours: status is half_day
    status = "half_day";
    // Check if check-in time is 10:15 AM or later (i.e. lateMinutes applies from 10:00 AM)
    const inHours = inDate.getHours();
    const inMins = inDate.getMinutes();
    const inTotalMins = inHours * 60 + inMins;

    if (inTotalMins >= 615) {
      lateMinutes = inTotalMins - 600; // 600 mins is 10:00 AM
    }
  }

  // Overtime calculation
  const standardEndMinutes = 10 * 60 + REQUIRED_WORKING_HOURS * 60; // 6:00 PM (10:00 AM + 8h)
  const outMinutes = outDate.getHours() * 60 + outDate.getMinutes();
  const overtimeMinutes = Math.max(0, outMinutes - standardEndMinutes);

  return {
    workingHours: workingHours.toFixed(2),
    lateMinutes,
    overtimeMinutes,
    status,
  };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";
    const month = searchParams.get("month") || format(new Date(), "yyyy-MM");
    const startDate = format(startOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
    const endDate = format(endOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");

    let attendanceRecords = await db.select().from(attendance).where(
      and(gte(attendance.date, startDate), lte(attendance.date, endDate))
    );

    // Filter by user
    if (currentUser.role === "employee") {
      attendanceRecords = attendanceRecords.filter((a) => a.userId === currentUser.userId);
    } else if (userId) {
      attendanceRecords = attendanceRecords.filter((a) => a.userId === userId);
    }

    // Enrich with user names
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

    const enriched = attendanceRecords.map((a) => ({
      ...a,
      userName: userMap[a.userId] || "Unknown",
    }));

    return NextResponse.json({ attendance: enriched });
  } catch (error) {
    console.error("Attendance GET error:", error);
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
    const { userId, date, inTime, outTime, source, notes } = body;

    if (!date || !inTime || !outTime) {
      return NextResponse.json({ error: "Date, in time, and out time are required" }, { status: 400 });
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const canOverride = currentUser.role === "super_admin" || currentUser.role === "owner_admin";

    // Validation rules for manual attendance
    if (source === "manual" && !canOverride) {
      // Cannot submit for future dates
      if (date > today) {
        return NextResponse.json({ error: "Cannot submit attendance for future dates" }, { status: 400 });
      }
      // Cannot submit for previous dates (non-admin)
      if (date < today) {
        return NextResponse.json({ error: "Cannot submit attendance for previous dates" }, { status: 400 });
      }
      // One entry per day
      const existing = await db.select().from(attendance).where(
        and(eq(attendance.userId, currentUser.userId), eq(attendance.date, date))
      );
      if (existing.length > 0) {
        return NextResponse.json({ error: "Attendance already submitted for today" }, { status: 400 });
      }
    }

    const cleanInTime = inTime.slice(0, 5);
    const cleanOutTime = outTime.slice(0, 5);
    const calculations = calculateAttendance(cleanInTime, cleanOutTime);
    const targetUserId = canOverride && userId ? userId : currentUser.userId;

    // Check if attendance already exists
    const existing = await db.select().from(attendance).where(
      and(eq(attendance.userId, targetUserId), eq(attendance.date, date))
    );

    if (existing.length > 0) {
      // Update existing
      const [updated] = await db.update(attendance).set({
        inTime: cleanInTime,
        outTime: cleanOutTime,
        workingHours: calculations.workingHours,
        lateMinutes: calculations.lateMinutes,
        overtimeMinutes: calculations.overtimeMinutes,
        status: calculations.status,
        source: source || "manual",
        notes: notes || null,
        updatedAt: new Date(),
      }).where(eq(attendance.id, existing[0].id)).returning();

      // Audit log for admin override
      if (canOverride) {
        await db.insert(auditLogs).values({
          userId: currentUser.userId,
          action: "attendance_override",
          entity: "attendance",
          entityId: updated.id,
          details: { targetUserId, date, inTime: cleanInTime, outTime: cleanOutTime },
        });
      }

      return NextResponse.json({ attendance: updated });
    }

    // Create new
    const [record] = await db.insert(attendance).values({
      userId: targetUserId,
      date,
      inTime: cleanInTime,
      outTime: cleanOutTime,
      workingHours: calculations.workingHours,
      lateMinutes: calculations.lateMinutes,
      overtimeMinutes: calculations.overtimeMinutes,
      status: calculations.status,
      source: source || "manual",
      notes: notes || null,
    }).returning();

    return NextResponse.json({ attendance: record });
  } catch (error) {
    console.error("Attendance POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
