import { describe, it, expect } from "vitest";
import {
  calculateRecovery,
  type RecoveryBaseline,
} from "@/lib/utils/recovery-scoring";
import { pickNightMetric, meanInWindow, groupSamplesByType } from "@/lib/ledger/night-metrics";

const baseline: RecoveryBaseline = {
  hrvAvg: 50,
  hrvStdDev: 5,
  restingHrAvg: 60,
  restingHrStdDev: 3,
  avgBedtimeMinutes: 23 * 60,
  bedtimeStdDev: 30,
};

describe("calculateRecovery — partial data", () => {
  it("scores from sleep and prior strain alone", () => {
    const r = calculateRecovery({
      sleepScore: 80,
      hrvValue: null,
      restingHr: null,
      previousDayStrain: 0, // rest day -> strain component scores 100
      bedtimeMinutes: null,
      baseline: null,
    });
    // (80 * 0.35 + 100 * 0.15) / 0.50 = 86
    expect(r.recoveryScore).toBe(86);
    expect(r.confidence).toBeCloseTo(0.5, 5);
    expect(r.basis).toEqual(["sleep quality", "prior strain"]);
    expect(r.hasEnoughData).toBe(true);
  });

  it("scores from HRV and strain alone — the 0.40 floor case", () => {
    const r = calculateRecovery({
      sleepScore: null,
      hrvValue: 52,
      restingHr: null,
      previousDayStrain: 0,
      bedtimeMinutes: null,
      baseline,
    });
    expect(r.recoveryScore).not.toBeNull();
    expect(r.confidence).toBeCloseTo(0.4, 5);
    expect(r.basis).toEqual(["HRV", "prior strain"]);
  });

  it("refuses to score from strain alone, however heavy the weight", () => {
    // Strain always reports hasData, so this is the case the second gate exists for.
    const r = calculateRecovery({
      sleepScore: null,
      hrvValue: null,
      restingHr: null,
      previousDayStrain: 12,
      bedtimeMinutes: null,
      baseline: null,
    });
    expect(r.recoveryScore).toBeNull();
    expect(r.category).toBe("insufficient_data");
    expect(r.hasEnoughData).toBe(false);
    expect(r.basis).toEqual(["prior strain"]);
  });

  it("matches the original all-components arithmetic when everything is present", () => {
    const r = calculateRecovery({
      sleepScore: 80,
      hrvValue: 52,
      restingHr: 58,
      previousDayStrain: 0,
      bedtimeMinutes: 23 * 60,
      baseline,
    });
    expect(r.confidence).toBe(1);
    expect(r.basis).toHaveLength(5);
    // Renormalising by a confidence of exactly 1 is a no-op, so this is the
    // same weighted sum the old code computed.
    const c = r.components;
    const expected = Math.round(
      c.sleepQuality.score! * c.sleepQuality.weight +
        c.hrvStatus.score! * c.hrvStatus.weight +
        c.restingHrStatus.score! * c.restingHrStatus.weight +
        c.strainImpact.score! * c.strainImpact.weight +
        c.sleepConsistency.score! * c.sleepConsistency.weight
    );
    expect(r.recoveryScore).toBe(expected);
  });

  it("categorises a partial score on the same thresholds", () => {
    const r = calculateRecovery({
      sleepScore: 95,
      hrvValue: null,
      restingHr: null,
      previousDayStrain: 0,
      bedtimeMinutes: null,
      baseline: null,
    });
    expect(r.recoveryScore).toBeGreaterThanOrEqual(85);
    expect(r.category).toBe("optimal");
  });
});

describe("night metric selection", () => {
  const at = (iso: string) => new Date(iso);
  const from = at("2026-08-14T14:30:00Z"); // 20:00 IST
  const to = at("2026-08-15T06:30:00Z"); // 12:00 IST next day

  it("takes the latest sample inside the window", () => {
    expect(
      pickNightMetric(
        [
          { value: 48, recordedAt: at("2026-08-14T18:00:00Z") },
          { value: 52, recordedAt: at("2026-08-14T21:00:00Z") },
          { value: 40, recordedAt: at("2026-08-13T21:00:00Z") }, // previous night
        ],
        from,
        to
      )
    ).toBe(52);
  });

  it("returns null rather than a stale reading from outside the window", () => {
    expect(
      pickNightMetric([{ value: 44, recordedAt: at("2026-08-10T00:00:00Z") }], from, to)
    ).toBeNull();
    expect(pickNightMetric([], from, to)).toBeNull();
  });

  it("excludes the exclusive upper bound", () => {
    expect(pickNightMetric([{ value: 9, recordedAt: to }], from, to)).toBeNull();
  });

  it("averages within the window", () => {
    expect(
      meanInWindow(
        [
          { value: 50, recordedAt: at("2026-08-14T18:00:00Z") },
          { value: 60, recordedAt: at("2026-08-14T19:00:00Z") },
          { value: 999, recordedAt: at("2026-08-01T00:00:00Z") },
        ],
        from,
        to
      )
    ).toBe(55);
  });

  it("groups rows by type in one pass, converting numeric strings", () => {
    const g = groupSamplesByType([
      { metricType: "steps", value: "120", recordedAt: at("2026-08-14T18:00:00Z") },
      { metricType: "hrv", value: "48.5", recordedAt: at("2026-08-14T18:01:00Z") },
      { metricType: "steps", value: "80", recordedAt: at("2026-08-14T18:02:00Z") },
    ]);
    expect(g.get("steps")).toHaveLength(2);
    expect(g.get("steps")![0].value).toBe(120);
    expect(g.get("hrv")![0].value).toBe(48.5);
    expect(g.get("missing")).toBeUndefined();
  });
});
