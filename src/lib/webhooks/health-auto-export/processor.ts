import { db, healthMetrics, sleepSessions, workouts, webhookLogs, apiTokens } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { generateIdempotencyKey } from "@/lib/utils/token";
import {
  HAEPayload,
  ProcessingResult,
} from "./types";
import {
  mapMetricToOlympus,
  mapSleepToOlympus,
  mapWorkoutToOlympus,
  extractSleepFromMetrics,
  extractTimestamps,
} from "./mappers";
import { calculateSleepScore, calculatePersonalBaseline } from "@/lib/utils/sleep-scoring";

/**
 * Process Health Auto Export webhook payload
 */
export async function processHealthAutoExport(
  userId: string,
  tokenId: string,
  payload: HAEPayload
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    metricsProcessed: 0,
    sleepSessionsProcessed: 0,
    workoutsProcessed: 0,
    errors: [],
    status: "success",
  };

  const metricsArray = payload.data.metrics || [];
  const workoutsArray = payload.data.workouts || [];

  // Generate idempotency key
  const timestamps = extractTimestamps(metricsArray, workoutsArray);
  const idempotencyKey = generateIdempotencyKey(userId, timestamps);

  // Check for duplicate request - only skip if previous attempt SUCCEEDED
  const [existingLog] = await db
    .select()
    .from(webhookLogs)
    .where(
      and(
        eq(webhookLogs.userId, userId),
        eq(webhookLogs.idempotencyKey, idempotencyKey),
        eq(webhookLogs.status, "success") // Only treat as duplicate if it succeeded before
      )
    )
    .limit(1);

  if (existingLog) {
    result.status = "success"; // Treat duplicates as successful (idempotent)
    result.errors.push("Duplicate request - already processed");

    return result; // Don't log duplicates, just return
  }

  // Clean up any previous failed attempts with this key
  await db
    .delete(webhookLogs)
    .where(
      and(
        eq(webhookLogs.userId, userId),
        eq(webhookLogs.idempotencyKey, idempotencyKey)
      )
    );

  try {
    // 1. Process health metrics
    const unmappedMetrics: string[] = [];

    for (const metric of metricsArray) {
      // Skip sleep_analysis as we handle it separately
      if (metric.name === "sleep_analysis" || metric.name === "sleepAnalysis") {
        continue;
      }

      const mappedMetrics = mapMetricToOlympus(userId, metric);

      // Track metrics that didn't map (for debugging)
      if (mappedMetrics.length === 0 && metric.data.length > 0) {
        unmappedMetrics.push(metric.name);
      }

      for (const mapped of mappedMetrics) {
        try {
          // UPSERT: Insert if not exists, do nothing if duplicate
          // The unique constraint (userId, metricType, recordedAt) prevents duplicates
          const inserted = await db
            .insert(healthMetrics)
            .values(mapped)
            .onConflictDoNothing()
            .returning({ id: healthMetrics.id });

          if (inserted.length > 0) {
            result.metricsProcessed++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          result.errors.push(`Metric ${metric.name}: ${message}`);
        }
      }
    }

    // 2. Process sleep data
    const sleepDataArray = extractSleepFromMetrics(metricsArray);
    for (const sleepData of sleepDataArray) {
      try {
        const mapped = mapSleepToOlympus(userId, sleepData);

        if (!mapped) {
          continue; // Skip invalid sleep data
        }

        // Calculate sleep score using existing scoring algorithm
        let sleepScore: number | null = null;

        try {
          // Get user's sleep history for baseline
          const historyRaw = await db
            .select()
            .from(sleepSessions)
            .where(eq(sleepSessions.userId, userId))
            .orderBy(sql`${sleepSessions.sleepDate} DESC`)
            .limit(14);

          // Map to non-nullable values for baseline calculation
          const history = historyRaw.map((s) => ({
            totalMinutes: s.totalMinutes,
            inBedMinutes: s.inBedMinutes,
            deepSleepMinutes: s.deepSleepMinutes ?? 0,
            remSleepMinutes: s.remSleepMinutes ?? 0,
            lightSleepMinutes: s.lightSleepMinutes ?? 0,
            awakeMinutes: s.awakeMinutes ?? 0,
            sleepLatencyMinutes: s.sleepLatencyMinutes ?? 0,
            hrvAvg: s.hrvAvg,
          }));

          const baseline = calculatePersonalBaseline(history);

          const scoreResult = calculateSleepScore(
            {
              totalMinutes: mapped.totalMinutes,
              inBedMinutes: mapped.inBedMinutes,
              deepSleepMinutes: mapped.deepSleepMinutes ?? 0,
              remSleepMinutes: mapped.remSleepMinutes ?? 0,
              lightSleepMinutes: mapped.lightSleepMinutes ?? 0,
              sleepLatencyMinutes: mapped.sleepLatencyMinutes ?? 0,
              awakeMinutes: mapped.awakeMinutes ?? 0,
              hrvAvg: null, // Not available from sleep data
            },
            baseline
          );

          sleepScore = scoreResult.totalScore;
        } catch (scoreErr) {
          // Score calculation failed, continue without score
          console.error("Sleep score calculation failed:", scoreErr);
        }

        // UPSERT: Insert if not exists, do nothing if duplicate
        // The unique constraint (userId, sleepDate, source) prevents duplicates
        const inserted = await db
          .insert(sleepSessions)
          .values({
            ...mapped,
            sleepScore,
          })
          .onConflictDoNothing()
          .returning({ id: sleepSessions.id });

        if (inserted.length > 0) {
          result.sleepSessionsProcessed++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        result.errors.push(`Sleep data: ${message}`);
      }
    }

    // 3. Process workouts
    for (const workout of workoutsArray) {
      try {
        // Debug: Log the heart rate data structure to understand format
        if (workout.heartRateData) {
          console.log(`[DEBUG] Workout "${workout.name}" heartRateData:`, JSON.stringify(workout.heartRateData).slice(0, 500));
        } else {
          console.log(`[DEBUG] Workout "${workout.name}" has no heartRateData field. Available fields:`, Object.keys(workout));
        }

        const mapped = mapWorkoutToOlympus(userId, workout);

        // UPSERT: Insert if not exists, do nothing if duplicate
        // The unique constraint (userId, startedAt, type) prevents duplicates
        const inserted = await db
          .insert(workouts)
          .values(mapped)
          .onConflictDoNothing()
          .returning({ id: workouts.id });

        if (inserted.length > 0) {
          result.workoutsProcessed++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        result.errors.push(`Workout ${workout.name}: ${message}`);
      }
    }

    // Log unmapped metrics for debugging
    if (unmappedMetrics.length > 0) {
      result.errors.push(`Unmapped metrics (not stored): ${unmappedMetrics.join(", ")}`);
    }

    // Determine final status
    if (result.errors.length > 0 && result.metricsProcessed === 0 && result.sleepSessionsProcessed === 0 && result.workoutsProcessed === 0) {
      result.status = "failed";
    } else if (result.errors.length > 0) {
      result.status = "partial";
    }

    // 4. Log the webhook request
    await db.insert(webhookLogs).values({
      userId,
      tokenId,
      idempotencyKey,
      status: result.status,
      metricsProcessed: result.metricsProcessed,
      sleepSessionsProcessed: result.sleepSessionsProcessed,
      workoutsProcessed: result.workoutsProcessed,
      errors: result.errors.length > 0 ? result.errors : [],
    });

    // 5. Update token stats
    await db
      .update(apiTokens)
      .set({
        lastUsedAt: new Date(),
        requestCount: sql`${apiTokens.requestCount} + 1`,
      })
      .where(eq(apiTokens.id, tokenId));

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    result.status = "failed";
    result.errors.push(`Processing failed: ${message}`);

    // Log the failure
    await db.insert(webhookLogs).values({
      userId,
      tokenId,
      idempotencyKey,
      status: "failed",
      errors: result.errors,
    });

    return result;
  }
}
