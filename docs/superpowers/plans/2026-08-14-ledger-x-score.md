# The Ledger × The Score — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Olympus dashboard with the approved "Ledger × Score" design — a one-screen daily broadsheet at `/`, closed-day pages at `/day/[date]`, an Almanac archive at `/history` — on top of a data layer fixed to produce a real recovery verdict from sparse data.

**Architecture:** A pure data-assembly module (`src/lib/ledger/`) builds one typed `DayLedger` object per day from Drizzle queries; server components render it as static SVG tracks; the only client code is a now-line overlay and the masthead clock. Recovery scoring moves from all-or-nothing to weighted partial scoring with a confidence value, and the two query bugs that poison the inputs (strain window, HRV source) are fixed first so the verdict band has a number to print.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript strict, Drizzle + postgres.js, Tailwind 4 (tokens via CSS variables), vitest (new devDep, unit tests only), zod.

**Approved design references (do not re-litigate):**
- Layout: full-app walkthrough artifact `8dda75af` — masthead → verdict band → four ledger-line tracks (label | 00–24h trace | figures column) → week strip → footer. No sidebar, no tabs, no cards.
- Palette: **02 Gallery** (user's pick from artifact `f51aad7e`).
- Mockup HTML with exact SVG geometry: scratchpad `olympus-color-editions.html` (session 7dedce80).

## Global Constraints

- Gallery tokens, verbatim: ground `#fdfdfc` · ink `#131312` · muted `#8a8a86` · rule `#e7e7e3` · accent `#d64a2e` · grey-2 `#6b6b66` · grey-3 `#d3d3cd` · chip bg `#f7f7f5` · chip text `#4d4d49` · up-green `#2c6e3f`.
- Type: `"Helvetica Neue", Helvetica, Arial, sans-serif` for everything; `ui-monospace, "SF Mono", Menlo, monospace` for labels/chips/axis; numerals always `font-variant-numeric: tabular-nums`; big numbers `font-weight: 200`.
- TypeScript strict, no `any`. Zod for all route params/payloads.
- Server components by default; `"use client"` only for the two leaf components named in Task 8.
- Drizzle query builder style matching the existing routes (`db.select().from(...)`).
- No new runtime dependencies. New devDependency allowed: `vitest` only.
- All day boundaries computed in the **user's timezone** (`getUserTimezone(user.settings)` from `src/lib/utils/timezone.ts`), converted to UTC `Date`s for queries.
- Every task ends with: verification commands run fresh, commit, **push** (`git push origin main`, exit 0).
- Deliberately OUT of scope (later phases): in-place track expansion, ⌘K, LLM-written verdict copy, restyling blood work/settings, deleting old domain pages (`/sleep`, `/recovery`, `/workouts`, `/nutrition` stay routable but unlinked).
- Data reality (verified 2026-08-14, plan against it): `health_metrics` has rich minute-level `steps` (16k rows) and `calories_active`; `hrv` 11 rows; `resting_heart_rate` 3 rows; **zero `heart_rate` intraday rows**; `sleep_sessions` and `daily_scores` are **empty**; `food_logs` has one day. Every component must render an honest "unprinted" state. `heart_rate` and `sleep_analysis` are already in `METRIC_TYPE_MAP` — data appears as soon as the user enables those metrics in the Health Auto Export app (user-side checklist, Task 12).

## File Structure

```
src/lib/ledger/
  types.ts        — DayLedger + all sub-types (single source of truth for UI props)
  time.ts         — day-window + hour-binning helpers (pure, tested)
  night-metrics.ts— HRV/RHR picker with health_metrics fallback (pure, tested)
  tracks.ts       — builders: steps bins, meal marks, sleep segments, heart points (pure, tested)
  copy.ts         — deterministic verdict headline/sentence templates (pure, tested)
  assemble.ts     — getDayLedger(userId, date): all Drizzle queries + daily_scores upsert
src/components/ledger/
  masthead.tsx    — date, title, watch status, prev/next nav
  verdict-band.tsx— numeral, directive, chips
  track-row.tsx   — grid row: label | svg | figures (used by all four tracks)
  track-svgs.tsx  — four pure SVG-string builders (heart line, sleep band, fuel dots, step bars)
  time-axis.tsx   — 00–24 axis row
  week-line.tsx   — thin week strip
  now-line.tsx    — "use client" overlay (red line + minutes ticker)
  local-clock.tsx — "use client" masthead HH:MM
src/app/(dashboard)/
  layout.tsx      — MODIFY: drop Sidebar/Header, paper ground
  page.tsx        — REPLACE: Today ledger
  day/[date]/page.tsx — NEW: closed day
  history/page.tsx    — NEW: Almanac
src/lib/utils/recovery-scoring.ts — MODIFY: partial scoring (calculateRecovery)
src/app/api/recovery/route.ts     — MODIFY: strain window, HRV fallback, readiness removal
src/app/globals.css               — MODIFY: add ledger tokens
tests/ledger/*.test.ts            — vitest unit tests
```

---

### Task 1: Vitest + time helpers

**Files:**
- Modify: `package.json` (add vitest, `"test": "vitest run"`)
- Create: `src/lib/ledger/time.ts`
- Test: `tests/ledger/time.test.ts`

**Interfaces:**
- Produces: `dayWindowUtc(dateStr: string, tz: string): { start: Date; end: Date }` — UTC instants of local midnight→midnight; `localHours(d: Date, tz: string): number` — fractional hours since local midnight (0–24); `localDateStr(d: Date, tz: string): string` — YYYY-MM-DD in tz.

- [ ] **Step 1: Install vitest and add script**

```bash
npm install -D vitest
```

In `package.json` scripts add: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing tests**

```ts
// tests/ledger/time.test.ts
import { describe, it, expect } from "vitest";
import { dayWindowUtc, localHours, localDateStr } from "@/lib/ledger/time";

describe("dayWindowUtc", () => {
  it("returns UTC instants of local midnight for Singapore (UTC+8)", () => {
    const { start, end } = dayWindowUtc("2026-08-14", "Asia/Singapore");
    expect(start.toISOString()).toBe("2026-08-13T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-14T16:00:00.000Z");
  });
  it("handles Kolkata half-hour offset", () => {
    const { start } = dayWindowUtc("2026-08-14", "Asia/Kolkata");
    expect(start.toISOString()).toBe("2026-08-13T18:30:00.000Z");
  });
});

describe("localHours", () => {
  it("maps a UTC instant to fractional local hours", () => {
    // 11:30 SGT = 03:30 UTC
    expect(localHours(new Date("2026-08-14T03:30:00Z"), "Asia/Singapore")).toBeCloseTo(11.5, 3);
  });
});

describe("localDateStr", () => {
  it("formats in the target timezone, not UTC", () => {
    // 23:30 UTC on the 13th is already the 14th in Singapore
    expect(localDateStr(new Date("2026-08-13T23:30:00Z"), "Asia/Singapore")).toBe("2026-08-14");
  });
});
```

Note the `@/` alias: create `vitest.config.ts` at repo root so vitest resolves it the same way Next does:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/ledger/time.test.ts`
Expected: FAIL — cannot resolve `@/lib/ledger/time`.

- [ ] **Step 4: Implement**

```ts
// src/lib/ledger/time.ts
// All ledger day-boundaries live here. The trick used throughout: Intl gives us
// the wall-clock parts of an instant in a target timezone; comparing that
// wall-clock to the instant's UTC parts yields the zone offset without any
// timezone library.

function zoneOffsetMinutes(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return (asUtc - at.getTime()) / 60000;
}

export function dayWindowUtc(dateStr: string, tz: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  // First guess: local midnight == UTC midnight, then correct by the real offset.
  const guess = new Date(Date.UTC(y, m - 1, d));
  const start = new Date(guess.getTime() - zoneOffsetMinutes(guess, tz) * 60000);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
}

export function localHours(at: Date, tz: string): number {
  const offset = zoneOffsetMinutes(at, tz);
  const local = new Date(at.getTime() + offset * 60000);
  return local.getUTCHours() + local.getUTCMinutes() / 60 + local.getUTCSeconds() / 3600;
}

export function localDateStr(at: Date, tz: string): string {
  return at.toLocaleDateString("en-CA", { timeZone: tz });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/ledger/time.test.ts` — Expected: 5 passed.

- [ ] **Step 6: Commit and push**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/ledger/time.ts tests/ledger/time.test.ts
git commit -m "feat(ledger): add vitest and timezone day-window helpers"
git push origin main
```

---

### Task 2: Partial-data recovery scoring

**Why:** `calculateRecovery` currently returns `null` unless ALL five components have data (`src/lib/utils/recovery-scoring.ts:536-553`). With the real database (sparse HRV, no RHR most nights) that means the verdict numeral would read "unprinted" forever. Weighted partial scoring with renormalized weights is the standard fix: score what you can see, report how much you saw.

**Files:**
- Modify: `src/lib/utils/recovery-scoring.ts:515-600` (`calculateRecovery` + `RecoveryResult` type)
- Test: `tests/ledger/recovery-partial.test.ts`

**Interfaces:**
- Consumes: existing `RecoveryInputs`, `RECOVERY_WEIGHTS`, per-component scorers (unchanged).
- Produces: `RecoveryResult` gains `confidence: number` (0–1, sum of weights of components that had data) and `basis: string[]` (human names of components used, e.g. `["sleep quality", "prior strain"]`). `recoveryScore` is non-null whenever `confidence >= 0.5`. Existing fields keep their names — the API route and any old page keep compiling.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ledger/recovery-partial.test.ts
import { describe, it, expect } from "vitest";
import { calculateRecovery } from "@/lib/utils/recovery-scoring";

const noBaseline = null;

describe("calculateRecovery partial scoring", () => {
  it("produces a score from sleep + strain alone (confidence 0.5)", () => {
    const r = calculateRecovery({
      sleepScore: 80, hrvValue: null, restingHr: null,
      previousDayStrain: 5, bedtimeMinutes: null, baseline: noBaseline,
    });
    expect(r.recoveryScore).not.toBeNull();
    expect(r.confidence).toBeCloseTo(0.5, 5); // sleep .35 + strain .15
    expect(r.basis).toContain("sleep quality");
    expect(r.basis).toContain("prior strain");
    expect(r.hasEnoughData).toBe(true);
  });

  it("renormalizes weights: sleep 80 + strain-score contribution averages correctly", () => {
    const r = calculateRecovery({
      sleepScore: 80, hrvValue: null, restingHr: null,
      previousDayStrain: 0, bedtimeMinutes: null, baseline: noBaseline,
    });
    // strain 0 scores 100 (rest day); expected = (80*.35 + 100*.15)/0.5 = 86
    expect(r.recoveryScore).toBe(86);
  });

  it("returns null below the confidence floor (strain alone = 0.15)", () => {
    const r = calculateRecovery({
      sleepScore: null, hrvValue: null, restingHr: null,
      previousDayStrain: 5, bedtimeMinutes: null, baseline: noBaseline,
    });
    expect(r.recoveryScore).toBeNull();
    expect(r.category).toBe("insufficient_data");
    expect(r.hasEnoughData).toBe(false);
  });

  it("full data still matches the old all-components math", () => {
    const r = calculateRecovery({
      sleepScore: 80, hrvValue: 52, restingHr: 58,
      previousDayStrain: 5, bedtimeMinutes: 23 * 60,
      baseline: {
        hrvAvg: 50, hrvStdDev: 5, restingHrAvg: 60, restingHrStdDev: 3,
        avgBedtimeMinutes: 23 * 60, dataPoints: 14,
      },
    });
    expect(r.confidence).toBeCloseTo(1, 5);
    expect(r.recoveryScore).toBeGreaterThan(0);
  });
});
```

(If `RecoveryBaseline`'s exact field names differ from the literal above, copy them from the type declaration at the top of `recovery-scoring.ts` — the test must construct a valid baseline, not a cast.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ledger/recovery-partial.test.ts`
Expected: FAIL — `confidence` does not exist / score is null.

- [ ] **Step 3: Implement**

In `RecoveryResult` (type near top of file) add:

```ts
  /** Sum of the weights of components that had data, 0–1. 1 = fully informed verdict. */
  confidence: number;
  /** Human names of the components the score was computed from. */
  basis: string[];
```

Replace the all-or-nothing block (`recovery-scoring.ts:535-562`) with:

```ts
  const MIN_CONFIDENCE = 0.5; // must see at least half the weighted picture

  const entries: { name: string; score: number | null; weight: number; hasData: boolean }[] = [
    { name: "sleep quality",     score: sleepQualityResult.score,     weight: RECOVERY_WEIGHTS.sleepQuality,     hasData: sleepQualityResult.hasData },
    { name: "hrv",               score: hrvResult.score,              weight: RECOVERY_WEIGHTS.hrvStatus,        hasData: hrvResult.hasData },
    { name: "resting heart rate",score: restingHrResult.score,        weight: RECOVERY_WEIGHTS.restingHrStatus,  hasData: restingHrResult.hasData },
    { name: "prior strain",      score: strainImpactResult.score,     weight: RECOVERY_WEIGHTS.strainImpact,     hasData: strainImpactResult.hasData },
    { name: "sleep consistency", score: sleepConsistencyResult.score, weight: RECOVERY_WEIGHTS.sleepConsistency, hasData: sleepConsistencyResult.hasData },
  ];

  const present = entries.filter(e => e.hasData && e.score !== null);
  const confidence = present.reduce((s, e) => s + e.weight, 0);
  const basis = present.map(e => e.name);

  if (confidence < MIN_CONFIDENCE) {
    return {
      recoveryScore: null,
      category: "insufficient_data",
      components,
      recommendation: "There is not enough data to calculate the recovery score.",
      trainingRecommendation: "Wear your device tonight to track sleep, HRV, and heart rate.",
      hasEnoughData: false,
      confidence,
      basis,
    };
  }

  // Renormalize: weighted mean over the components we actually saw.
  const recoveryScore = Math.round(
    present.reduce((s, e) => s + e.score! * e.weight, 0) / confidence
  );
```

…and thread `confidence, basis` into the final full-data return object as well. The two early-return objects and the final return must all carry the new fields (TypeScript will enforce this once the type changes).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ledger/recovery-partial.test.ts` — Expected: 4 passed.
Also run: `npx tsc --noEmit` — Expected: 0 errors (proves the API route still compiles against the widened type).

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/utils/recovery-scoring.ts tests/ledger/recovery-partial.test.ts
git commit -m "fix(scoring): partial-data recovery with renormalized weights and confidence"
git push origin main
```

---

### Task 3: Fix strain window + HRV/RHR night fallback in the recovery route

**Why (three bugs, all in `src/app/api/recovery/route.ts`):**
1. Line 79 computes `yesterdayEnd` and never uses it — the workouts query (line 81-90) has only `gte(startedAt, yesterdayStart)`, so **today's workouts leak into "yesterday's strain" and lower today's recovery**.
2. Lines 118-119 read HRV/RHR only from `sleep_sessions` — which the webhook never fills (`processor.ts:152` hardcodes `hrvAvg: null`). The `health_metrics` rows that DO exist (11 HRV samples) are ignored.
3. Line 250-252 computes readiness as `(recovery + sleep)/2` — sleep is already 35% of recovery, so it's double-counted. Remove the field.
Also: line 154 reads `metricsByType["resting_hr"]` but the stored type is `resting_heart_rate` — the trend is always 0. Fix the key.

**Files:**
- Create: `src/lib/ledger/night-metrics.ts`
- Modify: `src/app/api/recovery/route.ts:75-90, 116-125, 148-156, 249-265`
- Test: `tests/ledger/night-metrics.test.ts`

**Interfaces:**
- Produces: `pickNightMetric(samples: { value: number; recordedAt: Date }[], nightStart: Date, nightEnd: Date): number | null` — latest sample inside the night window, else null. Task 5 reuses it.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ledger/night-metrics.test.ts
import { describe, it, expect } from "vitest";
import { pickNightMetric } from "@/lib/ledger/night-metrics";

const at = (iso: string) => new Date(iso);
const night = { start: at("2026-08-13T14:00:00Z"), end: at("2026-08-14T04:00:00Z") }; // 22:00–12:00 SGT

describe("pickNightMetric", () => {
  it("returns the latest sample inside the window", () => {
    const v = pickNightMetric(
      [
        { value: 48, recordedAt: at("2026-08-13T18:00:00Z") },
        { value: 52, recordedAt: at("2026-08-13T22:30:00Z") },
        { value: 40, recordedAt: at("2026-08-12T22:00:00Z") }, // previous night — excluded
      ],
      night.start, night.end,
    );
    expect(v).toBe(52);
  });
  it("returns null when nothing falls inside the window", () => {
    expect(pickNightMetric([{ value: 44, recordedAt: at("2026-08-10T00:00:00Z") }], night.start, night.end)).toBeNull();
  });
  it("returns null for an empty list", () => {
    expect(pickNightMetric([], night.start, night.end)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ledger/night-metrics.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement the picker**

```ts
// src/lib/ledger/night-metrics.ts
export interface MetricSample {
  value: number;
  recordedAt: Date;
}

/**
 * Latest sample recorded inside [nightStart, nightEnd). Recovery wants the
 * measurement from the actual recovery period (last night), not a stale
 * reading from three days ago — hence a window, not "most recent ever".
 */
export function pickNightMetric(
  samples: MetricSample[],
  nightStart: Date,
  nightEnd: Date,
): number | null {
  let best: MetricSample | null = null;
  for (const s of samples) {
    if (s.recordedAt < nightStart || s.recordedAt >= nightEnd) continue;
    if (!best || s.recordedAt > best.recordedAt) best = s;
  }
  return best ? best.value : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ledger/night-metrics.test.ts` — Expected: 3 passed.

- [ ] **Step 5: Fix the route**

In `src/app/api/recovery/route.ts`:

a) Strain window — add `lt` to the drizzle import and bound the query; delete the dead variable:

```ts
    // Yesterday = [yesterdayStart, todayStart) in the user's timezone.
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const yesterdayWorkouts = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, user.id),
          gte(workouts.startedAt, yesterdayStart),
          lt(workouts.startedAt, todayStart)
        )
      )
      .limit(10);
```

b) HRV/RHR fallback — replace lines 116-119 with a night-window fallback (night = 20:00 yesterday → 12:00 today, user tz):

```ts
    const nightStart = new Date(yesterdayStart.getTime() + 20 * 3600 * 1000);
    const nightEnd = new Date(todayStart.getTime() + 12 * 3600 * 1000);

    const toSamples = (type: string) =>
      recentMetrics
        .filter((m) => m.metricType === type)
        .map((m) => ({ value: Number(m.value), recordedAt: m.recordedAt }));

    const currentHrv =
      todaySleep?.hrvAvg ?? pickNightMetric(toSamples("hrv"), nightStart, nightEnd);
    const currentRestingHr =
      todaySleep?.restingHr ??
      pickNightMetric(toSamples("resting_heart_rate"), nightStart, nightEnd);
```

with `import { pickNightMetric } from "@/lib/ledger/night-metrics";` added at the top.

c) Trend key — line 154: `metricsByType["resting_hr"]` → `metricsByType["resting_heart_rate"]`.

d) Readiness — delete the `readinessScore` computation (lines 249-252) and the `readinessScore` field from the `today` response object. The verdict IS recovery; grep the repo for `readinessScore` consumers first and update any old page that renders it to show `recoveryScore` instead (expected consumer: `src/app/(dashboard)/recovery/page.tsx` or `page.tsx` — check with `grep -rn "readinessScore" src/`).

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — 0 errors.
Run: `npx vitest run` — all suites pass.
Run: `grep -rn "readinessScore\|yesterdayEnd" src/` — no hits left in route (schema column `readiness_score` may remain; it just stops being written).

- [ ] **Step 7: Commit and push**

```bash
git add src/lib/ledger/night-metrics.ts tests/ledger/night-metrics.test.ts src/app/api/recovery/route.ts
git commit -m "fix(recovery): bound yesterday strain window, night HRV/RHR fallback, drop double-counted readiness"
git push origin main
```

---

### Task 4: Track builders (pure)

**Files:**
- Create: `src/lib/ledger/types.ts`
- Create: `src/lib/ledger/tracks.ts`
- Test: `tests/ledger/tracks.test.ts`

**Interfaces (produced — Task 5 and all UI consume these exact shapes):**

```ts
// src/lib/ledger/types.ts  (write this file verbatim in this task)
export interface TrackPoint { t: number; v: number }            // t = local hours 0–24
export type SleepStage = "deep" | "core" | "rem" | "awake";
export interface SleepSegment { from: number; to: number; stage: SleepStage } // local hours
export interface MealMark { t: number; kcal: number; label: string }

export interface HeartTrack { points: TrackPoint[]; rest: number | null; peak: number | null }
export interface SleepTrack {
  segments: SleepSegment[]; bedtimeLocal: string; wakeLocal: string;
  totalMin: number; deepMin: number; remMin: number;
  efficiency: number | null; score: number | null;
}
export interface FuelTrack { meals: MealMark[]; kcal: number; proteinG: number; fibreG: number }
export interface StepsTrack { hourly: number[]; total: number; peakHour: number | null }

export interface VerdictChips {
  hrv: { value: number | null; delta: number | null };
  rhr: { value: number | null; delta: number | null };
  sleepScore: number | null;
  strain: { value: number; level: "low" | "moderate" | "high" };
}

export interface DayLedger {
  date: string; tz: string; isToday: boolean;
  reportNo: number;
  watch: { lastSyncedAt: Date | null; syncedToday: boolean };
  verdict: {
    recovery: number | null;
    band: "recovered" | "moderate" | "rest" | "unprinted";
    headline: string; sentence: string;
    confidence: number; basis: string[];
    chips: VerdictChips;
  };
  tracks: {
    heart: HeartTrack | null;
    sleep: SleepTrack | null;
    fuel: FuelTrack | null;
    steps: StepsTrack | null;
  };
  week: {
    days: { date: string; label: string; recovery: number | null; printed: boolean; isToday: boolean }[];
    bestRecovery: { score: number; date: string } | null;
  };
}
```

```ts
// tracks.ts signatures
buildStepsTrack(samples: MetricSample[], dayStart: Date, tz: string): StepsTrack | null
buildHeartTrack(samples: MetricSample[], tz: string, restingHr: number | null): HeartTrack | null
buildFuelTrack(logs: { mealType: string; calories: string; proteinG: string; fiberG: string | null; createdAt: Date }[], tz: string): FuelTrack | null
buildSleepSegments(session: { bedtime: Date; wakeTime: Date; deepSleepMinutes: number | null; remSleepMinutes: number | null; lightSleepMinutes: number | null; awakeMinutes: number | null } , tz: string): SleepSegment[]
```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ledger/tracks.test.ts
import { describe, it, expect } from "vitest";
import { buildStepsTrack, buildFuelTrack, buildHeartTrack } from "@/lib/ledger/tracks";

const TZ = "Asia/Singapore";
const at = (iso: string) => new Date(iso);
const dayStart = at("2026-08-13T16:00:00Z"); // 2026-08-14 00:00 SGT

describe("buildStepsTrack", () => {
  it("bins minute samples into 24 local-hour buckets", () => {
    const t = buildStepsTrack(
      [
        { value: 100, recordedAt: at("2026-08-13T23:10:00Z") }, // 07:10 SGT → hour 7
        { value: 50,  recordedAt: at("2026-08-13T23:40:00Z") }, // 07:40 SGT → hour 7
        { value: 200, recordedAt: at("2026-08-14T10:05:00Z") }, // 18:05 SGT → hour 18
      ],
      dayStart, TZ,
    )!;
    expect(t.hourly).toHaveLength(24);
    expect(t.hourly[7]).toBe(150);
    expect(t.hourly[18]).toBe(200);
    expect(t.total).toBe(350);
    expect(t.peakHour).toBe(18);
  });
  it("returns null for no samples", () => {
    expect(buildStepsTrack([], dayStart, TZ)).toBeNull();
  });
});

describe("buildFuelTrack", () => {
  it("groups logs by mealType, positions at median createdAt, sums macros", () => {
    const t = buildFuelTrack(
      [
        { mealType: "breakfast", calories: "300", proteinG: "20", fiberG: "3", createdAt: at("2026-08-14T00:10:00Z") }, // 08:10 SGT
        { mealType: "breakfast", calories: "110", proteinG: "6",  fiberG: "1", createdAt: at("2026-08-14T00:20:00Z") },
        { mealType: "lunch",     calories: "642", proteinG: "30", fiberG: "8", createdAt: at("2026-08-14T04:40:00Z") }, // 12:40 SGT
      ],
      TZ,
    )!;
    expect(t.meals).toHaveLength(2);
    expect(t.meals[0].kcal).toBe(410);
    expect(t.meals[0].t).toBeGreaterThan(8); expect(t.meals[0].t).toBeLessThan(8.5);
    expect(t.kcal).toBe(1052);
    expect(t.proteinG).toBe(56);
    expect(t.fibreG).toBe(12);
  });
});

describe("buildHeartTrack", () => {
  it("downsamples to 10-minute mean bins and reports peak", () => {
    const samples = [];
    for (let i = 0; i < 30; i++) {
      samples.push({ value: 60 + (i === 15 ? 80 : 0), recordedAt: new Date(dayStart.getTime() + i * 60000) });
    }
    const t = buildHeartTrack(samples, TZ, 58)!;
    expect(t.peak).toBe(140);
    expect(t.rest).toBe(58);
    expect(t.points.length).toBeLessThanOrEqual(3 + 1);
    expect(t.points.every(p => p.t >= 0 && p.t < 24)).toBe(true);
  });
  it("returns null with no samples", () => {
    expect(buildHeartTrack([], TZ, 58)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ledger/tracks.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `types.ts` (verbatim block above) and `tracks.ts`**

```ts
// src/lib/ledger/tracks.ts
import { localHours } from "./time";
import type { MetricSample } from "./night-metrics";
import type { HeartTrack, SleepTrack, FuelTrack, StepsTrack, SleepSegment, MealMark, TrackPoint } from "./types";

export function buildStepsTrack(
  samples: MetricSample[], dayStart: Date, tz: string,
): StepsTrack | null {
  if (samples.length === 0) return null;
  const hourly = new Array<number>(24).fill(0);
  for (const s of samples) {
    const h = Math.floor(localHours(s.recordedAt, tz));
    if (h >= 0 && h < 24) hourly[h] += s.value;
  }
  const rounded = hourly.map((v) => Math.round(v));
  const total = rounded.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  let peakHour: number | null = null;
  for (let h = 0; h < 24; h++) {
    if (peakHour === null || rounded[h] > rounded[peakHour]) peakHour = h;
  }
  return { hourly: rounded, total, peakHour };
}

export function buildHeartTrack(
  samples: MetricSample[], tz: string, restingHr: number | null,
): HeartTrack | null {
  if (samples.length === 0) return null;
  // 10-minute mean bins keep the polyline under 144 points.
  const bins = new Map<number, { sum: number; n: number }>();
  let peak = 0;
  for (const s of samples) {
    const t = localHours(s.recordedAt, tz);
    const bin = Math.floor(t * 6); // 6 bins per hour
    const b = bins.get(bin) ?? { sum: 0, n: 0 };
    b.sum += s.value; b.n += 1;
    bins.set(bin, b);
    if (s.value > peak) peak = s.value;
  }
  const points: TrackPoint[] = [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bin, b]) => ({ t: (bin + 0.5) / 6, v: Math.round(b.sum / b.n) }));
  return { points, rest: restingHr, peak: Math.round(peak) };
}

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

export function buildFuelTrack(
  logs: { mealType: string; calories: string; proteinG: string; fiberG: string | null; createdAt: Date }[],
  tz: string,
): FuelTrack | null {
  if (logs.length === 0) return null;
  const byMeal = new Map<string, typeof logs>();
  for (const l of logs) {
    const arr = byMeal.get(l.mealType) ?? [];
    arr.push(l);
    byMeal.set(l.mealType, arr);
  }
  const meals: MealMark[] = [...byMeal.entries()]
    .map(([mealType, rows]) => {
      const times = rows.map((r) => localHours(r.createdAt, tz)).sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      const kcal = Math.round(rows.reduce((s, r) => s + Number(r.calories), 0));
      return { t: median, kcal, label: `${mealType} · ${kcal}` };
    })
    .sort((a, b) => a.t - b.t);
  return {
    meals,
    kcal: Math.round(logs.reduce((s, l) => s + Number(l.calories), 0)),
    proteinG: Math.round(logs.reduce((s, l) => s + Number(l.proteinG), 0)),
    fibreG: Math.round(logs.reduce((s, l) => s + Number(l.fiberG ?? 0), 0)),
  };
}

/**
 * The DB stores stage totals, not stage intervals, so the band is a
 * proportional layout: awake at the edges is unknowable — we render
 * [deep | core | rem] scaled inside [bedtime, wakeTime]. Honest enough for a
 * 40px-tall band; exact hypnogram arrives if we ever store stage intervals.
 */
export function buildSleepSegments(
  s: { bedtime: Date; wakeTime: Date; deepSleepMinutes: number | null; remSleepMinutes: number | null; lightSleepMinutes: number | null; awakeMinutes: number | null },
  tz: string,
): SleepSegment[] {
  const from = localHours(s.bedtime, tz);
  let to = localHours(s.wakeTime, tz);
  if (to <= from) to += 24; // crosses midnight — caller clamps for display
  const span = to - from;
  const parts: { stage: SleepSegment["stage"]; min: number }[] = [
    { stage: "deep", min: s.deepSleepMinutes ?? 0 },
    { stage: "core", min: s.lightSleepMinutes ?? 0 },
    { stage: "rem",  min: s.remSleepMinutes ?? 0 },
    { stage: "awake", min: s.awakeMinutes ?? 0 },
  ].filter((p) => p.min > 0);
  const totalMin = parts.reduce((a, p) => a + p.min, 0);
  if (totalMin === 0) return [{ from, to, stage: "core" }];
  const segments: SleepSegment[] = [];
  let cursor = from;
  for (const p of parts) {
    const width = (p.min / totalMin) * span;
    segments.push({ from: cursor, to: cursor + width, stage: p.stage });
    cursor += width;
  }
  return segments;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ledger/tracks.test.ts` — Expected: 5 passed. Then `npx tsc --noEmit` — 0 errors.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/ledger/types.ts src/lib/ledger/tracks.ts tests/ledger/tracks.test.ts
git commit -m "feat(ledger): pure track builders — steps bins, heart downsample, fuel meals, sleep segments"
git push origin main
```

---

### Task 5: Verdict copy + `getDayLedger` assembly

**Files:**
- Create: `src/lib/ledger/copy.ts`
- Create: `src/lib/ledger/assemble.ts`
- Test: `tests/ledger/copy.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4; drizzle tables from `@/lib/db`; `calculateRecovery`, `calculateRecoveryBaseline`, `calculateDailyStrain` from recovery-scoring; `getUserTimezone` from timezone utils.
- Produces:
  - `verdictCopy(input: { recovery: number | null; confidence: number; basis: string[]; deepMin: number | null; strain: number; sleepScore: number | null }): { band: DayLedger["verdict"]["band"]; headline: string; sentence: string }`
  - `getDayLedger(userId: string, dateStr: string, user: { settings: unknown; dateOfBirth: string | null }): Promise<DayLedger>` — the ONLY function pages call.

- [ ] **Step 1: Write the failing copy tests**

```ts
// tests/ledger/copy.test.ts
import { describe, it, expect } from "vitest";
import { verdictCopy } from "@/lib/ledger/copy";

describe("verdictCopy", () => {
  it("recovered band at >= 70", () => {
    const c = verdictCopy({ recovery: 78, confidence: 1, basis: ["sleep quality"], deepMin: 94, strain: 5, sleepScore: 80 });
    expect(c.band).toBe("recovered");
    expect(c.headline).toMatch(/train hard/i);
    expect(c.sentence.length).toBeGreaterThan(20);
  });
  it("moderate band 50-69", () => {
    expect(verdictCopy({ recovery: 55, confidence: 1, basis: [], deepMin: 40, strain: 10, sleepScore: 60 }).band).toBe("moderate");
  });
  it("rest band < 50", () => {
    expect(verdictCopy({ recovery: 30, confidence: 0.6, basis: [], deepMin: 20, strain: 18, sleepScore: 40 }).band).toBe("rest");
  });
  it("unprinted when recovery is null, and says why", () => {
    const c = verdictCopy({ recovery: null, confidence: 0.15, basis: ["prior strain"], deepMin: null, strain: 3, sleepScore: null });
    expect(c.band).toBe("unprinted");
    expect(c.sentence).toMatch(/sleep|watch|signal/i);
  });
  it("partial verdict names its basis", () => {
    const c = verdictCopy({ recovery: 72, confidence: 0.5, basis: ["sleep quality", "prior strain"], deepMin: 90, strain: 4, sleepScore: 82 });
    expect(c.sentence).toMatch(/sleep quality/);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/ledger/copy.test.ts` → FAIL.

- [ ] **Step 3: Implement `copy.ts`**

```ts
// src/lib/ledger/copy.ts
// Deterministic verdict copy. An LLM edition can replace this later; the UI
// only depends on the shape, not on how the words are chosen.
import type { DayLedger } from "./types";

export interface CopyInput {
  recovery: number | null;
  confidence: number;
  basis: string[];
  deepMin: number | null;
  strain: number;
  sleepScore: number | null;
}

export function verdictCopy(i: CopyInput): {
  band: DayLedger["verdict"]["band"]; headline: string; sentence: string;
} {
  if (i.recovery === null) {
    return {
      band: "unprinted",
      headline: "Unprinted — not enough signal",
      sentence:
        "The ledger needs at least last night's sleep to print a verdict. Wear the watch tonight and this space fills itself.",
    };
  }
  const partial = i.confidence < 0.95
    ? ` Printed from ${i.basis.join(" + ")} only — more sensors, sharper verdict.`
    : "";
  if (i.recovery >= 70) {
    const deep = i.deepMin !== null && i.deepMin >= 60
      ? `Deep sleep did the work: ${Math.floor(i.deepMin / 60)} h ${i.deepMin % 60} m.`
      : "The night added up.";
    return {
      band: "recovered",
      headline: "Recovered — train hard",
      sentence: `${deep} Strain budget is open — spend it, then protect the bedtime.${partial}`,
    };
  }
  if (i.recovery >= 50) {
    return {
      band: "moderate",
      headline: "Moderate — keep something in reserve",
      sentence: `Not a red flag, not a green light. Train, but leave a rep in the tank; yesterday's strain of ${i.strain.toFixed(1)} is still in your legs.${partial}`,
    };
  }
  return {
    band: "rest",
    headline: "Run down — make today easy",
    sentence: `The body is asking for an easy one${i.sleepScore !== null ? ` — sleep scored ${i.sleepScore}` : ""}. Walk, stretch, eat well, sleep early.${partial}`,
  };
}
```

- [ ] **Step 4: Run copy tests** — `npx vitest run tests/ledger/copy.test.ts` → 5 passed.

- [ ] **Step 5: Implement `assemble.ts`**

```ts
// src/lib/ledger/assemble.ts
import { and, asc, desc, eq, gte, lt, sql as dsql } from "drizzle-orm";
import { db, dailyScores, foodLogs, healthMetrics, sleepSessions, users, workouts } from "@/lib/db";
import {
  calculateDailyStrain, calculateRecovery, calculateRecoveryBaseline,
  type RecoveryBaseline, type WorkoutData,
} from "@/lib/utils/recovery-scoring";
import { getUserTimezone } from "@/lib/utils/timezone";
import { dayWindowUtc, localDateStr, localHours } from "./time";
import { pickNightMetric, type MetricSample } from "./night-metrics";
import { buildFuelTrack, buildHeartTrack, buildSleepSegments, buildStepsTrack } from "./tracks";
import { verdictCopy } from "./copy";
import type { DayLedger, SleepTrack, VerdictChips } from "./types";

export async function getDayLedger(
  userId: string,
  dateStr: string,
  user: { settings: unknown; dateOfBirth: string | null },
): Promise<DayLedger> {
  const tz = getUserTimezone(user.settings);
  const { start: dayStart, end: dayEnd } = dayWindowUtc(dateStr, tz);
  const todayStr = localDateStr(new Date(), tz);
  const isToday = dateStr === todayStr;

  const prevDate = new Date(dayStart.getTime() - 12 * 3600 * 1000);
  const prevDateStr = localDateStr(prevDate, tz);
  const { start: prevStart } = dayWindowUtc(prevDateStr, tz);

  // ---- queries (all bounded to what the page needs) ----
  const [dayMetrics, nightSleep, prevWorkouts, baselineSleeps, dayFood, weekScores, firstMetric] =
    await Promise.all([
      db.select().from(healthMetrics).where(and(
        eq(healthMetrics.userId, userId),
        gte(healthMetrics.recordedAt, new Date(dayStart.getTime() - 6 * 3600 * 1000)), // pull evening-before for night HRV
        lt(healthMetrics.recordedAt, dayEnd),
      )).orderBy(asc(healthMetrics.recordedAt)),
      db.select().from(sleepSessions).where(and(
        eq(sleepSessions.userId, userId),
        eq(sleepSessions.sleepDate, prevDateStr), // last night belongs to yesterday's date
      )).limit(1),
      db.select().from(workouts).where(and(
        eq(workouts.userId, userId),
        gte(workouts.startedAt, prevStart),
        lt(workouts.startedAt, dayStart),
      )).limit(10),
      db.select().from(sleepSessions).where(and(
        eq(sleepSessions.userId, userId),
        gte(sleepSessions.sleepDate, localDateStr(new Date(dayStart.getTime() - 14 * 86400 * 1000), tz)),
      )).orderBy(desc(sleepSessions.sleepDate)).limit(14),
      db.select().from(foodLogs).where(and(
        eq(foodLogs.userId, userId),
        eq(foodLogs.loggedDate, dateStr),
      )).orderBy(asc(foodLogs.createdAt)),
      db.select().from(dailyScores).where(and(
        eq(dailyScores.userId, userId),
        gte(dailyScores.date, localDateStr(new Date(dayStart.getTime() - 6 * 86400 * 1000), tz)),
      )),
      db.select({ min: dsql<string>`min(${healthMetrics.recordedAt})` }).from(healthMetrics)
        .where(eq(healthMetrics.userId, userId)),
    ]);

  const samplesOf = (type: string): MetricSample[] =>
    dayMetrics.filter((m) => m.metricType === type)
      .map((m) => ({ value: Number(m.value), recordedAt: m.recordedAt }));

  // ---- scoring inputs (same fixes as the API route) ----
  const sleep = nightSleep[0] ?? null;
  const nightStart = new Date(dayStart.getTime() - 4 * 3600 * 1000); // 20:00 local yesterday
  const nightEnd = new Date(dayStart.getTime() + 12 * 3600 * 1000);
  const hrvNow = sleep?.hrvAvg ?? pickNightMetric(samplesOf("hrv"), nightStart, nightEnd);
  const rhrNow = sleep?.restingHr ?? pickNightMetric(samplesOf("resting_heart_rate"), nightStart, nightEnd);

  const userAge = user.dateOfBirth
    ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 86400 * 1000))
    : undefined;
  const strain = calculateDailyStrain(
    prevWorkouts.map((w): WorkoutData => ({
      durationMinutes: w.durationMinutes, heartRateAvg: w.heartRateAvg,
      heartRateMax: w.heartRateMax, type: w.type, caloriesBurned: w.caloriesBurned,
    })),
    { age: userAge },
  );
  const baseline: RecoveryBaseline | null = calculateRecoveryBaseline(
    baselineSleeps.map((s) => ({
      hrvAvg: s.hrvAvg, restingHr: s.restingHr,
      bedtimeMinutes: s.bedtime ? new Date(s.bedtime).getHours() * 60 + new Date(s.bedtime).getMinutes() : null,
    })),
  );
  const recovery = calculateRecovery({
    sleepScore: sleep?.sleepScore ?? null,
    hrvValue: hrvNow, restingHr: rhrNow,
    previousDayStrain: strain.strainScore,
    bedtimeMinutes: sleep?.bedtime
      ? new Date(sleep.bedtime).getHours() * 60 + new Date(sleep.bedtime).getMinutes()
      : null,
    baseline,
  });

  // ---- tracks ----
  const heart = buildHeartTrack(samplesOf("heart_rate"), tz, rhrNow);
  const steps = buildStepsTrack(samplesOf("steps"), dayStart, tz);
  const fuel = buildFuelTrack(dayFood.map((f) => ({
    mealType: f.mealType, calories: f.calories, proteinG: f.proteinG,
    fiberG: f.fiberG, createdAt: f.createdAt,
  })), tz);
  const sleepTrack: SleepTrack | null = sleep ? {
    segments: buildSleepSegments(sleep, tz),
    bedtimeLocal: sleep.bedtime.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }),
    wakeLocal: sleep.wakeTime.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }),
    totalMin: sleep.totalMinutes, deepMin: sleep.deepSleepMinutes ?? 0, remMin: sleep.remSleepMinutes ?? 0,
    efficiency: sleep.efficiency ? Number(sleep.efficiency) : null,
    score: sleep.sleepScore,
  } : null;

  // ---- verdict ----
  const copy = verdictCopy({
    recovery: recovery.recoveryScore, confidence: recovery.confidence, basis: recovery.basis,
    deepMin: sleep?.deepSleepMinutes ?? null, strain: strain.strainScore,
    sleepScore: sleep?.sleepScore ?? null,
  });
  const chips: VerdictChips = {
    hrv: { value: hrvNow, delta: hrvNow !== null && baseline ? Math.round(hrvNow - baseline.hrvAvg) : null },
    rhr: { value: rhrNow, delta: rhrNow !== null && baseline ? Math.round(rhrNow - baseline.restingHrAvg) : null },
    sleepScore: sleep?.sleepScore ?? null,
    strain: {
      value: strain.strainScore,
      level: strain.strainScore >= 14 ? "high" : strain.strainScore >= 8 ? "moderate" : "low",
    },
  };

  // ---- week strip ----
  const weekDays = [...Array(7)].map((_, i) => {
    const d = new Date(dayStart.getTime() + (i - 6 + 3) * 86400 * 1000); // Mon-anchored below
    return d;
  });
  // Simpler and correct: last Monday through Sunday containing dateStr
  const dow = (new Date(dayStart.getTime() + 12 * 3600 * 1000).getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(dayStart.getTime() - dow * 86400 * 1000);
  const week = [...Array(7)].map((_, i) => {
    const d = localDateStr(new Date(monday.getTime() + i * 86400 * 1000 + 12 * 3600 * 1000), tz);
    const row = weekScores.find((s) => s.date === d);
    return {
      date: d,
      label: "MTWTFSS"[i],
      recovery: row?.recoveryScore != null ? Math.round(Number(row.recoveryScore)) : null,
      printed: row != null,
      isToday: d === todayStr,
    };
  });
  const best = weekScores
    .filter((s) => s.recoveryScore != null)
    .sort((a, b) => Number(b.recoveryScore) - Number(a.recoveryScore))[0] ?? null;

  // ---- cache closed days ----
  if (!isToday && recovery.recoveryScore !== null) {
    await db.insert(dailyScores).values({
      userId, date: dateStr,
      recoveryScore: String(recovery.recoveryScore),
      sleepScore: sleep?.sleepScore != null ? String(sleep.sleepScore) : null,
      strainScore: String(strain.strainScore),
      components: { confidence: recovery.confidence, basis: recovery.basis },
    }).onConflictDoNothing();
  }

  const lastSample = dayMetrics[dayMetrics.length - 1] ?? null;
  const reportNo = firstMetric[0]?.min
    ? Math.floor((dayStart.getTime() - new Date(firstMetric[0].min).getTime()) / 86400000) + 1
    : 1;

  return {
    date: dateStr, tz, isToday, reportNo,
    watch: {
      lastSyncedAt: lastSample?.recordedAt ?? null,
      syncedToday: lastSample !== null && localDateStr(lastSample.recordedAt, tz) === dateStr,
    },
    verdict: {
      recovery: recovery.recoveryScore, band: copy.band,
      headline: copy.headline, sentence: copy.sentence,
      confidence: recovery.confidence, basis: recovery.basis, chips,
    },
    tracks: { heart, sleep: sleepTrack, fuel, steps },
    week: {
      days: week,
      bestRecovery: best ? { score: Math.round(Number(best.recoveryScore)), date: best.date } : null,
    },
  };
}
```

Delete the leftover `weekDays` scratch variable before committing (only the Monday-anchored block ships). If `RecoveryBaseline` uses different field names than `hrvAvg`/`restingHrAvg`, use the real ones (open the type — do not guess).

- [ ] **Step 6: Smoke-test against the real DB**

Create `scripts/ledger-smoke.mts` (kept in repo — it's the standing way to eyeball the assembly):

```ts
import { config } from "dotenv";
config({ path: ".env.local" });
const { db, users } = await import("../src/lib/db/index.js");
const { getDayLedger } = await import("../src/lib/ledger/assemble.js");
const user = (await db.select().from(users).limit(1))[0];
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
const ledger = await getDayLedger(user.id, today, { settings: user.settings, dateOfBirth: user.dateOfBirth });
console.log(JSON.stringify({ ...ledger, tracks: {
  heart: ledger.tracks.heart ? `${ledger.tracks.heart.points.length} pts` : null,
  sleep: ledger.tracks.sleep ? `${ledger.tracks.sleep.totalMin} min` : null,
  fuel: ledger.tracks.fuel ? `${ledger.tracks.fuel.kcal} kcal` : null,
  steps: ledger.tracks.steps ? `${ledger.tracks.steps.total} steps` : null,
} }, null, 2));
process.exit(0);
```

Run: `npx tsx scripts/ledger-smoke.mts`
Expected with current data: steps non-null with a real total; heart/sleep null; fuel null or real; verdict band `"unprinted"` with a sentence naming sleep — **no throw**.

- [ ] **Step 7: Full verify, commit, push**

```bash
npx vitest run && npx tsc --noEmit
git add src/lib/ledger/copy.ts src/lib/ledger/assemble.ts tests/ledger/copy.test.ts scripts/ledger-smoke.mts
git commit -m "feat(ledger): verdict copy templates and getDayLedger assembly with daily_scores cache"
git push origin main
```

---

### Task 6: Gallery tokens + layout without sidebar + Masthead

**Files:**
- Modify: `src/app/globals.css` (append ledger tokens)
- Modify: `src/app/(dashboard)/layout.tsx`
- Create: `src/components/ledger/masthead.tsx`, `src/components/ledger/local-clock.tsx`
- Delete: `src/components/dashboard/sidebar.tsx`, `src/components/dashboard/header.tsx` (verify first: `grep -rln "dashboard/sidebar\|dashboard/header" src/` must list only the layout)

**Interfaces:**
- Produces: `<Masthead date={string} tz={string} reportNo={number} watch={DayLedger["watch"]} active={"today" | "almanac" | "blood"} />`; CSS classes/vars `--lg-paper`, `--lg-ink`, `--lg-mut`, `--lg-rule`, `--lg-acc`, `--lg-g2`, `--lg-g3`, `--lg-chipbg`, `--lg-chiptx`, `--lg-up`.

- [ ] **Step 1: Append tokens to `globals.css`**

```css
/* ── The Ledger × The Score — Gallery edition ─────────────────────────── */
:root {
  --lg-paper: #fdfdfc; --lg-ink: #131312; --lg-mut: #8a8a86; --lg-rule: #e7e7e3;
  --lg-acc: #d64a2e;  --lg-g2: #6b6b66;  --lg-g3: #d3d3cd;
  --lg-chipbg: #f7f7f5; --lg-chiptx: #4d4d49; --lg-up: #2c6e3f;
  --lg-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --lg-mono: ui-monospace, "SF Mono", Menlo, monospace;
}
.ledger-page { background: var(--lg-paper); color: var(--lg-ink); font-family: var(--lg-sans);
  -webkit-font-smoothing: antialiased; min-height: 100vh; padding: 44px 64px 34px; }
