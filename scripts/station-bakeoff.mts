/**
 * Station Olympus — script bake-off.
 *
 * Pulls real facts from the ledger for a given morning, sends the anchor
 * prompt to Gemini, and prints N candidate bulletins side by side. This is
 * the audition harness the pipeline's prompt will be tuned with; it spends
 * writer-model quota (20/day on flash) and never touches TTS quota.
 *
 * Usage: npx tsx scripts/station-bakeoff.mts [date] [generations]
 */

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const { db, users, foodLogs, workouts } = await import("../src/lib/db/index");
const { and, eq, gte, lt, asc } = await import("drizzle-orm");
const { getDayLedger } = await import("../src/lib/ledger/assemble");
const { dayWindowUtc, shiftDate } = await import("../src/lib/ledger/time");
const { getUserTimezone } = await import("../src/lib/utils/timezone");

const MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.6-flash";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

const dateStr = process.argv[2] ?? "2026-08-16";
const generations = Number(process.argv[3] ?? 2);
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY missing from .env.local");

// ---------- facts, from the same object the Today page renders ----------

const [user] = await db
  .select({
    id: users.id,
    settings: users.settings,
    dateOfBirth: users.dateOfBirth,
    gender: users.gender,
    createdAt: users.createdAt,
  })
  .from(users)
  .limit(1);
if (!user) throw new Error("no user");

const tz = getUserTimezone(user.settings);
const ledger = await getDayLedger(user, dateStr);
const prevStr = shiftDate(dateStr, -1);
const prevLedger = await getDayLedger(user, prevStr);

// Yesterday's meals and workout come from their own tables: the ledger keeps
// meal names off the page, but the anchor wants "chicken biryani" by name.
const { start: prevStart, end: prevEnd } = dayWindowUtc(prevStr, tz);
const meals = await db
  .select({ foodName: foodLogs.foodName })
  .from(foodLogs)
  .where(and(eq(foodLogs.userId, user.id), eq(foodLogs.loggedDate, prevStr)))
  .orderBy(asc(foodLogs.createdAt));
const prevWorkouts = await db
  .select({ type: workouts.type, name: workouts.name, durationMinutes: workouts.durationMinutes })
  .from(workouts)
  .where(
    and(
      eq(workouts.userId, user.id),
      gte(workouts.startedAt, prevStart),
      lt(workouts.startedAt, prevEnd)
    )
  );

const hhmm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`;

const facts = {
  morning_of: `${ledger.weekday} ${dateStr}`,
  verdict: {
    recovery: ledger.verdict.recovery,
    band: ledger.verdict.band,
    confidence: ledger.verdict.confidence,
  },
  night: ledger.tracks.sleep
    ? {
        asleep: hhmm(ledger.tracks.sleep.totalMin),
        deep_min: ledger.tracks.sleep.deepMin,
        rem_min: ledger.tracks.sleep.remMin,
        score: ledger.tracks.sleep.score,
        bedtime: ledger.tracks.sleep.bedtime,
        wake: ledger.tracks.sleep.wake,
      }
    : null,
  hrv: ledger.verdict.chips.hrv,
  resting_hr: ledger.verdict.chips.rhr,
  yesterday: {
    steps: prevLedger.tracks.steps?.total ?? null,
    workouts: prevWorkouts,
    kcal: prevLedger.tracks.fuel?.kcal ?? null,
    protein_g: prevLedger.tracks.fuel?.proteinG ?? null,
    meals: meals.map((m) => m.foodName),
  },
};

console.log("FACTS ------------------------------------------------------");
console.log(JSON.stringify(facts, null, 2));

// ---------- the anchor prompt ----------

const SYSTEM = `You are the host of STATION OLYMPUS — a comedian delivering a morning news briefing about exactly one person's body and day, direct to that person. Think Weekend Update meets John Oliver: real news cadence as the vehicle, genuine comedy as the cargo, delivered with total confidence.

WHO YOU ARE
- A comedian first. Naturally funny, quick, loose — not a robot reading bullet points. You enjoy this job and it shows; when a joke amuses you, you're allowed to be amused.
- Confident anchor rhythm: you state facts cleanly and let punchlines land at the end of items, but the connective tissue is natural talk — you ride momentum between items like a person, not a teleprompter.
- Positive and uplifting, always on the listener's side. You can tease the material, never the listener. A rough number gets honest acknowledgment and a reason for optimism, not a roast.

THE SHOW (~220-260 words)
- Open: good morning, the date, and the day's headline — the most interesting thing in the data.
- The night: how the sleep went — duration, deep sleep, the score, when they got to bed.
- Yesterday: steps, the workout if any, what they ate, the protein.
- Today: two or three concrete, practical pointers drawn from the data — said like a friend who wants a good day for you, not a coach with a clipboard.
- Sign-off: one short warm line, then out.

HOW THE COMEDY WORKS
- Most facts are played straight — that's what makes the jokes land. Three or four real punchlines in the show, placed at the ends of items.
- Jokes come from the specifics of THIS data — the bedtime, the meal, the gap between plans and reality. Nothing generic that could run any day.

PERFORMED, NOT READ — a voice-clone TTS (Fish Audio S2.1) speaks this verbatim, and you direct the performance inline:
- Square-bracket mood tags at the start of a sentence steer delivery until the next tag: [excited], [confident], [playful], [warm], [surprised], [emphasis]. Use four to eight across the show — set a mood per segment, and shift it for a punchline.
- (break) is a short beat; (long-break) is a longer pause. This is your comic timing: a (break) before a punchline's payoff, a beat after a big number lands.
- Energy also comes from the text itself: exclamation marks read brighter than full stops. Shape each sentence the way it should sound.
- Never use laughing or chuckling effects. No CAPS shouting. Nothing in brackets or parentheses that isn't a direction.
- Flowing spoken sentences — clauses chained naturally, full stops for punches. Spell numbers as words. Every number must come exactly from FACTS — never invent or estimate; if a fact is missing, report around it. Scores are out of one hundred, never percent.

OUTPUT — only the words the host speaks.`;

const userMsg = `FACTS (the morning of ${facts.morning_of}):
${JSON.stringify(facts, null, 2)}

Write this morning's bulletin.`;

// ---------- generate ----------

async function generate(model: string): Promise<string> {
  const res = await fetch(`${API}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${model}: ${json.error?.code} ${json.error?.message?.slice(0, 200)}`);
  }
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text.trim()) throw new Error(`${model}: empty response (${JSON.stringify(json).slice(0, 300)})`);
  return text.trim();
}

for (let i = 1; i <= generations; i++) {
  let script: string;
  let used = MODEL;
  try {
    script = await generate(MODEL);
  } catch (err) {
    console.error(`\n[${MODEL} failed: ${err instanceof Error ? err.message : err}] — falling back`);
    used = FALLBACK_MODEL;
    script = await generate(FALLBACK_MODEL);
  }
  const words = script.split(/\s+/).length;
  console.log(`\nGENERATION ${i}  (${used}, ${words} words, ~${Math.round((words / 160) * 60)}s) ----`);
  console.log(script);
}
process.exit(0);
