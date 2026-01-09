"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { MetricCard } from "@/components/dashboard/metric-card";
import {
  Heart,
  Activity,
  Wind,
  TrendingUp,
  TrendingDown,
  Battery,
  Info,
  X,
} from "lucide-react";

interface RecoveryData {
  today: {
    date: string;
    recoveryScore: number;
    sleepScore: number;
    strainScore: number;
    readinessScore: number;
  } | null;
  hasEnoughData: boolean;
  status: string;
  recommendation: string;
  trainingRecommendation?: string;
  trend: {
    date: string;
    recoveryScore: number;
    sleepScore: number;
    strainScore: number;
  }[];
  metrics: {
    hrv: { value: number; trend: number; unit: string; baseline?: number | null };
    restingHr: { value: number; trend: number; unit: string; baseline?: number | null };
    respiratoryRate: { value: number; trend: number; unit: string };
    steps: { value: number; unit: string };
    activeCalories: { value: number; unit: string };
  };
  factors: {
    name: string;
    score: number | null;
    weight?: string;
    impact: string;
    zScore?: number | null;
    hasData: boolean;
  }[];
  baseline?: {
    hrvAvg: number;
    restingHrAvg: number;
    dataPoints: number;
  } | null;
  strain?: {
    yesterdayStrain: number;
    category: string;
    trimp: number;
    description: string;
  };
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
  const [showInfoModal, setShowInfoModal] = useState(false);

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

