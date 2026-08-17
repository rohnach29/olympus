/**
 * Gap-filling history seeder.
 *
 * Fills the last N days with plausible, correlated health data so features
 * that need history (recovery baselines, the week strip, the Almanac, the
 * station's morning bulletin) have something to chew on before real
 * Health Auto Export coverage accumulates.
 *
 * Rules it must never break:
 * - Never touch a day that already has the real thing: nights, heart-rate
 *   days, food days and workout days that exist with a non-seed source are
 *   skipped, not merged.
 * - Every seeded row is marked (source 'seed', workout metadata.seeded,
 *   food brand '_seed') so `--undo` removes exactly what was added.
 * - Writes go through the app's db client, which carries the timestamp
 *   type fix — a raw postgres() connection here would store shifted times.
 *
 * Usage:
 *   npx tsx scripts/seed-history.mts          # seed 30 days ending yesterday
 *   npx tsx scripts/seed-history.mts --undo   # remove everything seeded
 */

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const { db, users, healthMetrics, sleepSessions, workouts, foodLogs } = await import(
  "../src/lib/db/index"
);
const { and, eq, ne, sql: dsql } = await import("drizzle-orm");
const { calculateSleepScore } = await import("../src/lib/utils/sleep-scoring");

const TZ_OFFSET = "+05:30"; // Asia/Kolkata, no DST
const DAYS = 30;
const SEED_SOURCE = "seed";
const FOOD_BRAND = "_seed";

// ---------- deterministic RNG (same data every run) ----------

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260817);
const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
const int = (lo: number, hi: number) => Math.round(between(lo, hi));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

// ---------- local-time helpers ----------

