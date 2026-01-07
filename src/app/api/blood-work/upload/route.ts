import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, bloodWork } from "@/lib/db";
import { parseBloodWorkPDF, checkLLMAvailability } from "@/lib/utils/blood-work-pdf-parser";
import { processMarkers, calculateSummary, groupMarkersByCategory, BloodWorkMarker, BIOMARKERS } from "@/lib/utils/blood-work";

// POST - Upload and parse blood work PDF
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const testDateParam = formData.get("testDate") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the PDF
    const parseResult = await parseBloodWorkPDF(buffer);

    if (!parseResult.success || parseResult.markers.length === 0) {
      return NextResponse.json(
        {
          error: parseResult.error || "No biomarkers found in PDF",
          rawText: parseResult.rawText?.substring(0, 500), // Return snippet for debugging
        },
        { status: 422 }
      );
    }

    // Determine test date
    const testDate = testDateParam || parseResult.testDate || new Date().toISOString().split("T")[0];

    // Convert extracted markers to BloodWorkMarker format
    // Look up category from BIOMARKERS, or default to "other"
    const markers: BloodWorkMarker[] = parseResult.markers.map((m) => {
      // Try to find matching biomarker definition
      const normalizedName = m.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const matchingKey = Object.keys(BIOMARKERS).find((key) => {
        const biomarkerName = BIOMARKERS[key].name.toLowerCase().replace(/[^a-z0-9]/g, "");
        return biomarkerName === normalizedName || key.toLowerCase() === normalizedName;
      });
      const biomarker = matchingKey ? BIOMARKERS[matchingKey] : null;

      return {
        name: m.name,
        value: m.value,
        unit: m.unit,
        category: biomarker?.category || "other",
      };
    });

    // Save to database
    const [result] = await db
      .insert(bloodWork)
      .values({
        userId: user.id,
        testDate,
        labName: parseResult.labName || null,
        markers,
        reportUrl: null, // Could save to storage later
      })
      .returning();

    // Process markers and calculate summary
    const processedMarkers = processMarkers(markers);
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
        extractedCount: parseResult.markers.length,
        labName: parseResult.labName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Blood work PDF upload error:", error);
    return NextResponse.json(
      { error: "Failed to process blood work PDF" },
      { status: 500 }
    );
  }
}

// GET - Check if LLM is available for parsing
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const llmStatus = await checkLLMAvailability();
    return NextResponse.json(llmStatus);
  } catch (error) {
    console.error("LLM availability check error:", error);
    return NextResponse.json(
      { available: false, provider: "unknown", error: "Check failed" },
      { status: 500 }
    );
  }
}
