/**
 * The one door between the app and the station worker.
 *
 * The nightly Python press run calls this with a bearer secret and gets the
 * distilled facts for a morning — the same numbers the ledger renders. Authed
 * by STATION_SECRET (a GitHub Actions secret on the caller's side), not by a
 * session: the worker is a machine, not a browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveStationUser, stationAuthError } from "@/lib/station/auth";
import { buildStationFacts } from "@/lib/station/facts";

export const dynamic = "force-dynamic";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(request: NextRequest) {
  try {
    const denied = stationAuthError(request);
    if (denied) return denied;

    const parsed = dateSchema.safeParse(request.nextUrl.searchParams.get("date"));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "date must be YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const user = await resolveStationUser();
    if (!user) {
      return NextResponse.json({ error: "No user exists" }, { status: 404 });
    }

    const facts = await buildStationFacts(user, parsed.data);
    return NextResponse.json({ data: facts });
  } catch (error) {
    console.error("Station facts error:", error);
    return NextResponse.json({ error: "Failed to build facts" }, { status: 500 });
  }
}
