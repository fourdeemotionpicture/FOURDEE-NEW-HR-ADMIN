import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { attendance, users, auditLogs, holidays } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, differenceInMinutes, parse, getDay, parseISO } from "date-fns";

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
    // Check if check-in time is 10:15 AM or later
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

    // Fetch official holidays
    const officialHolidays = await db.select({ date: holidays.date, name: holidays.name }).from(holidays);
    const holidayDateMap = new Map(officialHolidays.map((h) => [h.date, h.name]));

    // Enrich with user names and dual status flags (WO+PRESENT, H+PRESENT)
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

    const enriched = attendanceRecords.map((a) => {
      let finalStatus = a.status;
      const hasWorkLog = 
        a.status === "present" || 
        a.status === "half_day" || 
        a.status === "WO_PRESENT" || 
        a.status === "H_PRESENT" || 
        (a.workingHours && parseFloat(a.workingHours) > 0) || 
        (a.inTime && a.outTime);

      const recordDate = parseISO(a.date);
      const isSunday = getDay(recordDate) === 0;
      const isHoliday = holidayDateMap.has(a.date);

      if (hasWorkLog && isSunday && finalStatus !== "HD_CL") {
        finalStatus = "WO_PRESENT";
      } else if (hasWorkLog && isHoliday && finalStatus !== "HD_CL") {
        finalStatus = "H_PRESENT";
      }

      return {
        ...a,
        status: finalStatus,
        userName: userMap[a.userId] || "Unknown",
        isSunday,
        isHoliday,
        holidayName: holidayDateMap.get(a.date) || null,
      };
    });

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
    const { userId, date, inTime, outTime, source, notes, status } = body;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const canOverride = currentUser.role === "super_admin" || currentUser.role === "owner_admin";

    // Determine if setting a leave or week off status
    const leaveStatuses = ["WO", "CL", "SL", "CO", "LOP", "H", "absent", "HD_CL"];
    const isLeaveStatus = status && leaveStatuses.includes(status);

    if (!isLeaveStatus && (!inTime || !outTime)) {
      return NextResponse.json({ error: "Date, in time, and out time are required for present/half day status" }, { status: 400 });
    }

    // Validation rules for manual attendance (non-admin)
    if (source === "manual" && !canOverride) {
      if (date > today) {
        return NextResponse.json({ error: "Cannot submit attendance for future dates" }, { status: 400 });
      }
      if (date < today) {
        return NextResponse.json({ error: "Cannot submit attendance for previous dates" }, { status: 400 });
      }
      const existing = await db.select().from(attendance).where(
        and(eq(attendance.userId, currentUser.userId), eq(attendance.date, date))
      );
      if (existing.length > 0) {
        return NextResponse.json({ error: "Attendance already submitted for today" }, { status: 400 });
      }
    }

    let cleanInTime = null;
    let cleanOutTime = null;
    let workingHours = "0.00";
    let lateMinutes = 0;
    let overtimeMinutes = 0;
    let finalStatus = status || "present";

    if (inTime && outTime) {
      cleanInTime = inTime.slice(0, 5);
      cleanOutTime = outTime.slice(0, 5);
      const calculations = calculateAttendance(cleanInTime, cleanOutTime);
      workingHours = calculations.workingHours;
      lateMinutes = calculations.lateMinutes;
      overtimeMinutes = calculations.overtimeMinutes;
      if (!isLeaveStatus && !["WO_PRESENT", "H_PRESENT"].includes(status)) {
        finalStatus = calculations.status;
      }
    }

    // Preserve special statuses if explicitly selected
    if (["WO_PRESENT", "H_PRESENT", "HD_CL", "WO", "CL", "SL", "CO", "LOP", "H", "absent", "half_day"].includes(status)) {
      finalStatus = status;
    }

    const targetUserId = canOverride && userId ? userId : currentUser.userId;

    const existing = await db.select().from(attendance).where(
      and(eq(attendance.userId, targetUserId), eq(attendance.date, date))
    );

    let result;
    if (existing.length > 0) {
      [result] = await db.update(attendance).set({
        inTime: cleanInTime,
        outTime: cleanOutTime,
        workingHours,
        lateMinutes,
        overtimeMinutes,
        status: finalStatus,
        source: source || "manual",
        notes: notes ?? existing[0].notes,
        updatedAt: new Date(),
      }).where(eq(attendance.id, existing[0].id)).returning();
    } else {
      [result] = await db.insert(attendance).values({
        userId: targetUserId,
        date,
        inTime: cleanInTime,
        outTime: cleanOutTime,
        workingHours,
        lateMinutes,
        overtimeMinutes,
        status: finalStatus,
        source: source || "manual",
        notes: notes || null,
      }).returning();
    }

    // Audit log
    await db.insert(auditLogs).values({
      userId: currentUser.userId,
      action: existing.length > 0 ? "update" : "create",
      entity: "attendance",
      entityId: result.id,
      details: { targetUserId, date, status: finalStatus, workingHours, source },
    });

    return NextResponse.json({ attendance: result });
  } catch (error) {
    console.error("Attendance POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
