"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { Progress } from "@/components/ui/progress";
import { Moon, Clock, Zap, Brain, TrendingUp } from "lucide-react";

const mockSleepData = {
  score: 78,
  duration: { hours: 7, minutes: 24 },
  efficiency: 92,
  stages: {
    deep: 85, // minutes
    rem: 95,
    light: 180,
    awake: 24,
  },
  bedtime: "11:15 PM",
  wakeTime: "6:45 AM",
};

const sleepTrend = [
  { day: "Mon", score: 72, hours: 6.5 },
  { day: "Tue", score: 85, hours: 7.8 },
  { day: "Wed", score: 68, hours: 6.2 },
  { day: "Thu", score: 79, hours: 7.2 },
  { day: "Fri", score: 82, hours: 7.5 },
  { day: "Sat", score: 88, hours: 8.2 },
  { day: "Sun", score: 78, hours: 7.4 },
];

export default function SleepPage() {
  const totalSleepMinutes =
    mockSleepData.stages.deep +
    mockSleepData.stages.rem +
    mockSleepData.stages.light;

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
              score={mockSleepData.score}
              size="lg"
              label="Sleep Score"
              sublabel="Last night"
            />
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
                  {mockSleepData.duration.hours}h {mockSleepData.duration.minutes}m
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm">Efficiency</span>
                </div>
                <p className="text-2xl font-bold">{mockSleepData.efficiency}%</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Moon className="h-4 w-4" />
                  <span className="text-sm">Bedtime</span>
                </div>
                <p className="text-2xl font-bold">{mockSleepData.bedtime}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Brain className="h-4 w-4" />
                  <span className="text-sm">Wake Time</span>
                </div>
                <p className="text-2xl font-bold">{mockSleepData.wakeTime}</p>
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
                  {Math.floor(mockSleepData.stages.deep / 60)}h{" "}
                  {mockSleepData.stages.deep % 60}m (
                  {Math.round((mockSleepData.stages.deep / totalSleepMinutes) * 100)}
                  %)
                </span>
              </div>
              <Progress
                value={(mockSleepData.stages.deep / totalSleepMinutes) * 100}
                className="h-3"
                indicatorClassName="bg-indigo-600"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                  REM Sleep
                </span>
                <span>
                  {Math.floor(mockSleepData.stages.rem / 60)}h{" "}
                  {mockSleepData.stages.rem % 60}m (
                  {Math.round((mockSleepData.stages.rem / totalSleepMinutes) * 100)}%)
                </span>
              </div>
              <Progress
                value={(mockSleepData.stages.rem / totalSleepMinutes) * 100}
                className="h-3"
                indicatorClassName="bg-purple-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                  Light Sleep
                </span>
                <span>
                  {Math.floor(mockSleepData.stages.light / 60)}h{" "}
                  {mockSleepData.stages.light % 60}m (
                  {Math.round((mockSleepData.stages.light / totalSleepMinutes) * 100)}
                  %)
                </span>
              </div>
              <Progress
                value={(mockSleepData.stages.light / totalSleepMinutes) * 100}
                className="h-3"
                indicatorClassName="bg-blue-400"
              />
            </div>
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
          <div className="flex justify-between items-end h-[150px] gap-2">
            {sleepTrend.map((day) => (
              <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-primary/80 rounded-t-lg transition-all"
                  style={{ height: `${day.score}%` }}
                />
                <span className="text-xs text-muted-foreground">{day.day}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
