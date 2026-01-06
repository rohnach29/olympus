"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Dumbbell, Clock, Flame, Heart, TrendingUp } from "lucide-react";

const mockWorkouts = [
  {
    id: "1",
    name: "Morning Run",
    type: "running",
    duration: 32,
    calories: 320,
    heartRateAvg: 145,
    date: "Today, 7:30 AM",
  },
  {
    id: "2",
    name: "Upper Body Strength",
    type: "strength",
    duration: 45,
    calories: 280,
    heartRateAvg: 125,
    date: "Yesterday",
  },
  {
    id: "3",
    name: "HIIT Session",
    type: "hiit",
    duration: 25,
    calories: 310,
    heartRateAvg: 155,
    date: "2 days ago",
  },
];

const weeklyGoal = {
  current: 4,
  target: 5,
  minutes: 142,
  targetMinutes: 150,
};

export default function WorkoutsPage() {
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
                {weeklyGoal.current}/{weeklyGoal.target}
              </span>
            </div>
            <Progress
              value={(weeklyGoal.current / weeklyGoal.target) * 100}
              className="h-3"
            />
            <p className="text-sm text-muted-foreground mt-2">
              {weeklyGoal.target - weeklyGoal.current} more to reach your goal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Active Minutes</h3>
              <span className="text-2xl font-bold">
                {weeklyGoal.minutes}/{weeklyGoal.targetMinutes}
              </span>
            </div>
            <Progress
              value={(weeklyGoal.minutes / weeklyGoal.targetMinutes) * 100}
              className="h-3"
            />
            <p className="text-sm text-muted-foreground mt-2">
              {weeklyGoal.targetMinutes - weeklyGoal.minutes} min remaining this week
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
          {mockWorkouts.map((workout) => (
            <div
              key={workout.id}
              className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{workout.name}</h3>
                  <p className="text-sm text-muted-foreground">{workout.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{workout.duration} min</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Flame className="h-4 w-4" />
                  <span>{workout.calories} kcal</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <span>{workout.heartRateAvg} bpm</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Training Load */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Training Load
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <p>Training load chart will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
