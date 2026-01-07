import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  date,
  jsonb,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"), // 'male', 'female', 'other'
  heightCm: numeric("height_cm"),
  weightKg: numeric("weight_kg"),
  goals: text("goals").array(),
  settings: jsonb("settings").default({
    units: "metric",
    sleepTargetHours: 8,
    calorieTarget: 2000,
    proteinTargetG: 150,
    notificationsEnabled: true,
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sessions table for auth
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Health metrics (time-series data)
export const healthMetrics = pgTable("health_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  metricType: text("metric_type").notNull(),
  value: numeric("value").notNull(),
  unit: text("unit"),
  source: text("source").notNull().default("manual"),
  recordedAt: timestamp("recorded_at").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Foods database
export const foods = pgTable("foods", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull().default("usda"), // 'usda', 'open_food_facts', 'user'
  sourceId: text("source_id").unique(), // Original ID from source database (unique for deduplication)
  name: text("name").notNull(),
  brand: text("brand"),
  barcode: text("barcode"),
  category: text("category"),

  // Serving info
  servingSize: numeric("serving_size").notNull().default("100"),
  servingUnit: text("serving_unit").notNull().default("g"),
  servingSizeDescription: text("serving_size_description"), // e.g., "1 cup", "1 medium"

  // Macronutrients (per serving)
  calories: numeric("calories").notNull().default("0"),
  proteinG: numeric("protein_g").notNull().default("0"),
  fatG: numeric("fat_g").notNull().default("0"),
  saturatedFatG: numeric("saturated_fat_g").default("0"),
  transFatG: numeric("trans_fat_g").default("0"),
  monounsaturatedFatG: numeric("monounsaturated_fat_g").default("0"),
  polyunsaturatedFatG: numeric("polyunsaturated_fat_g").default("0"),
  carbsG: numeric("carbs_g").notNull().default("0"),
  fiberG: numeric("fiber_g").default("0"),
  sugarG: numeric("sugar_g").default("0"),
  addedSugarG: numeric("added_sugar_g").default("0"),

  // Micronutrients - Vitamins (per serving)
  vitaminAMcg: numeric("vitamin_a_mcg").default("0"),
  vitaminCMg: numeric("vitamin_c_mg").default("0"),
  vitaminDMcg: numeric("vitamin_d_mcg").default("0"),
  vitaminEMg: numeric("vitamin_e_mg").default("0"),
  vitaminKMcg: numeric("vitamin_k_mcg").default("0"),
  thiaminMg: numeric("thiamin_mg").default("0"),
  riboflavinMg: numeric("riboflavin_mg").default("0"),
  niacinMg: numeric("niacin_mg").default("0"),
  vitaminB6Mg: numeric("vitamin_b6_mg").default("0"),
  folateMcg: numeric("folate_mcg").default("0"),
  vitaminB12Mcg: numeric("vitamin_b12_mcg").default("0"),

  // Micronutrients - Minerals (per serving)
  calciumMg: numeric("calcium_mg").default("0"),
  ironMg: numeric("iron_mg").default("0"),
  magnesiumMg: numeric("magnesium_mg").default("0"),
  phosphorusMg: numeric("phosphorus_mg").default("0"),
  potassiumMg: numeric("potassium_mg").default("0"),
  sodiumMg: numeric("sodium_mg").default("0"),
  zincMg: numeric("zinc_mg").default("0"),
  copperMg: numeric("copper_mg").default("0"),
  manganeseMg: numeric("manganese_mg").default("0"),
  seleniumMcg: numeric("selenium_mcg").default("0"),

  // Other
  cholesterolMg: numeric("cholesterol_mg").default("0"),
  caffeineMg: numeric("caffeine_mg").default("0"),
  waterG: numeric("water_g").default("0"),

  // Metadata
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Food logs (user's daily food entries)
export const foodLogs = pgTable("food_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),

  // Denormalized food data (in case food is deleted or for custom entries)
  foodName: text("food_name").notNull(),
  brand: text("brand"),

  // Serving info
  servingQuantity: numeric("serving_quantity").notNull().default("1"),
  servingUnit: text("serving_unit").notNull().default("g"),
  servingSize: numeric("serving_size").notNull(), // Actual grams consumed

  // Calculated nutrition (based on serving)
  calories: numeric("calories").notNull().default("0"),
  proteinG: numeric("protein_g").notNull().default("0"),
  fatG: numeric("fat_g").notNull().default("0"),
  carbsG: numeric("carbs_g").notNull().default("0"),
  fiberG: numeric("fiber_g").default("0"),
  sugarG: numeric("sugar_g").default("0"),
  saturatedFatG: numeric("saturated_fat_g").default("0"),

  // Micronutrients
  sodiumMg: numeric("sodium_mg").default("0"),
  cholesterolMg: numeric("cholesterol_mg").default("0"),
  vitaminAMcg: numeric("vitamin_a_mcg").default("0"),
  vitaminCMg: numeric("vitamin_c_mg").default("0"),
  vitaminDMcg: numeric("vitamin_d_mcg").default("0"),
  calciumMg: numeric("calcium_mg").default("0"),
  ironMg: numeric("iron_mg").default("0"),
  potassiumMg: numeric("potassium_mg").default("0"),

  // Meal info
  mealType: text("meal_type").notNull(), // 'breakfast', 'lunch', 'dinner', 'snack'
  loggedDate: date("logged_date").notNull(), // Date for the log (allows past dates)

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Nutrition goals
export const nutritionGoals = pgTable("nutrition_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  // Calorie goal
  calorieGoal: integer("calorie_goal").notNull().default(2000),

  // Macro goals - grams
  proteinG: integer("protein_g").notNull().default(150),
  carbsG: integer("carbs_g").notNull().default(200),
  fatG: integer("fat_g").notNull().default(65),
  fiberG: integer("fiber_g").default(30),

  // Macro goals - percentages (alternative)
  proteinPercent: integer("protein_percent").default(30),
  carbsPercent: integer("carbs_percent").default(40),
  fatPercent: integer("fat_percent").default(30),

  // Which mode to use
  usePercentages: boolean("use_percentages").default(false),

  // Calculator inputs (stored for recalculation)
  activityLevel: text("activity_level").default("moderate"), // sedentary, light, moderate, active, very_active
  goal: text("goal").default("maintain"), // lose, maintain, gain

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Favorite foods (for quick access)
export const favoriteFoods = pgTable("favorite_foods", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.foodId] }),
}));

// Recent foods (auto-tracked for quick access)
export const recentFoods = pgTable("recent_foods", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.foodId] }),
}));

