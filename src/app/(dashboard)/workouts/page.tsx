"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Dumbbell,
  Clock,
  Flame,
  Heart,
  TrendingUp,
  Activity,
  Bike,
  Waves,
  Footprints,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Workout {
  id: string;
  type: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number | null;
  heartRateAvg: number | null;
  heartRateMax: number | null;
  startedAt: string;
  endedAt: string;
}

interface WorkoutSummary {
  count: number;
  totalMinutes: number;
  totalCalories: number;
}

const WORKOUT_ICONS: Record<string, React.ReactNode> = {
  strength: <Dumbbell className="h-5 w-5 text-primary" />,
  running: <Footprints className="h-5 w-5 text-green-500" />,
  cycling: <Bike className="h-5 w-5 text-blue-500" />,
  swimming: <Waves className="h-5 w-5 text-cyan-500" />,
  hiit: <Zap className="h-5 w-5 text-orange-500" />,
  yoga: <Activity className="h-5 w-5 text-purple-500" />,
  walking: <Footprints className="h-5 w-5 text-emerald-500" />,
  sports: <Activity className="h-5 w-5 text-red-500" />,
};

const WEEKLY_GOALS = {
  workouts: 5,
  minutes: 150,
};

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [summary, setSummary] = useState<WorkoutSummary>({
    count: 0,
    totalMinutes: 0,
    totalCalories: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const response = await fetch("/api/workouts?limit=10");
        const data = await response.json();

        if (data.workouts) {
          setWorkouts(data.workouts);
          setSummary(data.summary || { count: 0, totalMinutes: 0, totalCalories: 0 });
        }
      } catch (error) {
        console.error("Failed to fetch workouts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, []);

  const formatWorkoutDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return `Today, ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    } else if (diffHours < 48) {
      return "Yesterday";
    } else {
      return formatDistanceToNow(date, { addSuffix: true });
    }
  };

  const getWorkoutIcon = (type: string) => {
    return WORKOUT_ICONS[type] || <Dumbbell className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workouts</h1>
          <p className="text-muted-foreground">Track your exercise and training</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Log Workout
        </Button>
      </div>

      {/* Weekly Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Weekly Workouts</h3>
              <span className="text-2xl font-bold">
                {summary.count}/{WEEKLY_GOALS.workouts}
              </span>
            </div>
            <Progress
              value={Math.min((summary.count / WEEKLY_GOALS.workouts) * 100, 100)}
              className="h-3"
            />
            <p className="text-sm text-muted-foreground mt-2">
              {summary.count >= WEEKLY_GOALS.workouts
                ? "Goal reached! Great job!"
                : `${WEEKLY_GOALS.workouts - summary.count} more to reach your goal`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Active Minutes</h3>
              <span className="text-2xl font-bold">
                {summary.totalMinutes}/{WEEKLY_GOALS.minutes}
              </span>
            </div>
            <Progress
              value={Math.min((summary.totalMinutes / WEEKLY_GOALS.minutes) * 100, 100)}
              className="h-3"
            />
            <p className="text-sm text-muted-foreground mt-2">
              {summary.totalMinutes >= WEEKLY_GOALS.minutes
                ? "Weekly target achieved!"
                : `${WEEKLY_GOALS.minutes - summary.totalMinutes} min remaining this week`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Workouts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Workouts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading workouts...
            </div>
          ) : workouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Dumbbell className="h-12 w-12 mb-4 opacity-50" />
              <p>No workouts logged yet</p>
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Log your first workout
              </Button>
            </div>
          ) : (
            workouts.map((workout) => (
              <div
                key={workout.id}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    {getWorkoutIcon(workout.type)}
                  </div>
                  <div>
                    <h3 className="font-medium">{workout.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatWorkoutDate(workout.startedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{workout.durationMinutes} min</span>
                  </div>
                  {workout.caloriesBurned && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Flame className="h-4 w-4" />
                      <span>{workout.caloriesBurned} kcal</span>
                    </div>
                  )}
                  {workout.heartRateAvg && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Heart className="h-4 w-4" />
                      <span>{workout.heartRateAvg} bpm</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Training Load */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            This Week Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-primary">{summary.count}</div>
              <div className="text-sm text-muted-foreground">Workouts</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-green-500">{summary.totalMinutes}</div>
              <div className="text-sm text-muted-foreground">Minutes</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-orange-500">{summary.totalCalories}</div>
              <div className="text-sm text-muted-foreground">Calories</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
