/**
 * The facts a Station Olympus episode is written from.
 *
 * This is the only bridge between the ledger and the radio worker: the writer
 * never sees the database, only this object — so the show can never disagree
 * with the paper, because both read the same numbers. Everything here is
 * already rounded/printed the way it should be spoken about; the worker adds
 * no arithmetic of its own.
 */

import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, foodLogs, workouts } from "@/lib/db";
import { getDayLedger, type LedgerUser } from "@/lib/ledger/assemble";
import { dayWindowUtc, shiftDate } from "@/lib/ledger/time";
import { getUserTimezone } from "@/lib/utils/timezone";

export interface StationFacts {
  morning_of: string;
  verdict: { recovery: number | null; band: string; confidence: number };
  night: {
    asleep: string;
    deep_min: number;
    rem_min: number;
    score: number | null;
    bedtime: string;
    wake: string;
  } | null;
  hrv: { value: number | null; delta: number | null };
  resting_hr: { value: number | null; delta: number | null };
  yesterday: {
    steps: number | null;
    workouts: { type: string; name: string; durationMinutes: number }[];
    kcal: number | null;
    protein_g: number | null;
    meals: string[];
  };
}

function hhmm(min: number): string {
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`;
}

export async function buildStationFacts(
  user: LedgerUser,
  dateStr: string
): Promise<StationFacts> {
  const tz = getUserTimezone(user.settings);
  const prevStr = shiftDate(dateStr, -1);

  const [ledger, prevLedger] = await Promise.all([
    getDayLedger(user, dateStr),
    getDayLedger(user, prevStr),
  ]);

  // Meal names and workouts come from their own tables: the ledger keeps
  // names off the page, but the anchor wants "rajma chawal" by name.
  const { start: prevStart, end: prevEnd } = dayWindowUtc(prevStr, tz);
  const [meals, prevWorkouts] = await Promise.all([
    db
      .select({ foodName: foodLogs.foodName })
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, user.id), eq(foodLogs.loggedDate, prevStr)))
      .orderBy(asc(foodLogs.createdAt)),
    db
      .select({
        type: workouts.type,
        name: workouts.name,
        durationMinutes: workouts.durationMinutes,
      })
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, user.id),
          gte(workouts.startedAt, prevStart),
          lt(workouts.startedAt, prevEnd)
        )
      ),
  ]);

  return {
    morning_of: `${ledger.weekday} ${dateStr}`,
    verdict: {
      recovery: ledger.verdict.recovery,
      band: ledger.verdict.band,
      confidence: ledger.verdict.confidence,
    },
    night: ledger.tracks.sleep
      ? {
          asleep: hhmm(ledger.tracks.sleep.totalMin),
          deep_min: ledger.tracks.sleep.deepMin,
          rem_min: ledger.tracks.sleep.remMin,
          score: ledger.tracks.sleep.score,
          bedtime: ledger.tracks.sleep.bedtime,
          wake: ledger.tracks.sleep.wake,
        }
      : null,
    hrv: ledger.verdict.chips.hrv,
    resting_hr: ledger.verdict.chips.rhr,
    yesterday: {
      steps: prevLedger.tracks.steps?.total ?? null,
      workouts: prevWorkouts,
      kcal: prevLedger.tracks.fuel?.kcal ?? null,
      protein_g: prevLedger.tracks.fuel?.proteinG ?? null,
      meals: meals.map((m) => m.foodName),
    },
  };
}
