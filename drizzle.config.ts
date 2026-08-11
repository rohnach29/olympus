import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Schema changes go over a direct (non-pooled) connection when one is
    // available — DDL through a transaction pooler is unreliable.
    url:
      process.env.DIRECT_DATABASE_URL ||
      process.env.DATABASE_URL ||
      "postgres://localhost:5432/olympus",
  },
});
