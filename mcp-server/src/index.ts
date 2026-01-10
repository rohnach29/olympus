#!/usr/bin/env node
/**
 * Olympus MCP Server
 *
 * This server gives Claude Desktop/Claude Code access to your health data.
 * When you ask Claude about your sleep, steps, HRV, etc., it calls these tools
 * to get real data from your database.
 *
 * HOW IT WORKS:
 * 1. Claude Desktop connects to this server via MCP protocol
 * 2. You ask: "How did I sleep this week?"
 * 3. Claude sees the "get_sleep_summary" tool and calls it
 * 4. This server queries your CockroachDB database
 * 5. Returns the data to Claude
 * 6. Claude gives you an intelligent analysis
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import postgres from "postgres";
import { config } from "dotenv";

// Load environment variables (quiet mode to avoid stdout pollution)
config({ quiet: true });

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

// Your user ID (we'll query only your data)
// You can find this by running: SELECT id FROM users WHERE email = 'your@email.com';
const USER_ID_RAW = process.env.OLYMPUS_USER_ID;
if (!USER_ID_RAW) {
  console.error("ERROR: OLYMPUS_USER_ID environment variable is required");
  console.error("Find your user ID by running: SELECT id FROM users WHERE email = 'your@email.com';");
  process.exit(1);
}
const USER_ID: string = USER_ID_RAW;

// Get user's timezone from settings
async function getUserTimezone(): Promise<string> {
  const result = await sql`
    SELECT settings->>'timezone' as timezone
    FROM users
    WHERE id = ${USER_ID}
  `;
  return result[0]?.timezone || "UTC";
}

// Get start of "today" in user's timezone
function getTodayStart(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(now).split("-").map(Number);

  const userMidnight = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const utcMidnight = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const userOffsetMs = userMidnight.getTime() - utcMidnight.getTime();

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - userOffsetMs);
}

// ============================================================================
// TOOL IMPLEMENTATIONS
// These are the functions that actually query your database
// ============================================================================

async function getSleepSummary(days: number = 7) {
  const sleepData = await sql`
    SELECT
      sleep_date,
      total_minutes,
      in_bed_minutes,
      deep_sleep_minutes,
      rem_sleep_minutes,
      light_sleep_minutes,
      awake_minutes,
      sleep_score,
      efficiency,
      bedtime,
      wake_time
    FROM sleep_sessions
    WHERE user_id = ${USER_ID}
    ORDER BY sleep_date DESC
    LIMIT ${days}
  `;

  if (sleepData.length === 0) {
    return { message: "No sleep data found", data: [] };
  }

  // Calculate averages
  const avgMinutes = sleepData.reduce((sum, s) => sum + s.total_minutes, 0) / sleepData.length;
  const avgScore = sleepData.filter(s => s.sleep_score).reduce((sum, s) => sum + s.sleep_score, 0) / sleepData.filter(s => s.sleep_score).length;
  const avgDeep = sleepData.reduce((sum, s) => sum + (s.deep_sleep_minutes || 0), 0) / sleepData.length;
  const avgRem = sleepData.reduce((sum, s) => sum + (s.rem_sleep_minutes || 0), 0) / sleepData.length;

  return {
    summary: {
      averageSleepHours: (avgMinutes / 60).toFixed(1),
      averageScore: avgScore ? Math.round(avgScore) : null,
      averageDeepMinutes: Math.round(avgDeep),
      averageRemMinutes: Math.round(avgRem),
      nightsTracked: sleepData.length,
    },
    nights: sleepData.map(s => ({
      date: s.sleep_date,
      hoursSlept: (s.total_minutes / 60).toFixed(1),
      score: s.sleep_score,
      deepMinutes: s.deep_sleep_minutes,
      remMinutes: s.rem_sleep_minutes,
      efficiency: s.efficiency ? `${parseFloat(s.efficiency).toFixed(0)}%` : null,
      bedtime: s.bedtime,
      wakeTime: s.wake_time,
    })),
  };
}

async function getTodaysMetrics() {
  const timezone = await getUserTimezone();
  const todayStart = getTodayStart(timezone);

  // Get cumulative metrics (sum for today)
  const cumulativeMetrics = await sql`
    SELECT
      metric_type,
      SUM(CAST(value AS DECIMAL)) as total
    FROM health_metrics
    WHERE user_id = ${USER_ID}
      AND recorded_at >= ${todayStart}
      AND metric_type IN ('steps', 'calories_active', 'distance', 'exercise_minutes', 'flights_climbed')
    GROUP BY metric_type
  `;

  // Get point-in-time metrics (most recent)
  const latestMetrics = await sql`
    SELECT DISTINCT ON (metric_type)
      metric_type,
      value,
      recorded_at
    FROM health_metrics
    WHERE user_id = ${USER_ID}
      AND metric_type IN ('hrv', 'resting_heart_rate', 'respiratory_rate', 'blood_oxygen')
    ORDER BY metric_type, recorded_at DESC
  `;

  // Get today's sleep
  const todayDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  const todaySleep = await sql`
    SELECT total_minutes, sleep_score, deep_sleep_minutes, rem_sleep_minutes
    FROM sleep_sessions
    WHERE user_id = ${USER_ID}
      AND sleep_date = ${todayDateStr}
    LIMIT 1
  `;

  const cumMap: Record<string, number> = {};
  for (const m of cumulativeMetrics) {
    const row = m as { metric_type: string; total: string };
    cumMap[row.metric_type] = Math.round(parseFloat(row.total));
  }

  const latestMap: Record<string, { value: number; recordedAt: Date }> = {};
  for (const m of latestMetrics) {
    const row = m as { metric_type: string; value: string; recorded_at: Date };
    latestMap[row.metric_type] = {
      value: Math.round(parseFloat(row.value)),
      recordedAt: row.recorded_at,
    };
  }

  return {
    date: todayDateStr,
    timezone,
    steps: cumMap.steps || 0,
    activeCalories: cumMap.calories_active || 0,
    exerciseMinutes: cumMap.exercise_minutes || 0,
    distance: cumMap.distance ? `${(cumMap.distance / 1000).toFixed(2)} km` : "0 km",
    flightsClimbed: cumMap.flights_climbed || 0,
    hrv: latestMap.hrv ? `${latestMap.hrv.value} ms` : "No data",
    restingHeartRate: latestMap.resting_heart_rate ? `${latestMap.resting_heart_rate.value} bpm` : "No data",
    sleep: todaySleep.length > 0 ? {
      hours: (todaySleep[0].total_minutes / 60).toFixed(1),
      score: todaySleep[0].sleep_score,
      deepMinutes: todaySleep[0].deep_sleep_minutes,
      remMinutes: todaySleep[0].rem_sleep_minutes,
    } : "No sleep data for last night",
  };
}

async function getHrvTrend(days: number = 14) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const hrvData = await sql`
    SELECT
      DATE(recorded_at) as date,
      AVG(CAST(value AS DECIMAL)) as avg_hrv,
      MIN(CAST(value AS DECIMAL)) as min_hrv,
      MAX(CAST(value AS DECIMAL)) as max_hrv,
      COUNT(*) as readings
    FROM health_metrics
    WHERE user_id = ${USER_ID}
      AND metric_type = 'hrv'
      AND recorded_at >= ${startDate}
    GROUP BY DATE(recorded_at)
    ORDER BY date DESC
  `;

  if (hrvData.length === 0) {
    return { message: "No HRV data found", data: [] };
  }

  const avgOverall = hrvData.reduce((sum, d) => sum + parseFloat(d.avg_hrv), 0) / hrvData.length;

  // Simple trend calculation
  const recentAvg = hrvData.slice(0, Math.min(3, hrvData.length)).reduce((sum, d) => sum + parseFloat(d.avg_hrv), 0) / Math.min(3, hrvData.length);
  const olderAvg = hrvData.slice(-Math.min(3, hrvData.length)).reduce((sum, d) => sum + parseFloat(d.avg_hrv), 0) / Math.min(3, hrvData.length);
  const trend = recentAvg > olderAvg ? "improving" : recentAvg < olderAvg ? "declining" : "stable";

  return {
    summary: {
      averageHrv: Math.round(avgOverall),
      trend,
      trendPercentage: `${(((recentAvg - olderAvg) / olderAvg) * 100).toFixed(1)}%`,
      daysTracked: hrvData.length,
    },
    dailyAverages: hrvData.map(d => ({
      date: d.date,
      avgHrv: Math.round(parseFloat(d.avg_hrv)),
      minHrv: Math.round(parseFloat(d.min_hrv)),
      maxHrv: Math.round(parseFloat(d.max_hrv)),
      readings: d.readings,
    })),
  };
}

async function getRecentWorkouts(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const workouts = await sql`
    SELECT
      name,
      type,
      duration_minutes,
      calories_burned,
      heart_rate_avg,
      heart_rate_max,
      started_at,
      ended_at
    FROM workouts
    WHERE user_id = ${USER_ID}
      AND started_at >= ${startDate}
    ORDER BY started_at DESC
  `;

  if (workouts.length === 0) {
    return { message: "No workouts found in this period", data: [] };
  }

  const totalMinutes = workouts.reduce((sum, w) => sum + w.duration_minutes, 0);
  const totalCalories = workouts.reduce((sum, w) => sum + (w.calories_burned || 0), 0);

  return {
    summary: {
      totalWorkouts: workouts.length,
      totalMinutes,
      totalCalories,
      avgDuration: Math.round(totalMinutes / workouts.length),
    },
    workouts: workouts.map(w => ({
      name: w.name,
      type: w.type,
      duration: `${w.duration_minutes} min`,
      calories: w.calories_burned,
      avgHr: w.heart_rate_avg,
      maxHr: w.heart_rate_max,
      date: w.started_at,
    })),
  };
}

async function getHealthSummary() {
  const timezone = await getUserTimezone();
  const [todayMetrics, sleepSummary, hrvTrend, workouts] = await Promise.all([
    getTodaysMetrics(),
    getSleepSummary(7),
    getHrvTrend(7),
    getRecentWorkouts(7),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    timezone,
    today: todayMetrics,
    weeklyAverages: {
      sleep: sleepSummary.summary,
      hrv: hrvTrend.summary,
      workouts: workouts.summary,
    },
  };
}

async function getUserProfile() {
  const result = await sql`
    SELECT
      full_name,
      date_of_birth,
      gender,
      height_cm,
      weight_kg,
      settings
    FROM users
    WHERE id = ${USER_ID}
  `;

  if (result.length === 0) {
    return { error: "User not found" };
  }

  const user = result[0] as {
    full_name: string | null;
    date_of_birth: string | null;
    gender: string | null;
    height_cm: string | null;
    weight_kg: string | null;
    settings: Record<string, unknown>;
  };

  // Calculate age if date of birth is available
  let age: number | null = null;
  if (user.date_of_birth) {
    const dob = new Date(user.date_of_birth);
    const today = new Date();
    age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
  }

  // Calculate BMI if height and weight are available
  let bmi: number | null = null;
  let bmiCategory: string | null = null;
  if (user.height_cm && user.weight_kg) {
    const heightM = parseFloat(user.height_cm) / 100;
    const weightKg = parseFloat(user.weight_kg);
    bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

    if (bmi < 18.5) bmiCategory = "Underweight";
    else if (bmi < 25) bmiCategory = "Normal";
    else if (bmi < 30) bmiCategory = "Overweight";
    else bmiCategory = "Obese";
  }

  return {
    name: user.full_name,
    age,
    gender: user.gender,
    height: user.height_cm ? `${user.height_cm} cm` : null,
    weight: user.weight_kg ? `${user.weight_kg} kg` : null,
    bmi,
    bmiCategory,
    goals: {
      sleepTarget: `${user.settings?.sleepTargetHours || 8} hours`,
      calorieTarget: user.settings?.calorieTarget || 2000,
      proteinTarget: `${user.settings?.proteinTargetG || 150}g`,
    },
    timezone: user.settings?.timezone || "UTC",
  };
}

// ============================================================================
// NUTRITION TOOLS
// ============================================================================

async function getTodaysFoodLog() {
  const timezone = await getUserTimezone();
  const todayDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());

  const logs = await sql`
    SELECT
      id,
      food_name,
      brand,
      meal_type,
      serving_quantity,
      serving_unit,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      sugar_g,
      sodium_mg,
      created_at
    FROM food_logs
    WHERE user_id = ${USER_ID}
      AND logged_date = ${todayDateStr}
    ORDER BY created_at ASC
  `;

  // Group by meal type
  const meals: Record<string, Array<{
    id: string;
    name: string;
    brand: string | null;
    serving: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const log of logs) {
    const row = log as {
      id: string;
      food_name: string;
      brand: string | null;
      meal_type: string;
      serving_quantity: string;
      serving_unit: string;
      calories: string;
      protein_g: string;
      carbs_g: string;
      fat_g: string;
    };

    const mealType = row.meal_type || "snack";
    const calories = parseFloat(row.calories) || 0;
    const protein = parseFloat(row.protein_g) || 0;
    const carbs = parseFloat(row.carbs_g) || 0;
    const fat = parseFloat(row.fat_g) || 0;

    if (meals[mealType]) {
      meals[mealType].push({
        id: row.id,
        name: row.food_name,
        brand: row.brand,
        serving: `${row.serving_quantity} ${row.serving_unit}`,
        calories: Math.round(calories),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
      });
    }

    totalCalories += calories;
    totalProtein += protein;
    totalCarbs += carbs;
    totalFat += fat;
  }

  return {
    date: todayDateStr,
    timezone,
    totals: {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat),
    },
    meals,
  };
}

interface LogFoodParams {
  foodName: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  servingDescription: string;
  // Macros
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  saturatedFatG?: number;
  // Micros
  sodiumMg?: number;
  cholesterolMg?: number;
  vitaminAMcg?: number;
  vitaminCMg?: number;
  vitaminDMcg?: number;
  calciumMg?: number;
  ironMg?: number;
  potassiumMg?: number;
}

async function logFood(params: LogFoodParams) {
  const timezone = await getUserTimezone();
  const todayDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());

  // Parse serving description (e.g., "1 medium apple" -> quantity: 1, unit: "medium apple")
  const servingMatch = params.servingDescription.match(/^([\d.]+)\s*(.+)$/);
  const servingQuantity = servingMatch ? servingMatch[1] : "1";
  const servingUnit = servingMatch ? servingMatch[2] : params.servingDescription;

  // Insert the food log
  const result = await sql`
    INSERT INTO food_logs (
      user_id,
      food_name,
      meal_type,
      serving_quantity,
      serving_unit,
      serving_size,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      sugar_g,
      saturated_fat_g,
      sodium_mg,
      cholesterol_mg,
      vitamin_a_mcg,
      vitamin_c_mg,
      vitamin_d_mcg,
      calcium_mg,
      iron_mg,
      potassium_mg,
      logged_date
    ) VALUES (
      ${USER_ID},
      ${params.foodName},
      ${params.mealType},
      ${servingQuantity},
      ${servingUnit},
      100,
      ${params.calories},
      ${params.proteinG},
      ${params.carbsG},
      ${params.fatG},
      ${params.fiberG || 0},
      ${params.sugarG || 0},
      ${params.saturatedFatG || 0},
      ${params.sodiumMg || 0},
      ${params.cholesterolMg || 0},
      ${params.vitaminAMcg || 0},
      ${params.vitaminCMg || 0},
      ${params.vitaminDMcg || 0},
      ${params.calciumMg || 0},
      ${params.ironMg || 0},
      ${params.potassiumMg || 0},
      ${todayDateStr}
    )
    RETURNING id
  `;

  return {
    success: true,
    message: `Logged ${params.foodName} to ${params.mealType}`,
    logId: (result[0] as { id: string }).id,
    logged: {
      food: params.foodName,
      meal: params.mealType,
      serving: params.servingDescription,
      calories: params.calories,
      protein: params.proteinG,
      carbs: params.carbsG,
      fat: params.fatG,
    },
  };
}

async function deleteFoodLog(logId: string) {
  const result = await sql`
    DELETE FROM food_logs
    WHERE id = ${logId}
      AND user_id = ${USER_ID}
    RETURNING id, food_name
  `;

  if (result.length === 0) {
    return {
      success: false,
      message: "Food log not found or already deleted",
    };
  }

  const deleted = result[0] as { id: string; food_name: string };
  return {
    success: true,
    message: `Deleted "${deleted.food_name}" from your food log`,
    deletedId: deleted.id,
  };
}

async function searchFoods(query: string, limit: number = 10) {
  const searchPattern = '%' + query.toLowerCase() + '%';

  const foods = await sql`
    SELECT
      id,
      name,
      brand,
      category,
      serving_size,
      serving_unit,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      sugar_g,
      saturated_fat_g,
      sodium_mg,
      cholesterol_mg,
      vitamin_a_mcg,
      vitamin_c_mg,
      vitamin_d_mcg,
      calcium_mg,
      iron_mg,
      potassium_mg
    FROM foods
    WHERE LOWER(name) LIKE ${searchPattern}
    ORDER BY
      CASE WHEN LOWER(name) = ${query.toLowerCase()} THEN 0
           WHEN LOWER(name) LIKE ${query.toLowerCase() + '%'} THEN 1
           ELSE 2 END,
      LENGTH(name)
    LIMIT ${limit}
  `;

  if (foods.length === 0) {
    return {
      message: "No foods found matching your search. You can still log with estimated values.",
      foods: []
    };
  }

  return {
    query,
    count: foods.length,
    foods: foods.map(f => {
      const food = f as {
        id: string;
        name: string;
        brand: string | null;
        category: string | null;
        serving_size: string;
        serving_unit: string;
        calories: string;
        protein_g: string;
        carbs_g: string;
        fat_g: string;
        fiber_g: string | null;
        sugar_g: string | null;
        saturated_fat_g: string | null;
        sodium_mg: string | null;
        cholesterol_mg: string | null;
        vitamin_a_mcg: string | null;
        vitamin_c_mg: string | null;
        vitamin_d_mcg: string | null;
        calcium_mg: string | null;
        iron_mg: string | null;
        potassium_mg: string | null;
      };
      const parseNum = (val: string | null) => val ? Math.round(parseFloat(val) * 10) / 10 : null;
      return {
        id: food.id,
        name: food.name,
        brand: food.brand,
        category: food.category,
        servingSize: `${food.serving_size}${food.serving_unit}`,
        per100g: {
          calories: Math.round(parseFloat(food.calories)),
          proteinG: parseNum(food.protein_g),
          carbsG: parseNum(food.carbs_g),
          fatG: parseNum(food.fat_g),
          fiberG: parseNum(food.fiber_g),
          sugarG: parseNum(food.sugar_g),
          saturatedFatG: parseNum(food.saturated_fat_g),
          sodiumMg: parseNum(food.sodium_mg),
          cholesterolMg: parseNum(food.cholesterol_mg),
          vitaminAMcg: parseNum(food.vitamin_a_mcg),
          vitaminCMg: parseNum(food.vitamin_c_mg),
          vitaminDMcg: parseNum(food.vitamin_d_mcg),
          calciumMg: parseNum(food.calcium_mg),
          ironMg: parseNum(food.iron_mg),
          potassiumMg: parseNum(food.potassium_mg),
        },
      };
    }),
  };
}

async function getFoodPortions(foodId: string) {
  const portions = await sql`
    SELECT portion_name, gram_weight, is_default
    FROM food_portions
    WHERE food_id = ${foodId}
    ORDER BY is_default DESC, gram_weight ASC
  `;

  if (portions.length === 0) {
    return {
      foodId,
      message: "No portion data available. Use gram weight.",
      portions: [{ name: "100g", grams: 100 }]
    };
  }

  return {
    foodId,
    portions: portions.map(p => {
      const portion = p as { portion_name: string; gram_weight: string; is_default: boolean };
      return {
        name: portion.portion_name,
        grams: Math.round(parseFloat(portion.gram_weight)),
        isDefault: portion.is_default,
      };
    }),
  };
}

// ============================================================================
// BLOOD WORK TOOLS
// ============================================================================

interface BloodWorkMarker {
  name: string;
  value: number;
  unit: string;
  category?: string;
  referenceMin?: number;
  referenceMax?: number;
}

async function getBloodWorkResults(limit: number = 5) {
  const results = await sql`
    SELECT
      id,
      test_date,
      lab_name,
      markers,
      created_at
    FROM blood_work
    WHERE user_id = ${USER_ID}
    ORDER BY test_date DESC
    LIMIT ${limit}
  `;

  if (results.length === 0) {
    return {
      message: "No blood work results found. Upload results via the Olympus web app.",
      results: [],
    };
  }

  return {
    count: results.length,
    results: results.map(r => {
      const row = r as {
        id: string;
        test_date: string;
        lab_name: string | null;
        markers: BloodWorkMarker[];
        created_at: Date;
      };
      const markers = row.markers || [];

      // Group markers by category
      const byCategory: Record<string, BloodWorkMarker[]> = {};
      for (const m of markers) {
        const cat = m.category || "other";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(m);
      }

      return {
        id: row.id,
        testDate: row.test_date,
        labName: row.lab_name,
        markerCount: markers.length,
        markers: byCategory,
      };
    }),
  };
}

async function getBloodWorkById(resultId: string) {
  const results = await sql`
    SELECT
      id,
      test_date,
      lab_name,
      markers,
      created_at
    FROM blood_work
    WHERE id = ${resultId}
      AND user_id = ${USER_ID}
    LIMIT 1
  `;

  if (results.length === 0) {
    return { error: "Blood work result not found" };
  }

  const row = results[0] as {
    id: string;
    test_date: string;
    lab_name: string | null;
    markers: BloodWorkMarker[];
    created_at: Date;
  };

  return {
    id: row.id,
    testDate: row.test_date,
    labName: row.lab_name,
    markers: row.markers || [],
  };
}

async function addBloodWorkMarker(
  resultId: string,
  marker: { name: string; value: number; unit: string; category?: string; referenceMin?: number; referenceMax?: number }
) {
  // Get existing result
  const results = await sql`
    SELECT markers FROM blood_work
    WHERE id = ${resultId} AND user_id = ${USER_ID}
  `;

  if (results.length === 0) {
    return { success: false, error: "Blood work result not found" };
  }

  const existingMarkers = (results[0] as { markers: BloodWorkMarker[] }).markers || [];

  // Check if marker already exists
  const existingIdx = existingMarkers.findIndex(m => m.name.toLowerCase() === marker.name.toLowerCase());
  if (existingIdx >= 0) {
    return {
      success: false,
      error: `Marker "${marker.name}" already exists. Use edit_blood_work_marker to update it.`,
    };
  }

  // Add new marker
  const newMarkers = [...existingMarkers, {
    name: marker.name,
    value: marker.value,
    unit: marker.unit,
    category: marker.category || "other",
    ...(marker.referenceMin !== undefined && { referenceMin: marker.referenceMin }),
    ...(marker.referenceMax !== undefined && { referenceMax: marker.referenceMax }),
  }];

  await sql`
    UPDATE blood_work
    SET markers = ${JSON.stringify(newMarkers)}::jsonb
    WHERE id = ${resultId}
  `;

  return {
    success: true,
    message: `Added marker "${marker.name}" with value ${marker.value} ${marker.unit}`,
    markerCount: newMarkers.length,
  };
}

async function editBloodWorkMarker(
  resultId: string,
  markerName: string,
  updates: { value?: number; unit?: string; name?: string; referenceMin?: number; referenceMax?: number }
) {
  // Get existing result
  const results = await sql`
    SELECT markers FROM blood_work
    WHERE id = ${resultId} AND user_id = ${USER_ID}
  `;

  if (results.length === 0) {
    return { success: false, error: "Blood work result not found" };
  }

  const existingMarkers = (results[0] as { markers: BloodWorkMarker[] }).markers || [];

  // Find the marker to edit
  const markerIdx = existingMarkers.findIndex(m => m.name.toLowerCase() === markerName.toLowerCase());
  if (markerIdx < 0) {
    return {
      success: false,
      error: `Marker "${markerName}" not found. Available markers: ${existingMarkers.map(m => m.name).join(", ")}`,
    };
  }

  // Update the marker
  const oldMarker = existingMarkers[markerIdx];
  const updatedMarker = {
    ...oldMarker,
    ...(updates.name !== undefined && { name: updates.name }),
    ...(updates.value !== undefined && { value: updates.value }),
    ...(updates.unit !== undefined && { unit: updates.unit }),
    ...(updates.referenceMin !== undefined && { referenceMin: updates.referenceMin }),
    ...(updates.referenceMax !== undefined && { referenceMax: updates.referenceMax }),
  };

  const newMarkers = [...existingMarkers];
  newMarkers[markerIdx] = updatedMarker;

  await sql`
    UPDATE blood_work
    SET markers = ${JSON.stringify(newMarkers)}::jsonb
    WHERE id = ${resultId}
  `;

  return {
    success: true,
    message: `Updated marker "${markerName}"`,
    before: oldMarker,
    after: updatedMarker,
  };
}

async function deleteBloodWorkMarker(resultId: string, markerName: string) {
  // Get existing result
  const results = await sql`
    SELECT markers FROM blood_work
    WHERE id = ${resultId} AND user_id = ${USER_ID}
  `;

  if (results.length === 0) {
    return { success: false, error: "Blood work result not found" };
  }

  const existingMarkers = (results[0] as { markers: BloodWorkMarker[] }).markers || [];

  // Find and remove the marker
  const markerIdx = existingMarkers.findIndex(m => m.name.toLowerCase() === markerName.toLowerCase());
  if (markerIdx < 0) {
    return {
      success: false,
      error: `Marker "${markerName}" not found. Available markers: ${existingMarkers.map(m => m.name).join(", ")}`,
    };
  }

  const deletedMarker = existingMarkers[markerIdx];
  const newMarkers = existingMarkers.filter((_, idx) => idx !== markerIdx);

  await sql`
    UPDATE blood_work
    SET markers = ${JSON.stringify(newMarkers)}::jsonb
    WHERE id = ${resultId}
  `;

  return {
    success: true,
    message: `Deleted marker "${markerName}"`,
    deleted: deletedMarker,
    remainingCount: newMarkers.length,
  };
}

// ============================================================================
// LONGEVITY TOOLS
// ============================================================================

// PhenoAge coefficients from Levine 2018
const PHENO_AGE_COEFFICIENTS = {
  intercept: -19.9067,
  albumin: -0.0336,
  creatinine: 0.0095,
  glucose: 0.1953,
  lnCrp: 0.0954,
  lymphocytePercent: -0.0120,
  mcv: 0.0268,
  rdw: 0.3306,
  alkalinePhosphatase: 0.0019,
  wbc: 0.0554,
  age: 0.0804,
};

interface PhenoAgeInput {
  chronologicalAge: number;
  albumin?: number;
  creatinine?: number;
  glucose?: number;
  crp?: number;
  lymphocytePercent?: number;
  mcv?: number;
  rdw?: number;
  alkalinePhosphatase?: number;
  wbc?: number;
}

function calculatePhenoAgeDirect(input: PhenoAgeInput): { biologicalAge: number | null; missingMarkers: string[] } {
  const missingMarkers: string[] = [];

  if (input.albumin === undefined) missingMarkers.push("Albumin");
  if (input.creatinine === undefined) missingMarkers.push("Creatinine");
  if (input.glucose === undefined) missingMarkers.push("Fasting Glucose");
  if (input.crp === undefined) missingMarkers.push("hs-CRP");
  if (input.lymphocytePercent === undefined) missingMarkers.push("Lymphocyte %");
  if (input.mcv === undefined) missingMarkers.push("MCV");
  if (input.rdw === undefined) missingMarkers.push("RDW");
  if (input.alkalinePhosphatase === undefined) missingMarkers.push("Alkaline Phosphatase");
  if (input.wbc === undefined) missingMarkers.push("WBC");

  if (missingMarkers.length > 0) {
    return { biologicalAge: null, missingMarkers };
  }

  // Unit conversions
  const albumin_gL = input.albumin! * 10;
  const creatinine_umolL = input.creatinine! * 88.4;
  const glucose_mmolL = input.glucose! * 0.0555;
  const lnCrp = Math.log(Math.max(input.crp!, 0.1));

  // Calculate linear predictor
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

  const gamma = 0.0076927;
  const mortalityScore = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * gamma) - 1) / gamma);
  const biologicalAge = 141.50225 + Math.log(-0.00553 * Math.log(1 - mortalityScore)) / 0.090165;

  return {
    biologicalAge: Math.round(Math.max(20, Math.min(120, biologicalAge)) * 10) / 10,
    missingMarkers: [],
  };
}

async function getLongevityMetrics() {
  // Get user's date of birth for chronological age
  const userResult = await sql`
    SELECT date_of_birth FROM users WHERE id = ${USER_ID}
  `;

  if (userResult.length === 0 || !userResult[0].date_of_birth) {
    return {
      error: "Please set your date of birth in settings to calculate biological age.",
    };
  }

  const dob = new Date(userResult[0].date_of_birth as string);
  const today = new Date();
  let chronologicalAge = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    chronologicalAge--;
  }

  // Get latest blood work
  const bloodWorkResult = await sql`
    SELECT markers, test_date, lab_name
    FROM blood_work
    WHERE user_id = ${USER_ID}
    ORDER BY test_date DESC
    LIMIT 1
  `;

  if (bloodWorkResult.length === 0) {
    return {
      chronologicalAge,
      biologicalAge: null,
      message: "No blood work data. Upload blood work results to calculate biological age.",
      requiredMarkers: ["Albumin", "Creatinine", "Fasting Glucose", "hs-CRP", "Lymphocyte %", "MCV", "RDW", "Alkaline Phosphatase", "WBC"],
    };
  }

  const markers = (bloodWorkResult[0] as { markers: BloodWorkMarker[] }).markers || [];
  const testDate = (bloodWorkResult[0] as { test_date: string }).test_date;
  const labName = (bloodWorkResult[0] as { lab_name: string | null }).lab_name;

  // Map markers to PhenoAge input
  const markerMappings: Record<string, keyof PhenoAgeInput> = {
    albumin: "albumin",
    creatinine: "creatinine",
    glucose: "glucose",
    "fasting glucose": "glucose",
    crp: "crp",
    "hs-crp": "crp",
    lymphocyte: "lymphocytePercent",
    "lymphocyte %": "lymphocytePercent",
    mcv: "mcv",
    rdw: "rdw",
    "alkaline phosphatase": "alkalinePhosphatase",
    alp: "alkalinePhosphatase",
    wbc: "wbc",
  };

  const phenoInput: PhenoAgeInput = { chronologicalAge };

  for (const marker of markers) {
    const normalizedName = marker.name.toLowerCase().trim();
    for (const [pattern, field] of Object.entries(markerMappings)) {
      if (normalizedName.includes(pattern) || normalizedName === pattern) {
        (phenoInput as unknown as Record<string, number | undefined>)[field] = marker.value;
        break;
      }
    }
  }

  const { biologicalAge, missingMarkers } = calculatePhenoAgeDirect(phenoInput);

  // Calculate pillar scores
  const pillars: Array<{ name: string; score: number; status: string; details: string[] }> = [];

  // Metabolic Health
  const metabolicDetails: string[] = [];
  let metabolicScore = 0;
  let metabolicCount = 0;
  if (phenoInput.glucose !== undefined) {
    metabolicCount++;
    if (phenoInput.glucose < 100) {
      metabolicScore += 100;
      metabolicDetails.push(`Glucose: ${phenoInput.glucose} mg/dL (Optimal)`);
    } else if (phenoInput.glucose < 126) {
      metabolicScore += 60;
      metabolicDetails.push(`Glucose: ${phenoInput.glucose} mg/dL (Pre-diabetic)`);
    } else {
      metabolicScore += 20;
      metabolicDetails.push(`Glucose: ${phenoInput.glucose} mg/dL (Elevated)`);
    }
  }
  if (metabolicCount > 0) {
    pillars.push({
      name: "Metabolic Health",
      score: Math.round(metabolicScore / metabolicCount),
      status: metabolicScore / metabolicCount >= 80 ? "optimal" : metabolicScore / metabolicCount >= 60 ? "good" : "needs attention",
      details: metabolicDetails,
    });
  }

  // Inflammation
  const inflammationDetails: string[] = [];
  let inflammationScore = 0;
  let inflammationCount = 0;
  if (phenoInput.crp !== undefined) {
    inflammationCount++;
    if (phenoInput.crp < 1) {
      inflammationScore += 100;
      inflammationDetails.push(`hs-CRP: ${phenoInput.crp} mg/L (Low risk)`);
    } else if (phenoInput.crp < 3) {
      inflammationScore += 70;
      inflammationDetails.push(`hs-CRP: ${phenoInput.crp} mg/L (Moderate)`);
    } else {
      inflammationScore += 30;
      inflammationDetails.push(`hs-CRP: ${phenoInput.crp} mg/L (High)`);
    }
  }
  if (inflammationCount > 0) {
    pillars.push({
      name: "Inflammation",
      score: Math.round(inflammationScore / inflammationCount),
      status: inflammationScore / inflammationCount >= 80 ? "optimal" : inflammationScore / inflammationCount >= 60 ? "good" : "needs attention",
      details: inflammationDetails,
    });
  }

  // Blood Health
  const bloodDetails: string[] = [];
  let bloodScore = 0;
  let bloodCount = 0;
  if (phenoInput.rdw !== undefined) {
    bloodCount++;
    if (phenoInput.rdw <= 14.5) {
      bloodScore += 100;
      bloodDetails.push(`RDW: ${phenoInput.rdw}% (Normal)`);
    } else {
      bloodScore += 50;
      bloodDetails.push(`RDW: ${phenoInput.rdw}% (Elevated - linked to aging)`);
    }
  }
  if (phenoInput.wbc !== undefined) {
    bloodCount++;
    if (phenoInput.wbc >= 4 && phenoInput.wbc <= 10) {
      bloodScore += 100;
      bloodDetails.push(`WBC: ${phenoInput.wbc} K/μL (Normal)`);
    } else {
      bloodScore += 50;
      bloodDetails.push(`WBC: ${phenoInput.wbc} K/μL (Outside normal)`);
    }
  }
  if (bloodCount > 0) {
    pillars.push({
      name: "Blood Health",
      score: Math.round(bloodScore / bloodCount),
      status: bloodScore / bloodCount >= 80 ? "optimal" : bloodScore / bloodCount >= 60 ? "good" : "needs attention",
      details: bloodDetails,
    });
  }

  const ageDifference = biologicalAge !== null ? biologicalAge - chronologicalAge : null;

  return {
    chronologicalAge,
    biologicalAge,
    ageDifference,
    agingStatus: ageDifference !== null
      ? ageDifference < -2 ? "Aging slower than average"
        : ageDifference > 2 ? "Aging faster than average"
        : "Aging at expected rate"
      : null,
    bloodWorkDate: testDate,
    labName,
    pillars,
    missingMarkers: missingMarkers.length > 0 ? missingMarkers : undefined,
    recommendations: biologicalAge !== null && ageDifference !== null && ageDifference > 0
      ? [
          "Focus on reducing inflammation through diet (omega-3s, colorful vegetables)",
          "Prioritize 7-8 hours of quality sleep",
          "Regular exercise (150+ min/week cardio, 2x strength training)",
          "Manage stress through meditation or breathwork",
        ]
      : undefined,
  };
}

// ============================================================================
// MCP SERVER SETUP
// This is the boilerplate that connects everything to Claude
// ============================================================================

const server = new Server(
  {
    name: "olympus-health",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools - Claude sees this menu
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_health_summary",
        description: "Get a comprehensive summary of today's metrics plus weekly averages for sleep, HRV, and workouts. Use this for general health questions.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_sleep_summary",
        description: "Get detailed sleep data including duration, sleep stages (deep, REM, light), sleep score, and efficiency for recent nights.",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "Number of days to fetch (default: 7, max: 30)",
              default: 7,
            },
          },
          required: [],
        },
      },
      {
        name: "get_todays_metrics",
        description: "Get today's health metrics including steps, active calories, exercise minutes, HRV, resting heart rate, and last night's sleep.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_hrv_trend",
        description: "Get Heart Rate Variability (HRV) trend over time with daily averages. HRV is a key indicator of recovery and fitness.",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "Number of days to analyze (default: 14)",
              default: 14,
            },
          },
          required: [],
        },
      },
      {
        name: "get_recent_workouts",
        description: "Get recent workout data including type, duration, calories burned, and heart rate data.",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "Number of days to fetch (default: 7)",
              default: 7,
            },
          },
          required: [],
        },
      },
      {
        name: "get_user_profile",
        description: "Get user's profile including height, weight, BMI, age, and health goals. Use this when questions involve body metrics or personalized recommendations.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_todays_food_log",
        description: "Get everything the user has eaten today, grouped by meal (breakfast, lunch, dinner, snacks) with calories and macros. Each food item has an 'id' field that can be used with delete_food_log.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "delete_food_log",
        description: "Delete a food entry from today's log. Use get_todays_food_log first to find the ID of the item to delete.",
        inputSchema: {
          type: "object",
          properties: {
            logId: {
              type: "string",
              description: "The ID of the food log entry to delete (from get_todays_food_log)",
            },
          },
          required: ["logId"],
        },
      },
      {
        name: "log_food",
        description: "Log a food item that the user has eaten. First try search_foods to find accurate USDA data. If not found, use your knowledge to estimate nutritional values.",
        inputSchema: {
          type: "object",
          properties: {
            foodName: {
              type: "string",
              description: "Name of the food (e.g., 'Grilled Chicken Breast', 'Medium Apple', 'Caesar Salad')",
            },
            mealType: {
              type: "string",
              enum: ["breakfast", "lunch", "dinner", "snack"],
              description: "Which meal this food belongs to",
            },
            servingDescription: {
              type: "string",
              description: "Serving size description (e.g., '1 medium', '200g', '1 cup', '1 slice')",
            },
            calories: {
              type: "number",
              description: "Calories (from USDA or estimated)",
            },
            proteinG: {
              type: "number",
              description: "Protein in grams",
            },
            carbsG: {
              type: "number",
              description: "Carbohydrates in grams",
            },
            fatG: {
              type: "number",
              description: "Fat in grams",
            },
            fiberG: {
              type: "number",
              description: "Fiber in grams (optional)",
            },
            sugarG: {
              type: "number",
              description: "Sugar in grams (optional)",
            },
            saturatedFatG: {
              type: "number",
              description: "Saturated fat in grams (optional)",
            },
            sodiumMg: {
              type: "number",
              description: "Sodium in mg (optional)",
            },
            cholesterolMg: {
              type: "number",
              description: "Cholesterol in mg (optional)",
            },
            vitaminAMcg: {
              type: "number",
              description: "Vitamin A in mcg (optional)",
            },
            vitaminCMg: {
              type: "number",
              description: "Vitamin C in mg (optional)",
            },
            vitaminDMcg: {
              type: "number",
              description: "Vitamin D in mcg (optional)",
            },
            calciumMg: {
              type: "number",
              description: "Calcium in mg (optional)",
            },
            ironMg: {
              type: "number",
              description: "Iron in mg (optional)",
            },
            potassiumMg: {
              type: "number",
              description: "Potassium in mg (optional)",
            },
          },
          required: ["foodName", "mealType", "servingDescription", "calories", "proteinG", "carbsG", "fatG"],
        },
      },
      {
        name: "search_foods",
        description: "Search the USDA food database for nutritional information. Use this before logging food to get accurate macro/micro data. Returns nutritional values per 100g.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Food name to search for (e.g., 'chicken breast', 'apple', 'brown rice')",
            },
            limit: {
              type: "number",
              description: "Max results to return (default: 10)",
              default: 10,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_food_portions",
        description: "Get available serving sizes for a food (e.g., '1 medium apple = 182g'). Use after search_foods to find portion sizes.",
        inputSchema: {
          type: "object",
          properties: {
            foodId: {
              type: "string",
              description: "Food ID from search_foods results",
            },
          },
          required: ["foodId"],
        },
      },
      // Blood Work Tools
      {
        name: "get_blood_work_results",
        description: "Get the user's blood work results with all biomarkers grouped by category (lipids, metabolic, blood, etc.). Each result has an 'id' that can be used with marker management tools.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of results to fetch (default: 5, max: 20)",
              default: 5,
            },
          },
          required: [],
        },
      },
      {
        name: "get_blood_work_by_id",
        description: "Get a specific blood work result by ID with all its markers.",
        inputSchema: {
          type: "object",
          properties: {
            resultId: {
              type: "string",
              description: "The blood work result ID (from get_blood_work_results)",
            },
          },
          required: ["resultId"],
        },
      },
      {
        name: "add_blood_work_marker",
        description: "Add a new biomarker to an existing blood work result. Use get_blood_work_results first to get the result ID.",
        inputSchema: {
          type: "object",
          properties: {
            resultId: {
              type: "string",
              description: "The blood work result ID to add the marker to",
            },
            name: {
              type: "string",
              description: "Marker name (e.g., 'Hemoglobin', 'LDL-C', 'TSH')",
            },
            value: {
              type: "number",
              description: "The measured value",
            },
            unit: {
              type: "string",
              description: "Unit of measurement (e.g., 'mg/dL', 'g/dL', 'mIU/L')",
            },
            category: {
              type: "string",
              description: "Category: metabolic, lipid, blood, liver, kidney, thyroid, vitamins, inflammation, hormones, electrolytes, or other",
            },
            referenceMin: {
              type: "number",
              description: "Minimum reference range value (optional)",
            },
            referenceMax: {
              type: "number",
              description: "Maximum reference range value (optional)",
            },
          },
          required: ["resultId", "name", "value", "unit"],
        },
      },
      {
        name: "edit_blood_work_marker",
        description: "Edit an existing biomarker in a blood work result. Use get_blood_work_results first to see available markers.",
        inputSchema: {
          type: "object",
          properties: {
            resultId: {
              type: "string",
              description: "The blood work result ID",
            },
            markerName: {
              type: "string",
              description: "Name of the marker to edit (case-insensitive)",
            },
            value: {
              type: "number",
              description: "New value (optional)",
            },
            unit: {
              type: "string",
              description: "New unit (optional)",
            },
            name: {
              type: "string",
              description: "New name to rename the marker (optional)",
            },
            referenceMin: {
              type: "number",
              description: "New minimum reference range (optional)",
            },
            referenceMax: {
              type: "number",
              description: "New maximum reference range (optional)",
            },
          },
          required: ["resultId", "markerName"],
        },
      },
      {
        name: "delete_blood_work_marker",
        description: "Delete a biomarker from a blood work result.",
        inputSchema: {
          type: "object",
          properties: {
            resultId: {
              type: "string",
              description: "The blood work result ID",
            },
            markerName: {
              type: "string",
              description: "Name of the marker to delete (case-insensitive)",
            },
          },
          required: ["resultId", "markerName"],
        },
      },
      // Longevity Tools
      {
        name: "get_longevity_metrics",
        description: "Get the user's biological age calculated from blood work using PhenoAge algorithm, plus longevity pillar scores (metabolic health, inflammation, blood health). Shows how fast or slow the user is aging compared to their chronological age.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls - when Claude calls a tool, this runs
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "get_health_summary":
        result = await getHealthSummary();
        break;
      case "get_sleep_summary":
        result = await getSleepSummary((args?.days as number) || 7);
        break;
      case "get_todays_metrics":
        result = await getTodaysMetrics();
        break;
      case "get_hrv_trend":
        result = await getHrvTrend((args?.days as number) || 14);
        break;
      case "get_recent_workouts":
        result = await getRecentWorkouts((args?.days as number) || 7);
        break;
      case "get_user_profile":
        result = await getUserProfile();
        break;
      case "get_todays_food_log":
        result = await getTodaysFoodLog();
        break;
      case "delete_food_log":
        result = await deleteFoodLog(args?.logId as string);
        break;
      case "log_food":
        result = await logFood(args as unknown as LogFoodParams);
        break;
      case "search_foods":
        result = await searchFoods((args?.query as string) || "", (args?.limit as number) || 10);
        break;
      case "get_food_portions":
        result = await getFoodPortions(args?.foodId as string);
        break;
      // Blood Work Tools
      case "get_blood_work_results":
        result = await getBloodWorkResults((args?.limit as number) || 5);
        break;
      case "get_blood_work_by_id":
        result = await getBloodWorkById(args?.resultId as string);
        break;
      case "add_blood_work_marker":
        result = await addBloodWorkMarker(args?.resultId as string, {
          name: args?.name as string,
          value: args?.value as number,
          unit: args?.unit as string,
          category: args?.category as string | undefined,
          referenceMin: args?.referenceMin as number | undefined,
          referenceMax: args?.referenceMax as number | undefined,
        });
        break;
      case "edit_blood_work_marker":
        result = await editBloodWorkMarker(
          args?.resultId as string,
          args?.markerName as string,
          {
            value: args?.value as number | undefined,
            unit: args?.unit as string | undefined,
            name: args?.name as string | undefined,
            referenceMin: args?.referenceMin as number | undefined,
            referenceMax: args?.referenceMax as number | undefined,
          }
        );
        break;
      case "delete_blood_work_marker":
        result = await deleteBloodWorkMarker(args?.resultId as string, args?.markerName as string);
        break;
      // Longevity Tools
      case "get_longevity_metrics":
        result = await getLongevityMetrics();
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Olympus MCP Server running");
}

main().catch(console.error);
