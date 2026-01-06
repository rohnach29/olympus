/**
 * Evidence-based sleep scoring algorithm
 * Based on Pittsburgh Sleep Quality Index (PSQI) research
 *
 * Components and weights:
 * - Duration: 20% (optimal 7-9 hours)
 * - Efficiency: 20% (time asleep / time in bed)
 * - Deep Sleep: 15% (optimal 15-20%)
 * - REM Sleep: 15% (optimal 20-25%)
 * - Latency: 10% (time to fall asleep)
 * - Awakenings: 10% (time awake during night)
 * - HRV: 10% (compared to personal baseline)
 */

// Types
export interface SleepSessionData {
  totalMinutes: number;
  inBedMinutes: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  awakeMinutes: number;
  sleepLatencyMinutes: number;
  hrvAvg: number | null;
}

export interface PersonalBaseline {
  hrvAvg: number;
  hrvStdDev: number;
  deepSleepPercent: number;
  remSleepPercent: number;
  avgDurationMinutes: number;
}

export interface SleepScoreComponent {
  score: number;
  value: number | null;
  weight: number;
  label: string;
}

export interface SleepScoreComponents {
  duration: SleepScoreComponent;
  efficiency: SleepScoreComponent;
  deepSleep: SleepScoreComponent;
  remSleep: SleepScoreComponent;
  latency: SleepScoreComponent;
  awakenings: SleepScoreComponent;
  hrv: SleepScoreComponent;
}

export interface SleepScoreResult {
  totalScore: number;
  components: SleepScoreComponents;
  quality: "excellent" | "good" | "fair" | "poor";
  recommendations: string[];
}

// Component weights (must sum to 1.0)
const WEIGHTS = {
  duration: 0.2,
  efficiency: 0.2,
  deepSleep: 0.15,
  remSleep: 0.15,
  latency: 0.1,
  awakenings: 0.1,
  hrv: 0.1,
} as const;

/**
 * Score sleep duration
 * Optimal: 7-9 hours = 100
 * Suboptimal: 6-7 hours = 75
 * Poor: <6 hours or >9 hours = 50
 */
export function scoreDuration(totalMinutes: number): number {
  const hours = totalMinutes / 60;
  if (hours >= 7 && hours <= 9) return 100;
  if (hours >= 6 && hours < 7) return 75;
  if (hours > 9 && hours <= 10) return 75; // Slightly over is okay
  return 50;
}

/**
 * Score sleep efficiency (time asleep / time in bed)
 * Based on PSQI thresholds
 */
export function scoreEfficiency(
  totalMinutes: number,
  inBedMinutes: number
): number {
  if (inBedMinutes === 0) return 0;
  const efficiency = (totalMinutes / inBedMinutes) * 100;
  if (efficiency >= 85) return 100;
  if (efficiency >= 75) return 75;
  if (efficiency >= 65) return 50;
  return 25;
}

/**
 * Score deep sleep percentage
 * Optimal: 15-20% of total sleep
 */
export function scoreDeepSleep(
  deepMinutes: number,
  totalMinutes: number
): number {
  if (totalMinutes === 0) return 0;
  const percent = (deepMinutes / totalMinutes) * 100;
  if (percent >= 15 && percent <= 20) return 100;
  if (percent >= 10 && percent < 15) return 75;
  if (percent > 20 && percent <= 25) return 75; // Slightly over is fine
  return 50;
}

/**
 * Score REM sleep percentage
 * Optimal: 20-25% of total sleep
 */
export function scoreRemSleep(remMinutes: number, totalMinutes: number): number {
  if (totalMinutes === 0) return 0;
  const percent = (remMinutes / totalMinutes) * 100;
  if (percent >= 20 && percent <= 25) return 100;
  if (percent >= 15 && percent < 20) return 75;
  if (percent > 25 && percent <= 30) return 75; // Slightly over is fine
  return 50;
}

/**
 * Score sleep latency (time to fall asleep)
 * Based on PSQI: <15min is ideal
 */
