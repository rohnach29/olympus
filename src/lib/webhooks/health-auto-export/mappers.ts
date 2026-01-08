import {
  HAEMetric,
  HAESleepData,
  HAEWorkout,
  METRIC_TYPE_MAP,
  WORKOUT_TYPE_MAP,
} from "./types";
import { NewHealthMetric, NewSleepSession, NewWorkout } from "@/lib/db";

/**
 * Cumulative metrics that should have timestamps rounded to the nearest minute.
 * This prevents duplicate records when the same sample is exported multiple times
 * with slightly different timestamps (e.g., 02:47:00 vs 02:47:04).
 */
const CUMULATIVE_METRICS = [
  'steps', 'calories_active', 'calories_basal', 'distance',
  'exercise_minutes', 'flights_climbed', 'stand_hours'
];

/**
 * Round a date to the nearest minute (removes seconds and milliseconds)
 */
function roundToMinute(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  return rounded;
}

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

  // For cumulative metrics, round timestamp to the minute to prevent duplicates
  const shouldRoundTimestamp = CUMULATIVE_METRICS.includes(metricType);

  return metric.data
    .filter((point) => point.qty != null && !isNaN(point.qty))
    .map((point) => {
      const rawDate = new Date(point.date);
      const recordedAt = shouldRoundTimestamp ? roundToMinute(rawDate) : rawDate;

      return {
        userId,
        metricType,
        value: String(point.qty),
        unit: metric.units || null,
        source: "apple_health",
        recordedAt,
        metadata: {
          originalName: metric.name,
          originalSource: point.source,
        },
      };
    });
}

/**
 * Map Health Auto Export sleep data to Olympus sleepSessions format
 *
 * NOTE: Health Auto Export sends sleep durations in HOURS, not minutes!
 * We need to convert and round to integers for the database.
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

  // Helper: Convert hours to minutes (HAE sends hours) and round to integer
  const hoursToMinutes = (hours: number | undefined): number => {
    if (!hours) return 0;
    // If value is small (< 24), it's probably hours - convert to minutes
    // If value is large (>= 24), it's probably already minutes
    const value = hours < 24 ? hours * 60 : hours;
    return Math.round(value);
  };

  // Calculate time in bed from timestamps (this is always accurate)
  const inBedMinutesFromTimestamps = Math.round(
    (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60)
  );

  // Use timestamp-based calculation as primary, fall back to provided value
  const inBedMinutes = inBedMinutesFromTimestamps || hoursToMinutes(sleepData.inBed);

  // Convert sleep stage durations from hours to minutes
  const deepSleepMinutes = hoursToMinutes(sleepData.deep);
  const remSleepMinutes = hoursToMinutes(sleepData.rem);
  const lightSleepMinutes = hoursToMinutes(sleepData.core); // "core" = light sleep
  const awakeMinutesRaw = hoursToMinutes(sleepData.awake);

  // Total sleep = sum of stages, or use provided asleep value
  const totalMinutes = sleepData.asleep
    ? hoursToMinutes(sleepData.asleep)
    : deepSleepMinutes + remSleepMinutes + lightSleepMinutes;

  // Calculate efficiency
  const efficiency = inBedMinutes > 0
    ? ((totalMinutes / inBedMinutes) * 100).toFixed(1)
    : null;

  // Calculate awake minutes if not provided
  const awakeMinutes = awakeMinutesRaw || Math.max(0, inBedMinutes - totalMinutes);

  return {
    userId,
    bedtime,
    wakeTime,
    sleepDate: sleepDateStr,
    totalMinutes,
    inBedMinutes,
    deepSleepMinutes,
    remSleepMinutes,
    lightSleepMinutes,
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
