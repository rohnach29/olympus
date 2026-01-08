import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, foodLogs, foods, recentFoods } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { getTodayDateString, getUserTimezone } from "@/lib/utils/timezone";

// GET - Get food logs for a specific date
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    // Default to today in user's timezone
    const userTimezone = getUserTimezone(user.settings);
    const date = searchParams.get("date") || getTodayDateString(userTimezone);

    const logs = await db
      .select()
      .from(foodLogs)
      .where(
        and(
          eq(foodLogs.userId, user.id),
          eq(foodLogs.loggedDate, date)
        )
      )
      .orderBy(foodLogs.createdAt);

    // Group by meal type
    const groupedLogs = {
      breakfast: logs.filter((l) => l.mealType === "breakfast"),
      lunch: logs.filter((l) => l.mealType === "lunch"),
      dinner: logs.filter((l) => l.mealType === "dinner"),
      snack: logs.filter((l) => l.mealType === "snack"),
    };

    // Calculate totals including micronutrients
    const totals = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + Number(log.calories),
        protein: acc.protein + Number(log.proteinG),
        carbs: acc.carbs + Number(log.carbsG),
        fat: acc.fat + Number(log.fatG),
        fiber: acc.fiber + Number(log.fiberG || 0),
        sugar: acc.sugar + Number(log.sugarG || 0),
        saturatedFat: acc.saturatedFat + Number(log.saturatedFatG || 0),
        sodium: acc.sodium + Number(log.sodiumMg || 0),
        cholesterol: acc.cholesterol + Number(log.cholesterolMg || 0),
        vitaminA: acc.vitaminA + Number(log.vitaminAMcg || 0),
        vitaminC: acc.vitaminC + Number(log.vitaminCMg || 0),
        vitaminD: acc.vitaminD + Number(log.vitaminDMcg || 0),
        calcium: acc.calcium + Number(log.calciumMg || 0),
        iron: acc.iron + Number(log.ironMg || 0),
        potassium: acc.potassium + Number(log.potassiumMg || 0),
      }),
      {
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
        sugar: 0, saturatedFat: 0, sodium: 0, cholesterol: 0,
        vitaminA: 0, vitaminC: 0, vitaminD: 0, calcium: 0, iron: 0, potassium: 0
      }
    );

    return NextResponse.json({
      date,
      logs: groupedLogs,
      totals,
    });
  } catch (error) {
    console.error("Get food logs error:", error);
    return NextResponse.json(
      { error: "Failed to get food logs" },
      { status: 500 }
    );
  }
}

// POST - Add a food log
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      foodId,
      foodName,
      brand,
      servingQuantity,
      servingUnit,
      servingSize,
      calories,
      proteinG,
      fatG,
      carbsG,
      fiberG,
      sugarG,
      saturatedFatG,
      sodiumMg,
      cholesterolMg,
      vitaminAMcg,
      vitaminCMg,
      vitaminDMcg,
      calciumMg,
      ironMg,
      potassiumMg,
      mealType,
      loggedDate,
    } = body;

    if (!foodName || !mealType) {
      return NextResponse.json(
        { error: "Food name and meal type are required" },
        { status: 400 }
      );
    }

    // Default to today in user's timezone
    const userTimezone = getUserTimezone(user.settings);
    const date = loggedDate || getTodayDateString(userTimezone);

    // Insert food log
    const [newLog] = await db
      .insert(foodLogs)
      .values({
        userId: user.id,
        foodId: foodId || null,
        foodName,
        brand: brand || null,
        servingQuantity: servingQuantity || 1,
        servingUnit: servingUnit || "g",
        servingSize: servingSize || 100,
        calories: calories || 0,
        proteinG: proteinG || 0,
        fatG: fatG || 0,
        carbsG: carbsG || 0,
        fiberG: fiberG || 0,
        sugarG: sugarG || 0,
        saturatedFatG: saturatedFatG || 0,
        sodiumMg: sodiumMg || 0,
        cholesterolMg: cholesterolMg || 0,
        vitaminAMcg: vitaminAMcg || 0,
        vitaminCMg: vitaminCMg || 0,
        vitaminDMcg: vitaminDMcg || 0,
        calciumMg: calciumMg || 0,
        ironMg: ironMg || 0,
        potassiumMg: potassiumMg || 0,
        mealType,
        loggedDate: date,
      })
      .returning();

    // Update recent foods if foodId provided
    if (foodId) {
      await db
        .insert(recentFoods)
        .values({
          userId: user.id,
          foodId,
          lastUsedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [recentFoods.userId, recentFoods.foodId],
          set: { lastUsedAt: new Date() },
        });
    }

    return NextResponse.json({ log: newLog }, { status: 201 });
  } catch (error) {
    console.error("Add food log error:", error);
    return NextResponse.json(
      { error: "Failed to add food log" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a food log
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const logId = searchParams.get("id");

    if (!logId) {
      return NextResponse.json(
        { error: "Log ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(foodLogs)
      .where(
        and(
          eq(foodLogs.id, logId),
          eq(foodLogs.userId, user.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete food log error:", error);
    return NextResponse.json(
      { error: "Failed to delete food log" },
      { status: 500 }
    );
  }
}
