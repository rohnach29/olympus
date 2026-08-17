/**
 * The shapes the ledger renders.
 *
 * Every component takes its props from here, so there is exactly one
 * definition of what a day looks like. Positions along a track (`t`) are
 * always *hours since the viewed day's local midnight* — which may be
 * negative (a bedtime before midnight) or beyond 24; traces clip, they never
 * wrap. Durations are minutes, because that is what the database stores.
 */

export type VerdictBand = "recovered" | "moderate" | "rest" | "unprinted";
export type SleepStage = "deep" | "core" | "rem" | "awake";
export type StrainLevel = "low" | "moderate" | "high";

export interface TracePoint {
  t: number;
  v: number;
}

export interface TraceSegment {
  from: number;
  to: number;
  stage: SleepStage;
}

export interface MealMark {
  t: number;
  kcal: number;
  label: string;
  /**
   * True when the entry was logged on a different date than the one it counts
   * toward, so `t` is a nominal meal hour rather than an observed one.
   */
  approximate: boolean;
}

export interface HeartTrack {
  /** 10-minute means; a gap wider than `gapHours` starts a new run. */
  runs: TracePoint[][];
  /** Measured resting HR, when the watch reported one for the night. */
  rest: number | null;
  /** Lowest sample of the day — what the figures column shows without `rest`. */
  low: number;
  peak: number | null;
  peakAt: number | null;
  /** y-axis bounds actually used, so the trace fills its band. */
  floor: number;
  ceil: number;
  sampleCount: number;
}

export interface SleepTrack {
  segments: TraceSegment[];
  bedtime: string;
  wake: string;
  totalMin: number;
  deepMin: number;
  remMin: number;
  efficiency: number | null;
  score: number | null;
  /** The night began before this day's midnight. */
  carriesOver: boolean;
}

export interface FuelTrack {
  meals: MealMark[];
  kcal: number;
  proteinG: number;
  fibreG: number;
  lastMealT: number | null;
}

export interface StepsTrack {
  /** 24 buckets, one per local hour. */
  hourly: number[];
  total: number;
  peakHour: number | null;
}

export interface VerdictChips {
  hrv: { value: number | null; delta: number | null };
  rhr: { value: number | null; delta: number | null };
  sleepScore: number | null;
  strain: { value: number; level: StrainLevel };
}

export interface DayVerdict {
  recovery: number | null;
  band: VerdictBand;
  headline: string;
  sentence: string;
  /** 0–1: how much of the weighted picture the score was computed from. */
  confidence: number;
  basis: string[];
  chips: VerdictChips;
}

export interface WeekDay {
  date: string;
  label: string;
  recovery: number | null;
  steps: number | null;
  printed: boolean;
  isToday: boolean;
  isViewed: boolean;
}

export interface DayLedger {
  date: string;
  tz: string;
  isToday: boolean;
  weekday: string;
  city: string;
  reportNo: number;
  /** Hours since local midnight, or null on a closed day (no now-line). */
  nowT: number | null;
  prevDate: string;
  nextDate: string | null;
  watch: { lastSyncedAt: Date | null; lastSyncedLabel: string | null };
  verdict: DayVerdict;
  tracks: {
    heart: HeartTrack | null;
    sleep: SleepTrack | null;
    fuel: FuelTrack | null;
    steps: StepsTrack | null;
  };
  week: {
    days: WeekDay[];
    best: { score: number; date: string } | null;
  };
  footnotes: string[];
}

export interface AlmanacCell {
  date: string;
  day: number;
  recovery: number | null;
  steps: number | null;
  sleepMin: number | null;
  printed: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface MonthLedger {
  month: string;
  label: string;
  year: number;
  tz: string;
  cells: AlmanacCell[];
  /** Blank cells before day 1 so the wall aligns under its weekday column. */
  leadingBlanks: number;
  printedCount: number;
  dayCount: number;
  prevMonth: string;
  nextMonth: string | null;
  records: {
    bestRecovery: { value: number; date: string } | null;
    mostSteps: { value: number; date: string } | null;
    longestSleep: { value: number; date: string } | null;
  };
}
