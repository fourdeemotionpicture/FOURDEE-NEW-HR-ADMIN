"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Plus, Calendar, X, ExternalLink, Trash2, Search, Filter, FileText } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import * as XLSX from "xlsx";

interface FanpageWorkRecord {
  id: string;
  userId: string;
  platform: string;
  pageHandle: string;
  date: string;
  workDescription: string;
  postLink: string | null;
  userName?: string;
  createdAt: string;
}

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
  </svg>
);

const YoutubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

const PRESETS = {
  Instagram: [
    { handle: "@team_simran", link: "https://www.instagram.com/team_simran__/" },
    { handle: "@simran_nation_", link: "http://instagram.com/simran_nation_/" },
    { handle: "@SimranFansHQ", link: "https://www.instagram.com/simranfans_hq/?hl=en" }
  ],
  X: [
    { handle: "@team_simran", link: "https://x.com/team_simran" },
    { handle: "@simran_nation", link: "https://x.com/simran_nation" },
    { handle: "@SimranFansHQ", link: "https://x.com/SimranFansHQ" }
  ],
  YouTube: [
    { handle: "@SimranFansHQ", link: "https://www.youtube.com/@SimranFansHQ" }
  ]
};

export default function FanpageWorkPage() {
  const [records, setRecords] = useState<FanpageWorkRecord[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("employee");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    platform: "Instagram",
    pageHandle: "@team_simran",
    customHandle: "",
    date: format(new Date(), "yyyy-MM-dd"),
    workDescription: "",
    postLink: ""
  });

  const isManager = userRole === "super_admin" || userRole === "owner_admin";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const targetUserId = selectedEmployeeId || "";
    const dateParam = selectedDate || format(new Date(), "yyyy-MM-dd");
    const url = `/api/fanpage-work?date=${dateParam}&userId=${targetUserId}`;
    const res = await fetch(url);
    const data = await res.json();
    setRecords(data.fanpageWork || []);
    setLoading(false);
  }, [selectedDate, selectedEmployeeId]);

  const exportToExcel = async () => {
    setLoading(true);
    const targetUserId = selectedEmployeeId || "";
    const res = await fetch(`/api/fanpage-work?month=${currentMonth}&userId=${targetUserId}`);
    const data = await res.json();
    setLoading(false);
    
    const monthRecords: FanpageWorkRecord[] = data.fanpageWork || [];
    if (monthRecords.length === 0) {
      alert("No logs to export for this month");
      return;
    }
    
    const exportData = monthRecords.map((r) => ({
      "Date": r.date,
      "Employee Name": r.userName || "Unknown",
      "Platform": r.platform,
      "Page Handle": r.pageHandle,
      "Work Done": r.workDescription,
      "Post Link": r.postLink || "N/A"
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fanpage Work Logs");
    
    worksheet["!cols"] = [
      { wch: 12 }, // Date
      { wch: 20 }, // Employee Name
      { wch: 12 }, // Platform
      { wch: 20 }, // Page Handle
      { wch: 50 }, // Work Done
      { wch: 40 }  // Post Link
    ];

    const fileName = `Fanpage_Work_Logs_${currentMonth}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.role) {
          setUserRole(d.role);
          setCurrentUser(d);
          if (d.role === "employee" || d.role === "office_admin") {
            setSelectedEmployeeId(d.id);
          }
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
    const targetHandle = form.pageHandle === "custom" ? form.customHandle : form.pageHandle;
    if (!targetHandle) {
      alert("Please enter or select a page handle");
      return;
    }

    const body = {
      platform: form.platform,
      pageHandle: targetHandle,
      date: form.date,
      workDescription: form.workDescription,
      postLink: form.postLink,
      userId: isManager && form.userId ? form.userId : selectedEmployeeId || currentUser?.id
    };

    try {
      const res = await fetch("/api/fanpage-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to save work log");
        return;
      }
      setShowModal(false);
      setForm({
        userId: "",
        platform: "Instagram",
        pageHandle: "@team_simran",
        customHandle: "",
        date: format(new Date(), "yyyy-MM-dd"),
        workDescription: "",
        postLink: ""
      });
      fetchData();
    } catch {
      alert("Network error. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this work log?")) return;
    try {
      const res = await fetch(`/api/fanpage-work?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete log");
      }
    } catch {
      alert("Error deleting record");
    }
  };

  const openWithPreset = (platform: "Instagram" | "X" | "YouTube", handle: string) => {
    setForm({
      ...form,
      platform,
      pageHandle: handle,
      customHandle: ""
    });
    setShowModal(true);
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(search.toLowerCase()) && emp.id !== currentUser?.id
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Share2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 animate-pulse" /> Fanpage Work Logs
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Track social media page postings and task entries</p>
          </div>
          <button
            onClick={() => {
              setShowModal(true);
              setForm({
                userId: selectedEmployeeId || currentUser?.id || "",
                platform: "Instagram",
                pageHandle: "@team_simran",
                customHandle: "",
                date: format(new Date(), "yyyy-MM-dd"),
                workDescription: "",
                postLink: ""
              });
            }}
            className="btn-primary w-full sm:w-auto justify-center text-xs sm:text-sm"
          >
            <Plus className="w-4.5 h-4.5" /> Log Fanpage Work
          </button>
        </motion.div>

        {/* Preset Fanpages Display Header Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 space-y-3 border-t-4 border-pink-500">
            <h3 className="font-semibold text-pink-600 text-sm flex items-center gap-1.5"><InstagramIcon className="w-4.5 h-4.5" /> Instagram Channels</h3>
            <div className="space-y-2">
              {PRESETS.Instagram.map((p) => (
                <div key={p.handle} className="flex items-center justify-between p-2 rounded-xl hover:bg-pink-50/50 border border-gray-50 transition-all text-xs">
                  <span className="font-medium text-gray-700">{p.handle}</span>
                  <div className="flex gap-2">
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-blue-600 text-gray-400" title="Visit Page"><ExternalLink className="w-3.5 h-3.5" /></a>
                    <button onClick={() => openWithPreset("Instagram", p.handle)} className="text-[10px] font-semibold bg-pink-100 hover:bg-pink-200 text-pink-700 px-2 py-0.5 rounded-lg">Quick Log</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 space-y-3 border-t-4 border-slate-900">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5"><TwitterIcon className="w-4.5 h-4.5" /> X (Twitter) Channels</h3>
            <div className="space-y-2">
              {PRESETS.X.map((p) => (
                <div key={p.handle} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-gray-50 transition-all text-xs">
                  <span className="font-medium text-gray-700">{p.handle}</span>
                  <div className="flex gap-2">
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-blue-600 text-gray-400" title="Visit Page"><ExternalLink className="w-3.5 h-3.5" /></a>
                    <button onClick={() => openWithPreset("X", p.handle)} className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-0.5 rounded-lg">Quick Log</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 space-y-3 border-t-4 border-red-600">
            <h3 className="font-semibold text-red-600 text-sm flex items-center gap-1.5"><YoutubeIcon className="w-4.5 h-4.5" /> YouTube Channels</h3>
            <div className="space-y-2">
              {PRESETS.YouTube.map((p) => (
                <div key={p.handle} className="flex items-center justify-between p-2 rounded-xl hover:bg-red-50/50 border border-gray-50 transition-all text-xs">
                  <span className="font-medium text-gray-700">{p.handle}</span>
                  <div className="flex gap-2">
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-blue-600 text-gray-400" title="Visit Page"><ExternalLink className="w-3.5 h-3.5" /></a>
                    <button onClick={() => openWithPreset("YouTube", p.handle)} className="text-[10px] font-semibold bg-red-100 hover:bg-red-200 text-red-700 px-2 py-0.5 rounded-lg">Quick Log</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Master-Detail Layout Panel */}
        <div className={`grid ${isManager ? "grid-cols-1 lg:grid-cols-4 gap-6" : "grid-cols-1"}`}>
          
          {/* Master Sidebar (For Admins) */}
          {isManager && (
            <div className="card p-4 space-y-4 lg:col-span-1 h-60 lg:h-[calc(100vh-340px)] flex flex-col">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Employees</h3>
                <p className="text-xs text-gray-400 mt-0.5">Filter page works by member</p>
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
                  onClick={() => setSelectedEmployeeId("")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between ${
                    selectedEmployeeId === ""
                      ? "bg-blue-50 text-blue-700 font-medium border border-blue-100"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="text-sm">All Employees Logs</span>
                </button>
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

          {/* Details Feed */}
          <div className={`${isManager ? "lg:col-span-3" : ""} space-y-4 overflow-y-auto h-auto lg:h-[calc(100vh-340px)] pr-2`}>
            
            {/* Filter Bar */}
            <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800">Select Date to View</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value || format(new Date(), "yyyy-MM-dd"));
                    }}
                    className="input-field py-1 px-3 text-sm w-auto"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border-r border-gray-100 pr-4">
                  <span className="text-xs font-semibold text-gray-600">Export Month</span>
                  <input
                    type="month"
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(e.target.value)}
                    className="input-field py-1 px-2 text-xs w-auto"
                  />
                  <button
                    onClick={exportToExcel}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" /> Export Excel
                  </button>
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {records.length} {records.length === 1 ? "Post" : "Posts"} on this Date
                </div>
              </div>
            </div>

            {/* Logs Timeline List */}
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading work logs...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-12 text-gray-400 card">No fanpage work logs submitted for this selection/month.</div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const grouped: Record<string, FanpageWorkRecord[]> = {};
                  records.forEach((rec) => {
                    if (!grouped[rec.date]) {
                      grouped[rec.date] = [];
                    }
                    grouped[rec.date].push(rec);
                  });

                  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

                  return sortedDates.map((dateStr) => (
                    <div key={dateStr} className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-gray-200/60 pb-1.5 pt-1">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold text-gray-800">
                          {format(parse(dateStr, "yyyy-MM-dd", new Date()), "EEEE, MMMM dd, yyyy")}
                        </span>
                        <span className="text-[10px] text-gray-500 bg-gray-100/80 px-2 py-0.5 rounded-full border border-gray-200/50 font-medium">
                          {grouped[dateStr].length} {grouped[dateStr].length === 1 ? "entry" : "entries"}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {grouped[dateStr].map((rec) => (
                          <motion.div
                            key={rec.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="card p-5 hover:shadow-md transition-shadow relative overflow-hidden"
                          >
                            {/* Platform Accent Color Bar */}
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${
                              rec.platform === "Instagram" ? "bg-gradient-to-b from-pink-500 to-purple-600" :
                              rec.platform === "X" ? "bg-slate-900" : "bg-red-600"
                            }`} />
                            
                            <div className="flex justify-between items-start pl-2">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    rec.platform === "Instagram" ? "bg-pink-50 text-pink-700 border border-pink-100" :
                                    rec.platform === "X" ? "bg-slate-50 text-slate-700 border border-slate-200" :
                                    "bg-red-50 text-red-700 border border-red-100"
                                  }`}>{rec.platform}</span>
                                  <span className="text-sm font-semibold text-blue-600">{rec.pageHandle}</span>
                                </div>
                                
                                <p className="text-sm text-gray-700 pt-2 whitespace-pre-line">{rec.workDescription}</p>
                                
                                {rec.postLink && (
                                  <div className="pt-2">
                                    <a
                                      href={rec.postLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline bg-blue-50/50 px-2.5 py-1 rounded-lg border border-blue-50"
                                    >
                                      View Published Post <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-2 text-right">
                                {isManager && (
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">By: {rec.userName}</span>
                                )}
                                {(isManager || currentUser?.id === rec.userId) && (
                                  <button
                                    onClick={() => handleDelete(rec.id)}
                                    className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Delete Log"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fanpage Work Log Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Log Fanpage Work</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4.5 h-4.5 text-gray-500" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isManager && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Log On Behalf Of</label>
                    <select 
                      value={form.userId} 
                      onChange={(e) => setForm({ ...form, userId: e.target.value })} 
                      className="input-field"
                    >
                      <option value="">Self ({currentUser?.name})</option>
                      {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                    <select
                      value={form.platform}
                      onChange={(e) => {
                        const newPlatform = e.target.value as "Instagram" | "X" | "YouTube";
                        setForm({
                          ...form,
                          platform: newPlatform,
                          pageHandle: PRESETS[newPlatform][0]?.handle || "custom"
                        });
                      }}
                      className="input-field"
                    >
                      <option value="Instagram">Instagram</option>
                      <option value="X">X (Twitter)</option>
                      <option value="YouTube">YouTube</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Page Handle</label>
                  <select
                    value={form.pageHandle}
                    onChange={(e) => setForm({ ...form, pageHandle: e.target.value })}
                    className="input-field"
                  >
                    {PRESETS[form.platform as keyof typeof PRESETS]?.map((p) => (
                      <option key={p.handle} value={p.handle}>{p.handle}</option>
                    ))}
                    <option value="custom">Other (Custom Handle)</option>
                  </select>
                </div>

                {form.pageHandle === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom Handle Name</label>
                    <input
                      type="text"
                      placeholder="e.g. @Simran_FC"
                      value={form.customHandle}
                      onChange={(e) => setForm({ ...form, customHandle: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Description / Details</label>
                  <textarea
                    placeholder="Describe what work was done (e.g. Created reels, posted edit, wrote video captions, etc.)"
                    value={form.workDescription}
                    onChange={(e) => setForm({ ...form, workDescription: e.target.value })}
                    className="input-field h-24 resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Post Link (optional)</label>
                  <input
                    type="url"
                    placeholder="https://instagram.com/p/..."
                    value={form.postLink}
                    onChange={(e) => setForm({ ...form, postLink: e.target.value })}
                    className="input-field"
                  />
                </div>

                <button type="submit" className="btn-primary w-full justify-center">Submit Log</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
