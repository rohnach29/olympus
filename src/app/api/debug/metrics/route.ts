import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, healthMetrics, webhookLogs } from "@/lib/db";
import { eq, desc, sql, gte, and, or, isNull } from "drizzle-orm";

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

  // Find suspicious test data (round numbers, missing originalSource)
  const suspiciousData = await db
    .select()
    .from(healthMetrics)
    .where(
      and(
        eq(healthMetrics.userId, user.id),
        eq(healthMetrics.metricType, "steps"),
        sql`CAST(${healthMetrics.value} AS DECIMAL) >= 100` // Round numbers >= 100
      )
    )
    .limit(20);

  return NextResponse.json({
    serverTodayUTC: today.toISOString(),
    metricTypes,
    todaysSteps: todaysSteps[0],
    restingHR,
    suspiciousData, // Test data with round values
    recentMetrics,
    recentLogs,
  });
}

// DELETE suspicious/test data
export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "test-data") {
    // Delete step records with suspiciously round values (likely test data)
    const deleted = await db
      .delete(healthMetrics)
      .where(
        and(
          eq(healthMetrics.userId, user.id),
          eq(healthMetrics.metricType, "steps"),
          sql`CAST(${healthMetrics.value} AS DECIMAL) >= 100`
        )
      )
      .returning({ id: healthMetrics.id, value: healthMetrics.value });

    return NextResponse.json({
      message: "Deleted suspicious test data",
      deletedCount: deleted.length,
      deleted,
    });
  }

  if (action === "all-steps") {
    // Nuclear option: delete ALL step data to start fresh
    const deleted = await db
      .delete(healthMetrics)
      .where(
        and(
          eq(healthMetrics.userId, user.id),
          eq(healthMetrics.metricType, "steps")
        )
      )
      .returning({ id: healthMetrics.id });

    return NextResponse.json({
      message: "Deleted all step data",
      deletedCount: deleted.length,
    });
  }

  return NextResponse.json({
    error: "Specify action: ?action=test-data or ?action=all-steps",
  }, { status: 400 });
}
