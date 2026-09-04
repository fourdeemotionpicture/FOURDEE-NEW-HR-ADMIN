import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { workReports, users } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";
    const month = searchParams.get("month") || format(new Date(), "yyyy-MM");
    const date = searchParams.get("date") || "";

    let records = await db.select().from(workReports);

    // Filter by date range
    if (date) {
      records = records.filter((r) => r.date === date);
    } else if (month) {
      try {
        const startDate = format(startOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
        const endDate = format(endOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
        records = records.filter((r) => r.date >= startDate && r.date <= endDate);
      } catch {
        // If month parse fails, return all
      }
    }

    // Filter by user
    if (currentUser.role === "employee" || currentUser.role === "office_admin") {
      records = records.filter((r) => r.userId === currentUser.userId);
    } else if (userId) {
      records = records.filter((r) => r.userId === userId);
    }

    // Enrich with user names
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));
    const enriched = records.map((r) => ({ ...r, userName: userMap[r.userId] || "Unknown" }));

    return NextResponse.json({ workReports: enriched });
  } catch (error) {
    console.error("Work reports GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { date, description, notes, imageUrl } = body;

    if (!date || !description) {
      return NextResponse.json({ error: "Date and description are required" }, { status: 400 });
    }

    const [record] = await db.insert(workReports).values({
      userId: currentUser.userId,
      date,
      description,
      notes: notes || null,
      imageUrl: imageUrl || null,
    }).returning();

    return NextResponse.json({ workReport: record });
  } catch (error) {
    console.error("Work reports POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    // Only super admin or the owner can delete
    const report = await db.select().from(workReports).where(eq(workReports.id, id));
    if (report.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (currentUser.role !== "super_admin" && currentUser.role !== "owner_admin" && report[0].userId !== currentUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(workReports).where(eq(workReports.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Work reports DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
