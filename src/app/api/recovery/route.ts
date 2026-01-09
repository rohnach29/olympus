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
import { getTodayInTimezone, getTodayDateString, getUserTimezone } from "@/lib/utils/timezone";

// GET - Get recovery/daily scores and health metrics with evidence-based calculations
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7");

    // Use user's timezone for "today" calculation
    const userTimezone = getUserTimezone(user.settings);
    const today = getTodayDateString(userTimezone);
    const todayStart = getTodayInTimezone(userTimezone);

    // Get date 14 days ago for baseline calculation (relative, so timezone doesn't matter much)
    const baselineDate = new Date(todayStart);
    baselineDate.setDate(baselineDate.getDate() - 14);

    // Calculate yesterday's date (sleep from last night has sleepDate = yesterday)
    const yesterdayDate = new Date(todayStart);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayDateStr = yesterdayDate.toISOString().split("T")[0];

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

    // Get sleep from LAST NIGHT only (sleepDate should be yesterday)
    // Recovery today is based on sleep from the previous night, not older sleep
    const todaySleep = sleepData.find(s => s.sleepDate === yesterdayDateStr) || null;

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

    // Get yesterday's workouts for strain calculation (in user's timezone)
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    // yesterdayEnd is just before todayStart
    const yesterdayEnd = new Date(todayStart.getTime() - 1);

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

    // Get current HRV and resting HR ONLY from last night's sleep
    // Don't fall back to old metrics - we need data from the actual recovery period
    const currentHrv = todaySleep?.hrvAvg ?? null;
    const currentRestingHr = todaySleep?.restingHr ?? null;
    const todaySleepScore = todaySleep?.sleepScore ?? null;

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

    // Helper to determine impact based on score
    const getImpact = (score: number | null, hasData: boolean): string => {
      if (!hasData || score === null) return "no_data";
      if (score >= 75) return "positive";
      if (score >= 50) return "neutral";
      return "negative";
    };

    // Build recovery factors from evidence-based components
    const recoveryFactors = [
      {
        name: "Sleep Quality",
        score: recoveryResult.components.sleepQuality.score,
        weight: `${Math.round(recoveryResult.components.sleepQuality.weight * 100)}%`,
        impact: getImpact(recoveryResult.components.sleepQuality.score, recoveryResult.components.sleepQuality.hasData),
        hasData: recoveryResult.components.sleepQuality.hasData,
      },
      {
        name: "HRV Status",
        score: recoveryResult.components.hrvStatus.score,
        weight: `${Math.round(recoveryResult.components.hrvStatus.weight * 100)}%`,
        impact: getImpact(recoveryResult.components.hrvStatus.score, recoveryResult.components.hrvStatus.hasData),
        zScore: recoveryResult.components.hrvStatus.zScore,
        hasData: recoveryResult.components.hrvStatus.hasData,
      },
      {
        name: "Resting HR",
        score: recoveryResult.components.restingHrStatus.score,
        weight: `${Math.round(recoveryResult.components.restingHrStatus.weight * 100)}%`,
        impact: getImpact(recoveryResult.components.restingHrStatus.score, recoveryResult.components.restingHrStatus.hasData),
        zScore: recoveryResult.components.restingHrStatus.zScore,
        hasData: recoveryResult.components.restingHrStatus.hasData,
      },
      {
        name: "Previous Strain",
        score: recoveryResult.components.strainImpact.score,
        weight: `${Math.round(recoveryResult.components.strainImpact.weight * 100)}%`,
        impact: getImpact(recoveryResult.components.strainImpact.score, recoveryResult.components.strainImpact.hasData),
        hasData: recoveryResult.components.strainImpact.hasData,
      },
      {
        name: "Sleep Consistency",
        score: recoveryResult.components.sleepConsistency.score,
        weight: `${Math.round(recoveryResult.components.sleepConsistency.weight * 100)}%`,
        impact: getImpact(recoveryResult.components.sleepConsistency.score, recoveryResult.components.sleepConsistency.hasData),
        hasData: recoveryResult.components.sleepConsistency.hasData,
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

    // Add today if not in existing scores (only if we have a valid score)
    // When recoveryScore is not null, we have all data including sleep
    if (!trendData.find(t => t.date === today) && recoveryResult.recoveryScore !== null && todaySleepScore !== null) {
      trendData.unshift({
        date: today,
        recoveryScore: recoveryResult.recoveryScore,
        sleepScore: todaySleepScore,
        strainScore: strainResult.strainScore,
      });
    }

    // Calculate readiness only if we have recovery score and sleep score
    const readinessScore = recoveryResult.recoveryScore !== null && todaySleepScore !== null
      ? Math.round((recoveryResult.recoveryScore + todaySleepScore) / 2)
      : null;

    // Format category for display (capitalize first letter, handle underscore)
    const formattedStatus = recoveryResult.category === "insufficient_data"
      ? "Insufficient Data"
      : recoveryResult.category.charAt(0).toUpperCase() + recoveryResult.category.slice(1);

    return NextResponse.json({
      today: recoveryResult.hasEnoughData ? {
        date: today,
        recoveryScore: recoveryResult.recoveryScore,
        sleepScore: todaySleepScore,
        strainScore: strainResult.strainScore,
        readinessScore,
      } : null,
      hasEnoughData: recoveryResult.hasEnoughData,
      status: formattedStatus,
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
