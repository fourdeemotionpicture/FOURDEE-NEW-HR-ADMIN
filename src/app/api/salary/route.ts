import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, attendance, holidays } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, parse, getDaysInMonth, eachDayOfInterval, getDay, parseISO } from "date-fns";
import { getUserLeaveBalances } from "@/lib/leave-balances";

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
    const officialHolidays = await db.select({ date: holidays.date, name: holidays.name }).from(holidays);
    const holidayDateMap = new Map(officialHolidays.map((h) => [h.date, h.name]));

    // Get employees
    let allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      personalEmail: users.personalEmail,
      phone: users.phone,
      accountNumber: users.accountNumber,
      ifscCode: users.ifscCode,
      dob: users.dob,
      biometricId: users.biometricId,
      role: users.role,
      designation: users.designation,
      monthlySalary: users.monthlySalary,
      createdAt: users.createdAt,
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

    // Calculate salary & leave balances for each employee
    const salaryData = await Promise.all(
      allUsers.map(async (user) => {
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

        const clDates: string[] = [];
        const coDates: string[] = [];
        const slDates: string[] = [];
        const holidayDates: string[] = [];
        const lopDates: string[] = [];
        const sundayWorkDates: string[] = [];
        const holidayWorkDates: string[] = [];

        // Analyze day-by-day
        for (const day of calendarDays) {
          const dateStr = format(day, "yyyy-MM-dd");
          const dateDisplay = format(day, "d MMM");
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
              lopDates.push(`${dateDisplay} (0.5 Day LOP)`);
            } else if (status === "WO") {
              woCount++;
              paidDays += 1.0;
            } else if (status === "CL") {
              clCount++;
              paidDays += 1.0;
              clDates.push(`${dateDisplay} (Full CL)`);
            } else if (status === "SL") {
              slCount++;
              paidDays += 1.0;
              slDates.push(dateDisplay);
            } else if (status === "CO") {
              coCount++;
              paidDays += 1.0;
              coDates.push(dateDisplay);
            } else if (status === "H") {
              holidayCount++;
              paidDays += 1.0;
              const hName = holidayDateMap.get(dateStr) || "Holiday";
              holidayDates.push(`${dateDisplay} (${hName})`);
            } else if (status === "WO_PRESENT") {
              presentCount++;
              paidDays += 1.0;
              sundayWorkDates.push(`${dateDisplay} (+1 CO Earned)`);
            } else if (status === "H_PRESENT") {
              presentCount++;
              paidDays += 1.0;
              const hName = holidayDateMap.get(dateStr) || "Holiday";
              holidayWorkDates.push(`${dateDisplay} - ${hName} (+1 CO Earned)`);
            } else if (status === "HD_CL" || status === "half_day_cl") {
              halfDayCount++;
              clCount += 0.5;
              paidDays += 1.0; // 0.5 work + 0.5 CL = 1.0 Full paid day!
              clDates.push(`${dateDisplay} (0.5 CL Applied)`);
            } else if (status === "LOP") {
              lopCount++;
              deductedDays += 1.0;
              lopDates.push(dateDisplay);
            } else if (status === "absent") {
              absentCount++;
              deductedDays += 1.0;
              lopDates.push(dateDisplay);
            }
          } else {
            // No record in DB
            if (getDay(day) === 0) {
              woCount++;
              paidDays += 1.0;
            } else if (holidayDateMap.has(dateStr)) {
              holidayCount++;
              paidDays += 1.0;
              const hName = holidayDateMap.get(dateStr) || "Holiday";
              holidayDates.push(`${dateDisplay} (${hName})`);
            } else {
              absentCount++;
              deductedDays += 1.0;
              lopDates.push(dateDisplay);
            }
          }
        }

        let lateDays = userAttendance.filter((a) => (a.lateMinutes ?? 0) > 0).length;
        const totalLateMinutes = userAttendance.reduce((acc, a) => acc + (a.lateMinutes ?? 0), 0);
        const totalWorkingHours = userAttendance.reduce((acc, a) => acc + parseFloat(a.workingHours ?? "0"), 0);
        const totalOvertime = userAttendance.reduce((acc, a) => acc + (a.overtimeMinutes ?? 0), 0);

        // Fetch annual CL & CO balances
        const balances = await getUserLeaveBalances(user.id, monthDate);

        // Deductions calculation
        let earnedSalary = paidDays * dailySalary;
        let deductions = deductedDays * dailySalary;
        let finalPayable = Math.max(0, monthlySalary - deductions);

        // Super Admin & Owner Admin get full salary
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
          personalEmail: user.personalEmail || null,
          phone: user.phone || null,
          accountNumber: user.accountNumber || null,
          ifscCode: user.ifscCode || null,
          dob: user.dob ? String(user.dob) : null,
          biometricId: user.biometricId ? String(user.biometricId) : null,
          designation: user.designation,
          role: user.role,
          monthlySalary: monthlySalary.toFixed(2),
          dailySalary: dailySalary.toFixed(2),
          hourlySalary: hourlySalary.toFixed(2),
          perMinuteSalary: perMinuteSalary.toFixed(4),
          totalDaysInMonth,
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
          totalLateMinutes,
          totalWorkingHours: totalWorkingHours.toFixed(1),
          totalOvertimeMinutes: totalOvertime,
          totalOvertimeHours: (totalOvertime / 60).toFixed(1),
          earnedSalary: earnedSalary.toFixed(2),
          deductions: deductions.toFixed(2),
          finalPayableSalary: finalPayable.toFixed(2),
          // Balances & Detailed lists
          clBalance: balances.clBalance,
          coBalance: balances.coBalance,
          clDates,
          coDates,
          slDates,
          holidayDates,
          lopDates,
          sundayWorkDates,
          holidayWorkDates,
        };
      })
    );

    return NextResponse.json({
      month,
      totalDaysInMonth,
      salary: salaryData,
    });
  } catch (error) {
    console.error("Salary GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
