"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { IndianRupee, Download, ChevronLeft, ChevronRight, Mail, Printer } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, addMonths, subMonths } from "date-fns";

interface SalaryRecord {
  userId: string;
  name: string;
  designation: string;
  role: string;
  email: string | null;
  monthlySalary: string;
  dailySalary: string;
  hourlySalary: string;
  perMinuteSalary: string;
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
  totalWorkingHours: string;
  totalOvertimeMinutes: number;
  earnedSalary: string;
  deductions: string;
  finalPayableSalary: string;
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
    const headers = ["Name", "Monthly Salary", "Paid Days", "Deducted Days", "Working Hrs", "Earned", "Deductions", "Final Payable"];
    const rows = data.salary.map((s) => [
      s.name, 
      s.monthlySalary, 
      s.paidDays, 
      s.deductedDays, 
      s.totalWorkingHours, 
      s.earnedSalary, 
      s.deductions, 
      s.finalPayableSalary
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salary-${monthStr}.csv`;
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
    }, 150);
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
              background: white !important;
              color: black !important;
              border: none !important;
              padding: 0 !important;
            }
          }
        `}} />

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salary Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Automated payslips & leave calculations</p>
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
              <Download className="w-4.5 h-4.5" /> Export CSV
            </button>
          </div>
        </motion.div>

        {/* Month selector */}
        <div className="card p-4 flex items-center justify-between print:hidden">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <h2 className="text-lg font-semibold text-gray-900">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
        </div>

        {/* Salary Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
            {[...Array(3)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-white animate-pulse border border-gray-100" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:hidden">
            {data?.salary.map((s) => (
              <motion.div key={s.userId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">{s.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.designation || s.role}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handlePrintPayslip(s)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" 
                      title="Download PDF Payslip"
                    >
                      <Printer className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  {/* Quotas & Attendance Details */}
                  <div className="space-y-1.5 text-xs border-b border-gray-100 pb-3 mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paid Days:</span>
                      <span className="font-semibold text-emerald-600">{s.paidDays} day(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 pl-3">Present (Full / Half):</span>
                      <span className="font-medium text-gray-600">{s.presentDays} / {s.halfDays}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 pl-3">Week Off (WO):</span>
                      <span className="font-medium text-gray-600">{s.woDays}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 pl-3">Approved Leaves (CL / SL / CO / H):</span>
                      <span className="font-medium text-purple-600">{s.clDays} / {s.slDays} / {s.coDays} / {s.holidayDays}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-50">
                      <span className="text-gray-500">Deducted Days (LOP / Absent):</span>
                      <span className="font-semibold text-red-600">{s.deductedDays} day(s)</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gross Monthly Salary</span>
                      <span className="font-medium text-gray-900">₹{parseFloat(s.monthlySalary).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Daily Salary Rate</span>
                      <span className="font-medium text-gray-700">₹{parseFloat(s.dailySalary).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Deductions (LOP & Absences)</span>
                      <span className="font-semibold text-red-600">-₹{parseFloat(s.deductions).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 mt-auto">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Net Payable</p>
                      <p className="text-lg font-bold text-blue-600">₹{parseFloat(s.finalPayableSalary).toLocaleString()}</p>
                    </div>
                    <span className="badge badge-neutral text-xs">{s.totalWorkingHours} hrs worked</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Hidden Print Section: Beautiful Invoice-Style Payslip */}
        {printRecord && (
          <div id="print-section" className="hidden print:block bg-white p-8 max-w-xl mx-auto border border-gray-300 rounded-2xl shadow-sm">
            <div className="text-center mb-6">
              <img src="/logo.png" alt="Company Logo" className="h-16 mx-auto mb-2" />
              <h2 className="text-xl font-bold text-gray-900">Four Dee Motion Picture</h2>
              <p className="text-xs text-gray-500 font-semibold tracking-wider uppercase mt-1">Monthly Salary Payslip</p>
              <p className="text-xs text-gray-400 mt-0.5">Pay Period: {format(currentMonth, "MMMM yyyy")}</p>
            </div>
            
            <hr className="border-gray-200 my-4"/>
            
            <table className="w-full text-sm text-gray-700 mb-6">
              <tbody>
                <tr>
                  <td className="py-1 font-bold w-1/3">Employee Name:</td>
                  <td className="py-1">{printRecord.name}</td>
                </tr>
                <tr>
                  <td className="py-1 font-bold">Designation:</td>
                  <td className="py-1">{printRecord.designation || "-"}</td>
                </tr>
                <tr>
                  <td className="py-1 font-bold">Role:</td>
                  <td className="py-1 capitalize">{printRecord.role.replace("_", " ")}</td>
                </tr>
                <tr>
                  <td className="py-1 font-bold">Payment Mode:</td>
                  <td className="py-1">Bank Transfer</td>
                </tr>
              </tbody>
            </table>

            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Attendance Summary</h4>
            <table className="w-full border border-gray-200 text-xs text-center border-collapse mb-6">
              <thead>
                <tr className="bg-gray-50 font-bold border-b border-gray-200">
                  <th className="p-2 border-r border-gray-200">Present</th>
                  <th className="p-2 border-r border-gray-200">Week Off (WO)</th>
                  <th className="p-2 border-r border-gray-200">Paid Leaves</th>
                  <th className="p-2 border-r border-gray-200">LOP / Unpaid</th>
                  <th className="p-2">Total Paid Days</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border-r border-gray-200">{printRecord.presentDays + printRecord.halfDays * 0.5} day(s)</td>
                  <td className="p-2 border-r border-gray-200">{printRecord.woDays} day(s)</td>
                  <td className="p-2 border-r border-gray-200">{printRecord.clDays + printRecord.slDays + printRecord.coDays + printRecord.holidayDays} day(s)</td>
                  <td className="p-2 border-r border-gray-200">{printRecord.lopDays + printRecord.absentDays + printRecord.halfDays * 0.5} day(s)</td>
                  <td className="p-2 font-bold text-emerald-600">{printRecord.paidDays} day(s)</td>
                </tr>
              </tbody>
            </table>

            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Salary Calculations</h4>
            <table className="w-full text-sm text-gray-700 mb-8 border-t border-b border-gray-100">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2.5">Gross Monthly Salary:</td>
                  <td className="py-2.5 text-right font-medium">₹{parseFloat(printRecord.monthlySalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 text-red-600 font-semibold">Deductions (LOP & Absences):</td>
                  <td className="py-2.5 text-right text-red-600 font-bold">-₹{parseFloat(printRecord.deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr className="bg-blue-50/50 font-bold text-base">
                  <td className="p-3 text-blue-900">Net Payable Salary:</td>
                  <td className="p-3 text-right text-blue-900 text-lg">₹{parseFloat(printRecord.finalPayableSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <div className="text-[10px] text-gray-400 text-center mt-12">
              <p>This is a computer-generated payslip and does not require a physical signature.</p>
              <p>© Four Dee Motion Picture ERP portal</p>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
