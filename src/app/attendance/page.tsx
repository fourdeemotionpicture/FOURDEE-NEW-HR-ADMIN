"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, parse } from "date-fns";

interface AttendanceRecord {
  id: string; userId: string; date: string; inTime: string | null; outTime: string | null;
  status: string; source: string; lateMinutes: number | null; workingHours: string | null; overtimeMinutes: number | null; userName?: string;
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
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ userId: "", date: "", inTime: "", outTime: "", notes: "" });

  const monthStr = format(currentMonth, "yyyy-MM");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/attendance?month=${monthStr}`);
    const data = await res.json();
    setRecords(data.attendance || []);
    setLoading(false);
  }, [monthStr]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d.role) setUserRole(d.role); });
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (userRole === "super_admin") {
      fetch("/api/employees").then((r) => r.json()).then((d) => setEmployees(d.employees || []));
    }
  }, [userRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = { date: form.date, inTime: form.inTime, outTime: form.outTime, source: "manual" };
    if (form.notes) body.notes = form.notes;
    if (userRole === "super_admin" && form.userId) body.userId = form.userId;

    await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setShowModal(false);
    setForm({ userId: "", date: "", inTime: "", outTime: "", notes: "" });
    fetchData();
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const today = format(new Date(), "yyyy-MM-dd");

  const getRecordForDate = (dateStr: string) => records.find((r) => r.date === dateStr);

  // Stats
  const presentCount = records.filter((r) => r.status === "present" || r.status === "half_day").length;
  const lateCount = records.filter((r) => (r.lateMinutes ?? 0) > 0).length;
  const totalHours = records.reduce((acc, r) => acc + parseFloat(r.workingHours ?? "0"), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track and manage attendance records</p>
          </div>
          <button onClick={() => { setShowModal(true); setForm({ userId: "", date: today, inTime: "10:00", outTime: "18:00", notes: "" }); }} className="btn-primary">
            <Plus className="w-4.5 h-4.5" /> Mark Attendance
          </button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="kpi-card"><p className="text-xs text-gray-500">Present</p><p className="text-xl font-bold text-emerald-600">{presentCount}</p></div>
          <div className="kpi-card"><p className="text-xs text-gray-500">Late</p><p className="text-xl font-bold text-amber-600">{lateCount}</p></div>
          <div className="kpi-card"><p className="text-xs text-gray-500">Total Hours</p><p className="text-xl font-bold text-blue-600">{totalHours.toFixed(1)}</p></div>
          <div className="kpi-card"><p className="text-xs text-gray-500">Records</p><p className="text-xl font-bold text-gray-900">{records.length}</p></div>
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
                  className={`p-2 rounded-xl border transition-all cursor-default
                    ${isToday ? "border-blue-300 bg-blue-50/50" : "border-transparent"}
                    ${record ? "bg-gray-50" : "hover:bg-gray-50/50"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isToday ? "text-blue-600" : "text-gray-700"}`}>{format(day, "d")}</span>
                    {record && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[record.status] || "badge-neutral"}`}>{record.status.slice(0, 4)}</span>}
                  </div>
                  {record && (
                    <div className="space-y-0.5">
                      {record.inTime && <p className="text-[10px] text-gray-500">In: {record.inTime}</p>}
                      {record.outTime && <p className="text-[10px] text-gray-500">Out: {record.outTime}</p>}
                      {record.workingHours && <p className="text-[10px] text-gray-500">{record.workingHours}h</p>}
                      {(record.lateMinutes ?? 0) > 0 && <p className="text-[10px] text-amber-600 font-medium">{record.lateMinutes}m late</p>}
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
                {userRole === "super_admin" && <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Employee</th>}
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
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">No records found</td></tr>
              ) : records.sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-2.5 text-sm text-gray-900">{r.date}</td>
                  {userRole === "super_admin" && <td className="px-5 py-2.5 text-sm text-gray-600">{r.userName || "-"}</td>}
                  <td className="px-5 py-2.5 text-sm text-gray-600">{r.inTime || "-"}</td>
                  <td className="px-5 py-2.5 text-sm text-gray-600">{r.outTime || "-"}</td>
                  <td className="px-5 py-2.5 text-sm text-gray-600">{r.workingHours || "-"}</td>
                  <td className="px-5 py-2.5 text-sm text-gray-600">{(r.lateMinutes ?? 0) > 0 ? `${r.lateMinutes}m` : "-"}</td>
                  <td className="px-5 py-2.5 text-sm text-gray-600">{(r.overtimeMinutes ?? 0) > 0 ? `${r.overtimeMinutes}m` : "-"}</td>
                  <td className="px-5 py-2.5"><span className={`badge ${STATUS_COLORS[r.status] || "badge-neutral"}`}>{r.status}</span></td>
                  <td className="px-5 py-2.5"><span className="badge badge-neutral">{r.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
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
                {userRole === "super_admin" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                    <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field">
                      <option value="">Self</option>
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
                <p className="text-xs text-gray-400">Office hours: 10:00 AM - 6:00 PM | Grace until 10:15 AM</p>
                <button type="submit" className="btn-primary w-full justify-center">Submit Attendance</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
