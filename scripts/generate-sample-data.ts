/**
 * Sample Data Generator for Olympus
 *
 * Generates realistic workout, sleep, and health metrics data
 * mimicking Apple Health export format.
 *
 * Usage: npx tsx scripts/generate-sample-data.ts <userId> [days]
 */

import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/olympus";
const sql = postgres(connectionString);

// Utility functions
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 1): number {
  const val = Math.random() * (max - min) + min;
  return Number(val.toFixed(decimals));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Workout configuration by type
const WORKOUT_TYPES = {
  strength: {
    names: ["Upper Body Strength", "Lower Body Strength", "Full Body Strength", "Core & Abs", "Push Day", "Pull Day", "Leg Day"],
    durationRange: [30, 60],
    caloriesPerMinute: [6, 8],
    heartRateAvg: [115, 135],
    heartRateMax: [145, 165],
  },
  running: {
    names: ["Morning Run", "Evening Jog", "Interval Run", "Long Run", "Recovery Run", "Trail Run"],
    durationRange: [20, 50],
    caloriesPerMinute: [9, 12],
    heartRateAvg: [145, 165],
    heartRateMax: [175, 190],
  },
  cycling: {
    names: ["Outdoor Ride", "Indoor Cycling", "Hill Climb", "Recovery Ride", "Spin Class"],
    durationRange: [30, 60],
    caloriesPerMinute: [7, 10],
    heartRateAvg: [130, 150],
    heartRateMax: [160, 180],
  },
  yoga: {
    names: ["Morning Yoga", "Vinyasa Flow", "Power Yoga", "Restorative Yoga", "Stretch Session"],
    durationRange: [30, 60],
    caloriesPerMinute: [3, 5],
    heartRateAvg: [85, 105],
    heartRateMax: [115, 135],
  },
  swimming: {
    names: ["Lap Swimming", "Pool Workout", "Open Water Swim", "Swim Drills"],
    durationRange: [30, 45],
    caloriesPerMinute: [8, 11],
    heartRateAvg: [130, 150],
    heartRateMax: [160, 175],
  },
  hiit: {
    names: ["HIIT Session", "Tabata Workout", "Circuit Training", "Metabolic Conditioning", "CrossFit WOD"],
    durationRange: [20, 35],
    caloriesPerMinute: [11, 15],
    heartRateAvg: [155, 170],
    heartRateMax: [180, 195],
  },
  sports: {
    names: ["Basketball", "Tennis", "Soccer", "Volleyball", "Badminton", "Table Tennis"],
    durationRange: [45, 90],
    caloriesPerMinute: [7, 11],
    heartRateAvg: [135, 155],
    heartRateMax: [165, 185],
  },
  walking: {
    names: ["Morning Walk", "Evening Walk", "Lunch Walk", "Nature Walk"],
    durationRange: [20, 45],
    caloriesPerMinute: [3, 5],
    heartRateAvg: [90, 110],
    heartRateMax: [120, 140],
  },
};

// Sleep configuration (Apple Health style)
const SLEEP_CONFIG = {
  // Healthy sleep stage percentages
  deepSleepPercent: { min: 15, max: 25 },
  remSleepPercent: { min: 20, max: 28 },
  awakeMinutes: { min: 5, max: 25 },

  // Sleep timing (24-hour format)
  bedtimeHour: { min: 22, max: 24 }, // 10 PM - 12 AM
  sleepDurationMinutes: { min: 360, max: 510 }, // 6-8.5 hours

  // Physiological ranges
  hrvRange: { min: 35, max: 70 },
  restingHrRange: { min: 48, max: 65 },
  respiratoryRateRange: { min: 12, max: 16 },
};

interface GeneratedWorkout {
  userId: string;
  type: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  heartRateAvg: number;
  heartRateMax: number;
  startedAt: Date;
  endedAt: Date;
  metadata: object;
}

interface GeneratedSleep {
  userId: string;
  bedtime: Date;
  wakeTime: Date;
  sleepDate: string;
  totalMinutes: number;
  inBedMinutes: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  awakeMinutes: number;
  sleepScore: number;
  efficiency: string;
  hrvAvg: number;
  restingHr: number;
  respiratoryRate: string;
  source: string;
  metadata: object;
}

interface GeneratedDailyScore {
  userId: string;
  date: string;
  sleepScore: number;
  recoveryScore: number;
  strainScore: number;
  readinessScore: number;
  components: object;
}

interface GeneratedMetric {
  userId: string;
  metricType: string;
  value: number;
  unit: string;
  source: string;
  recordedAt: Date;
}

// Generate a single workout
function generateWorkout(userId: string, date: Date): GeneratedWorkout {
  const types = Object.keys(WORKOUT_TYPES) as (keyof typeof WORKOUT_TYPES)[];
  const type = pickRandom(types);
  const config = WORKOUT_TYPES[type];

  const duration = randomInRange(config.durationRange[0], config.durationRange[1]);
  const caloriesPerMin = randomFloat(config.caloriesPerMinute[0], config.caloriesPerMinute[1]);

  // Random start time between 6 AM and 8 PM
  const startHour = randomInRange(6, 20);
  const startedAt = new Date(date);
  startedAt.setHours(startHour, randomInRange(0, 59), 0, 0);

  const endedAt = new Date(startedAt.getTime() + duration * 60 * 1000);

  return {
    userId,
    type,
    name: pickRandom(config.names),
    durationMinutes: duration,
    caloriesBurned: Math.round(duration * caloriesPerMin),
    heartRateAvg: randomInRange(config.heartRateAvg[0], config.heartRateAvg[1]),
    heartRateMax: randomInRange(config.heartRateMax[0], config.heartRateMax[1]),
    startedAt,
    endedAt,
    metadata: { generated: true },
  };
}

// Generate a single sleep session
function generateSleepSession(userId: string, date: Date): GeneratedSleep {
  // Bedtime on the given date
  const bedtimeHour = randomInRange(SLEEP_CONFIG.bedtimeHour.min, SLEEP_CONFIG.bedtimeHour.max);
  const bedtime = new Date(date);

  if (bedtimeHour >= 24) {
    // Past midnight
    bedtime.setDate(bedtime.getDate() + 1);
    bedtime.setHours(bedtimeHour - 24, randomInRange(0, 59), 0, 0);
  } else {
    bedtime.setHours(bedtimeHour, randomInRange(0, 59), 0, 0);
  }

  // Total sleep duration
  const totalSleepMinutes = randomInRange(
    SLEEP_CONFIG.sleepDurationMinutes.min,
    SLEEP_CONFIG.sleepDurationMinutes.max
  );
  const awakeMinutes = randomInRange(SLEEP_CONFIG.awakeMinutes.min, SLEEP_CONFIG.awakeMinutes.max);
  const inBedMinutes = totalSleepMinutes + awakeMinutes;

  const wakeTime = new Date(bedtime.getTime() + inBedMinutes * 60 * 1000);

  // Calculate sleep stages (Apple Health style)
  const deepPercent = randomInRange(SLEEP_CONFIG.deepSleepPercent.min, SLEEP_CONFIG.deepSleepPercent.max) / 100;
  const remPercent = randomInRange(SLEEP_CONFIG.remSleepPercent.min, SLEEP_CONFIG.remSleepPercent.max) / 100;
  const lightPercent = 1 - deepPercent - remPercent;

  const deepSleep = Math.round(totalSleepMinutes * deepPercent);
  const remSleep = Math.round(totalSleepMinutes * remPercent);
  const lightSleep = Math.round(totalSleepMinutes * lightPercent);

  // Calculate sleep score
  const efficiency = (totalSleepMinutes / inBedMinutes) * 100;
  const durationScore = Math.min(100, (totalSleepMinutes / 480) * 100); // 8 hours = 100
  const stageScore = deepPercent >= 0.15 && remPercent >= 0.20 ? 90 : 75;
  const efficiencyScore = efficiency >= 85 ? 95 : efficiency >= 75 ? 80 : 65;
  const sleepScore = Math.round(durationScore * 0.35 + efficiencyScore * 0.35 + stageScore * 0.30);

  // Physiological metrics
  const hrvAvg = randomInRange(SLEEP_CONFIG.hrvRange.min, SLEEP_CONFIG.hrvRange.max);
  const restingHr = randomInRange(SLEEP_CONFIG.restingHrRange.min, SLEEP_CONFIG.restingHrRange.max);
  const respiratoryRate = randomFloat(
    SLEEP_CONFIG.respiratoryRateRange.min,
    SLEEP_CONFIG.respiratoryRateRange.max
  );

  return {
    userId,
    bedtime,
    wakeTime,
    sleepDate: date.toISOString().split("T")[0],
    totalMinutes: totalSleepMinutes,
    inBedMinutes,
    deepSleepMinutes: deepSleep,
    remSleepMinutes: remSleep,
    lightSleepMinutes: lightSleep,
    awakeMinutes,
    sleepScore: Math.min(100, Math.max(0, sleepScore)),
    efficiency: efficiency.toFixed(1),
    hrvAvg,
    restingHr,
    respiratoryRate: respiratoryRate.toFixed(1),
    source: "apple_health",
    metadata: { generated: true },
  };
}

// Generate daily scores based on sleep and workout data
function generateDailyScore(
  userId: string,
  date: Date,
  sleep: GeneratedSleep | null,
  hadWorkout: boolean
): GeneratedDailyScore {
  const sleepScore = sleep?.sleepScore || randomInRange(60, 80);

  // Recovery score influenced by sleep quality and previous day strain
  const baseRecovery = sleepScore * 0.6 + randomInRange(30, 50);
  const recoveryScore = Math.min(100, Math.round(baseRecovery));

  // Strain score based on workout intensity
  const strainScore = hadWorkout
    ? randomFloat(10, 18, 1)
    : randomFloat(3, 8, 1);

  // Readiness based on recovery and sleep
  const readinessScore = Math.round((recoveryScore * 0.5 + sleepScore * 0.5));

  return {
    userId,
    date: date.toISOString().split("T")[0],
    sleepScore,
    recoveryScore,
    strainScore,
    readinessScore,
    components: {
      sleepDuration: sleep?.totalMinutes || 0,
      sleepEfficiency: sleep?.efficiency || "0",
      hrvBaseline: sleep?.hrvAvg || 50,
      restingHrBaseline: sleep?.restingHr || 58,
      generated: true,
    },
  };
}

// Generate health metrics for a day
function generateHealthMetrics(
  userId: string,
  date: Date,
  sleep: GeneratedSleep | null,
  hadWorkout: boolean
): GeneratedMetric[] {
  const recordedAt = new Date(date);
  recordedAt.setHours(8, 0, 0, 0); // Morning metrics

  const metrics: GeneratedMetric[] = [
    {
      userId,
      metricType: "hrv",
      value: sleep?.hrvAvg || randomInRange(40, 60),
      unit: "ms",
      source: "apple_health",
      recordedAt,
    },
    {
      userId,
      metricType: "resting_hr",
      value: sleep?.restingHr || randomInRange(52, 62),
      unit: "bpm",
      source: "apple_health",
      recordedAt,
    },
    {
      userId,
      metricType: "respiratory_rate",
      value: parseFloat(sleep?.respiratoryRate || "14"),
      unit: "br/min",
      source: "apple_health",
      recordedAt,
    },
    {
      userId,
      metricType: "steps",
      value: hadWorkout ? randomInRange(8000, 15000) : randomInRange(4000, 8000),
      unit: "steps",
      source: "apple_health",
      recordedAt: new Date(date.setHours(21, 0, 0, 0)), // End of day
    },
    {
      userId,
      metricType: "active_calories",
      value: hadWorkout ? randomInRange(400, 800) : randomInRange(150, 350),
      unit: "kcal",
      source: "apple_health",
      recordedAt: new Date(date.setHours(21, 0, 0, 0)),
    },
  ];

  return metrics;
}

// Select which days should have workouts (spread evenly)
function selectWorkoutDays(totalDays: number, workoutsPerWeek: number): number[] {
  const workoutDays: number[] = [];
  const targetWorkouts = Math.ceil((totalDays / 7) * workoutsPerWeek);

  // Distribute workouts across the days
  const spacing = Math.floor(totalDays / targetWorkouts);

  for (let i = 0; i < targetWorkouts && workoutDays.length < totalDays; i++) {
    const day = Math.min(i * spacing + randomInRange(0, Math.max(0, spacing - 1)), totalDays - 1);
    if (!workoutDays.includes(day)) {
      workoutDays.push(day);
    }
  }

  return workoutDays.sort((a, b) => a - b);
}

async function generateSampleData(userId: string, daysBack: number = 7) {
  console.log("🏋️  Olympus Sample Data Generator");
  console.log("=================================\n");
  console.log(`👤 User ID: ${userId}`);
  console.log(`📅 Days: ${daysBack}\n`);

  // Check if user exists
  const [user] = await sql`SELECT id, email FROM users WHERE id = ${userId}`;
  if (!user) {
    console.error("❌ User not found. Please provide a valid user ID.");
    console.log("\nTo find your user ID, run:");
    console.log("  SELECT id, email FROM users;");
    await sql.end();
    process.exit(1);
  }
  console.log(`✅ User found: ${user.email}\n`);

  // Clear existing generated data
  console.log("🗑️  Clearing existing generated data...");
  await sql`DELETE FROM workouts WHERE user_id = ${userId} AND metadata->>'generated' = 'true'`;
  await sql`DELETE FROM sleep_sessions WHERE user_id = ${userId} AND metadata->>'generated' = 'true'`;
  await sql`DELETE FROM daily_scores WHERE user_id = ${userId}`;
  await sql`DELETE FROM health_metrics WHERE user_id = ${userId} AND source = 'apple_health'`;

  // Determine workout days (3-4 per week)
  const workoutsPerWeek = randomInRange(3, 4);
  const workoutDayIndices = selectWorkoutDays(daysBack, workoutsPerWeek);
  console.log(`📊 Planned workouts: ${workoutDayIndices.length} over ${daysBack} days\n`);

  const workouts: GeneratedWorkout[] = [];
  const sleepSessions: GeneratedSleep[] = [];
  const dailyScores: GeneratedDailyScore[] = [];
  const healthMetrics: GeneratedMetric[] = [];

  // Generate data for each day
  console.log("⏳ Generating data...");
  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    // Generate sleep for previous night
    const sleepDate = new Date(date);
    sleepDate.setDate(sleepDate.getDate() - 1);
    const sleep = generateSleepSession(userId, sleepDate);
    sleepSessions.push(sleep);

    // Generate workout if this is a workout day
    const hadWorkout = workoutDayIndices.includes(i);
    if (hadWorkout) {
      const workout = generateWorkout(userId, date);
      workouts.push(workout);
    }

    // Generate daily scores
    const dailyScore = generateDailyScore(userId, date, sleep, hadWorkout);
    dailyScores.push(dailyScore);

    // Generate health metrics
    const metrics = generateHealthMetrics(userId, date, sleep, hadWorkout);
    healthMetrics.push(...metrics);
  }

  // Insert data
  console.log("\n📥 Inserting data...");

  // Insert workouts
  if (workouts.length > 0) {
    for (const w of workouts) {
      await sql`
        INSERT INTO workouts (user_id, type, name, duration_minutes, calories_burned, heart_rate_avg, heart_rate_max, started_at, ended_at, metadata)
        VALUES (${w.userId}, ${w.type}, ${w.name}, ${w.durationMinutes}, ${w.caloriesBurned}, ${w.heartRateAvg}, ${w.heartRateMax}, ${w.startedAt}, ${w.endedAt}, ${JSON.stringify(w.metadata)})
      `;
    }
    console.log(`   ✅ ${workouts.length} workouts`);
  }

  // Insert sleep sessions
  if (sleepSessions.length > 0) {
    for (const s of sleepSessions) {
      await sql`
        INSERT INTO sleep_sessions (user_id, bedtime, wake_time, sleep_date, total_minutes, in_bed_minutes, deep_sleep_minutes, rem_sleep_minutes, light_sleep_minutes, awake_minutes, sleep_score, efficiency, hrv_avg, resting_hr, respiratory_rate, source, metadata)
        VALUES (${s.userId}, ${s.bedtime}, ${s.wakeTime}, ${s.sleepDate}, ${s.totalMinutes}, ${s.inBedMinutes}, ${s.deepSleepMinutes}, ${s.remSleepMinutes}, ${s.lightSleepMinutes}, ${s.awakeMinutes}, ${s.sleepScore}, ${s.efficiency}, ${s.hrvAvg}, ${s.restingHr}, ${s.respiratoryRate}, ${s.source}, ${JSON.stringify(s.metadata)})
      `;
    }
    console.log(`   ✅ ${sleepSessions.length} sleep sessions`);
  }

  // Insert daily scores
  if (dailyScores.length > 0) {
    for (const d of dailyScores) {
      await sql`
        INSERT INTO daily_scores (user_id, date, sleep_score, recovery_score, strain_score, readiness_score, components)
        VALUES (${d.userId}, ${d.date}, ${d.sleepScore}, ${d.recoveryScore}, ${d.strainScore}, ${d.readinessScore}, ${JSON.stringify(d.components)})
        ON CONFLICT (user_id, date) DO UPDATE SET
          sleep_score = EXCLUDED.sleep_score,
          recovery_score = EXCLUDED.recovery_score,
          strain_score = EXCLUDED.strain_score,
          readiness_score = EXCLUDED.readiness_score,
          components = EXCLUDED.components
      `;
    }
    console.log(`   ✅ ${dailyScores.length} daily scores`);
  }

  // Insert health metrics
  if (healthMetrics.length > 0) {
    for (const m of healthMetrics) {
      await sql`
        INSERT INTO health_metrics (user_id, metric_type, value, unit, source, recorded_at)
        VALUES (${m.userId}, ${m.metricType}, ${m.value}, ${m.unit}, ${m.source}, ${m.recordedAt})
      `;
    }
    console.log(`   ✅ ${healthMetrics.length} health metrics`);
  }

  // Summary
  console.log("\n📋 Summary:");
  console.log("   ┌────────────────────────────────┐");

  // Show workout breakdown by type
  const workoutsByType: Record<string, number> = {};
  workouts.forEach((w) => {
    workoutsByType[w.type] = (workoutsByType[w.type] || 0) + 1;
  });
  console.log(`   │ Workouts: ${workouts.length}`);
  Object.entries(workoutsByType).forEach(([type, count]) => {
    console.log(`   │   - ${type}: ${count}`);
  });

  // Sleep stats
  const avgSleepHours = sleepSessions.reduce((sum, s) => sum + s.totalMinutes, 0) / sleepSessions.length / 60;
  const avgSleepScore = Math.round(sleepSessions.reduce((sum, s) => sum + s.sleepScore, 0) / sleepSessions.length);
  console.log(`   │ Sleep: ${sleepSessions.length} nights`);
  console.log(`   │   - Avg duration: ${avgSleepHours.toFixed(1)}h`);
  console.log(`   │   - Avg score: ${avgSleepScore}`);

  // Recovery stats
  const avgRecovery = Math.round(dailyScores.reduce((sum, d) => sum + d.recoveryScore, 0) / dailyScores.length);
  console.log(`   │ Recovery: avg ${avgRecovery}%`);
  console.log("   └────────────────────────────────┘");

  await sql.end();
  console.log("\n🎉 Done! Sample data generated successfully.");
}

// CLI entry point
const args = process.argv.slice(2);
const userId = args[0];
const daysBack = parseInt(args[1]) || 7;

if (!userId) {
  console.log("Usage: npx tsx scripts/generate-sample-data.ts <userId> [days]");
  console.log("");
  console.log("Arguments:");
  console.log("  userId  - The user ID to generate data for");
  console.log("  days    - Number of days of data to generate (default: 7)");
  console.log("");
  console.log("Example:");
  console.log("  npx tsx scripts/generate-sample-data.ts abc123-def456 14");
  console.log("");
  console.log("To find your user ID:");
  console.log("  psql olympus -c \"SELECT id, email FROM users;\"");
  process.exit(1);
}

generateSampleData(userId, daysBack).catch(console.error);
