/**
 * Assembling one day of the ledger.
 *
 * This is the only module here that both queries and computes; everything it
 * calls is pure. Two rules it holds to:
 *
 * - **No writes.** Pages render this, and the App Router prefetches links, so
 *   a cache write here would fire on hover. Scores are derived on read; the
 *   `daily_scores` table stays a webhook-side concern.
 * - **Bounded queries.** Never `select()` a whole table: `health_metrics` has
 *   a jsonb `metadata` column and tens of thousands of rows.
 */

import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import {
  db,
  foodLogs,
  healthMetrics,
  sleepSessions,
  workouts,
  type SleepSession,
} from "@/lib/db";
import {
  calculateDailyStrain,
  calculateRecovery,
  calculateRecoveryBaseline,
  type RecoveryBaseline,
  type WorkoutData,
} from "@/lib/utils/recovery-scoring";
import { getUserTimezone } from "@/lib/utils/timezone";
import {
  cityOf,
  dayWindowUtc,
  daysBetween,
  daysInMonth,
  localDateStr,
  localHHMM,
  localMinutesOfDay,
  hoursSince,
  mondayOf,
  shiftDate,
  weekdayName,
  weekdayLetter,
} from "./time";
import { groupSamplesByType, pickNightMetric, type MetricSample } from "./night-metrics";
import { buildFuelTrack, buildHeartTrack, buildSleepTrack, buildStepsTrack } from "./tracks";
import { footnotesFor, verdictCopy } from "./verdict";
import type {
  AlmanacCell,
  DayLedger,
  MonthLedger,
  StrainLevel,
  VerdictChips,
  WeekDay,
} from "./types";

/** The fields of the signed-in user the ledger needs. */
export interface LedgerUser {
  id: string;
  settings: unknown;
  dateOfBirth: string | null;
  gender: string | null;
  createdAt: Date;
}

const TRACK_METRIC_TYPES = ["steps", "heart_rate", "hrv", "resting_heart_rate"];

/** How far before local midnight to reach for last night's HRV/RHR readings. */
const NIGHT_LOOKBACK_HOURS = 6;

function strainLevel(strain: number): StrainLevel {
  if (strain >= 14) return "high";
  if (strain >= 8) return "moderate";
  return "low";
}

function ageFrom(dateOfBirth: string | null): number | undefined {
  if (!dateOfBirth) return undefined;
  const ms = Date.now() - new Date(dateOfBirth).getTime();
  const years = Math.floor(ms / (365.25 * 24 * 3600 * 1000));
  return years > 0 && years < 120 ? years : undefined;
}

function genderFor(gender: string | null): "male" | "female" | undefined {
  return gender === "male" || gender === "female" ? gender : undefined;
}

/**
 * The night that ended on this day: the session whose wake time falls inside
 * the day. Selecting on wake time rather than the stored `sleep_date` means
 * the UI can't be thrown off by the ingest mapper's date convention.
 */
async function fetchNightEndingOn(
  userId: string,
  start: Date,
  end: Date
): Promise<SleepSession | null> {
  const rows = await db
    .select()
    .from(sleepSessions)
    .where(
      and(
        eq(sleepSessions.userId, userId),
        gte(sleepSessions.wakeTime, start),
        lt(sleepSessions.wakeTime, end)
      )
    )
    .orderBy(desc(sleepSessions.totalMinutes))
    .limit(1);
  return rows[0] ?? null;
}

