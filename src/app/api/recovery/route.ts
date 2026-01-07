import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, dailyScores, healthMetrics, sleepSessions, workouts } from "@/lib/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  calculateRecovery,
  calculateRecoveryBaseline,
  calculateDailyStrain,
  RecoveryBaseline,
  WorkoutData,
} from "@/lib/utils/recovery-scoring";

// GET - Get recovery/daily scores and health metrics with evidence-based calculations
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7");

    const today = new Date().toISOString().split("T")[0];

    // Get date 14 days ago for baseline calculation
    const baselineDate = new Date();
    baselineDate.setDate(baselineDate.getDate() - 14);

    // Fetch sleep sessions for baseline and current data
    const sleepData = await db
      .select()
      .from(sleepSessions)
      .where(
        and(
          eq(sleepSessions.userId, user.id),
          gte(sleepSessions.sleepDate, baselineDate.toISOString().split("T")[0])
        )
      )
      .orderBy(desc(sleepSessions.sleepDate))
      .limit(14);

    // Get today's sleep (or most recent)
    const todaySleep = sleepData[0] || null;

    // Fetch health metrics for baseline
    const recentMetrics = await db
      .select()
      .from(healthMetrics)
      .where(eq(healthMetrics.userId, user.id))
      .orderBy(desc(healthMetrics.recordedAt))
      .limit(100);

    // Group metrics by type
    const metricsByType: Record<string, { latest: number; values: number[] }> = {};
    recentMetrics.forEach((m) => {
      if (!metricsByType[m.metricType]) {
        metricsByType[m.metricType] = { latest: Number(m.value), values: [] };
      }
      metricsByType[m.metricType].values.push(Number(m.value));
    });

    // Get yesterday's workouts for strain calculation
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayWorkouts = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, user.id),
          gte(workouts.startedAt, yesterdayStart)
        )
      )
      .limit(10);

    // Calculate previous day strain using evidence-based algorithm
    const workoutData: WorkoutData[] = yesterdayWorkouts.map(w => ({
      durationMinutes: w.durationMinutes,
      heartRateAvg: w.heartRateAvg,
      heartRateMax: w.heartRateMax,
      type: w.type,
      caloriesBurned: w.caloriesBurned,
    }));

    const userAge = user.dateOfBirth
      ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined;

    const strainResult = calculateDailyStrain(workoutData, { age: userAge });

    // Calculate personal recovery baseline from historical data
    const baselineData = sleepData.map(s => ({
      hrvAvg: s.hrvAvg,
      restingHr: s.restingHr,
      bedtimeMinutes: s.bedtime ? new Date(s.bedtime).getHours() * 60 + new Date(s.bedtime).getMinutes() : null,
    }));

    const recoveryBaseline: RecoveryBaseline | null = calculateRecoveryBaseline(baselineData);

    // Get current HRV and resting HR (from sleep or health metrics)
    const currentHrv = todaySleep?.hrvAvg || metricsByType["hrv"]?.latest || null;
    const currentRestingHr = todaySleep?.restingHr || metricsByType["resting_hr"]?.latest || null;
    const todaySleepScore = todaySleep?.sleepScore || 0;

    // Calculate bedtime in minutes from midnight
    const todayBedtime = todaySleep?.bedtime
      ? new Date(todaySleep.bedtime).getHours() * 60 + new Date(todaySleep.bedtime).getMinutes()
      : null;

    // Calculate recovery using evidence-based algorithm
    const recoveryResult = calculateRecovery({
      sleepScore: todaySleepScore,
      hrvValue: currentHrv,
      restingHr: currentRestingHr,
      previousDayStrain: strainResult.strainScore,
      bedtimeMinutes: todayBedtime,
      baseline: recoveryBaseline,
    });

    // Calculate trends
    const calculateTrend = (values: number[]): number => {
      if (values.length < 2) return 0;
      const latest = values[0];
      const avg = values.slice(1, 8).reduce((a, b) => a + b, 0) / Math.min(values.length - 1, 7);
      return Math.round((latest - avg) * 10) / 10;
    };

    const metrics = {
      hrv: {
        value: currentHrv || 0,
        trend: calculateTrend(metricsByType["hrv"]?.values || []),
        unit: "ms",
        baseline: recoveryBaseline?.hrvAvg || null,
      },
      restingHr: {
        value: currentRestingHr || 0,
        trend: calculateTrend(metricsByType["resting_hr"]?.values || []),
        unit: "bpm",
        baseline: recoveryBaseline?.restingHrAvg || null,
      },
      respiratoryRate: {
        value: metricsByType["respiratory_rate"]?.latest || 0,
        trend: calculateTrend(metricsByType["respiratory_rate"]?.values || []),
        unit: "br/min",
      },
      steps: {
        value: metricsByType["steps"]?.latest || 0,
        unit: "steps",
      },
      activeCalories: {
        value: metricsByType["active_calories"]?.latest || 0,
        unit: "kcal",
      },
    };

    // Build recovery factors from evidence-based components
    const recoveryFactors = [
      {
        name: "Sleep Quality",
        score: recoveryResult.components.sleepQuality.score,
        weight: `${Math.round(recoveryResult.components.sleepQuality.weight * 100)}%`,
        impact: recoveryResult.components.sleepQuality.score >= 75 ? "positive" : recoveryResult.components.sleepQuality.score >= 50 ? "neutral" : "negative",
      },
      {
        name: "HRV Status",
        score: recoveryResult.components.hrvStatus.score,
        weight: `${Math.round(recoveryResult.components.hrvStatus.weight * 100)}%`,
        impact: recoveryResult.components.hrvStatus.score >= 75 ? "positive" : recoveryResult.components.hrvStatus.score >= 50 ? "neutral" : "negative",
        zScore: recoveryResult.components.hrvStatus.zScore,
      },
      {
        name: "Resting HR",
        score: recoveryResult.components.restingHrStatus.score,
        weight: `${Math.round(recoveryResult.components.restingHrStatus.weight * 100)}%`,
        impact: recoveryResult.components.restingHrStatus.score >= 75 ? "positive" : recoveryResult.components.restingHrStatus.score >= 50 ? "neutral" : "negative",
        zScore: recoveryResult.components.restingHrStatus.zScore,
      },
      {
        name: "Previous Strain",
        score: recoveryResult.components.strainImpact.score,
        weight: `${Math.round(recoveryResult.components.strainImpact.weight * 100)}%`,
        impact: recoveryResult.components.strainImpact.score >= 75 ? "positive" : recoveryResult.components.strainImpact.score >= 50 ? "neutral" : "negative",
      },
      {
        name: "Sleep Consistency",
        score: recoveryResult.components.sleepConsistency.score,
        weight: `${Math.round(recoveryResult.components.sleepConsistency.weight * 100)}%`,
        impact: recoveryResult.components.sleepConsistency.score >= 75 ? "positive" : recoveryResult.components.sleepConsistency.score >= 50 ? "neutral" : "negative",
      },
    ];

    // Get historical daily scores for trend (or calculate them)
    const existingScores = await db
      .select()
      .from(dailyScores)
      .where(eq(dailyScores.userId, user.id))
      .orderBy(desc(dailyScores.date))
      .limit(days);

    // Build trend data from existing scores + today's calculated values
    const trendData = existingScores.map(s => ({
      date: s.date,
      recoveryScore: Number(s.recoveryScore) || 0,
      sleepScore: Number(s.sleepScore) || 0,
      strainScore: Number(s.strainScore) || 0,
    }));

    // Add today if not in existing scores
    if (!trendData.find(t => t.date === today)) {
      trendData.unshift({
        date: today,
        recoveryScore: recoveryResult.recoveryScore,
        sleepScore: todaySleepScore,
        strainScore: strainResult.strainScore,
      });
    }

    return NextResponse.json({
      today: {
        date: today,
        recoveryScore: recoveryResult.recoveryScore,
        sleepScore: todaySleepScore,
        strainScore: strainResult.strainScore,
        readinessScore: Math.round((recoveryResult.recoveryScore + todaySleepScore) / 2), // Simplified readiness
      },
      status: recoveryResult.category.charAt(0).toUpperCase() + recoveryResult.category.slice(1),
      recommendation: recoveryResult.recommendation,
      trainingRecommendation: recoveryResult.trainingRecommendation,
      trend: trendData.slice(0, days),
      metrics,
      factors: recoveryFactors,
      baseline: recoveryBaseline ? {
        hrvAvg: recoveryBaseline.hrvAvg,
        restingHrAvg: recoveryBaseline.restingHrAvg,
        dataPoints: baselineData.length,
      } : null,
      strain: {
        yesterdayStrain: strainResult.strainScore,
        category: strainResult.category,
        trimp: strainResult.trimp,
        description: strainResult.description,
      },
    });
  } catch (error) {
    console.error("Get recovery data error:", error);
    return NextResponse.json(
      { error: "Failed to get recovery data" },
      { status: 500 }
    );
  }
}
