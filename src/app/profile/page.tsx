"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  User, Mail, Phone, Calendar, Shield, Clock, Send, 
  CheckCircle2, AlertCircle, Sparkles, Award, Lock, Save
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, subMonths } from "date-fns";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  personalEmail: string | null;
  phone: string | null;
  role: string;
  designation: string | null;
  monthlySalary: string | null;
  dob: string | null;
  biometricId: number | null;
  isActive: boolean;
}

interface LeaveBalance {
  accrued: number;
  used: number;
  available: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [clBalance, setClBalance] = useState<LeaveBalance>({ accrued: 0, used: 0, available: 0 });
  const [coBalance, setCoBalance] = useState<LeaveBalance>({ accrued: 0, used: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Edit form state
  const [formData, setFormData] = useState({
    name: "",
    personalEmail: "",
    phone: "",
    dob: "",
    password: "",
  });

  // Report sharing state
  const [selectedMonth, setSelectedMonth] = useState(format(subMonths(new Date(), 1), "yyyy-MM"));
  const [shareRecipient, setShareRecipient] = useState("");
  const [includeAttendance, setIncludeAttendance] = useState(true);
  const [includeWorkReports, setIncludeWorkReports] = useState(true);
  const [sendingReport, setSendingReport] = useState(false);
  const [shareStatus, setShareStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (res.ok && data.user) {
        setProfile(data.user);
        setFormData({
          name: data.user.name || "",
          personalEmail: data.user.personalEmail || "",
          phone: data.user.phone || "",
          dob: data.user.dob || "",
          password: "",
        });
        setShareRecipient(data.user.personalEmail || data.user.email || "");
        if (data.clBalance) setClBalance(data.clBalance);
        if (data.coBalance) setCoBalance(data.coBalance);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
        fetchProfile();
      } else {
        setErrorMsg(data.error || "Failed to update profile");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleShareMonthlyReports = async () => {
    if (!shareRecipient) {
      alert("Please enter a valid recipient email address.");
      return;
    }
    if (!includeAttendance && !includeWorkReports) {
      alert("Please select at least one report to share (Attendance or Work Reports).");
      return;
    }

    setSendingReport(true);
    setShareStatus(null);

    try {
      const res = await fetch("/api/profile/share-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          recipientEmail: shareRecipient,
          includeAttendance,
          includeWorkReports,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShareStatus({ success: true, message: data.message || `Reports sent successfully to ${shareRecipient}!` });
      } else {
        setShareStatus({ success: false, message: data.error || "Failed to share report" });
      }
    } catch {
      setShareStatus({ success: false, message: "Network connection error. Please try again." });
    } finally {
      setSendingReport(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-96 bg-white rounded-2xl border border-gray-100 animate-pulse md:col-span-2" />
            <div className="h-96 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile & Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your personal email, information, and share monthly reports</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-success flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Account
            </span>
          </div>
        </motion.div>

        {/* Quotas & Balances Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* CL Card */}
          <div className="card p-5 border-l-4 border-purple-500 bg-gradient-to-br from-purple-50/40 via-white to-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Casual Leave (CL)</p>
                <h3 className="text-2xl font-bold text-purple-900 mt-1">{clBalance.available} CL left</h3>
                <p className="text-xs text-gray-500 mt-1">Accrued: {clBalance.accrued} days | Used: {clBalance.used} days</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Comp Off (CO) Card */}
          <div className="card p-5 border-l-4 border-indigo-500 bg-gradient-to-br from-indigo-50/40 via-white to-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Comp Off Balance (CO)</p>
                <h3 className="text-2xl font-bold text-indigo-900 mt-1">{coBalance.available} CO available</h3>
                <p className="text-xs text-gray-500 mt-1">Earned on Holidays/Sundays: {coBalance.accrued} | Used: {coBalance.used}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Biometric ID Card */}
          <div className="card p-5 border-l-4 border-blue-500 bg-gradient-to-br from-blue-50/40 via-white to-white sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Biometric & Role</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">ID: #{profile?.biometricId || "Not assigned"}</h3>
                <p className="text-xs text-gray-500 mt-1 capitalize">{profile?.designation || profile?.role?.replace("_", " ")}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <Shield className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid: Profile Settings & Monthly Report Sharing */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Personal Information Form (7 cols) */}
          <div className="card p-6 lg:col-span-7 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                {profile?.name?.charAt(0) || "U"}
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{profile?.name}</h2>
                <p className="text-xs text-gray-500">Official Email: <span className="font-medium text-gray-700">{profile?.email}</span></p>
              </div>
            </div>

            {saveSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Your profile changes have been saved successfully!</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Personal Email ID <span className="text-blue-600 font-normal">(For reports & payslips)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-blue-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="e.g. personal@gmail.com"
                      value={formData.personalEmail}
                      onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                      className="input-field pl-10 border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+91 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      className="input-field pl-10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Change Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    placeholder="Enter new password (min. 6 characters)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full justify-center flex items-center gap-2 mt-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving Changes..." : "Save Profile Details"}
              </button>
            </form>
          </div>

          {/* Right Column: Monthly Report Sharing Widget (5 cols) */}
          <div className="card p-6 lg:col-span-5 space-y-5 bg-gradient-to-b from-blue-50/30 to-white border-blue-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Send className="w-4.5 h-4.5 text-blue-600" />
                <h3 className="font-bold text-gray-900 text-sm">Share Monthly Reports</h3>
              </div>
              <p className="text-xs text-gray-500">
                Package and email your complete Monthly Attendance & Work Report directly to your personal email.
              </p>
            </div>

            {shareStatus && (
              <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                shareStatus.success ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-red-50 text-red-800 border border-red-100"
              }`}>
                {shareStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                <span>{shareStatus.message}</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input-field bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Recipient Email Address</label>
                <input
                  type="email"
                  value={shareRecipient}
                  onChange={(e) => setShareRecipient(e.target.value)}
                  placeholder="personal@email.com"
                  className="input-field bg-white"
                />
                <p className="text-[11px] text-gray-400 mt-1">Defaulted to your saved personal email address.</p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-gray-100 space-y-2">
                <p className="text-xs font-semibold text-gray-700 mb-1">Included in Package:</p>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAttendance}
                    onChange={(e) => setIncludeAttendance(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Monthly Attendance Logs (In/Out, Hours, Status)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWorkReports}
                    onChange={(e) => setIncludeWorkReports(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Daily Work Report Submissions & Details</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleShareMonthlyReports}
                disabled={sendingReport}
                className="btn-primary w-full justify-center flex items-center gap-2 py-3 text-sm shadow-sm"
              >
                <Send className="w-4 h-4" />
                {sendingReport ? "Generating & Sending..." : "Send Monthly Report to Email"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
