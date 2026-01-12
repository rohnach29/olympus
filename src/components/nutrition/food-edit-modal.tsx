"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { X, Loader2 } from "lucide-react";

interface FoodLog {
  id: string;
  foodName: string;
  servingQuantity: string;
  servingUnit: string;
}

interface FoodEditModalProps {
  open: boolean;
  onClose: () => void;
  onFoodUpdated: () => void;
  food: FoodLog | null;
}

export function FoodEditModal({
  open,
  onClose,
  onFoodUpdated,
  food,
}: FoodEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [foodName, setFoodName] = useState("");
  const [servingQuantity, setServingQuantity] = useState("");
  const [servingUnit, setServingUnit] = useState("");

  // Populate form when food changes
  useEffect(() => {
    if (food) {
      setFoodName(food.foodName);
      setServingQuantity(food.servingQuantity);
      setServingUnit(food.servingUnit);
    }
  }, [food]);

  const handleSave = async () => {
    if (!food) return;

    setSaving(true);
    try {
      const response = await fetch("/api/nutrition/log", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: food.id,
          foodName,
          servingQuantity: Number(servingQuantity),
          servingUnit,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Update failed:", error);
        return;
      }

      onFoodUpdated();
      onClose();
    } catch (error) {
      console.error("Failed to update food:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !food) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-sm mt-20">
        <CardContent className="pt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Edit Food</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Food Name */}
            <div className="space-y-1">
              <Label className="text-xs">Food Name</Label>
              <Input
                type="text"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="Food name"
              />
            </div>

            {/* Serving Quantity and Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={servingQuantity}
                  onChange={(e) => setServingQuantity(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input
                  type="text"
                  value={servingUnit}
                  onChange={(e) => setServingUnit(e.target.value)}
                  placeholder="g"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving || !foodName.trim()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
