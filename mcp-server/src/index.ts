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
