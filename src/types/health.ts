// Core health metric types
export type MetricType =
  | "heart_rate"
  | "resting_heart_rate"
  | "hrv"
  | "steps"
  | "calories_active"
  | "calories_total"
  | "sleep_duration"
  | "sleep_deep"
  | "sleep_rem"
  | "sleep_light"
  | "sleep_awake"
  | "blood_oxygen"
  | "respiratory_rate"
  | "weight"
  | "body_fat"
  | "blood_glucose"
  | "workout";

export interface HealthMetric {
  id: string;
  user_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  source: string;
  recorded_at: string;
  metadata?: Record<string, unknown>;
}

export interface DailyScores {
  user_id: string;
  date: string;
  readiness_score: number;
  sleep_score: number;
  strain_score: number;
  recovery_score: number;
  components: {
    hrv_score?: number;
    resting_hr_score?: number;
    sleep_duration_score?: number;
    sleep_efficiency_score?: number;
    activity_score?: number;
  };
}

export interface SleepData {
  date: string;
  duration_minutes: number;
  efficiency: number;
  deep_minutes: number;
  rem_minutes: number;
  light_minutes: number;
  awake_minutes: number;
  score: number;
}

export interface WorkoutData {
  id: string;
  user_id: string;
  type: string;
  name: string;
  duration_minutes: number;
  calories_burned: number;
  heart_rate_avg?: number;
  heart_rate_max?: number;
  started_at: string;
  ended_at: string;
  notes?: string;
}

export interface NutritionLog {
  id: string;
  user_id: string;
  food_name: string;
  serving_size?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  micronutrients?: Record<string, number>;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  logged_at: string;
}

export interface DailyNutrition {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meals: NutritionLog[];
}

export interface BloodWorkMarker {
  name: string;
  value: number;
  unit: string;
  reference_low: number;
  reference_high: number;
  optimal_low?: number;
  optimal_high?: number;
  category: string;
}

export interface BloodWorkResult {
  id: string;
  user_id: string;
  test_date: string;
  lab_name?: string;
  markers: BloodWorkMarker[];
  report_url?: string;
  created_at: string;
}

export interface LongevityScore {
  biological_age: number;
  chronological_age: number;
  age_difference: number;
  overall_score: number;
  components: {
    cardiovascular: number;
    metabolic: number;
    inflammation: number;
    functional: number;
    lifestyle: number;
  };
  recommendations: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other";
  height_cm?: number;
  weight_kg?: number;
  goals?: string[];
  created_at: string;
  settings: {
    units: "metric" | "imperial";
    sleep_target_hours: number;
    calorie_target: number;
    protein_target_g: number;
    notifications_enabled: boolean;
  };
}
