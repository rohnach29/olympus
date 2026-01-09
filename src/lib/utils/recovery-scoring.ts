/**
 * Evidence-based recovery and strain scoring algorithms
 *
 * STRAIN CALCULATION:
 * Based on Banister's TRIMP (Training Impulse) model from exercise physiology.
 * Reference: Banister EW. (1991) "Modeling elite athletic performance"
 *
 * TRIMP = Duration × Average HR intensity factor
 * where intensity factor uses exponential weighting for higher heart rates.
 *
 * RECOVERY CALCULATION:
 * Multi-factor model based on sports science research:
 * - Sleep quality (35%): PSQI-based scoring
 * - HRV vs baseline (25%): Parasympathetic tone indicator
 * - Resting HR vs baseline (15%): Cardiovascular recovery marker
 * - Previous strain (15%): Training load impact
 * - Sleep consistency (10%): Circadian rhythm stability
 *
 * References:
 * - Plews et al. (2013) "Training adaptation and heart rate variability"
 * - Buchheit (2014) "Monitoring training status with HR measures"
 */

// ============================================================================
// Types
// ============================================================================

export interface WorkoutData {
  durationMinutes: number;
  heartRateAvg: number | null;
  heartRateMax: number | null;
  type: string;
  caloriesBurned: number | null;
}

export interface UserPhysiologicalData {
  age?: number;
  restingHr?: number;
  maxHr?: number;
  gender?: "male" | "female";
}

export interface RecoveryBaseline {
  hrvAvg: number;
  hrvStdDev: number;
  restingHrAvg: number;
  restingHrStdDev: number;
  avgBedtimeMinutes: number; // Minutes from midnight
  bedtimeStdDev: number;
}

export interface RecoveryInputs {
  sleepScore: number;
  hrvValue: number | null;
  restingHr: number | null;
  previousDayStrain: number;
  bedtimeMinutes: number | null; // Today's bedtime in minutes from midnight
  baseline: RecoveryBaseline | null;
}

export interface StrainResult {
  strainScore: number; // 0-21 scale
  category: "rest" | "low" | "moderate" | "high" | "max";
  trimp: number;
  description: string;
}

export interface RecoveryResult {
  recoveryScore: number | null; // 0-100 scale, null if insufficient data
  category: "optimal" | "good" | "moderate" | "low" | "insufficient_data";
  components: {
    sleepQuality: { score: number | null; weight: number; hasData: boolean };
    hrvStatus: { score: number | null; weight: number; zScore: number | null; hasData: boolean };
    restingHrStatus: { score: number | null; weight: number; zScore: number | null; hasData: boolean };
    strainImpact: { score: number | null; weight: number; hasData: boolean };
    sleepConsistency: { score: number | null; weight: number; hasData: boolean };
  };
  recommendation: string;
  trainingRecommendation: string;
  hasEnoughData: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// Recovery component weights (must sum to 1.0)
const RECOVERY_WEIGHTS = {
  sleepQuality: 0.35,
  hrvStatus: 0.25,
  restingHrStatus: 0.15,
  strainImpact: 0.15,
  sleepConsistency: 0.10,
} as const;

// Strain score thresholds (0-21 scale like WHOOP)
const STRAIN_CATEGORIES = {
  rest: { min: 0, max: 3 },
  low: { min: 3, max: 9 },
  moderate: { min: 9, max: 14 },
  high: { min: 14, max: 18 },
  max: { min: 18, max: 21 },
} as const;

// ============================================================================
// Strain Calculation (TRIMP-based)
// ============================================================================

/**
 * Estimate max heart rate using Tanaka formula (more accurate than 220-age)
 * Reference: Tanaka et al. (2001) "Age-predicted maximal heart rate revisited"
 */
export function estimateMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age);
}

/**
 * Calculate heart rate reserve (Karvonen method)
 */
function calculateHrReserve(
  hrAvg: number,
  hrRest: number,
  hrMax: number
): number {
  if (hrMax <= hrRest) return 0;
  return (hrAvg - hrRest) / (hrMax - hrRest);
}

