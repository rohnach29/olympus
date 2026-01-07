import {
  HAEMetric,
  HAESleepData,
  HAEWorkout,
  METRIC_TYPE_MAP,
  WORKOUT_TYPE_MAP,
} from "./types";
import { NewHealthMetric, NewSleepSession, NewWorkout } from "@/lib/db";

/**
 * Map a Health Auto Export metric to Olympus healthMetrics format
 */
export function mapMetricToOlympus(
  userId: string,
  metric: HAEMetric
): NewHealthMetric[] {
  const metricType = METRIC_TYPE_MAP[metric.name];

  if (!metricType) {
    // Unknown metric type, skip
    return [];
  }

  return metric.data
    .filter((point) => point.qty != null && !isNaN(point.qty))
    .map((point) => ({
      userId,
      metricType,
      value: String(point.qty),
      unit: metric.units || null,
      source: "apple_health",
      recordedAt: new Date(point.date),
      metadata: {
        originalName: metric.name,
        originalSource: point.source,
      },
    }));
}

/**
 * Map Health Auto Export sleep data to Olympus sleepSessions format
 */
export function mapSleepToOlympus(
  userId: string,
  sleepData: HAESleepData
): NewSleepSession | null {
  // Skip if missing required timing data
  if (!sleepData.sleepStart || !sleepData.sleepEnd) {
    return null;
  }

  const bedtime = new Date(sleepData.sleepStart);
  const wakeTime = new Date(sleepData.sleepEnd);

  // Calculate sleep date (the night the sleep belongs to)
  // If bedtime is before 6am, use the previous day
  const sleepDate = new Date(bedtime);
  if (sleepDate.getHours() < 6) {
    sleepDate.setDate(sleepDate.getDate() - 1);
  }
  const sleepDateStr = sleepDate.toISOString().split("T")[0];

  // Total time in bed (minutes)
  const inBedMinutes = sleepData.inBed ||
    Math.round((wakeTime.getTime() - bedtime.getTime()) / (1000 * 60));

  // Total sleep (minutes) - sum of stages or use asleep if available
  const totalMinutes = sleepData.asleep ||
    (sleepData.deep || 0) + (sleepData.rem || 0) + (sleepData.core || 0);

  // Calculate efficiency
  const efficiency = inBedMinutes > 0
    ? ((totalMinutes / inBedMinutes) * 100).toFixed(1)
    : null;

  // Calculate awake minutes if not provided
  const awakeMinutes = sleepData.awake ||
    Math.max(0, inBedMinutes - totalMinutes);

  return {
    userId,
    bedtime,
    wakeTime,
    sleepDate: sleepDateStr,
    totalMinutes,
    inBedMinutes,
    deepSleepMinutes: sleepData.deep || 0,
    remSleepMinutes: sleepData.rem || 0,
    lightSleepMinutes: sleepData.core || 0, // "core" = light sleep
    awakeMinutes,
    sleepLatencyMinutes: 0, // Not provided by Health Auto Export
    efficiency,
    source: "apple_health",
    metadata: {
      originalSource: sleepData.source,
      importedAt: new Date().toISOString(),
    },
  };
}

/**
 * Map Health Auto Export workout to Olympus workouts format
 */
export function mapWorkoutToOlympus(
  userId: string,
  workout: HAEWorkout
): NewWorkout {
  const startedAt = new Date(workout.start);
  const endedAt = new Date(workout.end);

  // Calculate duration in minutes
  const durationMinutes = workout.duration
    ? Math.round(workout.duration / 60)
    : Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60));

  // Get workout type
  const type = WORKOUT_TYPE_MAP[workout.name] || "other";

  // Extract heart rate data if available
  let heartRateAvg: number | null = null;
  let heartRateMax: number | null = null;

  if (workout.heartRateData && workout.heartRateData.length > 0) {
    const hrValues = workout.heartRateData.map((hr) => hr.qty);
    heartRateAvg = Math.round(
      hrValues.reduce((a, b) => a + b, 0) / hrValues.length
    );
    heartRateMax = Math.max(...hrValues);
  }

  // Extract calories
  const caloriesBurned = workout.activeEnergyBurned?.qty
    ? Math.round(workout.activeEnergyBurned.qty)
    : null;

  return {
    userId,
    type,
    name: workout.name,
    durationMinutes,
    caloriesBurned,
    heartRateAvg,
    heartRateMax,
    startedAt,
    endedAt,
    metadata: {
      source: "apple_health",
      originalId: workout.id,
      originalSource: workout.source,
      importedAt: new Date().toISOString(),
    },
  };
}

/**
 * Extract sleep data from metrics array
 * Health Auto Export can export sleep as a metric with nested structure
 */
export function extractSleepFromMetrics(
  metrics: HAEMetric[]
): HAESleepData[] {
  const sleepMetric = metrics.find(
    (m) => m.name === "sleep_analysis" || m.name === "sleepAnalysis"
  );

  if (!sleepMetric) {
    return [];
  }

  // Sleep data might be in the data array with nested structure
  // This varies by Health Auto Export version, so handle both formats
  return sleepMetric.data.map((point) => {
    // If it's the simple format
    if ("sleepStart" in point) {
      return point as unknown as HAESleepData;
    }

    // If it's just a date/qty format, we can't extract sleep stages
    return {
      date: point.date,
      asleep: point.qty, // qty might be total sleep minutes
    };
  });
}

/**
 * Extract unique timestamps from the payload for idempotency
 */
export function extractTimestamps(metrics: HAEMetric[], workouts: HAEWorkout[]): string[] {
  const timestamps: string[] = [];

  for (const metric of metrics) {
    for (const point of metric.data) {
      timestamps.push(point.date);
    }
  }

  for (const workout of workouts) {
    timestamps.push(workout.start);
    timestamps.push(workout.end);
  }

  return timestamps;
}
