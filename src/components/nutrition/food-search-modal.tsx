"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  X,
  Plus,
  Minus,
  Loader2,
  Utensils,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Food {
  id: string;
  name: string;
  brand?: string;
  servingSize: string;
  servingUnit: string;
  servingSizeDescription?: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG?: string;
  sugarG?: string;
  saturatedFatG?: string;
  sodiumMg?: string;
  cholesterolMg?: string;
  vitaminAMcg?: string;
  vitaminCMg?: string;
  vitaminDMcg?: string;
  calciumMg?: string;
  ironMg?: string;
  potassiumMg?: string;
}

interface Portion {
  id: string;
  portionName: string;
  gramWeight: string;
  isDefault: boolean;
}

interface FoodSearchModalProps {
  open: boolean;
  onClose: () => void;
  mealType: string;
  loggedDate: string;
  onFoodLogged: () => void;
}

export function FoodSearchModal({
  open,
  onClose,
  mealType,
  loggedDate,
  onFoodLogged,
}: FoodSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [portions, setPortions] = useState<Portion[]>([]);
  const [selectedPortion, setSelectedPortion] = useState<string>("100g");
  const [servingQuantity, setServingQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showMicronutrients, setShowMicronutrients] = useState(false);

  // Quick add state
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/foods/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        setSearchResults(data.foods || []);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedFood(null);
      setPortions([]);
      setSelectedPortion("100g");
      setServingQuantity(1);
      setQuickAddMode(false);
      setShowMicronutrients(false);
      setQuickAddData({ name: "", calories: "", protein: "", carbs: "", fat: "" });
    }
  }, [open]);

  // Fetch food details when selected
  const handleSelectFood = async (food: Food) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/foods/${food.id}`);
      const data = await response.json();

      if (data.food) {
        setSelectedFood(data.food);
        setPortions(data.portions || []);

        // Set default portion if available
        const defaultPortion = data.portions?.find((p: Portion) => p.isDefault);
        if (defaultPortion) {
          setSelectedPortion(defaultPortion.portionName);
        } else if (data.portions?.length > 0) {
          setSelectedPortion(data.portions[0].portionName);
        } else {
          setSelectedPortion("100g");
        }
        setServingQuantity(1);
      }
    } catch (error) {
      console.error("Failed to fetch food details:", error);
      // Fall back to basic food data
      setSelectedFood(food);
      setSelectedPortion("100g");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Get gram weight for selected portion
  const getGramWeight = useCallback(() => {
    if (selectedPortion === "100g") return 100;
    const portion = portions.find(p => p.portionName === selectedPortion);
    return portion ? Number(portion.gramWeight) : 100;
  }, [selectedPortion, portions]);

  // Calculate nutrition for selected serving
  const getAdjustedNutrition = useCallback(() => {
    if (!selectedFood) return {
      calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
      sugar: 0, saturatedFat: 0, sodium: 0, cholesterol: 0,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, calcium: 0, iron: 0, potassium: 0
    };

    const gramWeight = getGramWeight();
    const multiplier = (gramWeight / 100) * servingQuantity;

    return {
      calories: Number(selectedFood.calories) * multiplier,
      protein: Number(selectedFood.proteinG) * multiplier,
      carbs: Number(selectedFood.carbsG) * multiplier,
      fat: Number(selectedFood.fatG) * multiplier,
      fiber: Number(selectedFood.fiberG || 0) * multiplier,
      sugar: Number(selectedFood.sugarG || 0) * multiplier,
      saturatedFat: Number(selectedFood.saturatedFatG || 0) * multiplier,
      sodium: Number(selectedFood.sodiumMg || 0) * multiplier,
      cholesterol: Number(selectedFood.cholesterolMg || 0) * multiplier,
      vitaminA: Number(selectedFood.vitaminAMcg || 0) * multiplier,
      vitaminC: Number(selectedFood.vitaminCMg || 0) * multiplier,
      vitaminD: Number(selectedFood.vitaminDMcg || 0) * multiplier,
      calcium: Number(selectedFood.calciumMg || 0) * multiplier,
      iron: Number(selectedFood.ironMg || 0) * multiplier,
      potassium: Number(selectedFood.potassiumMg || 0) * multiplier,
    };
  }, [selectedFood, servingQuantity, getGramWeight]);

  // Log selected food
  const handleLogFood = async () => {
    if (!selectedFood) return;

    setSaving(true);
    try {
      const nutrition = getAdjustedNutrition();
      const gramWeight = getGramWeight() * servingQuantity;

      const response = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodId: selectedFood.id,
          foodName: selectedFood.name,
          brand: selectedFood.brand,
          servingQuantity,
          servingUnit: selectedPortion,
          servingSize: gramWeight,
          calories: nutrition.calories,
          proteinG: nutrition.protein,
          fatG: nutrition.fat,
          carbsG: nutrition.carbs,
          fiberG: nutrition.fiber,
          sugarG: nutrition.sugar,
          saturatedFatG: nutrition.saturatedFat,
          sodiumMg: nutrition.sodium,
          cholesterolMg: nutrition.cholesterol,
          vitaminAMcg: nutrition.vitaminA,
          vitaminCMg: nutrition.vitaminC,
          vitaminDMcg: nutrition.vitaminD,
          calciumMg: nutrition.calcium,
          ironMg: nutrition.iron,
          potassiumMg: nutrition.potassium,
          mealType,
          loggedDate,
        }),
      });

      if (response.ok) {
        onFoodLogged();
      }
    } catch (error) {
      console.error("Failed to log food:", error);
    } finally {
      setSaving(false);
    }
  };

  // Quick add food
  const handleQuickAdd = async () => {
    if (!quickAddData.name || !quickAddData.calories) return;

    setSaving(true);
    try {
      const response = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: quickAddData.name,
          servingQuantity: 1,
          servingUnit: "serving",
          servingSize: 1,
          calories: Number(quickAddData.calories) || 0,
          proteinG: Number(quickAddData.protein) || 0,
          fatG: Number(quickAddData.fat) || 0,
          carbsG: Number(quickAddData.carbs) || 0,
          mealType,
          loggedDate,
        }),
      });

      if (response.ok) {
        onFoodLogged();
      }
    } catch (error) {
      console.error("Failed to add food:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const nutrition = getAdjustedNutrition();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-lg mt-10 mb-8">
        <CardContent className="pt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Add to {mealLabel}</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Loading food details */}
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : selectedFood ? (
            /* Selected Food View */
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium">{selectedFood.name}</h3>
                {selectedFood.brand && (
                  <p className="text-sm text-muted-foreground">{selectedFood.brand}</p>
                )}
              </div>

              {/* Portion Selector */}
              <div className="space-y-2">
                <Label>Serving Size</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={selectedPortion}
                  onChange={(e) => setSelectedPortion(e.target.value)}
                >
                  <option value="100g">100g</option>
                  {portions.map((portion) => (
                    <option key={portion.id} value={portion.portionName}>
                      {portion.portionName} ({portion.gramWeight}g)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Adjuster */}
              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setServingQuantity(Math.max(0.25, servingQuantity - 0.25))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={servingQuantity}
                    onChange={(e) => setServingQuantity(Math.max(0.25, Number(e.target.value)))}
                    className="w-20 text-center"
                    step={0.25}
                    min={0.25}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setServingQuantity(servingQuantity + 0.25)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    = {Math.round(getGramWeight() * servingQuantity)}g
                  </span>
                </div>
              </div>

              {/* Macro Preview */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-lg font-bold">{Math.round(nutrition.calories)}</div>
                  <div className="text-xs text-muted-foreground">kcal</div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-lg font-bold">{Math.round(nutrition.protein)}g</div>
                  <div className="text-xs text-muted-foreground">protein</div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-lg font-bold">{Math.round(nutrition.carbs)}g</div>
                  <div className="text-xs text-muted-foreground">carbs</div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-lg font-bold">{Math.round(nutrition.fat)}g</div>
                  <div className="text-xs text-muted-foreground">fat</div>
                </div>
              </div>

              {/* Micronutrients Toggle */}
              <button
                onClick={() => setShowMicronutrients(!showMicronutrients)}
                className="w-full flex items-center justify-between p-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <span>Detailed Nutrition</span>
                {showMicronutrients ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {/* Micronutrients Detail */}
              {showMicronutrients && (
                <div className="p-3 bg-muted/30 rounded-lg space-y-3 text-sm">
                  {/* Additional macros */}
                  <div>
                    <div className="font-medium text-xs text-muted-foreground mb-1">MORE MACROS</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>Fiber: {nutrition.fiber.toFixed(1)}g</div>
                      <div>Sugar: {nutrition.sugar.toFixed(1)}g</div>
                      <div>Sat. Fat: {nutrition.saturatedFat.toFixed(1)}g</div>
                    </div>
                  </div>

                  {/* Minerals */}
                  <div>
                    <div className="font-medium text-xs text-muted-foreground mb-1">MINERALS</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>Sodium: {Math.round(nutrition.sodium)}mg</div>
                      <div>Calcium: {Math.round(nutrition.calcium)}mg</div>
                      <div>Iron: {nutrition.iron.toFixed(1)}mg</div>
                      <div>Potassium: {Math.round(nutrition.potassium)}mg</div>
                      <div>Cholesterol: {Math.round(nutrition.cholesterol)}mg</div>
                    </div>
                  </div>

                  {/* Vitamins */}
                  <div>
                    <div className="font-medium text-xs text-muted-foreground mb-1">VITAMINS</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>Vit A: {Math.round(nutrition.vitaminA)}mcg</div>
                      <div>Vit C: {nutrition.vitaminC.toFixed(1)}mg</div>
                      <div>Vit D: {nutrition.vitaminD.toFixed(1)}mcg</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedFood(null)}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleLogFood} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Food"}
                </Button>
              </div>
            </div>
          ) : quickAddMode ? (
            /* Quick Add Form */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Food Name</Label>
                <Input
                  placeholder="e.g., Homemade sandwich"
                  value={quickAddData.name}
                  onChange={(e) => setQuickAddData({ ...quickAddData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Calories</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={quickAddData.calories}
                    onChange={(e) => setQuickAddData({ ...quickAddData, calories: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Protein (g)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={quickAddData.protein}
                    onChange={(e) => setQuickAddData({ ...quickAddData, protein: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Carbs (g)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={quickAddData.carbs}
                    onChange={(e) => setQuickAddData({ ...quickAddData, carbs: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fat (g)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={quickAddData.fat}
                    onChange={(e) => setQuickAddData({ ...quickAddData, fat: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setQuickAddMode(false)}>
                  Back to Search
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleQuickAdd}
                  disabled={saving || !quickAddData.name || !quickAddData.calories}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Food"}
                </Button>
              </div>
            </div>
          ) : (
            /* Search View */
            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search foods..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Search Results */}
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => handleSelectFood(food)}
                      className="w-full p-3 text-left rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{food.name}</div>
                          {food.brand && (
                            <div className="text-xs text-muted-foreground">{food.brand}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {food.servingSizeDescription || `${food.servingSize}${food.servingUnit}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{Math.round(Number(food.calories))} kcal</div>
                          <div className="text-xs text-muted-foreground">
                            P: {Math.round(Number(food.proteinG))}g •
                            C: {Math.round(Number(food.carbsG))}g •
                            F: {Math.round(Number(food.fatG))}g
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : searchQuery.length >= 2 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No foods found</p>
                    <Button variant="link" onClick={() => setQuickAddMode(true)}>
                      Add manually
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Search for a food to add</p>
                  </div>
                )}
              </div>

              {/* Quick Add Option */}
              <Button variant="outline" className="w-full" onClick={() => setQuickAddMode(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Quick add (manual entry)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
