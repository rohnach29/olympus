/**
 * Day-boundary arithmetic for the ledger.
 *
 * Two rules keep this correct and fast:
 *
 * 1. Anything that maps an instant to a *position on the day axis* uses
 *    `hoursSince`, which is pure subtraction. `Intl.DateTimeFormat` must never
 *    be called inside a loop over samples — constructing a formatter costs far
 *    more than formatting with one, and a day of step data is ~16k rows.
 * 2. Anything that reasons about calendar dates works on "YYYY-MM-DD" strings,
 *    never on a Date, so there is no instant to be misplaced by a timezone.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

/**
 * Minutes that `tz` is ahead of UTC at the given instant.
 * Derived by reading the instant's wall clock in `tz` and comparing it to the
 * same fields in UTC — no timezone database dependency required.
 */
export function zoneOffsetMinutes(at: Date, tz: string): number {
  const p = partsFormatter(tz).formatToParts(at);
  const get = (type: string) => Number(p.find((x) => x.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24, // Intl can emit hour 24 for midnight under hour12:false
    get("minute"),
    get("second")
  );
  return (asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000;
}

/** UTC instant of local midnight beginning `dateStr` in `tz`. */
function startOfLocalDay(dateStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  // Correct by the offset, then re-sample: the offset at the corrected instant
  // can differ from the offset at the guess across a DST boundary.
  const once = new Date(guess.getTime() - zoneOffsetMinutes(guess, tz) * 60000);
  return new Date(guess.getTime() - zoneOffsetMinutes(once, tz) * 60000);
}

/**
 * The half-open window [start, end) covering `dateStr` in `tz`.
 * `end` is the *next day's* start rather than start+24h, so DST days are
 * genuinely 23 or 25 hours long.
 */
export function dayWindowUtc(dateStr: string, tz: string): { start: Date; end: Date } {
  return {
    start: startOfLocalDay(dateStr, tz),
    end: startOfLocalDay(shiftDate(dateStr, 1), tz),
  };
}

/** Hours elapsed from `dayStart` to `at`. Pure arithmetic — safe in hot loops. */
export function hoursSince(dayStart: Date, at: Date): number {
  return (at.getTime() - dayStart.getTime()) / 3600000;
}

/** "YYYY-MM-DD" for the instant, in `tz`. */
export function localDateStr(at: Date, tz: string): string {
  return at.toLocaleDateString("en-CA", { timeZone: tz });
}

/** "HH:MM" for the instant, in `tz`. */
export function localHHMM(at: Date, tz: string): string {
  return at.toLocaleTimeString("en-GB", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Local minutes past midnight for the instant, in `tz`. */
export function localMinutesOfDay(at: Date, tz: string): number {
  const [h, m] = localHHMM(at, tz).split(":").map(Number);
  return h * 60 + m;
}

/** Calendar arithmetic on the date string itself — no instant involved. */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** Full weekday name for a date string, e.g. "Friday". */
export function weekdayName(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });
}

/** Single-letter weekday for a date string, Monday-first display use. */
export function weekdayLetter(dateStr: string): string {
  return "SMTWTFS"[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

/** The Monday of the ISO week containing `dateStr`. */
export function mondayOf(dateStr: string): string {
  const dow = (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  return shiftDate(dateStr, -dow);
}

/** Whole days from `from` to `to` (both date strings), `to` - `from`. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** Number of days in the month of a "YYYY-MM" string. */
export function daysInMonth(monthStr: string): number {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Display city for a IANA timezone, e.g. "Asia/Kolkata" -> "Kolkata". */
export function cityOf(tz: string): string {
  const tail = tz.split("/").pop() ?? tz;
  return tail.replace(/_/g, " ");
}
