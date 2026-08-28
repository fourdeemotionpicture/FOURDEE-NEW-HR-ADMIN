import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, attendance, workReports, expenses, pettyCash, leaveRequests } from "@/db/schema";
import { eq, and, gte, lte, sql, count, sum } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, getDaysInMonth } from "date-fns";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    // Total employees
    const allUsers = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.isActive, true));
    const totalEmployees = allUsers.length;

    // Today's attendance
    const todayAttendance = await db.select().from(attendance).where(eq(attendance.date, today));
    const presentToday = todayAttendance.filter((a) => a.status === "present" || a.status === "half_day").length;
    const lateToday = todayAttendance.filter((a) => (a.lateMinutes ?? 0) > 0).length;
    const absentToday = totalEmployees - presentToday;

    // Monthly attendance stats
    const monthlyAttendance = await db.select().from(attendance).where(
      and(gte(attendance.date, monthStart), lte(attendance.date, monthEnd))
    );

    // Today's expenses
    const todayExpenses = await db.select({
      total: sum(expenses.amount),
    }).from(expenses).where(eq(expenses.date, today));

    // Monthly expenses
    const monthlyExpenses = await db.select({
      total: sum(expenses.amount),
    }).from(expenses).where(
      and(gte(expenses.date, monthStart), lte(expenses.date, monthEnd))
    );

    // Current cash balance
    const lastPettyCash = await db.select().from(pettyCash).orderBy(sql`${pettyCash.createdAt} DESC`).limit(1);
    const currentBalance = lastPettyCash.length > 0 ? (lastPettyCash[0].balanceAfter ?? "0") : "0";

    // Work reports today
    const todayWorkReports = await db.select().from(workReports).where(eq(workReports.date, today));

    // Monthly work reports
    const monthlyWorkReports = await db.select().from(workReports).where(
      and(gte(workReports.date, monthStart), lte(workReports.date, monthEnd))
    );

    // Working hours today
    const todayWorkingHours = todayAttendance.reduce((acc, a) => acc + parseFloat(a.workingHours ?? "0"), 0);

    // Fetch current user database profile to get their salary
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, currentUser.userId),
    });

    const isEmployee = currentUser.role === "employee";
    const isOfficeAdmin = currentUser.role === "office_admin";
    const employeeId = currentUser.userId;

    let filteredAttendance = monthlyAttendance;
    let filteredWorkReports = monthlyWorkReports;

    if (isEmployee || isOfficeAdmin) {
      filteredAttendance = monthlyAttendance.filter((a) => a.userId === employeeId);
      filteredWorkReports = monthlyWorkReports.filter((w) => w.userId === employeeId);
    }

    // Salary estimation for dashboard
    let employeeSalary = {
      monthlySalary: "0",
      estimatedPayable: "0",
    };

    let personalStats = {
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
    };

    if (dbUser) {
      const monthlySalary = parseFloat(dbUser.monthlySalary ?? "0");
      employeeSalary.monthlySalary = monthlySalary.toFixed(2);

      let estimatedPayable = monthlySalary;
      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;

      if (dbUser.role === "employee" || dbUser.role === "office_admin") {
        const totalDaysInMonth = getDaysInMonth(new Date());
        const dailySalary = monthlySalary / totalDaysInMonth;

        const userAttendance = monthlyAttendance.filter((a) => a.userId === dbUser.id);
        presentDays = userAttendance.filter((a) => a.status === "present" || a.status === "half_day").length;
        lateDays = userAttendance.filter((a) => (a.lateMinutes ?? 0) > 0).length;
        absentDays = totalDaysInMonth - presentDays;
        const deductions = absentDays * dailySalary;
        estimatedPayable = Math.max(0, monthlySalary - deductions);
      }

      employeeSalary.estimatedPayable = estimatedPayable.toFixed(2);
      
      personalStats = {
        presentDays,
        absentDays,
        lateDays,
      };
    }

    // Attendance trend for chart (last 7 days)
    const attendanceTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayAttendance = monthlyAttendance.filter((a) => a.date === dateStr);
      attendanceTrend.push({
        date: format(d, "MMM dd"),
        present: dayAttendance.filter((a) => a.status === "present" || a.status === "half_day").length,
        late: dayAttendance.filter((a) => (a.lateMinutes ?? 0) > 0).length,
      });
    }

    // Count pending leave requests
    let pendingLeavesCount = 0;
    if (currentUser.role === "super_admin" || currentUser.role === "owner_admin") {
      const pendingReqs = await db.select().from(leaveRequests).where(eq(leaveRequests.status, "pending"));
      pendingLeavesCount = pendingReqs.length;
    }

    return NextResponse.json({
      userRole: currentUser.role,
      employeeSalary,
      personalStats,
      totalEmployees,
      presentToday,
      lateToday,
      absentToday,
      todayWorkingHours: todayWorkingHours.toFixed(1),
      monthlyAttendance: filteredAttendance.length,
      todayExpenses: todayExpenses[0]?.total ?? "0",
      monthlyExpenses: monthlyExpenses[0]?.total ?? "0",
      currentBalance,
      todayWorkReports: isEmployee ? todayWorkReports.filter((w) => w.userId === employeeId).length : todayWorkReports.length,
      monthlyWorkReports: filteredWorkReports.length,
      attendanceTrend,
      pendingLeavesCount,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
