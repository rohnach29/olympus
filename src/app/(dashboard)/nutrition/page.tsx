"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Trash2,
  Settings,
  Flame,
  Beef,
  Wheat,
  Droplets,
} from "lucide-react";
import { FoodSearchModal } from "@/components/nutrition/food-search-modal";
import { GoalSetupModal } from "@/components/nutrition/goal-setup-modal";

interface FoodLog {
  id: string;
  foodName: string;
  brand?: string;
  servingQuantity: string;
  servingUnit: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
}

interface DayData {
  date: string;
  logs: {
    breakfast: FoodLog[];
    lunch: FoodLog[];
    dinner: FoodLog[];
    snack: FoodLog[];
  };
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    saturatedFat: number;
    sodium: number;
    cholesterol: number;
    vitaminA: number;
    vitaminC: number;
    vitaminD: number;
    calcium: number;
    iron: number;
    potassium: number;
  };
}

interface Goals {
  calorieGoal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const MEAL_CONFIG = [
  { key: "breakfast", label: "Breakfast", icon: Coffee, color: "text-orange-500" },
  { key: "lunch", label: "Lunch", icon: Sun, color: "text-yellow-500" },
  { key: "dinner", label: "Dinner", icon: Moon, color: "text-blue-500" },
  { key: "snack", label: "Snacks", icon: Cookie, color: "text-pink-500" },
] as const;

export default function NutritionPage() {
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split("T")[0]);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [goals, setGoals] = useState<Goals>({ calorieGoal: 2000, proteinG: 150, carbsG: 200, fatG: 65 });
  const [loading, setLoading] = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string>("breakfast");

  // Fetch day data
  const fetchDayData = async () => {
    try {
      const response = await fetch(`/api/nutrition/log?date=${currentDate}`);
      const data = await response.json();

      const emptyTotals = {
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
        sugar: 0, saturatedFat: 0, sodium: 0, cholesterol: 0,
        vitaminA: 0, vitaminC: 0, vitaminD: 0, calcium: 0, iron: 0, potassium: 0
      };

      // Make sure we have a valid response structure
      if (data.logs) {
        setDayData({
          ...data,
          totals: { ...emptyTotals, ...data.totals }
        });
      } else {
        // API returned an error or unexpected format
        console.error("Invalid API response:", data);
        setDayData({
          date: currentDate,
          logs: { breakfast: [], lunch: [], dinner: [], snack: [] },
          totals: emptyTotals,
        });
      }
    } catch (error) {
      console.error("Failed to fetch day data:", error);
      // Set empty state so UI still renders
      setDayData({
        date: currentDate,
        logs: { breakfast: [], lunch: [], dinner: [], snack: [] },
        totals: {
          calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
          sugar: 0, saturatedFat: 0, sodium: 0, cholesterol: 0,
          vitaminA: 0, vitaminC: 0, vitaminD: 0, calcium: 0, iron: 0, potassium: 0
        },
      });
    }
  };

  // Fetch goals
  const fetchGoals = async () => {
    try {
      const response = await fetch("/api/nutrition/goals");
      const data = await response.json();
      if (data.goals) {
        setGoals({
          calorieGoal: data.goals.calorieGoal,
          proteinG: data.goals.proteinG,
          carbsG: data.goals.carbsG,
          fatG: data.goals.fatG,
        });
      }
    } catch (error) {
      console.error("Failed to fetch goals:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchDayData(), fetchGoals()]);
      setLoading(false);
    };
    init();
  }, [currentDate]);

