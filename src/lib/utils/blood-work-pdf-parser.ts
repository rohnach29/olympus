// Blood Work PDF Parser - Uses LLM to extract biomarkers from lab reports

import { extractText } from "unpdf";

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

    // Validate and clean markers
    const markers: ExtractedMarker[] = (parsed.markers || [])
      .filter((m: unknown) => {
        if (typeof m !== "object" || m === null) return false;
        const marker = m as Record<string, unknown>;
        return marker.name && typeof marker.value === "number" && marker.unit;
      })
      .map((m: Record<string, unknown>) => ({
        name: String(m.name),
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
 */
function extractWithRegex(text: string): ExtractedMarker[] {
  const markers: ExtractedMarker[] = [];
  const foundNames = new Set<string>();

  // Normalize text - handle various formats
  const normalizedText = text.replace(/\s+/g, " ");

  // Common patterns for lab values - more flexible matching
  // Format: "Marker Name" followed by a number, then optionally a unit
  const patterns: Array<{ regex: RegExp; name: string; unit: string }> = [
    // Metabolic
    { regex: /(?:fasting\s+)?glucose[:\s]+(\d+\.?\d*)\s*(?:mg\/dL|mmol\/L)?/i, name: "Fasting Glucose", unit: "mg/dL" },
    { regex: /hba1c[:\s]+(\d+\.?\d*)\s*%?/i, name: "HbA1c", unit: "%" },
    { regex: /hemoglobin\s+a1c[:\s]+(\d+\.?\d*)\s*%?/i, name: "HbA1c", unit: "%" },

    // Lipids
    { regex: /(?:total\s+)?cholesterol[:\s]+(\d+\.?\d*)\s*(?:mg\/dL)?/i, name: "Total Cholesterol", unit: "mg/dL" },
    { regex: /ldl(?:\s+cholesterol)?(?:\s+calc)?[:\s]+(\d+\.?\d*)\s*(?:mg\/dL)?/i, name: "LDL Cholesterol", unit: "mg/dL" },
    { regex: /hdl(?:\s+cholesterol)?[:\s]+(\d+\.?\d*)\s*(?:mg\/dL)?/i, name: "HDL Cholesterol", unit: "mg/dL" },
    { regex: /triglycerides?[:\s]+(\d+\.?\d*)\s*(?:mg\/dL)?/i, name: "Triglycerides", unit: "mg/dL" },

    // Kidney
    { regex: /creatinine[:\s]+(\d+\.?\d*)\s*(?:mg\/dL)?/i, name: "Creatinine", unit: "mg/dL" },
    { regex: /bun[:\s]+(\d+\.?\d*)\s*(?:mg\/dL)?/i, name: "BUN", unit: "mg/dL" },
    { regex: /egfr[:\s]+(\d+\.?\d*)/i, name: "eGFR", unit: "mL/min" },

    // Thyroid
    { regex: /tsh[:\s]+(\d+\.?\d*)\s*(?:mIU\/L|uIU\/mL)?/i, name: "TSH", unit: "mIU/L" },
    { regex: /(?:free\s+)?t4[:\s]+(\d+\.?\d*)\s*(?:ng\/dL)?/i, name: "Free T4", unit: "ng/dL" },
    { regex: /(?:free\s+)?t3[:\s]+(\d+\.?\d*)\s*(?:pg\/mL)?/i, name: "Free T3", unit: "pg/mL" },

    // Vitamins
    { regex: /vitamin\s*d[,:\s]+(?:25-?oh)?[:\s]*(\d+\.?\d*)\s*(?:ng\/mL)?/i, name: "Vitamin D", unit: "ng/mL" },
    { regex: /(?:vitamin\s+)?b12[:\s]+(\d+\.?\d*)\s*(?:pg\/mL)?/i, name: "Vitamin B12", unit: "pg/mL" },
    { regex: /folate[:\s]+(\d+\.?\d*)\s*(?:ng\/mL)?/i, name: "Folate", unit: "ng/mL" },

    // CBC - Complete Blood Count
    { regex: /(?:wbc|white\s+blood\s+cell(?:s)?(?:\s+count)?)[:\s]+(\d+\.?\d*)\s*(?:K\/uL|10\^3\/uL|x10E3\/uL)?/i, name: "WBC", unit: "K/uL" },
    { regex: /(?:rbc|red\s+blood\s+cell(?:s)?(?:\s+count)?)[:\s]+(\d+\.?\d*)\s*(?:M\/uL|10\^6\/uL|x10E6\/uL)?/i, name: "RBC", unit: "M/uL" },
    { regex: /hemoglobin[:\s]+(\d+\.?\d*)\s*(?:g\/dL)?/i, name: "Hemoglobin", unit: "g/dL" },
    { regex: /hematocrit[:\s]+(\d+\.?\d*)\s*%?/i, name: "Hematocrit", unit: "%" },
    { regex: /platelets?(?:\s+count)?[:\s]+(\d+\.?\d*)\s*(?:K\/uL|10\^3\/uL)?/i, name: "Platelets", unit: "K/uL" },
    { regex: /mcv[:\s]+(\d+\.?\d*)\s*(?:fL)?/i, name: "MCV", unit: "fL" },
    { regex: /mch[:\s]+(\d+\.?\d*)\s*(?:pg)?/i, name: "MCH", unit: "pg" },
    { regex: /mchc[:\s]+(\d+\.?\d*)\s*(?:g\/dL)?/i, name: "MCHC", unit: "g/dL" },
    { regex: /rdw[:\s]+(\d+\.?\d*)\s*%?/i, name: "RDW", unit: "%" },

    // Differential
    { regex: /lymphocytes?(?:\s+%)?[:\s]+(\d+\.?\d*)\s*%?/i, name: "Lymphocyte %", unit: "%" },
    { regex: /neutrophils?(?:\s+%)?[:\s]+(\d+\.?\d*)\s*%?/i, name: "Neutrophil %", unit: "%" },
    { regex: /monocytes?(?:\s+%)?[:\s]+(\d+\.?\d*)\s*%?/i, name: "Monocyte %", unit: "%" },

    // Liver
    { regex: /alt(?:\s+\(sgpt\))?[:\s]+(\d+\.?\d*)\s*(?:U\/L|IU\/L)?/i, name: "ALT", unit: "U/L" },
    { regex: /ast(?:\s+\(sgot\))?[:\s]+(\d+\.?\d*)\s*(?:U\/L|IU\/L)?/i, name: "AST", unit: "U/L" },
    { regex: /(?:alk(?:aline)?\s+phos(?:phatase)?|alp)[:\s]+(\d+\.?\d*)\s*(?:U\/L|IU\/L)?/i, name: "Alkaline Phosphatase", unit: "U/L" },
    { regex: /(?:total\s+)?bilirubin[:\s]+(\d+\.?\d*)\s*(?:mg\/dL)?/i, name: "Bilirubin", unit: "mg/dL" },
    { regex: /albumin[:\s]+(\d+\.?\d*)\s*(?:g\/dL)?/i, name: "Albumin", unit: "g/dL" },
    { regex: /(?:total\s+)?protein[:\s]+(\d+\.?\d*)\s*(?:g\/dL)?/i, name: "Total Protein", unit: "g/dL" },

    // Iron
    { regex: /ferritin[:\s]+(\d+\.?\d*)\s*(?:ng\/mL)?/i, name: "Ferritin", unit: "ng/mL" },
    { regex: /(?:serum\s+)?iron[:\s]+(\d+\.?\d*)\s*(?:ug\/dL|mcg\/dL)?/i, name: "Iron", unit: "ug/dL" },
    { regex: /tibc[:\s]+(\d+\.?\d*)\s*(?:ug\/dL)?/i, name: "TIBC", unit: "ug/dL" },

    // Inflammation
    { regex: /(?:hs-?)?c-?reactive\s+protein[:\s]+(\d+\.?\d*)\s*(?:mg\/L)?/i, name: "hs-CRP", unit: "mg/L" },
    { regex: /(?:hs-?)?crp[:\s]+(\d+\.?\d*)\s*(?:mg\/L)?/i, name: "hs-CRP", unit: "mg/L" },
    { regex: /esr[:\s]+(\d+\.?\d*)\s*(?:mm\/hr)?/i, name: "ESR", unit: "mm/hr" },

    // Electrolytes
    { regex: /sodium[:\s]+(\d+\.?\d*)\s*(?:mEq\/L|mmol\/L)?/i, name: "Sodium", unit: "mEq/L" },
    { regex: /potassium[:\s]+(\d+\.?\d*)\s*(?:mEq\/L|mmol\/L)?/i, name: "Potassium", unit: "mEq/L" },
    { regex: /chloride[:\s]+(\d+\.?\d*)\s*(?:mEq\/L|mmol\/L)?/i, name: "Chloride", unit: "mEq/L" },
    { regex: /calcium[:\s]+(\d+\.?\d*)\s*(?:mg\/dL)?/i, name: "Calcium", unit: "mg/dL" },
    { regex: /magnesium[:\s]+(\d+\.?\d*)\s*(?:mg\/dL)?/i, name: "Magnesium", unit: "mg/dL" },

    // Hormones
    { regex: /testosterone[:\s]+(\d+\.?\d*)\s*(?:ng\/dL)?/i, name: "Testosterone", unit: "ng/dL" },
    { regex: /estradiol[:\s]+(\d+\.?\d*)\s*(?:pg\/mL)?/i, name: "Estradiol", unit: "pg/mL" },
    { regex: /cortisol[:\s]+(\d+\.?\d*)\s*(?:ug\/dL)?/i, name: "Cortisol", unit: "ug/dL" },
    { regex: /insulin[:\s]+(\d+\.?\d*)\s*(?:uIU\/mL)?/i, name: "Insulin", unit: "uIU/mL" },
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern.regex);
    if (match && !foundNames.has(pattern.name)) {
      const value = parseFloat(match[1]);
      // Sanity check - ignore unrealistic values
      if (!isNaN(value) && value > 0 && value < 100000) {
        markers.push({
          name: pattern.name,
          value: value,
          unit: pattern.unit,
        });
        foundNames.add(pattern.name);
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
