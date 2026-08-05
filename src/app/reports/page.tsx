"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, FileSpreadsheet, Clock, IndianRupee, FileText, Receipt } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format } from "date-fns";

type ReportType = "attendance" | "salary" | "work-reports" | "expenses";

const reportTypes = [
  { id: "attendance" as ReportType, label: "Attendance Report", icon: Clock, color: "bg-blue-50 text-blue-600", description: "Employee attendance records with in/out times, hours, and status" },
  { id: "salary" as ReportType, label: "Salary Report", icon: IndianRupee, color: "bg-emerald-50 text-emerald-600", description: "Monthly salary calculations based on attendance data" },
  { id: "work-reports" as ReportType, label: "Work Reports", icon: FileText, color: "bg-violet-50 text-violet-600", description: "Daily work report submissions by all employees" },
  { id: "expenses" as ReportType, label: "Expense Report", icon: Receipt, color: "bg-orange-50 text-orange-600", description: "Office expenses and petty cash transactions" },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>("attendance");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/employees").then((r) => r.json()).then((d) => setEmployees(d.employees || []));
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = "";
      switch (selectedReport) {
        case "attendance":
          url = `/api/attendance?month=${selectedMonth}${selectedUserId ? `&userId=${selectedUserId}` : ""}`;
          break;
        case "salary":
          url = `/api/salary?month=${selectedMonth}${selectedUserId ? `&userId=${selectedUserId}` : ""}`;
          break;
        case "work-reports":
          url = `/api/work-reports?month=${selectedMonth}${selectedUserId ? `&userId=${selectedUserId}` : ""}`;
          break;
        case "expenses":
          url = `/api/expenses?month=${selectedMonth}`;
          break;
      }
      const res = await fetch(url);
      const result = await res.json();
      const key = selectedReport === "work-reports" ? "workReports" : selectedReport;
      setData(result[key] || result.salary || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const exportCSV = () => {
    if (!data || (Array.isArray(data) && data.length === 0)) return;

    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) return;

    const headers = Object.keys(items[0] as object).filter((k) => k !== "id" && k !== "userId");
    const rows = items.map((item) =>
      headers.map((h) => {
        const val = (item as Record<string, unknown>)[h];
        return typeof val === "string" ? `"${val}"` : val;
      })
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedReport}-report-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const items = Array.isArray(data) ? data : [data];
      if (items.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(items);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${selectedReport}-report-${selectedMonth}.xlsx`);
    } catch (err) {
      console.error("Excel export error:", err);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and export comprehensive reports</p>
        </motion.div>

        {/* Report Type Selection */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {reportTypes.map((rt, i) => (
            <motion.button
              key={rt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedReport(rt.id)}
              className={`card p-4 text-left card-hover ${selectedReport === rt.id ? "ring-2 ring-blue-500 border-blue-300" : ""}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rt.color} mb-3`}>
                <rt.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{rt.label}</h3>
              <p className="text-xs text-gray-500 line-clamp-2">{rt.description}</p>
            </motion.button>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Filters</h3>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="input-field" />
            </div>
            {selectedReport !== "expenses" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="input-field">
                  <option value="">All Employees</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={fetchReport} disabled={loading} className="btn-primary">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BarChart3 className="w-4.5 h-4.5" />}
              Generate Report
            </button>
          </div>
        </div>

        {/* Results */}
        {data && Array.isArray(data) && data.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{data.length} records found</p>
              <div className="flex gap-2">
                <button onClick={exportCSV} className="btn-secondary"><Download className="w-4 h-4" /> CSV</button>
                <button onClick={exportExcel} className="btn-secondary"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
              </div>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {Object.keys(data[0] as object).filter((k) => k !== "id" && k !== "userId").slice(0, 8).map((key) => (
                      <th key={key} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 whitespace-nowrap">{key.replace(/([A-Z])/g, " $1").trim()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      {Object.entries(row as object).filter(([k]) => k !== "id" && k !== "userId").slice(0, 8).map(([key, val], j) => (
                        <td key={j} className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                          {val === null ? "-" : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {data && Array.isArray(data) && data.length === 0 && !loading && (
          <div className="card p-12 text-center text-gray-400">No data found for the selected filters</div>
        )}
      </div>
    </AppShell>
  );
}
