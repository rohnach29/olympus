/**
 * The needle drop: streams a morning's audio to its one listener.
 *
 * Episodes live in a private blob store — the URL alone plays nothing,
 * because a narrated health report is still health data. This route is the
 * only doorway: it checks the listener's session, finds their episode for
 * the date, and streams the mp3 through.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { db, episodes } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const [episode] = await db
      .select({ audioUrl: episodes.audioUrl })
      .from(episodes)
      .where(and(eq(episodes.userId, user.id), eq(episodes.airDate, date)))
      .limit(1);
    if (!episode?.audioUrl) {
      return NextResponse.json({ error: "No audio for this morning" }, { status: 404 });
    }

    const result = await get(episode.audioUrl, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "Audio not found in storage" }, { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        ...(result.blob.size ? { "Content-Length": String(result.blob.size) } : {}),
        // Private to the listener's browser; a pressing never changes after
        // air (re-presses overwrite, but that is rare and same-day).
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Station audio error:", error);
    return NextResponse.json({ error: "Failed to stream audio" }, { status: 500 });
  }
}
