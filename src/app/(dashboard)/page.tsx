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
  Utensils,
  Dumbbell,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { db, healthMetrics, sleepSessions, workouts } from "@/lib/db";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import { getYesterdayDateString } from "@/lib/utils/timezone";

// Default values when no data available
const defaultMetrics = {
  heartRate: null as number | null,
  hrv: null as number | null,
  steps: null as number | null,
  calories: null as number | null,
  sleepDisplay: null as string | null, // Formatted as "8h 42m"
};

// Helper to format minutes as "Xh Ym"
function formatSleepDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  return `${hours}h ${mins}m`;
}

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
      // Get today's date range in user's timezone
      const userSettings = user.settings as { timezone?: string } | null;
      const userTimezone = userSettings?.timezone || "UTC";

      // Calculate "today" in user's timezone
      const now = new Date();
      // Use Intl to get the date in user's timezone
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: userTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const [year, month, day] = formatter.format(now).split("-").map(Number);

      // Create midnight in user's timezone, then convert to UTC
      // This is a bit tricky - we need to find the UTC time that corresponds to midnight in user's TZ
      const midnightLocal = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`);
      const tzOffset = midnightLocal.getTimezoneOffset(); // Server's offset in minutes

      // Get the offset for user's timezone by comparing formatted time
      const userMidnight = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      const utcMidnight = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
      const userOffsetMs = userMidnight.getTime() - utcMidnight.getTime();

      // Today in user's timezone (as UTC timestamp)
      const today = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - userOffsetMs);

      // Fetch point-in-time metrics for TODAY only (most recent value of EACH type)
      // Using DISTINCT ON to get one record per metric type (the most recent one today)
      // This ensures we don't show stale data from previous days
      const pointInTimeMetrics = await db.execute(sql`
        SELECT DISTINCT ON (metric_type) *
        FROM health_metrics
        WHERE user_id = ${user.id}
          AND metric_type IN ('resting_heart_rate', 'hrv', 'respiratory_rate', 'blood_oxygen')
          AND recorded_at >= ${today}
        ORDER BY metric_type, recorded_at DESC
      `) as unknown as Array<{ metric_type: string; value: string }>;

      const metricMap: Record<string, number> = {};
      pointInTimeMetrics.forEach((m) => {
        const metricType = m.metric_type;
        if (!metricMap[metricType]) {
          // Round HRV and heart rate to whole numbers
          const value = Number(m.value);
          metricMap[metricType] = ['hrv', 'resting_heart_rate', 'heart_rate'].includes(metricType)
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
            sql`${healthMetrics.metricType} IN ('steps', 'calories_active')`
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
        sleepDisplay: null, // Will get from sleepSessions
      };

      // Fetch LAST NIGHT's sleep session only (not just "most recent")
      // sleepDate represents the night you went to bed, so "last night" = yesterday
      const lastNightDate = getYesterdayDateString(userTimezone);
      const lastNightSleep = await db
        .select()
        .from(sleepSessions)
        .where(
          and(
            eq(sleepSessions.userId, user.id),
            eq(sleepSessions.sleepDate, lastNightDate)
          )
        )
        .limit(1);

      if (lastNightSleep.length > 0) {
        const sleep = lastNightSleep[0];
        const hours = Math.floor(sleep.totalMinutes / 60);
        const mins = sleep.totalMinutes % 60;
        sleepDuration = `${hours}h ${mins}m`;
        metrics.sleepDisplay = formatSleepDuration(sleep.totalMinutes);
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
            value={metrics.sleepDisplay}
            icon={Moon}
            iconColor="text-indigo-500"
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
