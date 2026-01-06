import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, foods, recentFoods, favoriteFoods } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

// GET - Get recent and favorite foods for quick access
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get recent foods (last 20)
    const recent = await db
      .select({
        id: foods.id,
        name: foods.name,
        brand: foods.brand,
        servingSize: foods.servingSize,
        servingUnit: foods.servingUnit,
        servingSizeDescription: foods.servingSizeDescription,
        calories: foods.calories,
        proteinG: foods.proteinG,
        carbsG: foods.carbsG,
        fatG: foods.fatG,
        lastUsedAt: recentFoods.lastUsedAt,
      })
      .from(recentFoods)
      .innerJoin(foods, eq(recentFoods.foodId, foods.id))
      .where(eq(recentFoods.userId, user.id))
      .orderBy(desc(recentFoods.lastUsedAt))
      .limit(20);

    // Get favorite foods
    const favorites = await db
      .select({
        id: foods.id,
        name: foods.name,
        brand: foods.brand,
        servingSize: foods.servingSize,
        servingUnit: foods.servingUnit,
        servingSizeDescription: foods.servingSizeDescription,
        calories: foods.calories,
        proteinG: foods.proteinG,
        carbsG: foods.carbsG,
        fatG: foods.fatG,
      })
      .from(favoriteFoods)
      .innerJoin(foods, eq(favoriteFoods.foodId, foods.id))
      .where(eq(favoriteFoods.userId, user.id))
      .orderBy(foods.name)
      .limit(50);

    return NextResponse.json({
      recent,
      favorites,
    });
  } catch (error) {
    console.error("Get recent foods error:", error);
    return NextResponse.json(
      { error: "Failed to get recent foods" },
      { status: 500 }
    );
  }
}
