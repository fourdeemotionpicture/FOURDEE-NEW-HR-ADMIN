"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  IndianRupee,
  FileText,
  Megaphone,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SidebarProps {
  userRole: string;
  userName: string;
}

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
  { label: "Employees", href: "/employees", icon: Users, roles: ["super_admin", "owner_admin"] },
  { label: "Attendance", href: "/attendance", icon: Clock, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
  { label: "Salary", href: "/salary", icon: IndianRupee, roles: ["super_admin", "owner_admin"] },
  { label: "Work Reports", href: "/work-reports", icon: FileText, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
  { label: "Announcements", href: "/announcements", icon: Megaphone, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
  { label: "Expenses", href: "/expenses", icon: Receipt, roles: ["super_admin", "owner_admin", "office_admin"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["super_admin", "owner_admin"] },
  { label: "Fanpage Work", href: "/fanpage-work", icon: Share2, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
];

export default function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const filteredItems = menuItems.filter((item) => item.roles.includes(userRole));

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-30 shadow-sm"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-center px-4 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center justify-center w-full">
          {collapsed ? (
            <img src="/logo.png" alt="Four Dee Logo" className="w-10 h-10 object-contain" />
          ) : (
            <img src="/logo.png" alt="Four Dee Logo" className="h-12 w-auto max-w-[180px] object-contain" />
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link ${isActive ? "active" : ""}`}>
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User info & Logout */}
      <div className="border-t border-gray-100 p-3">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 py-2 mb-2"
            >
              <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-500 capitalize">{userRole.replace("_", " ")}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={handleLogout} className="sidebar-link w-full text-red-500 hover:text-red-600 hover:bg-red-50">
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-500" /> : <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />}
      </button>
    </motion.aside>
  );
}
