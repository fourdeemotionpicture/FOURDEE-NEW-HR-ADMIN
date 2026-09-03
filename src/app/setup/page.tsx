"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(true);
  const [form, setForm] = useState({
    name: "Sujith Thangavel",
    email: "sujith@fourdee.com",
    password: "",
    designation: "Media Manager - Digital Marketing & Branding",
  });

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => {
        if (!r.ok) {
          return r.json().then((d) => {
            throw new Error(d.error || "Failed to check setup status");
          });
        }
        return r.json();
      })
      .then((d) => {
        if (d.setupRequired === false) {
          router.push("/login");
        }
        setNeedsSetup(d.setupRequired);
      })
      .catch((err) => {
        setError(err.message || "Database connection error");
        setNeedsSetup(true);
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Setup failed");
        return;
      }

      router.push("/login");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!needsSetup) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md mx-4 animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/25 mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Initial Setup</h1>
          <p className="text-sm text-gray-500 mt-1">Create the Super Admin account to get started</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" placeholder="Choose a secure password" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Designation</label>
              <input type="text" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="input-field" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center h-12 text-[15px]">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Super Admin <ArrowRight className="w-4.5 h-4.5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Four Dee Motion Pictures Private Limited ERP · First-time setup only
        </p>
      </div>
    </div>
  );
}
