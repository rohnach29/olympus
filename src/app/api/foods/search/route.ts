import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, foods } from "@/lib/db";
import { ilike, or, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    if (!query || query.length < 2) {
      return NextResponse.json({ foods: [] });
    }

    // Search foods with smart ranking
    // Priority: exact match > starts with word > contains word > contains substring
    const searchResults = await db
      .select({
        id: foods.id,
        name: foods.name,
        brand: foods.brand,
        category: foods.category,
        servingSize: foods.servingSize,
        servingUnit: foods.servingUnit,
        servingSizeDescription: foods.servingSizeDescription,
        calories: foods.calories,
        proteinG: foods.proteinG,
        carbsG: foods.carbsG,
        fatG: foods.fatG,
        fiberG: foods.fiberG,
        source: foods.source,
      })
      .from(foods)
      .where(
        or(
          ilike(foods.name, `%${query}%`),
          ilike(foods.brand, `%${query}%`)
        )
      )
      .orderBy(
        // Ranking priority:
        // 0: Exact match (e.g., "Apple" or "Apples")
        // 1: Starts with query as a word (e.g., "Apples, raw" for "apple")
        // 2: Contains query as a word boundary (e.g., "Red apple" but not "Applebee's")
        // 3: Everything else (substring matches like "Applebee's")
        sql`CASE
            WHEN lower(${foods.name}) = lower(${query}) THEN 0
            WHEN lower(${foods.name}) ~ ('^' || lower(${query}) || '(s|es)?([^a-z]|$)') THEN 1
            WHEN lower(${foods.name}) ~ ('(^|[^a-z])' || lower(${query}) || '(s|es)?([^a-z]|$)') THEN 2
            ELSE 3 END`,
        // Prefer shorter names (simpler foods)
        sql`length(${foods.name})`,
        // Prefer foods with calorie data
        sql`CASE WHEN ${foods.calories}::numeric > 0 THEN 0 ELSE 1 END`,
        foods.name
      )
      .limit(limit);

    return NextResponse.json({ foods: searchResults });
  } catch (error) {
    console.error("Food search error:", error);
    return NextResponse.json(
      { error: "Failed to search foods" },
      { status: 500 }
    );
  }
}
