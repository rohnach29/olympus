import { describe, it, expect } from "vitest";
import { parsePgTimestamp } from "@/lib/db/pg-timestamp";

/**
 * Regression guard for the whole timezone class of bug.
 *
 * Postgres hands back `timestamp without time zone` as "YYYY-MM-DD HH:MM:SS"
 * and we store UTC wall clocks there. `new Date(text)` on that space-separated
 * form reads it as *local* time, so on any machine where TZ != UTC the instant
 * comes back shifted. These assertions are absolute (they compare against a
 * fixed UTC instant), so they fail for the naive implementation on a non-UTC
 * machine and pass for the correct one everywhere.
 */
describe("parsePgTimestamp", () => {
  it("reads Postgres timestamp text as UTC", () => {
    expect(parsePgTimestamp("2026-08-15 09:06:07").toISOString()).toBe(
      "2026-08-15T09:06:07.000Z"
    );
  });

  it("keeps fractional seconds", () => {
    expect(parsePgTimestamp("2026-08-12 02:28:37.555").toISOString()).toBe(
      "2026-08-12T02:28:37.555Z"
    );
  });

  it("reads midnight as midnight, not the previous evening", () => {
    // The failure mode this guards: in IST the naive parse yields 18:30 the day before.
    expect(parsePgTimestamp("2026-08-14 00:00:00").toISOString()).toBe(
      "2026-08-14T00:00:00.000Z"
    );
  });
});
