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
