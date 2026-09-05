"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  AlertCircle, 
  Check, 
  X, 
  User, 
  Briefcase, 
  CheckCircle2, 
  Sun, 
  Moon, 
  Award,
  ListFilter,
  CalendarDays,
  LayoutList
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths, isSameDay } from "date-fns";

interface AttendanceRecord {
  id: string;
  userId: string;
  userName?: string;
  date: string;
  inTime: string | null;
  outTime: string | null;
  status: string;
  source: string;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  workingHours: string | null;
  notes: string | null;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  year: number;
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

interface CurrentUser {
  id: string;
  name: string;
  email?: string;
  role?: string;
  designation?: string;
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  
  const [userRole, setUserRole] = useState("employee");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [search, setSearch] = useState("");

  // Mobile View Controls
  const [mobileView, setMobileView] = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const isCompOffEligible = userRole === "super_admin" || userRole === "owner_admin" || currentUser?.email === "sujith@fourdee.com" || (currentUser?.name?.toLowerCase().includes("surjith") ?? false);
  
  const [form, setForm] = useState({ userId: "", date: "", inTime: "", outTime: "", notes: "", status: "present" });
  const [leaveForm, setLeaveForm] = useState({ startDate: "", endDate: "", type: "CL", reason: "" });
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [clBalance, setClBalance] = useState({ accrued: 0, used: 0, available: 0 });
  const [coBalance, setCoBalance] = useState({ accrued: 0, used: 0, available: 0 });
  const [holidaysList, setHolidaysList] = useState<Holiday[]>([]);

