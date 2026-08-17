import { describe, it, expect } from "vitest";
import { mergeSleepSegments } from "@/lib/webhooks/health-auto-export/mappers";
import type { NewSleepSession } from "@/lib/db";

/** One segment of a night, with only the fields the merge cares about. */
function segment(over: Partial<NewSleepSession> = {}): NewSleepSession {
  return {
    userId: "user-1",
    bedtime: new Date("2026-08-14T19:16:00Z"),
    wakeTime: new Date("2026-08-15T01:04:00Z"),
    sleepDate: "2026-08-14",
    totalMinutes: 306,
    inBedMinutes: 348,
    deepSleepMinutes: 39,
    remSleepMinutes: 89,
    lightSleepMinutes: 178,
    awakeMinutes: 43,
    sleepLatencyMinutes: 0,
    efficiency: "87.9",
    source: "apple_health",
    metadata: { originalSource: "Apple Watch" },
    ...over,
  };
}

describe("mergeSleepSegments", () => {
  it("leaves an uninterrupted night alone", () => {
    const only = segment();
    expect(mergeSleepSegments([only])).toEqual([only]);
  });

  it("combines the segments of one interrupted night into a single record", () => {
    const merged = mergeSleepSegments([
      segment(),
      segment({
        bedtime: new Date("2026-08-15T01:30:00Z"),
        wakeTime: new Date("2026-08-15T02:34:00Z"),
        totalMinutes: 58,
        inBedMinutes: 64,
        deepSleepMinutes: 5,
        remSleepMinutes: 20,
        lightSleepMinutes: 33,
        awakeMinutes: 6,
      }),
    ]);

    expect(merged).toHaveLength(1);
    const night = merged[0];
    // The night now ends when the sleeper actually got up, not when the first
    // stretch of sleep ended.
    expect(night.bedtime.toISOString()).toBe("2026-08-14T19:16:00.000Z");
    expect(night.wakeTime.toISOString()).toBe("2026-08-15T02:34:00.000Z");
    expect(night.totalMinutes).toBe(364); // 306 + 58 — 6h04m, not 5h06m
    expect(night.inBedMinutes).toBe(412); // summed, so the awake gap isn't counted as in bed
    expect(night.deepSleepMinutes).toBe(44);
    expect(night.remSleepMinutes).toBe(109);
    expect(night.lightSleepMinutes).toBe(211);
    expect(night.awakeMinutes).toBe(49);
    expect(night.efficiency).toBe("88.3"); // 364/412
    expect(night.metadata).toMatchObject({ segments: 2 });
  });

  it("keeps separate nights separate", () => {
    const merged = mergeSleepSegments([
      segment({ sleepDate: "2026-08-14" }),
      segment({ sleepDate: "2026-08-15" }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((s) => s.sleepDate).sort()).toEqual([
      "2026-08-14",
      "2026-08-15",
    ]);
  });

  it("does not merge across sources", () => {
    const merged = mergeSleepSegments([
      segment({ source: "apple_health" }),
      segment({ source: "manual" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("treats null stage fields as zero rather than producing NaN", () => {
    const merged = mergeSleepSegments([
      segment({ deepSleepMinutes: null, remSleepMinutes: null }),
      segment({ deepSleepMinutes: 10, remSleepMinutes: null, totalMinutes: 60, inBedMinutes: 60 }),
    ]);
    expect(merged[0].deepSleepMinutes).toBe(10);
    expect(merged[0].remSleepMinutes).toBe(0);
  });
});
