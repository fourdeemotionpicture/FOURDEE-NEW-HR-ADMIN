import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "four-dee-erp-secret-key-2024-change-in-production");
export const COOKIE_NAME = "fd_erp_token";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: { userId: string; email: string; role: string; name: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: string; email: string; role: string; name: string };
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const token = await getAuthCookie();
  if (!token) return null;
  return verifyToken(token);
}

export function hasPermission(role: string, permission: string): boolean {
  const permissions: Record<string, string[]> = {
    super_admin: [
      "dashboard", "employees", "attendance", "salary", "work_reports",
      "announcements", "expenses", "reports", "settings", "manual_attendance_override",
      "role_management", "export", "audit_logs", "fanpage_work"
    ],
    owner_admin: [
      "dashboard", "employees", "attendance", "salary", "work_reports",
      "announcements", "expenses", "reports", "export", "fanpage_work"
    ],
    office_admin: [
      "dashboard", "attendance_own", "work_reports_own", "announcements_view", "expenses", "fanpage_work_own"
    ],
    employee: [
      "dashboard", "attendance_own", "work_reports_own", "announcements_view", "fanpage_work_own"
    ],
  };
  return permissions[role]?.includes(permission) ?? false;
}
