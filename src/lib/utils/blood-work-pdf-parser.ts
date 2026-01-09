// Blood Work PDF Parser - Uses LLM to extract biomarkers from lab reports

import { extractText } from "unpdf";

// ============================================================================
// Name Normalization - Maps common lab report names to our standard names
// ============================================================================
const NAME_ALIASES: Record<string, string> = {
  // Lipids - Indian labs often use full names
  "LDL Cholesterol": "LDL-C",
  "LDL-Cholesterol": "LDL-C",
  "LDL cholesterol": "LDL-C",
  "HDL Cholesterol": "HDL-C",
  "HDL-Cholesterol": "HDL-C",
  "HDL cholesterol": "HDL-C",
  "Non HDL Cholesterol": "Non-HDL Cholesterol",
  "Non-HDL cholesterol": "Non-HDL Cholesterol",
  "VLDL": "VLDL Cholesterol",
  "VLDL-C": "VLDL Cholesterol",

  // Liver - SGOT/SGPT common in Indian labs
  "SGOT (AST)": "AST",
  "SGPT (ALT)": "ALT",
  "SGOT": "AST",
  "SGPT": "ALT",
  "S.G.O.T": "AST",
  "S.G.P.T": "ALT",
  "GGTP (Gamma GT)": "GGT",
  "GGTP": "GGT",
  "Gamma GT": "GGT",
  "Gamma-GT": "GGT",
  "GGT (Gamma GT)": "GGT",
  "Bilirubin Total": "Bilirubin Total",
  "Total Bilirubin": "Bilirubin Total",
  "Bilirubin (Total)": "Bilirubin Total",
  "Direct Bilirubin": "Bilirubin Direct",
  "Indirect Bilirubin": "Bilirubin Indirect",
  "Protein Total": "Total Protein",
  "Total Proteins": "Total Protein",
  "Serum Albumin": "Albumin",

  // Thyroid - Various naming conventions
  "TSH-Ultrasensitive": "TSH",
  "TSH Ultrasensitive": "TSH",
  "TSH (Ultrasensitive)": "TSH",
  "Tri-iodothyronine (T3)": "T3",
  "Triiodothyronine": "T3",
  "Total T3": "T3",
  "Thyroxine (T4)": "T4",
  "Total T4": "T4",
  "Free T4 (FT4)": "Free T4",
  "Free T3 (FT3)": "Free T3",

  // Vitamins - Multiple naming styles
  "Vitamin D Total-25 Hydroxy": "Vitamin D (25-OH)",
  "Vitamin D Total": "Vitamin D (25-OH)",
  "Vitamin D, 25-Hydroxy": "Vitamin D (25-OH)",
  "25-OH Vitamin D": "Vitamin D (25-OH)",
  "25 Hydroxy Vitamin D": "Vitamin D (25-OH)",
  "Vitamin D 25 OH": "Vitamin D (25-OH)",
  "Vit D3": "Vitamin D (25-OH)",
  "Vitamin B12 Cyanocobalamin": "Vitamin B12",
  "Cyanocobalamin": "Vitamin B12",
  "Vit B12": "Vitamin B12",

  // CBC - British/Indian spelling and full names
  "Haemoglobin": "Hemoglobin",
  "Hb": "Hemoglobin",
  "HGB": "Hemoglobin",
  "Erythrocytes (RBC)": "RBC",
  "Erythrocytes": "RBC",
  "Red Blood Cells": "RBC",
  "Red Blood Cell Count": "RBC",
  "Total WBC Count": "WBC",
  "White Blood Cells": "WBC",
  "White Blood Cell Count": "WBC",
  "Leucocytes": "WBC",
  "Total Leucocyte Count": "WBC",
  "TLC": "WBC",
  "Platelet Count": "Platelets",
  "Thrombocytes": "Platelets",
  "Hematocrit (HCT)": "Hematocrit",
  "HCT": "Hematocrit",
  "Haematocrit": "Hematocrit",
  "PCV": "Hematocrit",
  "RDW SD": "RDW",
  "RDW-SD": "RDW",
  "RDW CV": "RDW",
  "RDW-CV": "RDW",

  // Kidney - Various formats
  "Blood Urea Nitrogen BUN": "BUN",
  "Blood Urea Nitrogen": "BUN",
  "Urea Nitrogen": "BUN",
  "Serum Creatinine": "Creatinine",
  "S. Creatinine": "Creatinine",
  "eGFR (CKD-EPI)": "eGFR",
  "GFR": "eGFR",

  // Iron profile
  "Serum Iron": "Iron",
  "S. Iron": "Iron",
  "Serum Ferritin": "Ferritin",
  "S. Ferritin": "Ferritin",
  "Transferrin Saturation %": "Transferrin Saturation",
  "TSAT": "Transferrin Saturation",
  "Iron Saturation": "Transferrin Saturation",

  // Metabolic
  "Fasting Glucose (Plasma)": "Fasting Glucose",
  "Glucose Fasting": "Fasting Glucose",
  "Glucose (Fasting)": "Fasting Glucose",
  "FBS": "Fasting Glucose",
  "Fasting Blood Sugar": "Fasting Glucose",
  "HbA1C": "HbA1c",
  "HBA1C": "HbA1c",
  "Glycated Hemoglobin": "HbA1c",
  "Glycosylated Hemoglobin": "HbA1c",

  // Inflammation
  "Erythrocyte Sedimentation Rate": "ESR",
  "Erythrocyte Sedimentation Rate (ESR)": "ESR",
  "hs-CRP": "hs-CRP",
  "hsCRP": "hs-CRP",
  "High Sensitivity CRP": "hs-CRP",
  "C-Reactive Protein": "hs-CRP",

  // Electrolytes
  "Sodium (Na)": "Sodium",
  "Na": "Sodium",
  "Serum Sodium": "Sodium",
  "Potassium (K)": "Potassium",
  "K": "Potassium",
  "Serum Potassium": "Potassium",
  "Chloride (Cl)": "Chloride",
  "Cl": "Chloride",
  "Serum Chloride": "Chloride",
  "Calcium Total": "Calcium",
  "Total Calcium": "Calcium",
  "Serum Calcium": "Calcium",
  "Ionised Calcium": "Ionized Calcium",
  "Ca++": "Ionized Calcium",
};

