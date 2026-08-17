import { describe, it, expect } from "vitest";
import {
  buildStepsTrack,
  buildHeartTrack,
  buildFuelTrack,
  buildSleepTrack,
} from "@/lib/ledger/tracks";

const IST = "Asia/Kolkata";
/** 2026-08-15 00:00 IST */
const DAY_START = new Date("2026-08-14T18:30:00Z");
const at = (h: number) => new Date(DAY_START.getTime() + h * 3600000);

describe("buildStepsTrack", () => {
  it("bins samples into 24 local hours and finds the peak", () => {
    const t = buildStepsTrack(
      [
        { value: 100, recordedAt: at(7.2) },
        { value: 50, recordedAt: at(7.8) },
        { value: 900, recordedAt: at(18.1) },
      ],
      DAY_START
    )!;
    expect(t.hourly).toHaveLength(24);
    expect(t.hourly[7]).toBe(150);
    expect(t.hourly[18]).toBe(900);
    expect(t.total).toBe(1050);
    expect(t.peakHour).toBe(18);
  });

  it("ignores samples outside the day", () => {
    const t = buildStepsTrack(
      [
        { value: 500, recordedAt: at(-2) },
        { value: 300, recordedAt: at(25) },
        { value: 40, recordedAt: at(9) },
      ],
      DAY_START
    )!;
    expect(t.total).toBe(40);
  });

  it("returns null when there is nothing to draw", () => {
    expect(buildStepsTrack([], DAY_START)).toBeNull();
    expect(buildStepsTrack([{ value: 0, recordedAt: at(3) }], DAY_START)).toBeNull();
  });
});

describe("buildHeartTrack", () => {
  it("averages into 10-minute bins and reports the peak with its time", () => {
    const samples = [
      { value: 60, recordedAt: at(8.0) },
      { value: 70, recordedAt: at(8.05) }, // same 10-min bin -> mean 65
      { value: 150, recordedAt: at(8.2) },
    ];
    const t = buildHeartTrack(samples, DAY_START, 58)!;
    expect(t.runs[0][0].v).toBe(65);
    expect(t.peak).toBe(150);
    expect(t.peakAt).toBeCloseTo(8.2, 3);
    expect(t.rest).toBe(58);
    expect(t.sampleCount).toBe(3);
  });

  it("breaks the line across a gap instead of bridging it", () => {
    const t = buildHeartTrack(
      [
        { value: 60, recordedAt: at(1.0) },
        { value: 62, recordedAt: at(1.2) },
        // watch off the wrist for three hours
        { value: 80, recordedAt: at(4.5) },
        { value: 82, recordedAt: at(4.7) },
      ],
      DAY_START,
      null
    )!;
    expect(t.runs).toHaveLength(2);
    expect(t.runs[0]).toHaveLength(2);
    expect(t.runs[1]).toHaveLength(2);
  });

  it("derives a y-band that contains the data", () => {
    const t = buildHeartTrack(
      [
        { value: 48, recordedAt: at(3) },
        { value: 143, recordedAt: at(9) },
      ],
      DAY_START,
      null
    )!;
    expect(t.floor).toBeLessThanOrEqual(48);
    expect(t.ceil).toBeGreaterThanOrEqual(143);
    expect(t.ceil).toBeGreaterThan(t.floor);
  });

  it("returns null with no samples in the day", () => {
    expect(buildHeartTrack([], DAY_START, null)).toBeNull();
    expect(buildHeartTrack([{ value: 60, recordedAt: at(30) }], DAY_START, null)).toBeNull();
  });
});

describe("buildFuelTrack", () => {
  const log = (mealType: string, kcal: number, h: number, protein = 10, fibre = 2) => ({
    mealType,
    calories: String(kcal),
    proteinG: String(protein),
    fiberG: String(fibre),
    createdAt: at(h),
  });

  it("groups by meal, positions at the median log time and sums macros", () => {
    const t = buildFuelTrack(
      [log("breakfast", 300, 8.1), log("breakfast", 110, 8.3), log("lunch", 642, 13.2)],
      DAY_START,
      "2026-08-15",
      IST
    )!;
    expect(t.meals).toHaveLength(2);
    expect(t.meals[0].kcal).toBe(410);
    expect(t.meals[0].t).toBeGreaterThanOrEqual(8.1);
    expect(t.meals[0].t).toBeLessThanOrEqual(8.3);
    expect(t.meals[0].approximate).toBe(false);
    expect(t.kcal).toBe(1052);
    expect(t.proteinG).toBe(30);
    expect(t.fibreG).toBe(6);
    expect(t.lastMealT).toBeCloseTo(13.2, 2);
  });

  it("flags a meal logged on another day and places it at a nominal hour", () => {
    // Dinner entered the next morning: the log time says nothing about when it was eaten.
    const t = buildFuelTrack([log("dinner", 700, 32)], DAY_START, "2026-08-15", IST)!;
    expect(t.meals[0].approximate).toBe(true);
    expect(t.meals[0].t).toBe(20);
    expect(t.kcal).toBe(700);
  });

  it("returns null with no logs", () => {
    expect(buildFuelTrack([], DAY_START, "2026-08-15", IST)).toBeNull();
  });
});

describe("buildSleepTrack", () => {
  const night = (bedH: number, wakeH: number, over = {}) => ({
    bedtime: at(bedH),
    wakeTime: at(wakeH),
    totalMinutes: 306,
    deepSleepMinutes: 39,
    remSleepMinutes: 89,
    lightSleepMinutes: 178,
    awakeMinutes: 43,
    efficiency: "87.9",
    sleepScore: 46,
    ...over,
  });

  it("lays the night out across the morning", () => {
    const t = buildSleepTrack(night(0.77, 6.57), DAY_START, IST);
    expect(t.carriesOver).toBe(false);
    expect(t.segments[0].from).toBeCloseTo(0.77, 2);
    expect(t.segments[t.segments.length - 1].to).toBeCloseTo(6.57, 2);
    expect(t.totalMin).toBe(306);
    expect(t.efficiency).toBe(87.9);
  });

  it("carries over when the sleeper went to bed before midnight", () => {
    const t = buildSleepTrack(night(-0.5, 6.5), DAY_START, IST);
    expect(t.carriesOver).toBe(true);
    expect(t.segments[0].from).toBeCloseTo(-0.5, 2);
  });

  it("splits the span proportionally by stage minutes", () => {
    const t = buildSleepTrack(night(0, 6), DAY_START, IST);
    const total = t.segments.reduce((a, s) => a + (s.to - s.from), 0);
    expect(total).toBeCloseTo(6, 5);
    // deep is 39 of 349 stage-minutes, over a 6h span
    expect(t.segments[0].stage).toBe("deep");
    expect(t.segments[0].to - t.segments[0].from).toBeCloseTo((39 / 349) * 6, 4);
  });

  it("falls back to one block when no stages were recorded", () => {
    const t = buildSleepTrack(
      night(1, 7, {
        deepSleepMinutes: null,
        remSleepMinutes: null,
        lightSleepMinutes: null,
        awakeMinutes: null,
      }),
      DAY_START,
      IST
    );
    expect(t.segments).toHaveLength(1);
    expect(t.segments[0].stage).toBe("core");
  });
});
