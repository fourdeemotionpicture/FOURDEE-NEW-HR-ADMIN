"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Search, Edit2, Trash2, X, Shield, User, Briefcase, Building2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format } from "date-fns";

interface Employee {
  id: string; 
  name: string; 
  email: string; 
  personalEmail?: string | null;
  phone?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  role: string; 
  designation: string; 
  monthlySalary: string; 
  dob?: string; 
  biometricId?: number | null; 
  isActive: boolean;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    personalEmail: "",
    phone: "",
    accountNumber: "",
    ifscCode: "",
    password: "", 
    role: "employee", 
    designation: "", 
    monthlySalary: "", 
    dob: "", 
    biometricId: "" 
  });

  const fetchEmployees = async () => {
    const res = await fetch(`/api/employees?search=${search}`);
    const data = await res.json();
    setEmployees(data.employees || []);
    setLoading(false);
  };

  const [userRole, setUserRole] = useState("");

  useEffect(() => { fetchEmployees(); }, [search]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserRole(d.role))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, ...form }),
      });
    } else {
      await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowModal(false);
    setEditId(null);
    setForm({ 
      name: "", 
      email: "", 
      personalEmail: "", 
      phone: "", 
      accountNumber: "", 
      ifscCode: "", 
      password: "", 
      role: "employee", 
      designation: "", 
      monthlySalary: "", 
      dob: "", 
      biometricId: "" 
    });
    fetchEmployees();
  };

  const handleEdit = (emp: Employee) => {
    setEditId(emp.id);
    setForm({ 
      name: emp.name, 
      email: emp.email, 
      personalEmail: emp.personalEmail || "",
      phone: emp.phone || "",
      accountNumber: emp.accountNumber || "",
      ifscCode: emp.ifscCode || "",
      password: "", 
      role: emp.role, 
      designation: emp.designation || "", 
      monthlySalary: emp.monthlySalary || "", 
      dob: emp.dob || "", 
      biometricId: emp.biometricId ? String(emp.biometricId) : "" 
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this employee?")) return;
    await fetch(`/api/employees?id=${id}`, { method: "DELETE" });
    fetchEmployees();
  };

  const roleBadge = (role: string) => {
    const map: Record<string, string> = { super_admin: "badge-danger", owner_admin: "badge-success", office_admin: "badge-warning", employee: "badge-info" };
    return map[role] || "badge-neutral";
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage team members, roles & bank details</p>
          </div>
          {userRole !== "owner_admin" && (
            <button onClick={() => { 
              setShowModal(true); 
              setEditId(null); 
              setForm({ 
                name: "", 
                email: "", 
                personalEmail: "", 
                phone: "", 
                accountNumber: "", 
                ifscCode: "", 
                password: "", 
                role: "employee", 
                designation: "", 
                monthlySalary: "", 
                dob: "", 
                biometricId: "" 
              }); 
            }} className="btn-primary">
              <UserPlus className="w-4.5 h-4.5" /> Add Employee
            </button>
          )}
        </motion.div>

        <div className="card p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search employees by name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
        </div>

        {/* Mobile View: Cards */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No employees found</div>
          ) : employees.map((emp) => (
            <div key={emp.id} className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-600">{emp.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.email}</p>
                  </div>
                </div>
                <span className={`badge ${roleBadge(emp.role)}`}>{emp.role.replace("_", " ")}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                <div><span className="text-gray-400">Designation:</span> {emp.designation || "-"}</div>
                <div><span className="text-gray-400">Salary:</span> ₹{parseFloat(emp.monthlySalary || "0").toLocaleString()}</div>
                <div><span className="text-gray-400">Phone:</span> {emp.phone || "-"}</div>
                <div><span className="text-gray-400">Bank A/C:</span> {emp.accountNumber || "-"}</div>
                <div><span className="text-gray-400">Bio ID:</span> {emp.biometricId || "-"}</div>
                <div><span className="text-gray-400">DOB:</span> {emp.dob ? format(new Date(emp.dob), "MMM dd, yyyy") : "-"}</div>
              </div>
              {userRole !== "owner_admin" && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => handleEdit(emp)} className="btn-secondary text-xs py-1.5 px-3"><Edit2 className="w-3.5 h-3.5 mr-1" /> Edit</button>
                  <button onClick={() => handleDelete(emp.id)} className="btn-danger text-xs py-1.5 px-3"><Trash2 className="w-3.5 h-3.5 mr-1" /> Deactivate</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop View: Table */}
        <div className="card overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Login Email</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">Bank A/C & IFSC</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Designation</th>
                  <th className="px-5 py-3.5">Monthly Salary</th>
                  <th className="px-5 py-3.5">Bio ID</th>
                  <th className="px-5 py-3.5">Status</th>
                  {userRole !== "owner_admin" && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">No employees found</td></tr>
                ) : employees.map((emp) => (
                  <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                          <span className="text-xs font-semibold text-blue-600">{emp.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                          {emp.personalEmail && <p className="text-[11px] text-gray-400 truncate">{emp.personalEmail}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{emp.email}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{emp.phone || "-"}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-700">
                      {emp.accountNumber ? (
                        <div>
                          <span className="font-mono font-medium">{emp.accountNumber}</span>
                          <span className="text-[10px] text-gray-400 block">{emp.ifscCode}</span>
                        </div>
                      ) : "-"}
                    </td>
                    <td className="px-5 py-3.5"><span className={`badge ${roleBadge(emp.role)}`}>{emp.role.replace("_", " ")}</span></td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{emp.designation || "-"}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">₹{parseFloat(emp.monthlySalary || "0").toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-sm font-mono text-blue-600 font-bold">{emp.biometricId ? `#${emp.biometricId}` : "-"}</td>
                    <td className="px-5 py-3.5"><span className={`badge ${emp.isActive ? "badge-success" : "badge-danger"}`}>{emp.isActive ? "Active" : "Inactive"}</span></td>
                    {userRole !== "owner_admin" && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEdit(emp)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(emp.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-6 w-full max-w-lg mx-4 my-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{editId ? "Edit Employee Details" : "Add New Employee"}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4.5 h-4.5 text-gray-500" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Login Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Personal Email</label>
                    <input type="email" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} className="input-field" placeholder="personal@gmail.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="e.g. 9876543210" />
                  </div>
                </div>

                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-700" />
                    Bank Transfer Account Details
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Bank Account Number</label>
                      <input type="text" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} className="input-field font-mono text-xs" placeholder="e.g. 50100466411981" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">IFSC Code</label>
                      <input type="text" value={form.ifscCode} onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} className="input-field font-mono text-xs uppercase" placeholder="e.g. HDFC0000847" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Role</label>
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-field text-xs">
                      <option value="employee">Employee</option>
                      <option value="office_admin">Office Admin</option>
                      <option value="owner_admin">Owner Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Designation</label>
                    <input type="text" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Monthly Salary (₹)</label>
                    <input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Birth</label>
                    <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Biometric ID (PIN)</label>
                    <input type="number" value={form.biometricId} onChange={(e) => setForm({ ...form, biometricId: e.target.value })} className="input-field font-mono" placeholder="e.g. 5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Password {editId && "(leave blank to keep current)"}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" required={!editId} placeholder={editId ? "••••••••" : "Set password"} />
                </div>

                <button type="submit" className="btn-primary w-full justify-center">{editId ? "Update Employee Details" : "Save Employee"}</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
