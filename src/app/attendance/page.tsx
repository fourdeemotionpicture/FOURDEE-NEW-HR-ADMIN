"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Calendar, ChevronLeft, ChevronRight, X, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, parse } from "date-fns";

interface AttendanceRecord {
  id: string; userId: string; date: string; inTime: string | null; outTime: string | null;
  status: string; source: string; lateMinutes: number | null; workingHours: string | null; overtimeMinutes: number | null; userName?: string; notes?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700",
  absent: "bg-red-100 text-red-700",
  half_day: "bg-amber-100 text-amber-700",
  holiday: "bg-blue-100 text-blue-700",
};

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [userRole, setUserRole] = useState("employee");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ userId: "", date: "", inTime: "", outTime: "", notes: "" });

  const monthStr = format(currentMonth, "yyyy-MM");
  const isManager = userRole === "super_admin" || userRole === "owner_admin";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const targetUserId = selectedEmployeeId || "";
    const res = await fetch(`/api/attendance?month=${monthStr}&userId=${targetUserId}`);
    const data = await res.json();
    setRecords(data.attendance || []);
    setLoading(false);
  }, [monthStr, selectedEmployeeId]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.role) {
          setUserRole(d.role);
          setCurrentUser(d);
          setSelectedEmployeeId(d.id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isManager) {
      fetch("/api/employees")
        .then((r) => r.json())
        .then((d) => setEmployees(d.employees || []))
        .catch(console.error);
    }
  }, [isManager]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = { date: form.date, inTime: form.inTime, outTime: form.outTime, source: "manual" };
    if (form.notes) body.notes = form.notes;
    
    // Use target employee from selected list or dropdown
    const targetId = form.userId || selectedEmployeeId || currentUser?.id;
    if (targetId) body.userId = targetId;

    try {
      const res = await fetch("/api/attendance", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(body) 
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to save attendance");
        return;
      }
      setShowModal(false);
      setForm({ userId: "", date: "", inTime: "", outTime: "", notes: "" });
      fetchData();
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    if (!isManager && dateStr !== today) {
      return; // Employees and office admins can only clock in/out for today
    }
    
    const record = getRecordForDate(dateStr);
    setForm({
      userId: selectedEmployeeId || currentUser?.id || "",
      date: dateStr,
      inTime: record?.inTime || "10:00",
      outTime: record?.outTime || "18:00",
      notes: record?.notes || "",
    });
    setShowModal(true);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const today = format(new Date(), "yyyy-MM-dd");

  const getRecordForDate = (dateStr: string) => records.find((r) => r.date === dateStr);

  // Stats
  const presentCount = records.filter((r) => r.status === "present").length;
  const halfDayCount = records.filter((r) => r.status === "half_day").length;
  const lateCount = records.filter((r) => (r.lateMinutes ?? 0) > 0).length;
  const totalHours = records.reduce((acc, r) => acc + parseFloat(r.workingHours ?? "0"), 0);

  const filteredEmployees = employees.filter((emp) => 
    emp.name.toLowerCase().includes(search.toLowerCase()) && emp.id !== currentUser?.id
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track and manage attendance records</p>
          </div>
          {userRole !== "owner_admin" && (
            <button 
              onClick={() => { 
                setShowModal(true); 
                setForm({ 
                  userId: selectedEmployeeId || currentUser?.id || "", 
                  date: today, 
                  inTime: "10:00", 
                  outTime: "18:00", 
                  notes: "" 
                }); 
              }} 
              className="btn-primary"
            >
              <Plus className="w-4.5 h-4.5" /> Mark Attendance
            </button>
          )}
        </motion.div>

        {/* Master-Detail Layout Container */}
        <div className={`grid ${isManager ? "grid-cols-1 lg:grid-cols-4 gap-6" : "grid-cols-1"}`}>
          
          {/* Master Sidebar (For Super Admin and Owner Admin) */}
          {isManager && (
            <div className="card p-4 space-y-4 lg:col-span-1 h-[calc(100vh-220px)] flex flex-col">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Employees</h3>
                <p className="text-xs text-gray-400 mt-0.5">Select to view logs</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-9 text-sm"
                />
                <Search className="w-4.5 h-4.5 text-gray-400 absolute left-3 top-3.5" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {/* Self Option */}
                <button
                  onClick={() => setSelectedEmployeeId(currentUser?.id || "")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between ${
                    selectedEmployeeId === currentUser?.id
                      ? "bg-blue-50 text-blue-700 font-medium border border-blue-100"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="text-sm">Self ({currentUser?.name || "Admin"})</span>
                </button>
                
                {/* Employee List */}
                {filteredEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between ${
                      selectedEmployeeId === emp.id
                        ? "bg-blue-50 text-blue-700 font-medium border border-blue-100"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span className="text-sm truncate">{emp.name}</span>
                  </button>
                ))}
                {filteredEmployees.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No employees found</p>
                )}
              </div>
            </div>
          )}

          {/* Details Panel (Stats, Calendar, and Table) */}
          <div className={`${isManager ? "lg:col-span-3" : ""} space-y-6 overflow-y-auto h-[calc(100vh-220px)] pr-2`}>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="kpi-card"><p className="text-xs text-gray-500">Present (Full)</p><p className="text-xl font-bold text-emerald-600">{presentCount}</p></div>
              <div className="kpi-card"><p className="text-xs text-gray-500">Half Day</p><p className="text-xl font-bold text-amber-600">{halfDayCount}</p></div>
              <div className="kpi-card"><p className="text-xs text-gray-500 font-medium text-red-600">Late Days</p><p className="text-xl font-bold text-red-600">{lateCount}</p></div>
              <div className="kpi-card"><p className="text-xs text-gray-500">Total Hours</p><p className="text-xl font-bold text-gray-900">{totalHours.toFixed(1)}</p></div>
            </div>

            {/* Month Navigator */}
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
                <h2 className="text-lg font-semibold text-gray-900">{format(currentMonth, "MMMM yyyy")}</h2>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
              </div>
            </div>

            {/* Calendar */}
            <div className="card p-5">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {days.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const record = getRecordForDate(dateStr);
                  const isToday = dateStr === today;

                  return (
                    <motion.div
                      key={dateStr}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => handleDayClick(day)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer hover:border-blue-200 min-h-[70px]
                        ${isToday ? "border-blue-300 bg-blue-50/50" : "border-transparent"}
                        ${record ? "bg-gray-50" : "hover:bg-gray-50/50"}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${isToday ? "text-blue-600" : "text-gray-700"}`}>{format(day, "d")}</span>
                        {record && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[record.status] || "badge-neutral"}`}>{record.status.replace("_", " ")}</span>}
                      </div>
                      {record && (
                        <div className="space-y-0.5">
                          {record.inTime && <p className="text-[10px] text-gray-500">In: {record.inTime}</p>}
                          {record.outTime && <p className="text-[10px] text-gray-500">Out: {record.outTime}</p>}
                          {record.workingHours && <p className="text-[10px] text-gray-500 font-medium">{record.workingHours}h</p>}
                          {(record.lateMinutes ?? 0) > 0 && <p className="text-[10px] text-red-500 font-semibold">{record.lateMinutes}m late</p>}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Attendance Table */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Attendance Records</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">In Time</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Out Time</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Hours</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Late</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">OT</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">No records found</td></tr>
                  ) : records.sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-2.5 text-sm text-gray-900">{r.date}</td>
                      <td className="px-5 py-2.5 text-sm text-gray-600">{r.inTime || "-"}</td>
                      <td className="px-5 py-2.5 text-sm text-gray-600">{r.outTime || "-"}</td>
                      <td className="px-5 py-2.5 text-sm text-gray-600">{r.workingHours || "-"}</td>
                      <td className="px-5 py-2.5 text-sm text-red-500">{(r.lateMinutes ?? 0) > 0 ? `${r.lateMinutes}m` : "-"}</td>
                      <td className="px-5 py-2.5 text-sm text-gray-600">{(r.overtimeMinutes ?? 0) > 0 ? `${r.overtimeMinutes}m` : "-"}</td>
                      <td className="px-5 py-2.5"><span className={`badge ${STATUS_COLORS[r.status] || "badge-neutral"}`}>{r.status.replace("_", " ")}</span></td>
                      <td className="px-5 py-2.5"><span className="badge badge-neutral">{r.source}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Mark Attendance</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4.5 h-4.5 text-gray-500" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {isManager && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                    <select 
                      value={form.userId || selectedEmployeeId} 
                      onChange={(e) => setForm({ ...form, userId: e.target.value })} 
                      className="input-field"
                    >
                      <option value={currentUser?.id}>Self ({currentUser?.name})</option>
                      {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">In Time</label>
                    <input type="time" value={form.inTime} onChange={(e) => setForm({ ...form, inTime: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Out Time</label>
                    <input type="time" value={form.outTime} onChange={(e) => setForm({ ...form, outTime: e.target.value })} className="input-field" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" />
                </div>
                <p className="text-xs text-gray-400">Shift hours: 10:00 AM - 6:00 PM | Grace: 10:15 AM</p>
                <button type="submit" className="btn-primary w-full justify-center">Submit Attendance</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
