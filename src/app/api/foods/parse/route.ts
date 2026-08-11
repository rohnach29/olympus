import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { parseFoodText, FoodParseError } from "@/lib/nutrition/parse-food";

const requestSchema = z.object({
  text: z.string().min(1, "Describe what you ate.").max(500),
});

// POST - Turn a free-text meal description into structured, loggable food items.
// This is an estimate only; nothing is written to the database here.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsedBody = requestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const items = await parseFoodText(parsedBody.data.text);
    return NextResponse.json({ data: { items } });
  } catch (error) {
    if (error instanceof FoodParseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Food parse error:", error);
    return NextResponse.json({ error: "Failed to parse food" }, { status: 500 });
  }
}