export function scoreLatency(latencyMinutes: number): number {
  if (latencyMinutes < 15) return 100;
  if (latencyMinutes <= 30) return 75;
  if (latencyMinutes <= 60) return 50;
  return 25;
}

/**
 * Score awakenings (time awake during night)
 */
export function scoreAwakenings(awakeMinutes: number): number {
  if (awakeMinutes < 5) return 100;
  if (awakeMinutes <= 15) return 75;
  if (awakeMinutes <= 30) return 50;
  return 25;
}

/**
 * Score HRV compared to personal baseline using z-score
 * Higher HRV during sleep indicates better recovery
 */
export function scoreHrv(
  hrvAvg: number | null,
  baseline: PersonalBaseline | null
): number {
  // No data available - return neutral score
  if (hrvAvg === null) return 75;

  // No baseline - use population-based scoring
  if (baseline === null) {
    // General population: 50+ ms is good during sleep
    if (hrvAvg >= 60) return 100;
    if (hrvAvg >= 50) return 85;
    if (hrvAvg >= 40) return 70;
    if (hrvAvg >= 30) return 55;
    return 40;
  }

  // Compare to personal baseline using z-score
  const stdDev = baseline.hrvStdDev || 10; // Default if no variance
  const zScore = (hrvAvg - baseline.hrvAvg) / stdDev;

  if (zScore >= 0.5) return 100; // Above average
  if (zScore >= -0.5) return 75; // Within normal range
  if (zScore >= -1.0) return 50; // Slightly below
  return 25; // Significantly below baseline
}

/**
 * Calculate personal baseline from historical sleep data
 * Requires at least 7 sessions for reliable baseline
 */
export function calculatePersonalBaseline(
  sessions: SleepSessionData[]
): PersonalBaseline | null {
  if (sessions.length < 7) return null;

  // Use last 14 days max
  const recentSessions = sessions.slice(0, 14);

  // Calculate HRV baseline
  const hrvValues = recentSessions
    .filter((s) => s.hrvAvg !== null)
    .map((s) => s.hrvAvg as number);

  if (hrvValues.length < 5) return null;

  const hrvAvg = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
  const hrvVariance =
    hrvValues.reduce((sum, val) => sum + Math.pow(val - hrvAvg, 2), 0) /
    hrvValues.length;
  const hrvStdDev = Math.sqrt(hrvVariance) || 10;

  // Calculate sleep stage baselines
  const deepPercents = recentSessions.map((s) =>
    s.totalMinutes > 0 ? (s.deepSleepMinutes / s.totalMinutes) * 100 : 0
  );
  const remPercents = recentSessions.map((s) =>
    s.totalMinutes > 0 ? (s.remSleepMinutes / s.totalMinutes) * 100 : 0
  );

  return {
    hrvAvg,
    hrvStdDev,
    deepSleepPercent:
      deepPercents.reduce((a, b) => a + b, 0) / deepPercents.length,
    remSleepPercent:
      remPercents.reduce((a, b) => a + b, 0) / remPercents.length,
    avgDurationMinutes:
      recentSessions.reduce((sum, s) => sum + s.totalMinutes, 0) /
      recentSessions.length,
  };
}

/**
 * Generate actionable recommendations based on score components
 */
