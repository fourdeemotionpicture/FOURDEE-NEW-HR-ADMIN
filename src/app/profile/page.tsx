"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Mail, Phone, Calendar, Shield, Send, 
  CheckCircle2, AlertCircle, Sparkles, Award, Lock, Save,
  Download, FileSpreadsheet, Printer, X
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

interface AttendanceItem {
  id: string;
  date: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
  workingHours: string | null;
  lateMinutes: number | null;
  notes: string | null;
}

interface WorkReportItem {
  id: string;
  date: string;
  description: string;
  notes: string | null;
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
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [shareStatus, setShareStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Print / PDF preview modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [reportData, setReportData] = useState<{
    attendance: AttendanceItem[];
    workReports: WorkReportItem[];
  }>({ attendance: [], workReports: [] });

  const printAreaRef = useRef<HTMLDivElement>(null);

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

  const fetchMonthReportsData = async () => {
    const [attRes, wrRes] = await Promise.all([
      fetch(`/api/attendance?month=${selectedMonth}&userId=${profile?.id}`),
      fetch(`/api/work-reports?month=${selectedMonth}&userId=${profile?.id}`),
    ]);

    const attData = await attRes.json();
    const wrData = await wrRes.json();

    return {
      attendance: (attData.attendance || []) as AttendanceItem[],
      workReports: (wrData.workReports || []) as WorkReportItem[],
    };
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

  // Download Consolidated Excel (.xlsx)
  const handleDownloadExcel = async () => {
    setDownloadingReport(true);
    try {
      const XLSX = await import("xlsx");
      const { attendance: attList, workReports: wrList } = await fetchMonthReportsData();

      const wb = XLSX.utils.book_new();

      if (includeAttendance && attList.length > 0) {
        const cleanedAtt = attList.map((a) => ({
          Date: `'${a.date}`,
          Status: a.status.toUpperCase(),
          "In Time": a.inTime || "-",
          "Out Time": a.outTime || "-",
          "Working Hours": a.workingHours ? `${a.workingHours}h` : "-",
          "Late (Mins)": a.lateMinutes ?? 0,
          Notes: a.notes || "",
        }));
        const wsAtt = XLSX.utils.json_to_sheet(cleanedAtt);
        XLSX.utils.book_append_sheet(wb, wsAtt, "Attendance");
      }

      if (includeWorkReports && wrList.length > 0) {
        const cleanedWr = wrList.map((w) => ({
          Date: `'${w.date}`,
          Description: w.description,
          Notes: w.notes || "",
        }));
        const wsWr = XLSX.utils.json_to_sheet(cleanedWr);
        XLSX.utils.book_append_sheet(wb, wsWr, "Work Reports");
      }

      const fileName = `${profile?.name?.replace(/\s+/g, "_") || "Employee"}_Report_${selectedMonth}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("Excel download error:", err);
      alert("Failed to download Excel report.");
    } finally {
      setDownloadingReport(false);
    }
  };

  // Download Consolidated CSV
  const handleDownloadCSV = async () => {
    setDownloadingReport(true);
    try {
      const { attendance: attList, workReports: wrList } = await fetchMonthReportsData();
      let csvContent = `FOUR DEE MOTION PICTURE - MONTHLY PERFORMANCE REPORT\n`;
      csvContent += `Employee: "${profile?.name}", Month: "${selectedMonth}"\n\n`;

      if (includeAttendance && attList.length > 0) {
        csvContent += `--- ATTENDANCE LOGS ---\n`;
        csvContent += `Date,Status,In Time,Out Time,Working Hours,Late Mins,Notes\n`;
        attList.forEach((a) => {
          csvContent += `"'${a.date}","${a.status}","${a.inTime || "-"}","${a.outTime || "-"}","${a.workingHours || "0"}","${a.lateMinutes || 0}","${(a.notes || "").replace(/"/g, '""')}"\n`;
        });
        csvContent += `\n`;
      }

      if (includeWorkReports && wrList.length > 0) {
        csvContent += `--- WORK REPORTS ---\n`;
        csvContent += `Date,Description,Notes\n`;
        wrList.forEach((w) => {
          csvContent += `"'${w.date}","${w.description.replace(/"/g, '""')}","${(w.notes || "").replace(/"/g, '""')}"\n`;
        });
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${profile?.name?.replace(/\s+/g, "_") || "Employee"}_Report_${selectedMonth}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV download error:", err);
      alert("Failed to download CSV report.");
    } finally {
      setDownloadingReport(false);
    }
  };

  // Open PDF / Print Preview
  const handleOpenPrintPreview = async () => {
    setDownloadingReport(true);
    try {
      const fetched = await fetchMonthReportsData();
      setReportData(fetched);
      setShowPrintModal(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleTriggerPrint = () => {
    window.print();
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

  // Quick calculations for print preview
  const presentDays = reportData.attendance.filter((a) => a.status === "present").length;
  const halfDays = reportData.attendance.filter((a) => a.status === "half_day").length;
  const leavesCount = reportData.attendance.filter((a) => ["CL", "SL", "CO", "H"].includes(a.status)).length;
  const totalHours = reportData.attendance.reduce((acc, a) => acc + parseFloat(a.workingHours ?? "0"), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile & Monthly Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your personal email ID, leave quotas, and download or share your monthly reports</p>
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
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Biometric & Designation</p>
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
          
          {/* Left Column: Personal Information Form (6 cols) */}
          <div className="card p-6 lg:col-span-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                {profile?.name?.charAt(0) || "U"}
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{profile?.name}</h2>
                <p className="text-xs text-gray-500">Official Login Email: <span className="font-medium text-gray-700">{profile?.email}</span></p>
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
                      placeholder="personal@gmail.com"
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

          {/* Right Column: Monthly Report Download & Sharing Widget (6 cols) */}
          <div className="card p-6 lg:col-span-6 space-y-5 bg-gradient-to-b from-blue-50/40 via-white to-white border-blue-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-4.5 h-4.5 text-blue-600" />
                <h3 className="font-bold text-gray-900 text-sm">Download & Share Monthly Reports</h3>
              </div>
              <p className="text-xs text-gray-500">
                Download your complete Monthly Attendance & Work Report as Excel (.xlsx), CSV, or printable PDF, or email it directly.
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

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Report Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="input-field bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Recipient</label>
                  <input
                    type="email"
                    value={shareRecipient}
                    onChange={(e) => setShareRecipient(e.target.value)}
                    placeholder="personal@email.com"
                    className="input-field bg-white"
                  />
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-gray-100 space-y-2">
                <p className="text-xs font-semibold text-gray-700 mb-1">Select Included Sections:</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAttendance}
                      onChange={(e) => setIncludeAttendance(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Monthly Attendance Logs</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeWorkReports}
                      onChange={(e) => setIncludeWorkReports(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Daily Work Reports</span>
                  </label>
                </div>
              </div>

              {/* Download Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Direct Download Options</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    disabled={downloadingReport}
                    className="btn-secondary justify-center flex items-center gap-2 py-2.5 text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Download Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    disabled={downloadingReport}
                    className="btn-secondary justify-center flex items-center gap-2 py-2.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                  >
                    <Download className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Download CSV</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleOpenPrintPreview}
                    disabled={downloadingReport}
                    className="btn-secondary justify-center flex items-center gap-2 py-2.5 text-xs font-semibold hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
                  >
                    <Printer className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Print / Save as PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareMonthlyReports}
                    disabled={sendingReport}
                    className="btn-primary justify-center flex items-center gap-2 py-2.5 text-xs font-semibold shadow-sm"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    <span>{sendingReport ? "Sending..." : "Share to Email"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* PDF / Print Preview Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPrintModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 print:hidden">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-bold text-gray-900">Print / PDF Preview - {format(new Date(`${selectedMonth}-01`), "MMMM yyyy")}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleTriggerPrint} className="btn-primary flex items-center gap-1.5 py-1.5 text-xs">
                    <Printer className="w-4 h-4" /> Print / Save as PDF
                  </button>
                  <button onClick={() => setShowPrintModal(false)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div ref={printAreaRef} className="p-8 overflow-y-auto space-y-6 text-gray-800 bg-white">
                
                {/* Company Header */}
                <div className="text-center border-b-2 border-gray-200 pb-5">
                  <h1 className="text-2xl font-black tracking-wide text-blue-900">FOUR DEE MOTION PICTURE</h1>
                  <p className="text-sm font-semibold text-gray-600 mt-1 uppercase tracking-wider">Monthly Employee Performance & Activity Report</p>
                  <p className="text-xs text-gray-400 mt-0.5">Month: {format(new Date(`${selectedMonth}-01`), "MMMM yyyy")}</p>
                </div>

                {/* Employee Details Info */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                  <div>
                    <span className="text-gray-500 font-medium">Employee Name:</span>
                    <p className="font-bold text-gray-900 text-sm mt-0.5">{profile?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Designation:</span>
                    <p className="font-bold text-gray-900 text-sm mt-0.5 capitalize">{profile?.designation || profile?.role}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Email / Personal:</span>
                    <p className="font-bold text-gray-900 text-sm mt-0.5">{profile?.personalEmail || profile?.email}</p>
                  </div>
                </div>

                {/* Summary KPIs */}
                {includeAttendance && (
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Present Days</p>
                      <p className="text-xl font-bold text-emerald-800 mt-1">{presentDays}</p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-[10px] font-bold text-amber-700 uppercase">Half Days</p>
                      <p className="text-xl font-bold text-amber-800 mt-1">{halfDays}</p>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                      <p className="text-[10px] font-bold text-purple-700 uppercase">Leaves (CL/SL/CO)</p>
                      <p className="text-xl font-bold text-purple-800 mt-1">{leavesCount}</p>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-[10px] font-bold text-blue-700 uppercase">Total Hours</p>
                      <p className="text-xl font-bold text-blue-800 mt-1">{totalHours.toFixed(1)}h</p>
                    </div>
                  </div>
                )}

                {/* Attendance Table */}
                {includeAttendance && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-200 pb-1">📅 Attendance Log Details</h3>
                    <table className="w-full text-left text-xs border border-gray-200 border-collapse">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                          <th className="p-2 border-r border-gray-200">Date</th>
                          <th className="p-2 border-r border-gray-200">Status</th>
                          <th className="p-2 border-r border-gray-200">In Time</th>
                          <th className="p-2 border-r border-gray-200">Out Time</th>
                          <th className="p-2 border-r border-gray-200">Hours</th>
                          <th className="p-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.attendance.length === 0 ? (
                          <tr><td colSpan={6} className="p-4 text-center text-gray-400">No attendance entries found for this month</td></tr>
                        ) : (
                          reportData.attendance.map((a) => (
                            <tr key={a.id} className="border-b border-gray-100">
                              <td className="p-2 border-r border-gray-100 font-medium">{a.date}</td>
                              <td className="p-2 border-r border-gray-100 font-bold uppercase">{a.status}</td>
                              <td className="p-2 border-r border-gray-100 text-gray-600">{a.inTime || "-"}</td>
                              <td className="p-2 border-r border-gray-100 text-gray-600">{a.outTime || "-"}</td>
                              <td className="p-2 border-r border-gray-100 text-gray-600">{a.workingHours ? `${a.workingHours}h` : "-"}</td>
                              <td className="p-2 text-gray-500">{a.notes || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Work Reports Section */}
                {includeWorkReports && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-200 pb-1">📝 Daily Work Reports ({reportData.workReports.length} Submitted)</h3>
                    {reportData.workReports.length === 0 ? (
                      <p className="text-xs text-gray-400 p-3 bg-gray-50 rounded-lg text-center">No daily work reports logged for this period.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {reportData.workReports.map((w) => (
                          <div key={w.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                            <p className="font-bold text-blue-700 mb-1">Date: {w.date}</p>
                            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{w.description}</p>
                            {w.notes && <p className="text-gray-500 italic mt-1 font-medium">Notes: {w.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="text-center pt-6 border-t border-gray-200 text-[11px] text-gray-400">
                  <p>© Four Dee Motion Picture. ERP Generated Report.</p>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
