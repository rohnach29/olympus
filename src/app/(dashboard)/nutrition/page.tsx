"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Utensils, Flame, Beef, Wheat, Droplet } from "lucide-react";

// Mock data
const mockNutritionGoals = {
  calories: { current: 1450, target: 2000 },
  protein: { current: 95, target: 150 },
  carbs: { current: 120, target: 200 },
  fat: { current: 45, target: 65 },
};

const mockMeals = [
  {
    id: "1",
    meal_type: "breakfast",
    foods: [
      { name: "Oatmeal with berries", calories: 320, protein: 12, carbs: 54, fat: 6 },
      { name: "Greek yogurt", calories: 150, protein: 15, carbs: 8, fat: 5 },
    ],
  },
  {
    id: "2",
    meal_type: "lunch",
    foods: [
      { name: "Grilled chicken salad", calories: 450, protein: 42, carbs: 18, fat: 22 },
      { name: "Whole grain bread", calories: 120, protein: 4, carbs: 22, fat: 2 },
    ],
  },
  {
    id: "3",
    meal_type: "snack",
    foods: [
      { name: "Protein shake", calories: 180, protein: 25, carbs: 8, fat: 3 },
    ],
  },
];

const mealTypeLabels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export default function NutritionPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddFood, setShowAddFood] = useState(false);

  const MacroCard = ({
    label,
    current,
    target,
    unit,
    icon: Icon,
    color,
  }: {
    label: string;
    current: number;
    target: number;
    unit: string;
    icon: React.ElementType;
    color: string;
  }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <span className="font-medium">{label}</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {current} / {target} {unit}
            </span>
            <span className="font-medium">
              {Math.round((current / target) * 100)}%
            </span>
          </div>
          <Progress
            value={(current / target) * 100}
            className="h-2"
            indicatorClassName={color}
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nutrition</h1>
          <p className="text-muted-foreground">Track your daily food intake</p>
        </div>
        <Button onClick={() => setShowAddFood(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Food
        </Button>
      </div>

      {/* Macro Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MacroCard
          label="Calories"
          current={mockNutritionGoals.calories.current}
          target={mockNutritionGoals.calories.target}
          unit="kcal"
          icon={Flame}
          color="bg-orange-500"
        />
        <MacroCard
          label="Protein"
          current={mockNutritionGoals.protein.current}
          target={mockNutritionGoals.protein.target}
          unit="g"
          icon={Beef}
          color="bg-red-500"
        />
        <MacroCard
          label="Carbs"
          current={mockNutritionGoals.carbs.current}
          target={mockNutritionGoals.carbs.target}
          unit="g"
          icon={Wheat}
          color="bg-amber-500"
        />
        <MacroCard
          label="Fat"
          current={mockNutritionGoals.fat.current}
          target={mockNutritionGoals.fat.target}
          unit="g"
          icon={Droplet}
          color="bg-blue-500"
        />
      </div>

      {/* Food Log */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Food Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="breakfast">Breakfast</TabsTrigger>
              <TabsTrigger value="lunch">Lunch</TabsTrigger>
              <TabsTrigger value="dinner">Dinner</TabsTrigger>
              <TabsTrigger value="snack">Snacks</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {mockMeals.map((meal) => (
                <div key={meal.id} className="space-y-2">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    {mealTypeLabels[meal.meal_type]}
                  </h3>
                  <div className="space-y-2">
                    {meal.foods.map((food, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Utensils className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{food.name}</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span>{food.calories} kcal</span>
                          <span>{food.protein}g P</span>
                          <span>{food.carbs}g C</span>
                          <span>{food.fat}g F</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Add more meals prompt */}
              <div className="pt-4">
                <Button variant="outline" className="w-full" onClick={() => setShowAddFood(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Dinner
                </Button>
              </div>
            </TabsContent>

            {["breakfast", "lunch", "dinner", "snack"].map((mealType) => (
              <TabsContent key={mealType} value={mealType} className="space-y-2">
                {mockMeals
                  .filter((m) => m.meal_type === mealType)
                  .flatMap((meal) =>
                    meal.foods.map((food, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Utensils className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{food.name}</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span>{food.calories} kcal</span>
                          <span>{food.protein}g P</span>
                          <span>{food.carbs}g C</span>
                          <span>{food.fat}g F</span>
                        </div>
                      </div>
                    ))
                  )}
                {mockMeals.filter((m) => m.meal_type === mealType).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No {mealTypeLabels[mealType].toLowerCase()} logged yet</p>
                    <Button variant="link" onClick={() => setShowAddFood(true)}>
                      Add food
                    </Button>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Add Modal (simplified inline for now) */}
      {showAddFood && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Food</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search foods..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Or add manually</Label>
                <Input placeholder="Food name" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Calories" type="number" />
                  <Input placeholder="Protein (g)" type="number" />
                  <Input placeholder="Carbs (g)" type="number" />
                  <Input placeholder="Fat (g)" type="number" />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddFood(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setShowAddFood(false)}>Add Food</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
