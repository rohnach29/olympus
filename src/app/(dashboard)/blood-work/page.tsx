import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Upload, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

// Sample biomarkers - will be replaced with real data
const biomarkerCategories = [
  {
    name: "Metabolic Health",
    markers: [
      { name: "Fasting Glucose", value: 92, unit: "mg/dL", range: "70-100", status: "optimal" },
      { name: "HbA1c", value: 5.2, unit: "%", range: "< 5.7", status: "optimal" },
      { name: "Fasting Insulin", value: 6.8, unit: "μIU/mL", range: "2-8", status: "optimal" },
    ],
  },
  {
    name: "Lipid Panel",
    markers: [
      { name: "Total Cholesterol", value: 185, unit: "mg/dL", range: "< 200", status: "optimal" },
      { name: "LDL-C", value: 95, unit: "mg/dL", range: "< 100", status: "optimal" },
      { name: "HDL-C", value: 62, unit: "mg/dL", range: "> 40", status: "optimal" },
      { name: "Triglycerides", value: 88, unit: "mg/dL", range: "< 150", status: "optimal" },
    ],
  },
  {
    name: "Inflammation",
    markers: [
      { name: "hs-CRP", value: 1.2, unit: "mg/L", range: "< 1.0", status: "warning" },
      { name: "Homocysteine", value: 9.5, unit: "μmol/L", range: "< 10", status: "optimal" },
    ],
  },
  {
    name: "Hormones",
    markers: [
      { name: "TSH", value: 2.1, unit: "mIU/L", range: "0.4-4.0", status: "optimal" },
      { name: "Vitamin D", value: 45, unit: "ng/mL", range: "30-80", status: "optimal" },
      { name: "Testosterone", value: 650, unit: "ng/dL", range: "300-1000", status: "optimal" },
    ],
  },
];

function getStatusColor(status: string) {
  switch (status) {
    case "optimal":
      return "text-green-500";
    case "warning":
      return "text-yellow-500";
    case "critical":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "optimal":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "critical":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

export default function BloodWorkPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blood Work</h1>
          <p className="text-muted-foreground">Track and analyze your biomarkers over time</p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Results
        </Button>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Latest Results Summary
          </CardTitle>
          <CardDescription>Last updated: January 2, 2026</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="text-3xl font-bold text-green-600">12</div>
              <div className="text-sm text-muted-foreground">Optimal</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">1</div>
              <div className="text-sm text-muted-foreground">Needs Attention</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <div className="text-3xl font-bold text-red-600">0</div>
              <div className="text-sm text-muted-foreground">Critical</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">92%</div>
              <div className="text-sm text-muted-foreground">Overall Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Biomarker Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {biomarkerCategories.map((category) => (
          <Card key={category.name}>
            <CardHeader>
              <CardTitle className="text-lg">{category.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {category.markers.map((marker) => (
                  <div
                    key={marker.name}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(marker.status)}
                      <div>
                        <div className="font-medium">{marker.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Range: {marker.range}
                        </div>
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

      {/* Trends Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Biomarker Trends
          </CardTitle>
          <CardDescription>Track how your markers change over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <p>Trend charts will appear here once you have multiple test results</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
