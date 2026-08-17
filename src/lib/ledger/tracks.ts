/**
 * Turning raw rows into drawable geometry.
 *
 * Everything here is pure and takes `dayStart` as a Date, positioning samples
 * with `hoursSince` — plain subtraction. No `Intl` calls in these functions:
 * a single day of step data is ~16k rows and constructing a formatter per row
 * costs more than all the arithmetic combined.
 */

import { hoursSince, localDateStr, localHHMM } from "./time";
import type { MetricSample } from "./night-metrics";
import type {
  FuelTrack,
  HeartTrack,
  MealMark,
  SleepTrack,
  StepsTrack,
  TracePoint,
  TraceSegment,
} from "./types";

/** Bins per hour for the heart trace: 6 => 10-minute means. */
const HEART_BINS_PER_HOUR = 6;
/** A silence longer than this breaks the line rather than bridging it. */
const HEART_GAP_HOURS = 0.5;

/**
 * Hourly step totals across the local day.
 * Returns null when there is nothing to draw, so the caller can print the
 * honest empty state instead of an axis with no bars.
 */
export function buildStepsTrack(
  samples: MetricSample[],
  dayStart: Date
): StepsTrack | null {
  if (samples.length === 0) return null;

  const hourly = new Array<number>(24).fill(0);
  for (const s of samples) {
    const h = Math.floor(hoursSince(dayStart, s.recordedAt));
    if (h >= 0 && h < 24) hourly[h] += s.value;
  }

  const rounded = hourly.map((v) => Math.round(v));
  const total = rounded.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  let peakHour = 0;
  for (let h = 1; h < 24; h++) {
    if (rounded[h] > rounded[peakHour]) peakHour = h;
  }

  return { hourly: rounded, total, peakHour: rounded[peakHour] > 0 ? peakHour : null };
}

/**
 * Heart rate as 10-minute means, split into runs wherever the watch stopped
 * sampling. Drawing one continuous polyline would invent a smooth line across
 * hours the watch was on a nightstand.
 */
export function buildHeartTrack(
  samples: MetricSample[],
  dayStart: Date,
  restingHr: number | null
): HeartTrack | null {
  if (samples.length === 0) return null;

  const bins = new Map<number, { sum: number; n: number }>();
  let peak = -Infinity;
  let peakAt: number | null = null;
  let min = Infinity;

  for (const s of samples) {
    const t = hoursSince(dayStart, s.recordedAt);
    if (t < 0 || t >= 24) continue;
    const bin = Math.floor(t * HEART_BINS_PER_HOUR);
    const entry = bins.get(bin);
    if (entry) {
      entry.sum += s.value;
      entry.n += 1;
    } else {
      bins.set(bin, { sum: s.value, n: 1 });
    }
    if (s.value > peak) {
      peak = s.value;
      peakAt = t;
    }
    if (s.value < min) min = s.value;
  }

  if (bins.size === 0) return null;

  const points: TracePoint[] = [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bin, e]) => ({
      t: (bin + 0.5) / HEART_BINS_PER_HOUR,
      v: Math.round(e.sum / e.n),
    }));

  const runs: TracePoint[][] = [];
  let current: TracePoint[] = [];
  for (const p of points) {
    if (current.length && p.t - current[current.length - 1].t > HEART_GAP_HOURS) {
      runs.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) runs.push(current);

  // Pad the band a little so the extremes aren't drawn on the border.
  const floor = Math.max(0, Math.floor((min - 5) / 10) * 10);
  const ceil = Math.ceil((peak + 5) / 10) * 10;

  return {
    runs,
    rest: restingHr === null ? null : Math.round(restingHr),
    low: Math.round(min),
    peak: Math.round(peak),
    peakAt,
    floor,
    ceil: ceil > floor ? ceil : floor + 10,
    sampleCount: samples.length,
  };
}

/** Nominal hours for meals whose log time tells us nothing about when they were eaten. */
const NOMINAL_MEAL_HOUR: Record<string, number> = {
  breakfast: 8,
  lunch: 13,
  snack: 16,
  dinner: 20,
};

/**
 * Meals as circles on the day, sized by calories.
 *
 * Entries are grouped per meal and placed at the median log time. A meal
 * logged the following morning would otherwise land at breakfast time on the
 * wrong day, so anything logged outside the day it counts toward is placed at
 * a nominal hour and flagged `approximate` for the UI to draw differently.
 */
