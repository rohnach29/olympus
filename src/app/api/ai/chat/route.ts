import { NextRequest, NextResponse } from "next/server";
import { generateResponse } from "@/lib/llm/client";
import { getCurrentUser } from "@/lib/auth/session";
import { db, healthMetrics, dailyScores, nutritionLogs, chatMessages } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, includeContext = true } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Optionally fetch user's health context
    let healthContext = "";
    if (includeContext) {
      try {
        // Get recent health metrics
        const metrics = await db
          .select({
            metricType: healthMetrics.metricType,
            value: healthMetrics.value,
            unit: healthMetrics.unit,
            recordedAt: healthMetrics.recordedAt,
          })
          .from(healthMetrics)
          .where(eq(healthMetrics.userId, user.id))
          .orderBy(desc(healthMetrics.recordedAt))
          .limit(50);

        // Get recent daily scores
        const scores = await db
          .select()
          .from(dailyScores)
          .where(eq(dailyScores.userId, user.id))
          .orderBy(desc(dailyScores.date))
          .limit(7);

        // Get recent nutrition
        const nutrition = await db
          .select()
          .from(nutritionLogs)
          .where(eq(nutritionLogs.userId, user.id))
          .orderBy(desc(nutritionLogs.loggedAt))
          .limit(20);

        if (metrics.length || scores.length || nutrition.length) {
          healthContext = `
USER'S RECENT HEALTH DATA:

${scores.length ? `Daily Scores (last 7 days):
${scores.map((s) => `- ${s.date}: Readiness ${s.readinessScore}, Sleep ${s.sleepScore}, Recovery ${s.recoveryScore}`).join("\n")}` : ""}

${metrics.length ? `Recent Metrics:
${summarizeMetrics(metrics)}` : ""}

${nutrition.length ? `Recent Nutrition (avg):
${summarizeNutrition(nutrition)}` : ""}
`;
        }
      } catch (error) {
        // Context fetching is optional, continue without it
        console.log("Could not fetch health context:", error);
      }
    }

    // Add context to the conversation if available
    const enhancedMessages = healthContext
      ? [
          ...messages.slice(0, -1),
          {
            role: "user" as const,
            content: `${healthContext}\n\n${messages[messages.length - 1].content}`,
          },
        ]
      : messages;

    // Generate response
    const response = await generateResponse(enhancedMessages);

    // Save messages to database (optional)
    try {
      await db.insert(chatMessages).values([
        {
          userId: user.id,
          role: "user",
          content: messages[messages.length - 1].content,
        },
        {
          userId: user.id,
          role: "assistant",
          content: response.content,
        },
      ]);
    } catch {
      // Chat history saving is optional
    }

    return NextResponse.json({
      message: response.content,
      model: response.model,
    });
  } catch (error) {
    console.error("AI Chat error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate response",
        suggestion: "Make sure Ollama is running with: ollama serve",
      },
      { status: 500 }
    );
  }
}

// Helper to summarize metrics
function summarizeMetrics(metrics: any[]): string {
  const grouped: Record<string, number[]> = {};

  metrics.forEach((m) => {
    if (!grouped[m.metricType]) {
      grouped[m.metricType] = [];
    }
    grouped[m.metricType].push(Number(m.value));
  });

  return Object.entries(grouped)
    .map(([type, values]) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return `- ${type}: avg ${avg.toFixed(1)}`;
    })
    .join("\n");
}

// Helper to summarize nutrition
function summarizeNutrition(nutrition: any[]): string {
  const totals = nutrition.reduce(
    (acc, n) => ({
      calories: acc.calories + (Number(n.calories) || 0),
      protein: acc.protein + (Number(n.proteinG) || 0),
      carbs: acc.carbs + (Number(n.carbsG) || 0),
      fat: acc.fat + (Number(n.fatG) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const days = Math.max(
    1,
    new Set(nutrition.map((n) => n.loggedAt?.toISOString?.().split("T")[0])).size
  );

  return `- Avg daily: ${Math.round(totals.calories / days)} kcal, ${Math.round(totals.protein / days)}g protein, ${Math.round(totals.carbs / days)}g carbs, ${Math.round(totals.fat / days)}g fat`;
}
