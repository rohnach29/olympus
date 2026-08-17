import { describe, it, expect } from "vitest";
import {
  mergeSleepSegments,
  applyStoredSegments,
  combineSegments,
  segmentsOf,
} from "@/lib/webhooks/health-auto-export/mappers";
import type { NewSleepSession } from "@/lib/db";

/** One stretch of sleep, with only the fields the merge cares about. */
function stretch(over: Partial<NewSleepSession> = {}): NewSleepSession {
  return {
    userId: "user-1",
    bedtime: new Date("2026-08-20T17:30:00Z"), // 23:00 IST
    wakeTime: new Date("2026-08-20T21:30:00Z"), // 03:00 IST
    sleepDate: "2026-08-20",
    totalMinutes: 240,
    inBedMinutes: 240,
    deepSleepMinutes: 40,
    remSleepMinutes: 60,
    lightSleepMinutes: 140,
    awakeMinutes: 0,
    sleepLatencyMinutes: 0,
    efficiency: "100.0",
    source: "apple_health",
    metadata: { originalSource: "Apple Watch" },
    ...over,
  };
}

/** The second half of the same night, after half an hour awake. */
const secondHalf = () =>
  stretch({
    bedtime: new Date("2026-08-20T22:00:00Z"), // 03:30 IST
    wakeTime: new Date("2026-08-21T01:30:00Z"), // 07:00 IST
    totalMinutes: 210,
    inBedMinutes: 210,
    deepSleepMinutes: 20,
    remSleepMinutes: 70,
    lightSleepMinutes: 120,
    awakeMinutes: 0,
    efficiency: "100.0",
  });

describe("mergeSleepSegments — within one export", () => {
  it("reports the whole night when both stretches arrive together", () => {
    const [night] = mergeSleepSegments([stretch(), secondHalf()]);
    expect(night.totalMinutes).toBe(450); // 4:00 + 3:30 = 7h30m
    expect(night.bedtime.toISOString()).toBe("2026-08-20T17:30:00.000Z");
    expect(night.wakeTime.toISOString()).toBe("2026-08-21T01:30:00.000Z");
    expect(night.deepSleepMinutes).toBe(60);
    expect(night.remSleepMinutes).toBe(130);
    // Summed, not measured end-to-end: the half hour awake is not time in bed.
    expect(night.inBedMinutes).toBe(450);
    expect(segmentsOf(night.metadata)).toHaveLength(2);
  });

  it("keeps separate nights and separate sources apart", () => {
    expect(
      mergeSleepSegments([stretch(), stretch({ sleepDate: "2026-08-21" })])
    ).toHaveLength(2);
    expect(
      mergeSleepSegments([stretch(), stretch({ source: "manual" })])
    ).toHaveLength(2);
  });
});

describe("applyStoredSegments — across separate syncs", () => {
  it("adds a later stretch to a night already stored", () => {
    // Sync at 03:00 carries only the first stretch…
    const [afterFirstSync] = mergeSleepSegments([stretch()]);
    expect(afterFirstSync.totalMinutes).toBe(240);

    // …and the 07:00 sync carries only the second, which is *shorter*.
    const [secondPayload] = mergeSleepSegments([secondHalf()]);
    const night = applyStoredSegments(
      secondPayload,
      afterFirstSync.metadata,
      afterFirstSync
    );

    expect(night.totalMinutes).toBe(450);
    expect(night.wakeTime.toISOString()).toBe("2026-08-21T01:30:00.000Z");
    expect(segmentsOf(night.metadata)).toHaveLength(2);
  });

  it("is idempotent — replaying an export does not double the night", () => {
    const [first] = mergeSleepSegments([stretch(), secondHalf()]);
    const replayed = applyStoredSegments(first, first.metadata, first);
    expect(replayed.totalMinutes).toBe(450);
    expect(segmentsOf(replayed.metadata)).toHaveLength(2);
  });

  it("does not shorten a night recorded before segments were tracked", () => {
    // A row written by the old code: no segment list on it at all.
    const legacy = stretch({ totalMinutes: 400, inBedMinutes: 430, metadata: {} });
    const [partial] = mergeSleepSegments([
      stretch({ totalMinutes: 120, inBedMinutes: 120 }),
    ]);

    const night = applyStoredSegments(partial, legacy.metadata, legacy);
    expect(night.totalMinutes).toBe(400);
  });

  it("lets a fuller report of the same stretch replace a partial one", () => {
    const [partial] = mergeSleepSegments([
      stretch({ totalMinutes: 120, inBedMinutes: 120 }),
    ]);
    const [complete] = mergeSleepSegments([stretch()]); // same start, 240 min
    const night = applyStoredSegments(complete, partial.metadata, partial);

    expect(night.totalMinutes).toBe(240);
    expect(segmentsOf(night.metadata)).toHaveLength(1);
  });
});

describe("combineSegments", () => {
  it("dedupes on start time and orders by it", () => {
    const a = { start: "2026-08-20T17:30:00.000Z", end: "", asleep: 100, inBed: 100, deep: 0, core: 0, rem: 0, awake: 0, latency: 0 };
    const b = { ...a, asleep: 150 };
    const c = { ...a, start: "2026-08-20T22:00:00.000Z", asleep: 90 };

    const merged = combineSegments([a], [b, c]);
    expect(merged).toHaveLength(2);
    expect(merged[0].asleep).toBe(150); // the fuller record for that start
    expect(merged[1].start).toBe("2026-08-20T22:00:00.000Z");
  });
});
