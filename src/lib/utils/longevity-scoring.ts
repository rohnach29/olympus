/**
 * Longevity Scoring - PhenoAge Biological Age Calculator
 *
 * Based on Levine et al. 2018: "An epigenetic biomarker of aging for lifespan
 * and healthspan" - PNAS (doi: 10.1073/pnas.1718449115)
 *
 * PhenoAge uses 9 clinical biomarkers to predict biological age.
 */

// ============================================================================
// Types
// ============================================================================

export interface PhenoAgeInput {
  chronologicalAge: number; // years
  albumin?: number; // g/dL
  creatinine?: number; // mg/dL
  glucose?: number; // mg/dL (fasting)
  crp?: number; // mg/L (C-reactive protein, log transformed)
  lymphocytePercent?: number; // %
  mcv?: number; // fL (Mean Corpuscular Volume)
  rdw?: number; // % (Red Cell Distribution Width)
  alkalinePhosphatase?: number; // U/L
  wbc?: number; // 10^3 cells/uL (White Blood Cell count)
}

export interface PhenoAgeResult {
  biologicalAge: number | null;
  ageDifference: number | null; // negative = younger than chronological
  percentile: number | null; // where you fall in population
  availableMarkers: number;
  requiredMarkers: number;
  missingMarkers: string[];
  canCalculate: boolean;
  pillars: LongevityPillar[];
}

export interface LongevityPillar {
  name: string;
  score: number;
  status: "optimal" | "good" | "fair" | "poor";
  factors: string[];
  description: string;
}

// ============================================================================
// PhenoAge Coefficients (from Levine 2018)
// ============================================================================

// These are the exact coefficients from the published PhenoAge formula
const PHENO_AGE_COEFFICIENTS = {
  intercept: -19.9067,
  albumin: -0.0336, // g/L in original, we convert
  creatinine: 0.0095, // umol/L in original, we convert
  glucose: 0.1953, // mmol/L in original, we convert
  lnCrp: 0.0954, // ln(mg/L)
  lymphocytePercent: -0.0120,
  mcv: 0.0268,
  rdw: 0.3306,
  alkalinePhosphatase: 0.0019,
  wbc: 0.0554,
  age: 0.0804,
};

// Unit conversions for US lab values
const CONVERSIONS = {
  albuminGdLToGL: 10, // g/dL * 10 = g/L
  creatinineMgDLToUmolL: 88.4, // mg/dL * 88.4 = umol/L
  glucoseMgDLToMmolL: 0.0555, // mg/dL * 0.0555 = mmol/L
};

// ============================================================================
// PhenoAge Calculation
// ============================================================================

/**
 * Calculate PhenoAge biological age
 * Returns null if insufficient data
 */
