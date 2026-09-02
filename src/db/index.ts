import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const rawDatabaseUrl = process.env.DATABASE_URL;

// Automatically use Supabase transaction pooler port 6543 to avoid EMAXCONNSESSION limit on port 5432
let connectionString =
  rawDatabaseUrl ||
  "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";

if (connectionString.includes(":5432") && connectionString.includes("pooler.supabase.com")) {
  connectionString = connectionString.replace(":5432", ":6543");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool, { schema });
