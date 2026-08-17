/**
 * Selecting the physiological readings that describe a given night.
 *
 * HRV and resting heart rate arrive in `health_metrics` (types "hrv" and
 * "resting_heart_rate"), not on the sleep session — the Health Auto Export
 * webhook has never populated `sleep_sessions.hrv_avg`. Recovery wants the
 * measurement taken during the recovery period, so these read from a window
 * rather than taking "most recent ever", which would happily hand back a
 * three-day-old sample and present it as last night's.
 */

export interface MetricSample {
  value: number;
  recordedAt: Date;
}

/** Latest sample inside [from, to), or null if the window is empty. */
export function pickNightMetric(
  samples: MetricSample[],
  from: Date,
  to: Date
): number | null {
  let best: MetricSample | null = null;
  for (const s of samples) {
    if (s.recordedAt < from || s.recordedAt >= to) continue;
    if (!best || s.recordedAt > best.recordedAt) best = s;
  }
  return best ? best.value : null;
}

/** Mean of every sample inside [from, to), or null if the window is empty. */
export function meanInWindow(
  samples: MetricSample[],
  from: Date,
  to: Date
): number | null {
  let sum = 0;
  let n = 0;
  for (const s of samples) {
    if (s.recordedAt < from || s.recordedAt >= to) continue;
    sum += s.value;
    n += 1;
  }
  return n === 0 ? null : sum / n;
}

/**
 * Group raw metric rows by type in a single pass, converting `numeric` strings
 * to numbers once. Filtering the full day array per type instead would walk
 * ~16k rows several times over and re-parse every value.
 */
export function groupSamplesByType(
  rows: { metricType: string; value: string; recordedAt: Date }[]
): Map<string, MetricSample[]> {
  const out = new Map<string, MetricSample[]>();
  for (const r of rows) {
    let bucket = out.get(r.metricType);
    if (!bucket) {
      bucket = [];
      out.set(r.metricType, bucket);
    }
    bucket.push({ value: Number(r.value), recordedAt: r.recordedAt });
  }
  return out;
}
