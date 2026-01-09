import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, sleepSessions } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import {
  calculateSleepScore,
  calculatePersonalBaseline,
  SleepSessionData,
} from "@/lib/utils/sleep-scoring";
import { getYesterdayDateString, getUserTimezone } from "@/lib/utils/timezone";

// GET - Get sleep sessions
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date"); // Get specific night
    const limit = parseInt(searchParams.get("limit") || "7");

    // Get user's timezone for "last night" calculation
    const userTimezone = getUserTimezone(user.settings);
    const lastNightDate = getYesterdayDateString(userTimezone);

    let results;

    if (date) {
      // Get specific night
      results = await db
        .select()
        .from(sleepSessions)
        .where(
          and(
            eq(sleepSessions.userId, user.id),
            eq(sleepSessions.sleepDate, date)
          )
        )
        .limit(1);
    } else {
      // Get recent nights
      results = await db
        .select()
        .from(sleepSessions)
        .where(eq(sleepSessions.userId, user.id))
        .orderBy(desc(sleepSessions.sleepDate))
        .limit(limit);
    }

    // `latest` is the most recent session (for charts/trends)
    const latest = results[0] || null;

    // `lastNight` is specifically yesterday's session (for "Last Night's Sleep" display)
    // This prevents showing stale data when no sleep was logged last night
    const lastNight = results.find((s) => s.sleepDate === lastNightDate) || null;

    // Calculate weekly average (only count sessions with valid data)
    const sessionsWithScores = results.filter((s) => s.sleepScore !== null);
    const weeklyAvg =
      results.length > 0
        ? {
            avgScore:
              sessionsWithScores.length > 0
                ? Math.round(
                    sessionsWithScores.reduce((sum, s) => sum + (s.sleepScore || 0), 0) /
                      sessionsWithScores.length
                  )
                : 0,
            avgDurationMinutes: Math.round(
              results.reduce((sum, s) => sum + s.totalMinutes, 0) /
                results.length
            ),
            avgEfficiency:
              Math.round(
                (results.reduce((sum, s) => sum + Number(s.efficiency || 0), 0) /
                  results.length) *
                  10
              ) / 10,
            avgDeepMinutes: Math.round(
              results.reduce((sum, s) => sum + (s.deepSleepMinutes || 0), 0) /
                results.length
            ),
            avgRemMinutes: Math.round(
              results.reduce((sum, s) => sum + (s.remSleepMinutes || 0), 0) /
                results.length
            ),
          }
        : null;

    // Calculate score breakdown for latest session
    let scoreDetails = null;
    if (latest) {
      // Convert results to SleepSessionData for baseline calculation
      const historyData: SleepSessionData[] = results.map((s) => ({
        totalMinutes: s.totalMinutes,
        inBedMinutes: s.inBedMinutes,
        deepSleepMinutes: s.deepSleepMinutes || 0,
        remSleepMinutes: s.remSleepMinutes || 0,
        lightSleepMinutes: s.lightSleepMinutes || 0,
        awakeMinutes: s.awakeMinutes || 0,
        sleepLatencyMinutes: s.sleepLatencyMinutes || 0,
        hrvAvg: s.hrvAvg,
      }));

      const baseline = calculatePersonalBaseline(historyData);
      const latestData: SleepSessionData = {
        totalMinutes: latest.totalMinutes,
        inBedMinutes: latest.inBedMinutes,
        deepSleepMinutes: latest.deepSleepMinutes || 0,
        remSleepMinutes: latest.remSleepMinutes || 0,
        lightSleepMinutes: latest.lightSleepMinutes || 0,
        awakeMinutes: latest.awakeMinutes || 0,
        sleepLatencyMinutes: latest.sleepLatencyMinutes || 0,
        hrvAvg: latest.hrvAvg,
      };

      scoreDetails = calculateSleepScore(latestData, baseline);
    }

    return NextResponse.json({
      sessions: results,
      latest,
      lastNight, // Specifically yesterday's data (null if no data for last night)
      weeklyAverage: weeklyAvg,
      scoreDetails,
    });
  } catch (error) {
    console.error("Get sleep sessions error:", error);
    return NextResponse.json(
      { error: "Failed to get sleep sessions" },
      { status: 500 }
    );
  }
}

