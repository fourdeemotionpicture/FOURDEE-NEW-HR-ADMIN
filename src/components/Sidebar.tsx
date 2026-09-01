"use client";

import { useEffect, useState } from "react";
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
  LogOut,
  ChevronLeft,
  ChevronRight,
  Share2,
  X,
  UserCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SidebarProps {
  userRole: string;
  userName: string;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (o: boolean) => void;
}

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
  { label: "My Profile", href: "/profile", icon: UserCircle, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
  { label: "Employees", href: "/employees", icon: Users, roles: ["super_admin", "owner_admin"] },
  { label: "Attendance", href: "/attendance", icon: Clock, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
  { label: "Salary", href: "/salary", icon: IndianRupee, roles: ["super_admin", "owner_admin"] },
  { label: "Work Reports", href: "/work-reports", icon: FileText, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
  { label: "Announcements", href: "/announcements", icon: Megaphone, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
  { label: "Expenses", href: "/expenses", icon: Receipt, roles: ["super_admin", "owner_admin", "office_admin"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["super_admin", "owner_admin"] },
  { label: "Fanpage Work", href: "/fanpage-work", icon: Share2, roles: ["super_admin", "owner_admin", "office_admin", "employee"] },
];

export default function Sidebar({
  userRole,
  userName,
  collapsed,
  setCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredItems = menuItems.filter((item) => item.roles.includes(userRole));

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <motion.aside
      initial={false}
      animate={{
        width: isMobile ? 260 : (collapsed ? 72 : 260),
        x: isMobile ? (isMobileOpen ? 0 : -260) : 0,
      }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={`h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-40 shadow-sm transition-transform md:translate-x-0`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center justify-center" onClick={() => setIsMobileOpen(false)}>
          {isMobile ? (
            <img src="/logo.png" alt="Four Dee Logo" className="h-12 w-auto max-w-[180px] object-contain" />
          ) : collapsed ? (
            <img src="/logo.png" alt="Four Dee Logo" className="w-10 h-10 object-contain" />
          ) : (
            <img src="/logo.png" alt="Four Dee Logo" className="h-12 w-auto max-w-[180px] object-contain" />
          )}
        </Link>
        {isMobile && (
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <AnimatePresence>
                  {(isMobile || !collapsed) && (
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
          {(isMobile || !collapsed) && (
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
            {(isMobile || !collapsed) && (
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

      {/* Collapse toggle (Desktop only) */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-500" /> : <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />}
        </button>
      )}
    </motion.aside>
  );
}
