import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

const isBuildTime =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.CI === "true" ||
  process.env.VERCEL === "1";

if (!databaseUrl) {
  if (isBuildTime) {
    console.warn("⚠️ DATABASE_URL is not set at build time. Using placeholder connection string.");
  } else {
    throw new Error("DATABASE_URL is required at runtime.");
  }
}

const connectionString = databaseUrl || "postgresql://postgres:postgres@127.0.0.1:5432/placeholder_db";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool, { schema });
