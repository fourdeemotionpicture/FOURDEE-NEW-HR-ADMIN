import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, attendance, holidays } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, parse, getDaysInMonth, eachDayOfInterval, getDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";
    const month = searchParams.get("month") || format(new Date(), "yyyy-MM");

    const monthDate = parse(month, "yyyy-MM", new Date());
    const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
    const totalDaysInMonth = getDaysInMonth(monthDate);
    const calendarDays = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });

    // Fetch official holidays for this year
    const officialHolidays = await db.select({ date: holidays.date }).from(holidays);
    const holidayDateSet = new Set(officialHolidays.map((h) => h.date));

    // Get employees
    let allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      designation: users.designation,
      monthlySalary: users.monthlySalary,
    }).from(users).where(eq(users.isActive, true));

    if (currentUser.role === "employee" || currentUser.role === "office_admin") {
      allUsers = allUsers.filter((u) => u.id === currentUser.userId);
    } else if (userId) {
      allUsers = allUsers.filter((u) => u.id === userId);
    }

    // Get attendance for the month
    const monthAttendance = await db.select().from(attendance).where(
      and(gte(attendance.date, startDate), lte(attendance.date, endDate))
    );

    // Calculate salary for each employee
    const salaryData = allUsers.map((user) => {
      const userAttendance = monthAttendance.filter((a) => a.userId === user.id);
      const monthlySalary = parseFloat(user.monthlySalary ?? "0");
      const dailySalary = monthlySalary / totalDaysInMonth;
      const hourlySalary = dailySalary / 8;
      const perMinuteSalary = hourlySalary / 60;

      let presentCount = 0;
      let halfDayCount = 0;
      let woCount = 0;
      let clCount = 0;
      let slCount = 0;
      let coCount = 0;
      let holidayCount = 0;
      let lopCount = 0;
      let absentCount = 0;

      let paidDays = 0.0;
      let deductedDays = 0.0;

      // Analyze day-by-day
      for (const day of calendarDays) {
        const dateStr = format(day, "yyyy-MM-dd");
        const record = userAttendance.find((a) => a.date === dateStr);

        if (record) {
          const status = record.status;
          if (status === "present") {
            presentCount++;
            paidDays += 1.0;
          } else if (status === "half_day") {
            halfDayCount++;
            paidDays += 0.5;
            deductedDays += 0.5;
          } else if (status === "WO") {
            woCount++;
            paidDays += 1.0;
          } else if (status === "CL") {
            clCount++;
            paidDays += 1.0;
          } else if (status === "SL") {
            slCount++;
            paidDays += 1.0;
          } else if (status === "CO") {
            coCount++;
            paidDays += 1.0;
          } else if (status === "H") {
            holidayCount++;
            paidDays += 1.0;
          } else if (status === "LOP") {
            lopCount++;
            deductedDays += 1.0;
          } else if (status === "absent") {
            absentCount++;
            deductedDays += 1.0;
          }
        } else {
          // No record in DB
          if (getDay(day) === 0) {
            // Sunday is automatically Week Off
            woCount++;
            paidDays += 1.0;
          } else if (holidayDateSet.has(dateStr)) {
            // Official public holiday is automatically a paid day
            holidayCount++;
            paidDays += 1.0;
          } else {
            // Weekday with no record is absent
            absentCount++;
            deductedDays += 1.0;
          }
        }
      }

      let lateDays = userAttendance.filter((a) => (a.lateMinutes ?? 0) > 0).length;
      const totalWorkingHours = userAttendance.reduce((acc, a) => acc + parseFloat(a.workingHours ?? "0"), 0);
      const totalOvertime = userAttendance.reduce((acc, a) => acc + (a.overtimeMinutes ?? 0), 0);

      // Deductions calculation
      let earnedSalary = paidDays * dailySalary;
      let deductions = deductedDays * dailySalary;
      let finalPayable = Math.max(0, monthlySalary - deductions);

      // If user is Super Admin or Owner Admin, they get full salary always
      if (user.role !== "employee" && user.role !== "office_admin") {
        presentCount = totalDaysInMonth;
        absentCount = 0;
        deductions = 0;
        earnedSalary = monthlySalary;
        finalPayable = monthlySalary;
        paidDays = totalDaysInMonth;
        deductedDays = 0;
      }

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        designation: user.designation,
        role: user.role,
        monthlySalary: monthlySalary.toFixed(2),
        dailySalary: dailySalary.toFixed(2),
        hourlySalary: hourlySalary.toFixed(2),
        perMinuteSalary: perMinuteSalary.toFixed(4),
        presentDays: presentCount,
        halfDays: halfDayCount,
        woDays: woCount,
        clDays: clCount,
        slDays: slCount,
        coDays: coCount,
        holidayDays: holidayCount,
        lopDays: lopCount,
        absentDays: absentCount,
        paidDays,
        deductedDays,
        lateDays,
        totalWorkingHours: totalWorkingHours.toFixed(1),
        totalOvertimeMinutes: totalOvertime,
        earnedSalary: earnedSalary.toFixed(2),
        deductions: deductions.toFixed(2),
        finalPayableSalary: finalPayable.toFixed(2),
      };
    });

    return NextResponse.json({ salary: salaryData, month, totalDaysInMonth });
  } catch (error) {
    console.error("Salary GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
