import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { db } from "@/db";
import { expenses, pettyCash, users } from "@/db/schema";
import { eq, gte, lte, desc, sql } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, parse } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only super_admin and office_admin can view expenses
    if (!hasPermission(currentUser.role, "expenses")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || format(new Date(), "yyyy-MM");
    const date = searchParams.get("date") || "";

    // Get all petty cash entries
    const allPettyCash = await db.select().from(pettyCash).orderBy(desc(pettyCash.createdAt));

    // Get all expense entries
    let allExpenses = await db.select().from(expenses).orderBy(desc(expenses.createdAt));

    // Filter by date range
    if (date) {
      allExpenses = allExpenses.filter((e) => e.date === date);
    } else if (month) {
      try {
        const startDate = format(startOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
        const endDate = format(endOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
        allExpenses = allExpenses.filter((e) => e.date >= startDate && e.date <= endDate);
      } catch {
        // Return all if month parse fails
      }
    }

    // Current balance
    const lastEntry = allPettyCash.length > 0 ? allPettyCash[0] : null;
    const currentBalance = lastEntry ? (lastEntry.balanceAfter ?? "0") : "0";

    // Enrich with user names
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));
    const enrichedExpenses = allExpenses.map((e) => ({ ...e, createdByName: userMap[e.createdBy] || "Unknown" }));
    const enrichedPettyCash = allPettyCash.map((p) => ({ ...p, createdByName: userMap[p.createdBy] || "Unknown" }));

    // Monthly summary
    const monthStart = format(startOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
    const monthlyExpenses = allExpenses.filter((e) => e.date >= monthStart && e.date <= monthEnd);
    const totalMonthlyExpenses = monthlyExpenses.reduce((acc, e) => acc + parseFloat(e.amount ?? "0"), 0);
    const monthlyCashReceived = allPettyCash
      .filter((p) => p.date >= monthStart && p.date <= monthEnd && p.type === "received")
      .reduce((acc, p) => acc + parseFloat(p.amount ?? "0"), 0);

    return NextResponse.json({
      expenses: enrichedExpenses,
      pettyCash: enrichedPettyCash,
      currentBalance,
      monthlySummary: {
        totalExpenses: totalMonthlyExpenses.toFixed(2),
        totalCashReceived: monthlyCashReceived.toFixed(2),
        openingBalance: "0", // Could calculate from previous month
        closingBalance: currentBalance,
      },
    });
  } catch (error) {
    console.error("Expenses GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "super_admin" && currentUser.role !== "office_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { type } = body; // "expense" or "petty_cash"

    if (type === "petty_cash") {
      const { date, amount, notes } = body;
      if (!date || !amount) {
        return NextResponse.json({ error: "Date and amount are required" }, { status: 400 });
      }

      // Calculate new balance
      const lastEntry = await db.select().from(pettyCash).orderBy(desc(pettyCash.createdAt)).limit(1);
      const currentBalance = lastEntry.length > 0 ? parseFloat(lastEntry[0].balanceAfter ?? "0") : 0;
      const newBalance = currentBalance + parseFloat(amount);

      const [record] = await db.insert(pettyCash).values({
        date,
        amount: parseFloat(amount).toFixed(2),
        notes: notes || null,
        type: parseFloat(amount) > 0 ? "received" : "expense",
        balanceAfter: newBalance.toFixed(2),
        createdBy: currentUser.userId,
      }).returning();

      return NextResponse.json({ pettyCash: record });
    }

    // Regular expense
    const { date, paidTo, amount, notes, billUrl } = body;
    if (!date || !paidTo || !amount) {
      return NextResponse.json({ error: "Date, paid to, and amount are required" }, { status: 400 });
    }

    // Calculate balance after expense
    const lastPettyCash = await db.select().from(pettyCash).orderBy(desc(pettyCash.createdAt)).limit(1);
    const currentBalance = lastPettyCash.length > 0 ? parseFloat(lastPettyCash[0].balanceAfter ?? "0") : 0;
    const newBalance = currentBalance - parseFloat(amount);

    // Update petty cash balance
    await db.insert(pettyCash).values({
      date,
      amount: (-parseFloat(amount)).toFixed(2),
      notes: `Expense: ${paidTo}`,
      type: "expense",
      balanceAfter: newBalance.toFixed(2),
      createdBy: currentUser.userId,
    });

    const [record] = await db.insert(expenses).values({
      date,
      paidTo,
      amount: parseFloat(amount).toFixed(2),
      notes: notes || null,
      billUrl: billUrl || null,
      balanceAfter: newBalance.toFixed(2),
      createdBy: currentUser.userId,
    }).returning();

    return NextResponse.json({ expense: record });
  } catch (error) {
    console.error("Expenses POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "super_admin" && currentUser.role !== "office_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
    }

    await db.delete(expenses).where(eq(expenses.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Expenses DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
