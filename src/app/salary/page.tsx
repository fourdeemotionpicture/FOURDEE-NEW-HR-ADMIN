"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { IndianRupee, Download, ChevronLeft, ChevronRight, Mail, Printer, Clock, Calendar, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, addMonths, subMonths } from "date-fns";

interface LeaveQuota {
  accrued: number;
  used: number;
  available: number;
}

interface SalaryRecord {
  userId: string;
  name: string;
  designation: string;
  role: string;
  email: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  dob?: string | null;
  biometricId?: string | null;
  monthlySalary: string;
  dailySalary: string;
  hourlySalary: string;
  perMinuteSalary: string;
  totalDaysInMonth?: number;
  presentDays: number;
  halfDays: number;
  woDays: number;
  clDays: number;
  slDays: number;
  coDays: number;
  holidayDays: number;
  lopDays: number;
  absentDays: number;
  paidDays: number;
  deductedDays: number;
  lateDays: number;
  totalLateMinutes?: number;
  totalWorkingHours: string;
  totalOvertimeMinutes: number;
  totalOvertimeHours?: string;
  earnedSalary: string;
  deductions: string;
  finalPayableSalary: string;
  clBalance?: LeaveQuota;
  coBalance?: LeaveQuota;
  clDates?: string[];
  coDates?: string[];
  slDates?: string[];
  holidayDates?: string[];
  lopDates?: string[];
  sundayWorkDates?: string[];
  holidayWorkDates?: string[];
}

