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

  // Get HRV data (recent values)
  const hrvData = await db
    .select({
      id: healthMetrics.id,
      value: healthMetrics.value,
      unit: healthMetrics.unit,
      recordedAt: healthMetrics.recordedAt,
      metadata: healthMetrics.metadata,
    })
    .from(healthMetrics)
    .where(
      and(
        eq(healthMetrics.userId, user.id),
        eq(healthMetrics.metricType, "hrv")
      )
    )
    .orderBy(desc(healthMetrics.recordedAt))
    .limit(10);

  // Get today's HRV specifically
  const todaysHRV = await db
    .select({
      value: healthMetrics.value,
      recordedAt: healthMetrics.recordedAt,
      metadata: healthMetrics.metadata,
    })
    .from(healthMetrics)
    .where(
      and(
        eq(healthMetrics.userId, user.id),
        eq(healthMetrics.metricType, "hrv"),
        gte(healthMetrics.recordedAt, today)
      )
    )
    .orderBy(desc(healthMetrics.recordedAt));

  // Get calories_active specifically (recent 5)
  const caloriesActive = await db
    .select()
    .from(healthMetrics)
    .where(
      and(
        eq(healthMetrics.userId, user.id),
        eq(healthMetrics.metricType, "calories_active")
      )
    )
    .orderBy(desc(healthMetrics.recordedAt))
    .limit(5);

  // Get today's calories breakdown
  const todaysCalories = await db
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
        eq(healthMetrics.metricType, "calories_active"),
        gte(healthMetrics.recordedAt, today)
      )
    );

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
    todaysCalories: todaysCalories[0],
    hrv: {
      todaysHRV,
      recentHRV: hrvData,
    },
    restingHR,
    caloriesActive,
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

  if (action === "dedupe-hrv") {
    // Remove duplicate HRV records, keeping only the first one per timestamp
    // This uses a subquery to find all IDs that are NOT the "first" record for each unique combo
    const duplicates = await db.execute(sql`
      DELETE FROM health_metrics
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY user_id, metric_type, recorded_at
              ORDER BY created_at ASC
            ) as rn
          FROM health_metrics
          WHERE user_id = ${user.id}
            AND metric_type = 'hrv'
        ) subq
        WHERE rn > 1
      )
      RETURNING id
    `);

    return NextResponse.json({
      message: "Removed duplicate HRV records",
      deletedCount: Array.isArray(duplicates) ? duplicates.length : 0,
    });
  }

  if (action === "dedupe-all") {
    // Remove ALL duplicate health metrics (any type), keeping only the first one per timestamp
    const duplicates = await db.execute(sql`
      DELETE FROM health_metrics
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY user_id, metric_type, recorded_at
              ORDER BY created_at ASC
            ) as rn
          FROM health_metrics
          WHERE user_id = ${user.id}
        ) subq
        WHERE rn > 1
      )
      RETURNING id
    `);

    return NextResponse.json({
      message: "Removed all duplicate health metrics",
      deletedCount: Array.isArray(duplicates) ? duplicates.length : 0,
    });
  }

  return NextResponse.json({
    error: "Specify action: ?action=test-data, ?action=all-steps, ?action=dedupe-hrv, or ?action=dedupe-all",
  }, { status: 400 });
}
