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
    .map((point) => {
      // heart_rate points carry Min/Avg/Max instead of qty — use Avg as the value
      const qty = point.qty ?? point.Avg;
      if (qty == null || isNaN(qty)) return null;

      const rawDate = new Date(point.date);
      const recordedAt = shouldRoundTimestamp ? roundToMinute(rawDate) : rawDate;

      return {
        userId,
        metricType,
        value: String(qty),
        unit: metric.units || null,
        source: "apple_health",
        recordedAt,
        metadata: {
          originalName: metric.name,
          originalSource: point.source,
          ...(point.Min != null && { min: point.Min }),
          ...(point.Max != null && { max: point.Max }),
        },
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
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

  // Time in bed: trust whichever figure is larger.
  //
  // sleepStart/sleepEnd bracket the *asleep* period, so the span between them
  // omits the time spent in bed awake at either end — Apple's own inBed figure
  // includes it. Taking the max keeps the larger, more complete number whether
  // or not the export carried an explicit inBed value, instead of silently
  // reporting a shorter night than the watch does.
  const inBedMinutesFromTimestamps = Math.round(
    (wakeTime.getTime() - bedtime.getTime()) / (1000 * 60)
  );
  const inBedMinutes = Math.max(
    inBedMinutesFromTimestamps,
    hoursToMinutes(sleepData.inBed)
  );

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
 * Combine the segments of one night into a single sleep session.
 *
 * An interrupted night arrives from Health Auto Export as several sleep
 * entries. The database holds one row per (user, night, source), so inserting
 * them one at a time meant the first segment won and the rest were dropped —
 * a night recorded as ending at 03:34 when the sleeper actually got up at
 * 06:34. Durations are summed rather than measured across the whole span, so
 * a two-hour gap in the middle of the night is not counted as time in bed.
 */
export function mergeSleepSegments(
  sessions: NewSleepSession[]
): NewSleepSession[] {
  const byNight = new Map<string, NewSleepSession[]>();
  for (const s of sessions) {
    const key = `${s.sleepDate}|${s.source ?? "unknown"}`;
    const bucket = byNight.get(key);
    if (bucket) bucket.push(s);
    else byNight.set(key, [s]);
  }

  return [...byNight.values()].map((segments) => {
    if (segments.length === 1) return segments[0];

    const sum = (pick: (s: NewSleepSession) => number | null | undefined) =>
      segments.reduce((total, s) => total + (pick(s) ?? 0), 0);

    const bedtime = new Date(
      Math.min(...segments.map((s) => s.bedtime.getTime()))
    );
    const wakeTime = new Date(
      Math.max(...segments.map((s) => s.wakeTime.getTime()))
    );
    const totalMinutes = sum((s) => s.totalMinutes);
    const inBedMinutes = sum((s) => s.inBedMinutes);

    return {
      ...segments[0],
      bedtime,
      wakeTime,
      totalMinutes,
      inBedMinutes,
      deepSleepMinutes: sum((s) => s.deepSleepMinutes),
      remSleepMinutes: sum((s) => s.remSleepMinutes),
      lightSleepMinutes: sum((s) => s.lightSleepMinutes),
      awakeMinutes: sum((s) => s.awakeMinutes),
      sleepLatencyMinutes: sum((s) => s.sleepLatencyMinutes),
      efficiency:
        inBedMinutes > 0
          ? ((totalMinutes / inBedMinutes) * 100).toFixed(1)
          : null,
      metadata: {
        ...(typeof segments[0].metadata === "object" && segments[0].metadata !== null
          ? segments[0].metadata
          : {}),
        segments: segments.length,
      },
    };
  });
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
  // Health Auto Export sends: { Avg, Min, Max, date, units, source } per sample
  let heartRateAvg: number | null = null;
  let heartRateMax: number | null = null;

  if (workout.heartRateData && workout.heartRateData.length > 0) {
    // Get all valid Avg values to compute overall average
    const avgValues = workout.heartRateData
      .map((hr) => hr.Avg)
      .filter((val): val is number => typeof val === "number" && !isNaN(val) && isFinite(val));

    // Get all valid Max values to find the peak HR during workout
    const maxValues = workout.heartRateData
      .map((hr) => hr.Max)
      .filter((val): val is number => typeof val === "number" && !isNaN(val) && isFinite(val));

    if (avgValues.length > 0) {
      const avg = avgValues.reduce((a, b) => a + b, 0) / avgValues.length;
      heartRateAvg = !isNaN(avg) && isFinite(avg) ? Math.round(avg) : null;
    }

    if (maxValues.length > 0) {
      const max = Math.max(...maxValues);
      heartRateMax = !isNaN(max) && isFinite(max) ? Math.round(max) : null;
    }
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
