import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDayLedger, getMonthLedger } from "@/lib/ledger/assemble";
import { getUserTimezone } from "@/lib/utils/timezone";
import { localDateStr } from "@/lib/ledger/time";

/**
 * Inspect the assembled ledger for a date, as JSON.
 *
 * Runs inside Next, so it sees the same database, aliases and environment the
 * pages do — which makes it the honest integration check for the data layer
 * before any of it is styled. Sample arrays are summarised rather than dumped;
 * a day of heart-rate data is thousands of points.
 *
 * GET /api/debug/ledger?date=2026-08-15
 * GET /api/debug/ledger?month=2026-08
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tz = getUserTimezone(user.settings);
  const params = request.nextUrl.searchParams;
  const month = params.get("month");

  try {
    if (month) {
      const ledger = await getMonthLedger(user, month);
      return NextResponse.json({
        ...ledger,
        cells: ledger.cells.filter((c) => c.printed),
      });
    }

    const date = params.get("date") ?? localDateStr(new Date(), tz);
    const l = await getDayLedger(user, date);

    return NextResponse.json({
      date: l.date,
      tz: l.tz,
      isToday: l.isToday,
      weekday: l.weekday,
      city: l.city,
      reportNo: l.reportNo,
      nowT: l.nowT,
      watch: l.watch,
      verdict: l.verdict,
      footnotes: l.footnotes,
      week: l.week,
      tracks: {
        heart: l.tracks.heart && {
          runs: l.tracks.heart.runs.length,
          points: l.tracks.heart.runs.reduce((n, r) => n + r.length, 0),
          samples: l.tracks.heart.sampleCount,
          rest: l.tracks.heart.rest,
          low: l.tracks.heart.low,
          peak: l.tracks.heart.peak,
          peakAt: l.tracks.heart.peakAt,
          band: [l.tracks.heart.floor, l.tracks.heart.ceil],
          firstPoints: l.tracks.heart.runs[0]?.slice(0, 3),
        },
        sleep: l.tracks.sleep,
        fuel: l.tracks.fuel,
        steps: l.tracks.steps && {
          total: l.tracks.steps.total,
          peakHour: l.tracks.steps.peakHour,
          hourly: l.tracks.steps.hourly,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to assemble ledger",
        detail: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6) : undefined,
      },
      { status: 500 }
    );
  }
}