export function generateRecommendations(
  components: SleepScoreComponents
): string[] {
  const recommendations: string[] = [];

  if (components.duration.score < 75) {
    const hours = (components.duration.value || 0) / 60;
    if (hours < 7) {
      recommendations.push(
        "Aim for 7-9 hours of sleep. Consider going to bed 30 minutes earlier."
      );
    } else {
      recommendations.push(
        "You may be oversleeping. Try maintaining a consistent 7-9 hour schedule."
      );
    }
  }

  if (components.efficiency.score < 75) {
    recommendations.push(
      "Improve sleep efficiency by only going to bed when sleepy and keeping a consistent schedule."
    );
  }

  if (components.deepSleep.score < 75) {
    recommendations.push(
      "To increase deep sleep: exercise earlier in the day, avoid alcohol, and keep your room cool (65-68°F)."
    );
  }

  if (components.remSleep.score < 75) {
    recommendations.push(
      "To improve REM sleep: reduce caffeine after noon, limit screen time before bed, and maintain consistent sleep times."
    );
  }

  if (components.latency.score < 75) {
    recommendations.push(
      "Taking too long to fall asleep? Try relaxation techniques, avoid screens 1 hour before bed, or consider a wind-down routine."
    );
  }

  if (components.awakenings.score < 75) {
    recommendations.push(
      "Reduce nighttime awakenings by keeping your bedroom dark, quiet, and cool. Avoid liquids 2 hours before bed."
    );
  }

  if (components.hrv.score < 75) {
    recommendations.push(
      "Your HRV is below your baseline, indicating lower recovery. Prioritize rest and stress management today."
    );
  }

  return recommendations;
}

/**
 * Get quality label based on total score
 */
function getQualityLabel(
  score: number
): "excellent" | "good" | "fair" | "poor" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/**
 * Main function: Calculate comprehensive sleep score
 */
export function calculateSleepScore(
  session: SleepSessionData,
  baseline: PersonalBaseline | null
): SleepScoreResult {
  const efficiency =
    session.inBedMinutes > 0
      ? (session.totalMinutes / session.inBedMinutes) * 100
      : 0;

  const deepPercent =
    session.totalMinutes > 0
      ? (session.deepSleepMinutes / session.totalMinutes) * 100
      : 0;

  const remPercent =
    session.totalMinutes > 0
      ? (session.remSleepMinutes / session.totalMinutes) * 100
      : 0;

  // Calculate individual component scores
  const components: SleepScoreComponents = {
    duration: {
      score: scoreDuration(session.totalMinutes),
      value: session.totalMinutes,
      weight: WEIGHTS.duration,
      label: "Duration",
    },
    efficiency: {
      score: scoreEfficiency(session.totalMinutes, session.inBedMinutes),
      value: Math.round(efficiency * 10) / 10,
      weight: WEIGHTS.efficiency,
      label: "Efficiency",
    },
    deepSleep: {
      score: scoreDeepSleep(session.deepSleepMinutes, session.totalMinutes),
      value: Math.round(deepPercent * 10) / 10,
      weight: WEIGHTS.deepSleep,
      label: "Deep Sleep",
    },
    remSleep: {
      score: scoreRemSleep(session.remSleepMinutes, session.totalMinutes),
      value: Math.round(remPercent * 10) / 10,
      weight: WEIGHTS.remSleep,
      label: "REM Sleep",
    },
    latency: {
      score: scoreLatency(session.sleepLatencyMinutes),
      value: session.sleepLatencyMinutes,
      weight: WEIGHTS.latency,
      label: "Time to Sleep",
    },
    awakenings: {
      score: scoreAwakenings(session.awakeMinutes),
      value: session.awakeMinutes,
      weight: WEIGHTS.awakenings,
      label: "Awakenings",
    },
    hrv: {
      score: scoreHrv(session.hrvAvg, baseline),
      value: session.hrvAvg,
      weight: WEIGHTS.hrv,
      label: "HRV",
    },
  };

  // Calculate weighted total score
  const totalScore = Math.round(
    components.duration.score * WEIGHTS.duration +
      components.efficiency.score * WEIGHTS.efficiency +
      components.deepSleep.score * WEIGHTS.deepSleep +
      components.remSleep.score * WEIGHTS.remSleep +
      components.latency.score * WEIGHTS.latency +
      components.awakenings.score * WEIGHTS.awakenings +
      components.hrv.score * WEIGHTS.hrv
  );

  const recommendations = generateRecommendations(components);
  const quality = getQualityLabel(totalScore);

  return {
    totalScore,
    components,
    quality,
    recommendations,
  };
}
