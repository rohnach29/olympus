/**
 * Blood work biomarker definitions and optimal ranges
 *
 * Ranges are based on:
 * - Standard clinical reference ranges
 * - Optimal ranges for longevity (narrower than clinical)
 * - Research from preventive medicine literature
 *
 * Note: These are general guidelines. Individual optimal ranges
 * may vary based on age, sex, and health conditions.
 */

// ============================================================================
// Types
// ============================================================================

export interface BiomarkerDefinition {
  name: string;
  category: string;
  unit: string;
  referenceRange: { min?: number; max?: number };
  optimalRange: { min?: number; max?: number };
  description: string;
  higherIsBetter?: boolean; // For some markers like HDL
}

export interface BloodWorkMarker {
  name: string;
  value: number;
  unit: string;
  category: string;
  referenceMin?: number;
  referenceMax?: number;
  optimalMin?: number;
  optimalMax?: number;
}

export type MarkerStatus = "optimal" | "normal" | "warning" | "critical";

export interface MarkerWithStatus extends BloodWorkMarker {
  status: MarkerStatus;
  statusMessage: string;
}

// ============================================================================
// Biomarker Categories
// ============================================================================

export const BIOMARKER_CATEGORIES = {
  metabolic: "Metabolic Health",
  lipid: "Lipid Panel",
  inflammation: "Inflammation",
  hormones: "Hormones",
  vitamins: "Vitamins & Minerals",
  blood: "Blood Count",
  kidney: "Kidney Function",
  liver: "Liver Function",
  thyroid: "Thyroid",
  electrolytes: "Electrolytes",
} as const;

export type BiomarkerCategory = keyof typeof BIOMARKER_CATEGORIES;

// ============================================================================
// Biomarker Definitions (Reference + Optimal Ranges)
// ============================================================================