.ledger-page .num { font-variant-numeric: tabular-nums; }
.ledger-k { font-size: 9.5px; letter-spacing: .3em; text-transform: uppercase; color: var(--lg-mut); }
```

(Component-level styles live in the components as Tailwind arbitrary values reading these vars, e.g. `text-[var(--lg-mut)]` — matching the codebase's Tailwind idiom. The two shared classes above exist because they repeat on every page.)

- [ ] **Step 2: Rewrite the dashboard layout**

```tsx
// src/app/(dashboard)/layout.tsx
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <div className="ledger-page">{children}</div>;
}
```

- [ ] **Step 3: Build Masthead + LocalClock**

```tsx
// src/components/ledger/local-clock.tsx
"use client";
import { useEffect, useState } from "react";

export function LocalClock({ tz }: { tz: string }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tz]);
  return <span suppressHydrationWarning>{now ?? ""}</span>;
}
```

```tsx
// src/components/ledger/masthead.tsx
import Link from "next/link";
import { LocalClock } from "./local-clock";
import type { DayLedger } from "@/lib/ledger/types";

const CITY: Record<string, string> = { Asia_Singapore: "Singapore", Asia_Kolkata: "Bengaluru" };

function fmtDate(date: string) {
  const [, m, d] = date.split("-");
  return `${m}.${d}`;
}
function weekday(date: string, tz: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: tz });
}
function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function Masthead({
  date, tz, reportNo, watch, active, isToday,
}: {
  date: string; tz: string; reportNo: number;
  watch: DayLedger["watch"]; active: "today" | "almanac" | "blood"; isToday: boolean;
}) {
  const city = CITY[tz.replace("/", "_")] ?? tz.split("/")[1]?.replace("_", " ") ?? tz;
  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);
  const synced = watch.lastSyncedAt
    ? `⌚ synced ${watch.lastSyncedAt.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" })}`
    : "⌚ no sync yet";
  return (
    <header>
      <div className="flex items-baseline justify-between border-b-2 border-[var(--lg-ink)] pb-4">
        <div className="num text-[74px] font-extralight leading-none">{fmtDate(date)}</div>
        <div className="text-center">
          <div className="text-[13px] font-semibold uppercase tracking-[.44em]">Olympus · Daily Ledger</div>
          <div className="ledger-k mt-1.5">{weekday(date, tz)} — {city} — Report № {reportNo}</div>
        </div>
        <div className="text-right font-[family-name:var(--lg-mono)] text-[11px] leading-[1.9] tracking-[.1em] text-[var(--lg-mut)]">
          <LocalClock tz={tz} /><br />
          <b className="font-semibold text-[var(--lg-ink)]">{synced}</b>
        </div>
      </div>
      <nav className="num flex justify-between pt-2 font-[family-name:var(--lg-mono)] text-[10px] tracking-[.14em] text-[var(--lg-mut)]">
        <Link href={`/day/${prev}`}>← {prev.slice(5).replace("-", ".")}</Link>
        <span>
          <Link href="/" className={active === "today" ? "font-bold text-[var(--lg-acc)]" : undefined}>TODAY</Link>
          {" · "}
          <Link href="/history" className={active === "almanac" ? "font-bold text-[var(--lg-acc)]" : undefined}>ALMANAC</Link>
          {" · "}
          <Link href="/blood-work" className={active === "blood" ? "font-bold text-[var(--lg-acc)]" : undefined}>BLOOD WORK</Link>
        </span>
        {isToday
          ? <span className="text-[var(--lg-g3)]">{next.slice(5).replace("-", ".")} →</span>
          : <Link href={next === new Date().toISOString().slice(0, 10) ? "/" : `/day/${next}`}>{next.slice(5).replace("-", ".")} →</Link>}
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Delete sidebar + header components** (after the grep in the Files note confirms only the old layout imports them), and `rm -rf .next` (route-type cache goes stale on structure changes — known repo gotcha).

- [ ] **Step 5: Verify** — `npx tsc --noEmit && npm run build`. Expected: build succeeds. The old `/` page still renders (unstyled shell without sidebar) — fine until Task 8 replaces it.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "feat(ledger): Gallery tokens, sidebar-free layout, masthead with date nav"
git push origin main
```

---

### Task 7: Verdict band component

**Files:**
- Create: `src/components/ledger/verdict-band.tsx`

**Interfaces:**
- Consumes: `DayLedger["verdict"]`.
- Produces: `<VerdictBand verdict={DayLedger["verdict"]} />`.

- [ ] **Step 1: Implement**

```tsx
// src/components/ledger/verdict-band.tsx
import type { DayLedger } from "@/lib/ledger/types";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="num rounded-full border border-[var(--lg-rule)] bg-[var(--lg-chipbg)] px-[15px] py-1.5 font-[family-name:var(--lg-mono)] text-[11.5px] tracking-[.06em] text-[var(--lg-chiptx)]">
      {children}
    </span>
  );
}
const B = ({ children }: { children: React.ReactNode }) =>
  <b className="font-semibold text-[var(--lg-ink)]">{children}</b>;

