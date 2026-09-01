import { db } from "@/db";
import { users, attendance, holidays } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getDay } from "date-fns";

export interface LeaveBalances {
  clBalance: { accrued: number; used: number; available: number };
  coBalance: { accrued: number; used: number; available: number };
}

export async function getUserLeaveBalances(userId: string, targetDate: Date = new Date()): Promise<LeaveBalances> {
  const currentMonth = targetDate.getMonth() + 1; // 1 to 12
  const currentYear = targetDate.getFullYear();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return {
      clBalance: { accrued: 0, used: 0, available: 0 },
      coBalance: { accrued: 0, used: 0, available: 0 },
    };
  }

  let startMonth = 1;
  const joinDate = new Date(user.createdAt);
  if (joinDate.getFullYear() === currentYear) {
    startMonth = joinDate.getMonth() + 1;
  }

  // 1. CL Calculation (1.0 per month accrued)
  const clAccrued = Math.max(1, currentMonth - startMonth + 1);
  const attendanceRecords = await db.select().from(attendance).where(
    and(
      eq(attendance.userId, userId),
      gte(attendance.date, `${currentYear}-01-01`),
      lte(attendance.date, `${currentYear}-12-31`)
    )
  );

  // Full day CL = 1.0 day, Half day CL (HD_CL) = 0.5 day
  let clUsed = 0;
  for (const record of attendanceRecords) {
    if (record.status === "CL") {
      clUsed += 1.0;
    } else if (record.status === "HD_CL" || record.status === "half_day_cl") {
      clUsed += 0.5;
    }
  }

  const clAvailable = Math.max(0, Math.round((clAccrued - clUsed) * 10) / 10);

  // 2. Comp Off (CO) Calculation
  // Get all official holiday dates for this year
  const allHolidays = await db.select({ date: holidays.date }).from(holidays).where(eq(holidays.year, currentYear));
  const holidayDateSet = new Set(allHolidays.map((h) => h.date));

  // Count days worked on a Holiday or Sunday (where status === 'present', 'half_day', 'WO_PRESENT', 'H_PRESENT', or workingHours > 0)
  let coAccrued = 0;
  for (const record of attendanceRecords) {
    const isWorked = 
      record.status === "present" || 
      record.status === "half_day" || 
      record.status === "WO_PRESENT" || 
      record.status === "H_PRESENT" || 
      record.status === "HD_CL" ||
      (record.workingHours && parseFloat(record.workingHours) > 0) || 
      (record.inTime && record.outTime);

    if (isWorked) {
      const recordDate = new Date(record.date);
      const isSunday = getDay(recordDate) === 0;
      const isHoliday = holidayDateSet.has(record.date);

      if (isSunday || isHoliday) {
        coAccrued++;
      }
    }
  }

  const coUsed = attendanceRecords.filter((a) => a.status === "CO").length;
  const coAvailable = Math.max(0, coAccrued - coUsed);

  return {
    clBalance: { accrued: clAccrued, used: clUsed, available: clAvailable },
    coBalance: { accrued: coAccrued, used: coUsed, available: coAvailable },
  };
}