export function calculatePhenoAge(input: PhenoAgeInput): PhenoAgeResult {
  const missingMarkers: string[] = [];
  const requiredMarkers = 9;

  // Check which markers are available
  if (input.albumin === undefined) missingMarkers.push("Albumin");
  if (input.creatinine === undefined) missingMarkers.push("Creatinine");
  if (input.glucose === undefined) missingMarkers.push("Fasting Glucose");
  if (input.crp === undefined) missingMarkers.push("CRP (hs-CRP)");
  if (input.lymphocytePercent === undefined) missingMarkers.push("Lymphocyte %");
  if (input.mcv === undefined) missingMarkers.push("MCV");
  if (input.rdw === undefined) missingMarkers.push("RDW");
  if (input.alkalinePhosphatase === undefined) missingMarkers.push("Alkaline Phosphatase");
  if (input.wbc === undefined) missingMarkers.push("WBC");

  const availableMarkers = requiredMarkers - missingMarkers.length;
  const canCalculate = missingMarkers.length === 0;

  // Calculate pillar scores even with partial data
  const pillars = calculatePillars(input);

  if (!canCalculate) {
    return {
      biologicalAge: null,
      ageDifference: null,
      percentile: null,
      availableMarkers,
      requiredMarkers,
      missingMarkers,
      canCalculate,
      pillars,
    };
  }

  // Convert US units to SI units used in the original formula
  const albumin_gL = input.albumin! * CONVERSIONS.albuminGdLToGL;
  const creatinine_umolL = input.creatinine! * CONVERSIONS.creatinineMgDLToUmolL;
  const glucose_mmolL = input.glucose! * CONVERSIONS.glucoseMgDLToMmolL;
  const lnCrp = Math.log(Math.max(input.crp!, 0.1)); // Avoid log(0)

  // Calculate the linear predictor (xb)
  const xb =
    PHENO_AGE_COEFFICIENTS.intercept +
    PHENO_AGE_COEFFICIENTS.albumin * albumin_gL +
    PHENO_AGE_COEFFICIENTS.creatinine * creatinine_umolL +
    PHENO_AGE_COEFFICIENTS.glucose * glucose_mmolL +
    PHENO_AGE_COEFFICIENTS.lnCrp * lnCrp +
    PHENO_AGE_COEFFICIENTS.lymphocytePercent * input.lymphocytePercent! +
    PHENO_AGE_COEFFICIENTS.mcv * input.mcv! +
    PHENO_AGE_COEFFICIENTS.rdw * input.rdw! +
    PHENO_AGE_COEFFICIENTS.alkalinePhosphatase * input.alkalinePhosphatase! +
    PHENO_AGE_COEFFICIENTS.wbc * input.wbc! +
    PHENO_AGE_COEFFICIENTS.age * input.chronologicalAge;

  // Convert to mortality score and then to PhenoAge
  // Using Gompertz mortality model parameters from Levine 2018
  const gamma = 0.0076927;
  const lambda = 0.0022802;

  // Mortality score
  const mortalityScore = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * gamma) - 1) / gamma);

  // Convert back to PhenoAge
  const biologicalAge = (1 / gamma) * Math.log(1 + gamma * Math.log(1 - mortalityScore) / lambda) + 120;

  // Clamp to reasonable range
  const clampedAge = Math.max(20, Math.min(120, biologicalAge));
  const ageDifference = clampedAge - input.chronologicalAge;

  // Estimate percentile (based on typical distribution)
  // Negative difference = biologically younger = better percentile
  const percentile = estimatePercentile(ageDifference);

  return {
    biologicalAge: Math.round(clampedAge * 10) / 10,
    ageDifference: Math.round(ageDifference * 10) / 10,
    percentile,
    availableMarkers,
    requiredMarkers,
    missingMarkers,
    canCalculate,
    pillars,
  };
}

/**
 * Estimate percentile based on age difference
 * Based on typical population distribution
 */
function estimatePercentile(ageDifference: number): number {
  // Standard deviation of PhenoAge - chronological age is roughly 6-8 years
  const stdDev = 7;
  // Z-score
  const z = -ageDifference / stdDev; // Negative because lower bio age is better
  // Convert to percentile using approximate normal CDF
  const percentile = Math.round(100 * (1 / (1 + Math.exp(-1.702 * z))));
  return Math.max(1, Math.min(99, percentile));
}

// ============================================================================
// Longevity Pillars
// ============================================================================

/**
 * Calculate longevity pillar scores based on available biomarkers
 */