/**
 * Normalize marker name using aliases
 */
function normalizeMarkerName(name: string): string {
  // Try exact match first
  if (NAME_ALIASES[name]) {
    return NAME_ALIASES[name];
  }

  // Try case-insensitive match
  const lowerName = name.toLowerCase();
  for (const [alias, standardName] of Object.entries(NAME_ALIASES)) {
    if (alias.toLowerCase() === lowerName) {
      return standardName;
    }
  }

  // Return original name if no alias found
  return name;
}

interface ExtractedMarker {
  name: string;
  value: number;
  unit: string;
  referenceRange?: string;
}

interface ParseResult {
  success: boolean;
  markers: ExtractedMarker[];
  labName?: string;
  testDate?: string;
  error?: string;
  rawText?: string;
}

// LLM Configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || "ollama";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "deepseek-r1:7b";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const EXTRACTION_PROMPT = `You are a medical data extraction assistant. Extract all biomarkers/lab values from this blood work report.

IMPORTANT: Return ONLY valid JSON, no other text. Use this exact format:
{
  "labName": "Lab name if found, or null",
  "testDate": "YYYY-MM-DD format if found, or null",
  "markers": [
    {"name": "Glucose", "value": 95, "unit": "mg/dL", "referenceRange": "70-100"},
    {"name": "Hemoglobin", "value": 14.5, "unit": "g/dL", "referenceRange": "12.0-17.5"}
  ]
}

