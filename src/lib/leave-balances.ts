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

  // 1. CL Calculation (1 per month accrued)
  const clAccrued = Math.max(1, currentMonth - startMonth + 1);
  const attendanceRecords = await db.select().from(attendance).where(
    and(
      eq(attendance.userId, userId),
      gte(attendance.date, `${currentYear}-01-01`),
      lte(attendance.date, `${currentYear}-12-31`)
    )
  );

  const clUsed = attendanceRecords.filter((a) => a.status === "CL").length;
  const clAvailable = Math.max(0, clAccrued - clUsed);

  // 2. Comp Off (CO) Calculation
  // Get all official holiday dates for this year
  const allHolidays = await db.select({ date: holidays.date }).from(holidays).where(eq(holidays.year, currentYear));
  const holidayDateSet = new Set(allHolidays.map((h) => h.date));

  // Count days worked on a Holiday or Sunday (where status === 'present' or workingHours > 0 or inTime exists)
  let coAccrued = 0;
  for (const record of attendanceRecords) {
    // Only count if they actually worked (present / biometric check-in)
    if (record.status === "present" || (record.workingHours && parseFloat(record.workingHours) > 0) || (record.inTime && record.outTime)) {
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
