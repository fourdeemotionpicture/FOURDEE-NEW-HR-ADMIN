"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          setUser({ name: data.name, role: data.role });
        } else {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar
        userRole={user.role}
        userName={user.name}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Mobile Header (Only visible on mobile screens) */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-30 md:hidden shadow-sm">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-700"
          title="Open Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <img src="/logo.png" alt="Four Dee Logo" className="h-10 w-auto object-contain" />
        <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-200 min-h-screen ${
          collapsed ? "md:ml-[72px]" : "md:ml-[260px]"
        } ml-0 pt-16 md:pt-0`}
      >
        <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