function calculatePillars(input: PhenoAgeInput): LongevityPillar[] {
  const pillars: LongevityPillar[] = [];

  // Metabolic Health Pillar
  const metabolicFactors: string[] = [];
  let metabolicScore = 0;
  let metabolicCount = 0;

  if (input.glucose !== undefined) {
    metabolicCount++;
    if (input.glucose < 100) {
      metabolicScore += 100;
      metabolicFactors.push(`Fasting Glucose: ${input.glucose} mg/dL (Optimal)`);
    } else if (input.glucose < 126) {
      metabolicScore += 60;
      metabolicFactors.push(`Fasting Glucose: ${input.glucose} mg/dL (Pre-diabetic range)`);
    } else {
      metabolicScore += 20;
      metabolicFactors.push(`Fasting Glucose: ${input.glucose} mg/dL (Elevated)`);
    }
  }

  if (input.creatinine !== undefined) {
    metabolicCount++;
    if (input.creatinine >= 0.7 && input.creatinine <= 1.2) {
      metabolicScore += 100;
      metabolicFactors.push(`Creatinine: ${input.creatinine} mg/dL (Normal)`);
    } else {
      metabolicScore += 50;
      metabolicFactors.push(`Creatinine: ${input.creatinine} mg/dL (Outside normal)`);
    }
  }

  if (metabolicCount > 0) {
    pillars.push({
      name: "Metabolic Health",
      score: Math.round(metabolicScore / metabolicCount),
      status: getStatus(metabolicScore / metabolicCount),
      factors: metabolicFactors.length > 0 ? metabolicFactors : ["No data available"],
      description: "Blood sugar stability, kidney function",
    });
  }

  // Inflammation Pillar
  const inflammationFactors: string[] = [];
  let inflammationScore = 0;
  let inflammationCount = 0;

  if (input.crp !== undefined) {
    inflammationCount++;
    if (input.crp < 1) {
      inflammationScore += 100;
      inflammationFactors.push(`hs-CRP: ${input.crp} mg/L (Low risk)`);
    } else if (input.crp < 3) {
      inflammationScore += 70;
      inflammationFactors.push(`hs-CRP: ${input.crp} mg/L (Moderate risk)`);
    } else {
      inflammationScore += 30;
      inflammationFactors.push(`hs-CRP: ${input.crp} mg/L (High risk)`);
    }
  }

  if (input.wbc !== undefined) {
    inflammationCount++;
    if (input.wbc >= 4 && input.wbc <= 10) {
      inflammationScore += 100;
      inflammationFactors.push(`WBC: ${input.wbc} K/uL (Normal)`);
    } else {
      inflammationScore += 50;
      inflammationFactors.push(`WBC: ${input.wbc} K/uL (Outside normal)`);
    }
  }

  if (inflammationCount > 0) {
    pillars.push({
      name: "Inflammation",
      score: Math.round(inflammationScore / inflammationCount),
      status: getStatus(inflammationScore / inflammationCount),
      factors: inflammationFactors.length > 0 ? inflammationFactors : ["No data available"],
      description: "Systemic inflammation markers",
    });
  }

  // Liver Function Pillar
  const liverFactors: string[] = [];
  let liverScore = 0;
  let liverCount = 0;

  if (input.albumin !== undefined) {
    liverCount++;
    if (input.albumin >= 3.5 && input.albumin <= 5.5) {
      liverScore += 100;
      liverFactors.push(`Albumin: ${input.albumin} g/dL (Normal)`);
    } else {
      liverScore += 50;
      liverFactors.push(`Albumin: ${input.albumin} g/dL (Outside normal)`);
    }
  }

  if (input.alkalinePhosphatase !== undefined) {
    liverCount++;
    if (input.alkalinePhosphatase >= 44 && input.alkalinePhosphatase <= 147) {
      liverScore += 100;
      liverFactors.push(`ALP: ${input.alkalinePhosphatase} U/L (Normal)`);
    } else {
      liverScore += 50;
      liverFactors.push(`ALP: ${input.alkalinePhosphatase} U/L (Outside normal)`);
    }
  }

  if (liverCount > 0) {
    pillars.push({
      name: "Liver Function",
      score: Math.round(liverScore / liverCount),
      status: getStatus(liverScore / liverCount),
      factors: liverFactors.length > 0 ? liverFactors : ["No data available"],
      description: "Liver health and protein synthesis",
    });
  }

  // Blood Health Pillar
  const bloodFactors: string[] = [];
  let bloodScore = 0;
  let bloodCount = 0;

  if (input.lymphocytePercent !== undefined) {
    bloodCount++;
    if (input.lymphocytePercent >= 20 && input.lymphocytePercent <= 40) {
      bloodScore += 100;
      bloodFactors.push(`Lymphocytes: ${input.lymphocytePercent}% (Normal)`);
    } else {
      bloodScore += 60;
      bloodFactors.push(`Lymphocytes: ${input.lymphocytePercent}% (Outside normal)`);
    }
  }

  if (input.mcv !== undefined) {
    bloodCount++;
    if (input.mcv >= 80 && input.mcv <= 100) {
      bloodScore += 100;
      bloodFactors.push(`MCV: ${input.mcv} fL (Normal)`);
    } else {
      bloodScore += 60;
      bloodFactors.push(`MCV: ${input.mcv} fL (Outside normal)`);
    }
  }

  if (input.rdw !== undefined) {
    bloodCount++;
    if (input.rdw >= 11.5 && input.rdw <= 14.5) {
      bloodScore += 100;
      bloodFactors.push(`RDW: ${input.rdw}% (Normal)`);
    } else {
      bloodScore += 50;
      bloodFactors.push(`RDW: ${input.rdw}% (Elevated - linked to aging)`);
    }
  }

  if (bloodCount > 0) {
    pillars.push({
      name: "Blood Health",
      score: Math.round(bloodScore / bloodCount),
      status: getStatus(bloodScore / bloodCount),
      factors: bloodFactors.length > 0 ? bloodFactors : ["No data available"],
      description: "Red blood cell health and immune function",
    });
  }

  return pillars;
}