  const isManager = userRole === "super_admin" || userRole === "owner_admin";
  const monthStr = format(currentMonth, "yyyy-MM");

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    const targetUserId = selectedEmployeeId || currentUser?.id;
    if (!targetUserId) {
      setLoading(false);
      return;
    }

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
  }, [monthStr, selectedEmployeeId, currentUser?.id]);

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
    if (isManager) {
      fetch("/api/employees")
        .then((r) => r.json())
        .then((d) => setEmployees(d.employees || []))
        .catch(console.error);
    }
  }, [isManager]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    fetchAttendance();
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/leave-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...leaveForm, isHalfDay }),
    });
    const resData = await res.json();
    if (!res.ok) {
      alert(resData.error || "Failed to submit leave request");
      return;
    }
    setShowLeaveModal(false);
    setLeaveForm({ startDate: "", endDate: "", type: "CL", reason: "" });
    setIsHalfDay(false);
    fetchAttendance();
  };

  const handleReviewLeave = async (id: string, status: "approved" | "rejected") => {
    await fetch("/api/leave-requests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchAttendance();
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    const dateStr = format(day, "yyyy-MM-dd");
    const rec = getRecordForDate(dateStr);
    
    // Only open edit modal if user is manager or clicks to edit
    if (isManager) {
      setForm({
        userId: selectedEmployeeId || currentUser?.id || "",
        date: dateStr,
        inTime: rec?.inTime || "10:00",
        outTime: rec?.outTime || "18:00",
        notes: rec?.notes || "",
        status: rec?.status || (getDay(day) === 0 ? "WO" : "present"),
      });
    }
  };

  const openMarkAttendanceModalForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const rec = getRecordForDate(dateStr);
    setForm({
      userId: selectedEmployeeId || currentUser?.id || "",
      date: dateStr,
      inTime: rec?.inTime || "10:00",
      outTime: rec?.outTime || "18:00",
      notes: rec?.notes || "",
      status: rec?.status || (getDay(day) === 0 ? "WO" : "present"),
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
  const presentCount = records.filter((r) => r.status === "present" || r.status === "WO_PRESENT" || r.status === "H_PRESENT").length;
  const halfDayCount = records.filter((r) => r.status === "half_day" || r.status === "HD_CL").length;
  const lateCount = records.filter((r) => (r.lateMinutes ?? 0) > 0).length;
  const totalHours = records.reduce((acc, r) => acc + parseFloat(r.workingHours ?? "0"), 0);

  const filteredEmployees = employees.filter((emp) => 
    emp.name.toLowerCase().includes(search.toLowerCase()) && emp.id !== currentUser?.id
  );

  const pendingLeaves = leaveRequests.filter((l) => l.status === "pending");
  const historicalLeaves = leaveRequests.filter((l) => l.status !== "pending");

  // Selected Day Details for Mobile Inspection Card
  const selectedDateStr = format(selectedDay, "yyyy-MM-dd");
  const selectedRecord = getRecordForDate(selectedDateStr);
  const selectedHoliday = holidaysList.find((h) => h.date === selectedDateStr);
  const selectedIsSunday = getDay(selectedDay) === 0;

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6">
        
        {/* Top Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Attendance</h1>
            <p className="text-xs sm:text-sm text-gray-500">Track and manage attendance, shifts & leaves</p>
          </div>
          <div className="flex items-center gap-2">
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
              className="btn-secondary text-xs sm:text-sm py-2 px-3 flex-1 sm:flex-none justify-center"
            >
              Apply Leave
            </button>
            <button 
              onClick={() => openMarkAttendanceModalForDay(new Date())} 
              className="btn-primary text-xs sm:text-sm py-2 px-3 flex-1 sm:flex-none justify-center"
            >
              <Plus className="w-4 h-4" /> Mark Attendance
            </button>
          </div>
        </motion.div>

        {/* Master Employee Switcher for Managers */}
        {isManager && (
          <div className="card p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Employee</span>
              <div className="relative w-40 sm:w-56">
                <input
                  type="text"
                  placeholder="Search name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field py-1 pl-7 text-xs"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
              </div>
            </div>
            
            {/* Horizontal Scrollable Chips on Mobile, Grid on Desktop */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
              <button
                onClick={() => setSelectedEmployeeId(currentUser?.id || "")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  selectedEmployeeId === currentUser?.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Self ({currentUser?.name || "Admin"})
              </button>
              
              {filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                    selectedEmployeeId === emp.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-bold">
                    {emp.name.charAt(0)}
                  </div>
                  {emp.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quota & Stats KPI Cards */}
        <div className={`grid gap-2 sm:gap-4 ${coBalance.accrued > 0 || isCompOffEligible ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}>
          <div className="kpi-card bg-purple-50/30 border-purple-100 p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-purple-700 font-semibold">Casual Leave Quota</p>
            <p className="text-lg sm:text-2xl font-bold text-purple-900 mt-0.5">{clBalance.available} CL left</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Accrued: {clBalance.accrued} | Used: {clBalance.used}</p>
          </div>
          
          {(coBalance.accrued > 0 || isCompOffEligible) && (
            <div className="kpi-card bg-indigo-50/30 border-indigo-100 p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs text-indigo-700 font-semibold">Comp Off Balance</p>
              <p className="text-lg sm:text-2xl font-bold text-indigo-900 mt-0.5">{coBalance.available} CO left</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Earned: {coBalance.accrued} | Used: {coBalance.used}</p>
            </div>
          )}

          <div className="kpi-card p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Present Days</p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-600 mt-0.5">{presentCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{halfDayCount > 0 ? `+${halfDayCount} Half-day(s)` : "Full attendance"}</p>
          </div>

          <div className="kpi-card p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-red-600 font-medium">Late Days</p>
            <p className="text-lg sm:text-2xl font-bold text-red-600 mt-0.5">{lateCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Shift delays</p>
          </div>

          <div className="kpi-card p-3 sm:p-4 col-span-2 sm:col-span-1">
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Total Working Hours</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-0.5">{totalHours.toFixed(1)} hrs</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{format(currentMonth, "MMMM yyyy")}</p>
          </div>
        </div>

        {/* Month Navigator & Mobile View Switcher */}
        <div className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="text-center">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">{format(currentMonth, "MMMM yyyy")}</h2>
              <p className="text-[10px] sm:text-xs text-gray-400">Monthly Attendance Log</p>
            </div>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
          </div>

          {/* View Mode Toggle for Mobile Screens */}
          <div className="flex sm:hidden bg-gray-100 p-1 rounded-xl w-full border border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setMobileView("calendar")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mobileView === "calendar" ? "bg-white text-blue-700 shadow-xs" : "text-gray-500"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Calendar View
            </button>
            <button
              onClick={() => setMobileView("list")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mobileView === "list" ? "bg-white text-blue-700 shadow-xs" : "text-gray-500"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Daily Feed
            </button>
          </div>
        </div>

        {/* ─── 1. MOBILE CALENDAR VIEW (Aesthetic, Compact, Zero-Collision) ─── */}
        <div className={`sm:hidden space-y-3 ${mobileView === "calendar" ? "block" : "hidden"}`}>
          <div className="card p-3">
            {/* Day of week headers */}
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[10px] font-bold text-gray-400 uppercase">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startDay }).map((_, i) => <div key={`empty-m-${i}`} />)}
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const record = getRecordForDate(dateStr);
                const isSelected = isSameDay(day, selectedDay);
                const isToday = dateStr === today;
                const isSunday = getDay(day) === 0;
                const holidayInfo = holidaysList.find((h) => h.date === dateStr);

                // Determine badge dot color
                let dotColor = "bg-transparent";
                let statusLabel = "";
                if (record) {
                  if (record.status === "present" || record.status === "WO_PRESENT" || record.status === "H_PRESENT") {
                    dotColor = "bg-emerald-500";
                    statusLabel = "P";
                  } else if (record.status === "half_day" || record.status === "HD_CL") {
                    dotColor = "bg-purple-500";
                    statusLabel = "0.5";
                  } else if (record.status === "CL") {
                    dotColor = "bg-purple-600";
                    statusLabel = "CL";
                  } else if (record.status === "CO") {
                    dotColor = "bg-indigo-600";
                    statusLabel = "CO";
                  } else if (record.status === "WO") {
                    dotColor = "bg-gray-400";
                    statusLabel = "WO";
                  } else if (record.status === "H") {
                    dotColor = "bg-amber-500";
                    statusLabel = "H";
                  } else if (record.status === "absent" || record.status === "LOP") {
                    dotColor = "bg-red-500";
                    statusLabel = "A";
                  }
                } else if (holidayInfo) {
                  dotColor = "bg-amber-500";
                  statusLabel = "H";
                } else if (isSunday) {
                  dotColor = "bg-gray-300";
                  statusLabel = "WO";
                }

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl p-1 relative transition-all ${
                      isSelected 
                        ? "bg-blue-600 text-white shadow-md font-bold scale-105 z-10" 
                        : isToday 
                        ? "border border-blue-400 bg-blue-50 text-blue-900" 
                        : holidayInfo 
                        ? "bg-amber-50/70 text-amber-900" 
                        : isSunday 
                        ? "bg-gray-50 text-gray-400" 
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span className="text-xs leading-none">{format(day, "d")}</span>
                    {statusLabel && (
                      <span className={`text-[8px] mt-0.5 leading-none px-1 py-0.2 rounded-full font-bold ${
                        isSelected 
                          ? "bg-white/20 text-white" 
                          : record?.status === "present" || record?.status === "WO_PRESENT" || record?.status === "H_PRESENT"
                          ? "bg-emerald-100 text-emerald-800"
                          : record?.status === "HD_CL" || record?.status === "CL"
                          ? "bg-purple-100 text-purple-800"
                          : holidayInfo || record?.status === "H"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {statusLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Selected Day Inspection Card */}
          <div className="card p-4 bg-white border-2 border-blue-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Selected Day</span>
                <h3 className="text-sm font-bold text-gray-900">{format(selectedDay, "EEEE, dd MMMM yyyy")}</h3>
              </div>
              
              <div>
                {selectedRecord ? (
                  <span className={`badge ${STATUS_COLORS[selectedRecord.status] || "badge-neutral"} text-xs py-1 px-2.5 font-bold`}>
                    {selectedRecord.status === "WO_PRESENT" ? "WO + PRESENT" : selectedRecord.status === "H_PRESENT" ? "H + PRESENT" : selectedRecord.status === "HD_CL" ? "HD + 0.5 CL" : selectedRecord.status.toUpperCase()}
                  </span>
                ) : selectedHoliday ? (
                  <span className="badge badge-warning text-xs py-1 px-2.5 font-bold">HOLIDAY</span>
                ) : selectedIsSunday ? (
                  <span className="badge badge-neutral text-xs py-1 px-2.5">WEEK OFF (WO)</span>
                ) : (
                  <span className="badge badge-neutral text-xs py-1 px-2.5">NOT RECORDED</span>
                )}
              </div>
            </div>

            {selectedHoliday && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-xs text-amber-900 font-semibold flex items-center gap-2">
                <span>🎉</span>
                <span>Official Public Holiday: <b>{selectedHoliday.name}</b></span>
              </div>
            )}

            {(selectedRecord?.status === "WO_PRESENT" || selectedRecord?.status === "H_PRESENT") && (
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 font-semibold flex items-center gap-2">
                <span>⭐</span>
                <span>Worked on Weekend/Holiday: <b>+1 Comp Off (CO) Earned</b></span>
              </div>
            )}

            {selectedRecord ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 text-[10px] block">Punch In Time</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedRecord.inTime || "--:--"}</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 text-[10px] block">Punch Out Time</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedRecord.outTime || "--:--"}</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 text-[10px] block">Working Hours</span>
                  <span className="font-bold text-emerald-700 text-sm">{selectedRecord.workingHours ? `${selectedRecord.workingHours} hrs` : "0 hrs"}</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 text-[10px] block">Late Duration</span>
                  <span className={`font-bold text-sm ${(selectedRecord.lateMinutes ?? 0) > 0 ? "text-red-600" : "text-gray-700"}`}>
                    {(selectedRecord.lateMinutes ?? 0) > 0 ? `${selectedRecord.lateMinutes} mins late` : "Ontime (0m)"}
                  </span>
                </div>
                {selectedRecord.notes && (
                  <div className="col-span-2 p-2 bg-blue-50/50 rounded-xl border border-blue-100 text-[11px] text-blue-950">
                    <b>Notes:</b> {selectedRecord.notes}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">No punch in/out recorded for this date.</p>
            )}

            <button
              onClick={() => openMarkAttendanceModalForDay(selectedDay)}
              className="btn-primary w-full justify-center text-xs py-2"
            >
              {isManager ? "Edit / Override Day Status" : "Mark / Request Day Attendance"}
            </button>
          </div>
        </div>

        {/* ─── 2. MOBILE DAILY FEED / LIST VIEW ─── */}
        <div className={`sm:hidden space-y-2.5 ${mobileView === "list" ? "block" : "hidden"}`}>
          {days.slice().reverse().map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const record = getRecordForDate(dateStr);
            const isSunday = getDay(day) === 0;
            const holidayInfo = holidaysList.find((h) => h.date === dateStr);

            return (
              <div 
                key={dateStr}
                onClick={() => { setSelectedDay(day); openMarkAttendanceModalForDay(day); }}
                className={`card p-3.5 transition-all cursor-pointer border ${
                  record ? "border-gray-200 bg-white" : holidayInfo ? "border-amber-200 bg-amber-50/30" : isSunday ? "border-gray-100 bg-gray-50/40 text-gray-400" : "border-gray-100"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-center bg-gray-100 rounded-lg p-1.5 min-w-[38px]">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase leading-none">{format(day, "EEE")}</span>
                      <span className="text-sm font-black text-gray-900 block leading-tight">{format(day, "d")}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{format(day, "MMMM d, yyyy")}</p>
                      {holidayInfo && <p className="text-[10px] font-semibold text-amber-700">🎉 {holidayInfo.name}</p>}
                      {(record?.status === "WO_PRESENT" || record?.status === "H_PRESENT") && (
                        <p className="text-[10px] font-bold text-indigo-700">⭐ +1 Comp Off Earned</p>
                      )}
                    </div>
                  </div>

                  <div>
                    {record ? (
                      <span className={`badge ${STATUS_COLORS[record.status] || "badge-neutral"} text-[10px] font-bold`}>
                        {record.status === "WO_PRESENT" ? "WO + PRESENT" : record.status === "H_PRESENT" ? "H + PRESENT" : record.status === "HD_CL" ? "HD 0.5 CL" : record.status.toUpperCase()}
                      </span>
                    ) : holidayInfo ? (
                      <span className="badge badge-warning text-[10px]">HOLIDAY</span>
                    ) : isSunday ? (
                      <span className="badge badge-neutral text-[10px]">WEEK OFF</span>
                    ) : (
                      <span className="text-[10px] text-gray-300">--</span>
                    )}
                  </div>
                </div>

                {record && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-[11px] text-gray-600">
                    <div><span className="text-gray-400 block text-[9px]">In</span> <b className="text-gray-900">{record.inTime || "--"}</b></div>
                    <div><span className="text-gray-400 block text-[9px]">Out</span> <b className="text-gray-900">{record.outTime || "--"}</b></div>
                    <div><span className="text-gray-400 block text-[9px]">Hours</span> <b className="text-emerald-700">{record.workingHours ? `${record.workingHours}h` : "--"}</b></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ─── 3. DESKTOP CALENDAR VIEW (Spacious, Multi-Column) ─── */}
        <div className="hidden sm:block card p-5">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
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
                  onClick={() => openMarkAttendanceModalForDay(day)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer hover:border-blue-300 min-h-[85px] flex flex-col justify-between
                    ${isToday ? "border-blue-400 bg-blue-50/50 shadow-xs" : "border-gray-100"}
                    ${holidayInfo ? "bg-amber-50/40 border-amber-200" : record ? "bg-white" : isSunday ? "bg-gray-50/40 text-gray-400" : "hover:bg-gray-50/50"}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${isToday ? "text-blue-600" : isSunday ? "text-gray-400" : "text-gray-800"}`}>{format(day, "d")}</span>
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
                            HD 0.5 CL
                          </span>
                        ) : (
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[record.status] || "bg-gray-100 text-gray-700"}`}>
                            {record.status.toUpperCase()}
                          </span>
                        )
                      ) : holidayInfo ? (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-200">H</span>
                      ) : isSunday ? (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border bg-gray-50 text-gray-400 border-gray-100">WO</span>
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
                  </div>

                  {record && (
                    <div className="space-y-0.5 text-[10px] text-gray-500 pt-1 border-t border-gray-50">
                      {record.inTime && <div className="flex justify-between"><span>In:</span> <b className="text-gray-800">{record.inTime}</b></div>}
                      {record.outTime && <div className="flex justify-between"><span>Out:</span> <b className="text-gray-800">{record.outTime}</b></div>}
                      {record.workingHours && parseFloat(record.workingHours) > 0 && (
                        <div className="flex justify-between text-emerald-700 font-bold"><span>Total:</span> <span>{record.workingHours}h</span></div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Leave Approvals Queue (Manager only) */}
        {isManager && pendingLeaves.length > 0 && (
          <div className="card p-4 sm:p-5 border-l-4 border-amber-500">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900 text-sm">Pending Leave Requests</h3>
            </div>
            <div className="space-y-2.5">
              {pendingLeaves.map((leave) => (
                <div key={leave.id} className="p-3.5 bg-gray-50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{leave.userName || "Employee"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Requested <span className="font-semibold text-purple-600">{leave.type}</span> from <span className="font-medium">{leave.startDate}</span> to <span className="font-medium">{leave.endDate}</span>
                    </p>
                    {leave.reason && <p className="text-xs italic text-gray-500 mt-1 bg-white p-2 rounded border border-gray-100">"{leave.reason}"</p>}
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

      </div>

      {/* Mark/Edit Attendance Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-5 sm:p-6 w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Mark / Edit Attendance</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4.5 h-4.5 text-gray-500" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Attendance Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field text-sm">
                    <option value="present">Present (Full Day)</option>
                    <option value="half_day">Half Day (Unpaid 0.5d)</option>
                    <option value="HD_CL">Half Day + 0.5 CL Applied (Full Paid 1.0d)</option>
                    <option value="WO">Week Off (WO)</option>
                    <option value="WO_PRESENT">WO + Present (+1 Comp Off Earned)</option>
                    <option value="H">Public Holiday (H)</option>
                    <option value="H_PRESENT">Holiday + Present (+1 Comp Off Earned)</option>
                    <option value="CL">Casual Leave (CL)</option>
                    {isCompOffEligible && <option value="CO">Comp Off (CO)</option>}
                    <option value="LOP">Loss of Pay (LOP)</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">In Time</label>
                    <input type="time" value={form.inTime} onChange={(e) => setForm({ ...form, inTime: e.target.value })} className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Out Time</label>
                    <input type="time" value={form.outTime} onChange={(e) => setForm({ ...form, outTime: e.target.value })} className="input-field text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Reason</label>
                  <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field text-sm" placeholder="Optional notes..." />
                </div>
                <button type="submit" className="btn-primary w-full justify-center text-sm py-2.5">Save Attendance</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave Application Modal */}
      <AnimatePresence>
        {showLeaveModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowLeaveModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-5 sm:p-6 w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Apply for Leave</h2>
                <button onClick={() => setShowLeaveModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4.5 h-4.5 text-gray-500" /></button>
              </div>
              <form onSubmit={handleLeaveSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Leave Type</label>
                  <select 
                    value={leaveForm.type} 
                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })} 
                    className="input-field text-sm font-medium text-gray-900"
                  >
                    <option value="CL">Casual Leave (CL) - {clBalance.available} day(s) left</option>
                    {isCompOffEligible && (
                      <option value="CO">Comp Off (CO) - {coBalance.available} day(s) earned</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Leave Duration</label>
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
                    ⚡ <b>Half Day 0.5 CL:</b> Deducts only <b>0.5 CL</b> from your balance ({clBalance.available} CL available) and gives <b>1.0 Full Paid Day</b>.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="input-field text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label>
                    <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="input-field text-sm" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Leave</label>
                  <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="input-field text-sm min-h-[70px]" required placeholder="State your reason..." />
                </div>
                <button type="submit" className="btn-primary w-full justify-center text-sm py-2.5">Submit Request</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
