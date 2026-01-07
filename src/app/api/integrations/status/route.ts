import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, webhookLogs, apiTokens } from "@/lib/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

// GET - Get sync status and recent webhook activity
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the most recent successful sync
    const [lastSync] = await db
      .select({
        createdAt: webhookLogs.createdAt,
        metricsProcessed: webhookLogs.metricsProcessed,
        sleepSessionsProcessed: webhookLogs.sleepSessionsProcessed,
        workoutsProcessed: webhookLogs.workoutsProcessed,
      })
      .from(webhookLogs)
      .where(
        and(
          eq(webhookLogs.userId, user.id),
          eq(webhookLogs.status, "success")
        )
      )
      .orderBy(desc(webhookLogs.createdAt))
      .limit(1);

    // Get total successful syncs
    const [syncCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookLogs)
      .where(
        and(
          eq(webhookLogs.userId, user.id),
          eq(webhookLogs.status, "success")
        )
      );

    // Get stats for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [weekStats] = await db
      .select({
        totalSyncs: sql<number>`count(*)`,
        totalMetrics: sql<number>`sum(${webhookLogs.metricsProcessed})`,
        totalSleep: sql<number>`sum(${webhookLogs.sleepSessionsProcessed})`,
        totalWorkouts: sql<number>`sum(${webhookLogs.workoutsProcessed})`,
      })
      .from(webhookLogs)
      .where(
        and(
          eq(webhookLogs.userId, user.id),
          gte(webhookLogs.createdAt, sevenDaysAgo)
        )
      );

    // Get recent logs (last 5)
    const recentLogs = await db
      .select({
        id: webhookLogs.id,
        status: webhookLogs.status,
        metricsProcessed: webhookLogs.metricsProcessed,
        sleepSessionsProcessed: webhookLogs.sleepSessionsProcessed,
        workoutsProcessed: webhookLogs.workoutsProcessed,
        errors: webhookLogs.errors,
        createdAt: webhookLogs.createdAt,
      })
      .from(webhookLogs)
      .where(eq(webhookLogs.userId, user.id))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(5);

    // Check if user has any active tokens
    const [tokenInfo] = await db
      .select({
        count: sql<number>`count(*)`,
        mostRecent: sql<Date>`max(${apiTokens.createdAt})`,
      })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.userId, user.id),
          eq(apiTokens.isActive, true)
        )
      );

    // Determine connection status
    let status: "connected" | "stale" | "never" = "never";
    if (lastSync) {
      const hoursSinceSync =
        (Date.now() - new Date(lastSync.createdAt).getTime()) / (1000 * 60 * 60);
      status = hoursSinceSync < 24 ? "connected" : "stale";
    }

    return NextResponse.json({
      status,
      lastSync: lastSync?.createdAt || null,
      totalSyncs: Number(syncCount?.count) || 0,
      hasActiveToken: Number(tokenInfo?.count) > 0,
      tokenCreatedAt: tokenInfo?.mostRecent || null,
      weekStats: {
        syncs: Number(weekStats?.totalSyncs) || 0,
        metrics: Number(weekStats?.totalMetrics) || 0,
        sleepSessions: Number(weekStats?.totalSleep) || 0,
        workouts: Number(weekStats?.totalWorkouts) || 0,
      },
      recentLogs,
    });
  } catch (error) {
    console.error("Get sync status error:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
