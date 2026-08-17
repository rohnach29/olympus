/**
 * Station Olympus — TTS audition harness.
 *
 * Sends a script (or excerpt) to Gemini TTS in one or more voices and writes
 * playable WAV files. Every invocation spends one TTS call per voice against
 * the 10/day free-tier ceiling, so the text is validated as text FIRST and
 * this tool is pointed at it only after.
 *
 * Usage: npx tsx scripts/station-tts.mts <text-file> <out-dir> <voice> [voice...]
 */

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MODEL = "gemini-3.1-flash-tts-preview";
const FALLBACK_MODEL = "gemini-2.5-flash-preview-tts";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * The anchor's constant character. Moment-to-moment dynamics (pauses, shouts)
 * are encoded in the script's punctuation by the writer — this note only
 * carries what never changes between episodes.
 */
const DELIVERY_DIRECTION =
  "You are a comedian hosting a morning news show, in the style of a Weekend " +
  "Update anchor: deep, resonant chest voice, confident news cadence, warm " +
  "and clearly enjoying yourself. Deliver facts cleanly and briskly; when a " +
  "punchline arrives, let a little amusement into your voice — the hint of a " +
  "smile, never a laugh track. Half-beat pause at em-dashes; at an ellipsis, " +
  "a longer beat before the payoff. Natural, loose, human — never robotic.";

const [, , textFile, outDir, ...voices] = process.argv;
if (!textFile || !outDir || voices.length === 0) {
  console.error("usage: npx tsx scripts/station-tts.mts <text-file> <out-dir> <voice> [voice...]");
  process.exit(1);
}
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY missing from .env.local");

const script = readFileSync(textFile, "utf8").trim();
mkdirSync(outDir, { recursive: true });

/** PCM 16-bit mono → WAV container. */
function wav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesize(model: string, voice: string): Promise<{ pcm: Buffer; rate: number }> {
  const res = await fetch(`${API}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${DELIVERY_DIRECTION}\n\n${script}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${model}/${voice}: ${json.error?.code} ${json.error?.message?.slice(0, 200)}`);
  }
  const part = json.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data?: string } }) => p.inlineData?.data
  );
  if (!part) throw new Error(`${model}/${voice}: no audio in response`);
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? "")?.[1] ?? 24000);
  return { pcm: Buffer.from(part.inlineData.data, "base64"), rate };
}

for (const voice of voices) {
  let out: { pcm: Buffer; rate: number };
  let used = MODEL;
  try {
    out = await synthesize(MODEL, voice);
  } catch (err) {
    console.error(`[${err instanceof Error ? err.message : err}] — falling back`);
    used = FALLBACK_MODEL;
    out = await synthesize(FALLBACK_MODEL, voice);
  }
  const file = join(outDir, `${voice.toLowerCase()}.wav`);
  writeFileSync(file, wav(out.pcm, out.rate));
  const seconds = out.pcm.length / 2 / out.rate;
  console.log(`${voice}: ${seconds.toFixed(1)}s (${used}) -> ${file}`);
}
process.exit(0);
