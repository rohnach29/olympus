import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, healthMetrics, webhookLogs } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";

// Debug endpoint to check what metrics are stored
// DELETE THIS IN PRODUCTION!
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get unique metric types stored
  const metricTypes = await db
    .select({
      metricType: healthMetrics.metricType,
      count: sql<number>`count(*)::int`,
    })
    .from(healthMetrics)
    .where(eq(healthMetrics.userId, user.id))
    .groupBy(healthMetrics.metricType);

  // Get recent metrics (last 10)
  const recentMetrics = await db
    .select()
    .from(healthMetrics)
    .where(eq(healthMetrics.userId, user.id))
    .orderBy(desc(healthMetrics.recordedAt))
    .limit(10);

  // Get recent webhook logs
  const recentLogs = await db
    .select()
    .from(webhookLogs)
    .where(eq(webhookLogs.userId, user.id))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(5);

  return NextResponse.json({
    metricTypes,
    recentMetrics,
    recentLogs,
  });
}
