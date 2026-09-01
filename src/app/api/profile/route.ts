import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserLeaveBalances } from "@/lib/leave-balances";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      personalEmail: users.personalEmail,
      phone: users.phone,
      role: users.role,
      designation: users.designation,
      monthlySalary: users.monthlySalary,
      dob: users.dob,
      biometricId: users.biometricId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, currentUser.userId)).limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const balances = await getUserLeaveBalances(user.id);

    return NextResponse.json({
      user,
      clBalance: balances.clBalance,
      coBalance: balances.coBalance,
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, personalEmail, phone, dob, password } = body;

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updatePayload.name = name;
    if (personalEmail !== undefined) updatePayload.personalEmail = personalEmail ? personalEmail.toLowerCase().trim() : null;
    if (phone !== undefined) updatePayload.phone = phone ? phone.trim() : null;
    if (dob !== undefined) updatePayload.dob = dob || null;

    if (password && password.trim().length >= 6) {
      updatePayload.passwordHash = await hashPassword(password.trim());
    }

    const [updatedUser] = await db.update(users)
      .set(updatePayload)
      .where(eq(users.id, currentUser.userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        personalEmail: users.personalEmail,
        phone: users.phone,
        role: users.role,
        designation: users.designation,
        dob: users.dob,
        biometricId: users.biometricId,
      });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
