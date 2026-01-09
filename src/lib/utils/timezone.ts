/**
 * Timezone utilities for calculating "today" in user's local timezone
 *
 * WHY THIS EXISTS:
 * When a user in IST (UTC+5:30) checks their data at 3:49 AM on January 8th,
 * they expect to see January 8th's data. But 3:49 AM IST = 10:19 PM UTC on January 7th.
 *
 * If we use UTC midnight, we'd show them "yesterday's" data.
 * This utility calculates "today" based on the user's timezone.
 */

/**
 * Get the start of "today" in the user's timezone, returned as a UTC Date
 *
 * @param timezone - IANA timezone string (e.g., "Asia/Kolkata", "America/New_York")
 * @returns Date object representing midnight in user's timezone (as UTC timestamp)
 *
 * @example
 * // If it's 3:49 AM IST on January 8th, 2026
 * const today = getTodayInTimezone("Asia/Kolkata");
 * // Returns: Date representing Jan 7th 18:30 UTC (which is Jan 8th 00:00 IST)
 */
export function getTodayInTimezone(timezone: string = "UTC"): Date {
  const now = new Date();

  // Format current time in user's timezone to get the DATE portion
  // Using "en-CA" because it gives us YYYY-MM-DD format
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [year, month, day] = formatter.format(now).split("-").map(Number);

  // Calculate the offset between user's timezone and UTC
  const userMidnight = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const utcMidnight = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const userOffsetMs = userMidnight.getTime() - utcMidnight.getTime();

  // Create midnight in user's timezone as a UTC timestamp
  // Date.UTC gives us midnight UTC for that date
  // Subtracting the offset converts it to "midnight in user's TZ"
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - userOffsetMs);
}

/**
 * Get today's date as a string (YYYY-MM-DD) in the user's timezone
 *
 * @param timezone - IANA timezone string
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * // If it's 3:49 AM IST on January 8th
 * getTodayDateString("Asia/Kolkata") // Returns "2026-01-08"
 * getTodayDateString("UTC")          // Returns "2026-01-07" (still Jan 7th in UTC!)
 */
export function getTodayDateString(timezone: string = "UTC"): string {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(now);
}

/**
 * Get yesterday's date as a string (YYYY-MM-DD) in the user's timezone
 *
 * WHY THIS IS NEEDED FOR SLEEP DATA:
 * Sleep sessions are stored with `sleepDate` = the night you went to bed.
 * If you went to bed Jan 7th at 11 PM and woke up Jan 8th at 7 AM,
 * the sleepDate is "2025-01-07".
 *
 * So when showing "Last Night's Sleep" on Jan 8th, we need yesterday's date.
 *
 * @param timezone - IANA timezone string
 * @returns Date string in YYYY-MM-DD format for yesterday
 */
export function getYesterdayDateString(timezone: string = "UTC"): string {
  const now = new Date();

  // Subtract 24 hours to get yesterday
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(yesterday);
}

/**
 * Get a user's timezone from their settings object
 * Falls back to UTC if not set
 */
export function getUserTimezone(settings: unknown): string {
  if (settings && typeof settings === "object" && "timezone" in settings) {
    return (settings as { timezone?: string }).timezone || "UTC";
  }
  return "UTC";
}
