// Supabase database types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          date_of_birth: string | null;
          gender: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          goals: string[] | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          goals?: string[] | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          goals?: string[] | null;
          settings?: Json;
          updated_at?: string;
        };
      };
      health_metrics: {
        Row: {
          id: string;
          user_id: string;
          metric_type: string;
          value: number;
          unit: string | null;
          source: string;
          recorded_at: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric_type: string;
          value: number;
          unit?: string | null;
          source: string;
          recorded_at: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          metric_type?: string;
          value?: number;
          unit?: string | null;
          source?: string;
          recorded_at?: string;
          metadata?: Json | null;
        };
      };
      nutrition_logs: {
        Row: {
          id: string;
          user_id: string;
          food_name: string;
          serving_size: string | null;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          fiber_g: number | null;
          micronutrients: Json | null;
          meal_type: string;
          logged_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          food_name: string;
          serving_size?: string | null;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          fiber_g?: number | null;
          micronutrients?: Json | null;
          meal_type: string;
          logged_at?: string;
          created_at?: string;
        };
        Update: {
          food_name?: string;
          serving_size?: string | null;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          fiber_g?: number | null;
          micronutrients?: Json | null;
          meal_type?: string;
          logged_at?: string;
        };
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          name: string;
          duration_minutes: number;
          calories_burned: number | null;
          heart_rate_avg: number | null;
          heart_rate_max: number | null;
          started_at: string;
          ended_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          name: string;
          duration_minutes: number;
          calories_burned?: number | null;
          heart_rate_avg?: number | null;
          heart_rate_max?: number | null;
          started_at: string;
          ended_at: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          type?: string;
          name?: string;
          duration_minutes?: number;
          calories_burned?: number | null;
          heart_rate_avg?: number | null;
          heart_rate_max?: number | null;
          started_at?: string;
          ended_at?: string;
          notes?: string | null;
        };
      };
      daily_scores: {
        Row: {
          user_id: string;
          date: string;
          readiness_score: number | null;
          sleep_score: number | null;
          strain_score: number | null;
          recovery_score: number | null;
          components: Json | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          date: string;
          readiness_score?: number | null;
          sleep_score?: number | null;
          strain_score?: number | null;
          recovery_score?: number | null;
          components?: Json | null;
          created_at?: string;
        };
        Update: {
          readiness_score?: number | null;
          sleep_score?: number | null;
          strain_score?: number | null;
          recovery_score?: number | null;
          components?: Json | null;
        };
      };
      blood_work: {
        Row: {
          id: string;
          user_id: string;
          test_date: string;
          lab_name: string | null;
          markers: Json;
          report_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          test_date: string;
          lab_name?: string | null;
          markers: Json;
          report_url?: string | null;
          created_at?: string;
        };
        Update: {
          test_date?: string;
          lab_name?: string | null;
          markers?: Json;
          report_url?: string | null;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          content: string;
          created_at?: string;
        };
        Update: {
          role?: string;
          content?: string;
        };
      };
    };
  };
}
