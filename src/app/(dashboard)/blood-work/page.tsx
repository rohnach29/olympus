"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FlaskConical,
  Upload,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  Loader2,
  Trash2,
  Calendar,
  FileText,
  Keyboard,
} from "lucide-react";

interface Marker {
  name: string;
  value: number;
  unit: string;
  category: string;
  status?: string;
  statusMessage?: string;
  referenceMin?: number;
  referenceMax?: number;
  optimalMin?: number;
  optimalMax?: number;
}

interface Summary {
  optimal: number;
  normal: number;
  warning: number;
  critical: number;
  total: number;
  overallScore: number;
}

interface BloodWorkResult {
  id: string;
  testDate: string;
  labName: string | null;
  markers: Marker[];
  markerCount?: number;
  createdAt: string;
}

interface Categories {
  [key: string]: string;
}

// Common biomarkers for quick add
const COMMON_MARKERS = [
  { name: "Fasting Glucose", unit: "mg/dL", category: "metabolic" },
  { name: "HbA1c", unit: "%", category: "metabolic" },
  { name: "Total Cholesterol", unit: "mg/dL", category: "lipid" },
  { name: "LDL-C", unit: "mg/dL", category: "lipid" },
  { name: "HDL-C", unit: "mg/dL", category: "lipid" },
  { name: "Triglycerides", unit: "mg/dL", category: "lipid" },
  { name: "hs-CRP", unit: "mg/L", category: "inflammation" },
  { name: "TSH", unit: "mIU/L", category: "hormones" },
  { name: "Vitamin D (25-OH)", unit: "ng/mL", category: "vitamins" },
  { name: "Vitamin B12", unit: "pg/mL", category: "vitamins" },
  { name: "Hemoglobin", unit: "g/dL", category: "blood" },
  { name: "Ferritin", unit: "ng/mL", category: "inflammation" },
];

