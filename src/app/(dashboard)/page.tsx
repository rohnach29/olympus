import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { MetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import {
  Heart,
  Footprints,
  Moon,
  Flame,
  Activity,
  TrendingUp,
  Utensils,
  Dumbbell,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { db, healthMetrics, sleepSessions, workouts } from "@/lib/db";
import { eq, desc, gte, and, sql } from "drizzle-orm";

// Default values when no data available
const defaultMetrics = {
  heartRate: null as number | null,
  hrv: null as number | null,
  steps: null as number | null,
  calories: null as number | null,
  sleepHours: null as number | null,
  activeMinutes: null as number | null,
};

const defaultRecommendations = [
  {
    icon: Dumbbell,
    title: "Upper body strength workout",
    description: "Your recovery is good - perfect for moderate intensity",
  },
  {
    icon: Utensils,
    title: "Increase protein intake",
    description: "You're 20g below your daily target",
  },
  {
    icon: Moon,
    title: "Wind down by 10:30 PM",
    description: "For optimal sleep based on your patterns",
  },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Initialize with nulls (will show "--" if no data)
  let scores = { readiness: null as number | null, sleep: null as number | null, strain: null as number | null, recovery: null as number | null };
  let metrics = { ...defaultMetrics };
  let sleepDuration = "";

  if (user) {
    try {
      // Get today's date range in IST (UTC+5:30)
      // TODO: Get timezone from user settings instead of hardcoding
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in ms
      const istNow = new Date(now.getTime() + istOffset);
      const today = new Date(Date.UTC(
        istNow.getUTCFullYear(),
        istNow.getUTCMonth(),
        istNow.getUTCDate(),
        0, 0, 0, 0
      ) - istOffset); // Midnight IST in UTC

      // Fetch point-in-time metrics (most recent value) - HR, HRV
      const pointInTimeMetrics = await db
        .select()
        .from(healthMetrics)
        .where(
          and(
            eq(healthMetrics.userId, user.id),
            sql`${healthMetrics.metricType} IN ('resting_heart_rate', 'hrv', 'respiratory_rate', 'blood_oxygen')`
          )
        )
        .orderBy(desc(healthMetrics.recordedAt))
        .limit(20);

      const metricMap: Record<string, number> = {};
      pointInTimeMetrics.forEach((m) => {
        if (!metricMap[m.metricType]) {
          // Round HRV and heart rate to whole numbers
          const value = Number(m.value);
          metricMap[m.metricType] = ['hrv', 'resting_heart_rate', 'heart_rate'].includes(m.metricType)
            ? Math.round(value)
            : value;
        }
      });

      // Fetch cumulative metrics (sum for today) - Steps, Calories, Exercise Minutes
      const cumulativeMetrics = await db
        .select({
          metricType: healthMetrics.metricType,
          total: sql<number>`SUM(CAST(${healthMetrics.value} AS DECIMAL))`,
        })
        .from(healthMetrics)
        .where(
          and(
            eq(healthMetrics.userId, user.id),
            gte(healthMetrics.recordedAt, today),
            sql`${healthMetrics.metricType} IN ('steps', 'calories_active', 'exercise_minutes')`
          )
        )
        .groupBy(healthMetrics.metricType);

      const cumulativeMap: Record<string, number> = {};
      cumulativeMetrics.forEach((m) => {
        cumulativeMap[m.metricType] = Math.round(Number(m.total));
      });

      // Map from our stored metric names to display
      metrics = {
        heartRate: metricMap["resting_heart_rate"] ?? null,
        hrv: metricMap["hrv"] ?? null,
        steps: cumulativeMap["steps"] ?? null,
        calories: cumulativeMap["calories_active"] ?? null,
        sleepHours: null, // Will get from sleepSessions
        activeMinutes: cumulativeMap["exercise_minutes"] ?? null,
      };

      // Fetch most recent sleep session
      const recentSleep = await db
        .select()
        .from(sleepSessions)
        .where(eq(sleepSessions.userId, user.id))
        .orderBy(desc(sleepSessions.sleepDate))
        .limit(1);

      if (recentSleep.length > 0) {
        const sleep = recentSleep[0];
        const hours = Math.floor(sleep.totalMinutes / 60);
        const mins = sleep.totalMinutes % 60;
        sleepDuration = `${hours}h ${mins}m`;
        metrics.sleepHours = Math.round((sleep.totalMinutes / 60) * 10) / 10;
        scores.sleep = sleep.sleepScore;
      }

      // Fetch today's workouts for strain estimate
      const todayWorkouts = await db
        .select()
        .from(workouts)
        .where(
          and(
            eq(workouts.userId, user.id),
            gte(workouts.startedAt, today)
          )
        );

      // Simple strain estimate based on workout duration
      if (todayWorkouts.length > 0) {
        const totalMinutes = todayWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0);
        // Rough strain: 0-30min = low (5-8), 30-60min = moderate (8-12), 60+ = high (12-18)
        scores.strain = Math.min(21, Math.round(5 + (totalMinutes / 10)));
      }

      // Calculate readiness/recovery based on available data
      if (scores.sleep !== null) {
        // Simple formula: recovery is heavily influenced by sleep
        scores.recovery = scores.sleep;
        scores.readiness = Math.round((scores.sleep + (metrics.hrv ? Math.min(100, metrics.hrv * 1.5) : scores.sleep)) / 2);
      }

    } catch (error) {
      console.error("Could not fetch dashboard data:", error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <section>
        <QuickActions />
      </section>

      {/* Main Scores */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="col-span-1 md:col-span-2 lg:col-span-1">
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <ScoreRing
              score={scores.readiness}
              size="lg"
              label="Readiness"
              sublabel="Ready for activity"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <ScoreRing
              score={scores.sleep}
              size="md"
              label="Sleep Score"
              sublabel={sleepDuration || "No data"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <ScoreRing
              score={scores.recovery}
              size="md"
              label="Recovery"
              sublabel="Optimal"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <ScoreRing
              score={scores.strain}
              maxScore={21}
              size="md"
              label="Strain"
              sublabel="Moderate"
            />
          </CardContent>
        </Card>
      </section>

      {/* Key Metrics */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Today&apos;s Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            title="Resting HR"
            value={metrics.heartRate}
            unit="bpm"
            icon={Heart}
            iconColor="text-red-500"
          />
          <MetricCard
            title="HRV"
            value={metrics.hrv}
            unit="ms"
            icon={Activity}
            iconColor="text-purple-500"
          />
          <MetricCard
            title="Steps"
            value={metrics.steps ? metrics.steps.toLocaleString() : null}
            icon={Footprints}
            iconColor="text-blue-500"
          />
          <MetricCard
            title="Calories"
            value={metrics.calories ? metrics.calories.toLocaleString() : null}
            unit="kcal"
            icon={Flame}
            iconColor="text-orange-500"
          />
          <MetricCard
            title="Sleep"
            value={metrics.sleepHours}
            unit="hrs"
            icon={Moon}
            iconColor="text-indigo-500"
          />
          <MetricCard
            title="Active"
            value={metrics.activeMinutes}
            unit="min"
            icon={TrendingUp}
            iconColor="text-green-500"
          />
        </div>
      </section>

      {/* AI Recommendations */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today&apos;s Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {defaultRecommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <rec.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{rec.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {rec.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Weekly Trends Preview */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Sleep Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <p>Sleep chart will appear here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <p>Activity chart will appear here</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
