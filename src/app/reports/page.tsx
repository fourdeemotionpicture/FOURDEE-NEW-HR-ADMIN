"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, Download, FileSpreadsheet, Clock, IndianRupee, 
  FileText, Receipt, Printer, User, ChevronDown, ChevronUp, Layers, List
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { format } from "date-fns";

type ReportType = "attendance" | "salary" | "work-reports" | "expenses";

const allReportTypes = [
  { id: "attendance" as ReportType, label: "Attendance Report", icon: Clock, color: "bg-blue-50 text-blue-600", description: "Employee attendance records with in/out times, hours, and status" },
  { id: "salary" as ReportType, label: "Salary Report", icon: IndianRupee, color: "bg-emerald-50 text-emerald-600", description: "Monthly salary calculations based on attendance data" },
  { id: "work-reports" as ReportType, label: "Work Reports", icon: FileText, color: "bg-violet-50 text-violet-600", description: "Daily work report submissions by all employees" },
  { id: "expenses" as ReportType, label: "Expense Report", icon: Receipt, color: "bg-orange-50 text-orange-600", description: "Office expenses and petty cash transactions" },
];

const STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  half_day: "bg-amber-50 text-amber-700 border-amber-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  WO: "bg-gray-100 text-gray-600 border-gray-200",
  CL: "bg-purple-50 text-purple-700 border-purple-200",
  SL: "bg-blue-50 text-blue-700 border-blue-200",
  CO: "bg-indigo-50 text-indigo-700 border-indigo-200",
  LOP: "bg-rose-50 text-rose-700 border-rose-200",
  H: "bg-amber-100 text-amber-800 border-amber-300",
};

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>("attendance");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null);
  
  // View mode: 'grouped' (Name-wise cards) vs 'flat' (Unified table)
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  // Collapsed states for grouped employee cards
  const [collapsedEmployees, setCollapsedEmployees] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.role) {
          setCurrentUser(d);
          if (d.role === "employee") {
            setSelectedUserId(d.id);
          }
        }
      })
      .catch(console.error);

    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []))
      .catch(console.error);
  }, []);

  const isEmployee = currentUser?.role === "employee";
  const visibleReportTypes = isEmployee
    ? allReportTypes.filter((r) => r.id !== "expenses")
    : allReportTypes;

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = "";
      const targetUserId = isEmployee ? currentUser?.id : selectedUserId;
      switch (selectedReport) {
        case "attendance":
          url = `/api/attendance?month=${selectedMonth}${targetUserId ? `&userId=${targetUserId}` : ""}`;
          break;
        case "salary":
          url = `/api/salary?month=${selectedMonth}${targetUserId ? `&userId=${targetUserId}` : ""}`;
          break;
        case "work-reports":
          url = `/api/work-reports?month=${selectedMonth}${targetUserId ? `&userId=${targetUserId}` : ""}`;
          break;
        case "expenses":
          url = `/api/expenses?month=${selectedMonth}`;
          break;
      }
      const res = await fetch(url);
      const result = await res.json();
      const key = selectedReport === "work-reports" ? "workReports" : selectedReport;
      setData(result[key] || result.salary || []);
      setCollapsedEmployees({});
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Group data by Employee Name
  const groupedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const map = new Map<string, any[]>();
    data.forEach((item) => {
      const name = item.userName || item.name || "Unknown Employee";
      if (!map.has(name)) {
        map.set(name, []);
      }
      map.get(name)!.push(item);
    });

    return Array.from(map.entries()).map(([employeeName, records]) => {
      // Sort chronologically by date if date field exists
      const sortedRecords = [...records].sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        return 0;
      });

      // Stats calculation for attendance
      const presentCount = sortedRecords.filter((r) => r.status === "present").length;
      const halfDayCount = sortedRecords.filter((r) => r.status === "half_day").length;
      const leavesCount = sortedRecords.filter((r) => ["CL", "SL", "CO", "H"].includes(r.status)).length;
      const lateDays = sortedRecords.filter((r) => (r.lateMinutes ?? 0) > 0).length;
      const totalHours = sortedRecords.reduce((acc, r) => acc + parseFloat(r.workingHours ?? "0"), 0);

      return {
        employeeName,
        userId: sortedRecords[0]?.userId || "",
        records: sortedRecords,
        stats: {
          present: presentCount,
          halfDay: halfDayCount,
          leaves: leavesCount,
          lateDays,
          totalHours,
        },
      };
    });
  }, [data]);

  const toggleEmployeeCollapse = (empName: string) => {
    setCollapsedEmployees((prev) => ({
      ...prev,
      [empName]: !prev[empName],
    }));
  };

  const toggleAllCollapse = (collapsed: boolean) => {
    const newState: Record<string, boolean> = {};
    groupedData.forEach((g) => {
      newState[g.employeeName] = collapsed;
    });
    setCollapsedEmployees(newState);
  };

  // Export Master CSV with Employee Name in 1st Column
  const exportCSV = () => {
    if (!data || data.length === 0) return;

    let csv = "";
    if (selectedReport === "attendance") {
      csv = `"Employee Name","Date","Status","In Time","Out Time","Working Hours","Late (Mins)","Overtime (Mins)","Source","Notes"\n`;
      groupedData.forEach((group) => {
        group.records.forEach((r) => {
          csv += `"${group.employeeName}","'${r.date}","${r.status}","${r.inTime || "-"}","${r.outTime || "-"}","${r.workingHours || "0"}","${r.lateMinutes || 0}","${r.overtimeMinutes || 0}","${r.source || "manual"}","${(r.notes || "").replace(/"/g, '""')}"\n`;
        });
      });
    } else if (selectedReport === "work-reports") {
      csv = `"Employee Name","Date","Description","Notes"\n`;
      groupedData.forEach((group) => {
        group.records.forEach((r) => {
          csv += `"${group.employeeName}","'${r.date}","${(r.description || "").replace(/"/g, '""')}","${(r.notes || "").replace(/"/g, '""')}"\n`;
        });
      });
    } else {
      // Generic fallback
      const headers = ["Employee Name", ...Object.keys(data[0]).filter((k) => k !== "id" && k !== "userId" && k !== "userName")];
      const rows = data.map((item) => {
        const empName = item.userName || item.name || "";
        return [
          `"${empName}"`,
          ...headers.slice(1).map((h) => {
            const val = item[h];
            if (h.toLowerCase().includes("date") && val) return `"'${val}"`;
            return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val;
          }),
        ];
      });
      csv = [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedReport}-report-name-wise-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Multi-Sheet Excel (Each Employee in a Separate Sheet!)
  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      if (!data || data.length === 0) return;

      const wb = XLSX.utils.book_new();

      if (selectedReport === "attendance") {
        // 1. Create Summary Sheet
        const summaryRows = groupedData.map((g) => ({
          "Employee Name": g.employeeName,
          "Total Records": g.records.length,
          "Present (Full Days)": g.stats.present,
          "Half Days": g.stats.halfDay,
          "Leaves (CL/SL/CO/H)": g.stats.leaves,
          "Late Days": g.stats.lateDays,
          "Total Working Hours": g.stats.totalHours.toFixed(1),
        }));
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary All");

        // 2. Create Individual Sheet for Each Employee
        groupedData.forEach((group) => {
          const empRows = group.records.map((r) => ({
            Date: `'${r.date}`,
            Status: (r.status || "").toUpperCase(),
            "In Time": r.inTime || "-",
            "Out Time": r.outTime || "-",
            "Working Hours": r.workingHours ? `${r.workingHours}h` : "-",
            "Late (Mins)": r.lateMinutes ?? 0,
            "Overtime (Mins)": r.overtimeMinutes ?? 0,
            Source: r.source || "manual",
            Notes: r.notes || "",
          }));

          const wsEmp = XLSX.utils.json_to_sheet(empRows);
          // Sheet names must be <= 31 chars and no invalid chars
          const cleanSheetName = group.employeeName.replace(/[:\\/?*\[\]]/g, "").slice(0, 30);
          XLSX.utils.book_append_sheet(wb, wsEmp, cleanSheetName);
        });

      } else if (selectedReport === "work-reports") {
        // Individual sheets per employee for work reports
        groupedData.forEach((group) => {
          const empRows = group.records.map((r) => ({
            Date: `'${r.date}`,
            Description: r.description,
            Notes: r.notes || "",
          }));
          const wsEmp = XLSX.utils.json_to_sheet(empRows);
          const cleanSheetName = group.employeeName.replace(/[:\\/?*\[\]]/g, "").slice(0, 30);
          XLSX.utils.book_append_sheet(wb, wsEmp, cleanSheetName);
        });
      } else {
        // Fallback single sheet
        const formattedItems = data.map((item) => {
          const cleaned: Record<string, unknown> = {};
          if (item.userName) cleaned["Employee Name"] = item.userName;
          for (const [key, val] of Object.entries(item)) {
            if (key === "id" || key === "userId" || key === "userName") continue;
            if (key.toLowerCase().includes("date") && val) {
              cleaned[key] = `'${val}`;
            } else {
              cleaned[key] = val;
            }
          }
          return cleaned;
        });
        const ws = XLSX.utils.json_to_sheet(formattedItems);
        XLSX.utils.book_append_sheet(wb, ws, "Report");
      }

      XLSX.writeFile(wb, `${selectedReport}-report-name-wise-${selectedMonth}.xlsx`);
    } catch (err) {
      console.error("Excel export error:", err);
    }
  };

  // Export Single Employee's Excel
  const exportSingleEmployeeExcel = async (group: (typeof groupedData)[0]) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const empRows = group.records.map((r) => ({
        Date: `'${r.date}`,
        Status: (r.status || "").toUpperCase(),
        "In Time": r.inTime || "-",
        "Out Time": r.outTime || "-",
        "Working Hours": r.workingHours ? `${r.workingHours}h` : "-",
        "Late (Mins)": r.lateMinutes ?? 0,
        "Overtime (Mins)": r.overtimeMinutes ?? 0,
        Source: r.source || "manual",
        Notes: r.notes || "",
      }));

      const ws = XLSX.utils.json_to_sheet(empRows);
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");
      XLSX.writeFile(wb, `${group.employeeName.replace(/\s+/g, "_")}_Attendance_${selectedMonth}.xlsx`);
    } catch (err) {
      console.error("Single export error:", err);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-gray-900">Name-Wise Reports & Downloads</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and download separated, employee-wise attendance, work reports, and analytics</p>
        </motion.div>

        {/* Report Type Selector Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleReportTypes.map((rt, i) => (
            <motion.button
              key={rt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                setSelectedReport(rt.id);
                setData([]);
              }}
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

        {/* Filter Controls */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Filter Criteria</h3>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Select Month</label>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
                className="input-field" 
              />
            </div>

            {!isEmployee && selectedReport !== "expenses" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Employee (Filter or All)</label>
                <select 
                  value={selectedUserId} 
                  onChange={(e) => setSelectedUserId(e.target.value)} 
                  className="input-field font-medium text-gray-800"
                >
                  <option value="">All Employees (Name-Wise Separated)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button onClick={fetchReport} disabled={loading} className="btn-primary">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BarChart3 className="w-4.5 h-4.5" />}
              Generate Name-Wise Report
            </button>
          </div>
        </div>

        {/* Report Content View */}
        {data && data.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div>
                <span className="text-sm font-bold text-gray-900">{groupedData.length} Employee(s)</span>
                <span className="text-xs text-gray-500 ml-2">({data.length} total logs for {selectedMonth})</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-gray-100 p-1 rounded-xl mr-2">
                  <button
                    onClick={() => setViewMode("grouped")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      viewMode === "grouped" ? "bg-white text-blue-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Name-Wise Cards
                  </button>
                  <button
                    onClick={() => setViewMode("flat")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      viewMode === "flat" ? "bg-white text-blue-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" /> Unified Table
                  </button>
                </div>

                {viewMode === "grouped" && (
                  <div className="flex items-center gap-1.5 mr-2">
                    <button onClick={() => toggleAllCollapse(false)} className="text-[11px] font-semibold text-blue-600 hover:underline px-1">Expand All</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => toggleAllCollapse(true)} className="text-[11px] font-semibold text-gray-500 hover:underline px-1">Collapse All</button>
                  </div>
                )}

                <button onClick={exportExcel} className="btn-secondary flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel (Multi-Sheet)
                </button>
                
                <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs">
                  <Download className="w-4 h-4 text-blue-600" /> Export CSV
                </button>

                <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-xs">
                  <Printer className="w-4 h-4 text-purple-600" /> Print / PDF
                </button>
              </div>
            </div>

            {/* View 1: Name-Wise Grouped Employee Cards */}
            {viewMode === "grouped" && (
              <div className="space-y-4">
                {groupedData.map((group) => {
                  const isCollapsed = !!collapsedEmployees[group.employeeName];

                  return (
                    <div key={group.employeeName} className="card overflow-hidden border border-gray-200/80 shadow-xs transition-all">
                      
                      {/* Employee Card Header */}
                      <div 
                        onClick={() => toggleEmployeeCollapse(group.employeeName)}
                        className="p-4 bg-gradient-to-r from-gray-50/80 via-white to-white flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-blue-50/20 border-b border-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {group.employeeName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900">{group.employeeName}</h3>
                              <span className="badge badge-info text-[11px]">{group.records.length} logs</span>
                            </div>
                            <p className="text-xs text-gray-400">Monthly Performance Record</p>
                          </div>
                        </div>

                        {/* KPI Badges */}
                        {selectedReport === "attendance" && (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                              <b>{group.stats.present}</b> Present
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                              <b>{group.stats.halfDay}</b> Half Day
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                              <b>{group.stats.leaves}</b> Leaves
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 font-medium">
                              <b>{group.stats.lateDays}</b> Late
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                              {group.stats.totalHours.toFixed(1)}h Worked
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => exportSingleEmployeeExcel(group)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-emerald-700"
                            title="Download Excel for this employee"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleEmployeeCollapse(group.employeeName)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          >
                            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Employee Detailed Table */}
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          {selectedReport === "attendance" ? (
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-500 uppercase font-semibold">
                                  <th className="px-4 py-2.5">Date</th>
                                  <th className="px-4 py-2.5">Status</th>
                                  <th className="px-4 py-2.5">In Time</th>
                                  <th className="px-4 py-2.5">Out Time</th>
                                  <th className="px-4 py-2.5">Working Hours</th>
                                  <th className="px-4 py-2.5">Late (Mins)</th>
                                  <th className="px-4 py-2.5">Overtime</th>
                                  <th className="px-4 py-2.5">Source</th>
                                  <th className="px-4 py-2.5">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.records.map((r, idx) => (
                                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/40">
                                    <td className="px-4 py-2 font-medium text-gray-900">{r.date}</td>
                                    <td className="px-4 py-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-700"}`}>
                                        {r.status.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-600">{r.inTime || "-"}</td>
                                    <td className="px-4 py-2 text-gray-600">{r.outTime || "-"}</td>
                                    <td className="px-4 py-2 font-medium text-gray-800">{r.workingHours ? `${r.workingHours}h` : "-"}</td>
                                    <td className="px-4 py-2 font-semibold text-red-600">{r.lateMinutes > 0 ? `${r.lateMinutes}m` : "0"}</td>
                                    <td className="px-4 py-2 text-gray-600">{r.overtimeMinutes > 0 ? `${r.overtimeMinutes}m` : "-"}</td>
                                    <td className="px-4 py-2 capitalize text-gray-500">{r.source || "manual"}</td>
                                    <td className="px-4 py-2 text-gray-500 max-w-[200px] truncate">{r.notes || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : selectedReport === "work-reports" ? (
                            <div className="p-4 space-y-2.5">
                              {group.records.map((w, idx) => (
                                <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                                  <span className="font-bold text-blue-700">📅 Date: {w.date}</span>
                                  <p className="text-gray-800 mt-1 whitespace-pre-wrap leading-relaxed">{w.description}</p>
                                  {w.notes && <p className="text-gray-500 italic mt-1">Note: {w.notes}</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  {Object.keys(group.records[0] || {}).filter((k) => k !== "id" && k !== "userId" && k !== "userName").map((key) => (
                                    <th key={key} className="px-4 py-2.5 font-semibold text-gray-500 uppercase">{key.replace(/([A-Z])/g, " $1").trim()}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {group.records.map((r, idx) => (
                                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                                    {Object.entries(r).filter(([k]) => k !== "id" && k !== "userId" && k !== "userName").map(([k, val], j) => (
                                      <td key={j} className="px-4 py-2 text-gray-700 whitespace-nowrap">{val === null ? "-" : String(val)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

            {/* View 2: Unified Flat Table with Employee Name as 1st Column */}
            {viewMode === "flat" && (
              <div className="card overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-600 font-semibold uppercase">
                      <th className="px-4 py-3 whitespace-nowrap">Employee Name</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">In Time</th>
                      <th className="px-4 py-3 whitespace-nowrap">Out Time</th>
                      <th className="px-4 py-3 whitespace-nowrap">Working Hours</th>
                      <th className="px-4 py-3 whitespace-nowrap">Late (Mins)</th>
                      <th className="px-4 py-3 whitespace-nowrap">Overtime</th>
                      <th className="px-4 py-3 whitespace-nowrap">Source</th>
                      <th className="px-4 py-3 whitespace-nowrap">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.flatMap((g) =>
                      g.records.map((r, idx) => (
                        <tr key={`${g.employeeName}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 font-bold text-gray-900 whitespace-nowrap">{g.employeeName}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">{r.date}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-700"}`}>
                              {(r.status || "").toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">{r.inTime || "-"}</td>
                          <td className="px-4 py-2.5 text-gray-600">{r.outTime || "-"}</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{r.workingHours ? `${r.workingHours}h` : "-"}</td>
                          <td className="px-4 py-2.5 font-semibold text-red-600">{r.lateMinutes > 0 ? `${r.lateMinutes}m` : "0"}</td>
                          <td className="px-4 py-2.5 text-gray-600">{r.overtimeMinutes > 0 ? `${r.overtimeMinutes}m` : "-"}</td>
                          <td className="px-4 py-2.5 capitalize text-gray-500">{r.source || "manual"}</td>
                          <td className="px-4 py-2.5 text-gray-500 max-w-[200px] truncate">{r.notes || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </motion.div>
        )}

        {data && data.length === 0 && !loading && (
          <div className="card p-12 text-center text-gray-400">
            Click &quot;Generate Name-Wise Report&quot; above to view individual employee reports.
          </div>
        )}

      </div>
    </AppShell>
  );
}