/**
 * Calculate TRIMP (Training Impulse) using Banister's formula
 *
 * TRIMP = Duration × HRreserve × 0.64 × e^(1.92 × HRreserve)
 *
 * The gender coefficient adjusts for physiological differences:
 * - Male: 0.64 × e^(1.92 × y)
 * - Female: 0.86 × e^(1.67 × y)
 *
 * where y = heart rate reserve ratio
 */
export function calculateTrimp(
  durationMinutes: number,
  hrAvg: number,
  hrRest: number,
  hrMax: number,
  gender: "male" | "female" = "male"
): number {
  const hrReserve = calculateHrReserve(hrAvg, hrRest, hrMax);

  // Banister coefficients
  const coeffA = gender === "male" ? 0.64 : 0.86;
  const coeffB = gender === "male" ? 1.92 : 1.67;

  const intensityFactor = coeffA * Math.exp(coeffB * hrReserve);
  const trimp = durationMinutes * hrReserve * intensityFactor;

  return Math.max(0, trimp);
}

/**
 * Convert TRIMP to 0-21 strain scale
 *
 * Calibration based on typical workout TRIMP values:
 * - Light walk (30 min, 50% HRR): TRIMP ~15-25 → Strain ~3-5
 * - Moderate run (45 min, 70% HRR): TRIMP ~80-120 → Strain ~10-13
 * - Hard interval (60 min, 85% HRR): TRIMP ~200-300 → Strain ~16-19
 *
 * Using logarithmic scaling: strain = k × ln(TRIMP + 1)
 * Calibrated so TRIMP=300 → Strain≈20
 */
export function trimpToStrainScore(trimp: number): number {
  if (trimp <= 0) return 0;

  // Logarithmic scaling constant (calibrated empirically)
  const k = 3.5;
  const strain = k * Math.log(trimp + 1);

  return Math.min(21, Math.max(0, Math.round(strain * 10) / 10));
}

/**
 * Estimate strain when heart rate data is unavailable
 * Uses duration and workout type as proxies
 */
export function estimateStrainWithoutHr(
  durationMinutes: number,
  workoutType: string,
  caloriesBurned: number | null
): number {
  // Intensity multipliers by workout type (based on typical MET values)
  const intensityMultipliers: Record<string, number> = {
    hiit: 1.0,
    running: 0.85,
    cycling: 0.75,
    swimming: 0.80,
    strength: 0.65,
    sports: 0.75,
    yoga: 0.35,
    walking: 0.40,
    other: 0.60,
  };

  const multiplier = intensityMultipliers[workoutType.toLowerCase()] || 0.60;

  // Base calculation: duration with intensity adjustment
  // 60 min moderate workout ≈ strain 10-12
  let baseStrain = (durationMinutes / 60) * 10 * multiplier;

  // Adjust by calories if available (more accurate indicator)
  if (caloriesBurned && caloriesBurned > 0) {
    // Typical: 400-600 cal/hour for moderate intensity
    const calorieFactor = caloriesBurned / (durationMinutes * 8); // 8 cal/min baseline
    baseStrain = baseStrain * Math.min(1.5, Math.max(0.5, calorieFactor));
  }

  return Math.min(21, Math.max(0, Math.round(baseStrain * 10) / 10));
}

/**
 * Main strain calculation function
 */
export function calculateStrain(
  workout: WorkoutData,
  userPhysio: UserPhysiologicalData = {}
): StrainResult {
  let strainScore: number;
  let trimp = 0;

  const hasHrData = workout.heartRateAvg && workout.heartRateAvg > 0;

  if (hasHrData) {
    // Use TRIMP-based calculation
    const restingHr = userPhysio.restingHr || 60; // Default if unknown
    const maxHr = userPhysio.maxHr || (userPhysio.age ? estimateMaxHr(userPhysio.age) : 190);
    const gender = userPhysio.gender || "male";

    trimp = calculateTrimp(
      workout.durationMinutes,
      workout.heartRateAvg!,
      restingHr,
      maxHr,
      gender
    );

    strainScore = trimpToStrainScore(trimp);
  } else {
    // Estimate without HR data
    strainScore = estimateStrainWithoutHr(
      workout.durationMinutes,
      workout.type,
      workout.caloriesBurned
    );
  }

  // Determine category
  let category: StrainResult["category"] = "rest";
  if (strainScore >= STRAIN_CATEGORIES.max.min) category = "max";
  else if (strainScore >= STRAIN_CATEGORIES.high.min) category = "high";
  else if (strainScore >= STRAIN_CATEGORIES.moderate.min) category = "moderate";
  else if (strainScore >= STRAIN_CATEGORIES.low.min) category = "low";

  // Generate description
  const descriptions: Record<string, string> = {
    rest: "Minimal activity - body is resting",
    low: "Light activity - easy on the body",
    moderate: "Moderate strain - good training stimulus",
    high: "High strain - significant training load",
    max: "Maximum strain - very demanding session",
  };

  return {
    strainScore,
    category,
    trimp: Math.round(trimp),
    description: descriptions[category],
  };
}

