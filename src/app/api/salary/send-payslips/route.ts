import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, attendance, holidays } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, parse, subMonths, getDaysInMonth, eachDayOfInterval, getDay } from "date-fns";
import { sendEmail } from "@/lib/email";
import { getUserLeaveBalances } from "@/lib/leave-balances";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const expectedSecret = process.env.SYNC_SECRET || "FourDeeErpSync2026";
    
    const isCron = secret === expectedSecret;
    const isAdmin = currentUser && (currentUser.role === "super_admin" || currentUser.role === "owner_admin");

    if (!isCron && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let targetMonth = body.month || searchParams.get("month");
    
    if (!targetMonth) {
      const prevMonthDate = subMonths(new Date(), 1);
      targetMonth = format(prevMonthDate, "yyyy-MM");
    }

    const monthDate = parse(targetMonth, "yyyy-MM", new Date());
    const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
    const totalDaysInMonth = getDaysInMonth(monthDate);
    const calendarDays = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });

    // Fetch official holidays
    const officialHolidays = await db.select({ date: holidays.date, name: holidays.name }).from(holidays);
    const holidayDateMap = new Map(officialHolidays.map((h) => [h.date, h.name]));

    // Fetch active employees
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      personalEmail: users.personalEmail,
      phone: users.phone,
      biometricId: users.biometricId,
      role: users.role,
      designation: users.designation,
      monthlySalary: users.monthlySalary,
    }).from(users).where(eq(users.isActive, true));

    // Only email to employees and office admins
    const targetEmployees = allUsers.filter(
      (u) => (u.role === "employee" || u.role === "office_admin") && (u.personalEmail || u.email)
    );

    if (targetEmployees.length === 0) {
      return NextResponse.json({ success: true, message: "No active employees with configured emails found", month: targetMonth });
    }

    // Fetch attendance records
    const monthAttendance = await db.select().from(attendance).where(
      and(gte(attendance.date, startDate), lte(attendance.date, endDate))
    );

    let sentCount = 0;
    const failures: string[] = [];

    for (const user of targetEmployees) {
      const userAttendance = monthAttendance.filter((a) => a.userId === user.id);
      const monthlySalary = parseFloat(user.monthlySalary ?? "0");
      const dailySalary = monthlySalary / totalDaysInMonth;

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
      const holidayDates: string[] = [];
      const lopDates: string[] = [];
      const weekendWorkDates: string[] = [];

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
            lopDates.push(`${dateDisplay} (0.5d LOP)`);
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
            weekendWorkDates.push(`${dateDisplay} (Sunday +1 CO)`);
          } else if (status === "H_PRESENT") {
            presentCount++;
            paidDays += 1.0;
            const hName = holidayDateMap.get(dateStr) || "Holiday";
            weekendWorkDates.push(`${dateDisplay} (${hName} +1 CO)`);
          } else if (status === "HD_CL" || status === "half_day_cl") {
            halfDayCount++;
            clCount += 0.5;
            paidDays += 1.0;
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

      const totalWorkingHours = userAttendance.reduce((acc, a) => acc + parseFloat(a.workingHours ?? "0"), 0);
      const totalOvertime = userAttendance.reduce((acc, a) => acc + (a.overtimeMinutes ?? 0), 0);
      const totalOvertimeHours = (totalOvertime / 60).toFixed(1);
      const totalLateMinutes = userAttendance.reduce((acc, a) => acc + (a.lateMinutes ?? 0), 0);

      const balances = await getUserLeaveBalances(user.id, monthDate);

      const deductions = deductedDays * dailySalary;
      const earnedSalary = paidDays * dailySalary;
      const finalPayable = Math.max(0, monthlySalary - deductions);

      const formattedMonth = format(monthDate, "MMMM yyyy");
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background-color: #0f172a; padding: 24px 28px; color: #ffffff; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Four Dee Motion Picture</h2>
              <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Office ERP & Payroll System • teamsimran.in</p>
            </div>
            <div style="text-align: right;">
              <span style="background-color: #2563eb; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 8px; border-radius: 6px; text-transform: uppercase;">Official Payslip</span>
              <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1; font-weight: 600;">${formattedMonth}</p>
            </div>
          </div>

          <div style="padding: 24px 28px;">
            <!-- Employee Info -->
            <table style="width: 100%; font-size: 13px; color: #334155; margin-bottom: 20px; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0; color: #64748b; width: 25%;">Employee Name:</td>
                <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${user.name}</td>
                <td style="padding: 5px 0; color: #64748b; width: 25%;">Biometric ID:</td>
                <td style="padding: 5px 0; font-weight: 600;">${user.biometricId ? `#${user.biometricId}` : "Standard"}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #64748b;">Designation:</td>
                <td style="padding: 5px 0; font-weight: 600;">${user.designation || "-"}</td>
                <td style="padding: 5px 0; color: #64748b;">Payment Mode:</td>
                <td style="padding: 5px 0; font-weight: 600;">Direct Bank Transfer</td>
              </tr>
            </table>

            <!-- 4 Metrics -->
            <table style="width: 100%; border-collapse: separate; border-spacing: 6px; margin-bottom: 20px;">
              <tr>
                <td style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px; border-radius: 10px; text-align: center;">
                  <span style="font-size: 10px; color: #065f46; text-transform: uppercase; font-weight: 700; display: block;">Paid Days</span>
                  <span style="font-size: 16px; font-weight: 800; color: #047857;">${paidDays} / ${totalDaysInMonth}</span>
                </td>
                <td style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 10px; border-radius: 10px; text-align: center;">
                  <span style="font-size: 10px; color: #1e40af; text-transform: uppercase; font-weight: 700; display: block;">Working Hours</span>
                  <span style="font-size: 16px; font-weight: 800; color: #1d4ed8;">${totalWorkingHours.toFixed(1)}h</span>
                </td>
                <td style="background-color: #faf5ff; border: 1px solid #e9d5ff; padding: 10px; border-radius: 10px; text-align: center;">
                  <span style="font-size: 10px; color: #6b21a8; text-transform: uppercase; font-weight: 700; display: block;">Overtime</span>
                  <span style="font-size: 16px; font-weight: 800; color: #7e22ce;">${totalOvertimeHours}h</span>
                </td>
                <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 10px; text-align: center;">
                  <span style="font-size: 10px; color: #475569; text-transform: uppercase; font-weight: 700; display: block;">Late Time</span>
                  <span style="font-size: 16px; font-weight: 800; color: #334155;">${totalLateMinutes}m</span>
                </td>
              </tr>
            </table>

            <!-- Leave Quotas & Activity -->
            <div style="background-color: #fdf4ff; border: 1px solid #f0abfc; padding: 14px 16px; border-radius: 12px; margin-bottom: 20px; font-size: 12px;">
              <div style="font-weight: 700; color: #701a75; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">
                🗓️ Leave Quotas & Balances
              </div>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                <tr>
                  <td style="width: 50%; color: #4a044e;">
                    <b>Casual Leave (CL):</b> ${balances.clBalance.available} Days Available <br/>
                    <span style="color: #701a75; font-size: 10px;">(Accrued: ${balances.clBalance.accrued} | Used: ${balances.clBalance.used})</span>
                  </td>
                  <td style="width: 50%; color: #312e81;">
                    <b>Comp Off (CO):</b> ${balances.coBalance.available} Days Available <br/>
                    <span style="color: #4338ca; font-size: 10px;">(Earned from Holidays/Sundays: ${balances.coBalance.accrued})</span>
                  </td>
                </tr>
              </table>
              <div style="font-size: 11px; color: #4a044e; border-top: 1px dashed #e879f9; padding-top: 6px;">
                ${clDates.length > 0 ? `<div><b>CL Taken:</b> ${clDates.join(", ")}</div>` : ""}
                ${holidayDates.length > 0 ? `<div><b>Public Holidays:</b> ${holidayDates.join(", ")}</div>` : ""}
                ${weekendWorkDates.length > 0 ? `<div><b>Weekend/Holiday Work (+1 CO):</b> ${weekendWorkDates.join(", ")}</div>` : ""}
                ${lopDates.length > 0 ? `<div style="color: #b91c1c;"><b>LOP / Deductions:</b> ${lopDates.join(", ")} (${deductedDays} days)</div>` : ""}
                ${clDates.length === 0 && lopDates.length === 0 ? `<div style="color: #047857;">✨ Full attendance maintained with zero unapproved deductions.</div>` : ""}
              </div>
            </div>

            <!-- Financials Table -->
            <table style="width: 100%; border: 1px solid #e2e8f0; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f1f5f9; font-weight: 700; color: #1e293b;">
                  <th style="padding: 8px 12px; text-align: left; border-right: 1px solid #e2e8f0;">Earnings</th>
                  <th style="padding: 8px 12px; text-align: right;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 12px; color: #334155; border-right: 1px solid #e2e8f0;">Gross Monthly Salary</td>
                  <td style="padding: 8px 12px; text-align: right; font-weight: 600;">₹${monthlySalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 12px; color: #dc2626; border-right: 1px solid #e2e8f0;">Loss of Pay (LOP Deductions - ${deductedDays} days)</td>
                  <td style="padding: 8px 12px; text-align: right; color: #dc2626; font-weight: 700;">-₹${deductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <!-- Net Payable Banner -->
            <div style="background-color: #1e3a8a; color: #ffffff; padding: 16px 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div>
                <span style="font-size: 10px; text-transform: uppercase; color: #93c5fd; font-weight: 700; display: block;">Net Salary Payable</span>
                <span style="font-size: 11px; color: #dbeafe;">Disbursed via Direct Bank Transfer</span>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 22px; font-weight: 900; color: #ffffff;">₹${finalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style="font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
              <p style="margin: 0;">This is an official computer-generated payroll voucher issued under Four Dee Motion Picture ERP.</p>
              <p style="margin: 4px 0 0;">© 2026 Four Dee Motion Picture. All rights reserved.</p>
            </div>
          </div>
        </div>
      `;

      const targetMail = user.personalEmail || user.email;
      if (targetMail) {
        const mailResult = await sendEmail({
          to: targetMail,
          subject: `📄 Salary Payslip - ${formattedMonth} - Four Dee Motion Picture`,
          html: htmlBody,
        });

        if (mailResult.success) {
          sentCount++;
        } else {
          failures.push(`${user.name} (${targetMail})`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${sentCount} detailed payslips for ${targetMonth}`,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (error) {
    console.error("Send payslips error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
