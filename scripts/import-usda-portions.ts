/**
 * USDA Food Portions Import Script
 *
 * Imports official USDA portion/serving size data from the SR Legacy JSON file.
 * This replaces hardcoded portion data with verified USDA values.
 *
 * Run: npx tsx scripts/import-usda-portions.ts
 */

import postgres from "postgres";
import * as fs from "fs";

const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/olympus";
const client = postgres(connectionString);

interface USDAPortionData {
  modifier?: string;
  gramWeight?: number;
  amount?: number;
  measureUnit?: {
    name?: string;
  };
  portionDescription?: string;
}

interface USDAFood {
  fdcId: number;
  description: string;
  foodPortions?: USDAPortionData[];
}

// Build a readable portion name from USDA data
function buildPortionName(portion: USDAPortionData): string {
  const amount = portion.amount || 1;
  const modifier = portion.modifier || portion.portionDescription || "";
  const unit = portion.measureUnit?.name;

  // Clean up the modifier
  let name = modifier.trim();

  // If we have a unit that's not "undetermined", use it
  if (unit && unit !== "undetermined") {
    if (name) {
      name = `${amount} ${unit}, ${name}`;
    } else {
      name = `${amount} ${unit}`;
    }
  } else if (name) {
    // Just use the modifier with amount
    name = amount === 1 ? `1 ${name}` : `${amount} ${name}`;
  } else {
    return ""; // Skip if we can't build a meaningful name
  }

  return name;
}

async function importPortions(filePath: string) {
  console.log("🍽️  USDA Portion Data Import");
  console.log("============================\n");

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Reading: ${filePath}`);
  const fileSize = fs.statSync(filePath).size / (1024 * 1024);
  console.log(`   Size: ${fileSize.toFixed(1)} MB\n`);

  // Parse JSON
  console.log("⏳ Parsing JSON...");
  const rawData = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(rawData);

  const foods: USDAFood[] = data.SRLegacyFoods || data.FoundationFoods || data.BrandedFoods || data;

  if (!Array.isArray(foods)) {
    console.error("❌ Unexpected file format");
    process.exit(1);
  }

  console.log(`✅ Found ${foods.length.toLocaleString()} foods\n`);

  // Clear existing USDA portions (keep user-added ones if any)
  console.log("🗑️  Clearing old USDA portions...");
  await client`
    DELETE FROM food_portions
    WHERE food_id IN (SELECT id FROM foods WHERE source = 'usda')
  `;

  // Process each food
  console.log("📥 Importing portions...\n");

  let totalPortions = 0;
  let foodsWithPortions = 0;
  let skippedNoMatch = 0;

  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    const portions = food.foodPortions || [];

    if (portions.length === 0) continue;

    // Find the food in our database by source_id
    const dbFood = await client`
      SELECT id FROM foods WHERE source_id = ${String(food.fdcId)} LIMIT 1
    `;

    if (dbFood.length === 0) {
      skippedNoMatch++;
      continue;
    }

    const foodId = dbFood[0].id;
    let addedForThisFood = 0;

    for (const portion of portions) {
      const portionName = buildPortionName(portion);
      const gramWeight = portion.gramWeight;

      // Skip invalid portions
      if (!portionName || !gramWeight || gramWeight <= 0) continue;

      // Insert portion
      try {
        await client`
          INSERT INTO food_portions (food_id, portion_name, gram_weight, is_default)
          VALUES (${foodId}, ${portionName}, ${gramWeight}, ${addedForThisFood === 0})
          ON CONFLICT DO NOTHING
        `;
        totalPortions++;
        addedForThisFood++;
      } catch (error) {
        // Skip duplicates or errors
      }
    }

    if (addedForThisFood > 0) {
      foodsWithPortions++;
    }

    // Progress update every 500 foods
    if ((i + 1) % 500 === 0 || i === foods.length - 1) {
      const percent = ((i + 1) / foods.length * 100).toFixed(1);
      process.stdout.write(`\r   Progress: ${percent}% (${totalPortions.toLocaleString()} portions)`);
    }
  }

  console.log("\n\n✅ Import complete!");
  console.log(`   Foods with portions: ${foodsWithPortions.toLocaleString()}`);
  console.log(`   Total portions: ${totalPortions.toLocaleString()}`);
  if (skippedNoMatch > 0) {
    console.log(`   Skipped (not in DB): ${skippedNoMatch}`);
  }

  // Show some examples
  console.log("\n📋 Sample portions:");
  const samples = await client`
    SELECT f.name, fp.portion_name, fp.gram_weight
    FROM food_portions fp
    JOIN foods f ON f.id = fp.food_id
    WHERE f.source = 'usda'
    ORDER BY RANDOM()
    LIMIT 10
  `;

  for (const sample of samples) {
    console.log(`   ${sample.name.substring(0, 40)}: "${sample.portion_name}" (${sample.gram_weight}g)`);
  }

  await client.end();
  console.log("\n🎉 Done!");
}

// CLI entry point
const args = process.argv.slice(2);
const filePath = args[0] || "scripts/usda-data/FoodData_Central_sr_legacy_food_json_2018-04.json";

importPortions(filePath).catch(console.error);
