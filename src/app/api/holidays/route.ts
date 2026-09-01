import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { holidays } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const list = await db.select().from(holidays)
      .where(eq(holidays.year, year))
      .orderBy(asc(holidays.date));

    return NextResponse.json({ holidays: list, year });
  } catch (error) {
    console.error("Holidays GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "super_admin" && currentUser.role !== "owner_admin")) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { name, date, description, year } = body;

    if (!name || !date) {
      return NextResponse.json({ error: "Holiday name and date are required" }, { status: 400 });
    }

    const holidayYear = year || new Date(date).getFullYear();

    // Check if already exists for date
    const existing = await db.select().from(holidays).where(eq(holidays.date, date));
    if (existing.length > 0) {
      const [updated] = await db.update(holidays).set({
        name,
        description: description || null,
        year: holidayYear,
        updatedAt: new Date(),
      }).where(eq(holidays.id, existing[0].id)).returning();
      return NextResponse.json({ holiday: updated });
    }

    const [record] = await db.insert(holidays).values({
      name,
      date,
      description: description || null,
      year: holidayYear,
    }).returning();

    return NextResponse.json({ holiday: record });
  } catch (error) {
    console.error("Holidays POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "super_admin" && currentUser.role !== "owner_admin")) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Holiday ID is required" }, { status: 400 });
    }

    await db.delete(holidays).where(eq(holidays.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Holidays DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
