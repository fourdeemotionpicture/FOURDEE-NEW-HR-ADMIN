"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Plus, Trash2, X, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parse } from "date-fns";

interface WorkReport {
  id: string; userId: string; date: string; description: string; notes: string | null; imageUrl: string | null; userName?: string; createdAt: string;
}

export default function WorkReportsPage() {
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), description: "", notes: "" });
  const [userRole, setUserRole] = useState("employee");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const monthStr = format(currentMonth, "yyyy-MM");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const userIdParam = selectedEmployeeId ? `&userId=${selectedEmployeeId}` : "";
    const res = await fetch(`/api/work-reports?month=${monthStr}${userIdParam}`);
    const data = await res.json();
    setReports(data.workReports || []);
    setLoading(false);
  }, [monthStr, selectedEmployeeId]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d.role) setUserRole(d.role); });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (userRole === "super_admin" || userRole === "owner_admin") {
      fetch("/api/employees")
        .then((r) => r.json())
        .then((d) => {
          const list = d.employees || [];
          setEmployees(list);
          if (list.length > 0 && !selectedEmployeeId) {
            setSelectedEmployeeId(list[0].id);
          }
        });
    }
  }, [userRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/work-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setForm({ date: format(new Date(), "yyyy-MM-dd"), description: "", notes: "" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    await fetch(`/api/work-reports?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  // Group reports by date
  const groupedByDate = reports.reduce<Record<string, WorkReport[]>>((acc, r) => {
    if (!acc[r.date]) acc[r.date] = [];
    acc[r.date].push(r);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const handleExport = () => {
    const headers = ["Date", "Employee", "Description", "Notes"];
    const rows = reports.map((r) => [`'${r.date}`, r.userName || "", r.description, r.notes || ""]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `work-reports-${monthStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isManager = userRole === "super_admin" || userRole === "owner_admin";

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Daily work report submissions</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="btn-secondary"><FileText className="w-4.5 h-4.5" /> Export</button>
            <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4.5 h-4.5" /> Add Report</button>
          </div>
        </motion.div>

        {isManager ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            <div className="card p-4 space-y-3 md:col-span-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">Employees</h3>
              <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto max-h-[120px] md:max-h-[500px] pb-2 md:pb-0 pr-1">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className={`w-auto md:w-full shrink-0 text-left p-2.5 md:p-3 rounded-xl border transition-all flex items-center gap-2 md:gap-3 ${
                      selectedEmployeeId === emp.id
                        ? "border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm"
                        : "border-gray-100 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-xs shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="truncate text-left">
                      <p className="text-xs md:text-sm font-semibold truncate">{emp.name}</p>
                      <p className="hidden md:block text-xs text-gray-500 truncate">{emp.designation || "Employee"}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="kpi-card"><p className="text-xs text-gray-500">Total Reports</p><p className="text-xl font-bold text-blue-600">{reports.length}</p></div>
                <div className="kpi-card"><p className="text-xs text-gray-500">Days Reported</p><p className="text-xl font-bold text-emerald-600">{sortedDates.length}</p></div>
                <div className="kpi-card col-span-2 sm:col-span-1"><p className="text-xs text-gray-500">This Month</p><p className="text-xl font-bold text-gray-900">{format(currentMonth, "MMM yyyy")}</p></div>
              </div>

              <div className="card p-4 flex items-center justify-between">
                <input type="month" value={monthStr} onChange={(e) => { const d = parse(e.target.value, "yyyy-MM", new Date()); setCurrentMonth(d); }} className="input-field w-auto" />
              </div>

              {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
              ) : sortedDates.length === 0 ? (
                <div className="card p-12 text-center text-gray-400">No work reports for this month</div>
              ) : (
                <div className="space-y-2">
                  {sortedDates.map((date) => (
                    <motion.div key={date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card overflow-hidden">
                      <button onClick={() => setExpandedDate(expandedDate === date ? null : date)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4.5 h-4.5 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900">{date}</span>
                          <span className="badge badge-info">{groupedByDate[date].length} entries</span>
                        </div>
                        {expandedDate === date ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </button>
                      {expandedDate === date && (
                        <div className="border-t border-gray-100">
                          {groupedByDate[date].map((report) => (
                            <div key={report.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm text-gray-900">{report.description}</p>
                                {report.notes && <p className="text-xs text-gray-500 mt-0.5">{report.notes}</p>}
                                {report.userName && (userRole === "super_admin" || userRole === "owner_admin") && <p className="text-xs text-blue-600 mt-0.5">By: {report.userName}</p>}
                                {report.imageUrl && <a href={report.imageUrl} target="_blank" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">View Image</a>}
                              </div>
                              <button onClick={() => handleDelete(report.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors ml-2">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="kpi-card"><p className="text-xs text-gray-500">Total Reports</p><p className="text-xl font-bold text-blue-600">{reports.length}</p></div>
              <div className="kpi-card"><p className="text-xs text-gray-500">Days Reported</p><p className="text-xl font-bold text-emerald-600">{sortedDates.length}</p></div>
              <div className="kpi-card"><p className="text-xs text-gray-500">This Month</p><p className="text-xl font-bold text-gray-900">{format(currentMonth, "MMM yyyy")}</p></div>
            </div>

            <div className="card p-4 flex items-center justify-between">
              <input type="month" value={monthStr} onChange={(e) => { const d = parse(e.target.value, "yyyy-MM", new Date()); setCurrentMonth(d); }} className="input-field w-auto" />
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : sortedDates.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">No work reports for this month</div>
            ) : (
              <div className="space-y-2">
                {sortedDates.map((date) => (
                  <motion.div key={date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card overflow-hidden">
                    <button onClick={() => setExpandedDate(expandedDate === date ? null : date)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4.5 h-4.5 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-900">{date}</span>
                        <span className="badge badge-info">{groupedByDate[date].length} entries</span>
                      </div>
                      {expandedDate === date ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </button>
                    {expandedDate === date && (
                      <div className="border-t border-gray-100">
                        {groupedByDate[date].map((report) => (
                          <div key={report.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">{report.description}</p>
                              {report.notes && <p className="text-xs text-gray-500 mt-0.5">{report.notes}</p>}
                              {report.userName && (userRole === "super_admin" || userRole === "owner_admin") && <p className="text-xs text-blue-600 mt-0.5">By: {report.userName}</p>}
                              {report.imageUrl && <a href={report.imageUrl} target="_blank" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">View Image</a>}
                            </div>
                            {userRole !== "owner_admin" && (
                              <button onClick={() => handleDelete(report.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors ml-2">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Add Work Report</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4.5 h-4.5 text-gray-500" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field min-h-[100px] resize-y" placeholder="Describe the work done today..." required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" placeholder="Additional notes..." />
                </div>
                <p className="text-xs text-gray-400">Image upload coming soon with Supabase Storage integration</p>
                <button type="submit" className="btn-primary w-full justify-center">Submit Report</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
