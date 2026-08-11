"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  X,
  Plus,
  Minus,
  Loader2,
  Sparkles,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/** One food resolved from the user's description. Nutrition is for the whole amount. */
interface ParsedItem {
  foodName: string;
  brand: string | null;
  servingQuantity: number;
  servingUnit: string;
  servingSize: number;
  confidence: "high" | "medium" | "low";
  assumption: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  saturatedFatG: number;
  sodiumMg: number;
  cholesterolMg: number;
  vitaminAMcg: number;
  vitaminCMg: number;
  vitaminDMcg: number;
  calciumMg: number;
  ironMg: number;
  potassiumMg: number;
}

/** A parsed item plus the user's own scaling of it. */
interface DraftItem extends ParsedItem {
  key: string;
  multiplier: number;
}

interface FoodSearchModalProps {
  open: boolean;
  onClose: () => void;
  mealType: string;
  loggedDate: string;
  onFoodLogged: () => void;
}

const NUTRITION_KEYS = [
  "calories",
  "proteinG",
  "carbsG",
  "fatG",
  "fiberG",
  "sugarG",
  "saturatedFatG",
  "sodiumMg",
  "cholesterolMg",
  "vitaminAMcg",
  "vitaminCMg",
  "vitaminDMcg",
  "calciumMg",
  "ironMg",
  "potassiumMg",
] as const;

type NutritionKey = (typeof NUTRITION_KEYS)[number];

