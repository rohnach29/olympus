import { NextRequest, NextResponse } from "next/server";
import { db, apiTokens } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { processHealthAutoExport } from "@/lib/webhooks/health-auto-export/processor";
import { HAEPayload } from "@/lib/webhooks/health-auto-export/types";

/**
 * POST /api/webhooks/health-auto-export
 *
 * Webhook endpoint for Health Auto Export iOS app.
 * Authenticates via Bearer token in Authorization header.
 *
 * Expected headers:
 *   Authorization: Bearer <token>
 *   Content-Type: application/json
 *
 * Payload format: HAEPayload (see types.ts)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Extract bearer token from Authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 401 }
      );
    }

    // 2. Look up the token and verify it's active
    const [tokenRecord] = await db
      .select({
        id: apiTokens.id,
        userId: apiTokens.userId,
        isActive: apiTokens.isActive,
      })
      .from(apiTokens)
      .where(eq(apiTokens.token, token))
      .limit(1);

    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    if (!tokenRecord.isActive) {
      return NextResponse.json(
        { error: "Token has been revoked" },
        { status: 401 }
      );
    }

    // 3. Parse and validate the payload
    let payload: HAEPayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    if (!payload.data) {
      return NextResponse.json(
        { error: "Missing data field in payload" },
        { status: 400 }
      );
    }

    // 4. Process the payload
    const result = await processHealthAutoExport(
      tokenRecord.userId,
      tokenRecord.id,
      payload
    );

    // 5. Return appropriate response
    if (result.status === "failed") {
      return NextResponse.json(
        {
          status: "failed",
          errors: result.errors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      status: result.status,
      processed: {
        metrics: result.metricsProcessed,
        sleepSessions: result.sleepSessionsProcessed,
        workouts: result.workoutsProcessed,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check endpoint - useful for testing connectivity
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "health-auto-export",
    version: "1.0",
  });
}
