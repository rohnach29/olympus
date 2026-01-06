"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  X,
  Loader2,
  Calculator,
  Target,
} from "lucide-react";

interface GoalSetupModalProps {
  open: boolean;
  onClose: () => void;
  onGoalsUpdated: () => void;
}

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", description: "Little or no exercise" },
  { value: "light", label: "Lightly Active", description: "Light exercise 1-3 days/week" },
  { value: "moderate", label: "Moderately Active", description: "Moderate exercise 3-5 days/week" },
  { value: "active", label: "Very Active", description: "Hard exercise 6-7 days/week" },
  { value: "very_active", label: "Extra Active", description: "Very hard exercise, physical job" },
];

const GOALS = [
  { value: "lose_fast", label: "Lose weight fast", description: "-1.5 lbs/week" },
  { value: "lose", label: "Lose weight", description: "-1 lb/week" },
  { value: "lose_slow", label: "Lose weight slowly", description: "-0.5 lb/week" },
  { value: "maintain", label: "Maintain weight", description: "Stay at current weight" },
  { value: "gain_slow", label: "Gain weight slowly", description: "+0.5 lb/week" },
  { value: "gain", label: "Gain weight", description: "+1 lb/week" },
];

export function GoalSetupModal({
  open,
  onClose,
  onGoalsUpdated,
}: GoalSetupModalProps) {
  const [mode, setMode] = useState<"calculate" | "manual">("calculate");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calculator inputs
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [goal, setGoal] = useState("maintain");

  // Manual/Result inputs
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");

  // Macro mode
  const [usePercentages, setUsePercentages] = useState(false);
  const [proteinPercent, setProteinPercent] = useState("30");
  const [carbsPercent, setCarbsPercent] = useState("40");
  const [fatPercent, setFatPercent] = useState("30");

  // Load existing goals
  useEffect(() => {
    if (open) {
      fetchCurrentGoals();
    }
  }, [open]);

  const fetchCurrentGoals = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/nutrition/goals");
      const data = await response.json();
      if (data.goals) {
        setCalories(String(data.goals.calorieGoal));
        setProteinG(String(data.goals.proteinG));
        setCarbsG(String(data.goals.carbsG));
        setFatG(String(data.goals.fatG));
        setActivityLevel(data.goals.activityLevel || "moderate");
        setGoal(data.goals.goal || "maintain");
        setUsePercentages(data.goals.usePercentages || false);
        setProteinPercent(String(data.goals.proteinPercent || 30));
        setCarbsPercent(String(data.goals.carbsPercent || 40));
        setFatPercent(String(data.goals.fatPercent || 30));
      }
    } catch (error) {
      console.error("Failed to fetch goals:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate goals
  const handleCalculate = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/nutrition/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: Number(age) || undefined,
          gender,
          heightCm: Number(heightCm) || undefined,
          weightKg: Number(weightKg) || undefined,
          activityLevel,
          goal,
          usePercentages,
          proteinPercent: Number(proteinPercent),
          carbsPercent: Number(carbsPercent),
          fatPercent: Number(fatPercent),
        }),
      });

      const data = await response.json();
      if (data.calculation) {
        setCalories(String(data.calculation.calorieGoal));
        setProteinG(String(data.calculation.proteinG));
        setCarbsG(String(data.calculation.carbsG));
        setFatG(String(data.calculation.fatG));
        setMode("manual"); // Switch to manual to show results
        onGoalsUpdated();
      }
    } catch (error) {
      console.error("Failed to calculate:", error);
    } finally {
      setSaving(false);
    }
  };

  // Save manual goals
  const handleSaveManual = async () => {
    setSaving(true);
    try {
      await fetch("/api/nutrition/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualCalories: Number(calories),
          proteinG: Number(proteinG),
          carbsG: Number(carbsG),
          fatG: Number(fatG),
          usePercentages: false,
        }),
      });
      onGoalsUpdated();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  // Update macros when percentages change
  useEffect(() => {
    if (usePercentages && calories) {
      const cal = Number(calories);
      setProteinG(String(Math.round((cal * (Number(proteinPercent) / 100)) / 4)));
      setCarbsG(String(Math.round((cal * (Number(carbsPercent) / 100)) / 4)));
      setFatG(String(Math.round((cal * (Number(fatPercent) / 100)) / 9)));
    }
  }, [calories, proteinPercent, carbsPercent, fatPercent, usePercentages]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-md mt-10 mb-8">
        <CardContent className="pt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Nutrition Goals</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "calculate" | "manual")}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="calculate">
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <Target className="h-4 w-4 mr-2" />
                  Set Goals
                </TabsTrigger>
              </TabsList>

              {/* Calculator Tab */}
              <TabsContent value="calculate" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your details to calculate personalized calorie and macro goals.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Age</Label>
                    <Input
                      type="number"
                      placeholder="30"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gender</Label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      type="number"
                      placeholder="175"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      type="number"
                      placeholder="70"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Activity Level</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                  >
                    {ACTIVITY_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label} - {level.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Goal</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  >
                    {GOALS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label} ({g.description})
                      </option>
                    ))}
                  </select>
                </div>

                <Button className="w-full" onClick={handleCalculate} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate Goals
                    </>
                  )}
                </Button>
              </TabsContent>

              {/* Manual Tab */}
              <TabsContent value="manual" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set your daily calorie and macro targets directly.
                </p>

                <div className="space-y-1">
                  <Label className="text-xs">Daily Calories</Label>
                  <Input
                    type="number"
                    placeholder="2000"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                  />
                </div>

                {/* Macro Mode Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="usePercentages"
                    checked={usePercentages}
                    onChange={(e) => setUsePercentages(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="usePercentages" className="text-sm cursor-pointer">
                    Set macros by percentage
                  </Label>
                </div>

                {usePercentages ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Protein %</Label>
                      <Input
                        type="number"
                        value={proteinPercent}
                        onChange={(e) => setProteinPercent(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Carbs %</Label>
                      <Input
                        type="number"
                        value={carbsPercent}
                        onChange={(e) => setCarbsPercent(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fat %</Label>
                      <Input
                        type="number"
                        value={fatPercent}
                        onChange={(e) => setFatPercent(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Protein (g)</Label>
                    <Input
                      type="number"
                      placeholder="150"
                      value={proteinG}
                      onChange={(e) => setProteinG(e.target.value)}
                      disabled={usePercentages}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Carbs (g)</Label>
                    <Input
                      type="number"
                      placeholder="200"
                      value={carbsG}
                      onChange={(e) => setCarbsG(e.target.value)}
                      disabled={usePercentages}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fat (g)</Label>
                    <Input
                      type="number"
                      placeholder="65"
                      value={fatG}
                      onChange={(e) => setFatG(e.target.value)}
                      disabled={usePercentages}
                    />
                  </div>
                </div>

                {/* Preview */}
                {calories && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <div className="font-medium mb-1">Daily Targets:</div>
                    <div className="text-muted-foreground">
                      {calories} kcal • {proteinG}g protein • {carbsG}g carbs • {fatG}g fat
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={handleSaveManual} disabled={saving || !calories}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save Goals"
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
