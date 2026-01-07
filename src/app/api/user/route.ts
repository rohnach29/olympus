import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

// GET - Get current user profile
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Failed to get user profile" },
      { status: 500 }
    );
  }
}

// PATCH - Update user profile
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      fullName,
      dateOfBirth,
      gender,
      heightCm,
      weightKg,
      settings,
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (fullName !== undefined) {
      updateData.fullName = fullName;
    }

    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth = dateOfBirth;
    }

    if (gender !== undefined) {
      updateData.gender = gender;
    }

    if (heightCm !== undefined) {
      updateData.heightCm = heightCm ? String(heightCm) : null;
    }

    if (weightKg !== undefined) {
      updateData.weightKg = weightKg ? String(weightKg) : null;
    }

    // Merge settings if provided (don't replace, merge)
    if (settings !== undefined) {
      const currentSettings = (user.settings as Record<string, unknown>) || {};
      updateData.settings = {
        ...currentSettings,
        ...settings,
      };
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        dateOfBirth: users.dateOfBirth,
        gender: users.gender,
        heightCm: users.heightCm,
        weightKg: users.weightKg,
        goals: users.goals,
        settings: users.settings,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 }
    );
  }
}
