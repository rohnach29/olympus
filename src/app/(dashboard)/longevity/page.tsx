import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Heart, Brain, Dna, Activity, Clock, TrendingUp, Zap } from "lucide-react";

// Longevity pillars based on research
const longevityPillars = [
  {
    name: "Metabolic Health",
    score: 85,
    icon: Zap,
    color: "text-yellow-500",
    description: "Blood sugar stability, insulin sensitivity",
    factors: ["Fasting glucose: Optimal", "HbA1c: Optimal", "Insulin: Optimal"],
  },
  {
    name: "Cardiovascular",
    score: 88,
    icon: Heart,
    color: "text-red-500",
    description: "Heart health and circulation",
    factors: ["Resting HR: 58 bpm", "Blood pressure: 118/76", "VO2 Max: Good"],
  },
  {
    name: "Cognitive",
    score: 82,
    icon: Brain,
    color: "text-purple-500",
    description: "Brain health and mental acuity",
    factors: ["Sleep quality: Good", "Stress levels: Moderate", "Mental exercises: Active"],
  },
  {
    name: "Physical Function",
    score: 79,
    icon: Activity,
    color: "text-green-500",
    description: "Strength, mobility, and fitness",
    factors: ["Grip strength: Above avg", "Walking speed: Normal", "Balance: Good"],
  },
];

const lifestyleFactors = [
  { name: "Sleep Quality", score: 78, target: 85, unit: "score" },
  { name: "Exercise Minutes", score: 180, target: 150, unit: "min/week" },
  { name: "Nutrition Score", score: 72, target: 80, unit: "score" },
  { name: "Stress Management", score: 65, target: 75, unit: "score" },
  { name: "Social Connection", score: 70, target: 80, unit: "score" },
];

export default function LongevityPage() {
  const biologicalAge = 32;
  const chronologicalAge = 35;
  const ageDifference = chronologicalAge - biologicalAge;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Longevity</h1>
        <p className="text-muted-foreground">Your biological age and longevity indicators</p>
      </div>

      {/* Biological Age Card */}
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
                  <span className="text-5xl font-bold">{biologicalAge}</span>
                  <span className="text-xl text-muted-foreground">years</span>
                </div>
              </div>
            </div>

            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Chronological Age</p>
                <p className="text-2xl font-semibold">{chronologicalAge}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Difference</p>
                <p className="text-2xl font-semibold text-green-500">-{ageDifference} years</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Percentile</p>
                <p className="text-2xl font-semibold">Top 15%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Longevity Pillars */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Longevity Pillars</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {longevityPillars.map((pillar) => (
            <Card key={pillar.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <pillar.icon className={`h-5 w-5 ${pillar.color}`} />
                  {pillar.name}
                </CardTitle>
                <CardDescription className="text-xs">{pillar.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{pillar.score}</span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <Progress value={pillar.score} className="h-2" />
                  <div className="space-y-1">
                    {pillar.factors.map((factor, i) => (
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

      {/* Lifestyle Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Lifestyle Factors
          </CardTitle>
          <CardDescription>Key behaviors that impact your longevity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {lifestyleFactors.map((factor) => {
              const percentage = Math.min((factor.score / factor.target) * 100, 100);
              const isOnTarget = factor.score >= factor.target;

              return (
                <div key={factor.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{factor.name}</span>
                    <span className={`text-sm ${isOnTarget ? "text-green-500" : "text-yellow-500"}`}>
                      {factor.score} / {factor.target} {factor.unit}
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recommendations to Improve
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">Reduce Biological Age</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Improve sleep consistency (target 7-8 hours)</li>
                <li>• Add 2 strength training sessions per week</li>
                <li>• Reduce processed food intake</li>
              </ul>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">Key Focus Areas</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Stress management (consider meditation)</li>
                <li>• Increase social activities</li>
                <li>• Monitor hs-CRP inflammation marker</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center">
        Biological age is an estimate based on various biomarkers and lifestyle factors.
        Consult healthcare providers for medical advice.
      </p>
    </div>
  );
}
