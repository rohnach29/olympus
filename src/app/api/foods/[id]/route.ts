import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, foods, foodPortions } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch food with all nutrition data
    const food = await db
      .select()
      .from(foods)
      .where(eq(foods.id, id))
      .limit(1);

    if (food.length === 0) {
      return NextResponse.json({ error: "Food not found" }, { status: 404 });
    }

    // Fetch available portions for this food
    const portions = await db
      .select({
        id: foodPortions.id,
        portionName: foodPortions.portionName,
        gramWeight: foodPortions.gramWeight,
        isDefault: foodPortions.isDefault,
      })
      .from(foodPortions)
      .where(eq(foodPortions.foodId, id));

    return NextResponse.json({
      food: food[0],
      portions,
    });
  } catch (error) {
    console.error("Get food error:", error);
    return NextResponse.json(
      { error: "Failed to get food" },
      { status: 500 }
    );
  }
}
