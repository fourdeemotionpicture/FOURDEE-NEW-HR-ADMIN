"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Receipt, Plus, Wallet, TrendingDown, X, ChevronDown, ChevronRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import { format } from "date-fns";

interface Expense {
  id: string; date: string; paidTo: string; amount: string; notes: string | null; billUrl: string | null; balanceAfter: string | null; createdByName?: string; createdAt: string;
}

interface PettyCashEntry {
  id: string; date: string; amount: string; notes: string | null; type: string; balanceAfter: string | null; createdByName?: string; createdAt: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pettyCash, setPettyCash] = useState<PettyCashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"expense" | "petty_cash">("expense");
  const [expenseForm, setExpenseForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), paidTo: "", amount: "", notes: "" });
  const [pettyCashForm, setPettyCashForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), amount: "", notes: "" });
  const [currentBalance, setCurrentBalance] = useState("0");
  const [monthlySummary, setMonthlySummary] = useState({ totalExpenses: "0", totalCashReceived: "0", openingBalance: "0", closingBalance: "0" });
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/expenses?month=${currentMonth}`);
    const data = await res.json();
    setExpenses(data.expenses || []);
    setPettyCash(data.pettyCash || []);
    setCurrentBalance(data.currentBalance || "0");
    setMonthlySummary(data.monthlySummary || { totalExpenses: "0", totalCashReceived: "0", openingBalance: "0", closingBalance: "0" });
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "expense", ...expenseForm }),
    });
    setShowModal(false);
    setExpenseForm({ date: format(new Date(), "yyyy-MM-dd"), paidTo: "", amount: "", notes: "" });
    fetchData();
  };

  const handlePettyCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "petty_cash", ...pettyCashForm }),
    });
    setShowModal(false);
    setPettyCashForm({ date: format(new Date(), "yyyy-MM-dd"), amount: "", notes: "" });
    fetchData();
  };

  // Group expenses by date
  const groupedByDate = expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const handleExport = () => {
    const headers = ["Date", "Paid To", "Amount", "Notes", "Balance After"];
    const rows = expenses.map((e) => [e.date, e.paidTo, e.amount, e.notes || "", e.balanceAfter || ""]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${currentMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Office Expenses</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage petty cash and office expenses</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="btn-secondary"><Receipt className="w-4.5 h-4.5" /> Export</button>
            <button onClick={() => { setModalType("petty_cash"); setShowModal(true); }} className="btn-secondary"><Wallet className="w-4.5 h-4.5" /> Add Cash</button>
            <button onClick={() => { setModalType("expense"); setShowModal(true); }} className="btn-primary"><Plus className="w-4.5 h-4.5" /> Add Expense</button>
          </div>
        </motion.div>

        {/* Balance Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="kpi-card">
            <p className="text-xs text-gray-500">Current Balance</p>
            <p className="text-xl font-bold text-emerald-600">₹{parseFloat(currentBalance).toLocaleString()}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-gray-500">Monthly Expenses</p>
            <p className="text-xl font-bold text-red-600">₹{parseFloat(monthlySummary.totalExpenses).toLocaleString()}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-gray-500">Cash Received</p>
            <p className="text-xl font-bold text-blue-600">₹{parseFloat(monthlySummary.totalCashReceived).toLocaleString()}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-gray-500">Transactions</p>
            <p className="text-xl font-bold text-gray-900">{expenses.length}</p>
          </div>
        </div>

        {/* Month selector */}
        <div className="card p-4">
          <input type="month" value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="input-field w-auto" />
        </div>

        {/* Petty Cash Log */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Petty Cash Log</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {pettyCash.slice(0, 20).map((entry) => (
              <div key={entry.id} className="px-5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${entry.type === "received" ? "bg-emerald-50" : "bg-red-50"}`}>
                    {entry.type === "received" ? <Wallet className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                  </div>
                  <div>
                    <p className="text-sm text-gray-900">{entry.notes || (entry.type === "received" ? "Cash Received" : "Expense")}</p>
                    <p className="text-xs text-gray-500">{entry.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${entry.type === "received" ? "text-emerald-600" : "text-red-600"}`}>
                    {entry.type === "received" ? "+" : "-"}₹{Math.abs(parseFloat(entry.amount)).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Bal: ₹{parseFloat(entry.balanceAfter ?? "0").toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses grouped by date */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Expense Entries</h3>
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : sortedDates.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No expenses this month</div>
          ) : (
            <div>
              {sortedDates.map((date) => (
                <div key={date}>
                  <button onClick={() => setExpandedDate(expandedDate === date ? null : date)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">{date}</span>
                      <span className="badge badge-neutral">{groupedByDate[date].length}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-red-600">-₹{groupedByDate[date].reduce((acc, e) => acc + parseFloat(e.amount ?? "0"), 0).toLocaleString()}</span>
                      {expandedDate === date ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {expandedDate === date && (
                    <div className="bg-gray-50/50">
                      {groupedByDate[date].map((exp) => (
                        <div key={exp.id} className="px-5 py-2.5 border-t border-gray-100 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-900">{exp.paidTo}</p>
                            {exp.notes && <p className="text-xs text-gray-500">{exp.notes}</p>}
                            {exp.createdByName && <p className="text-xs text-blue-600">By: {exp.createdByName}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-600">₹{parseFloat(exp.amount ?? "0").toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Bal: ₹{parseFloat(exp.balanceAfter ?? "0").toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expense Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">{modalType === "expense" ? "Add Expense" : "Add Petty Cash"}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4.5 h-4.5 text-gray-500" /></button>
              </div>
              {modalType === "expense" ? (
                <form onSubmit={handleExpenseSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid To</label>
                    <input type="text" value={expenseForm.paidTo} onChange={(e) => setExpenseForm({ ...expenseForm, paidTo: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                    <input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                    <input type="text" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} className="input-field" />
                  </div>
                  <button type="submit" className="btn-primary w-full justify-center">Add Expense</button>
                </form>
              ) : (
                <form onSubmit={handlePettyCashSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={pettyCashForm.date} onChange={(e) => setPettyCashForm({ ...pettyCashForm, date: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                    <input type="number" step="0.01" value={pettyCashForm.amount} onChange={(e) => setPettyCashForm({ ...pettyCashForm, amount: e.target.value })} className="input-field" placeholder="Positive for cash received" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                    <input type="text" value={pettyCashForm.notes} onChange={(e) => setPettyCashForm({ ...pettyCashForm, notes: e.target.value })} className="input-field" />
                  </div>
                  <p className="text-xs text-gray-400">Enter positive amount for cash received, negative for cash spent</p>
                  <button type="submit" className="btn-primary w-full justify-center">Add Petty Cash</button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
