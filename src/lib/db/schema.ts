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
  uniqueIndex,
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
    timezone: "Asia/Kolkata", // IANA timezone identifier
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
}, (table) => ({
  // Prevent duplicate metrics: same user, type, and timestamp = same metric
  uniqueMetric: uniqueIndex("health_metrics_unique_idx").on(
    table.userId,
    table.metricType,
    table.recordedAt
  ),
}));

// Food logs (user's daily food entries)
export const foodLogs = pgTable("food_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Food data is stored denormalized: entries come from natural-language
  // parsing, not a food table, so each log is self-contained.
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
}, (table) => ({
  // Prevent duplicate workouts: same user, start time, and type = same workout
  uniqueWorkout: uniqueIndex("workouts_unique_idx").on(
    table.userId,
    table.startedAt,
    table.type
  ),
}));

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
}, (table) => ({
  // One sleep session per user per night per source
  uniqueSleep: uniqueIndex("sleep_sessions_unique_idx").on(
    table.userId,
    table.sleepDate,
    table.source
  ),
}));

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

// Station Olympus episodes — one row per morning show. Written only by the
// worker's publish node; the app reads. Audio is pruned after 30 days (blob
// deleted, audioUrl nulled, status 'expired') but the row itself is forever:
// the archive keeps its transcripts after the voice is gone.
export const episodes = pgTable("episodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  airDate: date("air_date").notNull(), // The morning this episode covers (YYYY-MM-DD)
  status: text("status").notNull(), // 'published', 'no_audio', 'expired'
  audioUrl: text("audio_url"), // Vercel Blob URL; null when unpublished or pruned
  audioDurationS: integer("audio_duration_s"),
  // ~240 amplitude peaks (0-100) sampled from the finished audio, so the
  // player can draw its trace without downloading and decoding the mp3.
  // Kept after pruning: the shape of a morning outlives its sound.
  waveform: jsonb("waveform"),
  // Chunk boundaries as seconds into the episode, one per transcript line —
  // the segment starts the player seeks to. A by-product of chunked synthesis.
  segmentStarts: jsonb("segment_starts"),
  // Speaker-tagged lines: [{ speaker: 'ANCHOR', text: '...' }]. Tagged even
  // with one speaker so a second voice is a prompt change, not a migration.
  transcript: jsonb("transcript").notNull(),
  // The exact facts JSON the writer saw at press time. The ledger is live and
  // can be revised by a late sync; this is what was true when the show aired.
  factsUsed: jsonb("facts_used").notNull(),
  writerModel: text("writer_model"),
  ttsModel: text("tts_model"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEpisode: uniqueIndex("episodes_unique_idx").on(table.userId, table.airDate),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type HealthMetric = typeof healthMetrics.$inferSelect;
export type NewHealthMetric = typeof healthMetrics.$inferInsert;
export type FoodLog = typeof foodLogs.$inferSelect;
export type NewFoodLog = typeof foodLogs.$inferInsert;
export type NutritionGoal = typeof nutritionGoals.$inferSelect;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type SleepSession = typeof sleepSessions.$inferSelect;
export type NewSleepSession = typeof sleepSessions.$inferInsert;
export type DailyScore = typeof dailyScores.$inferSelect;
export type NewDailyScore = typeof dailyScores.$inferInsert;
export type BloodWorkResult = typeof bloodWork.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type NewEpisode = typeof episodes.$inferInsert;