export function VerdictBand({ verdict }: { verdict: DayLedger["verdict"] }) {
  const { recovery, headline, sentence, chips } = verdict;
  const delta = (d: number | null, goodWhenNegative = false) => {
    if (d === null || d === 0) return null;
    const good = goodWhenNegative ? d < 0 : d > 0;
    return (
      <span className={good ? "text-[var(--lg-up)]" : "text-[var(--lg-acc)]"}>
        {" "}{d > 0 ? "▲" : "▼"} {d > 0 ? `+${d}` : d}
      </span>
    );
  };
  return (
    <section className="flex items-center gap-11 border-b border-[var(--lg-rule)] py-6">
      <span className="num text-[128px] font-extralight leading-[.92] tracking-[-.02em]">
        {recovery ?? "—"}
      </span>
      <div className="max-w-[460px] border-l-2 border-[var(--lg-acc)] pl-[22px]">
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[.26em] text-[var(--lg-acc)]">
          {headline}
        </div>
        <div className="text-[16px] leading-[1.55]">{sentence}</div>
      </div>
      <div className="num ml-auto flex flex-col items-end gap-[9px]">
        <Chip>
          HRV <B>{chips.hrv.value !== null ? `${chips.hrv.value} ms` : "—"}</B>{delta(chips.hrv.delta)}
          {" · "}RHR <B>{chips.rhr.value ?? "—"}</B>{delta(chips.rhr.delta, true)}
        </Chip>
        <Chip>
          SLEEP <B>{chips.sleepScore ?? "—"}</B>{" · "}STRAIN <B>{chips.strain.value.toFixed(1)}</B>
          {chips.strain.level === "high" && <span className="font-bold text-[var(--lg-acc)]"> HIGH</span>}
        </Chip>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` (component compiles; rendered check happens in Task 8's screenshot).

- [ ] **Step 3: Commit and push**

```bash
git add src/components/ledger/verdict-band.tsx
git commit -m "feat(ledger): verdict band"
git push origin main
```

---

### Task 8: Track rows, SVGs, time axis, now-line — assemble the new `/`

**Files:**
- Create: `src/components/ledger/track-svgs.tsx`, `track-row.tsx`, `time-axis.tsx`, `now-line.tsx`, `week-line.tsx`
- Replace: `src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `DayLedger` from `getDayLedger`; SVG geometry from the approved mockup (viewBox width 1080; heights: heart 84, sleep 40, fuel 50, steps 54; `x(t) = t/24*1080`).
- Produces: `<TrackRow label figures>{svg}</TrackRow>`; `<HeartSvg t={HeartTrack} />`, `<SleepSvg t={SleepTrack} />`, `<FuelSvg t={FuelTrack} />`, `<StepsSvg t={StepsTrack} />` (server components emitting inline `<svg>`); `<NowLine tz={string} />` (client, absolute overlay); `<TimeAxis />`; `<WeekLine week={DayLedger["week"]} />`.

- [ ] **Step 1: SVG builders** — geometry copied from the approved mockup, colors from tokens:

```tsx
// src/components/ledger/track-svgs.tsx
import type { HeartTrack, SleepTrack, FuelTrack, StepsTrack } from "@/lib/ledger/types";

const W = 1080;
const x = (t: number) => (t / 24) * W;
const INK = "var(--lg-ink)", MUT = "var(--lg-mut)", G2 = "var(--lg-g2)", G3 = "var(--lg-g3)", ACC = "var(--lg-acc)";

export function HeartSvg({ t }: { t: HeartTrack }) {
  const pts = t.points.map((p) => `${x(p.t).toFixed(1)},${(80 - ((p.v - 45) / 100) * 72).toFixed(1)}`).join(" ");
  const peakPt = t.points.find((p) => p.v === t.peak);
  return (
    <svg viewBox={`0 0 ${W} 84`} className="block w-full">
      <polyline points={pts} fill="none" stroke={INK} strokeWidth={1.6} />
      {t.peak !== null && peakPt && (
        <text x={x(peakPt.t) + 8} y={14} fontSize={10} fill={MUT} fontFamily="var(--lg-mono)">
          {t.peak} — peak
        </text>
      )}
    </svg>
  );
}

const STAGE_FILL: Record<SleepTrack["segments"][number]["stage"], string> = {
  deep: INK, core: G3, rem: G2, awake: ACC,
};
export function SleepSvg({ t }: { t: SleepTrack }) {
  return (
    <svg viewBox={`0 0 ${W} 40`} className="block w-full">
      {t.segments.map((s, i) => (
        <rect key={i} x={x(Math.min(s.from, 24))} y={7}
          width={Math.max(x(Math.min(s.to, 24)) - x(Math.min(s.from, 24)) - 1.5, 1.5)}
          height={26} rx={2} fill={STAGE_FILL[s.stage]} />
      ))}
      <text x={x(Math.min(t.segments[t.segments.length - 1]?.to ?? 8, 24)) + 10} y={25}
        fontSize={10} fill={MUT} fontFamily="var(--lg-mono)">
        ← {t.bedtimeLocal} — {t.wakeLocal}{t.score !== null ? ` · score ${t.score}` : ""}
      </text>
    </svg>
  );
}

export function FuelSvg({ t, dinnerUnlogged }: { t: FuelTrack; dinnerUnlogged: boolean }) {
  const maxK = Math.max(...t.meals.map((m) => m.kcal), 1);
  return (
    <svg viewBox={`0 0 ${W} 50`} className="block w-full">
      {t.meals.map((m, i) => (
        <g key={i}>
          <circle cx={x(m.t)} cy={18} r={4 + (m.kcal / maxK) * 8} fill="none" stroke={INK} strokeWidth={1.8} />
          <text x={x(m.t)} y={44} textAnchor="middle" fontSize={9.5} fill={MUT} fontFamily="var(--lg-mono)">{m.label}</text>
        </g>
      ))}
      {dinnerUnlogged && (
        <text x={x(20.6)} y={23} fontSize={10} fill={G3} fontFamily="var(--lg-mono)">dinner — unlogged</text>
      )}
    </svg>
  );
}

export function StepsSvg({ t, uptoHour }: { t: StepsTrack; uptoHour: number }) {
  const max = Math.max(...t.hourly, 1);
  return (
    <svg viewBox={`0 0 ${W} 54`} className="block w-full">
      {t.hourly.slice(0, Math.min(uptoHour + 1, 24)).map((v, h) => {
        const bh = (v / max) * 40;
        return (
          <rect key={h} x={x(h) + 4} y={46 - bh} width={W / 24 - 8}
            height={Math.max(bh, 1.5)} rx={1.5}
            fill={h === t.peakHour ? ACC : G3} />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Row, axis, now-line, week strip**

```tsx
// src/components/ledger/track-row.tsx
export function TrackRow({
  label, figure, sub, children, unprintedNote,
}: {
  label: React.ReactNode; figure: React.ReactNode | null; sub: React.ReactNode | null;
  children: React.ReactNode | null; unprintedNote: string;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr_250px] border-t border-[var(--lg-rule)] first:border-t-0">
      <div className="self-center py-2.5 text-[8.5px] uppercase leading-[1.7] tracking-[.22em] text-[var(--lg-mut)]">{label}</div>
      <div className="relative self-center">
        {children ?? (
          <div className="py-4 font-[family-name:var(--lg-mono)] text-[10px] tracking-[.14em] text-[var(--lg-g3)]">
            {unprintedNote}
          </div>
        )}
      </div>
      <div className="my-2 self-center border-l border-[var(--lg-rule)] py-0.5 pl-[26px]">
        {figure !== null ? (
          <>
            <div className="num text-[25px] font-extralight leading-[1.1]">{figure}</div>
            <div className="num mt-1 font-[family-name:var(--lg-mono)] text-[9.5px] tracking-[.04em] text-[var(--lg-mut)]">{sub}</div>
          </>
        ) : (
          <div className="font-[family-name:var(--lg-mono)] text-[10px] text-[var(--lg-g3)]">—</div>
        )}
      </div>
    </div>
  );
}
```

```tsx
// src/components/ledger/time-axis.tsx
export function TimeAxis() {
  return (
    <div className="grid grid-cols-[96px_1fr_250px]">
      <span />
      <div className="num flex justify-between border-t-2 border-[var(--lg-ink)] pt-2 font-[family-name:var(--lg-mono)] text-[9.5px] text-[var(--lg-mut)]">
        {["00","03","06","09","12","15","18","21","24"].map((h) => <span key={h}>{h}</span>)}
      </div>
      <span />
    </div>
  );
}
```

```tsx
// src/components/ledger/now-line.tsx
"use client";
import { useEffect, useState } from "react";

/** Vertical red line across the tracks region. Parent must be `relative`
 *  and span exactly the 00–24 plot width (the middle grid column). */
export function NowLine({ tz }: { tz: string }) {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const p = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit",
      }).format(new Date());
      const [h, m] = p.split(":").map(Number);
      setPct(((h + m / 60) / 24) * 100);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [tz]);
  if (pct === null) return null;
  return (
    <div aria-hidden
      className="pointer-events-none absolute inset-y-0 w-[1.6px] bg-[var(--lg-acc)]"
      style={{ left: `${pct}%` }} />
  );
}
```

```tsx
// src/components/ledger/week-line.tsx
import Link from "next/link";
import type { DayLedger } from "@/lib/ledger/types";

