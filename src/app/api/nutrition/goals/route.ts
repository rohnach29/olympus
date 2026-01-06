import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, nutritionGoals, users } from "@/lib/db";
import { eq } from "drizzle-orm";

// Activity level multipliers for TDEE calculation
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,      // Little or no exercise
  light: 1.375,        // Light exercise 1-3 days/week
  moderate: 1.55,      // Moderate exercise 3-5 days/week
  active: 1.725,       // Hard exercise 6-7 days/week
  very_active: 1.9,    // Very hard exercise, physical job
};

// Goal adjustments (calories)
const GOAL_ADJUSTMENTS: Record<string, number> = {
  lose_fast: -750,     // Lose ~1.5 lbs/week
  lose: -500,          // Lose ~1 lb/week
  lose_slow: -250,     // Lose ~0.5 lbs/week
  maintain: 0,         // Maintain weight
  gain_slow: 250,      // Gain ~0.5 lbs/week
  gain: 500,           // Gain ~1 lb/week
};

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor Equation
 * More accurate than Harris-Benedict for most people
 */
function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: string
): number {
  // Mifflin-St Jeor Equation
  const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * age;

  if (gender === "male") {
    return baseBMR + 5;
  } else if (gender === "female") {
    return baseBMR - 161;
  } else {
    // For non-binary/other, use average
    return baseBMR - 78;
  }
}

/**
 * Calculate Total Daily Energy Expenditure
 */
function calculateTDEE(bmr: number, activityLevel: string): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderate;
  return Math.round(bmr * multiplier);
}

/**
 * Calculate macro targets based on calories and ratios
 */
function calculateMacros(
  calories: number,
  proteinPercent: number,
  carbsPercent: number,
  fatPercent: number
): { proteinG: number; carbsG: number; fatG: number } {
  // Protein: 4 calories per gram
  // Carbs: 4 calories per gram
  // Fat: 9 calories per gram
  return {
    proteinG: Math.round((calories * (proteinPercent / 100)) / 4),
    carbsG: Math.round((calories * (carbsPercent / 100)) / 4),
    fatG: Math.round((calories * (fatPercent / 100)) / 9),
  };
}

// GET - Get user's nutrition goals
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const goals = await db
      .select()
      .from(nutritionGoals)
      .where(eq(nutritionGoals.userId, user.id))
      .limit(1);

    if (goals.length === 0) {
      // Return default goals if none set
      return NextResponse.json({
        goals: {
          calorieGoal: 2000,
          proteinG: 150,
          carbsG: 200,
          fatG: 65,
          fiberG: 30,
          proteinPercent: 30,
          carbsPercent: 40,
          fatPercent: 30,
          usePercentages: false,
          activityLevel: "moderate",
          goal: "maintain",
        },
        isDefault: true,
      });
    }

    return NextResponse.json({ goals: goals[0], isDefault: false });
  } catch (error) {
    console.error("Get nutrition goals error:", error);
    return NextResponse.json(
      { error: "Failed to get nutrition goals" },
      { status: 500 }
    );
  }
}

// POST - Calculate and set nutrition goals
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      // User stats (optional - will use from profile if not provided)
      weightKg,
      heightCm,
      age,
      gender,
      // Goals
      activityLevel = "moderate",
      goal = "maintain",
      // Manual override (if provided, skip calculation)
      manualCalories,
      // Macro settings
      proteinPercent = 30,
      carbsPercent = 40,
      fatPercent = 30,
      usePercentages = false,
      // Manual macro grams (if usePercentages is false)
      proteinG,
      carbsG,
      fatG,
      fiberG = 30,
    } = body;

    let calorieGoal: number;

    if (manualCalories) {
      // User manually set calories
      calorieGoal = manualCalories;
    } else {
      // Calculate based on stats
      const weight = weightKg || Number(user.weightKg) || 70;
      const height = heightCm || Number(user.heightCm) || 170;
      const userGender = gender || user.gender || "other";

      // Calculate age from date of birth
      let userAge = age;
      if (!userAge && user.dateOfBirth) {
        const dob = new Date(user.dateOfBirth);
        const today = new Date();
        userAge = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          userAge--;
        }
      }
      userAge = userAge || 30;

      const bmr = calculateBMR(weight, height, userAge, userGender);
      const tdee = calculateTDEE(bmr, activityLevel);
      const adjustment = GOAL_ADJUSTMENTS[goal] || 0;

      calorieGoal = Math.max(1200, tdee + adjustment); // Never go below 1200
    }

    // Calculate macros
    let finalProteinG: number;
    let finalCarbsG: number;
    let finalFatG: number;

    if (usePercentages) {
      const macros = calculateMacros(calorieGoal, proteinPercent, carbsPercent, fatPercent);
      finalProteinG = macros.proteinG;
      finalCarbsG = macros.carbsG;
      finalFatG = macros.fatG;
    } else if (proteinG && carbsG && fatG) {
      // Use manual gram values
      finalProteinG = proteinG;
      finalCarbsG = carbsG;
      finalFatG = fatG;
    } else {
      // Default to balanced macros
      const macros = calculateMacros(calorieGoal, 30, 40, 30);
      finalProteinG = macros.proteinG;
      finalCarbsG = macros.carbsG;
      finalFatG = macros.fatG;
    }

    // Upsert nutrition goals
    const [savedGoals] = await db
      .insert(nutritionGoals)
      .values({
        userId: user.id,
        calorieGoal,
        proteinG: finalProteinG,
        carbsG: finalCarbsG,
        fatG: finalFatG,
        fiberG,
        proteinPercent,
        carbsPercent,
        fatPercent,
        usePercentages,
        activityLevel,
        goal,
      })
      .onConflictDoUpdate({
        target: nutritionGoals.userId,
        set: {
          calorieGoal,
          proteinG: finalProteinG,
          carbsG: finalCarbsG,
          fatG: finalFatG,
          fiberG,
          proteinPercent,
          carbsPercent,
          fatPercent,
          usePercentages,
          activityLevel,
          goal,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({
      goals: savedGoals,
      calculation: {
        calorieGoal,
        proteinG: finalProteinG,
        carbsG: finalCarbsG,
        fatG: finalFatG,
      },
    });
  } catch (error) {
    console.error("Set nutrition goals error:", error);
    return NextResponse.json(
      { error: "Failed to set nutrition goals" },
      { status: 500 }
    );
  }
}
