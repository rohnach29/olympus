"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Heart,
  Brain,
  Activity,
  TrendingUp,
  Zap,
  AlertCircle,
  Info,
  Loader2,
  FlaskConical,
  X,
  Flame,
  Droplets,
} from "lucide-react";
import Link from "next/link";

interface LongevityPillar {
  name: string;
  score: number;
  status: "optimal" | "good" | "fair" | "poor";
  factors: string[];
  description: string;
}

interface PhenoAgeResult {
  biologicalAge: number | null;
  ageDifference: number | null;
  percentile: number | null;
  availableMarkers: number;
  requiredMarkers: number;
  missingMarkers: string[];
  canCalculate: boolean;
  pillars: LongevityPillar[];
}

interface Recommendation {
  category: string;
  recommendations: string[];
}

interface LongevityData {
  chronologicalAge: number | null;
  phenoAge: PhenoAgeResult | null;
  recommendations: Recommendation[];
  history: Array<{
    testDate: string;
    chronologicalAge: number;
    biologicalAge: number | null;
    canCalculate: boolean;
  }>;
  hasBloodWork: boolean;
  lastTestDate: string | null;
}

function getPillarIcon(name: string) {
  switch (name) {
    case "Metabolic Health":
      return <Zap className="h-5 w-5 text-yellow-500" />;
    case "Inflammation":
      return <Flame className="h-5 w-5 text-red-500" />;
    case "Liver Function":
      return <Droplets className="h-5 w-5 text-green-500" />;
    case "Blood Health":
      return <Heart className="h-5 w-5 text-pink-500" />;
    default:
      return <Activity className="h-5 w-5 text-blue-500" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "optimal":
      return "text-green-600";
    case "good":
      return "text-blue-600";
    case "fair":
      return "text-yellow-600";
    case "poor":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

function getStatusBgColor(status: string) {
  switch (status) {
    case "optimal":
      return "bg-green-50 dark:bg-green-950/30";
    case "good":
      return "bg-blue-50 dark:bg-blue-950/30";
    case "fair":
      return "bg-yellow-50 dark:bg-yellow-950/30";
    case "poor":
      return "bg-red-50 dark:bg-red-950/30";
    default:
      return "bg-muted/50";
  }
}

export default function LongevityPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LongevityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    fetchLongevityData();
  }, []);

  async function fetchLongevityData() {
    try {
      setLoading(true);
      const response = await fetch("/api/longevity");
      if (!response.ok) {
        throw new Error("Failed to fetch longevity data");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching longevity data:", err);
      setError("Failed to load longevity data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
        {error}
      </div>
    );
  }

  const hasChronologicalAge = data?.chronologicalAge !== null;
  const hasPhenoAge = data?.phenoAge?.canCalculate;
  const phenoAge = data?.phenoAge;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Longevity</h1>
          <p className="text-muted-foreground">Your biological age and longevity indicators</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowInfoModal(true)}>
          <Info className="h-4 w-4 mr-2" />
          How It Works
        </Button>
      </div>

      {/* No Date of Birth Warning */}
      {!hasChronologicalAge && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                  Date of Birth Required
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  To calculate your biological age, we need your date of birth.
                </p>
                <Link href="/settings">
                  <Button variant="outline" size="sm" className="mt-3">
                    Update Profile
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Blood Work Warning */}
      {hasChronologicalAge && !data?.hasBloodWork && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <FlaskConical className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-800 dark:text-blue-200">
                  Blood Work Needed
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Upload your blood work results to calculate your biological age using the PhenoAge algorithm.
                </p>
                <Link href="/blood-work">
                  <Button variant="outline" size="sm" className="mt-3">
                    Upload Blood Work
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Biological Age Card */}
      {hasChronologicalAge && (
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="p-4 rounded-full bg-primary/20">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Biological Age</p>
                  <div className="flex items-baseline gap-2">
                    {hasPhenoAge ? (
                      <>
                        <span className="text-5xl font-bold">{phenoAge?.biologicalAge}</span>
                        <span className="text-xl text-muted-foreground">years</span>
                      </>
                    ) : (
                      <span className="text-2xl text-muted-foreground">
                        {data?.hasBloodWork ? "Incomplete Data" : "No Data"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-8">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Chronological Age</p>
                  <p className="text-2xl font-semibold">{data?.chronologicalAge}</p>
                </div>
                {hasPhenoAge && phenoAge && phenoAge.ageDifference !== null && (
                  <>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Difference</p>
                      <p
                        className={`text-2xl font-semibold ${
                          phenoAge.ageDifference <= 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {phenoAge.ageDifference <= 0 ? "" : "+"}
                        {phenoAge.ageDifference} years
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Percentile</p>
                      <p className="text-2xl font-semibold">Top {100 - (phenoAge.percentile || 50)}%</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Markers */}
      {phenoAge && !phenoAge.canCalculate && phenoAge.missingMarkers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Missing Markers for PhenoAge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              You have {phenoAge.availableMarkers} of {phenoAge.requiredMarkers} required markers.
              Add these to calculate your biological age:
            </p>
            <div className="flex flex-wrap gap-2">
              {phenoAge.missingMarkers.map((marker) => (
                <span
                  key={marker}
                  className="px-2 py-1 bg-amber-100 dark:bg-amber-900/50 rounded text-xs font-medium text-amber-800 dark:text-amber-200"
                >
                  {marker}
                </span>
              ))}
            </div>
            <Link href="/blood-work">
              <Button variant="outline" size="sm" className="mt-4">
                Add Missing Markers
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Longevity Pillars */}
      {phenoAge && phenoAge.pillars.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Longevity Pillars</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {phenoAge.pillars.map((pillar) => (
              <Card key={pillar.name} className={getStatusBgColor(pillar.status)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {getPillarIcon(pillar.name)}
                    {pillar.name}
                  </CardTitle>
                  <CardDescription className="text-xs">{pillar.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-3xl font-bold ${getStatusColor(pillar.status)}`}>
                        {pillar.score}
                      </span>
                      <span className="text-sm text-muted-foreground">/100</span>
                    </div>
                    <Progress value={pillar.score} className="h-2" />
                    <div className="space-y-1">
                      {pillar.factors.slice(0, 3).map((factor, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          • {factor}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Personalized Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.recommendations.map((rec, idx) => (
                <div key={idx} className="p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-medium mb-2">{rec.category}</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {rec.recommendations.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Biological Age History */}
      {data?.history && data.history.filter((h) => h.canCalculate).length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Biological Age Over Time
            </CardTitle>
            <CardDescription>Track how your biological age changes with each blood test</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.history
                .filter((h) => h.canCalculate)
                .map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(entry.testDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Chronological: {entry.chronologicalAge} years
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{entry.biologicalAge}</p>
                      <p
                        className={`text-sm ${
                          (entry.biologicalAge || 0) <= entry.chronologicalAge
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {(entry.biologicalAge || 0) <= entry.chronologicalAge ? "Younger" : "Older"}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center">
        Biological age is estimated using the PhenoAge algorithm (Levine et al. 2018).
        This is for informational purposes only. Consult healthcare providers for medical advice.
      </p>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">How PhenoAge Works</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowInfoModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <h3 className="font-medium mb-2">What is PhenoAge?</h3>
                <p className="text-muted-foreground">
                  PhenoAge is a validated biological age calculator developed by Morgan Levine
                  and published in PNAS (2018). It uses 9 blood biomarkers to estimate your
                  biological age - a better predictor of healthspan and lifespan than
                  chronological age alone.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Required Biomarkers (9 total)</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Albumin (g/dL)</li>
                  <li>• Creatinine (mg/dL)</li>
                  <li>• Fasting Glucose (mg/dL)</li>
                  <li>• C-Reactive Protein / hs-CRP (mg/L)</li>
                  <li>• Lymphocyte % </li>
                  <li>• Mean Corpuscular Volume / MCV (fL)</li>
                  <li>• Red Cell Distribution Width / RDW (%)</li>
                  <li>• Alkaline Phosphatase (U/L)</li>
                  <li>• White Blood Cell Count (K/uL)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium mb-2">How to Improve Your Biological Age</h3>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Maintain healthy blood glucose through diet and exercise</li>
                  <li>• Reduce inflammation (lower CRP)</li>
                  <li>• Support liver function (healthy albumin)</li>
                  <li>• Get regular sleep and manage stress</li>
                  <li>• Regular zone 2 cardio and strength training</li>
                </ul>
              </div>

              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  Reference: Levine, M.E., et al. (2018). &quot;An epigenetic biomarker of aging
                  for lifespan and healthspan.&quot; Aging (Albany NY), 10(4), 573-591.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