export default function SalaryPage() {
  const [data, setData] = useState<{ salary: SalaryRecord[]; month: string; totalDaysInMonth: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState("");
  const [userRole, setUserRole] = useState("employee");
  
  const [sendingEmails, setSendingEmails] = useState(false);
  const [printRecord, setPrintRecord] = useState<SalaryRecord | null>(null);

  const monthStr = format(currentMonth, "yyyy-MM");
  const isManager = userRole === "super_admin" || userRole === "owner_admin";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/salary?month=${monthStr}${selectedUser ? `&userId=${selectedUser}` : ""}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [monthStr, selectedUser]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.role) setUserRole(d.role);
      })
      .catch(console.error);
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const handleExport = () => {
    if (!data) return;
    const headers = [
      "Name", "Designation", "Role", "Biometric ID", "Monthly Salary", 
      "Paid Days", "Deducted Days", "Working Hrs", "Overtime (Hrs)", 
      "Available CL", "Available CO", "CL Dates Taken", "LOP Dates", 
      "Earned Salary", "Deductions", "Final Net Payable"
    ];
    const rows = data.salary.map((s) => [
      `"${s.name}"`, 
      `"${s.designation || "-"}"`,
      `"${s.role}"`,
      `"${s.biometricId || "-"}"`,
      s.monthlySalary, 
      s.paidDays, 
      s.deductedDays, 
      s.totalWorkingHours, 
      s.totalOvertimeHours || "0.0",
      s.clBalance?.available ?? s.clDays,
      s.coBalance?.available ?? s.coDays,
      `"${(s.clDates || []).join(", ")}"`,
      `"${(s.lopDates || []).join(", ")}"`,
      s.earnedSalary, 
      s.deductions, 
      s.finalPayableSalary
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salary-report-${monthStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendEmails = async () => {
    if (!confirm(`Are you sure you want to email all payslips for ${format(currentMonth, "MMMM yyyy")}?`)) return;
    setSendingEmails(true);
    try {
      const res = await fetch("/api/salary/send-payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: monthStr }),
      });
      const resData = await res.json();
      if (res.ok) {
        alert(resData.message || "Payslips sent successfully!");
      } else {
        alert(resData.error || "Failed to send payslips");
      }
    } catch {
      alert("Network error.");
    } finally {
      setSendingEmails(false);
    }
  };

  const handlePrintPayslip = (s: SalaryRecord) => {
    setPrintRecord(s);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        
        {/* Style Tag for Page Printing */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #print-section, #print-section * {
              visibility: visible;
            }
            #print-section {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 20px;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}} />

        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salary Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Automated payroll, leave quotas & detailed payslip generation</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isManager && (
              <button 
                onClick={handleSendEmails} 
                disabled={sendingEmails}
                className="btn-secondary text-blue-600 border-blue-100 hover:bg-blue-50/50 flex items-center gap-1.5"
              >
                <Mail className="w-4.5 h-4.5" /> 
                {sendingEmails ? "Sending..." : "Email Payslips to All"}
              </button>
            )}
            <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5">
              <Download className="w-4.5 h-4.5" /> Export Detailed CSV
            </button>
          </div>
        </motion.div>

        {/* Month selector */}
        <div className="card p-4 flex items-center justify-between print:hidden">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">{format(currentMonth, "MMMM yyyy")}</h2>
            <p className="text-xs text-gray-400 font-medium">Pay Period ({data?.totalDaysInMonth || 30} Days)</p>
          </div>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
        </div>

        {/* Salary Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
            {[...Array(3)].map((_, i) => <div key={i} className="h-80 rounded-2xl bg-white animate-pulse border border-gray-100" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print:hidden">
            {data?.salary.map((s) => (
              <motion.div key={s.userId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                        <span className="text-base font-bold text-blue-600">{s.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.designation || s.role}</p>
                        {s.biometricId && <p className="text-[10px] text-blue-500 font-medium">Bio ID: #{s.biometricId}</p>}
                      </div>
                    </div>
                    <button 
                      onClick={() => handlePrintPayslip(s)}
                      className="p-2 rounded-xl bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors border border-gray-100" 
                      title="Download / Print Detailed Payslip"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quotas & Attendance Details */}
                  <div className="space-y-1.5 text-xs border-b border-gray-100 pb-3 mb-3 bg-gray-50/50 p-3 rounded-xl">
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-600">Total Paid Days:</span>
                      <span className="text-emerald-600 font-bold">{s.paidDays} / {data.totalDaysInMonth} days</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Working Hours / OT:</span>
                      <span className="font-medium text-gray-800">{s.totalWorkingHours}h | {s.totalOvertimeHours || "0.0"}h OT</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Casual Leave (CL) Balance:</span>
                      <span className="font-semibold text-purple-700">{s.clBalance?.available ?? s.clDays} Days left</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Comp Off (CO) Balance:</span>
                      <span className="font-semibold text-indigo-700">{s.coBalance?.available ?? s.coDays} Days earned</span>
                    </div>
                    {s.deductedDays > 0 && (
                      <div className="flex justify-between pt-1 border-t border-gray-200/60 text-red-600 font-semibold">
                        <span>LOP / Deducted Days:</span>
                        <span>{s.deductedDays} day(s)</span>
                      </div>
                    )}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="space-y-1.5 mb-4 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gross Monthly Salary</span>
                      <span className="font-medium text-gray-900">₹{parseFloat(s.monthlySalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Daily Rate</span>
                      <span className="font-medium text-gray-700">₹{parseFloat(s.dailySalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })} / day</span>
                    </div>
                    {parseFloat(s.deductions) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-500">LOP Deductions ({s.deductedDays}d)</span>
                        <span className="font-bold text-red-600">-₹{parseFloat(s.deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 mt-auto">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Net Payable Salary</p>
                      <p className="text-lg font-extrabold text-blue-600">₹{parseFloat(s.finalPayableSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <button 
                      onClick={() => handlePrintPayslip(s)} 
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg"
                    >
                      View Payslip
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* High-End Corporate Printable Payslip */}
        {printRecord && (
          <div id="print-section" className="hidden print:block bg-white p-8 max-w-2xl mx-auto border border-gray-300 rounded-2xl shadow-sm text-gray-800">
            
            {/* Header with Logo */}
            <div className="flex items-center justify-between border-b-2 border-blue-900/80 pb-4 mb-5">
              <div className="flex items-center gap-3.5">
                <img src="/logo.png" alt="Company Logo" className="h-16 w-auto object-contain" />
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Four Dee Motion Picture</h2>
                  <p className="text-xs text-gray-500 font-medium">Office ERP & Employee Payroll System</p>
                  <p className="text-[10px] text-gray-400">teamsimran.in • Chennai, Tamil Nadu</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-blue-900 text-white text-[11px] font-bold px-3 py-1 rounded-md uppercase tracking-wider mb-1">
                  Salary Payslip
                </span>
                <p className="text-xs font-bold text-gray-800">Pay Period: {format(currentMonth, "MMMM yyyy")}</p>
                <p className="text-[10px] text-gray-400">Ref: FD-PAY-{format(currentMonth, "yyyyMM")}-{printRecord.userId.slice(0, 5).toUpperCase()}</p>
              </div>
            </div>

            {/* Employee Meta Details Card */}
            <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 mb-5 grid grid-cols-2 gap-y-2 text-xs">
              <div>
                <span className="text-gray-400 font-medium">Employee Name:</span>
                <p className="font-bold text-gray-900 text-sm">{printRecord.name}</p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Official / Personal Email:</span>
                <p className="font-semibold text-gray-800 truncate">{printRecord.personalEmail || printRecord.email || "-"}</p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Designation:</span>
                <p className="font-semibold text-gray-800">{printRecord.designation || "-"}</p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Phone / Contact:</span>
                <p className="font-semibold text-gray-800">{printRecord.phone || "-"}</p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Department / Role:</span>
                <p className="font-semibold text-gray-800 capitalize">{printRecord.role.replace("_", " ")}</p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Biometric ID & Payment Mode:</span>
                <p className="font-semibold text-gray-800">{printRecord.biometricId ? `#${printRecord.biometricId}` : "Standard"} • Direct Bank Transfer</p>
              </div>
            </div>

            {/* 4-Stat Metric Grid */}
            <div className="grid grid-cols-4 gap-2 text-center mb-5">
              <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40">
                <span className="text-[10px] font-semibold text-emerald-800 uppercase block">Total Paid Days</span>
                <span className="text-base font-extrabold text-emerald-700">{printRecord.paidDays} / {data?.totalDaysInMonth || 30}</span>
              </div>
              <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/40">
                <span className="text-[10px] font-semibold text-blue-800 uppercase block">Total Hours</span>
                <span className="text-base font-extrabold text-blue-700">{printRecord.totalWorkingHours} hrs</span>
              </div>
              <div className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/40">
                <span className="text-[10px] font-semibold text-purple-800 uppercase block">Overtime</span>
                <span className="text-base font-extrabold text-purple-700">{printRecord.totalOvertimeHours || "0.0"} hrs</span>
              </div>
              <div className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/60">
                <span className="text-[10px] font-semibold text-gray-700 uppercase block">Late Time</span>
                <span className="text-base font-extrabold text-gray-800">{printRecord.totalLateMinutes || 0} mins</span>
              </div>
            </div>

            {/* Leave & Quota Balances Detailed Breakdown */}
            <div className="border border-purple-200 bg-purple-50/25 rounded-xl p-3.5 mb-5 text-xs">
              <h4 className="font-bold text-purple-950 text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-700" />
                Leave Accruals & Balance Quotas
              </h4>
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-purple-100">
                <div>
                  <span className="text-gray-500 font-medium">Casual Leave (CL):</span>
                  <p className="font-bold text-purple-900 text-sm">
                    {printRecord.clBalance?.available ?? printRecord.clDays} Days Available
                    <span className="text-[10px] font-normal text-gray-500 block">
                      (Accrued: {printRecord.clBalance?.accrued ?? 0} | Used: {printRecord.clBalance?.used ?? 0})
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Comp Off (CO) Balance:</span>
                  <p className="font-bold text-indigo-900 text-sm">
                    {printRecord.coBalance?.available ?? printRecord.coDays} Days Available
                    <span className="text-[10px] font-normal text-gray-500 block">
                      (Earned from Holidays/Sundays: {printRecord.coBalance?.accrued ?? 0})
                    </span>
                  </p>
                </div>
              </div>

              {/* Leave Activity Details this Month */}
              <div className="mt-2.5 space-y-1 text-[11px]">
                {printRecord.clDates && printRecord.clDates.length > 0 && (
                  <p className="text-gray-700">
                    <b className="text-purple-900">CL Taken this month:</b> {printRecord.clDates.join(", ")}
                  </p>
                )}
                {printRecord.holidayDates && printRecord.holidayDates.length > 0 && (
                  <p className="text-gray-700">
                    <b className="text-amber-900">Official Paid Holidays:</b> {printRecord.holidayDates.join(", ")}
                  </p>
                )}
                {(printRecord.sundayWorkDates?.length || printRecord.holidayWorkDates?.length) ? (
                  <p className="text-gray-700">
                    <b className="text-indigo-900">Weekend / Holiday Work:</b> {[...(printRecord.sundayWorkDates || []), ...(printRecord.holidayWorkDates || [])].join(", ")}
                  </p>
                ) : null}
                {printRecord.lopDates && printRecord.lopDates.length > 0 && (
                  <p className="text-red-700">
                    <b className="text-red-900">Loss of Pay (LOP) / Unpaid Absences:</b> {printRecord.lopDates.join(", ")} ({printRecord.deductedDays} days total)
                  </p>
                )}
                {(!printRecord.clDates?.length && !printRecord.lopDates?.length) && (
                  <p className="text-emerald-700 font-medium">✨ Full attendance maintained with zero unapproved absences this pay period.</p>
                )}
              </div>
            </div>

            {/* Financial Calculations Table */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">Earnings & Deductions Summary</h4>
            <table className="w-full border border-gray-200 text-xs border-collapse mb-5">
              <thead>
                <tr className="bg-gray-100 font-bold border-b border-gray-200 text-gray-800">
                  <th className="p-2.5 text-left w-1/2 border-r border-gray-200">Earnings & Allowances</th>
                  <th className="p-2.5 text-left w-1/2">Deductions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-2.5 border-r border-gray-200 align-top space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Basic Monthly Gross Salary:</span>
                      <span className="font-semibold">₹{parseFloat(printRecord.monthlySalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[11px]">
                      <span>Daily Pay Rate ({data?.totalDaysInMonth || 30} days):</span>
                      <span>₹{parseFloat(printRecord.dailySalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })} / day</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Paid Days Calculated ({printRecord.paidDays}d):</span>
                      <span>₹{parseFloat(printRecord.earnedSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </td>
                  <td className="p-2.5 align-top space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Loss of Pay Deductions ({printRecord.deductedDays}d):</span>
                      <span className="font-bold text-red-600">-₹{parseFloat(printRecord.deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[11px]">
                      <span>Other Statutory Deductions:</span>
                      <span>₹0.00</span>
                    </div>
                  </td>
                </tr>
                <tr className="bg-gray-50/70 font-bold">
                  <td className="p-2.5 border-r border-gray-200 flex justify-between">
                    <span>Total Gross Earnings:</span>
                    <span>₹{parseFloat(printRecord.monthlySalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td className="p-2.5 flex justify-between text-red-700">
                    <span>Total Deductions:</span>
                    <span>-₹{parseFloat(printRecord.deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Net Salary Highlight Box */}
            <div className="bg-blue-900 text-white rounded-xl p-4 mb-8 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">Net Payable Salary</p>
                <p className="text-xs text-blue-100">Disbursed via Direct Bank Transfer</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black tracking-tight">₹{parseFloat(printRecord.finalPayableSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Signatures & Verification */}
            <div className="grid grid-cols-2 gap-10 pt-6 border-t border-gray-200 text-center text-xs">
              <div>
                <div className="h-10"></div>
                <div className="border-t border-gray-400 pt-1">
                  <p className="font-bold text-gray-900">Authorized Signatory</p>
                  <p className="text-[10px] text-gray-400">Four Dee Motion Picture Management</p>
                </div>
              </div>
              <div>
                <div className="h-10"></div>
                <div className="border-t border-gray-400 pt-1">
                  <p className="font-bold text-gray-900">Employee Acknowledgment</p>
                  <p className="text-[10px] text-gray-400">{printRecord.name}</p>
                </div>
              </div>
            </div>

            <div className="text-[9px] text-gray-400 text-center mt-6">
              <p>This is an official computer-generated payroll document issued under Four Dee Motion Picture ERP.</p>
              <p>© 2026 Four Dee Motion Picture. All rights reserved.</p>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
