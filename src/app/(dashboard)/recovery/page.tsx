"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { MetricCard } from "@/components/dashboard/metric-card";
import {
  Heart,
  Activity,
  Wind,
  TrendingUp,
  TrendingDown,
  Battery,
} from "lucide-react";

interface RecoveryData {
  today: {
    date: string;
    recoveryScore: number;
    sleepScore: number;
    strainScore: number;
    readinessScore: number;
  } | null;
  status: string;
  recommendation: string;
  trend: {
    date: string;
    recoveryScore: number;
    sleepScore: number;
    strainScore: number;
  }[];
  metrics: {
    hrv: { value: number; trend: number; unit: string };
    restingHr: { value: number; trend: number; unit: string };
    respiratoryRate: { value: number; trend: number; unit: string };
    steps: { value: number; unit: string };
    activeCalories: { value: number; unit: string };
  };
  factors: {
    name: string;
    score: number;
    impact: string;
  }[];
}

const getTrainingTags = (score: number) => {
  if (score >= 85) {
    return [
      { label: "High Intensity OK", color: "bg-green-100 text-green-700" },
      { label: "Strength Training", color: "bg-blue-100 text-blue-700" },
      { label: "HIIT", color: "bg-purple-100 text-purple-700" },
    ];
  } else if (score >= 70) {
    return [
      { label: "Moderate Intensity", color: "bg-yellow-100 text-yellow-700" },
      { label: "Steady Cardio", color: "bg-blue-100 text-blue-700" },
      { label: "Technique Work", color: "bg-purple-100 text-purple-700" },
    ];
  } else if (score >= 50) {
    return [
      { label: "Low Intensity", color: "bg-orange-100 text-orange-700" },
      { label: "Active Recovery", color: "bg-blue-100 text-blue-700" },
      { label: "Mobility", color: "bg-green-100 text-green-700" },
    ];
  } else {
    return [
      { label: "Rest Day", color: "bg-red-100 text-red-700" },
      { label: "Light Stretching", color: "bg-blue-100 text-blue-700" },
    ];
  }
};

export default function RecoveryPage() {
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecovery = async () => {
      try {
        const response = await fetch("/api/recovery?days=7");
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Failed to fetch recovery data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecovery();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading recovery data...
      </div>
    );
  }

  if (!data || !data.today) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Recovery</h1>
          <p className="text-muted-foreground">
            Monitor your body&apos;s readiness for training
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Battery className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">No recovery data yet</p>
            <p className="text-sm">
              Recovery scores will appear once you have sleep and activity data
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recoveryScore = data.today.recoveryScore;
  const trainingTags = getTrainingTags(recoveryScore);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Recovery</h1>
        <p className="text-muted-foreground">
          Monitor your body&apos;s readiness for training
        </p>
      </div>

      {/* Main Recovery Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[250px]">
            <ScoreRing score={recoveryScore} size="lg" label="Recovery Score" />
            <div className="mt-4 text-center">
              <p className="font-medium text-lg">{data.status}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data.recommendation}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recovery Factors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.factors.map((factor) => (
                <div key={factor.name} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{factor.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {factor.score}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          factor.impact === "positive"
                            ? "bg-green-500"
                            : factor.impact === "negative"
                            ? "bg-red-500"
                            : "bg-yellow-500"
                        }`}
                        style={{ width: `${factor.score}%` }}
                      />
                    </div>
                  </div>
                  {factor.impact === "positive" ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : factor.impact === "negative" ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <Activity className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="HRV"
          value={data.metrics.hrv.value}
          unit="ms"
          change={Math.round(data.metrics.hrv.trend)}
          icon={Activity}
          iconColor="text-purple-500"
        />
        <MetricCard
          title="Resting HR"
          value={data.metrics.restingHr.value}
          unit="bpm"
          change={Math.round(data.metrics.restingHr.trend)}
          icon={Heart}
          iconColor="text-red-500"
        />
        <MetricCard
          title="Respiratory Rate"
          value={Number(data.metrics.respiratoryRate.value.toFixed(1))}
          unit="br/min"
          icon={Wind}
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Active Calories"
          value={data.metrics.activeCalories.value}
          unit="kcal"
          icon={Activity}
          iconColor="text-orange-500"
        />
      </div>

      {/* Recovery Trend */}
      <Card>
        <CardHeader>
          <CardTitle>7-Day Recovery Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {data.trend.length > 0 ? (
            <div className="flex justify-between items-end h-[150px] gap-2">
              {data.trend
                .slice()
                .reverse()
                .map((day, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-2"
                  >
                    <div
                      className={`w-full rounded-t-lg transition-all ${
                        day.recoveryScore >= 80
                          ? "bg-green-500"
                          : day.recoveryScore >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ height: `${day.recoveryScore}%` }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-muted-foreground">
              Not enough data for trend
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training Recommendation */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                Today&apos;s Training Recommendation
              </h3>
              <p className="text-muted-foreground mt-1">
                Based on your recovery score of {recoveryScore}%,{" "}
                {data.recommendation.toLowerCase()}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {trainingTags.map((tag) => (
                  <span
                    key={tag.label}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${tag.color}`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