// POST - Log a sleep session
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      bedtime,
      wakeTime,
      sleepDate,
      totalMinutes,
      inBedMinutes,
      deepSleepMinutes,
      remSleepMinutes,
      lightSleepMinutes,
      awakeMinutes,
      sleepLatencyMinutes,
      efficiency,
      hrvAvg,
      restingHr,
      respiratoryRate,
      source,
    } = body;

    if (!bedtime || !wakeTime || !sleepDate || !totalMinutes || !inBedMinutes) {
      return NextResponse.json(
        { error: "Bedtime, wake time, date, and duration are required" },
        { status: 400 }
      );
    }

    // Fetch user's sleep history for baseline calculation
    const history = await db
      .select()
      .from(sleepSessions)
      .where(eq(sleepSessions.userId, user.id))
      .orderBy(desc(sleepSessions.sleepDate))
      .limit(14);

    // Convert to SleepSessionData format
    const historyData: SleepSessionData[] = history.map((s) => ({
      totalMinutes: s.totalMinutes,
      inBedMinutes: s.inBedMinutes,
      deepSleepMinutes: s.deepSleepMinutes || 0,
      remSleepMinutes: s.remSleepMinutes || 0,
      lightSleepMinutes: s.lightSleepMinutes || 0,
      awakeMinutes: s.awakeMinutes || 0,
      sleepLatencyMinutes: s.sleepLatencyMinutes || 0,
      hrvAvg: s.hrvAvg,
    }));

    // Calculate personal baseline from history
    const baseline = calculatePersonalBaseline(historyData);

    // Prepare current session data for scoring
    const sessionData: SleepSessionData = {
      totalMinutes,
      inBedMinutes,
      deepSleepMinutes: deepSleepMinutes || 0,
      remSleepMinutes: remSleepMinutes || 0,
      lightSleepMinutes: lightSleepMinutes || 0,
      awakeMinutes: awakeMinutes || 0,
      sleepLatencyMinutes: sleepLatencyMinutes || 0,
      hrvAvg: hrvAvg || null,
    };

    // Calculate sleep score using evidence-based algorithm
    const scoreResult = calculateSleepScore(sessionData, baseline);

    // Calculate efficiency if not provided
    const calculatedEfficiency =
      efficiency || ((totalMinutes / inBedMinutes) * 100).toFixed(1);

    const [session] = await db
      .insert(sleepSessions)
      .values({
        userId: user.id,
        bedtime: new Date(bedtime),
        wakeTime: new Date(wakeTime),
        sleepDate,
        totalMinutes,
        inBedMinutes,
        deepSleepMinutes: deepSleepMinutes || 0,
        remSleepMinutes: remSleepMinutes || 0,
        lightSleepMinutes: lightSleepMinutes || 0,
        awakeMinutes: awakeMinutes || 0,
        sleepLatencyMinutes: sleepLatencyMinutes || 0,
        sleepScore: scoreResult.totalScore,
        efficiency: calculatedEfficiency,
        hrvAvg: hrvAvg || null,
        restingHr: restingHr || null,
        respiratoryRate: respiratoryRate || null,
        source: source || "manual",
      })
      .returning();

    return NextResponse.json(
      {
        session,
        scoreDetails: scoreResult,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create sleep session error:", error);
    return NextResponse.json(
      { error: "Failed to create sleep session" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a sleep session
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("id");
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(sleepSessions)
      .where(
        and(eq(sleepSessions.id, sessionId), eq(sleepSessions.userId, user.id))
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete sleep session error:", error);
    return NextResponse.json(
      { error: "Failed to delete sleep session" },
      { status: 500 }
    );
  }
}
