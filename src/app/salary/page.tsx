"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { IndianRupee, Download, ChevronLeft, ChevronRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, addMonths, subMonths } from "date-fns";

interface SalaryRecord {
  userId: string; name: string; designation: string; role: string;
  monthlySalary: string; dailySalary: string; hourlySalary: string; perMinuteSalary: string;
  presentDays: number; absentDays: number; lateDays: number;
  totalWorkingHours: string; totalOvertimeMinutes: number;
  earnedSalary: string; deductions: string; finalPayableSalary: string;
}

export default function SalaryPage() {
  const [data, setData] = useState<{ salary: SalaryRecord[]; month: string; totalDaysInMonth: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState("");

  const monthStr = format(currentMonth, "yyyy-MM");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/salary?month=${monthStr}${selectedUser ? `&userId=${selectedUser}` : ""}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [monthStr, selectedUser]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    if (!data) return;
    const headers = ["Name", "Monthly Salary", "Present", "Absent", "Late", "Working Hrs", "Earned", "Deductions", "Final Payable"];
    const rows = data.salary.map((s) => [s.name, s.monthlySalary, s.presentDays, s.absentDays, s.lateDays, s.totalWorkingHours, s.earnedSalary, s.deductions, s.finalPayableSalary]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salary-${monthStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salary Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Automatic salary calculations based on attendance</p>
          </div>
          <button onClick={handleExport} className="btn-secondary"><Download className="w-4.5 h-4.5" /> Export CSV</button>
        </motion.div>

        <div className="card p-4 flex items-center justify-between">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <h2 className="text-lg font-semibold text-gray-900">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
        </div>

        {/* Salary Cards */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-white animate-pulse border border-gray-100" />)}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {data?.salary.map((s) => (
              <motion.div key={s.userId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-600">{s.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.designation || s.role}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Monthly Salary</span>
                    <span className="font-medium text-gray-900">₹{parseFloat(s.monthlySalary).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Daily Salary</span>
                    <span className="font-medium text-gray-700">₹{parseFloat(s.dailySalary).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Hourly Rate</span>
                    <span className="font-medium text-gray-700">₹{parseFloat(s.hourlySalary).toLocaleString()}</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Present Days</span>
                    <span className="font-medium text-emerald-600">{s.presentDays}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Absent Days</span>
                    <span className="font-medium text-red-600">{s.absentDays}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Late Days</span>
                    <span className="font-medium text-amber-600">{s.lateDays}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Working Hours</span>
                    <span className="font-medium text-gray-700">{s.totalWorkingHours}h</span>
                  </div>
                  {s.totalOvertimeMinutes > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Overtime</span>
                      <span className="font-medium text-blue-600">{s.totalOvertimeMinutes}m</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Earned</span>
                    <span className="font-medium text-gray-900">₹{parseFloat(s.earnedSalary).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Deductions</span>
                    <span className="font-medium text-red-600">₹{parseFloat(s.deductions).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100">
                    <span className="text-gray-900">Final Payable</span>
                    <span className="text-blue-600">₹{parseFloat(s.finalPayableSalary).toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
