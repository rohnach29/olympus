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
import { db, users } from "@/lib/db";
import { buildStationFacts } from "@/lib/station/facts";

export const dynamic = "force-dynamic";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(request: NextRequest) {
  const secret = process.env.STATION_SECRET;
  if (!secret || secret.length < 32) {
    // Misconfiguration must fail loudly, never fall open.
    return NextResponse.json(
      { error: "STATION_SECRET is not configured" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = dateSchema.safeParse(request.nextUrl.searchParams.get("date"));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // Single-user instance: the station broadcasts to the one account.
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

  if (!user) {
    return NextResponse.json({ error: "No user exists" }, { status: 404 });
  }

  const facts = await buildStationFacts(user, parsed.data);
  return NextResponse.json({ data: facts });
}
