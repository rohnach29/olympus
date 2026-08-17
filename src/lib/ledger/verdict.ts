/**
 * The words on the front page.
 *
 * Deterministic templates, not a language model: the ledger prints every
 * morning whether or not an API is reachable, and the same day must always
 * read the same way. An LLM edition can replace this file without touching a
 * single component, because the shape it returns is all the UI depends on.
 *
 * The one rule these templates must never break: when the score came from
 * part of the picture, the sentence says so. A 0.4-confidence number
 * presented in the same voice as a complete one is a lie told in typography.
 */

import type { DayVerdict, VerdictBand } from "./types";

export function bandOf(recovery: number | null): VerdictBand {
  if (recovery === null) return "unprinted";
  if (recovery >= 70) return "recovered";
  if (recovery >= 50) return "moderate";
  return "rest";
}

function hoursMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} m` : `${m} m`;
}

function qualifier(confidence: number, basis: string[]): string {
  if (confidence >= 0.95 || basis.length === 0) return "";
  const list =
    basis.length === 1
      ? basis[0]
      : `${basis.slice(0, -1).join(", ")} and ${basis[basis.length - 1]}`;
  return ` Printed from ${list} alone — more signal, sharper verdict.`;
}

export interface VerdictCopyInput {
  recovery: number | null;
  confidence: number;
  basis: string[];
  deepMin: number | null;
  sleepMin: number | null;
  strain: number;
  sleepScore: number | null;
  missing: string[];
}

export function verdictCopy(i: VerdictCopyInput): {
  band: VerdictBand;
  headline: string;
  sentence: string;
} {
  const band = bandOf(i.recovery);

  if (band === "unprinted") {
    const need =
      i.missing.length > 0
        ? `Waiting on ${i.missing.join(" and ")}.`
        : "Waiting on the watch.";
    return {
      band,
      headline: "Unprinted — not enough signal",
      sentence: `${need} The ledger would rather leave this blank than print a number it cannot stand behind.`,
    };
  }

  const tail = qualifier(i.confidence, i.basis);

  if (band === "recovered") {
    const opener =
      i.deepMin !== null && i.deepMin >= 60
        ? `Deep sleep did the work — ${hoursMinutes(i.deepMin)} of it.`
        : i.sleepMin !== null
          ? `${hoursMinutes(i.sleepMin)} of sleep behind you.`
          : "The signals are pointing the same way.";
    return {
      band,
      headline: "Recovered — train hard",
      sentence: `${opener} There is room in the budget today; spend it, then protect the bedtime.${tail}`,
    };
  }

  if (band === "moderate") {
    const opener =
      i.strain >= 12
        ? `Yesterday's strain of ${i.strain.toFixed(1)} is still in your legs.`
        : i.sleepMin !== null && i.sleepMin < 390
          ? `A short night — ${hoursMinutes(i.sleepMin)} — is the limiting factor.`
          : "Not a red flag, and not a green light.";
    return {
      band,
      headline: "Moderate — keep something in reserve",
      sentence: `${opener} Train, but leave a rep in the tank and make the evening an early one.${tail}`,
    };
  }

  const opener =
    i.sleepScore !== null
      ? `Sleep scored ${i.sleepScore}, and the rest of the picture agrees.`
      : "The numbers are asking for an easy one.";
  return {
    band,
    headline: "Run down — make today easy",
    sentence: `${opener} Walk, stretch, eat properly, and get to bed early; tomorrow is the session that matters.${tail}`,
  };
}

/**
 * The small print under a closed day: what was and wasn't recorded, so an
 * empty track is never mistaken for a body that did nothing.
 */
export function footnotesFor(input: {
  verdict: Pick<DayVerdict, "recovery" | "confidence" | "basis">;
  hasHeart: boolean;
  hasSleep: boolean;
  hasFuel: boolean;
  hasSteps: boolean;
  mealCount: number;
  workoutCount: number;
}): string[] {
  const notes: string[] = [];

  if (input.workoutCount > 0) {
    notes.push(
      `${input.workoutCount} workout${input.workoutCount === 1 ? "" : "s"} recorded the day before`
    );
  }
  if (input.mealCount > 0) {
    notes.push(`${input.mealCount} meal${input.mealCount === 1 ? "" : "s"} logged via Claude`);
  }
  if (input.verdict.recovery !== null && input.verdict.confidence < 0.95) {
    notes.push(`verdict printed from ${input.verdict.basis.join(" + ")}`);
  }
  if (!input.hasSleep) notes.push("no sleep recorded");
  if (!input.hasHeart) notes.push("no heart-rate samples");
  if (!input.hasSteps) notes.push("no movement data");
  if (!input.hasFuel) notes.push("nothing logged to eat");

  return notes;
}
