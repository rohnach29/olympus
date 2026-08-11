import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection string from environment
const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/olympus";

// Create postgres client.
// prepare: false is required when connecting through a transaction-mode pooler
// (Neon's -pooler endpoint, pgbouncer, Supavisor) — those don't support the
// prepared statements postgres.js uses by default.
const client = postgres(connectionString, { prepare: false });

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export schema for convenience
export * from "./schema";
