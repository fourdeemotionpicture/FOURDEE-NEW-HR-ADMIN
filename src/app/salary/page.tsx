"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { IndianRupee, Download, ChevronLeft, ChevronRight, Mail, Printer, Clock, Calendar, ShieldCheck, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
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
  accountNumber?: string | null;
  ifscCode?: string | null;
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
      "Name", "Designation", "Role", "Biometric ID", "Phone", "Bank A/C No", "IFSC Code", "Monthly Salary", 
      "Paid Days", "Deducted Days", "Working Hrs", "Overtime (Hrs)", 
      "Available CL", "Available CO", "CL Dates Taken", "LOP Dates", 
      "Earned Salary", "Deductions", "Final Net Payable"
    ];
    const rows = data.salary.map((s) => [
      `"${s.name}"`, 
      `"${s.designation || "-"}"`,
      `"${s.role}"`,
      `"${s.biometricId || "-"}"`,
      `"${s.phone || "-"}"`,
      `"${s.accountNumber || "-"}"`,
      `"${s.ifscCode || "-"}"`,
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
    }, 180);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        
        {/* Style Tag for Page Printing - Strictly 1 Single Page */}
        <style dangerouslySetInnerHTML={{ __html: `
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          @media print {
            html, body {
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body * {
              visibility: hidden;
            }
            #print-section, #print-section * {
              visibility: visible;
            }
            #print-section {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 10px 14px !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}} />

        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salary Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Automated payroll, bank transfers & 1-page executive payslips</p>
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
                      title="Download / Print 1-Page Payslip"
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
                      <span>Casual Leave (CL):</span>
                      <span className="font-semibold text-purple-700">{s.clBalance?.available ?? s.clDays} Days left</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Comp Off (CO):</span>
                      <span className="font-semibold text-indigo-700">{s.coBalance?.available ?? s.coDays} Days earned</span>
                    </div>
                    {s.accountNumber && (
                      <div className="flex justify-between text-[11px] text-blue-700 pt-1 border-t border-gray-200/60 font-mono">
                        <span>Bank A/c:</span>
                        <span>{s.accountNumber} ({s.ifscCode})</span>
                      </div>
                    )}
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
                      Print Payslip
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* High-End Corporate Printable Payslip - Guaranteed STRICT 1-PAGE A4 */}
        {printRecord && (
          <div id="print-section" className="hidden print:block bg-white max-w-2xl mx-auto text-gray-800 font-sans">
            
            {/* Header with Logo */}
            <div className="flex items-center justify-between border-b-2 border-blue-900/80 pb-2 mb-2.5">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="Company Logo" className="h-12 w-auto object-contain" />
                <div>
                  <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none">Four Dee Motion Pictures Private Limited</h2>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">Office ERP & Employee Payroll System</p>
                  <p className="text-[9px] text-gray-400 leading-none">teamsimran.in • Chennai, Tamil Nadu</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-blue-900 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-0.5">
                  Salary Payslip
                </span>
                <p className="text-[11px] font-bold text-gray-800 leading-tight">Pay Period: {format(currentMonth, "MMMM yyyy")}</p>
                <p className="text-[8px] text-gray-400 font-mono">Ref: FD-PAY-{format(currentMonth, "yyyyMM")}-{printRecord.userId.slice(0, 5).toUpperCase()}</p>
              </div>
            </div>

            {/* Employee Meta & Bank Transfer Details Card */}
            <div className="bg-gray-50/80 border border-gray-200 rounded-lg p-2.5 mb-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <div>
                <span className="text-gray-400 font-medium text-[10px]">Employee Name:</span>
                <p className="font-bold text-gray-900 text-xs">{printRecord.name}</p>
              </div>
              <div>
                <span className="text-gray-400 font-medium text-[10px]">Designation & Department:</span>
                <p className="font-semibold text-gray-800">{printRecord.designation || "-"} <span className="text-gray-400 font-normal">({printRecord.role.replace("_", " ")})</span></p>
              </div>
              <div>
                <span className="text-gray-400 font-medium text-[10px]">Official / Personal Email:</span>
                <p className="font-semibold text-gray-800 truncate">{printRecord.personalEmail || printRecord.email || "-"}</p>
              </div>
              <div>
                <span className="text-gray-400 font-medium text-[10px]">Phone & Biometric ID:</span>
                <p className="font-semibold text-gray-800">{printRecord.phone || "-"} • Bio ID: {printRecord.biometricId ? `#${printRecord.biometricId}` : "Standard"}</p>
              </div>
              <div className="col-span-2 pt-1 border-t border-gray-200/60 flex items-center justify-between">
                <div>
                  <span className="text-gray-400 font-medium text-[10px]">Disbursement Mode:</span>
                  <p className="font-bold text-gray-800">Direct Bank Transfer</p>
                </div>
                {printRecord.accountNumber && (
                  <div className="text-right">
                    <span className="text-gray-400 font-medium text-[10px]">Bank Transfer Details:</span>
                    <p className="font-mono font-bold text-blue-900 text-[11px]">
                      A/C: <span className="text-blue-700">{printRecord.accountNumber}</span> • IFSC: <span className="text-blue-700">{printRecord.ifscCode || "-"}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 4-Stat Metric Grid */}
            <div className="grid grid-cols-4 gap-1.5 text-center mb-2.5">
              <div className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <span className="text-[9px] font-semibold text-emerald-800 uppercase block">Total Paid Days</span>
                <span className="text-sm font-extrabold text-emerald-700">{printRecord.paidDays} / {data?.totalDaysInMonth || 30}</span>
              </div>
              <div className="p-1.5 rounded-lg border border-blue-200 bg-blue-50/40">
                <span className="text-[9px] font-semibold text-blue-800 uppercase block">Working Hours</span>
                <span className="text-sm font-extrabold text-blue-700">{printRecord.totalWorkingHours} hrs</span>
              </div>
              <div className="p-1.5 rounded-lg border border-purple-200 bg-purple-50/40">
                <span className="text-[9px] font-semibold text-purple-800 uppercase block">Overtime</span>
                <span className="text-sm font-extrabold text-purple-700">{printRecord.totalOvertimeHours || "0.0"} hrs</span>
              </div>
              <div className="p-1.5 rounded-lg border border-gray-200 bg-gray-50/60">
                <span className="text-[9px] font-semibold text-gray-700 uppercase block">Late Time</span>
                <span className="text-sm font-extrabold text-gray-800">{printRecord.totalLateMinutes || 0} mins</span>
              </div>
            </div>

            {/* Leave & Quota Balances Detailed Breakdown */}
            <div className="border border-purple-200 bg-purple-50/20 rounded-lg p-2.5 mb-2.5 text-[10px]">
              <div className="grid grid-cols-2 gap-2 pb-1.5 border-b border-purple-100 font-medium">
                <div>
                  <span className="text-gray-500">Casual Leave (CL): </span>
                  <b className="text-purple-900 text-[11px]">{printRecord.clBalance?.available ?? printRecord.clDays} Days Left</b>
                  <span className="text-gray-400 text-[9px] ml-1">(Accrued: {printRecord.clBalance?.accrued ?? 0} | Used: {printRecord.clBalance?.used ?? 0})</span>
                </div>
                <div>
                  <span className="text-gray-500">Comp Off (CO): </span>
                  <b className="text-indigo-900 text-[11px]">{printRecord.coBalance?.available ?? printRecord.coDays} Days Available</b>
                  <span className="text-gray-400 text-[9px] ml-1">(Holidays/Sundays: {printRecord.coBalance?.accrued ?? 0})</span>
                </div>
              </div>

              {/* Compact Leave Activity Details */}
              <div className="mt-1.5 space-y-0.5 text-[10px]">
                {printRecord.clDates && printRecord.clDates.length > 0 && (
                  <p className="text-gray-700">
                    <b className="text-purple-900">CL Taken:</b> {printRecord.clDates.join(", ")}
                  </p>
                )}
                {printRecord.holidayDates && printRecord.holidayDates.length > 0 && (
                  <p className="text-gray-700">
                    <b className="text-amber-900">Public Holidays:</b> {printRecord.holidayDates.join(", ")}
                  </p>
                )}
                {(printRecord.sundayWorkDates?.length || printRecord.holidayWorkDates?.length) ? (
                  <p className="text-gray-700">
                    <b className="text-indigo-900">Holiday/Sunday Work (+1 CO):</b> {[...(printRecord.sundayWorkDates || []), ...(printRecord.holidayWorkDates || [])].join(", ")}
                  </p>
                ) : null}
                {printRecord.lopDates && printRecord.lopDates.length > 0 && (
                  <p className="text-red-700">
                    <b className="text-red-900">Loss of Pay (LOP) / Unpaid:</b> {printRecord.deductedDays} day(s) 
                    <span className="text-gray-500 text-[9px] ml-1">
                      ({printRecord.lopDates.slice(0, 6).join(", ")}{printRecord.lopDates.length > 6 ? ` +${printRecord.lopDates.length - 6} more` : ""})
                    </span>
                  </p>
                )}
                {(!printRecord.clDates?.length && !printRecord.lopDates?.length) && (
                  <p className="text-emerald-700 font-medium">✨ Full attendance maintained with zero deductions this pay period.</p>
                )}
              </div>
            </div>

            {/* Financial Calculations Table */}
            <table className="w-full border border-gray-200 text-[11px] border-collapse mb-2.5">
              <thead>
                <tr className="bg-gray-100 font-bold border-b border-gray-200 text-gray-800">
                  <th className="p-2 text-left w-1/2 border-r border-gray-200">Earnings & Allowances</th>
                  <th className="p-2 text-left w-1/2">Deductions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-2 border-r border-gray-200 align-top space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Basic Monthly Gross Salary:</span>
                      <span className="font-semibold">₹{parseFloat(printRecord.monthlySalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[10px]">
                      <span>Daily Pay Rate ({data?.totalDaysInMonth || 30} days):</span>
                      <span>₹{parseFloat(printRecord.dailySalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })} / day</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-medium text-[10px]">
                      <span>Paid Days Earned ({printRecord.paidDays}d):</span>
                      <span>₹{parseFloat(printRecord.earnedSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </td>
                  <td className="p-2 align-top space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Loss of Pay Deductions ({printRecord.deductedDays}d):</span>
                      <span className="font-bold text-red-600">-₹{parseFloat(printRecord.deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[10px]">
                      <span>Other Statutory Deductions:</span>
                      <span>₹0.00</span>
                    </div>
                  </td>
                </tr>
                <tr className="bg-gray-50 font-bold">
                  <td className="p-1.5 px-2 border-r border-gray-200 flex justify-between">
                    <span>Total Gross:</span>
                    <span>₹{parseFloat(printRecord.monthlySalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td className="p-1.5 px-2 flex justify-between text-red-700">
                    <span>Total Deductions:</span>
                    <span>-₹{parseFloat(printRecord.deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Net Salary Highlight Box */}
            <div className="bg-blue-900 text-white rounded-lg p-2.5 px-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-blue-200 font-semibold">Net Payable Salary</p>
                <p className="text-[10px] text-blue-100">Disbursed via Direct Bank Transfer</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black tracking-tight">₹{parseFloat(printRecord.finalPayableSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Signatures & Verification */}
            <div className="grid grid-cols-2 gap-8 pt-3 border-t border-gray-200 text-center text-[10px]">
              <div>
                <div className="h-6"></div>
                <div className="border-t border-gray-400 pt-0.5">
                  <p className="font-bold text-gray-900">Authorized Signatory</p>
                  <p className="text-[9px] text-gray-400">Four Dee Motion Pictures Private Limited Management</p>
                </div>
              </div>
              <div>
                <div className="h-6"></div>
                <div className="border-t border-gray-400 pt-0.5">
                  <p className="font-bold text-gray-900">Employee Acknowledgment</p>
                  <p className="text-[9px] text-gray-400">{printRecord.name}</p>
                </div>
              </div>
            </div>

            <div className="text-[8px] text-gray-400 text-center mt-3">
              <p>This is an official computer-generated payroll voucher issued under Four Dee Motion Pictures Private Limited ERP • teamsimran.in</p>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
