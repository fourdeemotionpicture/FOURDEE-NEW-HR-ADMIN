import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, attendance, workReports } from "@/db/schema";
import { eq, and, gte, lte, asc, desc } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { month, recipientEmail, includeAttendance = true, includeWorkReports = true, targetUserId } = body;

    // Check if manager is sharing for an employee, or employee is sharing self
    const isManager = currentUser.role === "super_admin" || currentUser.role === "owner_admin";
    const userIdToFetch = isManager && targetUserId ? targetUserId : currentUser.userId;

    const [user] = await db.select().from(users).where(eq(users.id, userIdToFetch)).limit(1);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const targetMonth = month || format(new Date(), "yyyy-MM");
    const monthDate = parse(targetMonth, "yyyy-MM", new Date());
    const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
    const formattedMonthName = format(monthDate, "MMMM yyyy");

    const emailToSend = recipientEmail || user.personalEmail || user.email;
    if (!emailToSend) {
      return NextResponse.json({ error: "No recipient email address specified or found in profile" }, { status: 400 });
    }

    // 1. Fetch Attendance Records for this month
    const userAttendance = await db.select().from(attendance).where(
      and(
        eq(attendance.userId, user.id),
        gte(attendance.date, startDate),
        lte(attendance.date, endDate)
      )
    ).orderBy(asc(attendance.date));

    // 2. Fetch Work Reports for this month
    const userReports = await db.select().from(workReports).where(
      and(
        eq(workReports.userId, user.id),
        gte(workReports.date, startDate),
        lte(workReports.date, endDate)
      )
    ).orderBy(asc(workReports.date));

    // Calculate quick stats
    const presentDays = userAttendance.filter((a) => a.status === "present").length;
    const halfDays = userAttendance.filter((a) => a.status === "half_day").length;
    const leaves = userAttendance.filter((a) => ["CL", "SL", "CO", "H"].includes(a.status)).length;
    const totalWorkingHours = userAttendance.reduce((acc, a) => acc + parseFloat(a.workingHours ?? "0"), 0);

    // Construct HTML Email Content
    let htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; color: #1f2937; background-color: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0; color: #1e3a8a; font-size: 22px;">Four Dee Motion Pictures Private Limited</h2>
          <p style="margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #4b5563;">Monthly Employee Performance & Activity Report</p>
          <p style="margin: 4px 0 0; font-size: 13px; color: #9ca3af;">Period: <b>${formattedMonthName}</b></p>
        </div>

        <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 24px; background-color: #f9fafb; padding: 12px; border-radius: 8px;">
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #4b5563; width: 35%;">Employee Name:</td>
            <td style="padding: 8px 12px; color: #111827;">${user.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #4b5563;">Designation / Role:</td>
            <td style="padding: 8px 12px; color: #111827;">${user.designation || user.role}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #4b5563;">Official / Personal Email:</td>
            <td style="padding: 8px 12px; color: #111827;">${user.personalEmail ? `${user.personalEmail} (${user.email})` : user.email}</td>
          </tr>
        </table>
    `;

    // Attendance Section
    if (includeAttendance) {
      htmlContent += `
        <div style="margin-bottom: 28px;">
          <h3 style="font-size: 16px; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 14px;">
            📅 Attendance Summary (${formattedMonthName})
          </h3>
          
          <div style="display: flex; gap: 10px; margin-bottom: 14px; text-align: center;">
            <div style="flex: 1; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 10px;">
              <div style="font-size: 11px; color: #065f46; font-weight: bold;">PRESENT</div>
              <div style="font-size: 18px; font-weight: bold; color: #047857; margin-top: 2px;">${presentDays}</div>
            </div>
            <div style="flex: 1; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 10px;">
              <div style="font-size: 11px; color: #92400e; font-weight: bold;">HALF DAYS</div>
              <div style="font-size: 18px; font-weight: bold; color: #b45309; margin-top: 2px;">${halfDays}</div>
            </div>
            <div style="flex: 1; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 10px;">
              <div style="font-size: 11px; color: #5b21b6; font-weight: bold;">APPROVED LEAVES</div>
              <div style="font-size: 18px; font-weight: bold; color: #6d28d9; margin-top: 2px;">${leaves}</div>
            </div>
            <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px;">
              <div style="font-size: 11px; color: #1e40af; font-weight: bold;">HOURS WORKED</div>
              <div style="font-size: 18px; font-weight: bold; color: #1d4ed8; margin-top: 2px;">${totalWorkingHours.toFixed(1)}h</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background-color: #f3f4f6; color: #374151; border-bottom: 1px solid #e5e7eb;">
                <th style="padding: 8px 10px; border-right: 1px solid #e5e7eb;">Date</th>
                <th style="padding: 8px 10px; border-right: 1px solid #e5e7eb;">Status</th>
                <th style="padding: 8px 10px; border-right: 1px solid #e5e7eb;">In Time</th>
                <th style="padding: 8px 10px; border-right: 1px solid #e5e7eb;">Out Time</th>
                <th style="padding: 8px 10px; border-right: 1px solid #e5e7eb;">Hours</th>
                <th style="padding: 8px 10px;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${userAttendance.length === 0 ? `
                <tr><td colspan="6" style="padding: 12px; text-align: center; color: #9ca3af;">No attendance logs found for this month</td></tr>
              ` : userAttendance.map((a) => `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 6px 10px; border-right: 1px solid #f3f4f6; font-weight: 500;">${a.date}</td>
                  <td style="padding: 6px 10px; border-right: 1px solid #f3f4f6;">
                    <span style="font-weight: bold; color: ${a.status === 'present' ? '#059669' : a.status === 'absent' ? '#dc2626' : '#6d28d9'};">
                      ${a.status.toUpperCase()}
                    </span>
                  </td>
                  <td style="padding: 6px 10px; border-right: 1px solid #f3f4f6; color: #4b5563;">${a.inTime || '-'}</td>
                  <td style="padding: 6px 10px; border-right: 1px solid #f3f4f6; color: #4b5563;">${a.outTime || '-'}</td>
                  <td style="padding: 6px 10px; border-right: 1px solid #f3f4f6; color: #4b5563;">${a.workingHours ? `${a.workingHours}h` : '-'}</td>
                  <td style="padding: 6px 10px; color: #6b7280;">${a.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Work Reports Section
    if (includeWorkReports) {
      htmlContent += `
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 16px; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 14px;">
            📝 Daily Work Reports (${userReports.length} Submitted)
          </h3>

          ${userReports.length === 0 ? `
            <p style="font-size: 13px; color: #9ca3af; text-align: center; padding: 12px; background: #f9fafb; border-radius: 8px;">No work reports logged for this period.</p>
          ` : `
            <div style="space-y: 10px;">
              ${userReports.map((r) => `
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                  <div style="font-size: 12px; font-weight: bold; color: #2563eb; margin-bottom: 4px;">📅 Date: ${r.date}</div>
                  <div style="font-size: 13px; color: #374151; line-height: 1.5; white-space: pre-wrap;">${r.description}</div>
                  ${r.notes ? `<div style="font-size: 12px; color: #6b7280; margin-top: 6px; font-style: italic;">Note: ${r.notes}</div>` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    }

    htmlContent += `
        <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 18px; margin-top: 24px; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0;">This report was generated directly from the Four Dee Motion Pictures Private Limited ERP Portal.</p>
          <p style="margin: 4px 0 0;">© Four Dee Motion Pictures Private Limited. All rights reserved.</p>
        </div>
      </div>
    `;

    // Send Email
    const mailResult = await sendEmail({
      to: emailToSend,
      subject: `📊 ${formattedMonthName} Report - ${user.name} (Attendance & Work Summary)`,
      html: htmlContent,
    });

    return NextResponse.json({
      success: true,
      message: `Report successfully emailed to ${emailToSend}!`,
      recipient: emailToSend,
      mailResult,
    });
  } catch (error) {
    console.error("Share reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
