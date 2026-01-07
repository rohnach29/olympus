import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, apiTokens } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { generateSecureToken } from "@/lib/utils/token";

// GET - List user's API tokens (without exposing the actual token values)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokens = await db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        lastUsedAt: apiTokens.lastUsedAt,
        requestCount: apiTokens.requestCount,
        isActive: apiTokens.isActive,
        createdAt: apiTokens.createdAt,
      })
      .from(apiTokens)
      .where(eq(apiTokens.userId, user.id))
      .orderBy(desc(apiTokens.createdAt));

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("Get tokens error:", error);
    return NextResponse.json(
      { error: "Failed to get tokens" },
      { status: 500 }
    );
  }
}

// POST - Create a new API token
// IMPORTANT: The token is only returned once in this response!
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Token name is required" },
        { status: 400 }
      );
    }

    // Generate a secure token
    const token = generateSecureToken();

    // Create the token record
    const [newToken] = await db
      .insert(apiTokens)
      .values({
        userId: user.id,
        token,
        name: name.trim(),
      })
      .returning({
        id: apiTokens.id,
        name: apiTokens.name,
        createdAt: apiTokens.createdAt,
      });

    // Return the token value - this is the ONLY time it will be shown
    return NextResponse.json(
      {
        id: newToken.id,
        name: newToken.name,
        token, // Only shown once!
        createdAt: newToken.createdAt,
        webhookUrl: "/api/webhooks/health-auto-export",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create token error:", error);
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 }
    );
  }
}

// DELETE - Revoke a token
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get("id");

    if (!tokenId) {
      return NextResponse.json(
        { error: "Token ID is required" },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false (preserves logs)
    const [updated] = await db
      .update(apiTokens)
      .set({ isActive: false })
      .where(
        and(
          eq(apiTokens.id, tokenId),
          eq(apiTokens.userId, user.id)
        )
      )
      .returning({ id: apiTokens.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Token not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete token error:", error);
    return NextResponse.json(
      { error: "Failed to delete token" },
      { status: 500 }
    );
  }
}
