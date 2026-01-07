import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db, bloodWork, users } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import {
  calculatePhenoAge,
  extractPhenoAgeMarkers,
  generateRecommendations,
  PhenoAgeResult,
} from "@/lib/utils/longevity-scoring";

interface BloodWorkMarker {
  name: string;
  value: number;
  unit: string;
}

// GET - Get longevity/biological age data
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Calculate chronological age
    let chronologicalAge: number | null = null;
    if (user.dateOfBirth) {
      const birthDate = new Date(user.dateOfBirth);
      const today = new Date();
      chronologicalAge = Math.floor(
        (today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
    }

    // Get latest blood work
    const latestBloodWork = await db
      .select()
      .from(bloodWork)
      .where(eq(bloodWork.userId, user.id))
      .orderBy(desc(bloodWork.testDate))
      .limit(1);

    let phenoAgeResult: PhenoAgeResult | null = null;

    if (latestBloodWork.length > 0 && chronologicalAge) {
      const markers = (latestBloodWork[0].markers as BloodWorkMarker[]) || [];
      const phenoAgeInput = extractPhenoAgeMarkers(markers, chronologicalAge);
      phenoAgeResult = calculatePhenoAge(phenoAgeInput);
    }

    // Generate recommendations
    const recommendations = phenoAgeResult
      ? generateRecommendations(phenoAgeResult)
      : [];

    // Get blood work history for tracking biological age over time
    const bloodWorkHistory = await db
      .select({
        id: bloodWork.id,
        testDate: bloodWork.testDate,
        markers: bloodWork.markers,
      })
      .from(bloodWork)
      .where(eq(bloodWork.userId, user.id))
      .orderBy(desc(bloodWork.testDate))
      .limit(10);

    // Calculate biological age for each historical blood work
    const biologicalAgeHistory = chronologicalAge
      ? bloodWorkHistory.map((bw) => {
          const markers = (bw.markers as BloodWorkMarker[]) || [];
          // Calculate age at that test date
          const testDate = new Date(bw.testDate);
          const birthDate = new Date(user.dateOfBirth!);
          const ageAtTest = Math.floor(
            (testDate.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
          );
          const input = extractPhenoAgeMarkers(markers, ageAtTest);
          const result = calculatePhenoAge(input);
          return {
            testDate: bw.testDate,
            chronologicalAge: ageAtTest,
            biologicalAge: result.biologicalAge,
            canCalculate: result.canCalculate,
          };
        })
      : [];

    return NextResponse.json({
      chronologicalAge,
      phenoAge: phenoAgeResult,
      recommendations,
      history: biologicalAgeHistory,
      hasBloodWork: latestBloodWork.length > 0,
      lastTestDate: latestBloodWork[0]?.testDate || null,
    });
  } catch (error) {
    console.error("Get longevity data error:", error);
    return NextResponse.json(
      { error: "Failed to get longevity data" },
      { status: 500 }
    );
  }
}