Rules:
- Extract ALL numeric lab values you can find
- Standardize marker names (e.g., "Gluc" → "Glucose", "Hgb" → "Hemoglobin")
- value must be a number (not a string)
- Include reference ranges if shown
- Common markers: Glucose, HbA1c, Cholesterol (Total, LDL, HDL), Triglycerides, TSH, Vitamin D, B12, Iron, Ferritin, Creatinine, BUN, ALT, AST, Albumin, CRP, WBC, RBC, Hemoglobin, Hematocrit, Platelets, etc.

Blood work report text:
`;

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(pdfBuffer);
    const { text } = await extractText(uint8Array);
    // unpdf returns an array of strings (one per page), join them
    return Array.isArray(text) ? text.join("\n") : text;
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

/**
 * Call LLM to extract biomarkers from text
 */
async function callLLM(text: string): Promise<string> {
  const prompt = EXTRACTION_PROMPT + text;

  if (LLM_PROVIDER === "groq" && GROQ_API_KEY) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "You extract lab values from blood work reports. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
        temperature: 0.1, // Low temperature for consistent extraction
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } else {
    // Use Ollama
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: "You extract lab values from blood work reports. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_ctx: 8192,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || "";
  }
}

/**
 * Parse LLM response to extract JSON
 */
function parseJSONResponse(response: string): { labName?: string; testDate?: string; markers: ExtractedMarker[] } {
  // Try to find JSON in the response (LLM might add extra text)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in LLM response");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and clean markers, applying name normalization
    const markers: ExtractedMarker[] = (parsed.markers || [])
      .filter((m: unknown) => {
        if (typeof m !== "object" || m === null) return false;
        const marker = m as Record<string, unknown>;
        return marker.name && typeof marker.value === "number" && marker.unit;
      })
      .map((m: Record<string, unknown>) => ({
        name: normalizeMarkerName(String(m.name)), // Apply normalization
        value: Number(m.value),
        unit: String(m.unit),
        referenceRange: m.referenceRange ? String(m.referenceRange) : undefined,
      }));

    return {
      labName: parsed.labName || undefined,
      testDate: parsed.testDate || undefined,
      markers,
    };
  } catch {
    throw new Error("Failed to parse JSON from LLM response");
  }
}

/**
 * Fallback: Extract common markers using regex patterns
 * Used when LLM is not available
 * Updated for Indian lab report formats (space/tab separated, British spellings)
 */
function extractWithRegex(text: string): ExtractedMarker[] {
  const markers: ExtractedMarker[] = [];
  const foundNames = new Set<string>();

  // Normalize text - preserve some structure but clean up excess whitespace
  const normalizedText = text.replace(/\s+/g, " ");

  // Pattern separator: handles colon, space, tab, or combinations
  // Indian labs often use: "Marker Name    Value    Unit    Range"
  const SEP = "[:\\s]+";

  // Common patterns for lab values - flexible for Indian lab formats
  // Uses space/tab OR colon as separator
  const patterns: Array<{ regex: RegExp; name: string; unit: string }> = [
    // ============================================================================
    // Metabolic
    // ============================================================================
    { regex: new RegExp(`(?:fasting\\s+)?glucose(?:\\s*\\(plasma\\))?${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Fasting Glucose", unit: "mg/dL" },
    { regex: new RegExp(`glucose\\s+fasting${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Fasting Glucose", unit: "mg/dL" },
    { regex: new RegExp(`hba1c${SEP}(\\d+\\.?\\d*)\\s*%?`, "i"), name: "HbA1c", unit: "%" },
    { regex: new RegExp(`h(?:a)?emoglobin\\s+a1c${SEP}(\\d+\\.?\\d*)\\s*%?`, "i"), name: "HbA1c", unit: "%" },
    { regex: new RegExp(`glycated\\s+h(?:a)?emoglobin${SEP}(\\d+\\.?\\d*)\\s*%?`, "i"), name: "HbA1c", unit: "%" },

    // ============================================================================
    // Lipids
    // ============================================================================
    { regex: new RegExp(`total\\s+cholesterol${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Total Cholesterol", unit: "mg/dL" },
    { regex: new RegExp(`ldl\\s+cholesterol${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "LDL Cholesterol", unit: "mg/dL" },
    { regex: new RegExp(`hdl\\s+cholesterol${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "HDL Cholesterol", unit: "mg/dL" },
    { regex: new RegExp(`triglycerides?${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Triglycerides", unit: "mg/dL" },
    { regex: new RegExp(`vldl\\s+cholesterol${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "VLDL Cholesterol", unit: "mg/dL" },
    { regex: new RegExp(`non[\\s-]?hdl\\s+cholesterol${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Non-HDL Cholesterol", unit: "mg/dL" },

    // ============================================================================
    // Kidney
    // ============================================================================
    { regex: new RegExp(`creatinine${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Creatinine", unit: "mg/dL" },
    { regex: new RegExp(`blood\\s+urea\\s+nitrogen\\s*(?:bun)?${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "BUN", unit: "mg/dL" },
    { regex: new RegExp(`bun${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "BUN", unit: "mg/dL" },
    { regex: new RegExp(`blood\\s+urea${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Blood Urea", unit: "mg/dL" },
    { regex: new RegExp(`uric\\s+acid${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Uric Acid", unit: "mg/dL" },
    { regex: new RegExp(`egfr${SEP}(\\d+\\.?\\d*)`, "i"), name: "eGFR", unit: "mL/min" },

    // ============================================================================
    // Thyroid
    // ============================================================================
    { regex: new RegExp(`tsh(?:-?ultrasensitive)?${SEP}(\\d+\\.?\\d*)\\s*(?:mIU\\/[lL]|[uμ]IU\\/m[lL])?`, "i"), name: "TSH", unit: "mIU/L" },
    { regex: new RegExp(`(?:tri-?iodothyronine|total\\s+t3|t3)(?:\\s*\\(t3\\))?${SEP}(\\d+\\.?\\d*)\\s*(?:ng\\/d[lL])?`, "i"), name: "T3", unit: "ng/dL" },
    { regex: new RegExp(`(?:thyroxine|total\\s+t4|t4)(?:\\s*\\(t4\\))?${SEP}(\\d+\\.?\\d*)\\s*(?:[uμ]g\\/d[lL])?`, "i"), name: "T4", unit: "μg/dL" },
    { regex: new RegExp(`free\\s+t4${SEP}(\\d+\\.?\\d*)\\s*(?:ng\\/d[lL])?`, "i"), name: "Free T4", unit: "ng/dL" },
    { regex: new RegExp(`free\\s+t3${SEP}(\\d+\\.?\\d*)\\s*(?:pg\\/m[lL])?`, "i"), name: "Free T3", unit: "pg/mL" },

    // ============================================================================
    // Vitamins
    // ============================================================================
    { regex: new RegExp(`vitamin\\s*d[\\s-]*(?:total)?[\\s-]*(?:25)?[\\s-]*(?:hydroxy)?${SEP}(\\d+\\.?\\d*)\\s*(?:ng\\/m[lL])?`, "i"), name: "Vitamin D (25-OH)", unit: "ng/mL" },
    { regex: new RegExp(`(?:vitamin\\s+)?b12(?:\\s+cyanocobalamin)?${SEP}(\\d+\\.?\\d*)\\s*(?:pg\\/m[lL])?`, "i"), name: "Vitamin B12", unit: "pg/mL" },
    { regex: new RegExp(`folate${SEP}(\\d+\\.?\\d*)\\s*(?:ng\\/m[lL])?`, "i"), name: "Folate", unit: "ng/mL" },

    // ============================================================================
    // CBC - Complete Blood Count (with British spellings)
    // ============================================================================
    { regex: new RegExp(`h(?:a)?emoglobin${SEP}(\\d+\\.?\\d*)\\s*(?:g\\/d[lL])?`, "i"), name: "Hemoglobin", unit: "g/dL" },
    { regex: new RegExp(`(?:erythrocytes|rbc)(?:\\s*\\(rbc\\))?${SEP}(\\d+\\.?\\d*)\\s*(?:10\\^6\\/[uμ][lL]|M\\/[uμ][lL])?`, "i"), name: "RBC", unit: "M/μL" },
    { regex: new RegExp(`(?:h(?:a)?ematocrit|hct)(?:\\s*\\(hct\\))?${SEP}(\\d+\\.?\\d*)\\s*%?`, "i"), name: "Hematocrit", unit: "%" },
    { regex: new RegExp(`(?:total\\s+wbc\\s+count|wbc|leucocytes?|white\\s+blood\\s+cells?)${SEP}(\\d+\\.?\\d*)\\s*(?:\\/cu\\.?m\\.?m|K?\\/[uμ][lL])?`, "i"), name: "WBC", unit: "K/μL" },
    { regex: new RegExp(`(?:platelet\\s+count|platelets?|thrombocytes?)${SEP}(\\d+)\\s*(?:\\/cu\\.?m\\.?m|K?\\/[uμ][lL])?`, "i"), name: "Platelets", unit: "K/μL" },
    { regex: new RegExp(`mcv${SEP}(\\d+\\.?\\d*)\\s*(?:f[lL])?`, "i"), name: "MCV", unit: "fL" },
    { regex: new RegExp(`mch${SEP}(\\d+\\.?\\d*)\\s*(?:pg)?`, "i"), name: "MCH", unit: "pg" },
    { regex: new RegExp(`mchc${SEP}(\\d+\\.?\\d*)\\s*(?:g\\/d[lL])?`, "i"), name: "MCHC", unit: "g/dL" },
    { regex: new RegExp(`rdw(?:[\\s-]?(?:sd|cv))?${SEP}(\\d+\\.?\\d*)\\s*%?`, "i"), name: "RDW", unit: "%" },

    // ============================================================================
    // Differential (percentages)
    // ============================================================================
    { regex: new RegExp(`neutrophils?${SEP}(\\d+\\.?\\d*)\\s*%`, "i"), name: "Neutrophil %", unit: "%" },
    { regex: new RegExp(`lymphocytes?${SEP}(\\d+\\.?\\d*)\\s*%`, "i"), name: "Lymphocyte %", unit: "%" },
    { regex: new RegExp(`monocytes?${SEP}(\\d+\\.?\\d*)\\s*%`, "i"), name: "Monocyte %", unit: "%" },
    { regex: new RegExp(`eosinophils?${SEP}(\\d+\\.?\\d*)\\s*%`, "i"), name: "Eosinophil %", unit: "%" },
    { regex: new RegExp(`basophils?${SEP}(\\d+\\.?\\d*)\\s*%`, "i"), name: "Basophil %", unit: "%" },

    // ============================================================================
    // Liver (including Indian lab naming: SGOT/SGPT)
    // ============================================================================
    { regex: new RegExp(`(?:sgpt|alt)(?:\\s*\\((?:sgpt|alt)\\))?${SEP}(\\d+\\.?\\d*)\\s*(?:U\\/[lL]|IU\\/[lL])?`, "i"), name: "ALT", unit: "U/L" },
    { regex: new RegExp(`(?:sgot|ast)(?:\\s*\\((?:sgot|ast)\\))?${SEP}(\\d+\\.?\\d*)\\s*(?:U\\/[lL]|IU\\/[lL])?`, "i"), name: "AST", unit: "U/L" },
    { regex: new RegExp(`(?:alkaline\\s+phosphatase|alp)${SEP}(\\d+\\.?\\d*)\\s*(?:U\\/[lL]|IU\\/[lL])?`, "i"), name: "Alkaline Phosphatase", unit: "U/L" },
    { regex: new RegExp(`(?:ggtp|gamma\\s*gt|ggt)(?:\\s*\\([^)]*\\))?${SEP}(\\d+\\.?\\d*)\\s*(?:U\\/[lL])?`, "i"), name: "GGT", unit: "U/L" },
    { regex: new RegExp(`bilirubin\\s+total${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Bilirubin Total", unit: "mg/dL" },
    { regex: new RegExp(`bilirubin\\s+direct${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Bilirubin Direct", unit: "mg/dL" },
    { regex: new RegExp(`bilirubin\\s+indirect${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Bilirubin Indirect", unit: "mg/dL" },
    { regex: new RegExp(`albumin${SEP}(\\d+\\.?\\d*)\\s*(?:g\\/d[lL])?`, "i"), name: "Albumin", unit: "g/dL" },
    { regex: new RegExp(`(?:total\\s+)?protein(?:\\s+total)?${SEP}(\\d+\\.?\\d*)\\s*(?:g\\/d[lL])?`, "i"), name: "Total Protein", unit: "g/dL" },
    { regex: new RegExp(`globulin${SEP}(\\d+\\.?\\d*)\\s*(?:g\\/d[lL])?`, "i"), name: "Globulin", unit: "g/dL" },

    // ============================================================================
    // Iron Profile
    // ============================================================================
    { regex: new RegExp(`ferritin${SEP}(\\d+\\.?\\d*)\\s*(?:ng\\/m[lL])?`, "i"), name: "Ferritin", unit: "ng/mL" },
    { regex: new RegExp(`(?:serum\\s+)?iron${SEP}(\\d+\\.?\\d*)\\s*(?:[uμ]g\\/d[lL])?`, "i"), name: "Iron", unit: "μg/dL" },
    { regex: new RegExp(`tibc${SEP}(\\d+\\.?\\d*)\\s*(?:[uμ]g\\/d[lL])?`, "i"), name: "TIBC", unit: "μg/dL" },
    { regex: new RegExp(`transferrin\\s+saturation${SEP}(\\d+\\.?\\d*)\\s*%?`, "i"), name: "Transferrin Saturation", unit: "%" },

    // ============================================================================
    // Inflammation
    // ============================================================================
    { regex: new RegExp(`(?:hs-?)?c-?reactive\\s+protein${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/[lL])?`, "i"), name: "hs-CRP", unit: "mg/L" },
    { regex: new RegExp(`(?:hs-?)?crp${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/[lL])?`, "i"), name: "hs-CRP", unit: "mg/L" },
    { regex: new RegExp(`(?:erythrocyte\\s+sedimentation\\s+rate|esr)(?:\\s*\\(esr\\))?${SEP}(\\d+\\.?\\d*)\\s*(?:mm\\/hr)?`, "i"), name: "ESR", unit: "mm/hr" },

    // ============================================================================
    // Electrolytes
    // ============================================================================
    { regex: new RegExp(`sodium${SEP}(\\d+\\.?\\d*)\\s*(?:mEq\\/[lL]|mmol\\/[lL])?`, "i"), name: "Sodium", unit: "mEq/L" },
    { regex: new RegExp(`potassium${SEP}(\\d+\\.?\\d*)\\s*(?:mEq\\/[lL]|mmol\\/[lL])?`, "i"), name: "Potassium", unit: "mEq/L" },
    { regex: new RegExp(`chloride${SEP}(\\d+\\.?\\d*)\\s*(?:mEq\\/[lL]|mmol\\/[lL])?`, "i"), name: "Chloride", unit: "mEq/L" },
    { regex: new RegExp(`(?:calcium\\s+total|total\\s+calcium|calcium)${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Calcium", unit: "mg/dL" },
    { regex: new RegExp(`(?:ionised|ionized)\\s+calcium${SEP}(\\d+\\.?\\d*)\\s*(?:mmol\\/[lL])?`, "i"), name: "Ionized Calcium", unit: "mmol/L" },
    { regex: new RegExp(`magnesium${SEP}(\\d+\\.?\\d*)\\s*(?:mg\\/d[lL])?`, "i"), name: "Magnesium", unit: "mg/dL" },

    // ============================================================================
    // Hormones
    // ============================================================================
    { regex: new RegExp(`testosterone${SEP}(\\d+\\.?\\d*)\\s*(?:ng\\/d[lL])?`, "i"), name: "Testosterone", unit: "ng/dL" },
    { regex: new RegExp(`estradiol${SEP}(\\d+\\.?\\d*)\\s*(?:pg\\/m[lL])?`, "i"), name: "Estradiol", unit: "pg/mL" },
    { regex: new RegExp(`cortisol${SEP}(\\d+\\.?\\d*)\\s*(?:[uμ]g\\/d[lL])?`, "i"), name: "Cortisol", unit: "μg/dL" },
    { regex: new RegExp(`(?:fasting\\s+)?insulin${SEP}(\\d+\\.?\\d*)\\s*(?:[uμ]IU\\/m[lL])?`, "i"), name: "Insulin", unit: "μIU/mL" },
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern.regex);
    if (match) {
      // Normalize the marker name
      const normalizedName = normalizeMarkerName(pattern.name);

      // Skip if we already have this marker
      if (foundNames.has(normalizedName)) continue;

      const value = parseFloat(match[1]);
      // Sanity check - ignore unrealistic values
      if (!isNaN(value) && value > 0 && value < 1000000) {
        markers.push({
          name: normalizedName,
          value: value,
          unit: pattern.unit,
        });
        foundNames.add(normalizedName);
      }
    }
  }

  return markers;
}

/**
 * Main function: Parse blood work PDF and extract biomarkers
 */
export async function parseBloodWorkPDF(pdfBuffer: Buffer): Promise<ParseResult> {
  try {
    // Step 1: Extract text from PDF
    const rawText = await extractTextFromPDF(pdfBuffer);

    if (!rawText || rawText.trim().length < 50) {
      return {
        success: false,
        markers: [],
        error: "PDF appears to be empty or couldn't be read. It might be a scanned image - try a text-based PDF.",
        rawText,
      };
    }

    // Step 2: Check if LLM is available
    const llmStatus = await checkLLMAvailability();

    if (llmStatus.available) {
      // Try LLM extraction
      try {
        const llmResponse = await callLLM(rawText.substring(0, 10000)); // Limit text length
        const parsed = parseJSONResponse(llmResponse);

        if (parsed.markers.length > 0) {
          return {
            success: true,
            markers: parsed.markers,
            labName: parsed.labName,
            testDate: parsed.testDate,
            rawText,
          };
        }
      } catch (llmError) {
        console.warn("LLM extraction failed, falling back to regex:", llmError);
      }
    }

    // Step 3: Use regex extraction (primary method when no LLM)
    const regexMarkers = extractWithRegex(rawText);

    if (regexMarkers.length === 0) {
      return {
        success: false,
        markers: [],
        error: "Could not extract any biomarkers. The PDF text was extracted but no recognizable lab values were found. Try manual entry instead.",
        rawText: rawText.substring(0, 1000), // Show preview for debugging
      };
    }

    return {
      success: true,
      markers: regexMarkers,
      rawText,
    };
  } catch (error) {
    console.error("Blood work PDF parsing error:", error);
    return {
      success: false,
      markers: [],
      error: error instanceof Error ? error.message : "Unknown error parsing PDF",
    };
  }
}

/**
 * Check if LLM is available for extraction
 */
export async function checkLLMAvailability(): Promise<{ available: boolean; provider: string }> {
  try {
    if (LLM_PROVIDER === "groq" && GROQ_API_KEY) {
      return { available: true, provider: "groq" };
    }

    // Check Ollama
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    return { available: response.ok, provider: "ollama" };
  } catch {
    return { available: false, provider: LLM_PROVIDER };
  }
}
