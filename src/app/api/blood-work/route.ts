import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, bloodWork } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import {
  processMarkers,
  calculateSummary,
  groupMarkersByCategory,
  BloodWorkMarker,
  BIOMARKER_CATEGORIES,
} from "@/lib/utils/blood-work";

// GET - Get blood work results
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    const id = searchParams.get("id");

    // If specific ID requested, return that result
    if (id) {
      const results = await db
        .select()
        .from(bloodWork)
        .where(and(eq(bloodWork.id, id), eq(bloodWork.userId, user.id)))
        .limit(1);

      if (results.length === 0) {
        return NextResponse.json({ error: "Blood work result not found" }, { status: 404 });
      }

      const result = results[0];
      const markers = (result.markers as BloodWorkMarker[]) || [];
      const processedMarkers = processMarkers(markers);
      const summary = calculateSummary(processedMarkers);
      const groupedMarkers = groupMarkersByCategory(processedMarkers);

      return NextResponse.json({
        result: {
          ...result,
          markers: processedMarkers,
        },
        summary,
        groupedMarkers,
        categories: BIOMARKER_CATEGORIES,
      });
    }

    // Get all results
    const results = await db
      .select()
      .from(bloodWork)
      .where(eq(bloodWork.userId, user.id))
      .orderBy(desc(bloodWork.testDate))
      .limit(limit);

    // Process the most recent result for summary
    const latestResult = results[0] || null;
    let latestSummary = null;
    let latestGrouped = null;

    if (latestResult) {
      const markers = (latestResult.markers as BloodWorkMarker[]) || [];
      const processedMarkers = processMarkers(markers);
      latestSummary = calculateSummary(processedMarkers);
      latestGrouped = groupMarkersByCategory(processedMarkers);
    }

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        testDate: r.testDate,
        labName: r.labName,
        markerCount: ((r.markers as BloodWorkMarker[]) || []).length,
        createdAt: r.createdAt,
      })),
      latest: latestResult
        ? {
            ...latestResult,
            markers: processMarkers((latestResult.markers as BloodWorkMarker[]) || []),
          }
        : null,
      summary: latestSummary,
      groupedMarkers: latestGrouped,
      categories: BIOMARKER_CATEGORIES,
    });
  } catch (error) {
    console.error("Get blood work error:", error);
    return NextResponse.json(
      { error: "Failed to get blood work results" },
      { status: 500 }
    );
  }
}

// POST - Create a new blood work result
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { testDate, labName, markers, reportUrl } = body;

    // Validate required fields
    if (!testDate) {
      return NextResponse.json(
        { error: "Test date is required" },
        { status: 400 }
      );
    }

    if (!markers || !Array.isArray(markers) || markers.length === 0) {
      return NextResponse.json(
        { error: "At least one marker is required" },
        { status: 400 }
      );
    }

    // Validate marker structure
    for (const marker of markers) {
      if (!marker.name || marker.value === undefined || !marker.unit) {
        return NextResponse.json(
          { error: "Each marker must have name, value, and unit" },
          { status: 400 }
        );
      }
    }

    // Insert the blood work result
    const [result] = await db
      .insert(bloodWork)
      .values({
        userId: user.id,
        testDate,
        labName: labName || null,
        markers,
        reportUrl: reportUrl || null,
      })
      .returning();

    // Process markers and calculate summary
    const processedMarkers = processMarkers(markers as BloodWorkMarker[]);
    const summary = calculateSummary(processedMarkers);
    const groupedMarkers = groupMarkersByCategory(processedMarkers);

    return NextResponse.json(
      {
        result: {
          ...result,
          markers: processedMarkers,
        },
        summary,
        groupedMarkers,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create blood work error:", error);
    return NextResponse.json(
      { error: "Failed to create blood work result" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a blood work result
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Blood work result ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(bloodWork)
      .where(and(eq(bloodWork.id, id), eq(bloodWork.userId, user.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete blood work error:", error);
    return NextResponse.json(
      { error: "Failed to delete blood work result" },
      { status: 500 }
    );
  }
}
