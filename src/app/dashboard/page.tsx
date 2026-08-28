"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, UserCheck, UserX, Clock, IndianRupee,
  FileText, TrendingUp, Wallet, AlertCircle, Calendar
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import AppShell from "@/components/AppShell";
import { format } from "date-fns";

interface DashboardData {
  userRole?: string;
  employeeSalary?: {
    monthlySalary: string;
    estimatedPayable: string;
  };
  personalStats?: {
    presentDays: number;
    absentDays: number;
    lateDays: number;
  };
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  todayWorkingHours: string;
  monthlyAttendance: number;
  todayExpenses: string;
  monthlyExpenses: string;
  currentBalance: string;
  todayWorkReports: number;
  monthlyWorkReports: number;
  attendanceTrend: { date: string; present: number; late: number }[];
  pendingLeavesCount?: number;
}

const COLORS = ["#2563EB", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"];

function KpiCard({ icon: Icon, label, value, sub, color, delay }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="kpi-card"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
          <motion.p
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.1, duration: 0.3 }}
            className="text-2xl font-bold text-gray-900"
          >
            {value}
          </motion.p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const attendancePieData = data ? [
    { name: "Present", value: data.presentToday },
    { name: "Late", value: data.lateToday },
    { name: "Absent", value: data.absentToday },
  ] : [];

  const isEmployee = data?.userRole === "employee" || data?.userRole === "office_admin";

  if (loading) {
    return (
      <AppShell>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white animate-pulse border border-gray-100" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-success">System Online</span>
          </div>
        </motion.div>

        {/* Pending Leaves Alert */}
        {data && data.pendingLeavesCount && data.pendingLeavesCount > 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Pending Leave Requests Alert</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  There are <span className="font-bold text-amber-900">{data.pendingLeavesCount}</span> leave requests waiting for your review.
                </p>
              </div>
            </div>
            <button 
              onClick={() => window.location.href = "/attendance"}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold self-start sm:self-center transition-colors shadow-sm"
            >
              Review Leaves
            </button>
          </motion.div>
        ) : null}

        {/* KPI Cards */}
        {isEmployee ? (
          /* Employee / Office Admin Dashboard Views (Personal Stats + Salary details) */
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard icon={IndianRupee} label="Monthly Salary (Base)" value={`₹${parseFloat(data?.employeeSalary?.monthlySalary ?? "0").toLocaleString()}`} color="bg-emerald-50 text-emerald-600" delay={0} />
            <KpiCard icon={Wallet} label="Estimated Payable Salary" value={`₹${parseFloat(data?.employeeSalary?.estimatedPayable ?? "0").toLocaleString()}`} sub="Based on attendance so far" color="bg-blue-50 text-blue-600" delay={0.05} />
            <KpiCard icon={UserCheck} label="My Present Days" value={data?.personalStats?.presentDays ?? 0} color="bg-emerald-50 text-emerald-600" delay={0.1} />
            <KpiCard icon={UserX} label="My Absent Days" value={data?.personalStats?.absentDays ?? 0} color="bg-red-50 text-red-600" delay={0.15} />
            <KpiCard icon={AlertCircle} label="My Late Days" value={data?.personalStats?.lateDays ?? 0} color="bg-amber-50 text-amber-600" delay={0.2} />
            <KpiCard icon={FileText} label="My Work Reports" value={data?.todayWorkReports ?? 0} sub={`${data?.monthlyWorkReports ?? 0} this month`} color="bg-cyan-50 text-cyan-600" delay={0.25} />
            <KpiCard icon={Calendar} label="My Attendance Days" value={data?.monthlyAttendance ?? 0} color="bg-violet-50 text-violet-600" delay={0.3} />
          </div>
        ) : (
          /* Admin / Super Admin / Owner Admin Dashboard Views (Admin stats + Salary, no petty cash) */
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard icon={Users} label="Total Employees" value={data?.totalEmployees ?? 0} color="bg-blue-50 text-blue-600" delay={0} />
            <KpiCard icon={UserCheck} label="Present Today" value={data?.presentToday ?? 0} sub={`${data?.todayWorkingHours ?? 0} hrs worked`} color="bg-emerald-50 text-emerald-600" delay={0.05} />
            <KpiCard icon={UserX} label="Absent Today" value={data?.absentToday ?? 0} color="bg-red-50 text-red-600" delay={0.1} />
            <KpiCard icon={AlertCircle} label="Late Today" value={data?.lateToday ?? 0} color="bg-amber-50 text-amber-600" delay={0.15} />
            <KpiCard icon={IndianRupee} label="Monthly Salary (Base)" value={`₹${parseFloat(data?.employeeSalary?.monthlySalary ?? "0").toLocaleString()}`} color="bg-emerald-50 text-emerald-600" delay={0.2} />
            <KpiCard icon={Wallet} label="Estimated Payable Salary" value={`₹${parseFloat(data?.employeeSalary?.estimatedPayable ?? "0").toLocaleString()}`} sub="Full salary (no attendance tracking)" color="bg-blue-50 text-blue-600" delay={0.25} />
            <KpiCard icon={FileText} label="Work Reports Today" value={data?.todayWorkReports ?? 0} sub={`${data?.monthlyWorkReports ?? 0} this month`} color="bg-cyan-50 text-cyan-600" delay={0.3} />
            <KpiCard icon={Calendar} label="Monthly Attendance" value={data?.monthlyAttendance ?? 0} color="bg-violet-50 text-violet-600" delay={0.35} />
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Attendance Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card p-5 lg:col-span-2"
          >
            <h3 className="text-base font-semibold text-gray-900 mb-4">Attendance Trend (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data?.attendanceTrend || []}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                <YAxis tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #F3F4F6", fontSize: 13 }}
                />
                <Area type="monotone" dataKey="present" stroke="#2563EB" fill="url(#colorPresent)" strokeWidth={2} />
                <Area type="monotone" dataKey="late" stroke="#F59E0B" fill="url(#colorLate)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Attendance Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card p-5"
          >
            <h3 className="text-base font-semibold text-gray-900 mb-4">Today&apos;s Attendance</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={attendancePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {attendancePieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F3F4F6", fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {attendancePieData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-xs text-gray-500">{item.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
