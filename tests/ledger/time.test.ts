import { describe, it, expect } from "vitest";
import {
  dayWindowUtc,
  hoursSince,
  localDateStr,
  localHHMM,
  localMinutesOfDay,
  shiftDate,
  weekdayName,
  mondayOf,
  daysBetween,
  daysInMonth,
  cityOf,
  zoneOffsetMinutes,
} from "@/lib/ledger/time";

const IST = "Asia/Kolkata";
const SGT = "Asia/Singapore";
const NYC = "America/New_York";

describe("zoneOffsetMinutes", () => {
  it("handles whole-hour and half-hour zones", () => {
    const at = new Date("2026-08-14T12:00:00Z");
    expect(zoneOffsetMinutes(at, SGT)).toBe(480);
    expect(zoneOffsetMinutes(at, IST)).toBe(330);
    expect(zoneOffsetMinutes(at, "UTC")).toBe(0);
  });
});

describe("dayWindowUtc", () => {
  it("starts at local midnight for a +8 zone", () => {
    const { start } = dayWindowUtc("2026-08-14", SGT);
    expect(start.toISOString()).toBe("2026-08-13T16:00:00.000Z");
  });

  it("handles the +5:30 offset", () => {
    const { start, end } = dayWindowUtc("2026-08-14", IST);
    expect(start.toISOString()).toBe("2026-08-13T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-08-14T18:30:00.000Z");
  });

  it("makes a DST spring-forward day 23 hours, not 24", () => {
    // 2026-03-08: America/New_York moves EST -> EDT at 02:00 local.
    const { start, end } = dayWindowUtc("2026-03-08", NYC);
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect((end.getTime() - start.getTime()) / 3600000).toBe(23);
  });

  it("makes a DST fall-back day 25 hours", () => {
    const { start, end } = dayWindowUtc("2026-11-01", NYC);
    expect((end.getTime() - start.getTime()) / 3600000).toBe(25);
  });
});

describe("hoursSince", () => {
  it("returns fractional hours from the day start", () => {
    const start = new Date("2026-08-13T18:30:00Z"); // 2026-08-14 00:00 IST
    expect(hoursSince(start, new Date("2026-08-14T03:00:00Z"))).toBeCloseTo(8.5, 6);
  });

  it("goes negative before the day start — a pre-midnight bedtime", () => {
    const start = new Date("2026-08-13T18:30:00Z");
    expect(hoursSince(start, new Date("2026-08-13T18:00:00Z"))).toBeCloseTo(-0.5, 6);
  });
});

describe("localDateStr / localHHMM / localMinutesOfDay", () => {
  it("formats in the target zone, not UTC", () => {
    // 19:16 UTC is already past midnight in IST.
    const at = new Date("2026-08-14T19:16:42Z");
    expect(localDateStr(at, IST)).toBe("2026-08-15");
    expect(localHHMM(at, IST)).toBe("00:46");
    expect(localMinutesOfDay(at, IST)).toBe(46);
  });

  it("reports midnight as 00:00", () => {
    expect(localHHMM(new Date("2026-08-13T18:30:00Z"), IST)).toBe("00:00");
    expect(localMinutesOfDay(new Date("2026-08-13T18:30:00Z"), IST)).toBe(0);
  });
});

describe("date string arithmetic", () => {
  it("shifts across month and year boundaries", () => {
    expect(shiftDate("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2026-08-14", 0)).toBe("2026-08-14");
  });

  it("names weekdays", () => {
    expect(weekdayName("2026-08-14")).toBe("Friday");
  });

  it("finds the Monday of the week", () => {
    expect(mondayOf("2026-08-14")).toBe("2026-08-10"); // Friday -> Monday
    expect(mondayOf("2026-08-10")).toBe("2026-08-10"); // Monday -> itself
    expect(mondayOf("2026-08-16")).toBe("2026-08-10"); // Sunday -> same week
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-08-12", "2026-08-17")).toBe(5);
    expect(daysBetween("2026-08-17", "2026-08-17")).toBe(0);
  });

  it("knows month lengths including February", () => {
    expect(daysInMonth("2026-08")).toBe(31);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2024-02")).toBe(29);
  });
});

describe("cityOf", () => {
  it("reads a display city from the zone", () => {
    expect(cityOf("Asia/Kolkata")).toBe("Kolkata");
    expect(cityOf("America/New_York")).toBe("New York");
  });
});
