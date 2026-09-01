import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, attendance, holidays } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, parse, subMonths, getDaysInMonth, eachDayOfInterval, getDay } from "date-fns";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    // 1. Authorization Check (Allow Super Admin, Owner Admin, or Cron webhook secret)
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const expectedSecret = process.env.SYNC_SECRET || "FourDeeErpSync2026";
    
    const isCron = secret === expectedSecret;
    const isAdmin = currentUser && (currentUser.role === "super_admin" || currentUser.role === "owner_admin");

    if (!isCron && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Determine target month (defaults to previous month if not specified)
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
    const officialHolidays = await db.select({ date: holidays.date }).from(holidays);
    const holidayDateSet = new Set(officialHolidays.map((h) => h.date));

    // 3. Fetch active employees
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      personalEmail: users.personalEmail,
      role: users.role,
      designation: users.designation,
      monthlySalary: users.monthlySalary,
    }).from(users).where(eq(users.isActive, true));

    // Only email to employees and office admins
    const targetEmployees = allUsers.filter(
      (u) => (u.role === "employee" || u.role === "office_admin") && u.email
    );

    if (targetEmployees.length === 0) {
      return NextResponse.json({ success: true, message: "No active employees with configured emails found", month: targetMonth });
    }

    // 4. Fetch attendance records
    const monthAttendance = await db.select().from(attendance).where(
      and(gte(attendance.date, startDate), lte(attendance.date, endDate))
    );

    let sentCount = 0;
    const failures: string[] = [];

    // 5. Generate and email payslips
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
          if (getDay(day) === 0) {
            woCount++;
            paidDays += 1.0;
          } else if (holidayDateSet.has(dateStr)) {
            holidayCount++;
            paidDays += 1.0;
          } else {
            absentCount++;
            deductedDays += 1.0;
          }
        }
      }

      const deductions = deductedDays * dailySalary;
      const finalPayable = Math.max(0, monthlySalary - deductions);

      // Generate HTML email template
      const formattedMonth = format(monthDate, "MMMM yyyy");
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 25px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="margin: 0; color: #1e3a8a;">Four Dee Motion Picture</h2>
            <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280; font-weight: bold;">MONTHLY SALARY PAYSLIP</p>
            <p style="margin: 2px 0 0; font-size: 13px; color: #9ca3af;">For the period of ${formattedMonth}</p>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 20px 0;"/>
          
          <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 40%;">Employee Name:</td>
              <td style="padding: 6px 0;">${user.name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Designation:</td>
              <td style="padding: 6px 0;">${user.designation || "-"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Payment Method:</td>
              <td style="padding: 6px 0;">Bank Transfer</td>
            </tr>
          </table>

          <table style="width: 100%; border: 1px solid #e5e7eb; font-size: 13px; text-align: center; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f9fafb; font-weight: bold; border-bottom: 1px solid #e5e7eb;">
                <th style="padding: 8px; border-right: 1px solid #e5e7eb;">Present</th>
                <th style="padding: 8px; border-right: 1px solid #e5e7eb;">Week Off</th>
                <th style="padding: 8px; border-right: 1px solid #e5e7eb;">Paid Leaves</th>
                <th style="padding: 8px; border-right: 1px solid #e5e7eb;">LOP / Unpaid</th>
                <th style="padding: 8px;">Paid Days</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">${presentCount + halfDayCount * 0.5} day(s)</td>
                <td style="padding: 8px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">${woCount} day(s)</td>
                <td style="padding: 8px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">${clCount + slCount + coCount + holidayCount} day(s)</td>
                <td style="padding: 8px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">${lopCount + absentCount + halfDayCount * 0.5} day(s)</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #10b981;">${paidDays}</td>
              </tr>
            </tbody>
          </table>

          <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 25px;">
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 8px 0; color: #374151; font-weight: bold;">Gross Monthly Salary:</td>
              <td style="padding: 8px 0; text-align: right; color: #374151;">₹${monthlySalary.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">Deductions (LOP & Absent):</td>
              <td style="padding: 8px 0; text-align: right; color: #dc2626; font-weight: bold;">-₹${deductions.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr style="background-color: #eff6ff; font-size: 16px; font-weight: bold;">
              <td style="padding: 10px; color: #1e3a8a;">Net Payable Salary:</td>
              <td style="padding: 10px; text-align: right; color: #1e3a8a;">₹${finalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </table>

          <div style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 30px;">
            <p>This is a computer-generated payslip and does not require a physical signature.</p>
            <p>You can log in to your portal at any time to view your salary breakdown or download your PDF payslip.</p>
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
      message: `Successfully sent ${sentCount} payslips for ${targetMonth}`,
      month: targetMonth,
      sentCount,
      failures,
    });
  } catch (error) {
    console.error("Send payslips error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