function getStatusColor(status?: string) {
  switch (status) {
    case "optimal":
      return "text-green-600";
    case "normal":
      return "text-blue-600";
    case "warning":
      return "text-yellow-600";
    case "critical":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

function getStatusBgColor(status?: string) {
  switch (status) {
    case "optimal":
      return "bg-green-50 dark:bg-green-950/30";
    case "normal":
      return "bg-blue-50 dark:bg-blue-950/30";
    case "warning":
      return "bg-yellow-50 dark:bg-yellow-950/30";
    case "critical":
      return "bg-red-50 dark:bg-red-950/30";
    default:
      return "bg-muted/50";
  }
}

function getStatusIcon(status?: string) {
  switch (status) {
    case "optimal":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "normal":
      return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    case "critical":
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return null;
  }
}

function formatRange(marker: Marker): string {
  const { referenceMin, referenceMax } = marker;
  if (referenceMin !== undefined && referenceMax !== undefined) {
    return `${referenceMin} - ${referenceMax}`;
  }
  if (referenceMin !== undefined) {
    return `> ${referenceMin}`;
  }
  if (referenceMax !== undefined) {
    return `< ${referenceMax}`;
  }
  return "N/A";
}

export default function BloodWorkPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<"manual" | "pdf">("manual");

  const [results, setResults] = useState<BloodWorkResult[]>([]);
  const [latest, setLatest] = useState<BloodWorkResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groupedMarkers, setGroupedMarkers] = useState<Record<string, Marker[]> | null>(null);
  const [categories, setCategories] = useState<Categories>({});

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formLabName, setFormLabName] = useState("");
  const [formMarkers, setFormMarkers] = useState<Array<{ name: string; value: string; unit: string; category: string }>>([
    { name: "", value: "", unit: "", category: "" },
  ]);

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [extractedMarkers, setExtractedMarkers] = useState<Array<{ name: string; value: string; unit: string; referenceRange?: string }> | null>(null);
  const [extractedLabName, setExtractedLabName] = useState<string | null>(null);

  // Fetch blood work data
  useEffect(() => {
    fetchBloodWork();
  }, []);

  async function fetchBloodWork() {
    try {
      setLoading(true);
      const response = await fetch("/api/blood-work");
      if (!response.ok) {
        throw new Error("Failed to fetch blood work data");
      }
      const data = await response.json();

      setResults(data.results || []);
      setLatest(data.latest || null);
      setSummary(data.summary || null);
      setGroupedMarkers(data.groupedMarkers || null);
      setCategories(data.categories || {});
    } catch (err) {
      console.error("Error fetching blood work:", err);
      setError("Failed to load blood work data");
    } finally {
      setLoading(false);
    }
  }

  // Add marker row
  function addMarkerRow() {
    setFormMarkers([...formMarkers, { name: "", value: "", unit: "", category: "" }]);
  }

  // Remove marker row
  function removeMarkerRow(index: number) {
    setFormMarkers(formMarkers.filter((_, i) => i !== index));
  }

  // Update marker field
  function updateMarker(index: number, field: string, value: string) {
    const updated = [...formMarkers];
    updated[index] = { ...updated[index], [field]: value };
    setFormMarkers(updated);
  }

  // Quick add common marker
  function quickAddMarker(marker: typeof COMMON_MARKERS[0]) {
    const exists = formMarkers.some((m) => m.name === marker.name);
    if (exists) return;

    // Replace empty row or add new one
    const emptyIndex = formMarkers.findIndex((m) => !m.name && !m.value);
    if (emptyIndex >= 0) {
      const updated = [...formMarkers];
      updated[emptyIndex] = { ...marker, value: "" };
      setFormMarkers(updated);
    } else {
      setFormMarkers([...formMarkers, { ...marker, value: "" }]);
    }
  }

  // Submit blood work
  async function handleSubmit() {
    // Validate
    const validMarkers = formMarkers.filter((m) => m.name && m.value && m.unit);
    if (validMarkers.length === 0) {
      setError("Please add at least one marker with a value");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/blood-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testDate: formDate,
          labName: formLabName || null,
          markers: validMarkers.map((m) => ({
            name: m.name,
            value: parseFloat(m.value),
            unit: m.unit,
            category: m.category || "other",
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save blood work");
      }

      // Reset form and close modal
      setShowModal(false);
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormLabName("");
      setFormMarkers([{ name: "", value: "", unit: "", category: "" }]);

      // Refresh data
      await fetchBloodWork();
    } catch (err) {
      console.error("Error saving blood work:", err);
      setError(err instanceof Error ? err.message : "Failed to save blood work");
    } finally {
      setSaving(false);
    }
  }

  // Delete blood work result
  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this blood work result?")) return;

    try {
      const response = await fetch(`/api/blood-work?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete blood work");
      }

      await fetchBloodWork();
    } catch (err) {
      console.error("Error deleting blood work:", err);
      setError("Failed to delete blood work result");
    }
  }

  // Handle PDF file selection
  function handlePdfSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setPdfError("Please select a PDF file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setPdfError("File must be less than 10MB");
        return;
      }
      setPdfFile(file);
      setPdfError(null);
      setExtractedMarkers(null);
    }
  }

  // Upload and process PDF
  async function handlePdfUpload() {
    if (!pdfFile) return;

    setPdfUploading(true);
    setPdfError(null);

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("testDate", formDate);

      const response = await fetch("/api/blood-work/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process PDF");
      }

      // Success - show extracted markers for review
      setExtractedMarkers(
        data.result.markers.map((m: Marker) => ({
          name: m.name,
          value: String(m.value),
          unit: m.unit,
          referenceRange: m.referenceMin && m.referenceMax ? `${m.referenceMin}-${m.referenceMax}` : undefined,
        }))
      );
      setExtractedLabName(data.labName || null);

      // Close modal and refresh - data already saved
      setShowModal(false);
      resetModalState();
      await fetchBloodWork();
    } catch (err) {
      console.error("PDF upload error:", err);
      setPdfError(err instanceof Error ? err.message : "Failed to process PDF");
    } finally {
      setPdfUploading(false);
    }
  }

  // Reset modal state
  function resetModalState() {
    setUploadMode("manual");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormLabName("");
    setFormMarkers([{ name: "", value: "", unit: "", category: "" }]);
    setPdfFile(null);
    setPdfError(null);
    setExtractedMarkers(null);
    setExtractedLabName(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasData = latest && latest.markers && latest.markers.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blood Work</h1>
          <p className="text-muted-foreground">Track and analyze your biomarkers over time</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Results
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* No Data State */}
      {!hasData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Blood Work Results Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Upload your blood work results to track biomarkers and get insights.
            </p>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Result
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      {hasData && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Latest Results Summary
            </CardTitle>
            <CardDescription>
              Test Date: {new Date(latest.testDate).toLocaleDateString()}
              {latest.labName && ` | Lab: ${latest.labName}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{summary.optimal}</div>
                <div className="text-sm text-muted-foreground">Optimal</div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{summary.normal}</div>
                <div className="text-sm text-muted-foreground">Normal</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600">{summary.warning}</div>
                <div className="text-sm text-muted-foreground">Attention</div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{summary.critical}</div>
                <div className="text-sm text-muted-foreground">Critical</div>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <div className="text-3xl font-bold text-primary">{summary.overallScore}%</div>
                <div className="text-sm text-muted-foreground">Score</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Biomarker Categories */}
      {hasData && groupedMarkers && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(groupedMarkers).map(([categoryKey, markers]) => (
            <Card key={categoryKey}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {categories[categoryKey] || categoryKey}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {markers.map((marker, idx) => (
                    <div
                      key={`${marker.name}-${idx}`}
                      className={`flex items-center justify-between p-3 rounded-lg ${getStatusBgColor(marker.status)}`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(marker.status)}
                        <div>
                          <div className="font-medium">{marker.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Range: {formatRange(marker)}
                          </div>
                          {marker.statusMessage && (
                            <div className="text-xs text-muted-foreground">
                              {marker.statusMessage}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${getStatusColor(marker.status)}`}>
                          {marker.value} {marker.unit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Previous Results */}
      {results.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Previous Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.slice(1).map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {new Date(result.testDate).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.markerCount} markers
                      {result.labName && ` | ${result.labName}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(result.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trends Placeholder */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Biomarker Trends
            </CardTitle>
            <CardDescription>Track how your markers change over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <p>Trend charts will appear once you have multiple test results</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Add Blood Work Results</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowModal(false); resetModalState(); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Mode Toggle */}
            <div className="flex border-b">
              <button
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 ${
                  uploadMode === "pdf"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setUploadMode("pdf")}
              >
                <FileText className="h-4 w-4" />
                Upload PDF
              </button>
              <button
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 ${
                  uploadMode === "manual"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setUploadMode("manual")}
              >
                <Keyboard className="h-4 w-4" />
                Manual Entry
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Test Date (common to both modes) */}
              <div className="space-y-2">
                <Label htmlFor="testDate">Test Date</Label>
                <Input
                  id="testDate"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              {/* PDF Upload Mode */}
              {uploadMode === "pdf" && (
                <>
                  <div className="space-y-2">
                    <Label>Upload Lab Report PDF</Label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfSelect}
                        className="hidden"
                        id="pdf-upload"
                      />
                      <label htmlFor="pdf-upload" className="cursor-pointer">
                        {pdfFile ? (
                          <div className="space-y-2">
                            <FileText className="h-10 w-10 mx-auto text-primary" />
                            <p className="font-medium">{pdfFile.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                            <p className="font-medium">Click to select PDF</p>
                            <p className="text-sm text-muted-foreground">
                              or drag and drop your lab report
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                    {pdfError && (
                      <p className="text-sm text-destructive">{pdfError}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll use AI to extract biomarkers from your PDF. Works best with text-based PDFs (not scanned images).
                    </p>
                  </div>
                </>
              )}

              {/* Manual Entry Mode */}
              {uploadMode === "manual" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="labName">Lab Name (optional)</Label>
                    <Input
                      id="labName"
                      placeholder="e.g., Quest Diagnostics"
                      value={formLabName}
                      onChange={(e) => setFormLabName(e.target.value)}
                    />
                  </div>

                  {/* Quick Add */}
                  <div>
                    <Label className="text-sm text-muted-foreground">Quick Add Common Markers:</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {COMMON_MARKERS.map((marker) => (
                        <Button
                          key={marker.name}
                          variant="outline"
                          size="sm"
                          onClick={() => quickAddMarker(marker)}
                          className="text-xs"
                        >
                          {marker.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Markers */}
                  <div className="space-y-3">
                    <Label>Markers</Label>
                    {formMarkers.map((marker, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            placeholder="e.g., Fasting Glucose"
                            value={marker.name}
                            onChange={(e) => updateMarker(index, "name", e.target.value)}
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Value</Label>
                          <Input
                            type="number"
                            step="any"
                            placeholder="92"
                            value={marker.value}
                            onChange={(e) => updateMarker(index, "value", e.target.value)}
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Input
                            placeholder="mg/dL"
                            value={marker.unit}
                            onChange={(e) => updateMarker(index, "unit", e.target.value)}
                          />
                        </div>
                        {formMarkers.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMarkerRow(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addMarkerRow}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Marker
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => { setShowModal(false); resetModalState(); }}>
                Cancel
              </Button>
              {uploadMode === "pdf" ? (
                <Button onClick={handlePdfUpload} disabled={!pdfFile || pdfUploading}>
                  {pdfUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload & Extract
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Results"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
