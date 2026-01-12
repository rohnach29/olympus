/**
 * MVP Sleep Scoring Algorithm (0-100 scale)
 * Uses linear decay between thresholds for smooth scoring.
 *
 * Components and weights:
 * - Duration: 40 pts (target ≥7.5h, zero ≤4.5h)
 * - WASO/Awakenings: 30 pts (target ≤15min, zero ≥60min)
 * - Deep Sleep: 15 pts (target ≥15%, zero ≤5%)
 * - REM Sleep: 15 pts (target ≥20%, zero ≤5%)
 *
 * Data Handling:
 * - If Deep/REM data missing (sensor error), redistribute to Duration (70%) + WASO (30%)
 * - WASO = Wake After Sleep Onset (awake time between sleep start and end)
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
  deepSleep: SleepScoreComponent;
  remSleep: SleepScoreComponent;
  awakenings: SleepScoreComponent;
}

export interface SleepScoreResult {
  totalScore: number;
  components: SleepScoreComponents;
  quality: "excellent" | "good" | "fair" | "poor";
  recommendations: string[];
}

// Component weights (must sum to 100)
const WEIGHTS = {
  duration: 40,
  awakenings: 30,
  deepSleep: 15,
  remSleep: 15,
} as const;

/**
 * Score sleep duration (40 pts max)
 * Target: ≥7.5 hours = 40 pts
 * Zero: ≤4.5 hours = 0 pts
 * Linear scale between thresholds
 */
export function scoreDuration(totalMinutes: number): number {
  const hours = totalMinutes / 60;
  if (hours >= 7.5) return WEIGHTS.duration;
  if (hours <= 4.5) return 0;
  // Linear scale: (hours - 4.5) / (7.5 - 4.5) * 40
  return Math.round(((hours - 4.5) / 3) * WEIGHTS.duration);
}

/**
 * Score deep sleep percentage (15 pts max)
 * Target: ≥15% = 15 pts
 * Zero: ≤5% = 0 pts
 * Linear scale between thresholds
 */
export function scoreDeepSleep(
  deepMinutes: number,
  totalMinutes: number
): number {
  if (totalMinutes === 0) return 0;
  const percent = (deepMinutes / totalMinutes) * 100;
  if (percent >= 15) return WEIGHTS.deepSleep;
  if (percent <= 5) return 0;
  // Linear scale: (percent - 5) / (15 - 5) * 15
  return Math.round(((percent - 5) / 10) * WEIGHTS.deepSleep);
}

/**
 * Score REM sleep percentage (15 pts max)
 * Target: ≥20% = 15 pts
 * Zero: ≤5% = 0 pts
 * Linear scale between thresholds
 */
export function scoreRemSleep(remMinutes: number, totalMinutes: number): number {
  if (totalMinutes === 0) return 0;
  const percent = (remMinutes / totalMinutes) * 100;
  if (percent >= 20) return WEIGHTS.remSleep;
  if (percent <= 5) return 0;
  // Linear scale: (percent - 5) / (20 - 5) * 15
  return Math.round(((percent - 5) / 15) * WEIGHTS.remSleep);
}

/**
 * Score WASO/awakenings (30 pts max)
 * Target: ≤15 min = 30 pts
 * Zero: ≥60 min = 0 pts
 * Linear inverse scale between thresholds
 */