export function WeekLine({ week }: { week: DayLedger["week"] }) {
  return (
    <section className="num mt-[26px] flex items-center gap-[18px] border-t border-[var(--lg-ink)] pt-[13px]">
      <span className="ledger-k">The week</span>
      <div className="flex h-[22px] items-end gap-[5px]">
        {week.days.map((d) => (
          <Link key={d.date} href={d.isToday ? "/" : `/day/${d.date}`} className="flex flex-col items-center gap-[3px]">
            {d.printed && d.recovery !== null ? (
              <i className="block w-[22px]"
                style={{ height: `${6 + (d.recovery / 100) * 14}px`,
                  background: d.isToday ? "var(--lg-acc)" : "var(--lg-g3)" }} />
            ) : (
              <i className="block w-[22px] border-t-2 border-dashed border-[var(--lg-g3)]" />
            )}
          </Link>
        ))}
      </div>
      <span className="font-[family-name:var(--lg-mono)] text-[9px] tracking-[.1em] text-[var(--lg-mut)]">
        {week.days.map((d) => d.label).join(" ")}
      </span>
      {week.bestRecovery && (
        <span className="ml-auto text-[12px]">
          Best this week <b className="font-semibold">{week.bestRecovery.score}</b> — {week.bestRecovery.date.slice(5).replace("-", ".")}
          <Link href="/history" className="ml-2 font-[family-name:var(--lg-mono)] text-[9px] text-[var(--lg-mut)]">FULL WALL → ALMANAC</Link>
        </span>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Replace the Today page**

```tsx
// src/app/(dashboard)/page.tsx
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getDayLedger } from "@/lib/ledger/assemble";
import { localDateStr, localHours } from "@/lib/ledger/time";
import { getUserTimezone } from "@/lib/utils/timezone";
import { Masthead } from "@/components/ledger/masthead";
import { VerdictBand } from "@/components/ledger/verdict-band";
import { TrackRow } from "@/components/ledger/track-row";
import { HeartSvg, SleepSvg, FuelSvg, StepsSvg } from "@/components/ledger/track-svgs";
import { TimeAxis } from "@/components/ledger/time-axis";
import { NowLine } from "@/components/ledger/now-line";
import { WeekLine } from "@/components/ledger/week-line";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const tz = getUserTimezone(user.settings);
  const today = localDateStr(new Date(), tz);
  const l = await getDayLedger(user.id, today, { settings: user.settings, dateOfBirth: user.dateOfBirth });
  const nowH = localHours(new Date(), tz);
  const fmtH = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

  return (
    <main>
      <Masthead date={l.date} tz={tz} reportNo={l.reportNo} watch={l.watch} active="today" isToday />
      <VerdictBand verdict={l.verdict} />

      <div className="flex items-baseline justify-between pb-2.5 pt-[22px]">
        <span className="text-[10px] font-semibold uppercase tracking-[.3em]">The day, left to right</span>
        <span className="num font-[family-name:var(--lg-mono)] text-[11px] tracking-[.14em] text-[var(--lg-acc)]">
          DAY IN PROGRESS
        </span>
      </div>

      <div className="relative">
        {/* now-line spans all four tracks: absolute inside this wrapper, offset by the grid columns */}
        <div className="pointer-events-none absolute inset-y-0 left-[96px] right-[250px]">
          <NowLine tz={tz} />
        </div>

        <TrackRow label={<>Heart<br />BPM</>} unprintedNote="UNPRINTED — ENABLE HEART RATE IN HEALTH AUTO EXPORT"
          figure={l.tracks.heart ? <>{l.tracks.heart.rest ?? "—"} <small className="text-[13px] font-normal text-[var(--lg-mut)]">rest</small></> : null}
          sub={l.tracks.heart ? <>peak <b className="font-semibold text-[var(--lg-ink)]">{l.tracks.heart.peak}</b> · strain <b className="font-semibold text-[var(--lg-ink)]">{l.verdict.chips.strain.value.toFixed(1)}</b></> : null}>
          {l.tracks.heart && <HeartSvg t={l.tracks.heart} />}
        </TrackRow>

        <TrackRow label="Sleep" unprintedNote="UNPRINTED — NO SLEEP RECORDED LAST NIGHT"
          figure={l.tracks.sleep ? fmtH(l.tracks.sleep.totalMin) : null}
          sub={l.tracks.sleep ? <>deep <b className="font-semibold text-[var(--lg-ink)]">{fmtH(l.tracks.sleep.deepMin)}</b> · rem <b className="font-semibold text-[var(--lg-ink)]">{fmtH(l.tracks.sleep.remMin)}</b>{l.tracks.sleep.efficiency !== null && <> · effic <b className="font-semibold text-[var(--lg-ink)]">{Math.round(l.tracks.sleep.efficiency)}%</b></>}</> : null}>
          {l.tracks.sleep && <SleepSvg t={l.tracks.sleep} />}
        </TrackRow>

        <TrackRow label="Fuel" unprintedNote="UNPRINTED — LOG A MEAL VIA CLAUDE"
          figure={l.tracks.fuel ? <>{l.tracks.fuel.kcal.toLocaleString()} <small className="text-[13px] font-normal text-[var(--lg-mut)]">kcal</small></> : null}
          sub={l.tracks.fuel ? <>protein <b className="font-semibold text-[var(--lg-ink)]">{l.tracks.fuel.proteinG} g</b> · fibre <b className="font-semibold text-[var(--lg-ink)]">{l.tracks.fuel.fibreG} g</b></> : null}>
          {l.tracks.fuel && <FuelSvg t={l.tracks.fuel} dinnerUnlogged={nowH > 20 && !l.tracks.fuel.meals.some((m) => m.t > 17)} />}
        </TrackRow>

        <TrackRow label={<>Steps<br />per hr</>} unprintedNote="UNPRINTED — NO MOVEMENT DATA TODAY"
          figure={l.tracks.steps ? l.tracks.steps.total.toLocaleString() : null}
          sub={l.tracks.steps?.peakHour != null ? <>peak hour <b className="font-semibold text-[var(--lg-ink)]">{String(l.tracks.steps.peakHour).padStart(2, "0")}:00</b></> : null}>
          {l.tracks.steps && <StepsSvg t={l.tracks.steps} uptoHour={Math.floor(nowH)} />}
        </TrackRow>
      </div>
      <TimeAxis />

      <WeekLine week={l.week} />

      <footer className="mt-[18px] flex justify-between border-t border-[var(--lg-ink)] pt-[11px] text-[9px] uppercase tracking-[.26em] text-[var(--lg-mut)]">
        <span>N = 1 · Every number from your watch or your words</span>
        <span>Report № {l.reportNo} · Printed continuously</span>
      </footer>
    </main>
  );
}
```

- [ ] **Step 4: Verify with real render** (the mandatory visual gate)

```bash
rm -rf .next && npm run build && (npm run start &) && sleep 4
# log in session cookie needed — use the dev flow instead if simpler:
# npm run dev + authenticated browser; for headless: reuse an existing session cookie from the browser.
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --screenshot=/tmp/today.png --window-size=1600,1100 --virtual-time-budget=5000 \
  --hide-scrollbars "http://localhost:3000/"
```

Then **look at the screenshot** (Read tool). Expected with current data: masthead + verdict "—  Unprinted — not enough signal" + steps track printed with real bars + three honest UNPRINTED rows + axis + week strip of dashed frames. Compare against the approved mockup for type sizes, hairlines, spacing. Fix visual diffs before committing. (If the headless run can't authenticate, verify in the logged-in browser and screenshot manually — but the render MUST be seen before the commit claim.)

- [ ] **Step 5: Full gates, commit, push**

```bash
npx vitest run && npx tsc --noEmit && npm run lint && npm run build
git add -A
git commit -m "feat(ledger): the Score — four ledger-line tracks, now-line, week strip; new front page"
git push origin main
```

---

### Task 9: `/day/[date]` — closed days

**Files:**
- Create: `src/app/(dashboard)/day/[date]/page.tsx`

**Interfaces:**
- Consumes: `getDayLedger` (already date-parameterized), all Task 6–8 components.

- [ ] **Step 1: Implement**

```tsx
// src/app/(dashboard)/day/[date]/page.tsx
import { getCurrentUser } from "@/lib/auth/session";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDayLedger } from "@/lib/ledger/assemble";
import { localDateStr } from "@/lib/ledger/time";
import { getUserTimezone } from "@/lib/utils/timezone";
import { Masthead } from "@/components/ledger/masthead";
import { VerdictBand } from "@/components/ledger/verdict-band";
import { TrackRow } from "@/components/ledger/track-row";
import { HeartSvg, SleepSvg, FuelSvg, StepsSvg } from "@/components/ledger/track-svgs";
import { TimeAxis } from "@/components/ledger/time-axis";
import { WeekLine } from "@/components/ledger/week-line";

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date: raw } = await params;
  const parsed = DateParam.safeParse(raw);
  if (!parsed.success) notFound();
  const date = parsed.data;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const tz = getUserTimezone(user.settings);
  const today = localDateStr(new Date(), tz);
  if (date >= today) redirect("/");

  const l = await getDayLedger(user.id, date, { settings: user.settings, dateOfBirth: user.dateOfBirth });
  const fmtH = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

  const footnotes: string[] = [];
  if (l.tracks.fuel) footnotes.push(`${l.tracks.fuel.meals.length} meals logged via Claude`);
  if (l.verdict.confidence < 0.95 && l.verdict.recovery !== null)
    footnotes.push(`verdict printed from ${l.verdict.basis.join(" + ")}`);
  if (!l.tracks.sleep) footnotes.push("no sleep recorded");
  if (!l.tracks.heart) footnotes.push("no heart-rate samples");

  return (
    <main>
      <Masthead date={l.date} tz={tz} reportNo={l.reportNo} watch={l.watch} active="today" isToday={false} />
      <VerdictBand verdict={l.verdict} />
      <div className="flex items-baseline justify-between pb-2.5 pt-[22px]">
        <span className="text-[10px] font-semibold uppercase tracking-[.3em]">The day, left to right</span>
        <span className="num font-[family-name:var(--lg-mono)] text-[11px] tracking-[.14em] text-[var(--lg-mut)]">
          DAY CLOSED 24:00
        </span>
      </div>
      {/* Same four TrackRows as the Today page, no NowLine wrapper, StepsSvg uptoHour={24}.
          Copy the TrackRow block from page.tsx verbatim, minus the absolute NowLine div. */}
      <TrackRow label={<>Heart<br />BPM</>} unprintedNote="UNPRINTED — NO HEART-RATE SAMPLES THAT DAY"
        figure={l.tracks.heart ? <>{l.tracks.heart.rest ?? "—"} <small className="text-[13px] font-normal text-[var(--lg-mut)]">rest</small></> : null}
        sub={l.tracks.heart ? <>peak <b className="font-semibold text-[var(--lg-ink)]">{l.tracks.heart.peak}</b></> : null}>
        {l.tracks.heart && <HeartSvg t={l.tracks.heart} />}
      </TrackRow>
      <TrackRow label="Sleep" unprintedNote="UNPRINTED — NO SLEEP RECORDED"
        figure={l.tracks.sleep ? fmtH(l.tracks.sleep.totalMin) : null}
        sub={l.tracks.sleep ? <>deep <b className="font-semibold text-[var(--lg-ink)]">{fmtH(l.tracks.sleep.deepMin)}</b> · rem <b className="font-semibold text-[var(--lg-ink)]">{fmtH(l.tracks.sleep.remMin)}</b></> : null}>
        {l.tracks.sleep && <SleepSvg t={l.tracks.sleep} />}
      </TrackRow>
      <TrackRow label="Fuel" unprintedNote="UNPRINTED — NOTHING LOGGED"
        figure={l.tracks.fuel ? <>{l.tracks.fuel.kcal.toLocaleString()} <small className="text-[13px] font-normal text-[var(--lg-mut)]">kcal</small></> : null}
        sub={l.tracks.fuel ? <>protein <b className="font-semibold text-[var(--lg-ink)]">{l.tracks.fuel.proteinG} g</b> · fibre <b className="font-semibold text-[var(--lg-ink)]">{l.tracks.fuel.fibreG} g</b></> : null}>
        {l.tracks.fuel && <FuelSvg t={l.tracks.fuel} dinnerUnlogged={false} />}
      </TrackRow>
      <TrackRow label={<>Steps<br />per hr</>} unprintedNote="UNPRINTED — NO MOVEMENT DATA"
        figure={l.tracks.steps ? l.tracks.steps.total.toLocaleString() : null}
        sub={l.tracks.steps?.peakHour != null ? <>peak hour <b className="font-semibold text-[var(--lg-ink)]">{String(l.tracks.steps.peakHour).padStart(2, "0")}:00</b></> : null}>
        {l.tracks.steps && <StepsSvg t={l.tracks.steps} uptoHour={24} />}
      </TrackRow>
      <TimeAxis />
      {footnotes.length > 0 && (
        <p className="num pt-2 font-[family-name:var(--lg-mono)] text-[9px] tracking-[.1em] text-[var(--lg-mut)]">
          FOOTNOTES — {footnotes.map((f, i) => `${"¹²³⁴"[i] ?? "·"} ${f}`).join(" · ")}
        </p>
      )}
      <WeekLine week={l.week} />
      <footer className="mt-[18px] flex justify-between border-t border-[var(--lg-ink)] pt-[11px] text-[9px] uppercase tracking-[.26em] text-[var(--lg-mut)]">
        <span>N = 1 · Every number from your watch or your words</span>
        <span>Report № {l.reportNo} · Day closed</span>
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Verify** — `rm -rf .next && npm run build`; then load `/day/2026-08-13` (a date with steps + food data) in the browser and screenshot; footnotes render; `/day/not-a-date` → 404; `/day/<today>` → redirects to `/`.

- [ ] **Step 3: Commit and push**

```bash
git add src/app/\(dashboard\)/day
git commit -m "feat(ledger): closed-day pages at /day/[date] with footnotes"
git push origin main
```

---

### Task 10: `/history` — the Almanac

**Files:**
- Create: `src/app/(dashboard)/history/page.tsx`

**Interfaces:**
- Consumes: `dailyScores`, `healthMetrics` (steps per day for sparklines), `sleepSessions` (longest sleep record), Masthead.

- [ ] **Step 1: Implement**

```tsx
// src/app/(dashboard)/history/page.tsx
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { and, eq, gte, sql as dsql } from "drizzle-orm";
import { db, dailyScores, healthMetrics, sleepSessions } from "@/lib/db";
import { getUserTimezone } from "@/lib/utils/timezone";
import { localDateStr } from "@/lib/ledger/time";
import { Masthead } from "@/components/ledger/masthead";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const tz = getUserTimezone(user.settings);
  const today = localDateStr(new Date(), tz);
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();

  const [scores, stepDays, sleeps] = await Promise.all([
    db.select().from(dailyScores).where(and(eq(dailyScores.userId, user.id), gte(dailyScores.date, monthStart))),
    db.select({
      day: dsql<string>`(${healthMetrics.recordedAt} AT TIME ZONE ${tz})::date::text`,
      total: dsql<number>`sum(${healthMetrics.value}::numeric)::int`,
    }).from(healthMetrics)
      .where(and(eq(healthMetrics.userId, user.id), eq(healthMetrics.metricType, "steps")))
      .groupBy(dsql`1`),
    db.select().from(sleepSessions).where(eq(sleepSessions.userId, user.id)),
  ]);

  const stepsByDay = new Map(stepDays.map((r) => [r.day, r.total]));
  const bestSteps = stepDays.sort((a, b) => b.total - a.total)[0] ?? null;
  const bestScore = scores.filter((s) => s.recoveryScore != null)
    .sort((a, b) => Number(b.recoveryScore) - Number(a.recoveryScore))[0] ?? null;
  const longestSleep = sleeps.sort((a, b) => b.totalMinutes - a.totalMinutes)[0] ?? null;
  const printed = [...Array(daysInMonth)].filter((_, i) => {
    const d = `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    return d <= today && (stepsByDay.has(d) || scores.some((s) => s.date === d));
  }).length;
  const monthName = new Date(`${monthStart}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long" });
  const fmtH = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

  return (
    <main>
      <Masthead date={today} tz={tz} reportNo={0} watch={{ lastSyncedAt: null, syncedToday: false }} active="almanac" isToday />
      <div className="mb-3 mt-6 flex items-baseline justify-between border-b-2 border-[var(--lg-ink)] pb-2">
        <span className="num text-[26px] font-extralight">{monthName} <span className="text-[var(--lg-mut)]">{y}</span></span>
        <span className="ledger-k">The Almanac · {printed} of {daysInMonth} days printed</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {[...Array(daysInMonth)].map((_, i) => {
          const d = `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const future = d > today;
          const score = scores.find((s) => s.date === d);
          const steps = stepsByDay.get(d);
          const has = !future && (score != null || steps != null);
          const wd = new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow" });
          if (future) return <div key={d} className="min-h-[74px] rounded border border-transparent" />;
          if (!has) return (
            <div key={d} className="min-h-[74px] rounded border border-dashed border-[var(--lg-rule)] p-2">
              <div className="num font-[family-name:var(--lg-mono)] text-[8px] text-[var(--lg-mut)]">{wd} {i + 1}</div>
              <div className="mt-2 text-[13px] text-[var(--lg-g3)]">— no data</div>
            </div>
          );
          return (
            <Link key={d} href={d === today ? "/" : `/day/${d}`}
              className={`min-h-[74px] rounded border p-2 ${d === today ? "border-[var(--lg-acc)]" : "border-[var(--lg-rule)]"} bg-[var(--lg-chipbg)]`}>
              <div className="num font-[family-name:var(--lg-mono)] text-[8px] text-[var(--lg-mut)]">{wd} {i + 1}</div>
              <div className="num mt-0.5 text-[25px] font-extralight leading-[1.05]">
                {score?.recoveryScore != null ? Math.round(Number(score.recoveryScore)) : "·"}
              </div>
              {steps != null && (
                <div className="num font-[family-name:var(--lg-mono)] text-[8px] text-[var(--lg-mut)]">{steps.toLocaleString()} steps</div>
              )}
            </Link>
          );
        })}
      </div>
      <div className="num mt-4 flex gap-8 border-t border-[var(--lg-ink)] pt-3 text-[11.5px]">
        {bestScore && <div><span className="ledger-k block">Best recovery</span><b className="font-semibold">{Math.round(Number(bestScore.recoveryScore))}</b> — {bestScore.date.slice(5).replace("-", ".")}</div>}
        {bestSteps && <div><span className="ledger-k block">Most steps</span><b className="font-semibold">{bestSteps.total.toLocaleString()}</b> — {bestSteps.day.slice(5).replace("-", ".")} ★</div>}
        {longestSleep && <div><span className="ledger-k block">Longest sleep</span><b className="font-semibold">{fmtH(longestSleep.totalMinutes)}</b> — {longestSleep.sleepDate.slice(5).replace("-", ".")}</div>}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify** — build, load `/history` logged-in, screenshot. Expected: August wall, days with steps show cells with totals, empty days as dashed frames, records strip shows Most steps.

- [ ] **Step 3: Commit and push**

```bash
git add src/app/\(dashboard\)/history
git commit -m "feat(ledger): the Almanac at /history — month wall and records"
git push origin main
```

---

### Task 11: Un-orphan checks + old-page cleanup pass

**Files:**
- Modify (as grep dictates): any file importing deleted components or reading `readinessScore`.
- Delete: `src/components/dashboard/quick-actions.tsx`, `metric-card.tsx`, `score-ring.tsx` **only if** `grep -rln "quick-actions\|metric-card\|score-ring" src/` shows no remaining importers after the new `/` replaced the old dashboard page. Old domain pages (`/sleep`, `/recovery`, `/workouts`, `/nutrition`, `/settings`) STAY — unlinked but functional (they'll be re-typeset as track-expansion targets in a later phase).

- [ ] **Step 1:** `grep -rln "components/dashboard" src/` — for each hit, either the file is an old domain page (leave it) or a dead import (remove it).
- [ ] **Step 2:** Delete truly orphaned components; `rm -rf .next`.
- [ ] **Step 3:** Verify — `npx tsc --noEmit && npm run lint && npm run build` all clean.
- [ ] **Step 4:** Commit and push

```bash
git add -A
git commit -m "chore(ledger): remove orphaned dashboard components"
git push origin main
```

---

### Task 12: Final verification gate + user-side checklist

- [ ] **Step 1: Run the full gate, fresh**

```bash
npx vitest run          # all unit suites green
npx tsc --noEmit        # 0 errors
npm run lint            # 0 errors
rm -rf .next && npm run build   # succeeds
grep -rn "TODO\|FIXME\|not implemented\|PLACEHOLDER" src/lib/ledger src/components/ledger src/app/\(dashboard\)  # 0 hits
npx tsx scripts/ledger-smoke.mts  # prints a DayLedger, no throw
git log origin/main..HEAD  # empty — everything pushed
```

- [ ] **Step 2: Visual acceptance** — screenshot `/`, `/day/2026-08-13`, `/history` logged in at 1600px; compare side-by-side with the approved artifacts (`8dda75af` section II, Gallery edition of `f51aad7e`). Present the three screenshots to the user with the Completion Declaration format from quality-gates.
- [ ] **Step 3: Hand the user their checklist** (data, not code):
  1. In the Health Auto Export app, add **Heart Rate** and **Sleep Analysis** to the exported metrics (both already map server-side) — the Heart and Sleep tracks and the real verdict light up on the next sync.
  2. Wear the watch to sleep — recovery needs the night.
  3. Log meals via Claude as usual — the Fuel track reads `food_logs` directly.

---

## Self-Review Notes (already applied)

- **Spec coverage:** masthead/verdict/4 tracks/figures/axis/week strip/footer → Tasks 6-8; `/day/[date]` + footnotes → Task 9; Almanac wall + records + gaps → Task 10; Gallery palette → Task 6 tokens; scoring bugs #1/#2/#3/#6 → Tasks 2-3; sparse-data honesty → `unprintedNote` on every TrackRow + `verdictCopy` unprinted band.
- **Consistency:** all UI consumes only `DayLedger` from `types.ts` (Task 4); `pickNightMetric` shared by route (Task 3) and assembly (Task 5); SVG geometry constants match the approved mockup (W=1080, same heights).
- **Known simplifications, on purpose:** sleep band is proportional (stage totals, not intervals — DB has no intervals); week strip recovery bars depend on `daily_scores` filling as closed days get viewed (Task 5 upsert) — sparse at first, honest by design; `reportNo` = days since first metric.
