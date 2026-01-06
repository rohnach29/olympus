import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, dailyScores, healthMetrics } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

// GET - Get recovery/daily scores and health metrics
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7");

    // Get daily scores for date range
    const scores = await db
      .select()
      .from(dailyScores)
      .where(eq(dailyScores.userId, user.id))
      .orderBy(desc(dailyScores.date))
      .limit(days);

    // Get today's score
    const today = new Date().toISOString().split("T")[0];
    const todayScore = scores.find((s) => s.date === today) || scores[0] || null;

    // Get recent health metrics for trends
    const recentMetrics = await db
      .select()
      .from(healthMetrics)
      .where(eq(healthMetrics.userId, user.id))
      .orderBy(desc(healthMetrics.recordedAt))
      .limit(50);

    // Group metrics by type and get latest + trend
    const metricsByType: Record<string, { latest: number; values: number[] }> = {};

    recentMetrics.forEach((m) => {
      if (!metricsByType[m.metricType]) {
        metricsByType[m.metricType] = { latest: Number(m.value), values: [] };
      }
      metricsByType[m.metricType].values.push(Number(m.value));
    });

    // Calculate trends (compare latest to 7-day average)
    const calculateTrend = (values: number[]): number => {
      if (values.length < 2) return 0;
      const latest = values[0];
      const avg = values.slice(1, 8).reduce((a, b) => a + b, 0) / Math.min(values.length - 1, 7);
      return latest - avg;
    };

    const metrics = {
      hrv: {
        value: metricsByType["hrv"]?.latest || 0,
        trend: calculateTrend(metricsByType["hrv"]?.values || []),
        unit: "ms",
      },
      restingHr: {
        value: metricsByType["resting_hr"]?.latest || 0,
        trend: calculateTrend(metricsByType["resting_hr"]?.values || []),
        unit: "bpm",
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

    // Calculate recovery factors (what contributes to recovery score)
    const recoveryFactors = [];

    if (todayScore) {
      // Sleep quality impact
      const sleepScore = Number(todayScore.sleepScore) || 0;
      recoveryFactors.push({
        name: "Sleep Quality",
        score: sleepScore,
        impact: sleepScore >= 80 ? "positive" : sleepScore >= 60 ? "neutral" : "negative",
      });

      // HRV impact (higher is better, compare to baseline)
      const hrvValue = metrics.hrv.value;
      const hrvScore = Math.min(100, Math.round((hrvValue / 60) * 100)); // Assuming 60ms is excellent
      recoveryFactors.push({
        name: "HRV",
        score: hrvScore,
        impact: hrvValue >= 50 ? "positive" : hrvValue >= 35 ? "neutral" : "negative",
      });

      // Resting HR impact (lower is better)
      const restingHr = metrics.restingHr.value;
      const hrScore = restingHr <= 55 ? 95 : restingHr <= 65 ? 80 : 60;
      recoveryFactors.push({
        name: "Resting HR",
        score: hrScore,
        impact: restingHr <= 55 ? "positive" : restingHr <= 65 ? "neutral" : "negative",
      });

      // Previous strain impact
      const strainScore = Number(todayScore.strainScore) || 0;
      const strainImpact = strainScore <= 10 ? "positive" : strainScore <= 15 ? "neutral" : "negative";
      recoveryFactors.push({
        name: "Previous Strain",
        score: Math.max(0, 100 - strainScore * 5),
        impact: strainImpact,
      });
    }

    // Get recovery status message
    const getRecoveryStatus = (score: number): { status: string; recommendation: string } => {
      if (score >= 85) {
        return {
          status: "Optimal",
          recommendation: "Your body is fully recovered. Great day for intense training!",
        };
      } else if (score >= 70) {
        return {
          status: "Good",
          recommendation: "You're well recovered. Moderate to high intensity training is fine.",
        };
      } else if (score >= 50) {
        return {
          status: "Moderate",
          recommendation: "Consider lighter training today. Focus on technique or active recovery.",
        };
      } else {
        return {
          status: "Low",
          recommendation: "Rest is recommended. Light stretching or complete rest would be beneficial.",
        };
      }
    };

    const recoveryScore = Number(todayScore?.recoveryScore) || 0;
    const { status, recommendation } = getRecoveryStatus(recoveryScore);

    return NextResponse.json({
      today: todayScore
        ? {
            date: todayScore.date,
            recoveryScore: Number(todayScore.recoveryScore) || 0,
            sleepScore: Number(todayScore.sleepScore) || 0,
            strainScore: Number(todayScore.strainScore) || 0,
            readinessScore: Number(todayScore.readinessScore) || 0,
          }
        : null,
      status,
      recommendation,
      trend: scores.map((s) => ({
        date: s.date,
        recoveryScore: Number(s.recoveryScore) || 0,
        sleepScore: Number(s.sleepScore) || 0,
        strainScore: Number(s.strainScore) || 0,
      })),
      metrics,
      factors: recoveryFactors,
    });
  } catch (error) {
    console.error("Get recovery data error:", error);
    return NextResponse.json(
      { error: "Failed to get recovery data" },
      { status: 500 }
    );
  }
}