/** Step totals per local day across a range, summed in Postgres. */
async function fetchStepTotalsByDay(
  userId: string,
  tz: string,
  from: Date,
  to: Date
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      day: sql<string>`((${healthMetrics.recordedAt} AT TIME ZONE 'UTC') AT TIME ZONE ${sql.raw(
        `'${tz.replace(/'/g, "")}'`
      )})::date::text`,
      total: sql<number>`sum(${healthMetrics.value}::numeric)::int`,
    })
    .from(healthMetrics)
    .where(
      and(
        eq(healthMetrics.userId, userId),
        eq(healthMetrics.metricType, "steps"),
        gte(healthMetrics.recordedAt, from),
        lt(healthMetrics.recordedAt, to)
      )
    )
    .groupBy(sql`1`);

  return new Map(rows.map((r) => [r.day, Number(r.total)]));
}

/** Score one day from already-fetched data — no queries, so a week is cheap. */
function scoreOneDay(
  dayStart: Date,
  night: SleepSession | null,
  priorWorkouts: WorkoutData[],
  hrv: number | null,
  restingHr: number | null,
  baseline: RecoveryBaseline | null,
  tz: string,
  physio: { age?: number; gender?: "male" | "female" }
) {
  const strain = calculateDailyStrain(priorWorkouts, physio);
  const recovery = calculateRecovery({
    sleepScore: night?.sleepScore ?? null,
    hrvValue: night?.hrvAvg ?? hrv,
    restingHr: night?.restingHr ?? restingHr,
    previousDayStrain: strain.strainScore,
    bedtimeMinutes: night ? localMinutesOfDay(night.bedtime, tz) : null,
    baseline,
  });
  return { strain, recovery };
}

export async function getDayLedger(
  user: LedgerUser,
  dateStr: string
): Promise<DayLedger> {
  const tz = getUserTimezone(user.settings);
  const { start: dayStart, end: dayEnd } = dayWindowUtc(dateStr, tz);
  const todayStr = localDateStr(new Date(), tz);
  const isToday = dateStr === todayStr;

  const prevDateStr = shiftDate(dateStr, -1);
  const { start: prevStart } = dayWindowUtc(prevDateStr, tz);

  const weekStart = mondayOf(dateStr);
  const { start: weekStartUtc } = dayWindowUtc(weekStart, tz);
  const { start: weekEndUtc } = dayWindowUtc(shiftDate(weekStart, 7), tz);

  const baselineFrom = new Date(dayStart.getTime() - 14 * 86400000);
  const metricsFrom = new Date(dayStart.getTime() - NIGHT_LOOKBACK_HOURS * 3600000);

  const [
    metricRows,
    night,
    priorWorkoutRows,
    baselineNights,
    dayFood,
    weekNights,
    weekWorkoutRows,
    weekSteps,
  ] = await Promise.all([
    db
      .select({
        metricType: healthMetrics.metricType,
        value: healthMetrics.value,
        recordedAt: healthMetrics.recordedAt,
      })
      .from(healthMetrics)
      .where(
        and(
          eq(healthMetrics.userId, user.id),
          inArray(healthMetrics.metricType, TRACK_METRIC_TYPES),
          gte(healthMetrics.recordedAt, metricsFrom),
          lt(healthMetrics.recordedAt, dayEnd)
        )
      )
      .orderBy(asc(healthMetrics.recordedAt)),
    fetchNightEndingOn(user.id, dayStart, dayEnd),
    db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, user.id),
          gte(workouts.startedAt, prevStart),
          lt(workouts.startedAt, dayStart)
        )
      )
      .limit(20),
    db
      .select()
      .from(sleepSessions)
      .where(
        and(
          eq(sleepSessions.userId, user.id),
          gte(sleepSessions.wakeTime, baselineFrom),
          lte(sleepSessions.wakeTime, dayEnd)
        )
      )
      .orderBy(desc(sleepSessions.wakeTime))
      .limit(14),
    db
      .select()
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, user.id), eq(foodLogs.loggedDate, dateStr)))
      .orderBy(asc(foodLogs.createdAt)),
    db
      .select()
      .from(sleepSessions)
      .where(
        and(
          eq(sleepSessions.userId, user.id),
          gte(sleepSessions.wakeTime, weekStartUtc),
          lt(sleepSessions.wakeTime, weekEndUtc)
        )
      ),
    db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, user.id),
          gte(workouts.startedAt, new Date(weekStartUtc.getTime() - 86400000)),
          lt(workouts.startedAt, weekEndUtc)
        )
      ),
    fetchStepTotalsByDay(user.id, tz, weekStartUtc, weekEndUtc),
  ]);

  const byType = groupSamplesByType(metricRows);
  const samples = (t: string): MetricSample[] => byType.get(t) ?? [];

  // Last night's readings: from the evening before through midday.
  const nightFrom = new Date(dayStart.getTime() - 4 * 3600000);
  const nightTo = new Date(dayStart.getTime() + 12 * 3600000);
  const hrv = pickNightMetric(samples("hrv"), nightFrom, nightTo);
  const restingHr = pickNightMetric(samples("resting_heart_rate"), nightFrom, nightTo);

  const physio = { age: ageFrom(user.dateOfBirth), gender: genderFor(user.gender) };

  const baseline = calculateRecoveryBaseline(
    baselineNights.map((s) => ({
      hrvAvg: s.hrvAvg,
      restingHr: s.restingHr,
      bedtimeMinutes: localMinutesOfDay(s.bedtime, tz),
    }))
  );

  const toWorkoutData = (w: (typeof priorWorkoutRows)[number]): WorkoutData => ({
    durationMinutes: w.durationMinutes,
    heartRateAvg: w.heartRateAvg,
    heartRateMax: w.heartRateMax,
    type: w.type,
    caloriesBurned: w.caloriesBurned,
  });

  const { strain, recovery } = scoreOneDay(
    dayStart,
    night,
    priorWorkoutRows.map(toWorkoutData),
    hrv,
    restingHr,
    baseline,
    tz,
    physio
  );

  // ---- tracks ----
  const heart = buildHeartTrack(samples("heart_rate"), dayStart, restingHr);
  const steps = buildStepsTrack(samples("steps"), dayStart);
  const fuel = buildFuelTrack(
    dayFood.map((f) => ({
      mealType: f.mealType,
      calories: f.calories,
      proteinG: f.proteinG,
      fiberG: f.fiberG,
      createdAt: f.createdAt,
    })),
    dayStart,
    dateStr,
    tz
  );
  const sleep = night ? buildSleepTrack(night, dayStart, tz) : null;

  // ---- verdict ----
  const missing: string[] = [];
  if (!night) missing.push("last night's sleep");
  if (hrv === null && !night?.hrvAvg) missing.push("an HRV reading");

  const copy = verdictCopy({
    recovery: recovery.recoveryScore,
    confidence: recovery.confidence,
    basis: recovery.basis,
    deepMin: night?.deepSleepMinutes ?? null,
    sleepMin: night?.totalMinutes ?? null,
    strain: strain.strainScore,
    sleepScore: night?.sleepScore ?? null,
    missing,
  });

  // Sensor readings are printed, so they are rounded here rather than in the
  // components: HRV arrives from the watch as a full-precision float.
  const hrvValue = night?.hrvAvg ?? hrv;
  const rhrValue = night?.restingHr ?? restingHr;

  const chips: VerdictChips = {
    hrv: {
      value: hrvValue === null ? null : Math.round(hrvValue),
      delta:
        baseline && hrvValue !== null ? Math.round(hrvValue - baseline.hrvAvg) : null,
    },
    rhr: {
      value: rhrValue === null ? null : Math.round(rhrValue),
      delta:
        baseline && rhrValue !== null
          ? Math.round(rhrValue - baseline.restingHrAvg)
          : null,
    },
    sleepScore: night?.sleepScore ?? null,
    strain: { value: strain.strainScore, level: strainLevel(strain.strainScore) },
  };

  // ---- the week ----
  const weekDays: WeekDay[] = [];
  let best: { score: number; date: string } | null = null;

  for (let i = 0; i < 7; i++) {
    const d = shiftDate(weekStart, i);
    const { start: dStart } = dayWindowUtc(d, tz);
    const { end: dEnd } = dayWindowUtc(d, tz);
    const isFuture = d > todayStr;

    const dNight =
      weekNights.find((s) => s.wakeTime >= dStart && s.wakeTime < dEnd) ?? null;
    const dPriorWorkouts = weekWorkoutRows
      .filter(
        (w) =>
          w.startedAt >= new Date(dStart.getTime() - 86400000) && w.startedAt < dStart
      )
      .map(toWorkoutData);
    const dSteps = weekSteps.get(d) ?? null;

    let dRecovery: number | null = null;
    if (!isFuture && dNight) {
      const scored = scoreOneDay(
        dStart,
        dNight,
        dPriorWorkouts,
        null,
        null,
        baseline,
        tz,
        physio
      );
      dRecovery = scored.recovery.recoveryScore;
    }
    if (d === dateStr && recovery.recoveryScore !== null) {
      dRecovery = recovery.recoveryScore;
    }

    if (dRecovery !== null && (!best || dRecovery > best.score)) {
      best = { score: dRecovery, date: d };
    }

    weekDays.push({
      date: d,
      label: weekdayLetter(d),
      recovery: dRecovery,
      steps: dSteps,
      printed: !isFuture && (dNight !== null || (dSteps ?? 0) > 0),
      isToday: d === todayStr,
      isViewed: d === dateStr,
    });
  }

  // ---- masthead furniture ----
  const lastSample = metricRows.length ? metricRows[metricRows.length - 1] : null;
  const nowT = isToday ? hoursSince(dayStart, new Date()) : null;

  return {
    date: dateStr,
    tz,
    isToday,
    weekday: weekdayName(dateStr),
    city: cityOf(tz),
    reportNo: Math.max(1, daysBetween(localDateStr(user.createdAt, tz), dateStr) + 1),
    nowT,
    prevDate: prevDateStr,
    nextDate: dateStr < todayStr ? shiftDate(dateStr, 1) : null,
    watch: {
      lastSyncedAt: lastSample?.recordedAt ?? null,
      lastSyncedLabel: lastSample ? localHHMM(lastSample.recordedAt, tz) : null,
    },
    verdict: {
      recovery: recovery.recoveryScore,
      band: copy.band,
      headline: copy.headline,
      sentence: copy.sentence,
      confidence: recovery.confidence,
      basis: recovery.basis,
      chips,
    },
    tracks: { heart, sleep, fuel, steps },
    week: { days: weekDays, best },
    footnotes: footnotesFor({
      verdict: {
        recovery: recovery.recoveryScore,
        confidence: recovery.confidence,
        basis: recovery.basis,
      },
      hasHeart: heart !== null,
      hasSleep: sleep !== null,
      hasFuel: fuel !== null,
      hasSteps: steps !== null,
      mealCount: fuel?.meals.length ?? 0,
      workoutCount: priorWorkoutRows.length,
    }),
  };
}

/** The Almanac: one month of day-prints plus the records that stand out. */
export async function getMonthLedger(
  user: LedgerUser,
  monthStr: string
): Promise<MonthLedger> {
  const tz = getUserTimezone(user.settings);
  const todayStr = localDateStr(new Date(), tz);
  const dayCount = daysInMonth(monthStr);
  const firstDay = `${monthStr}-01`;
  const lastDay = `${monthStr}-${String(dayCount).padStart(2, "0")}`;

  const { start: monthStart } = dayWindowUtc(firstDay, tz);
  const { end: monthEnd } = dayWindowUtc(lastDay, tz);

  const [stepsByDay, nights, allNights] = await Promise.all([
    fetchStepTotalsByDay(user.id, tz, monthStart, monthEnd),
    db
      .select()
      .from(sleepSessions)
      .where(
        and(
          eq(sleepSessions.userId, user.id),
          gte(sleepSessions.wakeTime, monthStart),
          lt(sleepSessions.wakeTime, monthEnd)
        )
      ),
    db
      .select({
        totalMinutes: sleepSessions.totalMinutes,
        wakeTime: sleepSessions.wakeTime,
      })
      .from(sleepSessions)
      .where(eq(sleepSessions.userId, user.id))
      .orderBy(desc(sleepSessions.totalMinutes))
      .limit(1),
  ]);

  const nightByDate = new Map<string, (typeof nights)[number]>();
  for (const n of nights) nightByDate.set(localDateStr(n.wakeTime, tz), n);

  const cells: AlmanacCell[] = [];
  let printedCount = 0;
  let bestRecovery: { value: number; date: string } | null = null;
  let mostSteps: { value: number; date: string } | null = null;

  for (let day = 1; day <= dayCount; day++) {
    const date = `${monthStr}-${String(day).padStart(2, "0")}`;
    const isFuture = date > todayStr;
    const night = nightByDate.get(date) ?? null;
    const steps = stepsByDay.get(date) ?? null;
    const printed = !isFuture && (night !== null || (steps ?? 0) > 0);
    if (printed) printedCount += 1;

    // Sleep score stands in for the day's mark on the wall: it is the one
    // number available for every printed day without re-scoring the month.
    const recovery = night?.sleepScore ?? null;
    if (recovery !== null && (!bestRecovery || recovery > bestRecovery.value)) {
      bestRecovery = { value: recovery, date };
    }
    if (steps !== null && (!mostSteps || steps > mostSteps.value)) {
      mostSteps = { value: steps, date };
    }

    cells.push({
      date,
      day,
      recovery,
      steps,
      sleepMin: night?.totalMinutes ?? null,
      printed,
      isToday: date === todayStr,
      isFuture,
    });
  }

  const longest = allNights[0] ?? null;
  const monthDate = new Date(`${firstDay}T00:00:00Z`);

  return {
    month: monthStr,
    label: monthDate.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }),
    year: monthDate.getUTCFullYear(),
    tz,
    cells,
    // Monday-first grid: how many blanks before the 1st.
    leadingBlanks: (new Date(`${firstDay}T00:00:00Z`).getUTCDay() + 6) % 7,
    printedCount,
    dayCount,
    prevMonth: shiftMonth(monthStr, -1),
    nextMonth: monthStr < todayStr.slice(0, 7) ? shiftMonth(monthStr, 1) : null,
    records: {
      bestRecovery,
      mostSteps,
      longestSleep: longest
        ? { value: longest.totalMinutes, date: localDateStr(longest.wakeTime, tz) }
        : null,
    },
  };
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
