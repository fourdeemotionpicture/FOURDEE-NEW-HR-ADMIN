"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Plus, Trash2, X, Calendar, Clock } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format } from "date-fns";

interface Announcement {
  id: string; title: string; description: string; date: string; time: string | null; attachmentUrl: string | null; createdBy: string; createdByName?: string; createdAt: string;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userRole, setUserRole] = useState("employee");
  const [form, setForm] = useState({ title: "", description: "", date: format(new Date(), "yyyy-MM-dd"), time: "" });

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d.role) setUserRole(d.role); });
    fetch("/api/announcements").then((r) => r.json()).then((d) => { setAnnouncements(d.announcements || []); setLoading(false); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, time: form.time || null }),
    });
    setShowModal(false);
    setForm({ title: "", description: "", date: format(new Date(), "yyyy-MM-dd"), time: "" });
    const res = await fetch("/api/announcements");
    const data = await res.json();
    setAnnouncements(data.announcements || []);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
            <p className="text-sm text-gray-500 mt-0.5">Company announcements and updates</p>
          </div>
          {(userRole === "super_admin" || userRole === "owner_admin") && (
            <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4.5 h-4.5" /> New Announcement</button>
          )}
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-white animate-pulse border border-gray-100" />)}</div>
        ) : announcements.length === 0 ? (
          <div className="card p-12 text-center">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No announcements yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {announcements.map((ann, i) => (
              <motion.div key={ann.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5 card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Megaphone className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{ann.title}</h3>
                  </div>
                  {(userRole === "super_admin" || userRole === "owner_admin") && (
                    <button onClick={() => handleDelete(ann.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-3">{ann.description}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{ann.date}</div>
                  {ann.time && <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{ann.time}</div>}
                  {ann.createdByName && <span>By {ann.createdByName}</span>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Announcement Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">New Announcement</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4.5 h-4.5 text-gray-500" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field min-h-[120px] resize-y" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time (optional)</label>
                    <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="input-field" />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full justify-center">Publish Announcement</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
