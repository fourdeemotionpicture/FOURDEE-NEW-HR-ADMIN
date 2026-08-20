import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { expenses, pettyCash, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, rows } = body;

    const expectedSecret = process.env.SYNC_SECRET || "FourDeeErpSync2026";
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid rows format" }, { status: 400 });
    }

    // 1. Fetch an admin user ID to associate with the imports
    const adminUser = await db.query.users.findFirst({
      where: inArray(users.role, ["super_admin", "owner_admin"]),
    });

    if (!adminUser) {
      return NextResponse.json({ error: "No admin user found in database" }, { status: 400 });
    }

    const adminId = adminUser.id;

    // 2. Perform transaction to clear and rebuild
    await db.transaction(async (tx) => {
      // Clear existing records
      await tx.delete(expenses);
      await tx.delete(pettyCash);

      let runningBalance = 0.0;
      const baseTime = new Date();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const dateStr = row.date; // formatted as YYYY-MM-DD
        const category = row.category || "Other";
        const description = row.description || "";
        const amount = parseFloat(row.amount || "0");
        const opening = parseFloat(row.opening || "0");
        const billUrl = row.billUrl || null;
        const dayEndBalance = row.dayEndBalance !== undefined && row.dayEndBalance !== null ? parseFloat(row.dayEndBalance) : null;

        // Calculate sequential row timestamps separated by 1 second to preserve exact order
        const rowTime = new Date(baseTime.getTime() + i * 1000);

        // Calculate transaction balances
        let cashBalance = runningBalance + opening;
        let expenseBalance = runningBalance + opening - amount;

        // Override with spreadsheet Day End Balance if present
        if (dayEndBalance !== null) {
          if (opening > 0 && amount > 0) {
            cashBalance = dayEndBalance + amount;
            expenseBalance = dayEndBalance;
          } else if (opening > 0) {
            cashBalance = dayEndBalance;
          } else if (amount > 0) {
            expenseBalance = dayEndBalance;
          }
          runningBalance = dayEndBalance;
        } else {
          runningBalance = runningBalance + opening - amount;
        }

        // Process Cash Addition (Opening Petty Cash)
        if (opening > 0) {
          let notes = "Add petty cash (Opening)";
          if (description) {
            notes = `Add petty cash: ${description}`;
          }
          if (category && category !== "Other" && category !== "add petty cash") {
            notes += ` (${category})`;
          }

          await tx.insert(pettyCash).values({
            date: dateStr,
            amount: opening.toFixed(2),
            notes: notes,
            type: "received",
            balanceAfter: cashBalance.toFixed(2),
            createdBy: adminId,
            createdAt: rowTime,
          });
        }

        // Process Expense
        if (amount > 0) {
          // Insert into petty_cash (expense leg)
          await tx.insert(pettyCash).values({
            date: dateStr,
            amount: (-amount).toFixed(2),
            notes: `Expense: ${category}`,
            type: "expense",
            balanceAfter: expenseBalance.toFixed(2),
            createdBy: adminId,
            createdAt: rowTime,
          });

          // Insert into expenses
          await tx.insert(expenses).values({
            date: dateStr,
            paidTo: category,
            amount: amount.toFixed(2),
            notes: description || null,
            billUrl: billUrl || null,
            balanceAfter: expenseBalance.toFixed(2),
            createdBy: adminId,
            createdAt: rowTime,
          });
        }
      }
    });

    return NextResponse.json({ success: true, message: "Expenses database successfully synced with Google Sheets" });
  } catch (error) {
    console.error("Expenses sync-sheet error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
