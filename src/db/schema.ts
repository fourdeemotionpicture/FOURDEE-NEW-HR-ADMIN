import { pgTable, uuid, varchar, text, integer, boolean, timestamp, date, time, numeric, jsonb } from "drizzle-orm/pg-core";

// ─── Users ──────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("employee"), // super_admin, owner_admin, office_admin, employee
  designation: varchar("designation", { length: 255 }),
  monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }).default("0"),
  dob: date("dob"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Attendance ─────────────────────────────────────────────────────────
export const attendance = pgTable("attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  inTime: time("in_time"),
  outTime: time("out_time"),
  status: varchar("status", { length: 50 }).notNull().default("present"), // present, absent, half_day, holiday
  source: varchar("source", { length: 50 }).notNull().default("manual"), // biometric, manual, admin_override
  lateMinutes: integer("late_minutes").default(0),
  workingHours: numeric("working_hours", { precision: 5, scale: 2 }).default("0"),
  overtimeMinutes: integer("overtime_minutes").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Work Reports ───────────────────────────────────────────────────────
export const workReports = pgTable("work_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  description: text("description").notNull(),
  notes: text("notes"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Announcements ──────────────────────────────────────────────────────
export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  date: date("date").notNull(),
  time: time("time"),
  attachmentUrl: text("attachment_url"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Petty Cash ─────────────────────────────────────────────────────────
export const pettyCash = pgTable("petty_cash", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  type: varchar("type", { length: 50 }).notNull().default("received"), // received, expense
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Expense Entries ────────────────────────────────────────────────────
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  paidTo: varchar("paid_to", { length: 500 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  billUrl: text("bill_url"),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Audit Logs ─────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 255 }).notNull(),
  entity: varchar("entity", { length: 255 }).notNull(),
  entityId: uuid("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Manual Attendance Requests ─────────────────────────────────────────
export const manualAttendanceRequests = pgTable("manual_attendance_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  inTime: time("in_time").notNull(),
  outTime: time("out_time").notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, approved, rejected
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