// Food portions (common serving sizes like "1 medium apple")
export const foodPortions = pgTable("food_portions", {
  id: uuid("id").primaryKey().defaultRandom(),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  portionName: text("portion_name").notNull(), // e.g., "1 medium", "1 cup", "1 slice"
  gramWeight: numeric("gram_weight").notNull(), // grams for this portion
  isDefault: boolean("is_default").default(false), // show as default option
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Legacy nutrition logs (keeping for backward compatibility)
export const nutritionLogs = pgTable("nutrition_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  foodName: text("food_name").notNull(),
  servingSize: text("serving_size"),
  calories: numeric("calories").notNull().default("0"),
  proteinG: numeric("protein_g").notNull().default("0"),
  carbsG: numeric("carbs_g").notNull().default("0"),
  fatG: numeric("fat_g").notNull().default("0"),
  fiberG: numeric("fiber_g").default("0"),
  micronutrients: jsonb("micronutrients").default({}),
  mealType: text("meal_type").notNull(),
  loggedAt: timestamp("logged_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Workouts
export const workouts = pgTable("workouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'strength', 'running', 'cycling', 'swimming', 'yoga', 'hiit', 'sports', 'walking', 'other'
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  caloriesBurned: integer("calories_burned"),
  heartRateAvg: integer("heart_rate_avg"),
  heartRateMax: integer("heart_rate_max"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at").notNull(),
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sleep sessions (Apple Health style)
export const sleepSessions = pgTable("sleep_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Timing
  bedtime: timestamp("bedtime").notNull(),
  wakeTime: timestamp("wake_time").notNull(),
  sleepDate: date("sleep_date").notNull(), // The night this sleep belongs to (YYYY-MM-DD)

  // Duration (in minutes)
  totalMinutes: integer("total_minutes").notNull(), // Total time asleep
  inBedMinutes: integer("in_bed_minutes").notNull(), // Total time in bed

  // Apple Health sleep stages (in minutes)
  deepSleepMinutes: integer("deep_sleep_minutes").default(0),
  remSleepMinutes: integer("rem_sleep_minutes").default(0),
  lightSleepMinutes: integer("light_sleep_minutes").default(0),
  awakeMinutes: integer("awake_minutes").default(0),
  sleepLatencyMinutes: integer("sleep_latency_minutes").default(0), // Time to fall asleep

  // Quality metrics
  sleepScore: integer("sleep_score"), // 0-100
  efficiency: numeric("efficiency"), // percentage (time asleep / time in bed)

  // Physiological data during sleep
  hrvAvg: integer("hrv_avg"), // Heart rate variability in ms
  restingHr: integer("resting_hr"), // Resting heart rate during sleep
  respiratoryRate: numeric("respiratory_rate"), // Breaths per minute

  // Source and metadata
  source: text("source").notNull().default("manual"), // 'manual', 'apple_health', 'whoop', 'oura'
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily scores (computed/cached)
export const dailyScores = pgTable(
  "daily_scores",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    readinessScore: numeric("readiness_score"),
    sleepScore: numeric("sleep_score"),
    strainScore: numeric("strain_score"),
    recoveryScore: numeric("recovery_score"),
    components: jsonb("components").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.date] }),
  })
);

// Blood work results
export const bloodWork = pgTable("blood_work", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  testDate: date("test_date").notNull(),
  labName: text("lab_name"),
  markers: jsonb("markers").notNull().default([]),
  reportUrl: text("report_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chat messages for AI coach
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// API tokens for external integrations (Health Auto Export, etc.)
export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // 64-char hex from crypto.randomBytes(32)
  name: text("name").notNull(), // Human-readable name like "iPhone 15 Pro"
  lastUsedAt: timestamp("last_used_at"),
  requestCount: integer("request_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Webhook logs for tracking incoming data syncs
export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenId: uuid("token_id").references(() => apiTokens.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key").notNull(), // Hash to prevent duplicate imports
  status: text("status").notNull(), // 'success', 'partial', 'failed', 'duplicate'
  metricsProcessed: integer("metrics_processed").default(0),
  sleepSessionsProcessed: integer("sleep_sessions_processed").default(0),
  workoutsProcessed: integer("workouts_processed").default(0),
  errors: jsonb("errors").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type HealthMetric = typeof healthMetrics.$inferSelect;
export type NewHealthMetric = typeof healthMetrics.$inferInsert;
export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type FoodLog = typeof foodLogs.$inferSelect;
export type NewFoodLog = typeof foodLogs.$inferInsert;
export type FoodPortion = typeof foodPortions.$inferSelect;
export type NutritionGoal = typeof nutritionGoals.$inferSelect;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type SleepSession = typeof sleepSessions.$inferSelect;
export type NewSleepSession = typeof sleepSessions.$inferInsert;
export type DailyScore = typeof dailyScores.$inferSelect;
export type NewDailyScore = typeof dailyScores.$inferInsert;
export type BloodWorkResult = typeof bloodWork.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
