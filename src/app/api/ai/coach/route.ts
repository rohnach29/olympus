import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * AI Coach API Route
 *
 * This route proxies requests to the Python LangGraph agent server.
 * The Python server handles tool calling (database queries, web search)
 * and returns responses from the Llama LLM.
 *
 * For local development:
 * 1. Start Ollama: ollama serve
 * 2. Start Python server: cd ai-coach && uvicorn olympus_coach.server:app --port 8100
 *
 * For Vercel (personal use with ngrok):
 * 1. Run local services as above
 * 2. Run: ngrok http 8100
 * 3. Set COACH_SERVER_URL in Vercel to your ngrok URL
 */

const COACH_SERVER_URL = process.env.COACH_SERVER_URL || "http://localhost:8100";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Call the Python LangGraph server
    const response = await fetch(`${COACH_SERVER_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Skip ngrok browser warning for API calls
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        messages: messages.map((m: ChatMessage) => ({
          role: m.role,
          content: m.content,
        })),
        user_id: user.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get response from AI coach");
    }

    const data = await response.json();

    return NextResponse.json({
      message: data.message,
      model: data.model,
      toolsUsed: data.tools_used || [],
    });
  } catch (error) {
    console.error("AI Coach error:", error);

    // Provide helpful error messages
    const errorMessage =
      error instanceof Error ? error.message : "Failed to connect to AI coach";

    if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed")) {
      return NextResponse.json(
        {
          error: "AI Coach server is not running",
          suggestion:
            "Start the server with: cd ai-coach && uvicorn olympus_coach.server:app --port 8100",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: errorMessage,
        suggestion: "Check that both Ollama and the AI Coach server are running",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Health check - verify the Python server is running
    const response = await fetch(`${COACH_SERVER_URL}/health`, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      throw new Error("AI Coach server health check failed");
    }

    const data = await response.json();

    return NextResponse.json({
      status: "healthy",
      model: data.model,
      toolsAvailable: data.tools_available,
    });
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: "AI Coach server is not running",
        suggestion:
          "Start the server with: cd ai-coach && uvicorn olympus_coach.server:app --port 8100",
      },
      { status: 503 }
    );
  }
}
