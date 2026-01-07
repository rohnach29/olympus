import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, workouts } from "@/lib/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { calculateStrain, WorkoutData } from "@/lib/utils/recovery-scoring";

// GET - Get workouts with optional date range
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build query conditions
    const conditions = [eq(workouts.userId, user.id)];

    if (startDate) {
      conditions.push(gte(workouts.startedAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(workouts.startedAt, new Date(endDate)));
    }

    const results = await db
      .select()
      .from(workouts)
      .where(and(...conditions))
      .orderBy(desc(workouts.startedAt))
      .limit(limit);

    // Calculate weekly summary (current week)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weeklyWorkouts = results.filter(
      (w) => new Date(w.startedAt) >= weekStart
    );

    const summary = {
      count: weeklyWorkouts.length,
      totalMinutes: weeklyWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0),
      totalCalories: weeklyWorkouts.reduce(
        (sum, w) => sum + (w.caloriesBurned || 0),
        0
      ),
    };

    return NextResponse.json({
      workouts: results,
      summary,
    });
  } catch (error) {
    console.error("Get workouts error:", error);
    return NextResponse.json(
      { error: "Failed to get workouts" },
      { status: 500 }
    );
  }
}

// POST - Create a new workout
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      name,
      durationMinutes,
      caloriesBurned,
      heartRateAvg,
      heartRateMax,
      startedAt,
      endedAt,
      notes,
    } = body;

    if (!type || !name || !durationMinutes || !startedAt || !endedAt) {
      return NextResponse.json(
        { error: "Type, name, duration, start and end times are required" },
        { status: 400 }
      );
    }

    const [workout] = await db
      .insert(workouts)
      .values({
        userId: user.id,
        type,
        name,
        durationMinutes,
        caloriesBurned: caloriesBurned || null,
        heartRateAvg: heartRateAvg || null,
        heartRateMax: heartRateMax || null,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        notes: notes || null,
      })
      .returning();

    // Calculate strain for this workout using evidence-based TRIMP algorithm
    const workoutData: WorkoutData = {
      durationMinutes,
      heartRateAvg: heartRateAvg || null,
      heartRateMax: heartRateMax || null,
      type,
      caloriesBurned: caloriesBurned || null,
    };

    // Get user age for max HR calculation if available
    const userAge = user.dateOfBirth
      ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined;

    const strainResult = calculateStrain(workoutData, { age: userAge });

    return NextResponse.json({
      workout,
      strain: {
        score: strainResult.strainScore,
        category: strainResult.category,
        trimp: strainResult.trimp,
        description: strainResult.description,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Create workout error:", error);
    return NextResponse.json(
      { error: "Failed to create workout" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a workout
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workoutId = request.nextUrl.searchParams.get("id");
    if (!workoutId) {
      return NextResponse.json(
        { error: "Workout ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(workouts)
      .where(and(eq(workouts.id, workoutId), eq(workouts.userId, user.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete workout error:", error);
    return NextResponse.json(
      { error: "Failed to delete workout" },
      { status: 500 }
    );
  }
}
