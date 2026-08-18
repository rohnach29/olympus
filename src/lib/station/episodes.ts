/**
 * Reading the archive.
 *
 * The station page is a dumb reader: the worker decides what a morning sounds
 * like, and everything here just fetches what it decided.
 */

import { and, desc, eq, lte } from "drizzle-orm";
import { db, episodes, type Episode } from "@/lib/db";

export interface TranscriptLine {
  speaker: string;
  text: string;
}

/** One past morning, as it appears in the archive list. */
export interface EpisodeStub {
  airDate: string;
  status: string;
  hasAudio: boolean;
  durationS: number | null;
}

/** The transcript, with the seconds each segment starts at (if synthesized). */
export function transcriptOf(episode: Episode): TranscriptLine[] {
  const raw = episode.transcript;
  return Array.isArray(raw) ? (raw as TranscriptLine[]) : [];
}

export function segmentStartsOf(episode: Episode): number[] {
  const raw = episode.segmentStarts;
  return Array.isArray(raw) ? (raw as number[]) : [];
}

export function waveformOf(episode: Episode): number[] {
  const raw = episode.waveform;
  return Array.isArray(raw) ? (raw as number[]) : [];
}

/**
 * A record needs a title, and the script already wrote one — the writer's
 * house style opens with "…the lead story this morning is X". These helpers
 * lift that X (or the first substantive sentence) off the transcript so each
 * pressing gets an A-side title and a b/w credit without asking the LLM for
 * anything new.
 */
function headlineFrom(text: string): string | null {
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [];
  if (sentences.length === 0) return null;

  // Best case: the anchor named the lead story — quote it verbatim.
  const lead = text.match(/lead story[^.!?]*?\bis\b\s+([^.!?]+[.!?])/i);
  if (lead) {
    const phrase = lead[1].trim();
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  }

  // Otherwise the first sentence that isn't date-and-greeting boilerplate.
  const meaty =
    sentences.find((s) => !/^(Good morning|It is |Station Olympus)/i.test(s)) ??
    sentences[0];
  return meaty.length > 72 ? meaty.slice(0, 69).trimEnd() + "…" : meaty;
}

/** The A-side title, quoted on the label side of the page. */
export function aSideTitle(transcript: TranscriptLine[]): string {
  return headlineFrom(transcript[0]?.text ?? "") ?? "The morning report";
}

/** The "b/w" (backed-with) credit — a line off the second segment. */
export function bwTitle(transcript: TranscriptLine[]): string | null {
  return transcript.length > 1 ? headlineFrom(transcript[1].text) : null;
}

/**
 * The episode for a given morning, or the most recent one at or before it.
 *
 * Asking for "today" before the press run has finished should show you
 * yesterday's show rather than an empty room — a radio station that has gone
 * quiet for an hour is still a radio station.
 */
export async function getEpisodeOnOrBefore(
  userId: string,
  dateStr: string
): Promise<Episode | null> {
  const [row] = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.userId, userId), lte(episodes.airDate, dateStr)))
    .orderBy(desc(episodes.airDate))
    .limit(1);

  return row ?? null;
}

/** The shelf: recent mornings, newest first. */
export async function listEpisodes(
  userId: string,
  limit = 14
): Promise<EpisodeStub[]> {
  const rows = await db
    .select({
      airDate: episodes.airDate,
      status: episodes.status,
      audioUrl: episodes.audioUrl,
      audioDurationS: episodes.audioDurationS,
    })
    .from(episodes)
    .where(eq(episodes.userId, userId))
    .orderBy(desc(episodes.airDate))
    .limit(limit);

  return rows.map((r) => ({
    airDate: r.airDate,
    status: r.status,
    hasAudio: r.audioUrl !== null,
    durationS: r.audioDurationS,
  }));
}