export const BIOMARKERS: Record<string, BiomarkerDefinition> = {
  // Metabolic Health
  "Fasting Glucose": {
    name: "Fasting Glucose",
    category: "metabolic",
    unit: "mg/dL",
    referenceRange: { min: 70, max: 100 },
    optimalRange: { min: 72, max: 90 },
    description: "Blood sugar after fasting. Indicator of diabetes risk.",
  },
  "HbA1c": {
    name: "HbA1c",
    category: "metabolic",
    unit: "%",
    referenceRange: { max: 5.7 },
    optimalRange: { max: 5.3 },
    description: "Average blood sugar over 2-3 months. Gold standard for glucose control.",
  },
  "Fasting Insulin": {
    name: "Fasting Insulin",
    category: "metabolic",
    unit: "μIU/mL",
    referenceRange: { min: 2.6, max: 24.9 },
    optimalRange: { min: 2, max: 8 },
    description: "Insulin levels after fasting. High levels indicate insulin resistance.",
  },
  "HOMA-IR": {
    name: "HOMA-IR",
    category: "metabolic",
    unit: "",
    referenceRange: { max: 2.5 },
    optimalRange: { max: 1.0 },
    description: "Insulin resistance index. Lower is better.",
  },

  // Lipid Panel
  "Total Cholesterol": {
    name: "Total Cholesterol",
    category: "lipid",
    unit: "mg/dL",
    referenceRange: { max: 200 },
    optimalRange: { min: 150, max: 200 },
    description: "Total blood cholesterol. Context-dependent marker.",
  },
  "LDL-C": {
    name: "LDL-C",
    category: "lipid",
    unit: "mg/dL",
    referenceRange: { max: 100 },
    optimalRange: { max: 70 },
    description: "Low-density lipoprotein. Associated with cardiovascular risk.",
  },
  "HDL-C": {
    name: "HDL-C",
    category: "lipid",
    unit: "mg/dL",
    referenceRange: { min: 40 },
    optimalRange: { min: 60 },
    description: "High-density lipoprotein. Protective cholesterol.",
    higherIsBetter: true,
  },
  "Triglycerides": {
    name: "Triglycerides",
    category: "lipid",
    unit: "mg/dL",
    referenceRange: { max: 150 },
    optimalRange: { max: 100 },
    description: "Blood fats. Elevated levels increase cardiovascular risk.",
  },
  "ApoB": {
    name: "ApoB",
    category: "lipid",
    unit: "mg/dL",
    referenceRange: { max: 100 },
    optimalRange: { max: 80 },
    description: "Apolipoprotein B. Better predictor of cardiovascular risk than LDL.",
  },
  "Lp(a)": {
    name: "Lp(a)",
    category: "lipid",
    unit: "nmol/L",
    referenceRange: { max: 75 },
    optimalRange: { max: 30 },
    description: "Lipoprotein(a). Genetic cardiovascular risk factor.",
  },

  // Inflammation
  "hs-CRP": {
    name: "hs-CRP",
    category: "inflammation",
    unit: "mg/L",
    referenceRange: { max: 3.0 },
    optimalRange: { max: 1.0 },
    description: "High-sensitivity C-reactive protein. Marker of systemic inflammation.",
  },
  "Homocysteine": {
    name: "Homocysteine",
    category: "inflammation",
    unit: "μmol/L",
    referenceRange: { min: 5, max: 15 },
    optimalRange: { min: 5, max: 10 },
    description: "Amino acid linked to cardiovascular and cognitive risk.",
  },
  "Ferritin": {
    name: "Ferritin",
    category: "inflammation",
    unit: "ng/mL",
    referenceRange: { min: 12, max: 300 },
    optimalRange: { min: 50, max: 150 },
    description: "Iron storage protein. Also an inflammatory marker when elevated.",
  },

  // Hormones
  "TSH": {
    name: "TSH",
    category: "hormones",
    unit: "mIU/L",
    referenceRange: { min: 0.4, max: 4.0 },
    optimalRange: { min: 1.0, max: 2.5 },
    description: "Thyroid stimulating hormone. Key thyroid function marker.",
  },
  "Free T4": {
    name: "Free T4",
    category: "hormones",
    unit: "ng/dL",
    referenceRange: { min: 0.8, max: 1.8 },
    optimalRange: { min: 1.0, max: 1.5 },
    description: "Active thyroid hormone.",
  },
  "Free T3": {
    name: "Free T3",
    category: "hormones",
    unit: "pg/mL",
    referenceRange: { min: 2.3, max: 4.2 },
    optimalRange: { min: 3.0, max: 4.0 },
    description: "Most active thyroid hormone.",
  },
  "Testosterone (Total)": {
    name: "Testosterone (Total)",
    category: "hormones",
    unit: "ng/dL",
    referenceRange: { min: 264, max: 916 },
    optimalRange: { min: 500, max: 900 },
    description: "Primary male sex hormone. Important for both sexes.",
  },
  "Cortisol (AM)": {
    name: "Cortisol (AM)",
    category: "hormones",
    unit: "μg/dL",
    referenceRange: { min: 6.2, max: 19.4 },
    optimalRange: { min: 10, max: 18 },
    description: "Stress hormone. Morning levels should be elevated.",
  },
  "DHEA-S": {
    name: "DHEA-S",
    category: "hormones",
    unit: "μg/dL",
    referenceRange: { min: 80, max: 560 },
    optimalRange: { min: 200, max: 400 },
    description: "Precursor hormone. Declines with age.",
  },

  // Vitamins & Minerals
  "Vitamin D (25-OH)": {
    name: "Vitamin D (25-OH)",
    category: "vitamins",
    unit: "ng/mL",
    referenceRange: { min: 30, max: 100 },
    optimalRange: { min: 40, max: 60 },
    description: "Essential for bone health, immunity, and overall health.",
  },
  "Vitamin B12": {
    name: "Vitamin B12",
    category: "vitamins",
    unit: "pg/mL",
    referenceRange: { min: 200, max: 900 },
    optimalRange: { min: 500, max: 800 },
    description: "Essential for nerve function and blood cell formation.",
  },
  "Folate": {
    name: "Folate",
    category: "vitamins",
    unit: "ng/mL",
    referenceRange: { min: 3, max: 20 },
    optimalRange: { min: 10, max: 20 },
    description: "B vitamin important for DNA synthesis.",
  },
  "Iron": {
    name: "Iron",
    category: "vitamins",
    unit: "μg/dL",
    referenceRange: { min: 60, max: 170 },
    optimalRange: { min: 80, max: 150 },
    description: "Essential mineral for oxygen transport.",
  },
  "Magnesium": {
    name: "Magnesium",
    category: "vitamins",
    unit: "mg/dL",
    referenceRange: { min: 1.7, max: 2.2 },
    optimalRange: { min: 2.0, max: 2.2 },
    description: "Essential for 300+ enzymatic reactions.",
  },

  // Blood Count
  "Hemoglobin": {
    name: "Hemoglobin",
    category: "blood",
    unit: "g/dL",
    referenceRange: { min: 12, max: 17.5 },
    optimalRange: { min: 13.5, max: 16 },
    description: "Oxygen-carrying protein in red blood cells.",
  },
  "Hematocrit": {
    name: "Hematocrit",
    category: "blood",
    unit: "%",
    referenceRange: { min: 36, max: 50 },
    optimalRange: { min: 40, max: 48 },
    description: "Percentage of blood volume that is red blood cells.",
  },
  "RBC": {
    name: "RBC",
    category: "blood",
    unit: "M/μL",
    referenceRange: { min: 4.0, max: 5.5 },
    optimalRange: { min: 4.5, max: 5.2 },
    description: "Red blood cell count.",
  },
  "WBC": {
    name: "WBC",
    category: "blood",
    unit: "K/μL",
    referenceRange: { min: 4.5, max: 11.0 },
    optimalRange: { min: 4.5, max: 8.0 },
    description: "White blood cell count. Immune system marker.",
  },
  "Platelets": {
    name: "Platelets",
    category: "blood",
    unit: "K/μL",
    referenceRange: { min: 150, max: 400 },
    optimalRange: { min: 180, max: 350 },
    description: "Blood clotting cells.",
  },

  // Kidney Function
  "Creatinine": {
    name: "Creatinine",
    category: "kidney",
    unit: "mg/dL",
    referenceRange: { min: 0.7, max: 1.3 },
    optimalRange: { min: 0.8, max: 1.1 },
    description: "Kidney function marker. Muscle metabolism byproduct.",
  },
  "BUN": {
    name: "BUN",
    category: "kidney",
    unit: "mg/dL",
    referenceRange: { min: 7, max: 20 },
    optimalRange: { min: 10, max: 18 },
    description: "Blood urea nitrogen. Kidney function indicator.",
  },
  "eGFR": {
    name: "eGFR",
    category: "kidney",
    unit: "mL/min",
    referenceRange: { min: 90 },
    optimalRange: { min: 100 },
    description: "Estimated glomerular filtration rate. Kidney filtration capacity.",
    higherIsBetter: true,
  },

  // Liver Function
  "ALT": {
    name: "ALT",
    category: "liver",
    unit: "U/L",
    referenceRange: { max: 41 },
    optimalRange: { max: 25 },
    description: "Liver enzyme. Elevated in liver damage.",
  },
  "AST": {
    name: "AST",
    category: "liver",
    unit: "U/L",
    referenceRange: { max: 40 },
    optimalRange: { max: 25 },
    description: "Liver/muscle enzyme. Elevated in liver or muscle damage.",
  },
  "GGT": {
    name: "GGT",
    category: "liver",
    unit: "U/L",
    referenceRange: { max: 65 },
    optimalRange: { max: 30 },
    description: "Liver enzyme. Sensitive marker for liver health.",
  },
  "Albumin": {
    name: "Albumin",
    category: "liver",
    unit: "g/dL",
    referenceRange: { min: 3.5, max: 5.0 },
    optimalRange: { min: 4.0, max: 5.0 },
    description: "Protein made by liver. Marker of liver function and nutrition.",
    higherIsBetter: true,
  },

  // ============================================================================
  // Additional CBC Markers (for comprehensive Indian lab panels)
  // ============================================================================
  "MCV": {
    name: "MCV",
    category: "blood",
    unit: "fL",
    referenceRange: { min: 80, max: 100 },
    optimalRange: { min: 82, max: 98 },
    description: "Mean Corpuscular Volume. Average red blood cell size.",
  },
  "MCH": {
    name: "MCH",
    category: "blood",
    unit: "pg",
    referenceRange: { min: 27, max: 33 },
    optimalRange: { min: 28, max: 32 },
    description: "Mean Corpuscular Hemoglobin. Average hemoglobin per RBC.",
  },
  "MCHC": {
    name: "MCHC",
    category: "blood",
    unit: "g/dL",
    referenceRange: { min: 31, max: 36 },
    optimalRange: { min: 32, max: 35 },
    description: "Mean Corpuscular Hemoglobin Concentration. Hemoglobin concentration in RBCs.",
  },
  "RDW": {
    name: "RDW",
    category: "blood",
    unit: "%",
    referenceRange: { max: 14.5 },
    optimalRange: { max: 13 },
    description: "Red Cell Distribution Width. Variation in RBC size.",
  },

  // ============================================================================
  // Additional Lipid Markers
  // ============================================================================
  "VLDL Cholesterol": {
    name: "VLDL Cholesterol",
    category: "lipid",
    unit: "mg/dL",
    referenceRange: { max: 30 },
    optimalRange: { max: 20 },
    description: "Very Low Density Lipoprotein. Carries triglycerides.",
  },
  "Non-HDL Cholesterol": {
    name: "Non-HDL Cholesterol",
    category: "lipid",
    unit: "mg/dL",
    referenceRange: { max: 130 },
    optimalRange: { max: 100 },
    description: "Total cholesterol minus HDL. Better predictor than LDL alone.",
  },
  "LDL Cholesterol": {
    name: "LDL Cholesterol",
    category: "lipid",
    unit: "mg/dL",
    referenceRange: { max: 100 },
    optimalRange: { max: 70 },
    description: "Low-density lipoprotein. Associated with cardiovascular risk.",
  },
  "HDL Cholesterol": {
    name: "HDL Cholesterol",
    category: "lipid",
    unit: "mg/dL",
    referenceRange: { min: 40 },
    optimalRange: { min: 60 },
    description: "High-density lipoprotein. Protective cholesterol.",
    higherIsBetter: true,
  },

  // ============================================================================
  // Thyroid (Total T3/T4 - common in Indian panels)
  // ============================================================================
  "T3": {
    name: "T3",
    category: "thyroid",
    unit: "ng/dL",
    referenceRange: { min: 70, max: 204 },
    optimalRange: { min: 100, max: 180 },
    description: "Total Triiodothyronine. Active thyroid hormone.",
  },
  "T4": {
    name: "T4",
    category: "thyroid",
    unit: "μg/dL",
    referenceRange: { min: 4.5, max: 12 },
    optimalRange: { min: 6, max: 10 },
    description: "Total Thyroxine. Main thyroid hormone.",
  },

  // ============================================================================
  // Additional Kidney Markers
  // ============================================================================
  "Uric Acid": {
    name: "Uric Acid",
    category: "kidney",
    unit: "mg/dL",
    referenceRange: { min: 3.5, max: 7.2 },
    optimalRange: { min: 4, max: 6 },
    description: "Metabolic waste product. High levels can cause gout.",
  },
  "Blood Urea": {
    name: "Blood Urea",
    category: "kidney",
    unit: "mg/dL",
    referenceRange: { min: 15, max: 40 },
    optimalRange: { min: 18, max: 35 },
    description: "Waste product from protein metabolism. Kidney function marker.",
  },

  // ============================================================================
  // Additional Liver Markers
  // ============================================================================
  "Bilirubin Total": {
    name: "Bilirubin Total",
    category: "liver",
    unit: "mg/dL",
    referenceRange: { max: 1.2 },
    optimalRange: { max: 1.0 },
    description: "Breakdown product of hemoglobin. Liver function indicator.",
  },
  "Bilirubin Direct": {
    name: "Bilirubin Direct",
    category: "liver",
    unit: "mg/dL",
    referenceRange: { max: 0.3 },
    optimalRange: { max: 0.2 },
    description: "Conjugated bilirubin. Indicates bile duct function.",
  },
  "Bilirubin Indirect": {
    name: "Bilirubin Indirect",
    category: "liver",
    unit: "mg/dL",
    referenceRange: { max: 0.8 },
    optimalRange: { max: 0.6 },
    description: "Unconjugated bilirubin. Indicates hemolysis or liver uptake issues.",
  },
  "Total Protein": {
    name: "Total Protein",
    category: "liver",
    unit: "g/dL",
    referenceRange: { min: 6.0, max: 8.3 },
    optimalRange: { min: 6.5, max: 7.5 },
    description: "Total serum protein. Indicator of liver and kidney function.",
  },
  "Globulin": {
    name: "Globulin",
    category: "liver",
    unit: "g/dL",
    referenceRange: { min: 2.0, max: 4.0 },
    optimalRange: { min: 2.3, max: 3.5 },
    description: "Immune proteins. Part of total protein measurement.",
  },
  "Alkaline Phosphatase": {
    name: "Alkaline Phosphatase",
    category: "liver",
    unit: "U/L",
    referenceRange: { min: 44, max: 147 },
    optimalRange: { min: 50, max: 120 },
    description: "Enzyme from liver and bone. Elevated in liver or bone disease.",
  },

  // ============================================================================
  // Iron Profile Additions
  // ============================================================================
  "TIBC": {
    name: "TIBC",
    category: "vitamins",
    unit: "μg/dL",
    referenceRange: { min: 250, max: 450 },
    optimalRange: { min: 280, max: 400 },
    description: "Total Iron Binding Capacity. Measures transferrin availability.",
  },
  "Transferrin Saturation": {
    name: "Transferrin Saturation",
    category: "vitamins",
    unit: "%",
    referenceRange: { min: 20, max: 50 },
    optimalRange: { min: 25, max: 45 },
    description: "Percentage of transferrin bound to iron. Iron status indicator.",
  },

  // ============================================================================
  // Additional Inflammation Markers
  // ============================================================================
  "ESR": {
    name: "ESR",
    category: "inflammation",
    unit: "mm/hr",
    referenceRange: { max: 20 },
    optimalRange: { max: 10 },
    description: "Erythrocyte Sedimentation Rate. Non-specific inflammation marker.",
  },

  // ============================================================================
  // Electrolytes
  // ============================================================================
  "Sodium": {
    name: "Sodium",
    category: "electrolytes",
    unit: "mEq/L",
    referenceRange: { min: 136, max: 145 },
    optimalRange: { min: 138, max: 142 },
    description: "Essential electrolyte. Regulates fluid balance and nerve function.",
  },
  "Potassium": {
    name: "Potassium",
    category: "electrolytes",
    unit: "mEq/L",
    referenceRange: { min: 3.5, max: 5.0 },
    optimalRange: { min: 3.8, max: 4.8 },
    description: "Essential electrolyte. Critical for heart and muscle function.",
  },
  "Chloride": {
    name: "Chloride",
    category: "electrolytes",
    unit: "mEq/L",
    referenceRange: { min: 98, max: 106 },
    optimalRange: { min: 100, max: 104 },
    description: "Electrolyte that helps maintain fluid balance and pH.",
  },
  "Calcium": {
    name: "Calcium",
    category: "electrolytes",
    unit: "mg/dL",
    referenceRange: { min: 8.5, max: 10.5 },
    optimalRange: { min: 9.0, max: 10.0 },
    description: "Essential mineral for bones, muscles, and nerve function.",
  },
  "Ionized Calcium": {
    name: "Ionized Calcium",
    category: "electrolytes",
    unit: "mmol/L",
    referenceRange: { min: 1.1, max: 1.35 },
    optimalRange: { min: 1.15, max: 1.3 },
    description: "Active form of calcium in blood. More accurate than total calcium.",
  },
};