const CONFIDENCE_STYLES: Record<ParsedItem["confidence"], string> = {
  high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const EXAMPLES = ["1 dragonfruit", "2 eggs and a slice of sourdough", "large flat white"];

export function FoodSearchModal({
  open,
  onClose,
  mealType,
  loggedDate,
  onFoodLogged,
}: FoodSearchModalProps) {
  const [description, setDescription] = useState("");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Manual entry fallback, for when the estimate is wrong or the model is down.
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  useEffect(() => {
    if (!open) {
      setDescription("");
      setDrafts([]);
      setParsing(false);
      setSaving(false);
      setError(null);
      setShowDetail(false);
      setManualMode(false);
      setManual({ name: "", calories: "", protein: "", carbs: "", fat: "" });
    }
  }, [open]);

  const handleParse = async () => {
    if (!description.trim() || parsing) return;

    setParsing(true);
    setError(null);
    try {
      const response = await fetch("/api/foods/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: description.trim() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Could not read that. Try describing it differently.");
        return;
      }

      const items: ParsedItem[] = payload.data?.items ?? [];
      if (items.length === 0) {
        setError("No food found in that description.");
        return;
      }

      setDrafts(
        items.map((item, index) => ({
          ...item,
          key: `${index}-${item.foodName}`,
          multiplier: 1,
        }))
      );
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setParsing(false);
    }
  };

  const scaleItem = (key: string, delta: number) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.key === key ? { ...d, multiplier: Math.max(0.25, Math.round((d.multiplier + delta) * 100) / 100) } : d
      )
    );
  };

  const removeItem = (key: string) => {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  };

  /** Batch totals, with each item scaled by its own multiplier. */
  const totals = drafts.reduce(
    (acc, d) => {
      for (const key of NUTRITION_KEYS) acc[key] += d[key] * d.multiplier;
      return acc;
    },
    Object.fromEntries(NUTRITION_KEYS.map((k) => [k, 0])) as Record<NutritionKey, number>
  );

  const handleLogDrafts = async () => {
    if (drafts.length === 0 || saving) return;

    setSaving(true);
    setError(null);
    const failed: string[] = [];

    for (const draft of drafts) {
      const scaled = Object.fromEntries(
        NUTRITION_KEYS.map((k) => [k, draft[k] * draft.multiplier])
      ) as Record<NutritionKey, number>;

      try {
        const response = await fetch("/api/nutrition/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            foodName: draft.foodName,
            brand: draft.brand,
            servingQuantity: draft.servingQuantity * draft.multiplier,
            servingUnit: draft.servingUnit,
            servingSize: draft.servingSize * draft.multiplier,
            ...scaled,
            mealType,
            loggedDate,
          }),
        });
        if (!response.ok) failed.push(draft.foodName);
      } catch {
        failed.push(draft.foodName);
      }
    }

    setSaving(false);

    if (failed.length > 0) {
      setError(`Could not save: ${failed.join(", ")}. Everything else was logged.`);
      setDrafts((prev) => prev.filter((d) => failed.includes(d.foodName)));
      onFoodLogged();
      return;
    }

    onFoodLogged();
  };

  const handleManualAdd = async () => {
    if (!manual.name || !manual.calories || saving) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: manual.name,
          servingQuantity: 1,
          servingUnit: "serving",
          servingSize: 1,
          calories: Number(manual.calories) || 0,
          proteinG: Number(manual.protein) || 0,
          fatG: Number(manual.fat) || 0,
          carbsG: Number(manual.carbs) || 0,
          mealType,
          loggedDate,
        }),
      });

      if (response.ok) {
        onFoodLogged();
      } else {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Failed to add food.");
      }
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-lg mt-10 mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Add to {mealLabel}</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {manualMode ? (
            /* Manual entry — no model involved */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Food Name</Label>
                <Input
                  placeholder="e.g., Homemade sandwich"
                  value={manual.name}
                  onChange={(e) => setManual({ ...manual, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Calories</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={manual.calories}
                    onChange={(e) => setManual({ ...manual, calories: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Protein (g)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={manual.protein}
                    onChange={(e) => setManual({ ...manual, protein: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Carbs (g)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={manual.carbs}
                    onChange={(e) => setManual({ ...manual, carbs: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fat (g)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={manual.fat}
                    onChange={(e) => setManual({ ...manual, fat: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setManualMode(false)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleManualAdd}
                  disabled={saving || !manual.name || !manual.calories}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Food"}
                </Button>
              </div>
            </div>
          ) : drafts.length > 0 ? (
            /* Review the estimate before it is written */
            <div className="space-y-4">
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {drafts.map((draft) => (
                  <div key={draft.key} className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium capitalize truncate">{draft.foodName}</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round(draft.servingQuantity * draft.multiplier * 100) / 100}{" "}
                          {draft.servingUnit} · {Math.round(draft.servingSize * draft.multiplier)}g
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${CONFIDENCE_STYLES[draft.confidence]}`}
                        >
                          {draft.confidence}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(draft.key)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>

                    {draft.assumption && (
                      <p className="text-xs text-muted-foreground italic">{draft.assumption}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => scaleItem(draft.key, -0.25)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-12 text-center text-sm tabular-nums">
                          ×{draft.multiplier}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => scaleItem(draft.key, 0.25)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground tabular-nums">
                        {Math.round(draft.calories * draft.multiplier)} kcal · P{" "}
                        {Math.round(draft.proteinG * draft.multiplier)}g · C{" "}
                        {Math.round(draft.carbsG * draft.multiplier)}g · F{" "}
                        {Math.round(draft.fatG * draft.multiplier)}g
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Batch totals */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-lg font-bold tabular-nums">{Math.round(totals.calories)}</div>
                  <div className="text-xs text-muted-foreground">kcal</div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-lg font-bold tabular-nums">{Math.round(totals.proteinG)}g</div>
                  <div className="text-xs text-muted-foreground">protein</div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-lg font-bold tabular-nums">{Math.round(totals.carbsG)}g</div>
                  <div className="text-xs text-muted-foreground">carbs</div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-lg font-bold tabular-nums">{Math.round(totals.fatG)}g</div>
                  <div className="text-xs text-muted-foreground">fat</div>
                </div>
              </div>

              <button
                onClick={() => setShowDetail(!showDetail)}
                className="w-full flex items-center justify-between p-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <span>Detailed Nutrition</span>
                {showDetail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showDetail && (
                <div className="p-3 bg-muted/30 rounded-lg space-y-3 text-sm">
                  <div>
                    <div className="font-medium text-xs text-muted-foreground mb-1">MORE MACROS</div>
                    <div className="grid grid-cols-3 gap-2 tabular-nums">
                      <div>Fiber: {totals.fiberG.toFixed(1)}g</div>
                      <div>Sugar: {totals.sugarG.toFixed(1)}g</div>
                      <div>Sat. Fat: {totals.saturatedFatG.toFixed(1)}g</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-xs text-muted-foreground mb-1">MINERALS</div>
                    <div className="grid grid-cols-3 gap-2 tabular-nums">
                      <div>Sodium: {Math.round(totals.sodiumMg)}mg</div>
                      <div>Calcium: {Math.round(totals.calciumMg)}mg</div>
                      <div>Iron: {totals.ironMg.toFixed(1)}mg</div>
                      <div>Potassium: {Math.round(totals.potassiumMg)}mg</div>
                      <div>Cholesterol: {Math.round(totals.cholesterolMg)}mg</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-xs text-muted-foreground mb-1">VITAMINS</div>
                    <div className="grid grid-cols-3 gap-2 tabular-nums">
                      <div>Vit A: {Math.round(totals.vitaminAMcg)}mcg</div>
                      <div>Vit C: {totals.vitaminCMg.toFixed(1)}mg</div>
                      <div>Vit D: {totals.vitaminDMcg.toFixed(1)}mcg</div>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Estimated from your description — adjust anything that looks wrong.
              </p>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDrafts([])}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleLogDrafts} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Add ${drafts.length} ${drafts.length === 1 ? "item" : "items"}`
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Describe what you ate */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>What did you eat?</Label>
                <Input
                  placeholder="1 dragonfruit"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleParse();
                  }}
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    onClick={() => setDescription(example)}
                    className="px-2.5 py-1 rounded-full border border-input text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>

              <Button
                className="w-full"
                onClick={handleParse}
                disabled={parsing || !description.trim()}
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Estimating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Estimate nutrition
                  </>
                )}
              </Button>

              <Button variant="outline" className="w-full" onClick={() => setManualMode(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Enter numbers manually
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
