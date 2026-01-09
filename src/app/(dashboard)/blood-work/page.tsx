"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  FileText,
  Keyboard,
  Pencil,
  Check,
  ChevronDown,
  ChevronUp,
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

interface BloodWorkResultSummary {
  id: string;
  testDate: string;
  labName: string | null;
  markerCount?: number;
  createdAt: string;
}

interface BloodWorkResultFull extends BloodWorkResultSummary {
  markers: Marker[];
}

interface ExpandedResultData {
  result: BloodWorkResultFull;
  summary: Summary;
  groupedMarkers: Record<string, Marker[]>;
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

  // Results list (minimal data)
  const [results, setResults] = useState<BloodWorkResultSummary[]>([]);
  const [categories, setCategories] = useState<Categories>({});

  // Expanded result state (accordion - only one at a time)
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<ExpandedResultData | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);

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

  // Inline editing state
  const [editingMarker, setEditingMarker] = useState<{
    resultId: string;
    markerIndex: number;
    originalName: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Add marker to existing result state
  const [addingMarkerToResult, setAddingMarkerToResult] = useState<string | null>(null);
  const [newMarker, setNewMarker] = useState({ name: "", value: "", unit: "", category: "" });

  // Fetch blood work list
  const fetchBloodWork = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/blood-work");
      if (!response.ok) {
        throw new Error("Failed to fetch blood work data");
      }
      const data = await response.json();

      setResults(data.results || []);
      setCategories(data.categories || {});

      // Auto-expand the most recent result if we have results
      if (data.results && data.results.length > 0 && !expandedResultId) {
        const latestId = data.results[0].id;
        // Fetch full data for the latest result
        await fetchResultDetails(latestId);
      }
    } catch (err) {
      console.error("Error fetching blood work:", err);
      setError("Failed to load blood work data");
    } finally {
      setLoading(false);
    }
  }, [expandedResultId]);

  // Fetch full details for a specific result
  async function fetchResultDetails(id: string) {
    try {
      setExpandLoading(true);
      const response = await fetch(`/api/blood-work?id=${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch result details");
      }
      const data = await response.json();

      setExpandedResultId(id);
      setExpandedData({
        result: data.result,
        summary: data.summary,
        groupedMarkers: data.groupedMarkers,
      });
    } catch (err) {
      console.error("Error fetching result details:", err);
      setError("Failed to load result details");
    } finally {
      setExpandLoading(false);
    }
  }

  // Toggle expand/collapse a result
  async function toggleExpand(id: string) {
    if (expandedResultId === id) {
      // Collapse
      setExpandedResultId(null);
      setExpandedData(null);
    } else {
      // Expand (will collapse any other)
      await fetchResultDetails(id);
    }
  }

  // Fetch on mount
  useEffect(() => {
    fetchBloodWork();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      const data = await response.json();

      // Reset form and close modal
      setShowModal(false);
      resetModalState();

      // Refresh list and expand the new result
      setExpandedResultId(null);
      setExpandedData(null);
      await fetchBloodWork();

      // Expand the newly created result
      if (data.result?.id) {
        await fetchResultDetails(data.result.id);
      }
    } catch (err) {
      console.error("Error saving blood work:", err);
      setError(err instanceof Error ? err.message : "Failed to save blood work");
    } finally {
      setSaving(false);
    }
  }

  // Delete blood work result
  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation(); // Don't toggle expand when deleting
    if (!confirm("Are you sure you want to delete this blood work result?")) return;

    try {
      const response = await fetch(`/api/blood-work?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete blood work");
      }

      // Clear expanded state if we deleted the expanded result
      if (expandedResultId === id) {
        setExpandedResultId(null);
        setExpandedData(null);
      }

      await fetchBloodWork();
    } catch (err) {
      console.error("Error deleting blood work:", err);
      setError("Failed to delete blood work result");
    }
  }

  // Start editing a marker
  function startEditMarker(resultId: string, markerIndex: number, marker: Marker) {
    setEditingMarker({ resultId, markerIndex, originalName: marker.name });
    setEditValue(String(marker.value));
  }

  // Cancel editing
  function cancelEdit() {
    setEditingMarker(null);
    setEditValue("");
  }

  // Save edited marker value
  async function handleSaveEdit() {
    if (!editingMarker || !expandedData) return;

    const newValue = parseFloat(editValue);
    if (isNaN(newValue)) {
      setError("Please enter a valid number");
      return;
    }

    setEditSaving(true);
    setError(null);

    try {
      // Get current markers and update the edited one
      const currentMarkers = (expandedData.result.markers || []).map((m, idx) => ({
        name: m.name,
        value: idx === editingMarker.markerIndex ? newValue : m.value,
        unit: m.unit,
        category: m.category,
      }));

      const response = await fetch(`/api/blood-work?id=${editingMarker.resultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markers: currentMarkers }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update marker");
      }

      cancelEdit();
      // Refresh the expanded result
      await fetchResultDetails(editingMarker.resultId);
      // Also refresh the list to update marker counts
      const listResponse = await fetch("/api/blood-work");
      if (listResponse.ok) {
        const listData = await listResponse.json();
        setResults(listData.results || []);
      }
    } catch (err) {
      console.error("Error updating marker:", err);
      setError(err instanceof Error ? err.message : "Failed to update marker");
    } finally {
      setEditSaving(false);
    }
  }

  // Add new marker to existing result
  async function handleAddMarkerToResult() {
    if (!addingMarkerToResult || !expandedData) return;

    // Validate
    if (!newMarker.name || !newMarker.value || !newMarker.unit) {
      setError("Please fill in name, value, and unit");
      return;
    }

    const value = parseFloat(newMarker.value);
    if (isNaN(value)) {
      setError("Please enter a valid number for value");
      return;
    }

    setEditSaving(true);
    setError(null);

    try {
      // Get current markers and add new one
      const currentMarkers = (expandedData.result.markers || []).map((m) => ({
        name: m.name,
        value: m.value,
        unit: m.unit,
        category: m.category,
      }));

      currentMarkers.push({
        name: newMarker.name,
        value,
        unit: newMarker.unit,
        category: newMarker.category || "other",
      });

      const response = await fetch(`/api/blood-work?id=${addingMarkerToResult}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markers: currentMarkers }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add marker");
      }

      // Reset state
      setAddingMarkerToResult(null);
      setNewMarker({ name: "", value: "", unit: "", category: "" });
      // Refresh the expanded result
      await fetchResultDetails(addingMarkerToResult);
      // Also refresh the list to update marker counts
      const listResponse = await fetch("/api/blood-work");
      if (listResponse.ok) {
        const listData = await listResponse.json();
        setResults(listData.results || []);
      }
    } catch (err) {
      console.error("Error adding marker:", err);
      setError(err instanceof Error ? err.message : "Failed to add marker");
    } finally {
      setEditSaving(false);
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

      // Close modal and refresh
      setShowModal(false);
      resetModalState();

      // Clear current expansion and refresh
      setExpandedResultId(null);
      setExpandedData(null);
      await fetchBloodWork();

      // Expand the newly created result
      if (data.result?.id) {
        await fetchResultDetails(data.result.id);
      }
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasData = results.length > 0;

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
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
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

      {/* Results List - Expandable Accordion */}
      {hasData && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Your Results
          </h2>

          {results.map((result) => {
            const isExpanded = expandedResultId === result.id;
            const isLoadingThis = expandLoading && expandedResultId === result.id;

            return (
              <Card key={result.id} className={isExpanded ? "ring-2 ring-primary/20" : ""}>
                {/* Collapsed Header - Always visible */}
                <CardHeader
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpand(result.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <CardTitle className="text-base">
                          {new Date(result.testDate).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {result.markerCount || 0} markers
                          {result.labName && ` • ${result.labName}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(result.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        {isLoadingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Expanded Content */}
                {isExpanded && expandedData && (
                  <CardContent className="border-t pt-6">
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                      <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{expandedData.summary.optimal}</div>
                        <div className="text-xs text-muted-foreground">Optimal</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{expandedData.summary.normal}</div>
                        <div className="text-xs text-muted-foreground">Normal</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{expandedData.summary.warning}</div>
                        <div className="text-xs text-muted-foreground">Attention</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{expandedData.summary.critical}</div>
                        <div className="text-xs text-muted-foreground">Critical</div>
                      </div>
                      <div className="text-center p-3 bg-primary/10 rounded-lg">
                        <div className="text-2xl font-bold text-primary">{expandedData.summary.overallScore}%</div>
                        <div className="text-xs text-muted-foreground">Score</div>
                      </div>
                    </div>

                    {/* Grouped Markers */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {Object.entries(expandedData.groupedMarkers).map(([categoryKey, markers]) => {
                        // Find actual indices in the full markers array for this category
                        const categoryMarkerIndices = expandedData.result.markers
                          .map((m, idx) => ({ marker: m, idx }))
                          .filter((item) => item.marker.category === categoryKey);

                        return (
                          <div key={categoryKey} className="border rounded-lg p-4">
                            <h4 className="font-medium mb-3">{categories[categoryKey] || categoryKey}</h4>
                            <div className="space-y-2">
                              {markers.map((marker, displayIdx) => {
                                const actualIdx = categoryMarkerIndices[displayIdx]?.idx ?? displayIdx;
                                const isEditing = editingMarker?.resultId === result.id && editingMarker?.markerIndex === actualIdx;

                                return (
                                  <div
                                    key={`${marker.name}-${actualIdx}`}
                                    className={`flex items-center justify-between p-2 rounded-lg ${getStatusBgColor(marker.status)}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {getStatusIcon(marker.status)}
                                      <div>
                                        <div className="text-sm font-medium">{marker.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          Range: {formatRange(marker)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isEditing ? (
                                        <>
                                          <Input
                                            type="number"
                                            step="any"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-20 h-7 text-sm"
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") handleSaveEdit();
                                              if (e.key === "Escape") cancelEdit();
                                            }}
                                          />
                                          <span className="text-xs text-muted-foreground">{marker.unit}</span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            onClick={handleSaveEdit}
                                            disabled={editSaving}
                                          >
                                            {editSaving ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <Check className="h-3 w-3 text-green-600" />
                                            )}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            onClick={cancelEdit}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <div className={`text-sm font-semibold ${getStatusColor(marker.status)}`}>
                                            {marker.value} {marker.unit}
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 opacity-50 hover:opacity-100"
                                            onClick={() => startEditMarker(result.id, actualIdx, marker)}
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Add Marker */}
                            {addingMarkerToResult === result.id && newMarker.category === categoryKey ? (
                              <div className="mt-3 p-2 border rounded-lg space-y-2">
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Name"
                                    value={newMarker.name}
                                    onChange={(e) => setNewMarker({ ...newMarker, name: e.target.value })}
                                    className="flex-1 h-8 text-sm"
                                  />
                                  <Input
                                    type="number"
                                    step="any"
                                    placeholder="Value"
                                    value={newMarker.value}
                                    onChange={(e) => setNewMarker({ ...newMarker, value: e.target.value })}
                                    className="w-20 h-8 text-sm"
                                  />
                                  <Input
                                    placeholder="Unit"
                                    value={newMarker.unit}
                                    onChange={(e) => setNewMarker({ ...newMarker, unit: e.target.value })}
                                    className="w-20 h-8 text-sm"
                                  />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7"
                                    onClick={() => {
                                      setAddingMarkerToResult(null);
                                      setNewMarker({ name: "", value: "", unit: "", category: "" });
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7"
                                    onClick={handleAddMarkerToResult}
                                    disabled={editSaving}
                                  >
                                    {editSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full mt-2 h-7 text-xs"
                                onClick={() => {
                                  setAddingMarkerToResult(result.id);
                                  setNewMarker({ name: "", value: "", unit: "", category: categoryKey });
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Marker
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Trends Placeholder */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Biomarker Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[150px] flex items-center justify-center text-muted-foreground">
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
                      We&apos;ll extract biomarkers from your PDF. Works best with text-based PDFs (not scanned images).
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