// ============================================================================
// Status Calculation Functions
// ============================================================================

/**
 * Get the status of a biomarker value
 */
export function getMarkerStatus(
  value: number,
  definition: BiomarkerDefinition
): { status: MarkerStatus; message: string } {
  const { referenceRange, optimalRange, higherIsBetter } = definition;

  // Check if in optimal range
  const inOptimal = isInRange(value, optimalRange);
  if (inOptimal) {
    return { status: "optimal", message: "Optimal range" };
  }

  // Check if in reference (normal) range
  const inReference = isInRange(value, referenceRange);
  if (inReference) {
    return { status: "normal", message: "Within normal range" };
  }

  // Determine if it's a warning or critical
  const { min: refMin, max: refMax } = referenceRange;

  if (refMin !== undefined && value < refMin) {
    const percentBelow = ((refMin - value) / refMin) * 100;
    if (percentBelow > 30) {
      return { status: "critical", message: `Significantly low (${percentBelow.toFixed(0)}% below normal)` };
    }
    return { status: "warning", message: higherIsBetter ? "Below optimal" : "Below normal range" };
  }

  if (refMax !== undefined && value > refMax) {
    const percentAbove = ((value - refMax) / refMax) * 100;
    if (percentAbove > 50) {
      return { status: "critical", message: `Significantly elevated (${percentAbove.toFixed(0)}% above normal)` };
    }
    return { status: "warning", message: higherIsBetter ? "Elevated (may be fine)" : "Above normal range" };
  }

  return { status: "normal", message: "Within range" };
}

