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

// Nutrition logs
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
  mealType: text("meal_type").notNull(), // 'breakfast', 'lunch', 'dinner', 'snack'
  loggedAt: timestamp("logged_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Workouts
export const workouts = pgTable("workouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
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

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type HealthMetric = typeof healthMetrics.$inferSelect;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type DailyScore = typeof dailyScores.$inferSelect;
export type BloodWorkResult = typeof bloodWork.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
