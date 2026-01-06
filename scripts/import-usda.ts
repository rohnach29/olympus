/**
 * USDA FoodData Central Import Script
 *
 * This script imports the USDA food database into our PostgreSQL database.
 *
 * SETUP:
 * 1. Go to: https://fdc.nal.usda.gov/download-datasets.html
 * 2. Download "Foundation Foods" or "SR Legacy" (JSON format)
 * 3. Extract the JSON file to: scripts/usda-data/
 * 4. Run: npx tsx scripts/import-usda.ts
 *
 * ARCHITECTURE:
 * - USDA provides ~400,000 foods with detailed nutrient data
 * - Each food has nutrients identified by "nutrientId"
 * - We map these IDs to our schema columns
 * - We batch insert 500 foods at a time for performance
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// Database connection
const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/olympus";
const client = postgres(connectionString);
const db = drizzle(client);

// USDA Nutrient ID mappings
// These IDs are standardized by USDA - they never change
const NUTRIENT_MAP: Record<number, string> = {
  // Macronutrients
  1008: "calories",        // Energy (kcal)
  1003: "proteinG",        // Protein
  1004: "fatG",            // Total lipid (fat)
  1005: "carbsG",          // Carbohydrate
  1079: "fiberG",          // Fiber, total dietary
  2000: "sugarG",          // Sugars, total
  1235: "addedSugarG",     // Sugars, added

  // Fat breakdown
  1258: "saturatedFatG",   // Fatty acids, saturated
  1257: "transFatG",       // Fatty acids, trans
  1292: "monounsaturatedFatG",  // Fatty acids, monounsaturated
  1293: "polyunsaturatedFatG",  // Fatty acids, polyunsaturated

  // Vitamins
  1106: "vitaminAMcg",     // Vitamin A, RAE
  1162: "vitaminCMg",      // Vitamin C
  1114: "vitaminDMcg",     // Vitamin D (D2 + D3)
  1109: "vitaminEMg",      // Vitamin E
  1185: "vitaminKMcg",     // Vitamin K
  1165: "thiaminMg",       // Thiamin (B1)
  1166: "riboflavinMg",    // Riboflavin (B2)
  1167: "niacinMg",        // Niacin (B3)
  1175: "vitaminB6Mg",     // Vitamin B6
  1177: "folateMcg",       // Folate, total
  1178: "vitaminB12Mcg",   // Vitamin B12

  // Minerals
  1087: "calciumMg",       // Calcium
  1089: "ironMg",          // Iron
  1090: "magnesiumMg",     // Magnesium
  1091: "phosphorusMg",    // Phosphorus
  1092: "potassiumMg",     // Potassium
  1093: "sodiumMg",        // Sodium
  1095: "zincMg",          // Zinc
  1098: "copperMg",        // Copper
  1101: "manganeseMg",     // Manganese
  1103: "seleniumMcg",     // Selenium

  // Other
  1253: "cholesterolMg",   // Cholesterol
  1057: "caffeineMg",      // Caffeine
  1051: "waterG",          // Water
};

// Type for USDA food item
interface USDAFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  foodCategory?: { description: string };
  foodNutrients: Array<{
    nutrient: { id: number; name: string; unitName: string };
    amount?: number;
  }>;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
}

// Extract nutrients from USDA format to our format
function extractNutrients(usdaFood: USDAFood): Record<string, number> {
  const nutrients: Record<string, number> = {};

  for (const fn of usdaFood.foodNutrients) {
    const nutrientId = fn.nutrient?.id;
    const columnName = NUTRIENT_MAP[nutrientId];

    if (columnName && fn.amount !== undefined) {
      nutrients[columnName] = fn.amount;
    }
  }

  return nutrients;
}

// Convert USDA food to our schema format
function convertFood(usdaFood: USDAFood): Record<string, any> {
  const nutrients = extractNutrients(usdaFood);

  return {
    source: "usda",
    sourceId: String(usdaFood.fdcId),
    name: usdaFood.description,
    brand: usdaFood.brandOwner || usdaFood.brandName || null,
    barcode: usdaFood.gtinUpc || null,
    category: usdaFood.foodCategory?.description || null,
    servingSize: String(usdaFood.servingSize || 100),
    servingUnit: usdaFood.servingSizeUnit || "g",
    servingSizeDescription: usdaFood.householdServingFullText || null,

    // Macros
    calories: String(nutrients.calories || 0),
    proteinG: String(nutrients.proteinG || 0),
    fatG: String(nutrients.fatG || 0),
    carbsG: String(nutrients.carbsG || 0),
    fiberG: String(nutrients.fiberG || 0),
    sugarG: String(nutrients.sugarG || 0),
    addedSugarG: String(nutrients.addedSugarG || 0),

    // Fat breakdown
    saturatedFatG: String(nutrients.saturatedFatG || 0),
    transFatG: String(nutrients.transFatG || 0),
    monounsaturatedFatG: String(nutrients.monounsaturatedFatG || 0),
    polyunsaturatedFatG: String(nutrients.polyunsaturatedFatG || 0),

    // Vitamins
    vitaminAMcg: String(nutrients.vitaminAMcg || 0),
    vitaminCMg: String(nutrients.vitaminCMg || 0),
    vitaminDMcg: String(nutrients.vitaminDMcg || 0),
    vitaminEMg: String(nutrients.vitaminEMg || 0),
    vitaminKMcg: String(nutrients.vitaminKMcg || 0),
    thiaminMg: String(nutrients.thiaminMg || 0),
    riboflavinMg: String(nutrients.riboflavinMg || 0),
    niacinMg: String(nutrients.niacinMg || 0),
    vitaminB6Mg: String(nutrients.vitaminB6Mg || 0),
    folateMcg: String(nutrients.folateMcg || 0),
    vitaminB12Mcg: String(nutrients.vitaminB12Mcg || 0),

    // Minerals
    calciumMg: String(nutrients.calciumMg || 0),
    ironMg: String(nutrients.ironMg || 0),
    magnesiumMg: String(nutrients.magnesiumMg || 0),
    phosphorusMg: String(nutrients.phosphorusMg || 0),
    potassiumMg: String(nutrients.potassiumMg || 0),
    sodiumMg: String(nutrients.sodiumMg || 0),
    zincMg: String(nutrients.zincMg || 0),
    copperMg: String(nutrients.copperMg || 0),
    manganeseMg: String(nutrients.manganeseMg || 0),
    seleniumMcg: String(nutrients.seleniumMcg || 0),

    // Other
    cholesterolMg: String(nutrients.cholesterolMg || 0),
    caffeineMg: String(nutrients.caffeineMg || 0),
    waterG: String(nutrients.waterG || 0),

    isVerified: true,
  };
}

// Convert camelCase to snake_case for PostgreSQL
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Batch insert foods
async function batchInsert(foods: Record<string, any>[], tableName: string) {
  if (foods.length === 0) return;

  // Build the INSERT query manually for performance
  const jsColumns = Object.keys(foods[0]);
  const sqlColumns = jsColumns.map(toSnakeCase);

  const placeholders = foods.map((_, foodIndex) =>
    `(${sqlColumns.map((_, colIndex) => `$${foodIndex * sqlColumns.length + colIndex + 1}`).join(", ")})`
  ).join(", ");

  const values = foods.flatMap(food => jsColumns.map(col => food[col]));

  const query = `
    INSERT INTO ${tableName} (${sqlColumns.join(", ")})
    VALUES ${placeholders}
    ON CONFLICT (source_id) DO NOTHING
  `;

  await client.unsafe(query, values);
}

// Main import function
async function importUSDA(filePath: string) {
  console.log("🍎 USDA Food Database Import");
  console.log("============================\n");

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    console.log("\nTo download USDA data:");
    console.log("1. Go to: https://fdc.nal.usda.gov/download-datasets.html");
    console.log("2. Download 'Foundation Foods' or 'SR Legacy' (JSON format)");
    console.log("3. Extract to: scripts/usda-data/");
    console.log("4. Run: npx tsx scripts/import-usda.ts <path-to-json>");
    process.exit(1);
  }

  console.log(`📂 Reading: ${filePath}`);
  const fileSize = fs.statSync(filePath).size / (1024 * 1024);
  console.log(`   Size: ${fileSize.toFixed(1)} MB\n`);

  // Read and parse JSON
  console.log("⏳ Parsing JSON (this may take a moment for large files)...");
  const rawData = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(rawData);

  // USDA files have different structures
  const foods: USDAFood[] = data.FoundationFoods || data.SRLegacyFoods || data.BrandedFoods || data;

  if (!Array.isArray(foods)) {
    console.error("❌ Unexpected file format. Expected array of foods.");
    process.exit(1);
  }

  console.log(`✅ Found ${foods.length.toLocaleString()} foods\n`);

  // Process in batches
  const BATCH_SIZE = 500;
  let processed = 0;
  let errors = 0;
  let batch: Record<string, any>[] = [];

  console.log("📥 Importing to PostgreSQL...\n");

  for (let i = 0; i < foods.length; i++) {
    try {
      const converted = convertFood(foods[i]);
      batch.push(converted);

      if (batch.length >= BATCH_SIZE || i === foods.length - 1) {
        await batchInsert(batch, "foods");
        processed += batch.length;
        batch = [];

        // Progress update
        const percent = ((i + 1) / foods.length * 100).toFixed(1);
        process.stdout.write(`\r   Progress: ${percent}% (${processed.toLocaleString()} foods)`);
      }
    } catch (error) {
      errors++;
      if (errors <= 5) {
        console.error(`\n⚠️  Error processing food ${foods[i]?.fdcId}:`, error);
      }
    }
  }

  console.log("\n\n✅ Import complete!");
  console.log(`   Imported: ${processed.toLocaleString()} foods`);
  if (errors > 0) {
    console.log(`   Errors: ${errors}`);
  }

  // Create indexes for fast searching
  console.log("\n📇 Creating search indexes...");
  await client.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_foods_name ON foods USING gin(to_tsvector('english', name));
    CREATE INDEX IF NOT EXISTS idx_foods_name_lower ON foods (lower(name));
    CREATE INDEX IF NOT EXISTS idx_foods_source_id ON foods (source_id);
    CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods (barcode) WHERE barcode IS NOT NULL;
  `);
  console.log("✅ Indexes created");

  await client.end();
  console.log("\n🎉 Done!");
}

// CLI entry point
const args = process.argv.slice(2);
const filePath = args[0] || "scripts/usda-data/foundationDownload.json";

importUSDA(filePath).catch(console.error);
