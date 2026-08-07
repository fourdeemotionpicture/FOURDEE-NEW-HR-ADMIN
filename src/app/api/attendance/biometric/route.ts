import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendance, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const secret = process.env.BIOMETRIC_SECRET || "FourDeeBiometricSecret2026!";
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { punches } = body; // Array of { userId: string, timestamp: string } (timestamp is "YYYY-MM-DD HH:mm:ss")

    if (!punches || !Array.isArray(punches)) {
      return NextResponse.json({ error: "Invalid punches array" }, { status: 400 });
    }

    let processedCount = 0;

    for (const punch of punches) {
      const biometricId = parseInt(punch.userId, 10);
      if (isNaN(biometricId)) continue;

      // Find user with biometricId
      const user = await db.query.users.findFirst({
        where: eq(users.biometricId, biometricId),
      });

      if (!user) {
        console.warn(`User with Biometric ID ${biometricId} not found in DB`);
        continue;
      }

      // Parse timestamp (format: "YYYY-MM-DD HH:mm:ss")
      const parts = punch.timestamp.split(" ");
      if (parts.length < 2) continue;
      const date = parts[0]; // "YYYY-MM-DD"
      const timeSec = parts[1]; // "HH:mm:ss"
      const time = timeSec.substring(0, 5); // "HH:mm"

      // Check if attendance already exists for this user and date
      const existing = await db.query.attendance.findFirst({
        where: and(
          eq(attendance.userId, user.id),
          eq(attendance.date, date)
        ),
      });

      if (!existing) {
        // First punch of the day: Clock In
        const [inHours, inMins] = time.split(":").map(Number);
        const inMinsTotal = inHours * 60 + inMins;
        const lateMinutes = Math.max(0, inMinsTotal - 600); // 10:00 AM standard in time

        await db.insert(attendance).values({
          userId: user.id,
          date,
          inTime: time,
          outTime: null,
          status: "present",
          source: "biometric",
          lateMinutes,
          workingHours: "0.00",
          overtimeMinutes: 0,
        });
      } else {
        // Existing punch: Update In/Out Time & recalculate hours
        let currentInTime = existing.inTime || time;
        let currentOutTime = existing.outTime || time;

        const [newH, newM] = time.split(":").map(Number);
        const newMins = newH * 60 + newM;

        const [inH, inM] = currentInTime.split(":").map(Number);
        const inMinsTotal = inH * 60 + inM;

        // If this punch is earlier than inTime, it's the new inTime
        if (newMins < inMinsTotal) {
          currentInTime = time;
        } else {
          // If this punch is later than outTime (or outTime is not set), it's the new outTime
          const [outH, outM] = currentOutTime.split(":").map(Number);
          const outMinsTotal = outH * 60 + outM;
          if (!existing.outTime || newMins > outMinsTotal) {
            currentOutTime = time;
          }
        }

        // Recalculate Working Hours and Overtime
        let workingHours = "0.00";
        let overtimeMinutes = 0;

        const [finalInH, finalInM] = currentInTime.split(":").map(Number);
        const [finalOutH, finalOutM] = currentOutTime.split(":").map(Number);
        const diffMins = (finalOutH * 60 + finalOutM) - (finalInH * 60 + finalInM);
        
        if (diffMins > 0) {
          workingHours = (diffMins / 60).toFixed(2);
          // Standard shift is 8 hours (480 minutes)
          overtimeMinutes = Math.max(0, diffMins - 480);
        }

        // Recalculate late minutes based on inTime
        const finalInMinsTotal = finalInH * 60 + finalInM;
        const lateMinutes = Math.max(0, finalInMinsTotal - 600);

        await db.update(attendance).set({
          inTime: currentInTime,
          outTime: currentOutTime,
          workingHours,
          overtimeMinutes,
          lateMinutes,
        }).where(eq(attendance.id, existing.id));
      }

      processedCount++;
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error) {
    console.error("Biometric upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
