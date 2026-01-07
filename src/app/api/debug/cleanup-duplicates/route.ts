import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, healthMetrics, sleepSessions, workouts } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

/**
 * DELETE /api/debug/cleanup-duplicates
 *
 * Removes duplicate records, keeping only the first one for each unique combination.
 * Run this BEFORE running db:push to add unique constraints.
 *
 * DELETE THIS ENDPOINT IN PRODUCTION!
 */
export async function DELETE() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    healthMetricsDuplicatesRemoved: 0,
    sleepSessionsDuplicatesRemoved: 0,
    workoutsDuplicatesRemoved: 0,
  };

  // 1. Clean up duplicate health metrics
  // Keep the first record for each (userId, metricType, recordedAt) combination
  const metricsDeleted = await db.execute(sql`
    WITH duplicates AS (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, metric_type, recorded_at
                 ORDER BY created_at ASC
               ) as rn
        FROM health_metrics
        WHERE user_id = ${user.id}
      ) t
      WHERE rn > 1
    )
    DELETE FROM health_metrics WHERE id IN (SELECT id FROM duplicates)
    RETURNING id
  `);
  results.healthMetricsDuplicatesRemoved = (metricsDeleted as unknown[]).length;

  // 2. Clean up duplicate sleep sessions
  // Keep the first record for each (userId, sleepDate, source) combination
  const sleepDeleted = await db.execute(sql`
    WITH duplicates AS (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, sleep_date, source
                 ORDER BY created_at ASC
               ) as rn
        FROM sleep_sessions
        WHERE user_id = ${user.id}
      ) t
      WHERE rn > 1
    )
    DELETE FROM sleep_sessions WHERE id IN (SELECT id FROM duplicates)
    RETURNING id
  `);
  results.sleepSessionsDuplicatesRemoved = (sleepDeleted as unknown[]).length;

  // 3. Clean up duplicate workouts
  // Keep the first record for each (userId, startedAt, type) combination
  const workoutsDeleted = await db.execute(sql`
    WITH duplicates AS (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, started_at, type
                 ORDER BY created_at ASC
               ) as rn
        FROM workouts
        WHERE user_id = ${user.id}
      ) t
      WHERE rn > 1
    )
    DELETE FROM workouts WHERE id IN (SELECT id FROM duplicates)
    RETURNING id
  `);
  results.workoutsDuplicatesRemoved = (workoutsDeleted as unknown[]).length;

  return NextResponse.json({
    message: "Duplicate cleanup complete",
    results,
  });
}

// GET to preview how many duplicates exist
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Count duplicates in health_metrics
  const metricsDupes = await db.execute(sql`
    SELECT COUNT(*) as count FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY user_id, metric_type, recorded_at
               ORDER BY created_at ASC
             ) as rn
      FROM health_metrics
      WHERE user_id = ${user.id}
    ) t
    WHERE rn > 1
  `);

  // Count duplicates in sleep_sessions
  const sleepDupes = await db.execute(sql`
    SELECT COUNT(*) as count FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY user_id, sleep_date, source
               ORDER BY created_at ASC
             ) as rn
      FROM sleep_sessions
      WHERE user_id = ${user.id}
    ) t
    WHERE rn > 1
  `);

  // Count duplicates in workouts
  const workoutDupes = await db.execute(sql`
    SELECT COUNT(*) as count FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY user_id, started_at, type
               ORDER BY created_at ASC
             ) as rn
      FROM workouts
      WHERE user_id = ${user.id}
    ) t
    WHERE rn > 1
  `);

  const getCount = (result: unknown) => {
    const rows = result as { count: string }[];
    return Number(rows[0]?.count) || 0;
  };

  return NextResponse.json({
    duplicates: {
      healthMetrics: getCount(metricsDupes),
      sleepSessions: getCount(sleepDupes),
      workouts: getCount(workoutDupes),
    },
  });
}