/**
 * Calculate daily strain from multiple workouts
 */
export function calculateDailyStrain(
  workouts: WorkoutData[],
  userPhysio: UserPhysiologicalData = {}
): StrainResult {
  if (workouts.length === 0) {
    return {
      strainScore: 0,
      category: "rest",
      trimp: 0,
      description: "No workouts logged - rest day",
    };
  }

  // Sum up strain from all workouts (with diminishing returns)
  let totalTrimp = 0;
  let totalEstimatedStrain = 0;
  let hasAnyHrData = false;

  for (const workout of workouts) {
    const result = calculateStrain(workout, userPhysio);
    if (workout.heartRateAvg) {
      totalTrimp += result.trimp;
      hasAnyHrData = true;
    } else {
      totalEstimatedStrain += result.strainScore;
    }
  }

  let finalStrain: number;

  if (hasAnyHrData) {
    // Convert combined TRIMP with diminishing returns
    finalStrain = trimpToStrainScore(totalTrimp);
    // Add non-HR workouts with reduced weight
    finalStrain += totalEstimatedStrain * 0.7;
  } else {
    // Sum with diminishing returns (sqrt-based)
    finalStrain = Math.sqrt(workouts.length) * (totalEstimatedStrain / workouts.length);
  }

  finalStrain = Math.min(21, Math.max(0, Math.round(finalStrain * 10) / 10));

  // Re-categorize
  let category: StrainResult["category"] = "rest";
  if (finalStrain >= STRAIN_CATEGORIES.max.min) category = "max";
  else if (finalStrain >= STRAIN_CATEGORIES.high.min) category = "high";
  else if (finalStrain >= STRAIN_CATEGORIES.moderate.min) category = "moderate";
  else if (finalStrain >= STRAIN_CATEGORIES.low.min) category = "low";

  const descriptions: Record<string, string> = {
    rest: "Rest day - minimal physical activity",
    low: "Light day - easy training load",
    moderate: "Moderate day - balanced training",
    high: "Hard day - significant training stress",
    max: "Peak day - very high training load",
  };

  return {
    strainScore: finalStrain,
    category,
    trimp: Math.round(totalTrimp),
    description: descriptions[category],
  };
}

// ============================================================================
// Recovery Calculation
// ============================================================================

/**
 * Calculate z-score for a value compared to baseline
 */
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Convert z-score to a 0-100 score
 * Uses sigmoid-like function centered at z=0
 *
 * z >= 1.0 → ~95-100 (excellent)
 * z = 0 → 75 (baseline)
 * z <= -1.0 → ~50-55 (below average)
 * z <= -2.0 → ~25-30 (poor)
 */
