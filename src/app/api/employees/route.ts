import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";

    let query = db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      designation: users.designation,
      monthlySalary: users.monthlySalary,
      dob: users.dob,
      biometricId: users.biometricId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users);

    const conditions = [];
    if (search) {
      conditions.push(or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))!);
    }
    if (role) {
      conditions.push(eq(users.role, role));
    }

    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      designation: users.designation,
      monthlySalary: users.monthlySalary,
      dob: users.dob,
      biometricId: users.biometricId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users);

    // Apply filters in memory for simplicity
    let filtered = allUsers;
    if (search) {
      filtered = filtered.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (role) {
      filtered = filtered.filter((u) => u.role === role);
    }

    // Employees and Office Admins can only see themselves
    if (currentUser.role === "employee" || currentUser.role === "office_admin") {
      filtered = filtered.filter((u) => u.id === currentUser.userId);
    }

    return NextResponse.json({ employees: filtered });
  } catch (error) {
    console.error("Employees GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role, designation, monthlySalary, dob, biometricId } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db.insert(users).values({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || "employee",
      designation: designation || "",
      monthlySalary: monthlySalary || "0",
      dob: dob || null,
      biometricId: biometricId ? parseInt(biometricId, 10) : null,
    }).returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: currentUser.userId,
      action: "create",
      entity: "user",
      entityId: user.id,
      details: { name, email, role, dob, biometricId },
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("Employees POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, role, designation, monthlySalary, isActive, password, dob, biometricId } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (designation !== undefined) updateData.designation = designation;
    if (monthlySalary !== undefined) updateData.monthlySalary = monthlySalary;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (dob !== undefined) updateData.dob = dob || null;
    if (biometricId !== undefined) updateData.biometricId = biometricId ? parseInt(biometricId, 10) : null;
    if (password) updateData.passwordHash = await hashPassword(password);

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Audit log
    await db.insert(auditLogs).values({
      userId: currentUser.userId,
      action: "update",
      entity: "user",
      entityId: id,
      details: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employees PUT error:", error);
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
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Soft delete
    await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id));

    await db.insert(auditLogs).values({
      userId: currentUser.userId,
      action: "deactivate",
      entity: "user",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employees DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
