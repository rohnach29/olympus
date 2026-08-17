/**
 * How the station worker proves it is the station worker.
 *
 * The nightly press run is a machine, not a browser: it carries a shared
 * secret rather than a session cookie. Both station routes authenticate the
 * same way, so the check lives here rather than being copied.
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import type { LedgerUser } from "@/lib/ledger/assemble";

/**
 * Returns an error response if the caller is not the worker, or null if it is.
 *
 * A missing secret is a 500, never a pass: a misconfigured deployment must
 * fail closed and loudly rather than quietly serving health data to anyone.
 */
export function stationAuthError(request: NextRequest): NextResponse | null {
  const secret = process.env.STATION_SECRET;

  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { error: "STATION_SECRET is not configured" },
      { status: 500 }
    );
  }

  const offered = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  // Compared in constant time so a wrong guess reveals nothing through how
  // long the rejection took. timingSafeEqual throws on length mismatch, so
  // the lengths are checked first — that much is public anyway.
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/**
 * The account the station broadcasts to.
 *
 * Olympus is a single-user instance (signup is gated to one address), so the
 * worker never names a user — it asks for "the" user. This is the one place
 * that assumption lives; multi-user would replace this function alone.
 */
export async function resolveStationUser(): Promise<LedgerUser | null> {
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

  return user ?? null;
}
