import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { announcements, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { format } from "date-fns";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const records = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
    const allUsers = await db.select({ id: users.id, name: users.name, dob: users.dob }).from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));
    const enriched = records.map((r) => ({ ...r, createdByName: userMap[r.createdBy] || "Unknown" }));

    // Dynamically inject birthday announcements
    const todayStr = format(new Date(), "MM-dd");
    const birthdayAnnouncements: any[] = [];
    
    allUsers.forEach((u) => {
      if (u.dob) {
        // u.dob is string in format YYYY-MM-DD
        const dobMonthDay = u.dob.substring(5);
        if (dobMonthDay === todayStr) {
          birthdayAnnouncements.push({
            id: `bday-${u.id}`,
            title: `🎂 Happy Birthday, ${u.name}! 🎉`,
            description: `Four Dee ERP wishes ${u.name} a very Happy Birthday! Have a wonderful year ahead filled with happiness and success! 🥳🎈`,
            date: format(new Date(), "yyyy-MM-dd"),
            time: "09:00",
            attachmentUrl: null,
            createdBy: u.id,
            createdByName: "System Admin",
            createdAt: new Date().toISOString(),
          });
        }
      }
    });

    const combined = [...birthdayAnnouncements, ...enriched];

    return NextResponse.json({ announcements: combined });
  } catch (error) {
    console.error("Announcements GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "Only Super Admin can create announcements" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, date, time, attachmentUrl } = body;

    if (!title || !description || !date) {
      return NextResponse.json({ error: "Title, description, and date are required" }, { status: 400 });
    }

    const [record] = await db.insert(announcements).values({
      title,
      description,
      date,
      time: time || null,
      attachmentUrl: attachmentUrl || null,
      createdBy: currentUser.userId,
    }).returning();

    return NextResponse.json({ announcement: record });
  } catch (error) {
    console.error("Announcements POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Announcement ID is required" }, { status: 400 });
    }

    await db.delete(announcements).where(eq(announcements.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Announcements DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