function getStatus(score: number): "optimal" | "good" | "fair" | "poor" {
  if (score >= 90) return "optimal";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

// ============================================================================
// Helper to Extract PhenoAge Markers from Blood Work
// ============================================================================

interface BloodMarker {
  name: string;
  value: number;
  unit: string;
}

/**
 * Extract PhenoAge-relevant markers from blood work data
 */
export function extractPhenoAgeMarkers(
  markers: BloodMarker[],
  chronologicalAge: number
): PhenoAgeInput {
  const input: PhenoAgeInput = { chronologicalAge };

  // Map of marker name variations to PhenoAge fields
  const markerMappings: Record<string, keyof PhenoAgeInput> = {
    albumin: "albumin",
    creatinine: "creatinine",
    glucose: "glucose",
    "fasting glucose": "glucose",
    crp: "crp",
    "hs-crp": "crp",
    "c-reactive protein": "crp",
    "high-sensitivity crp": "crp",
    lymphocyte: "lymphocytePercent",
    "lymphocyte %": "lymphocytePercent",
    "lymphocyte percent": "lymphocytePercent",
    lymphocytes: "lymphocytePercent",
    mcv: "mcv",
    "mean corpuscular volume": "mcv",
    rdw: "rdw",
    "red cell distribution width": "rdw",
    "rdw-cv": "rdw",
    alp: "alkalinePhosphatase",
    "alkaline phosphatase": "alkalinePhosphatase",
    wbc: "wbc",
    "white blood cell": "wbc",
    "white blood cells": "wbc",
    "white blood cell count": "wbc",
  };

  for (const marker of markers) {
    const normalizedName = marker.name.toLowerCase().trim();

    for (const [pattern, field] of Object.entries(markerMappings)) {
      if (normalizedName.includes(pattern) || normalizedName === pattern) {
        (input as unknown as Record<string, number | undefined>)[field] = marker.value;
        break;
      }
    }
  }

  return input;
}

// ============================================================================
// Recommendations
// ============================================================================

export interface LongevityRecommendation {
  category: string;
  recommendations: string[];
}

/**
 * Generate personalized recommendations based on PhenoAge result
 */
export function generateRecommendations(result: PhenoAgeResult): LongevityRecommendation[] {
  const recommendations: LongevityRecommendation[] = [];

  // Based on biological age
  if (result.biologicalAge !== null && result.ageDifference !== null) {
    if (result.ageDifference > 5) {
      recommendations.push({
        category: "Priority Focus",
        recommendations: [
          "Consider comprehensive metabolic testing",
          "Focus on reducing inflammation through diet and exercise",
          "Prioritize 7-8 hours of quality sleep",
          "Implement stress management practices",
        ],
      });
    } else if (result.ageDifference > 0) {
      recommendations.push({
        category: "Optimization",
        recommendations: [
          "Maintain consistent exercise routine (150+ min/week)",
          "Focus on anti-inflammatory foods (omega-3s, colorful vegetables)",
          "Monitor and manage stress levels",
          "Stay consistent with sleep schedule",
        ],
      });
    } else {
      recommendations.push({
        category: "Maintenance",
        recommendations: [
          "Continue current healthy lifestyle practices",
          "Regular health monitoring to track progress",
          "Focus on longevity-promoting activities (strength training, zone 2 cardio)",
          "Consider advanced optimization (cold/heat exposure, time-restricted eating)",
        ],
      });
    }
  }

  // Based on pillars
  for (const pillar of result.pillars) {
    if (pillar.status === "fair" || pillar.status === "poor") {
      if (pillar.name === "Metabolic Health") {
        recommendations.push({
          category: "Metabolic Health",
          recommendations: [
            "Reduce refined carbohydrate intake",
            "Consider time-restricted eating (12-16 hour fasting window)",
            "Increase physical activity, especially after meals",
            "Monitor blood glucose response to different foods",
          ],
        });
      } else if (pillar.name === "Inflammation") {
        recommendations.push({
          category: "Inflammation",
          recommendations: [
            "Increase omega-3 fatty acid intake (fish, flaxseed)",
            "Reduce processed foods and added sugars",
            "Add anti-inflammatory spices (turmeric, ginger)",
            "Ensure adequate sleep and stress management",
          ],
        });
      }
    }
  }

  // If missing markers
  if (result.missingMarkers.length > 0) {
    recommendations.push({
      category: "Testing Needed",
      recommendations: [
        `Get these markers tested for full PhenoAge calculation: ${result.missingMarkers.join(", ")}`,
        "Request a comprehensive metabolic panel from your doctor",
        "Many of these are included in standard blood work",
      ],
    });
  }

  return recommendations;
}