function zScoreToScore(zScore: number, invert: boolean = false): number {
  // Invert for metrics where lower is better (like resting HR)
  const z = invert ? -zScore : zScore;

  // Sigmoid transformation: score = 75 + 25 * tanh(z * 0.75)
  const score = 75 + 25 * Math.tanh(z * 0.75);

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Score sleep quality component (already evidence-based from PSQI)
 * Returns null if no sleep data available
 */
function scoreSleepQuality(sleepScore: number | null): { score: number | null; hasData: boolean } {
  if (sleepScore === null || sleepScore === 0) {
    return { score: null, hasData: false };
  }
  // Sleep score is already 0-100, just pass through
  return { score: Math.min(100, Math.max(0, sleepScore)), hasData: true };
}

/**
 * Score HRV status compared to personal baseline
 * Higher HRV generally indicates better parasympathetic tone / recovery
 * Returns null score if no HRV data available
 */
function scoreHrvStatus(
  hrvValue: number | null,
  baseline: RecoveryBaseline | null
): { score: number | null; zScore: number | null; hasData: boolean } {
  if (hrvValue === null) {
    return { score: null, zScore: null, hasData: false };
  }

  if (baseline === null) {
    // Population-based scoring when no personal baseline
    // Based on general adult HRV norms during sleep (typically 40-80ms)
    if (hrvValue >= 70) return { score: 95, zScore: null, hasData: true };
    if (hrvValue >= 55) return { score: 85, zScore: null, hasData: true };
    if (hrvValue >= 40) return { score: 70, zScore: null, hasData: true };
    if (hrvValue >= 30) return { score: 55, zScore: null, hasData: true };
    return { score: 40, zScore: null, hasData: true };
  }

  // Personal baseline comparison
  const zScore = calculateZScore(hrvValue, baseline.hrvAvg, baseline.hrvStdDev);
  const score = zScoreToScore(zScore, false);

  return { score, zScore: Math.round(zScore * 100) / 100, hasData: true };
}

/**
 * Score resting HR status compared to personal baseline
 * Lower resting HR generally indicates better cardiovascular fitness/recovery
 * Returns null score if no resting HR data available
 */
function scoreRestingHrStatus(
  restingHr: number | null,
  baseline: RecoveryBaseline | null
): { score: number | null; zScore: number | null; hasData: boolean } {
  if (restingHr === null) {
    return { score: null, zScore: null, hasData: false };
  }

  if (baseline === null) {
    // Population-based scoring
    // Average adult resting HR: 60-80 bpm, athletic: 40-60 bpm
    if (restingHr <= 50) return { score: 95, zScore: null, hasData: true };
    if (restingHr <= 60) return { score: 85, zScore: null, hasData: true };
    if (restingHr <= 70) return { score: 70, zScore: null, hasData: true };
    if (restingHr <= 80) return { score: 55, zScore: null, hasData: true };
    return { score: 40, zScore: null, hasData: true };
  }

  // Personal baseline comparison (invert because lower is better)
  const zScore = calculateZScore(restingHr, baseline.restingHrAvg, baseline.restingHrStdDev);
  const score = zScoreToScore(zScore, true); // Inverted

  return { score, zScore: Math.round(zScore * 100) / 100, hasData: true };
}

/**
 * Score impact of previous day's strain on recovery
 * Higher strain = lower recovery (inverse relationship)
 * Strain of 0 (rest day) is valid data, so always hasData: true
 */
function scoreStrainImpact(strain: number): { score: number; hasData: boolean } {
  // Strain 0-21 scale
  // Low strain (0-5): minimal impact on recovery → score 90-100
  // Moderate (5-12): some impact → score 60-90
  // High (12-18): significant impact → score 30-60
  // Max (18-21): major impact → score 0-30

  let score: number;
  if (strain <= 3) score = 100;
  else if (strain <= 6) score = 90;
  else if (strain <= 9) score = 75;
  else if (strain <= 12) score = 60;
  else if (strain <= 15) score = 45;
  else if (strain <= 18) score = 30;
  else score = 15;

  // Strain of 0 means rest day - this is valid data
  return { score, hasData: true };
}

/**
 * Score sleep consistency (bedtime regularity)
 * Consistent sleep times support circadian rhythm health
 * Returns null score if no sleep data available
 */
function scoreSleepConsistency(
  todayBedtimeMinutes: number | null,
  baseline: RecoveryBaseline | null
): { score: number | null; hasData: boolean } {
  if (todayBedtimeMinutes === null || baseline === null) {
    return { score: null, hasData: false };
  }

  // Calculate deviation from average bedtime
  let deviation = Math.abs(todayBedtimeMinutes - baseline.avgBedtimeMinutes);

  // Handle midnight crossing (e.g., 23:00 vs 01:00)
  if (deviation > 720) {
    deviation = 1440 - deviation;
  }

  // Score based on deviation
  // <15 min: excellent consistency
  // 15-30 min: good
  // 30-60 min: moderate
  // >60 min: poor
  let score: number;
  if (deviation <= 15) score = 100;
  else if (deviation <= 30) score = 85;
  else if (deviation <= 45) score = 70;
  else if (deviation <= 60) score = 55;
  else if (deviation <= 90) score = 40;
  else score = 25;

  return { score, hasData: true };
}

/**
 * Main recovery calculation function
 * Returns null recovery score if insufficient data (need at least sleep data)
 */
export function calculateRecovery(inputs: RecoveryInputs): RecoveryResult {
  // Calculate each component
  const sleepQualityResult = scoreSleepQuality(inputs.sleepScore);
  const hrvResult = scoreHrvStatus(inputs.hrvValue, inputs.baseline);
  const restingHrResult = scoreRestingHrStatus(inputs.restingHr, inputs.baseline);
  const strainImpactResult = scoreStrainImpact(inputs.previousDayStrain);
  const sleepConsistencyResult = scoreSleepConsistency(
    inputs.bedtimeMinutes,
    inputs.baseline
  );

  // Build components object
  const components = {
    sleepQuality: { score: sleepQualityResult.score, weight: RECOVERY_WEIGHTS.sleepQuality, hasData: sleepQualityResult.hasData },
    hrvStatus: { score: hrvResult.score, weight: RECOVERY_WEIGHTS.hrvStatus, zScore: hrvResult.zScore, hasData: hrvResult.hasData },
    restingHrStatus: { score: restingHrResult.score, weight: RECOVERY_WEIGHTS.restingHrStatus, zScore: restingHrResult.zScore, hasData: restingHrResult.hasData },
    strainImpact: { score: strainImpactResult.score, weight: RECOVERY_WEIGHTS.strainImpact, hasData: strainImpactResult.hasData },
    sleepConsistency: { score: sleepConsistencyResult.score, weight: RECOVERY_WEIGHTS.sleepConsistency, hasData: sleepConsistencyResult.hasData },
  };

  // Check if we have enough data to calculate a meaningful recovery score
  // Require at least sleep data (the most important factor at 35%)
  const hasEnoughData = sleepQualityResult.hasData;

  // If no sleep data, we can't calculate a meaningful recovery score
  if (!hasEnoughData) {
    return {
      recoveryScore: null,
      category: "insufficient_data",
      components,
      recommendation: "No sleep data available. Wear your device tonight to track recovery.",
      trainingRecommendation: "Unable to provide recommendations without sleep data.",
      hasEnoughData: false,
    };
  }

  // Calculate weighted total, only using components that have data
  // Re-normalize weights based on available data
  let totalWeight = 0;
  let weightedSum = 0;

  if (sleepQualityResult.hasData && sleepQualityResult.score !== null) {
    weightedSum += sleepQualityResult.score * RECOVERY_WEIGHTS.sleepQuality;
    totalWeight += RECOVERY_WEIGHTS.sleepQuality;
  }
  if (hrvResult.hasData && hrvResult.score !== null) {
    weightedSum += hrvResult.score * RECOVERY_WEIGHTS.hrvStatus;
    totalWeight += RECOVERY_WEIGHTS.hrvStatus;
  }
  if (restingHrResult.hasData && restingHrResult.score !== null) {
    weightedSum += restingHrResult.score * RECOVERY_WEIGHTS.restingHrStatus;
    totalWeight += RECOVERY_WEIGHTS.restingHrStatus;
  }
  if (strainImpactResult.hasData && strainImpactResult.score !== null) {
    weightedSum += strainImpactResult.score * RECOVERY_WEIGHTS.strainImpact;
    totalWeight += RECOVERY_WEIGHTS.strainImpact;
  }
  if (sleepConsistencyResult.hasData && sleepConsistencyResult.score !== null) {
    weightedSum += sleepConsistencyResult.score * RECOVERY_WEIGHTS.sleepConsistency;
    totalWeight += RECOVERY_WEIGHTS.sleepConsistency;
  }

  // Normalize to 0-100 scale
  const recoveryScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;

  // Determine category
  let category: RecoveryResult["category"];
  if (recoveryScore === null) category = "insufficient_data";
  else if (recoveryScore >= 85) category = "optimal";
  else if (recoveryScore >= 70) category = "good";
  else if (recoveryScore >= 50) category = "moderate";
  else category = "low";

  // Generate recommendations
  const recommendations: Record<string, string> = {
    optimal: "Your body is fully recovered. Great day for high-intensity training!",
    good: "You're well recovered. Moderate to high intensity training is appropriate.",
    moderate: "Recovery is incomplete. Consider lighter training or active recovery.",
    low: "Your body needs rest. Light stretching or complete rest recommended.",
    insufficient_data: "Insufficient data to calculate recovery. Wear your device tonight.",
  };

  const trainingRecs: Record<string, string> = {
    optimal: "High intensity, intervals, heavy lifting, competition",
    good: "Tempo runs, moderate weights, skill work, games",
    moderate: "Easy cardio, light weights, mobility, technique",
    low: "Rest, gentle stretching, walking, sleep focus",
    insufficient_data: "Unable to provide recommendations without sufficient data.",
  };

  return {
    recoveryScore,
    category,
    components,
    recommendation: recommendations[category],
    trainingRecommendation: trainingRecs[category],
    hasEnoughData,
  };
}

/**
 * Calculate personal recovery baseline from historical data
 * Requires at least 7 days of data for reliable baseline
 */
export function calculateRecoveryBaseline(
  data: Array<{
    hrvAvg: number | null;
    restingHr: number | null;
    bedtimeMinutes: number | null;
  }>
): RecoveryBaseline | null {
  // Filter valid data
  const hrvValues = data.filter(d => d.hrvAvg !== null).map(d => d.hrvAvg as number);
  const hrValues = data.filter(d => d.restingHr !== null).map(d => d.restingHr as number);
  const bedtimes = data.filter(d => d.bedtimeMinutes !== null).map(d => d.bedtimeMinutes as number);

  // Need minimum data points
  if (hrvValues.length < 5 || hrValues.length < 5) {
    return null;
  }

  // Calculate HRV statistics
  const hrvAvg = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
  const hrvVariance = hrvValues.reduce((sum, val) => sum + Math.pow(val - hrvAvg, 2), 0) / hrvValues.length;
  const hrvStdDev = Math.sqrt(hrvVariance) || 5; // Minimum 5ms std dev

  // Calculate HR statistics
  const restingHrAvg = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
  const hrVariance = hrValues.reduce((sum, val) => sum + Math.pow(val - restingHrAvg, 2), 0) / hrValues.length;
  const restingHrStdDev = Math.sqrt(hrVariance) || 3; // Minimum 3bpm std dev

  // Calculate bedtime statistics (handle midnight crossing)
  let avgBedtimeMinutes = 0;
  let bedtimeStdDev = 30; // Default

  if (bedtimes.length >= 5) {
    // Circular mean for bedtimes (handles midnight crossing)
    const sinSum = bedtimes.reduce((sum, t) => sum + Math.sin((t / 1440) * 2 * Math.PI), 0);
    const cosSum = bedtimes.reduce((sum, t) => sum + Math.cos((t / 1440) * 2 * Math.PI), 0);
    const avgAngle = Math.atan2(sinSum / bedtimes.length, cosSum / bedtimes.length);
    avgBedtimeMinutes = ((avgAngle / (2 * Math.PI)) * 1440 + 1440) % 1440;

    // Calculate circular std dev
    const deviations = bedtimes.map(t => {
      let dev = Math.abs(t - avgBedtimeMinutes);
      if (dev > 720) dev = 1440 - dev;
      return dev;
    });
    bedtimeStdDev = Math.sqrt(deviations.reduce((sum, d) => sum + d * d, 0) / deviations.length) || 30;
  }

  return {
    hrvAvg: Math.round(hrvAvg * 10) / 10,
    hrvStdDev: Math.round(hrvStdDev * 10) / 10,
    restingHrAvg: Math.round(restingHrAvg * 10) / 10,
    restingHrStdDev: Math.round(restingHrStdDev * 10) / 10,
    avgBedtimeMinutes: Math.round(avgBedtimeMinutes),
    bedtimeStdDev: Math.round(bedtimeStdDev),
  };
}
