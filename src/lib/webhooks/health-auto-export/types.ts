/**
 * Health Auto Export payload types
 * Based on the JSON format exported by the Health Auto Export iOS app
 * https://github.com/Lybron/health-auto-export
 */

// Individual metric data point
export interface HAEMetricDataPoint {
  date: string; // ISO 8601 timestamp
  qty: number;
  source?: string;
}

// Metric with its data array
export interface HAEMetric {
  name: string; // e.g., "heart_rate_variability_sdnn", "resting_heart_rate"
  units: string;
  data: HAEMetricDataPoint[];
}

// Sleep analysis data
export interface HAESleepData {
  date: string;
  sleepStart?: string;
  sleepEnd?: string;
  inBed?: number; // minutes
  asleep?: number; // minutes
  deep?: number; // minutes
  rem?: number; // minutes
  core?: number; // minutes (light sleep in Apple Health)
  awake?: number; // minutes
  source?: string;
}

// Workout data
export interface HAEWorkout {
  id?: string;
  name: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  duration?: number; // seconds
  activeEnergyBurned?: {
    qty: number;
    units: string;
  };
  heartRateData?: {
    qty: number;
    units: string;
  }[];
  source?: string;
}

// Main payload structure
export interface HAEPayload {
  data: {
    metrics?: HAEMetric[];
    workouts?: HAEWorkout[];
  };
}

// Processing result
export interface ProcessingResult {
  metricsProcessed: number;
  sleepSessionsProcessed: number;
  workoutsProcessed: number;
  errors: string[];
  status: "success" | "partial" | "failed";
}

// Metric type mapping to Olympus
export const METRIC_TYPE_MAP: Record<string, string> = {
  heart_rate_variability_sdnn: "hrv",
  resting_heart_rate: "resting_heart_rate",
  heart_rate: "heart_rate",
  step_count: "steps",
  active_energy_burned: "calories_active",
  basal_energy_burned: "calories_basal",
  respiratory_rate: "respiratory_rate",
  blood_oxygen_saturation: "blood_oxygen",
  oxygen_saturation: "blood_oxygen",
  walking_heart_rate_average: "walking_heart_rate",
  walking_running_distance: "distance",
  flights_climbed: "flights_climbed",
  apple_exercise_time: "exercise_minutes",
  apple_stand_hour: "stand_hours",
};

// Workout type mapping to Olympus
export const WORKOUT_TYPE_MAP: Record<string, string> = {
  Running: "running",
  "Outdoor Run": "running",
  "Indoor Run": "running",
  "Treadmill Run": "running",
  Cycling: "cycling",
  "Indoor Cycling": "cycling",
  "Outdoor Cycling": "cycling",
  Swimming: "swimming",
  "Pool Swim": "swimming",
  "Open Water Swim": "swimming",
  Yoga: "yoga",
  HIIT: "hiit",
  "High Intensity Interval Training": "hiit",
  "Functional Strength Training": "strength",
  "Traditional Strength Training": "strength",
  Walking: "walking",
  "Outdoor Walk": "walking",
  Hiking: "walking",
  Elliptical: "other",
  Rowing: "other",
  "Stair Climbing": "other",
  "Cross Training": "other",
  Pilates: "yoga",
  Dance: "other",
  Cooldown: "other",
  "Core Training": "strength",
};
