import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { fanpageWork, users, auditLogs } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
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

    const isManager = currentUser.role === "super_admin" || currentUser.role === "owner_admin";

    // Date range filtering
    let records = await db.select().from(fanpageWork).orderBy(desc(fanpageWork.date), desc(fanpageWork.createdAt));

    // Filter by user role limits
    if (!isManager) {
      records = records.filter((r) => r.userId === currentUser.userId);
    } else if (userId) {
      records = records.filter((r) => r.userId === userId);
    }

    // Filter by date or month
    if (date) {
      records = records.filter((r) => r.date === date);
    } else if (month) {
      try {
        const start = format(startOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
        const end = format(endOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
        records = records.filter((r) => r.date >= start && r.date <= end);
      } catch {
        // Return unfiltered if month parsing fails
      }
    }

    // Enrich with user name
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

    const enriched = records.map((r) => ({
      ...r,
      userName: userMap[r.userId] || "Unknown",
    }));

    return NextResponse.json({ fanpageWork: enriched });
  } catch (error) {
    console.error("Fanpage Work GET error:", error);
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
    const { platform, pageHandle, date, workDescription, postLink, userId } = body;

    if (!platform || !pageHandle || !date || !workDescription) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
    }

    const isManager = currentUser.role === "super_admin" || currentUser.role === "owner_admin";
    const targetUserId = isManager && userId ? userId : currentUser.userId;

    const [record] = await db.insert(fanpageWork).values({
      userId: targetUserId,
      platform,
      pageHandle,
      date,
      workDescription,
      postLink: postLink || null,
    }).returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: currentUser.userId,
      action: "create",
      entity: "fanpage_work",
      entityId: record.id,
      details: { platform, pageHandle, date, targetUserId },
    });

    return NextResponse.json({ fanpageWork: record });
  } catch (error) {
    console.error("Fanpage Work POST error:", error);
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
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const record = await db.query.fanpageWork.findFirst({
      where: eq(fanpageWork.id, id),
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const isManager = currentUser.role === "super_admin" || currentUser.role === "owner_admin";
    if (!isManager && record.userId !== currentUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(fanpageWork).where(eq(fanpageWork.id, id));

    // Audit log
    await db.insert(auditLogs).values({
      userId: currentUser.userId,
      action: "delete",
      entity: "fanpage_work",
      entityId: id,
      details: { platform: record.platform, pageHandle: record.pageHandle, date: record.date, recordUserId: record.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fanpage Work DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
