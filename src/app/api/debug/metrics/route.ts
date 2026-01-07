import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, healthMetrics, webhookLogs } from "@/lib/db";
import { eq, desc, sql, gte, and } from "drizzle-orm";

// Debug endpoint to check what metrics are stored
// DELETE THIS IN PRODUCTION!
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get today's date range (UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Get unique metric types stored
  const metricTypes = await db
    .select({
      metricType: healthMetrics.metricType,
      count: sql<number>`count(*)::int`,
    })
    .from(healthMetrics)
    .where(eq(healthMetrics.userId, user.id))
    .groupBy(healthMetrics.metricType);

  // Get today's steps breakdown
  const todaysSteps = await db
    .select({
      total: sql<number>`SUM(CAST(${healthMetrics.value} AS DECIMAL))`,
      count: sql<number>`count(*)::int`,
      minTime: sql<string>`MIN(${healthMetrics.recordedAt})`,
      maxTime: sql<string>`MAX(${healthMetrics.recordedAt})`,
    })
    .from(healthMetrics)
    .where(
      and(
        eq(healthMetrics.userId, user.id),
        eq(healthMetrics.metricType, "steps"),
        gte(healthMetrics.recordedAt, today)
      )
    );

  // Get recent metrics (last 10)
  const recentMetrics = await db
    .select()
    .from(healthMetrics)
    .where(eq(healthMetrics.userId, user.id))
    .orderBy(desc(healthMetrics.recordedAt))
    .limit(10);

  // Get resting HR specifically
  const restingHR = await db
    .select()
    .from(healthMetrics)
    .where(
      and(
        eq(healthMetrics.userId, user.id),
        eq(healthMetrics.metricType, "resting_heart_rate")
      )
    )
    .orderBy(desc(healthMetrics.recordedAt))
    .limit(5);

  // Get recent webhook logs
  const recentLogs = await db
    .select()
    .from(webhookLogs)
    .where(eq(webhookLogs.userId, user.id))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(5);

  return NextResponse.json({
    serverTodayUTC: today.toISOString(),
    metricTypes,
    todaysSteps: todaysSteps[0],
    restingHR,
    recentMetrics,
    recentLogs,
  });
}
