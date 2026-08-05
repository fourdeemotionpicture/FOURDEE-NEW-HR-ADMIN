import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, attendance } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, parse, getDaysInMonth } from "date-fns";

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

    // Get employees
    let allUsers = await db.select({
      id: users.id,
      name: users.name,
      role: users.role,
      designation: users.designation,
      monthlySalary: users.monthlySalary,
    }).from(users).where(eq(users.isActive, true));

    if (currentUser.role === "employee") {
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

      const presentDays = userAttendance.filter((a) => a.status === "present" || a.status === "half_day").length;
      const lateDays = userAttendance.filter((a) => (a.lateMinutes ?? 0) > 0).length;
      const totalWorkingHours = userAttendance.reduce((acc, a) => acc + parseFloat(a.workingHours ?? "0"), 0);
      const totalOvertime = userAttendance.reduce((acc, a) => acc + (a.overtimeMinutes ?? 0), 0);
      const absentDays = totalDaysInMonth - presentDays;

      // Calculate earned salary based on working hours
      const earnedSalary = presentDays * dailySalary;
      const deductions = absentDays * dailySalary;
      const finalPayable = Math.max(0, monthlySalary - deductions);

      return {
        userId: user.id,
        name: user.name,
        designation: user.designation,
        role: user.role,
        monthlySalary: monthlySalary.toFixed(2),
        dailySalary: dailySalary.toFixed(2),
        hourlySalary: hourlySalary.toFixed(2),
        perMinuteSalary: perMinuteSalary.toFixed(4),
        presentDays,
        absentDays,
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
