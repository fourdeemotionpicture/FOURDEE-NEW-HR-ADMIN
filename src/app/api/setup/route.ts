import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Check if super admin already exists
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.role, "super_admin"),
    });

    if (existingAdmin) {
      return NextResponse.json({ error: "Super admin already exists" }, { status: 400 });
    }

    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const [admin] = await db.insert(users).values({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "super_admin",
      designation: "Media Manager - Digital Marketing & Branding",
      monthlySalary: "0",
    }).returning();

    return NextResponse.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.role, "super_admin"),
    });

    return NextResponse.json({ setupRequired: !existingAdmin });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
