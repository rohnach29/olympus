/**
 * Where a finished episode lands.
 *
 * The worker orchestrates and synthesizes; every write to Olympus happens
 * here, in the language that owns the schema. The worker therefore needs no
 * database credentials and no blob token — only the shared secret.
 *
 * Publishing is idempotent on (user, airDate): re-running a press run for the
 * same morning replaces that morning rather than stacking up duplicates.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, isNotNull, lt } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { z } from "zod";
import { db, episodes } from "@/lib/db";
import { resolveStationUser, stationAuthError } from "@/lib/station/auth";
import { localDateStr, shiftDate } from "@/lib/ledger/time";
import { getUserTimezone } from "@/lib/utils/timezone";

export const dynamic = "force-dynamic";

/** How long a morning keeps its voice. Transcripts are kept forever. */
const AUDIO_RETENTION_DAYS = 30;

const bodySchema = z.object({
  airDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transcript: z
    .array(z.object({ speaker: z.string(), text: z.string() }))
    .min(1),
  factsUsed: z.record(z.string(), z.unknown()),
  writerModel: z.string().nullable().optional(),
  ttsModel: z.string().nullable().optional(),
  /** Base64 mp3. Absent when the show was written but never voiced. */
  audioBase64: z.string().nullable().optional(),
  durationS: z.number().nonnegative().nullable().optional(),
  waveform: z.array(z.number()).nullable().optional(),
  segmentStarts: z.array(z.number()).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const denied = stationAuthError(request);
    if (denied) return denied;

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid episode: ${parsed.error.issues[0]?.message ?? "bad body"}` },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const user = await resolveStationUser();
    if (!user) {
      return NextResponse.json({ error: "No user exists" }, { status: 404 });
    }

    // ---- the audio, if the show got a voice ----
    let audioUrl: string | null = null;
    if (body.audioBase64) {
      // Fail legibly before fail generically: a missing blob store is a setup
      // problem the run log should name, not bury in a 500.
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
          {
            error:
              "Audio storage is not configured: BLOB_READ_WRITE_TOKEN is missing. " +
              "Create a Vercel Blob store, connect it to this project, and redeploy.",
          },
          { status: 503 }
        );
      }
      const bytes = Buffer.from(body.audioBase64, "base64");
      if (bytes.length === 0) {
        return NextResponse.json({ error: "audioBase64 decoded to nothing" }, { status: 400 });
      }
      // A fixed pathname per morning, overwritten on re-runs, so a re-press
      // never orphans a blob that nothing points at any more.
      const uploaded = await put(`station/${body.airDate}.mp3`, bytes, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "audio/mpeg",
      });
      audioUrl = uploaded.url;
    }

    const row = {
      userId: user.id,
      airDate: body.airDate,
      status: audioUrl ? "published" : "no_audio",
      audioUrl,
      audioDurationS: body.durationS ? Math.round(body.durationS) : null,
      waveform: body.waveform ?? null,
      segmentStarts: body.segmentStarts ?? null,
      transcript: body.transcript,
      factsUsed: body.factsUsed,
      writerModel: body.writerModel ?? null,
      ttsModel: body.ttsModel ?? null,
      publishedAt: new Date(),
    };

    const [saved] = await db
      .insert(episodes)
      .values(row)
      .onConflictDoUpdate({
        target: [episodes.userId, episodes.airDate],
        set: {
          status: row.status,
          audioUrl: row.audioUrl,
          audioDurationS: row.audioDurationS,
          waveform: row.waveform,
          segmentStarts: row.segmentStarts,
          transcript: row.transcript,
          factsUsed: row.factsUsed,
          writerModel: row.writerModel,
          ttsModel: row.ttsModel,
          publishedAt: row.publishedAt,
        },
      })
      .returning({ id: episodes.id });

    const pruned = await pruneExpiredAudio(user.id, getUserTimezone(user.settings));

    return NextResponse.json({
      data: { id: saved.id, airDate: body.airDate, status: row.status, audioUrl, pruned },
    });
  } catch (error) {
    console.error("Station publish error:", error);
    // The only caller is the authenticated worker; naming the failure in the
    // response turns a mystery 500 in the Actions log into a diagnosis.
    const detail = error instanceof Error ? `: ${error.message.slice(0, 200)}` : "";
    return NextResponse.json(
      { error: `Failed to publish episode${detail}` },
      { status: 500 }
    );
  }
}

/**
 * Drop the audio of mornings older than the retention window.
 *
 * The row survives with its transcript and waveform — the archive keeps the
 * words and the shape after the voice is gone — so this only frees blob
 * storage, which is what actually accumulates.
 */
async function pruneExpiredAudio(userId: string, tz: string): Promise<number> {
  const cutoff = shiftDate(localDateStr(new Date(), tz), -AUDIO_RETENTION_DAYS);

  const stale = await db
    .select({ id: episodes.id, audioUrl: episodes.audioUrl })
    .from(episodes)
    .where(
      and(
        lt(episodes.airDate, cutoff),
        isNotNull(episodes.audioUrl)
      )
    );

  if (stale.length === 0) return 0;

  // Blob first: if this throws the rows keep their URLs and the next run
  // retries. Nulling first would strand the blobs with nothing pointing at
  // them, and nothing would ever clean them up.
  await del(stale.map((e) => e.audioUrl!));

  await db
    .update(episodes)
    .set({ audioUrl: null, status: "expired" })
    .where(
      and(
        lt(episodes.airDate, cutoff),
        isNotNull(episodes.audioUrl)
      )
    );

  return stale.length;
}
