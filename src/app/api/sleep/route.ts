import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, sleepSessions } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

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

    const latest = results[0] || null;

    // Calculate weekly average
    const weeklyAvg =
      results.length > 0
        ? {
            avgScore: Math.round(
              results.reduce((sum, s) => sum + (s.sleepScore || 0), 0) /
                results.length
            ),
            avgDurationMinutes: Math.round(
              results.reduce((sum, s) => sum + s.totalMinutes, 0) /
                results.length
            ),
            avgEfficiency:
              results.reduce((sum, s) => sum + Number(s.efficiency || 0), 0) /
              results.length,
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

    return NextResponse.json({
      sessions: results,
      latest,
      weeklyAverage: weeklyAvg,
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
      sleepScore,
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
        sleepScore: sleepScore || null,
        efficiency: efficiency || null,
        hrvAvg: hrvAvg || null,
        restingHr: restingHr || null,
        respiratoryRate: respiratoryRate || null,
        source: source || "manual",
      })
      .returning();

    return NextResponse.json({ session }, { status: 201 });
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
