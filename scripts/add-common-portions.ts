/**
 * Add Common Food Portions
 *
 * This script adds standard serving sizes for common foods.
 * Data based on USDA standard reference portions.
 */

import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/olympus";
const client = postgres(connectionString);

// Common portions for various food types
// Format: [name pattern, portion name, gram weight]
const COMMON_PORTIONS: [string, string, number][] = [
  // Fruits
  ["apples, raw%", "1 medium (3\" dia)", 182],
  ["apples, raw%", "1 small (2.5\" dia)", 149],
  ["apples, raw%", "1 large (3.25\" dia)", 223],
  ["apples, raw%", "1 cup sliced", 110],
  ["banana%raw%", "1 medium (7-8\")", 118],
  ["banana%raw%", "1 small (6-7\")", 101],
  ["banana%raw%", "1 large (8-9\")", 136],
  ["orange%raw%", "1 medium (2.5\" dia)", 131],
  ["orange%raw%", "1 large (3\" dia)", 184],
  ["strawberries%raw%", "1 cup whole", 144],
  ["strawberries%raw%", "1 medium", 12],
  ["blueberries%raw%", "1 cup", 148],
  ["grapes%raw%", "1 cup", 151],
  ["grapes%raw%", "10 grapes", 49],
  ["watermelon%raw%", "1 cup diced", 152],
  ["watermelon%raw%", "1 wedge (1/16 melon)", 286],
  ["mango%raw%", "1 cup sliced", 165],
  ["mango%raw%", "1 whole", 336],
  ["avocado%raw%", "1 whole", 201],
  ["avocado%raw%", "1/2 avocado", 100],

  // Vegetables
  ["broccoli%raw%", "1 cup chopped", 91],
  ["broccoli%cooked%", "1 cup chopped", 156],
  ["carrots%raw%", "1 medium (7\")", 61],
  ["carrots%raw%", "1 cup chopped", 128],
  ["spinach%raw%", "1 cup", 30],
  ["spinach%cooked%", "1 cup", 180],
  ["tomato%raw%", "1 medium", 123],
  ["tomato%raw%", "1 cup chopped", 180],
  ["potato%baked%", "1 medium (2.5\" dia)", 173],
  ["potato%baked%", "1 large (3\" dia)", 299],
  ["sweet potato%baked%", "1 medium (5\")", 114],
  ["onion%raw%", "1 medium (2.5\" dia)", 110],
  ["onion%raw%", "1 cup chopped", 160],
  ["lettuce%raw%", "1 cup shredded", 47],
  ["cucumber%raw%", "1 cup sliced", 104],
  ["bell pepper%raw%", "1 medium", 119],
  ["bell pepper%raw%", "1 cup chopped", 149],

  // Proteins
  ["chicken%breast%", "1 breast (6 oz)", 170],
  ["chicken%breast%", "3 oz", 85],
  ["chicken%thigh%", "1 thigh", 116],
  ["chicken%drumstick%", "1 drumstick", 96],
  ["beef%ground%", "3 oz cooked", 85],
  ["beef%ground%", "4 oz patty", 113],
  ["beef%steak%", "3 oz", 85],
  ["salmon%", "3 oz fillet", 85],
  ["salmon%", "6 oz fillet", 170],
  ["tuna%", "3 oz", 85],
  ["tuna%canned%", "1 can (5 oz drained)", 142],
  ["egg%whole%raw%", "1 large", 50],
  ["egg%whole%raw%", "1 medium", 44],
  ["egg%whole%raw%", "1 jumbo", 63],
  ["egg%scrambled%", "1 large egg equivalent", 61],
  ["bacon%", "1 slice", 8],
  ["bacon%", "3 slices", 24],

  // Dairy
  ["milk%whole%", "1 cup", 244],
  ["milk%2%%", "1 cup", 244],
  ["milk%skim%", "1 cup", 245],
  ["cheese%cheddar%", "1 slice (1 oz)", 28],
  ["cheese%cheddar%", "1 cup shredded", 113],
  ["cheese%mozzarella%", "1 oz", 28],
  ["yogurt%", "1 cup (8 oz)", 245],
  ["yogurt%greek%", "1 container (6 oz)", 170],
  ["butter%", "1 tbsp", 14],
  ["butter%", "1 pat", 5],

  // Grains
  ["rice%white%cooked%", "1 cup", 158],
  ["rice%brown%cooked%", "1 cup", 195],
  ["pasta%cooked%", "1 cup", 140],
  ["bread%white%", "1 slice", 25],
  ["bread%whole wheat%", "1 slice", 28],
  ["oatmeal%cooked%", "1 cup", 234],
  ["oats%dry%", "1/2 cup", 40],
  ["cereal%", "1 cup", 30],
  ["tortilla%flour%", "1 medium (6\")", 32],
  ["tortilla%corn%", "1 medium (6\")", 26],

  // Legumes & Nuts
  ["beans%black%cooked%", "1 cup", 172],
  ["beans%kidney%cooked%", "1 cup", 177],
  ["lentils%cooked%", "1 cup", 198],
  ["chickpeas%cooked%", "1 cup", 164],
  ["peanut butter%", "2 tbsp", 32],
  ["peanut butter%", "1 tbsp", 16],
  ["almonds%", "1 oz (23 nuts)", 28],
  ["almonds%", "1/4 cup", 36],
  ["walnuts%", "1 oz (14 halves)", 28],
  ["cashews%", "1 oz (18 nuts)", 28],

  // Common prepared foods
  ["pizza%", "1 slice (1/8 of 14\")", 107],
  ["hamburger%", "1 patty (4 oz)", 113],
  ["french fries%", "1 medium serving", 117],
  ["ice cream%", "1/2 cup", 66],
  ["ice cream%", "1 scoop", 72],
];

async function addCommonPortions() {
  console.log("🍽️  Adding Common Food Portions");
  console.log("================================\n");

  let added = 0;
  let skipped = 0;

  for (const [pattern, portionName, gramWeight] of COMMON_PORTIONS) {
    // Find matching foods
    const foods = await client`
      SELECT id, name FROM foods
      WHERE lower(name) LIKE ${pattern.toLowerCase()}
      LIMIT 10
    `;

    for (const food of foods) {
      // Check if portion already exists
      const existing = await client`
        SELECT id FROM food_portions
        WHERE food_id = ${food.id} AND portion_name = ${portionName}
      `;

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Add the portion
      await client`
        INSERT INTO food_portions (food_id, portion_name, gram_weight, is_default)
        VALUES (${food.id}, ${portionName}, ${gramWeight}, true)
      `;
      added++;

      console.log(`  ✓ ${food.name}: "${portionName}" (${gramWeight}g)`);
    }
  }

  console.log(`\n✅ Done! Added ${added} portions, skipped ${skipped} duplicates.`);

  // Show summary
  const summary = await client`
    SELECT COUNT(DISTINCT food_id) as foods_with_portions, COUNT(*) as total_portions
    FROM food_portions
  `;
  console.log(`📊 ${summary[0].foods_with_portions} foods now have portion data (${summary[0].total_portions} total portions)`);

  await client.end();
}

addCommonPortions().catch(console.error);