  // Navigate dates
  const goToPreviousDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 1);
    setCurrentDate(date.toISOString().split("T")[0]);
  };

  const goToNextDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 1);
    setCurrentDate(date.toISOString().split("T")[0]);
  };

  const goToToday = () => {
    setCurrentDate(new Date().toISOString().split("T")[0]);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split("T")[0]) {
      return "Today";
    } else if (dateStr === yesterday.toISOString().split("T")[0]) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
  };

  // Add food to meal
  const handleAddFood = (mealType: string) => {
    setSelectedMealType(mealType);
    setSearchModalOpen(true);
  };

  // Delete food log
  const handleDeleteLog = async (logId: string) => {
    try {
      const response = await fetch(`/api/nutrition/log?id=${logId}`, { method: "DELETE" });
      if (!response.ok) {
        const error = await response.json();
        console.error("Delete failed:", error);
        return;
      }
      fetchDayData();
    } catch (error) {
      console.error("Failed to delete log:", error);
    }
  };

  // Handle food logged from modal
  const handleFoodLogged = () => {
    setSearchModalOpen(false);
    fetchDayData();
  };

  // Handle goals updated
  const handleGoalsUpdated = () => {
    setGoalModalOpen(false);
    fetchGoals();
  };

  const defaultTotals = {
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
    sugar: 0, saturatedFat: 0, sodium: 0, cholesterol: 0,
    vitaminA: 0, vitaminC: 0, vitaminD: 0, calcium: 0, iron: 0, potassium: 0
  };
  const totals = dayData?.totals ? { ...defaultTotals, ...dayData.totals } : defaultTotals;
  const caloriesRemaining = goals.calorieGoal - totals.calories;

  // Calculate macro split based on actual macro calories (not logged calories)
  const macroCalories = {
    protein: totals.protein * 4,
    carbs: totals.carbs * 4,
    fat: totals.fat * 9,
  };
  const totalMacroCalories = macroCalories.protein + macroCalories.carbs + macroCalories.fat;

  // Calculate percentages with 1 decimal, ensuring they sum to 100%
  const rawProteinPct = totalMacroCalories > 0 ? (macroCalories.protein / totalMacroCalories) * 100 : 0;
  const rawCarbsPct = totalMacroCalories > 0 ? (macroCalories.carbs / totalMacroCalories) * 100 : 0;
  const rawFatPct = totalMacroCalories > 0 ? (macroCalories.fat / totalMacroCalories) * 100 : 0;

  // Round protein and carbs, calculate fat as remainder to ensure sum = 100
  const proteinPct = Math.round(rawProteinPct * 10) / 10;
  const carbsPct = Math.round(rawCarbsPct * 10) / 10;
  const fatPct = totalMacroCalories > 0 ? Math.round((100 - proteinPct - carbsPct) * 10) / 10 : 0;

  const macroPercents = { protein: proteinPct, carbs: carbsPct, fat: fatPct };

  return (
    <div className="space-y-6">
      {/* Header with date navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nutrition</h1>
          <p className="text-muted-foreground">Track your daily food intake</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setGoalModalOpen(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Goals
        </Button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button variant="outline" onClick={goToToday} className="min-w-[140px]">
          {formatDate(currentDate)}
        </Button>
        <Button variant="ghost" size="icon" onClick={goToNextDay}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Daily Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Calories */}
            <div className="col-span-2 md:col-span-1 text-center p-4 bg-muted/50 rounded-lg">
              <Flame className="h-6 w-6 mx-auto mb-2 text-orange-500" />
              <div className="text-3xl font-bold">{Math.round(totals.calories)}</div>
              <div className="text-sm text-muted-foreground">/ {goals.calorieGoal} kcal</div>
              <Progress
                value={Math.min((totals.calories / goals.calorieGoal) * 100, 100)}
                className="mt-2 h-2"
              />
              <div className="text-xs mt-1 text-muted-foreground">
                {caloriesRemaining > 0 ? `${Math.round(caloriesRemaining)} left` : `${Math.round(-caloriesRemaining)} over`}
              </div>
            </div>

            {/* Protein */}
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Beef className="h-5 w-5 mx-auto mb-2 text-red-500" />
              <div className="text-2xl font-bold">{Math.round(totals.protein)}g</div>
              <div className="text-xs text-muted-foreground">/ {goals.proteinG}g protein</div>
              <Progress
                value={Math.min((totals.protein / goals.proteinG) * 100, 100)}
                className="mt-2 h-1.5"
              />
            </div>

            {/* Carbs */}
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Wheat className="h-5 w-5 mx-auto mb-2 text-amber-500" />
              <div className="text-2xl font-bold">{Math.round(totals.carbs)}g</div>
              <div className="text-xs text-muted-foreground">/ {goals.carbsG}g carbs</div>
              <Progress
                value={Math.min((totals.carbs / goals.carbsG) * 100, 100)}
                className="mt-2 h-1.5"
              />
            </div>

            {/* Fat */}
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Droplets className="h-5 w-5 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{Math.round(totals.fat)}g</div>
              <div className="text-xs text-muted-foreground">/ {goals.fatG}g fat</div>
              <Progress
                value={Math.min((totals.fat / goals.fatG) * 100, 100)}
                className="mt-2 h-1.5"
              />
            </div>

            {/* Macro Split Bar */}
            <div className="hidden md:flex flex-col justify-center p-4 bg-muted/50 rounded-lg">
              <div className="text-xs font-medium text-muted-foreground mb-2">Macro Split</div>
              {totalMacroCalories > 0 ? (
                <>
                  <div className="flex h-3 rounded-full overflow-hidden mb-2">
                    <div
                      className="bg-red-500 transition-all"
                      style={{ width: `${macroPercents.protein}%` }}
                    />
                    <div
                      className="bg-amber-500 transition-all"
                      style={{ width: `${macroPercents.carbs}%` }}
                    />
                    <div
                      className="bg-blue-500 transition-all"
                      style={{ width: `${macroPercents.fat}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-red-500 font-medium">{macroPercents.protein.toFixed(1)}% P</span>
                    <span className="text-amber-500 font-medium">{macroPercents.carbs.toFixed(1)}% C</span>
                    <span className="text-blue-500 font-medium">{macroPercents.fat.toFixed(1)}% F</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground text-center">No data yet</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Micronutrients Section */}
      {totals.calories > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Micronutrients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-sm">
              {/* Additional Macros */}
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Fiber</div>
                <div className="font-medium">{totals.fiber.toFixed(1)}g</div>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Sugar</div>
                <div className="font-medium">{totals.sugar.toFixed(1)}g</div>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Sat. Fat</div>
                <div className="font-medium">{totals.saturatedFat.toFixed(1)}g</div>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Cholesterol</div>
                <div className="font-medium">{Math.round(totals.cholesterol)}mg</div>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Sodium</div>
                <div className="font-medium">{Math.round(totals.sodium)}mg</div>
              </div>

              {/* Vitamins */}
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Vitamin A</div>
                <div className="font-medium">{Math.round(totals.vitaminA)}mcg</div>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Vitamin C</div>
                <div className="font-medium">{totals.vitaminC.toFixed(1)}mg</div>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Vitamin D</div>
                <div className="font-medium">{totals.vitaminD.toFixed(1)}mcg</div>
              </div>

              {/* Minerals */}
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Calcium</div>
                <div className="font-medium">{Math.round(totals.calcium)}mg</div>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Iron</div>
                <div className="font-medium">{totals.iron.toFixed(1)}mg</div>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <div className="text-xs text-muted-foreground">Potassium</div>
                <div className="font-medium">{Math.round(totals.potassium)}mg</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meal Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MEAL_CONFIG.map((meal) => {
          const mealLogs = dayData?.logs?.[meal.key] || [];
          const mealCalories = mealLogs.reduce((sum, log) => sum + Number(log.calories), 0);

          return (
            <Card key={meal.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <meal.icon className={`h-5 w-5 ${meal.color}`} />
                    {meal.label}
                    {mealCalories > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({Math.round(mealCalories)} kcal)
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddFood(meal.key)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {mealLogs.length === 0 ? (
                  <button
                    onClick={() => handleAddFood(meal.key)}
                    className="w-full py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">Add food</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {mealLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{log.foodName}</div>
                          <div className="text-xs text-muted-foreground">
                            {log.servingQuantity} {log.servingUnit} •{" "}
                            {Math.round(Number(log.calories))} kcal
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-right hidden sm:block">
                            <div>P: {Math.round(Number(log.proteinG))}g</div>
                            <div>C: {Math.round(Number(log.carbsG))}g</div>
                            <div>F: {Math.round(Number(log.fatG))}g</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteLog(log.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => handleAddFood(meal.key)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add more
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Food Search Modal */}
      <FoodSearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        mealType={selectedMealType}
        loggedDate={currentDate}
        onFoodLogged={handleFoodLogged}
      />

      {/* Goal Setup Modal */}
      <GoalSetupModal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        onGoalsUpdated={handleGoalsUpdated}
      />
    </div>
  );
}
