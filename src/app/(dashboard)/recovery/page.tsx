"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Heart, Activity, Thermometer, Wind, TrendingUp, TrendingDown } from "lucide-react";

const mockRecoveryData = {
  score: 85,
  status: "Optimal",
  recommendation: "Ready for high intensity training",
  metrics: {
    hrv: 52,
    hrvChange: 8,
    restingHr: 58,
    restingHrChange: -3,
    respiratoryRate: 14,
    skinTemp: 0.2, // deviation from baseline
  },
  factors: [
    { name: "Sleep Quality", score: 82, impact: "positive" },
    { name: "HRV", score: 88, impact: "positive" },
    { name: "Resting HR", score: 90, impact: "positive" },
    { name: "Previous Strain", score: 75, impact: "neutral" },
  ],
};

export default function RecoveryPage() {
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
            <ScoreRing
              score={mockRecoveryData.score}
              size="lg"
              label="Recovery Score"
            />
            <div className="mt-4 text-center">
              <p className="font-medium text-lg">{mockRecoveryData.status}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {mockRecoveryData.recommendation}
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
              {mockRecoveryData.factors.map((factor) => (
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
          value={mockRecoveryData.metrics.hrv}
          unit="ms"
          change={mockRecoveryData.metrics.hrvChange}
          icon={Activity}
          iconColor="text-purple-500"
        />
        <MetricCard
          title="Resting HR"
          value={mockRecoveryData.metrics.restingHr}
          unit="bpm"
          change={mockRecoveryData.metrics.restingHrChange}
          icon={Heart}
          iconColor="text-red-500"
        />
        <MetricCard
          title="Respiratory Rate"
          value={mockRecoveryData.metrics.respiratoryRate}
          unit="br/min"
          icon={Wind}
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Skin Temp"
          value={mockRecoveryData.metrics.skinTemp > 0 ? "+" : ""}
          unit={`${mockRecoveryData.metrics.skinTemp}°F`}
          icon={Thermometer}
          iconColor="text-orange-500"
        />
      </div>

      {/* HRV Trend */}
      <Card>
        <CardHeader>
          <CardTitle>7-Day HRV Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <p>HRV trend chart will appear here</p>
          </div>
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
              <h3 className="font-semibold text-lg">Today&apos;s Training Recommendation</h3>
              <p className="text-muted-foreground mt-1">
                Based on your recovery score of {mockRecoveryData.score}%, you&apos;re well-recovered
                and can handle high-intensity training today. Consider a challenging strength
                session or interval training.
              </p>
              <div className="mt-4 flex gap-2">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                  High Intensity OK
                </span>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                  Strength Training
                </span>
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
                  HIIT
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