export function scoreAwakenings(wasoMinutes: number): number {
  if (wasoMinutes <= 15) return WEIGHTS.awakenings;
  if (wasoMinutes >= 60) return 0;
  // Linear inverse: (60 - wasoMinutes) / (60 - 15) * 30
  return Math.round(((60 - wasoMinutes) / 45) * WEIGHTS.awakenings);
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
 * Thresholds based on 75% of max points for each component
 */
export function generateRecommendations(
  components: SleepScoreComponents
): string[] {
  const recommendations: string[] = [];

  // Duration: 75% of 40 = 30 pts
  if (components.duration.score < 30) {
    const hours = (components.duration.value || 0) / 60;
    if (hours < 7) {
      recommendations.push(
        "Aim for 7-9 hours of sleep. Consider going to bed 30 minutes earlier."
      );
    }
  }

  // Deep Sleep: 75% of 15 = ~11 pts
  if (components.deepSleep.score < 11) {
    recommendations.push(
      "To increase deep sleep: exercise earlier in the day, avoid alcohol, and keep your room cool (65-68°F)."
    );
  }

  // REM Sleep: 75% of 15 = ~11 pts
  if (components.remSleep.score < 11) {
    recommendations.push(
      "To improve REM sleep: reduce caffeine after noon, limit screen time before bed, and maintain consistent sleep times."
    );
  }

  // Awakenings: 75% of 30 = ~22 pts
  if (components.awakenings.score < 22) {
    recommendations.push(
      "Reduce nighttime awakenings by keeping your bedroom dark, quiet, and cool. Avoid liquids 2 hours before bed."
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
 * Main function: Calculate comprehensive sleep score (0-100)
 * Handles missing Deep/REM data by redistributing weights
 */
export function calculateSleepScore(
  session: SleepSessionData,
  _baseline: PersonalBaseline | null = null
): SleepScoreResult {
  const deepPercent =
    session.totalMinutes > 0
      ? (session.deepSleepMinutes / session.totalMinutes) * 100
      : 0;

  const remPercent =
    session.totalMinutes > 0
      ? (session.remSleepMinutes / session.totalMinutes) * 100
      : 0;

  // Check if sleep stage data is available (Apple Watch sensor error handling)
  const hasSleepStages =
    session.deepSleepMinutes > 0 || session.remSleepMinutes > 0;

  // Calculate base component scores
  const durationScore = scoreDuration(session.totalMinutes);
  const awakeningsScore = scoreAwakenings(session.awakeMinutes);
  const deepScore = scoreDeepSleep(session.deepSleepMinutes, session.totalMinutes);
  const remScore = scoreRemSleep(session.remSleepMinutes, session.totalMinutes);

  let totalScore: number;
  let components: SleepScoreComponents;

  if (hasSleepStages) {
    // Normal scoring: Duration (40) + Awakenings (30) + Deep (15) + REM (15) = 100
    totalScore = durationScore + awakeningsScore + deepScore + remScore;

    components = {
      duration: {
        score: durationScore,
        value: session.totalMinutes,
        weight: WEIGHTS.duration,
        label: "Duration",
      },
      deepSleep: {
        score: deepScore,
        value: Math.round(deepPercent * 10) / 10,
        weight: WEIGHTS.deepSleep,
        label: "Deep Sleep",
      },
      remSleep: {
        score: remScore,
        value: Math.round(remPercent * 10) / 10,
        weight: WEIGHTS.remSleep,
        label: "REM Sleep",
      },
      awakenings: {
        score: awakeningsScore,
        value: session.awakeMinutes,
        weight: WEIGHTS.awakenings,
        label: "Awakenings",
      },
    };
  } else {
    // Fallback scoring when Deep/REM missing: Duration (70) + Awakenings (30) = 100
    // Scale duration score from 40-point scale to 70-point scale
    const scaledDurationScore = Math.round((durationScore / 40) * 70);
    totalScore = scaledDurationScore + awakeningsScore;

    components = {
      duration: {
        score: scaledDurationScore,
        value: session.totalMinutes,
        weight: 70,
        label: "Duration",
      },
      deepSleep: {
        score: 0,
        value: null,
        weight: 0,
        label: "Deep Sleep",
      },
      remSleep: {
        score: 0,
        value: null,
        weight: 0,
        label: "REM Sleep",
      },
      awakenings: {
        score: awakeningsScore,
        value: session.awakeMinutes,
        weight: WEIGHTS.awakenings,
        label: "Awakenings",
      },
    };
  }

  const recommendations = generateRecommendations(components);
  const quality = getQualityLabel(totalScore);

  return {
    totalScore,
    components,
    quality,
    recommendations,
  };
}