/** A Date at the given IST clock time on the given local date. */
function at(dateStr: string, hour: number, minute = 0): Date {
  const h = String(Math.floor(hour)).padStart(2, "0");
  const m = String(Math.floor(minute + (hour % 1) * 60)).padStart(2, "0");
  return new Date(`${dateStr}T${h}:${m}:00${TZ_OFFSET}`);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function localToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isWeekend(dateStr: string): boolean {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

// ---------- undo ----------

async function undo(userId: string) {
  const [m, s, w, f] = await Promise.all([
    db.delete(healthMetrics).where(and(eq(healthMetrics.userId, userId), eq(healthMetrics.source, SEED_SOURCE))).returning({ id: healthMetrics.id }),
    db.delete(sleepSessions).where(and(eq(sleepSessions.userId, userId), eq(sleepSessions.source, SEED_SOURCE))).returning({ id: sleepSessions.id }),
    db.delete(workouts).where(and(eq(workouts.userId, userId), dsql`${workouts.metadata}->>'seeded' = 'true'`)).returning({ id: workouts.id }),
    db.delete(foodLogs).where(and(eq(foodLogs.userId, userId), eq(foodLogs.brand, FOOD_BRAND))).returning({ id: foodLogs.id }),
  ]);
  console.log(`undo: removed ${m.length} metrics, ${s.length} nights, ${w.length} workouts, ${f.length} food logs`);
}

// ---------- seed ----------

const WORKOUTS = {
  strength: { names: ["Push day", "Pull day", "Leg day", "Full body"], dur: [40, 65] as const, hrAvg: [112, 132] as const, hrMax: [148, 168] as const, kcalPerMin: 6.5 },
  running: { names: ["Morning run", "Evening run", "Interval run"], dur: [25, 50] as const, hrAvg: [148, 164] as const, hrMax: [176, 190] as const, kcalPerMin: 10.5 },
  cycling: { names: ["Indoor cycling", "Evening ride"], dur: [35, 60] as const, hrAvg: [128, 148] as const, hrMax: [158, 176] as const, kcalPerMin: 8.5 },
  yoga: { names: ["Morning yoga", "Stretch session"], dur: [30, 50] as const, hrAvg: [88, 104] as const, hrMax: [112, 128] as const, kcalPerMin: 4 },
};

const MEALS = {
  breakfast: [
    { foodName: "Oats with milk and banana", kcal: [340, 420], protein: [14, 18], fat: [8, 12], carbs: [55, 70], fiber: [6, 8], grams: 350 },
    { foodName: "Masala omelette with toast", kcal: [380, 460], protein: [22, 28], fat: [18, 24], carbs: [28, 36], fiber: [3, 5], grams: 280 },
    { foodName: "Poha with peanuts", kcal: [320, 400], protein: [9, 12], fat: [10, 14], carbs: [52, 62], fiber: [4, 6], grams: 300 },
    { foodName: "Greek yogurt with granola", kcal: [300, 380], protein: [18, 24], fat: [8, 12], carbs: [38, 48], fiber: [4, 6], grams: 260 },
  ],
  lunch: [
    { foodName: "Dal, rice and chicken curry", kcal: [620, 740], protein: [34, 42], fat: [18, 26], carbs: [78, 92], fiber: [8, 11], grams: 550 },
    { foodName: "Rajma chawal with salad", kcal: [560, 680], protein: [20, 26], fat: [12, 18], carbs: [92, 108], fiber: [12, 16], grams: 520 },
    { foodName: "Paneer wrap with mint chutney", kcal: [540, 640], protein: [24, 30], fat: [22, 28], carbs: [58, 70], fiber: [6, 8], grams: 380 },
    { foodName: "Chicken biryani", kcal: [640, 780], protein: [30, 38], fat: [22, 30], carbs: [82, 96], fiber: [4, 6], grams: 480 },
  ],
  snack: [
    { foodName: "Apple with peanut butter", kcal: [220, 280], protein: [6, 9], fat: [12, 16], carbs: [24, 30], fiber: [5, 7], grams: 200 },
    { foodName: "Roasted chana", kcal: [160, 220], protein: [8, 11], fat: [3, 5], carbs: [24, 32], fiber: [6, 9], grams: 60 },
    { foodName: "Protein shake", kcal: [180, 240], protein: [24, 30], fat: [2, 5], carbs: [10, 18], fiber: [1, 2], grams: 350 },
  ],
  dinner: [
    { foodName: "Grilled fish with vegetables", kcal: [480, 580], protein: [36, 44], fat: [18, 24], carbs: [32, 44], fiber: [7, 10], grams: 420 },
    { foodName: "Roti, dal and sabzi", kcal: [520, 640], protein: [20, 26], fat: [14, 20], carbs: [76, 90], fiber: [12, 16], grams: 480 },
    { foodName: "Egg curry with rice", kcal: [560, 660], protein: [24, 30], fat: [24, 30], carbs: [62, 74], fiber: [5, 7], grams: 460 },
    { foodName: "Chicken salad bowl", kcal: [420, 520], protein: [34, 42], fat: [18, 24], carbs: [28, 38], fiber: [8, 11], grams: 400 },
  ],
};

function num(v: readonly [number, number] | number[]): string {
  return between(v[0], v[1]).toFixed(1);
}

async function seed(userId: string) {
  const today = localToday();
  // Wake-days D-30 … D-1; today stays the live day the watch owns.
  const days = Array.from({ length: DAYS }, (_, i) => shiftDate(today, i - DAYS));

  // What real data already exists (anything not marked as seed)?
  const realNights = await db
    .select({ wakeTime: sleepSessions.wakeTime })
    .from(sleepSessions)
    .where(and(eq(sleepSessions.userId, userId), ne(sleepSessions.source, SEED_SOURCE)));
  const realHrDays = await db
    .select({ day: dsql<string>`((${healthMetrics.recordedAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date::text`, n: dsql<number>`count(*)::int` })
    .from(healthMetrics)
    .where(and(eq(healthMetrics.userId, userId), eq(healthMetrics.metricType, "heart_rate"), ne(healthMetrics.source, SEED_SOURCE)))
    .groupBy(dsql`1`);
  const realFoodDays = await db
    .select({ day: foodLogs.loggedDate })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), dsql`${foodLogs.brand} IS DISTINCT FROM ${FOOD_BRAND}`))
    .groupBy(foodLogs.loggedDate);
  const realWorkoutDays = await db
    .select({ startedAt: workouts.startedAt })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), dsql`${workouts.metadata}->>'seeded' IS DISTINCT FROM 'true'`));

  const localDay = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const nightTaken = new Set(realNights.map((n) => localDay(n.wakeTime)));
  const hrTaken = new Set(realHrDays.filter((r) => r.n >= 10).map((r) => r.day));
  const foodTaken = new Set(realFoodDays.map((r) => r.day));
  const workoutTaken = new Set(realWorkoutDays.map((w) => localDay(w.startedAt)));

  let nNights = 0, nMetrics = 0, nWorkouts = 0, nFood = 0;

  // Decide workouts first: last night's session is what strains tonight's sleep.
  const workoutOn = new Map<string, { type: keyof typeof WORKOUTS; start: Date; end: Date; hrAvg: number; hrMax: number }>();
  for (const day of days) {
    if (workoutTaken.has(day)) continue;
    if (rng() > 0.55) continue;
    const type = pick(Object.keys(WORKOUTS) as (keyof typeof WORKOUTS)[]);
    const cfg = WORKOUTS[type];
    const dur = int(cfg.dur[0], cfg.dur[1]);
    const start = type === "running" && rng() < 0.5 ? at(day, between(6.4, 7.4)) : at(day, between(17.7, 19.5));
    const end = new Date(start.getTime() + dur * 60000);
    const w = { type, start, end, hrAvg: int(cfg.hrAvg[0], cfg.hrAvg[1]), hrMax: int(cfg.hrMax[0], cfg.hrMax[1]) };
    workoutOn.set(day, w);
    await db
      .insert(workouts)
      .values({
        userId,
        type,
        name: pick([...cfg.names]),
        durationMinutes: dur,
        caloriesBurned: Math.round(dur * cfg.kcalPerMin * between(0.9, 1.1)),
        heartRateAvg: w.hrAvg,
        heartRateMax: w.hrMax,
        startedAt: start,
        endedAt: end,
        metadata: { seeded: true },
      })
      .onConflictDoNothing();
    nWorkouts++;
  }

  let hrvWalk = between(50, 58); // slow personal drift, so weeks differ

  for (const day of days) {
    const prev = shiftDate(day, -1);
    const strained = workoutOn.has(prev) || workoutTaken.has(prev);
    const weekend = isWeekend(day);

    // ---- the night that ends this morning ----
    if (!nightTaken.has(day)) {
      const bedH = between(22.7, 24.4) + (weekend ? 0.6 : 0);
      const bedtime = bedH >= 24 ? at(day, bedH - 24) : at(prev, bedH);
      const latency = int(8, 25);
      const awake = int(15, 40) + (strained ? int(5, 15) : 0);
      let total = int(390, 470) + (weekend ? int(0, 35) : 0) - (strained ? int(10, 35) : 0);
      total = Math.max(330, Math.min(515, total));
      const inBed = total + awake + latency;
      const wakeTime = new Date(bedtime.getTime() + inBed * 60000);

      const deepPct = between(0.14, 0.21) - (strained ? 0.015 : 0);
      const remPct = between(0.19, 0.26);
      const deep = Math.round(total * deepPct);
      const rem = Math.round(total * remPct);
      const light = total - deep - rem;

      hrvWalk = Math.max(40, Math.min(66, hrvWalk + between(-2.5, 2.5)));
      const hrvAvg = Math.round(Math.max(32, Math.min(74, hrvWalk - (strained ? between(5, 11) : 0) + between(-3, 3))));
      const restingHr = Math.round(Math.max(48, Math.min(66, 57 - (hrvWalk - 54) * 0.4 + (strained ? between(2, 4) : 0) + between(-1.5, 1.5))));

      const score = calculateSleepScore(
        { totalMinutes: total, inBedMinutes: inBed, deepSleepMinutes: deep, remSleepMinutes: rem, lightSleepMinutes: light, awakeMinutes: awake, sleepLatencyMinutes: latency, hrvAvg },
        null
      );

      await db
        .insert(sleepSessions)
        .values({
          userId,
          bedtime,
          wakeTime,
          sleepDate: day,
          totalMinutes: total,
          inBedMinutes: inBed,
          deepSleepMinutes: deep,
          remSleepMinutes: rem,
          lightSleepMinutes: light,
          awakeMinutes: awake,
          sleepLatencyMinutes: latency,
          sleepScore: score.totalScore,
          efficiency: ((total / inBed) * 100).toFixed(1),
          hrvAvg,
          restingHr,
          respiratoryRate: between(12.5, 15.5).toFixed(1),
          source: SEED_SOURCE,
          metadata: { seeded: true },
        })
        .onConflictDoNothing();
      nNights++;
    }

    // ---- intraday heart rate, only where the watch recorded none ----
    if (!hrTaken.has(day)) {
      const w = workoutOn.get(day);
      const dayBase = between(70, 80);
      const rows: { userId: string; metricType: string; value: string; unit: string; source: string; recordedAt: Date }[] = [];
      for (let t = 0; t < 24; t += 1 / 6) {
        if (rng() < 0.12) continue; // watch off the wrist now and then
        const ts = at(day, t);
        let v: number;
        if (t < 6.5) v = between(50, 60);
        else if (w && ts >= w.start && ts <= w.end) v = w.hrAvg + between(-12, Math.min(18, w.hrMax - w.hrAvg));
        else v = dayBase + between(-6, 10) + (t > 21 ? -6 : 0);
        rows.push({ userId, metricType: "heart_rate", value: Math.round(v).toString(), unit: "bpm", source: SEED_SOURCE, recordedAt: ts });
      }
      await db.insert(healthMetrics).values(rows).onConflictDoNothing();
      nMetrics += rows.length;
    }

    // ---- meals ----
    if (!foodTaken.has(day)) {
      const plan: { meal: keyof typeof MEALS; h: number }[] = [];
      if (rng() < 0.85) plan.push({ meal: "breakfast", h: between(8.0, 9.5) });
      if (rng() < 0.95) plan.push({ meal: "lunch", h: between(12.8, 14.0) });
      if (rng() < 0.4) plan.push({ meal: "snack", h: between(16.3, 17.3) });
      if (rng() < 0.95) plan.push({ meal: "dinner", h: between(19.5, 21.2) });
      for (const { meal, h } of plan) {
        const item = pick(MEALS[meal]);
        await db.insert(foodLogs).values({
          userId,
          foodName: item.foodName,
          brand: FOOD_BRAND,
          servingQuantity: "1",
          servingUnit: "g",
          servingSize: item.grams.toString(),
          calories: num(item.kcal),
          proteinG: num(item.protein),
          fatG: num(item.fat),
          carbsG: num(item.carbs),
          fiberG: num(item.fiber),
          mealType: meal,
          loggedDate: day,
          createdAt: at(day, h),
        });
        nFood++;
      }
    }
  }

  console.log(`seeded ${days[0]} … ${days[days.length - 1]}`);
  console.log(`  nights: ${nNights}  hr samples: ${nMetrics}  workouts: ${nWorkouts}  meals: ${nFood}`);
  console.log(`  skipped real data — nights: ${[...nightTaken].join(", ") || "none"}; hr days: ${hrTaken.size}; food days: ${[...foodTaken].join(", ") || "none"}; workout days: ${[...workoutTaken].join(", ") || "none"}`);
}

// ---------- main ----------

const [user] = await db.select({ id: users.id, email: users.email }).from(users).limit(1);
if (!user) throw new Error("no user found");
console.log(`user: ${user.email}`);

if (process.argv.includes("--undo")) {
  await undo(user.id);
} else {
  await seed(user.id);
}
process.exit(0);
