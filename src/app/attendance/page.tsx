"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Calendar, ChevronLeft, ChevronRight, X, Search, Check, AlertCircle } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  inTime: string | null;
  outTime: string | null;
  status: string;
  source: string;
  lateMinutes: number | null;
  workingHours: string | null;
  overtimeMinutes: number | null;
  userName?: string;
  notes?: string | null;
}

interface LeaveRequest {
  id: string;
  userId: string;
  userName?: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string | null;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  half_day: "bg-amber-50 text-amber-700 border-amber-200",
  holiday: "bg-blue-50 text-blue-700 border-blue-200",
  WO: "bg-gray-50 text-gray-600 border-gray-200",
  WO_PRESENT: "bg-emerald-50 text-emerald-800 border-emerald-300",
  H_PRESENT: "bg-amber-100 text-amber-900 border-amber-300",
  HD_CL: "bg-purple-100 text-purple-900 border-purple-300",
  CL: "bg-purple-50 text-purple-700 border-purple-200",
  SL: "bg-pink-50 text-pink-700 border-pink-200",
  CO: "bg-indigo-50 text-indigo-700 border-indigo-200",
  LOP: "bg-orange-50 text-orange-700 border-orange-200",
  H: "bg-sky-50 text-sky-700 border-sky-200",
};

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  
  const [userRole, setUserRole] = useState("employee");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [search, setSearch] = useState("");
  
  const [form, setForm] = useState({ userId: "", date: "", inTime: "", outTime: "", notes: "", status: "present" });
  const [leaveForm, setLeaveForm] = useState({ startDate: "", endDate: "", type: "CL", reason: "" });
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [clBalance, setClBalance] = useState({ accrued: 0, used: 0, available: 0 });
  const [coBalance, setCoBalance] = useState({ accrued: 0, used: 0, available: 0 });
  const [holidaysList, setHolidaysList] = useState<{ id: string; name: string; date: string }[]>([]);

  const monthStr = format(currentMonth, "yyyy-MM");
  const isManager = userRole === "super_admin" || userRole === "owner_admin";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const targetUserId = selectedEmployeeId || "";
    
    // Fetch attendance
    const attendanceRes = await fetch(`/api/attendance?month=${monthStr}&userId=${targetUserId}`);
    const attendanceData = await attendanceRes.json();
    setRecords(attendanceData.attendance || []);
    
    // Fetch leave requests
    const leaveRes = await fetch(`/api/leave-requests?userId=${targetUserId}`);
    const leaveData = await leaveRes.json();
    setLeaveRequests(leaveData.requests || []);
    setClBalance(leaveData.clBalance || { accrued: 0, used: 0, available: 0 });
    setCoBalance(leaveData.coBalance || { accrued: 0, used: 0, available: 0 });

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

    fetch("/api/holidays")
      .then((r) => r.json())
      .then((d) => setHolidaysList(d.holidays || []))
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
    const body: Record<string, any> = { 
      date: form.date, 
      source: "manual", 
      status: form.status 
    };

    // Only set time parameters if not setting a leave/weekoff status
    const isLeave = ["WO", "CL", "SL", "CO", "LOP", "H", "absent"].includes(form.status);
    if (!isLeave) {
      body.inTime = form.inTime;
      body.outTime = form.outTime;
    }

    if (form.notes) body.notes = form.notes;
    
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
      setForm({ userId: "", date: "", inTime: "", outTime: "", notes: "", status: "present" });
      fetchData();
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...leaveForm, isHalfDay }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to submit leave request");
        return;
      }
      setShowLeaveModal(false);
      setLeaveForm({ startDate: "", endDate: "", type: "CL", reason: "" });
      setIsHalfDay(false);
      fetchData();
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleReviewLeave = async (requestId: string, status: "approved" | "rejected") => {
    if (!confirm(`Are you sure you want to ${status} this request?`)) return;

    try {
      const res = await fetch("/api/leave-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Action failed");
        return;
      }
      fetchData();
    } catch {
      alert("Network error.");
    }
  };

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    if (!isManager && dateStr !== today) {
      return; // Employees can only submit for today
    }
    
    const record = getRecordForDate(dateStr);
    const holidayInfo = holidaysList.find((h) => h.date === dateStr);
    const isSunday = getDay(day) === 0;

    let defaultStatus = "present";
    if (record?.status) {
      defaultStatus = record.status;
    } else if (isSunday) {
      defaultStatus = "WO";
    } else if (holidayInfo) {
      defaultStatus = "H";
    }

    setForm({
      userId: selectedEmployeeId || currentUser?.id || "",
      date: dateStr,
      inTime: record?.inTime || "10:00",
      outTime: record?.outTime || "18:00",
      notes: record?.notes || "",
      status: defaultStatus,
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

  const pendingLeaves = leaveRequests.filter((l) => l.status === "pending");
  const historicalLeaves = leaveRequests.filter((l) => l.status !== "pending");

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track and manage attendance & leaves</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => { 
                setShowLeaveModal(true); 
                setLeaveForm({ 
                  startDate: today, 
                  endDate: today, 
                  type: "CL", 
                  reason: "" 
                }); 
              }} 
              className="btn-secondary"
            >
              Apply Leave
            </button>
            {userRole !== "owner_admin" && (
              <button 
                onClick={() => { 
                  setShowModal(true); 
                  setForm({ 
                    userId: selectedEmployeeId || currentUser?.id || "", 
                    date: today, 
                    inTime: "10:00", 
                    outTime: "18:00", 
                    notes: "",
                    status: "present"
                  }); 
                }} 
                className="btn-primary"
              >
                <Plus className="w-4.5 h-4.5" /> Mark Attendance
              </button>
            )}
          </div>
        </motion.div>

        {/* Master-Detail Layout Container */}
        <div className={`grid ${isManager ? "grid-cols-1 lg:grid-cols-4 gap-6" : "grid-cols-1"}`}>
          
          {/* Master Sidebar (For Admins) */}
          {isManager && (
            <div className="card p-4 space-y-4 lg:col-span-1 h-60 lg:h-[calc(100vh-220px)] flex flex-col">
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
              </div>
            </div>
          )}

          {/* Details Panel */}
          <div className={`${isManager ? "lg:col-span-3" : ""} space-y-6 overflow-y-auto h-auto lg:h-[calc(100vh-220px)] pr-2`}>
            
            {/* Quota Summary & Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
              <div className="kpi-card bg-purple-50/20 border-purple-100/50">
                <p className="text-xs text-purple-600 font-medium">Casual Leave Quota</p>
                <p className="text-xl font-bold text-purple-700 mt-1">{clBalance.available} CL left</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Accrued: {clBalance.accrued} | Used: {clBalance.used}</p>
              </div>
              <div className="kpi-card bg-indigo-50/20 border-indigo-100/50">
                <p className="text-xs text-indigo-600 font-medium">Comp Off Balance</p>
                <p className="text-xl font-bold text-indigo-700 mt-1">{coBalance.available} CO left</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Earned: {coBalance.accrued} | Used: {coBalance.used}</p>
              </div>
              <div className="kpi-card"><p className="text-xs text-gray-500">Present (Full)</p><p className="text-xl font-bold text-emerald-600 mt-1">{presentCount}</p></div>
              <div className="kpi-card"><p className="text-xs text-gray-500 font-medium text-red-600">Late Days</p><p className="text-xl font-bold text-red-600 mt-1">{lateCount}</p></div>
              <div className="kpi-card col-span-2 sm:col-span-1"><p className="text-xs text-gray-500">Total Hours</p><p className="text-xl font-bold text-gray-900 mt-1">{totalHours.toFixed(1)}</p></div>
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
                  const isSunday = getDay(day) === 0;
                  const holidayInfo = holidaysList.find((h) => h.date === dateStr);

                  return (
                    <motion.div
                      key={dateStr}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => handleDayClick(day)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer hover:border-blue-200 min-h-[70px]
                        ${isToday ? "border-blue-300 bg-blue-50/50" : "border-transparent"}
                        ${holidayInfo ? "bg-amber-50/40 border-amber-200/60" : record ? "bg-gray-50" : isSunday ? "bg-gray-50/30 text-gray-400" : "hover:bg-gray-50/50"}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${isToday ? "text-blue-600 font-bold" : isSunday ? "text-gray-400" : "text-gray-700"}`}>{format(day, "d")}</span>
                        {record ? (
                          record.status === "WO_PRESENT" ? (
                            <div className="flex items-center gap-0.5">
                              <span className="text-[8px] font-bold px-1 py-0.2 rounded border bg-gray-100 text-gray-600 border-gray-200">WO</span>
                              <span className="text-[8px] font-bold px-1 py-0.2 rounded border bg-emerald-50 text-emerald-700 border-emerald-300">+ PRESENT</span>
                            </div>
                          ) : record.status === "H_PRESENT" ? (
                            <div className="flex items-center gap-0.5">
                              <span className="text-[8px] font-bold px-1 py-0.2 rounded border bg-amber-100 text-amber-800 border-amber-300">H</span>
                              <span className="text-[8px] font-bold px-1 py-0.2 rounded border bg-emerald-50 text-emerald-700 border-emerald-300">+ PRESENT</span>
                            </div>
                          ) : record.status === "HD_CL" ? (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border bg-purple-100 text-purple-800 border-purple-300">
                              HD + 0.5 CL
                            </span>
                          ) : (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[record.status] || "bg-gray-100 text-gray-700"}`}>
                              {record.status.toUpperCase()}
                            </span>
                          )
                        ) : holidayInfo ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-200">H</span>
                        ) : isSunday ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-gray-50 text-gray-400 border-gray-100">WO</span>
                        ) : null}
                      </div>
                      {holidayInfo && (
                        <p className="text-[9px] font-semibold text-amber-800 truncate mb-0.5" title={holidayInfo.name}>
                          🎉 {holidayInfo.name}
                        </p>
                      )}
                      {(record?.status === "WO_PRESENT" || record?.status === "H_PRESENT") && (
                        <span className="inline-block text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded mb-0.5">
                          ⭐ +1 Comp Off
                        </span>
                      )}
                      {record && (
                        <div className="space-y-0.5">
                          {record.inTime && <p className="text-[10px] text-gray-500">In: {record.inTime}</p>}
                          {record.outTime && <p className="text-[10px] text-gray-500">Out: {record.outTime}</p>}
                          {record.workingHours && parseFloat(record.workingHours) > 0 && <p className="text-[10px] text-gray-500 font-medium">{record.workingHours}h</p>}
                          {(record.lateMinutes ?? 0) > 0 && <p className="text-[10px] text-red-500 font-semibold">{record.lateMinutes}m late</p>}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Leave Approvals Queue (Manager only) */}
            {isManager && pendingLeaves.length > 0 && (
              <div className="card p-5 border-l-4 border-amber-500">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Pending Leave Requests</h3>
                </div>
                <div className="space-y-3">
                  {pendingLeaves.map((leave) => (
                    <div key={leave.id} className="p-4 bg-gray-50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{leave.userName || "Employee"}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Requested <span className="font-semibold text-purple-600">{leave.type}</span> from <span className="font-medium">{leave.startDate}</span> to <span className="font-medium">{leave.endDate}</span>
                        </p>
                        {leave.reason && <p className="text-xs italic text-gray-500 mt-1 bg-white p-2 rounded border border-gray-100">"${leave.reason}"</p>}
                      </div>
                      <div className="flex gap-2 self-end sm:self-center">
                        <button onClick={() => handleReviewLeave(leave.id, "approved")} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => handleReviewLeave(leave.id, "rejected")} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-semibold hover:bg-red-100">
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendance & Leave Logs Combined Table */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Leave Application History</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Leave Type</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Start Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">End Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Reason</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalLeaves.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-xs text-gray-400">No leave history</td></tr>
                  ) : historicalLeaves.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 text-sm">
                      <td className="px-5 py-3.5 font-medium text-purple-600">{l.type}</td>
                      <td className="px-5 py-3.5 text-gray-600">{l.startDate}</td>
                      <td className="px-5 py-3.5 text-gray-600">{l.endDate}</td>
                      <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">{l.reason || "-"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-1 rounded-lg text-xs font-semibold uppercase ${
                          l.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                        }`}>{l.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>

      {/* Attendance Manual Mark Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Mark Attendance / Override</h2>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    value={form.status} 
                    onChange={(e) => setForm({ ...form, status: e.target.value })} 
                    className="input-field font-semibold text-blue-600"
                  >
                    <option value="present">Present (Full Day)</option>
                    <option value="half_day">Half Day (50% Day)</option>
                    <option value="HD_CL">Half Day + 0.5 CL (Full Paid Day)</option>
                    <option value="WO_PRESENT">Week Off + Present (WO + Present - Earns Comp Off)</option>
                    <option value="H_PRESENT">Holiday + Present (H + Present - Earns Comp Off)</option>
                    <option value="WO">Week Off (WO)</option>
                    <option value="CL">Casual Leave (CL)</option>
                    <option value="SL">Sick Leave (SL)</option>
                    <option value="CO">Comp Off (CO)</option>
                    <option value="LOP">Loss of Pay (LOP)</option>
                    <option value="H">Holiday (H)</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
                {!["WO", "CL", "SL", "CO", "LOP", "H", "absent"].includes(form.status) && (
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
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" />
                </div>
                <button type="submit" className="btn-primary w-full justify-center">Save Status</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave Application Modal */}
      <AnimatePresence>
        {showLeaveModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowLeaveModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Apply for Leave</h2>
                <button onClick={() => setShowLeaveModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4.5 h-4.5 text-gray-500" /></button>
              </div>
              <form onSubmit={handleLeaveSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                  <select 
                    value={leaveForm.type} 
                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })} 
                    className="input-field font-medium text-gray-900"
                  >
                    <option value="CL">Casual Leave (CL) - {clBalance.available} day(s) left</option>
                    <option value="CO">Comp Off (CO) - {coBalance.available} day(s) earned</option>
                    <option value="SL">Sick Leave (SL)</option>
                    <option value="H">Holiday (H) Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leave Duration</label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setIsHalfDay(false)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        !isHalfDay ? "bg-white text-blue-700 shadow-xs border border-gray-200" : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Full Day (1.0 Day)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsHalfDay(true)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        isHalfDay ? "bg-white text-blue-700 shadow-xs border border-gray-200" : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Half Day (0.5 CL)
                    </button>
                  </div>
                </div>

                {leaveForm.type === "CO" && (
                  <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-800">
                    🏆 <b>Comp Off Balance:</b> You have <b>{coBalance.available}</b> day(s) available earned from working on public holidays or Sundays.
                  </div>
                )}

                {leaveForm.type === "CL" && !isHalfDay && (
                  <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-100 text-xs text-purple-800">
                    ✨ <b>Casual Leave Balance:</b> You have <b>{clBalance.available}</b> day(s) left in your annual quota.
                  </div>
                )}

                {leaveForm.type === "CL" && isHalfDay && (
                  <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-100 text-xs text-purple-800">
                    ⚡ <b>Half Day 0.5 CL:</b> Deducts only <b>0.5 CL</b> from your balance ({clBalance.available} CL available) and converts your worked half day into <b>1.0 Full Paid Day</b> (No salary deduction / No LOP!).
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="input-field" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Leave</label>
                  <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="input-field min-h-[80px]" required placeholder="State your reason..." />
                </div>
                <p className="text-xs text-gray-400">Note: Leave requests within available quota (CL or CO) are auto-approved. Other requests will be sent to the Super Admin for approval.</p>
                <button type="submit" className="btn-primary w-full justify-center">Submit Request</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