/**
 * Check if value is within a range
 */
function isInRange(value: number, range: { min?: number; max?: number }): boolean {
  const { min, max } = range;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Process markers and add status information
 */
export function processMarkers(markers: BloodWorkMarker[]): MarkerWithStatus[] {
  return markers.map((marker) => {
    const definition = BIOMARKERS[marker.name];

    if (!definition) {
      // Unknown marker - use provided ranges or mark as normal
      return {
        ...marker,
        status: "normal" as MarkerStatus,
        statusMessage: "Status cannot be determined for custom marker",
      };
    }

    const { status, message } = getMarkerStatus(marker.value, definition);

    return {
      ...marker,
      status,
      statusMessage: message,
      // Fill in reference/optimal ranges from definitions if not provided
      referenceMin: marker.referenceMin ?? definition.referenceRange.min,
      referenceMax: marker.referenceMax ?? definition.referenceRange.max,
      optimalMin: marker.optimalMin ?? definition.optimalRange.min,
      optimalMax: marker.optimalMax ?? definition.optimalRange.max,
    };
  });
}

/**
 * Calculate summary statistics from processed markers
 */
export function calculateSummary(markers: MarkerWithStatus[]): {
  optimal: number;
  normal: number;
  warning: number;
  critical: number;
  total: number;
  overallScore: number;
} {
  const counts = {
    optimal: 0,
    normal: 0,
    warning: 0,
    critical: 0,
  };

  markers.forEach((m) => {
    counts[m.status]++;
  });

  const total = markers.length;

  // Calculate score: optimal=100, normal=80, warning=50, critical=20
  const score = total > 0
    ? Math.round(
        ((counts.optimal * 100 + counts.normal * 80 + counts.warning * 50 + counts.critical * 20) / total)
      )
    : 0;

  return {
    ...counts,
    total,
    overallScore: score,
  };
}

/**
 * Group markers by category
 */
export function groupMarkersByCategory(
  markers: MarkerWithStatus[]
): Record<string, MarkerWithStatus[]> {
  const grouped: Record<string, MarkerWithStatus[]> = {};

  markers.forEach((marker) => {
    const category = marker.category || "other";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(marker);
  });

  return grouped;
}

/**
 * Get all available marker names for a category
 */
export function getMarkersForCategory(category: BiomarkerCategory): string[] {
  return Object.entries(BIOMARKERS)
    .filter(([, def]) => def.category === category)
    .map(([name]) => name);
}

/**
 * Get all marker names
 */
export function getAllMarkerNames(): string[] {
  return Object.keys(BIOMARKERS);
}
