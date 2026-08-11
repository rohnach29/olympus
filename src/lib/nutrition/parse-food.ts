import { z } from "zod";

/**
 * Natural-language food parsing.
 *
 * Replaces the USDA food table: instead of matching a typed query against a
 * local database of ~1.9M rows, we ask an LLM to resolve a phrase like
 * "2 eggs and a slice of sourdough" into structured nutrition and write the
 * result straight into food_logs, which stores nutrition denormalized.
 *
 * The model estimates; it does not look anything up. Every item therefore
 * carries a confidence and, where it had to guess a portion, the assumption it
 * made — the UI shows both so an estimate is never mistaken for a measurement.
 */

const GEMINI_MODEL = process.env.GEMINI_FOOD_MODEL || "gemini-3.6-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class FoodParseError extends Error {
  constructor(message: string, readonly status: number = 502) {
    super(message);
    this.name = "FoodParseError";
  }
}

/** Nutrition fields, all for the *total* amount eaten (not per 100g). */
const nutritionShape = {
  calories: z.coerce.number().min(0).max(20000),
  proteinG: z.coerce.number().min(0).max(2000),
  carbsG: z.coerce.number().min(0).max(2000),
  fatG: z.coerce.number().min(0).max(2000),
  fiberG: z.coerce.number().min(0).max(500),
  sugarG: z.coerce.number().min(0).max(2000),
  saturatedFatG: z.coerce.number().min(0).max(1000),
  sodiumMg: z.coerce.number().min(0).max(100000),
  cholesterolMg: z.coerce.number().min(0).max(10000),
  vitaminAMcg: z.coerce.number().min(0).max(100000),
  vitaminCMg: z.coerce.number().min(0).max(10000),
  vitaminDMcg: z.coerce.number().min(0).max(1000),
  calciumMg: z.coerce.number().min(0).max(20000),
  ironMg: z.coerce.number().min(0).max(1000),
  potassiumMg: z.coerce.number().min(0).max(50000),
};

export const parsedFoodItemSchema = z.object({
  foodName: z.string().min(1).max(120),
  brand: z.string().max(80).nullable().default(null),
  servingQuantity: z.coerce.number().positive().max(100),
  servingUnit: z.string().min(1).max(40),
  servingSize: z.coerce.number().positive().max(10000),
  confidence: z.enum(["high", "medium", "low"]),
  assumption: z.string().max(200).nullable().default(null),
  ...nutritionShape,
});

export type ParsedFoodItem = z.infer<typeof parsedFoodItemSchema>;

const responseSchema = z.object({
  items: z.array(parsedFoodItemSchema).min(1).max(12),
});

/** Gemini's responseSchema dialect (OpenAPI subset) mirroring the Zod shape. */
const NUMBER_FIELDS = Object.keys(nutritionShape);

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          foodName: { type: "STRING", description: "Canonical food name, lowercase, no quantity" },
          brand: { type: "STRING", nullable: true, description: "Brand if named, else null" },
          servingQuantity: { type: "NUMBER", description: "How many units, e.g. 2 for '2 eggs'" },
          servingUnit: { type: "STRING", description: "Unit as a person says it, e.g. 'medium egg', 'slice', 'cup'" },
          servingSize: { type: "NUMBER", description: "TOTAL grams eaten across all units" },
          confidence: { type: "STRING", enum: ["high", "medium", "low"] },
          assumption: {
            type: "STRING",
            nullable: true,
            description: "Portion assumption made, e.g. 'assumed a medium 170g fruit'. Null if the text was explicit.",
          },
          ...Object.fromEntries(NUMBER_FIELDS.map((f) => [f, { type: "NUMBER" }])),
        },
        required: ["foodName", "servingQuantity", "servingUnit", "servingSize", "confidence", ...NUMBER_FIELDS],
      },
    },
  },
  required: ["items"],
};

const SYSTEM_INSTRUCTION = `You convert a person's description of what they ate into structured nutrition data.

Rules:
- Split the text into one item per distinct food. "chicken and rice" is two items.
- All nutrition numbers are for the TOTAL amount eaten, not per 100g. If they ate 3 eggs, report the nutrition of 3 eggs.
- servingSize is total grams. Estimate a realistic portion when they don't give one, and record that guess in "assumption".
- confidence: "high" for a plain whole food with a stated amount; "medium" when you assumed the portion size; "low" for a vague or composite dish like "a bowl of curry".
- Use typical values for a normally prepared version of the food. Never return 0 for calories unless the food genuinely has none (water, black coffee).
- If the text names no food at all, return an empty items array.`;

interface GeminiPart {
  text?: string;
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  error?: { message?: string };
}

/**
 * Parse a free-text meal description into loggable food items.
 * Throws FoodParseError with an appropriate HTTP status on any failure.
 */
export async function parseFoodText(text: string): Promise<ParsedFoodItem[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new FoodParseError("Describe what you ate.", 400);
  }
  if (trimmed.length > 500) {
    throw new FoodParseError("That description is too long — keep it under 500 characters.", 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new FoodParseError("Food parsing is not configured (GEMINI_API_KEY is missing).", 503);
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: trimmed }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new FoodParseError(`Could not reach the nutrition model (${reason}).`, 504);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new FoodParseError("Nutrition model rate limit reached — try again in a moment.", 429);
    }
    throw new FoodParseError(
      `Nutrition model returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      502
    );
  }

  const payload = (await response.json()) as GeminiResponse;
  if (payload.error?.message) {
    throw new FoodParseError(`Nutrition model error: ${payload.error.message}`, 502);
  }

  const raw = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!raw.trim()) {
    throw new FoodParseError("Nutrition model returned an empty response.", 502);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new FoodParseError("Nutrition model returned malformed JSON.", 502);
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    // An empty items array is a legitimate "no food found", not a schema failure.
    const empty = z.object({ items: z.array(z.unknown()).length(0) }).safeParse(json);
    if (empty.success) {
      throw new FoodParseError("No food found in that description.", 422);
    }
    throw new FoodParseError(
      `Nutrition model returned unusable data: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
      502
    );
  }

  return parsed.data.items;
}