  // Handle case where API returned no data at all
  if (!data) {
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

  // Check if we have enough data for a meaningful recovery score
  const hasEnoughData = data.hasEnoughData ?? false;
  const recoveryScore = data.today?.recoveryScore ?? null;
  const trainingTags = recoveryScore !== null ? getTrainingTags(recoveryScore) : [];

  // Prepare trend data - ensure we have 7 days
  const trendData = data.trend.slice(0, 7);

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
            {hasEnoughData && recoveryScore !== null ? (
              <>
                <ScoreRing score={recoveryScore} size="lg" label="Recovery Score" />
                <div className="mt-4 text-center">
                  <p className="font-medium text-lg">{data.status}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.recommendation}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <div className="w-32 h-32 rounded-full border-8 border-muted flex items-center justify-center">
                    <span className="text-2xl text-muted-foreground">--</span>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="font-medium text-lg text-muted-foreground">No Data</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.recommendation}
                  </p>
                </div>
              </>
            )}
            {/* Info Button */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowInfoModal(true)}
            >
              <Info className="h-4 w-4 mr-1" />
              How is this calculated?
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recovery Factors
              {data.baseline && (
                <span className="text-xs font-normal text-muted-foreground">
                  Based on {data.baseline.dataPoints} days of data
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.factors.map((factor) => (
                <div key={factor.name} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">
                        {factor.name}
                        {factor.weight && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({factor.weight})
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {factor.hasData && factor.score !== null ? (
                          <>
                            {factor.score}%
                            {factor.zScore !== undefined && factor.zScore !== null && (
                              <span className="text-xs ml-1">
                                (z: {factor.zScore > 0 ? "+" : ""}{factor.zScore})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground/60 italic">No data</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      {factor.hasData && factor.score !== null ? (
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
                      ) : (
                        <div
                          className="h-full rounded-full bg-muted-foreground/20"
                          style={{ width: "100%" }}
                        />
                      )}
                    </div>
                  </div>
                  {factor.hasData ? (
                    factor.impact === "positive" ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : factor.impact === "negative" ? (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <Activity className="h-4 w-4 text-yellow-500" />
                    )
                  ) : (
                    <Activity className="h-4 w-4 text-muted-foreground/30" />
                  )}
                </div>
              ))}
            </div>

            {/* Yesterday's Strain */}
            {data.strain && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Yesterday&apos;s Strain</p>
                    <p className="text-xs text-muted-foreground">{data.strain.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{data.strain.yesterdayStrain}</p>
                    <p className="text-xs text-muted-foreground">/ 21</p>
                  </div>
                </div>
                {data.strain.trimp > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    TRIMP: {data.strain.trimp} (Training Impulse)
                  </p>
                )}
              </div>
            )}
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

      {/* Baseline Info */}
      {data.baseline && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your Personal Baselines (14-day avg)</span>
              <div className="flex gap-6">
                <span>
                  <strong>HRV:</strong> {data.baseline.hrvAvg} ms
                </span>
                <span>
                  <strong>Resting HR:</strong> {data.baseline.restingHrAvg} bpm
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recovery Trend */}
      <Card>
        <CardHeader>
          <CardTitle>7-Day Recovery Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <div className="space-y-4">
              {/* Bar Chart */}
              <div className="flex justify-between items-end h-[150px] gap-2">
                {trendData
                  .slice()
                  .reverse()
                  .map((day, i) => {
                    const score = day.recoveryScore || 0;
                    return (
                      <div
                        key={`${day.date}-${i}`}
                        className="flex-1 flex flex-col items-center gap-2"
                      >
                        <div className="text-xs font-medium">{score}</div>
                        <div className="w-full bg-muted rounded-lg relative" style={{ height: "120px" }}>
                          <div
                            className={`absolute bottom-0 w-full rounded-lg transition-all ${
                              score >= 80
                                ? "bg-green-500"
                                : score >= 60
                                ? "bg-yellow-500"
                                : score > 0
                                ? "bg-red-500"
                                : "bg-muted-foreground/20"
                            }`}
                            style={{ height: `${Math.max(score, 5)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(day.date).toLocaleDateString("en-US", {
                            weekday: "short",
                          })}
                        </span>
                      </div>
                    );
                  })}
              </div>
              {/* Legend */}
              <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span>Optimal (80+)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-yellow-500" />
                  <span>Moderate (60-79)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span>Low (&lt;60)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-muted-foreground">
              Not enough data for trend
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training Recommendation */}
      <Card className={hasEnoughData ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-muted"}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${hasEnoughData ? "bg-primary/10" : "bg-muted"}`}>
              <Activity className={`h-6 w-6 ${hasEnoughData ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                Today&apos;s Training Recommendation
              </h3>
              {hasEnoughData && recoveryScore !== null ? (
                <>
                  <p className="text-muted-foreground mt-1">
                    Based on your recovery score of {recoveryScore}%,{" "}
                    {data.recommendation.toLowerCase()}
                  </p>
                  {data.trainingRecommendation && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <strong>Suggested:</strong> {data.trainingRecommendation}
                    </p>
                  )}
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
                </>
              ) : (
                <p className="text-muted-foreground mt-1">
                  {data.recommendation}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">How Recovery Score is Calculated</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowInfoModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Overview */}
              <div>
                <h3 className="font-medium mb-2">Overview</h3>
                <p className="text-sm text-muted-foreground">
                  Your recovery score is calculated using a weighted multi-factor model based on
                  sports science research. Each factor compares your current values to your personal
                  baseline (14-day rolling average).
                </p>
              </div>

              {/* Components Table */}
              <div>
                <h3 className="font-medium mb-3">Score Components</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">Sleep Quality</span>
                      <span className="text-sm text-muted-foreground">35%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your PSQI-based sleep score. Includes duration, efficiency, deep/REM sleep, and latency.
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">HRV vs Baseline</span>
                      <span className="text-sm text-muted-foreground">25%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Compares today&apos;s HRV to your 14-day average using z-score. Higher HRV = better
                      parasympathetic tone = more recovered.
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">Resting HR vs Baseline</span>
                      <span className="text-sm text-muted-foreground">15%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Compares to your baseline (inverted - lower is better). Elevated resting HR
                      often indicates incomplete recovery.
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">Previous Strain</span>
                      <span className="text-sm text-muted-foreground">15%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Yesterday&apos;s training load (TRIMP). Higher strain yesterday = more recovery
                      needed today.
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">Sleep Consistency</span>
                      <span className="text-sm text-muted-foreground">10%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      How close your bedtime was to your average. Consistent sleep times support
                      circadian rhythm health.
                    </p>
                  </div>
                </div>
              </div>

              {/* Strain Calculation */}
              <div>
                <h3 className="font-medium mb-2">Strain Calculation (TRIMP)</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Strain uses Banister&apos;s Training Impulse (TRIMP) formula from exercise physiology:
                </p>
                <div className="p-3 bg-muted rounded-lg font-mono text-xs">
                  <p>HR_reserve = (HR_avg - HR_rest) / (HR_max - HR_rest)</p>
                  <p>TRIMP = Duration × HR_reserve × 0.64 × e^(1.92 × HR_reserve)</p>
                  <p>Strain = 3.5 × ln(TRIMP + 1)  // 0-21 scale</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Higher heart rates are weighted exponentially more, reflecting the greater
                  physiological stress of intense exercise.
                </p>
              </div>

              {/* Z-Score Explanation */}
              <div>
                <h3 className="font-medium mb-2">Personal Baseline Comparison</h3>
                <p className="text-sm text-muted-foreground">
                  Most components use z-score comparison to your personal baseline:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li><strong>z = 0</strong> (at your baseline) → 75 points</li>
                  <li><strong>z = +1</strong> (1 std dev better than usual) → ~90 points</li>
                  <li><strong>z = -1</strong> (1 std dev worse than usual) → ~55 points</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  This personalization means the system adapts to YOUR normal, not population averages.
                </p>
              </div>

              {/* References */}
              <div className="text-xs text-muted-foreground border-t pt-4">
                <p className="font-medium mb-1">Research References:</p>
                <ul className="space-y-1">
                  <li>• Banister EW (1991) - Training Impulse model</li>
                  <li>• Plews et al. (2013) - HRV and training adaptation</li>
                  <li>• Buchheit (2014) - HR measures for monitoring training</li>
                  <li>• PSQI (1989) - Pittsburgh Sleep Quality Index</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t">
              <Button onClick={() => setShowInfoModal(false)}>Got it</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
