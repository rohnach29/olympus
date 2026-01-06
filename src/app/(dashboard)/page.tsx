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
import { db, dailyScores, healthMetrics } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

// Default values when no data available
const defaultMetrics = {
  heartRate: 62,
  hrv: 48,
  steps: 8432,
  calories: 1850,
  sleepHours: 7.4,
  activeMinutes: 45,
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

  // Fetch today's scores from database
  let scores = { readiness: 82, sleep: 78, strain: 45, recovery: 85 };
  let metrics = defaultMetrics;

  if (user) {
    try {
      const todayScores = await db
        .select()
        .from(dailyScores)
        .where(eq(dailyScores.userId, user.id))
        .orderBy(desc(dailyScores.date))
        .limit(1);

      if (todayScores.length > 0) {
        scores = {
          readiness: Number(todayScores[0].readinessScore) || 82,
          sleep: Number(todayScores[0].sleepScore) || 78,
          strain: Number(todayScores[0].strainScore) || 45,
          recovery: Number(todayScores[0].recoveryScore) || 85,
        };
      }

      // Fetch recent metrics
      const recentMetrics = await db
        .select()
        .from(healthMetrics)
        .where(eq(healthMetrics.userId, user.id))
        .orderBy(desc(healthMetrics.recordedAt))
        .limit(20);

      if (recentMetrics.length > 0) {
        const metricMap: Record<string, number> = {};
        recentMetrics.forEach((m) => {
          if (!metricMap[m.metricType]) {
            metricMap[m.metricType] = Number(m.value);
          }
        });

        metrics = {
          heartRate: metricMap["resting_hr"] || defaultMetrics.heartRate,
          hrv: metricMap["hrv"] || defaultMetrics.hrv,
          steps: metricMap["steps"] || defaultMetrics.steps,
          calories: metricMap["calories"] || defaultMetrics.calories,
          sleepHours: metricMap["sleep_hours"] || defaultMetrics.sleepHours,
          activeMinutes: metricMap["active_minutes"] || defaultMetrics.activeMinutes,
        };
      }
    } catch (error) {
      console.log("Could not fetch dashboard data:", error);
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
              sublabel="7h 24m"
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
            change={-3}
          />
          <MetricCard
            title="HRV"
            value={metrics.hrv}
            unit="ms"
            icon={Activity}
            iconColor="text-purple-500"
            change={8}
          />
          <MetricCard
            title="Steps"
            value={metrics.steps.toLocaleString()}
            icon={Footprints}
            iconColor="text-blue-500"
          />
          <MetricCard
            title="Calories"
            value={metrics.calories.toLocaleString()}
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