export function buildFuelTrack(
  logs: {
    mealType: string;
    calories: string;
    proteinG: string;
    fiberG: string | null;
    createdAt: Date;
  }[],
  dayStart: Date,
  dateStr: string,
  tz: string
): FuelTrack | null {
  if (logs.length === 0) return null;

  const byMeal = new Map<string, typeof logs>();
  for (const l of logs) {
    const bucket = byMeal.get(l.mealType);
    if (bucket) bucket.push(l);
    else byMeal.set(l.mealType, [l]);
  }

  const meals: MealMark[] = [...byMeal.entries()]
    .map(([mealType, rows]) => {
      const sameDay = rows.filter(
        (r) => localDateStr(r.createdAt, tz) === dateStr
      );
      const approximate = sameDay.length === 0;

      let t: number;
      if (approximate) {
        t = NOMINAL_MEAL_HOUR[mealType] ?? 12;
      } else {
        const times = sameDay
          .map((r) => hoursSince(dayStart, r.createdAt))
          .sort((a, b) => a - b);
        t = times[Math.floor(times.length / 2)];
      }

      const kcal = Math.round(
        rows.reduce((sum, r) => sum + Number(r.calories), 0)
      );
      return { t, kcal, label: `${mealType} · ${kcal}`, approximate };
    })
    .sort((a, b) => a.t - b.t);

  const sum = (pick: (r: (typeof logs)[number]) => number) =>
    Math.round(logs.reduce((total, r) => total + pick(r), 0));

  return {
    meals,
    kcal: sum((r) => Number(r.calories)),
    proteinG: sum((r) => Number(r.proteinG)),
    fibreG: sum((r) => Number(r.fiberG ?? 0)),
    lastMealT: meals.length ? meals[meals.length - 1].t : null,
  };
}

/**
 * The night as a band of stages.
 *
 * The database stores stage *totals*, not the interval each stage occupied, so
 * the band is a proportional layout across the night rather than a true
 * hypnogram — honest enough at 26px tall, and labelled as summary figures
 * beside it. `from` is legitimately negative when the sleeper went to bed
 * before midnight; the trace clips and flags `carriesOver`.
 */
export function buildSleepTrack(
  session: {
    bedtime: Date;
    wakeTime: Date;
    totalMinutes: number;
    inBedMinutes: number;
    deepSleepMinutes: number | null;
    remSleepMinutes: number | null;
    lightSleepMinutes: number | null;
    awakeMinutes: number | null;
    efficiency: string | null;
    sleepScore: number | null;
  },
  dayStart: Date,
  tz: string
): SleepTrack {
  const from = hoursSince(dayStart, session.bedtime);
  const to = hoursSince(dayStart, session.wakeTime);
  const span = Math.max(to - from, 0.01);

  const parts = (
    [
      { stage: "deep", min: session.deepSleepMinutes ?? 0 },
      { stage: "core", min: session.lightSleepMinutes ?? 0 },
      { stage: "rem", min: session.remSleepMinutes ?? 0 },
      { stage: "awake", min: session.awakeMinutes ?? 0 },
    ] satisfies { stage: TraceSegment["stage"]; min: number }[]
  ).filter((p) => p.min > 0);

  const totalStageMin = parts.reduce((a, p) => a + p.min, 0);

  const segments: TraceSegment[] = [];
  if (totalStageMin === 0) {
    segments.push({ from, to, stage: "core" });
  } else {
    let cursor = from;
    for (const p of parts) {
      const width = (p.min / totalStageMin) * span;
      segments.push({ from: cursor, to: cursor + width, stage: p.stage });
      cursor += width;
    }
  }

  return {
    segments,
    bedtime: localHHMM(session.bedtime, tz),
    wake: localHHMM(session.wakeTime, tz),
    totalMin: session.totalMinutes,
    inBedMin: session.inBedMinutes,
    deepMin: session.deepSleepMinutes ?? 0,
    coreMin: session.lightSleepMinutes ?? 0,
    remMin: session.remSleepMinutes ?? 0,
    efficiency: session.efficiency === null ? null : Number(session.efficiency),
    score: session.sleepScore,
    carriesOver: from < 0,
  };
}
