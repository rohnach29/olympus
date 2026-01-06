"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { Progress } from "@/components/ui/progress";
import { Moon, Clock, Zap, Brain, TrendingUp, BedDouble, Info } from "lucide-react";
import { format } from "date-fns";

interface SleepSession {
  id: string;
  bedtime: string;
  wakeTime: string;
  sleepDate: string;
  totalMinutes: number;
  inBedMinutes: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  awakeMinutes: number;
  sleepScore: number | null;
  efficiency: string | null;
  hrvAvg: number | null;
  restingHr: number | null;
}

interface WeeklyAverage {
  avgScore: number;
  avgDurationMinutes: number;
  avgEfficiency: number;
  avgDeepMinutes: number;
  avgRemMinutes: number;
}

export default function SleepPage() {
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [latest, setLatest] = useState<SleepSession | null>(null);
  const [weeklyAvg, setWeeklyAvg] = useState<WeeklyAverage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSleep = async () => {
      try {
        const response = await fetch("/api/sleep?limit=7");
        const data = await response.json();

        if (data.sessions) {
          setSessions(data.sessions);
          setLatest(data.latest);
          setWeeklyAvg(data.weeklyAverage);
        }
      } catch (error) {
        console.error("Failed to fetch sleep data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSleep();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading sleep data...
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sleep</h1>
          <p className="text-muted-foreground">
            Track and optimize your sleep quality
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BedDouble className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">No sleep data yet</p>
            <p className="text-sm">Sleep sessions will appear here once tracked</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSleepMinutes =
    (latest.deepSleepMinutes || 0) +
    (latest.remSleepMinutes || 0) +
    (latest.lightSleepMinutes || 0);

  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), "h:mm a");
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Build trend data from sessions (reversed to show oldest first)
  const sleepTrend = [...sessions].reverse().map((s) => ({
    day: format(new Date(s.sleepDate), "EEE"),
    score: s.sleepScore || 0,
    hours: s.totalMinutes / 60,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Sleep</h1>
        <p className="text-muted-foreground">
          Track and optimize your sleep quality
        </p>
      </div>

      {/* Main Score & Duration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <ScoreRing
              score={latest.sleepScore || 0}
              size="lg"
              label="Sleep Score"
              sublabel="Last night"
            />
            <Dialog>
              <DialogTrigger asChild>
                <button className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-3 w-3" />
                  How is this calculated?
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>How Your Sleep Score Works</DialogTitle>
                  <DialogDescription>
                    Based on Pittsburgh Sleep Quality Index research
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <p className="text-muted-foreground">
                    Your sleep score is a weighted average of 7 components:
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Duration</span>
                      <span className="text-muted-foreground">20% — 7-9h is optimal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Efficiency</span>
                      <span className="text-muted-foreground">20% — time asleep vs in bed</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Deep Sleep</span>
                      <span className="text-muted-foreground">15% — 15-20% is ideal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">REM Sleep</span>
                      <span className="text-muted-foreground">15% — 20-25% is ideal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Time to Sleep</span>
                      <span className="text-muted-foreground">10% — under 15min is best</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Awakenings</span>
                      <span className="text-muted-foreground">10% — less is better</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">HRV</span>
                      <span className="text-muted-foreground">10% — vs your baseline</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t text-muted-foreground">
                    <p className="text-xs">
                      HRV compares tonight to your personal 14-day baseline using statistical analysis,
                      so scores are personalized to you.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <h3 className="font-medium mb-4">Last Night&apos;s Sleep</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Duration</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatDuration(latest.totalMinutes)}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm">Efficiency</span>
                </div>
                <p className="text-2xl font-bold">
                  {Math.round(Number(latest.efficiency) || 0)}%
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Moon className="h-4 w-4" />
                  <span className="text-sm">Bedtime</span>
                </div>
                <p className="text-2xl font-bold">{formatTime(latest.bedtime)}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Brain className="h-4 w-4" />
                  <span className="text-sm">Wake Time</span>
                </div>
                <p className="text-2xl font-bold">{formatTime(latest.wakeTime)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sleep Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Sleep Stages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
                  Deep Sleep
                </span>
                <span>
                  {formatDuration(latest.deepSleepMinutes || 0)} (
                  {totalSleepMinutes > 0
                    ? Math.round(((latest.deepSleepMinutes || 0) / totalSleepMinutes) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <Progress
                value={
                  totalSleepMinutes > 0
                    ? ((latest.deepSleepMinutes || 0) / totalSleepMinutes) * 100
                    : 0
                }
                className="h-3"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                  REM Sleep
                </span>
                <span>
                  {formatDuration(latest.remSleepMinutes || 0)} (
                  {totalSleepMinutes > 0
                    ? Math.round(((latest.remSleepMinutes || 0) / totalSleepMinutes) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <Progress
                value={
                  totalSleepMinutes > 0
                    ? ((latest.remSleepMinutes || 0) / totalSleepMinutes) * 100
                    : 0
                }
                className="h-3"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                  Light Sleep
                </span>
                <span>
                  {formatDuration(latest.lightSleepMinutes || 0)} (
                  {totalSleepMinutes > 0
                    ? Math.round(((latest.lightSleepMinutes || 0) / totalSleepMinutes) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <Progress
                value={
                  totalSleepMinutes > 0
                    ? ((latest.lightSleepMinutes || 0) / totalSleepMinutes) * 100
                    : 0
                }
                className="h-3"
              />
            </div>
            {(latest.awakeMinutes || 0) > 0 && (
              <div className="text-sm text-muted-foreground pt-2">
                Time awake: {formatDuration(latest.awakeMinutes || 0)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Sleep Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sleepTrend.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-end gap-2 h-[120px]">
                {sleepTrend.map((day, i) => {
                  const barHeight = Math.max(day.score, 5); // Minimum 5% for visibility
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center justify-end h-full"
                    >
                      <div className="text-xs font-medium mb-1">{day.score}</div>
                      <div
                        className="w-full bg-primary/80 rounded-t-md transition-all min-h-[4px]"
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                {sleepTrend.map((day, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className="text-xs text-muted-foreground">{day.day}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-muted-foreground">
              Not enough data for trend
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Average */}
      {weeklyAvg && (
        <Card>
          <CardHeader>
            <CardTitle>7-Day Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-primary">
                  {weeklyAvg.avgScore}
                </div>
                <div className="text-sm text-muted-foreground">Avg Score</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-blue-500">
                  {formatDuration(weeklyAvg.avgDurationMinutes)}
                </div>
                <div className="text-sm text-muted-foreground">Avg Duration</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-indigo-500">
                  {formatDuration(weeklyAvg.avgDeepMinutes)}
                </div>
                <div className="text-sm text-muted-foreground">Avg Deep</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-purple-500">
                  {formatDuration(weeklyAvg.avgRemMinutes)}
                </div>
                <div className="text-sm text-muted-foreground">Avg REM</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
