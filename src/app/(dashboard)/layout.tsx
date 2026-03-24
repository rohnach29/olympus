import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { BodyScene } from "@/components/body-map/body-scene";
import { NavList } from "@/components/dashboard/nav-list";
import { VitalsPanel } from "@/components/dashboard/vitals-panel";
import { AIInsightsPanel } from "@/components/dashboard/ai-insights-panel";

const DEFAULT_INSIGHTS = [
  {
    category: "Recovery Analysis",
    color: "#34d399",
    text: "Your HRV is trending above your 30-day baseline. Combined with last night's sleep score, your autonomic nervous system is well-recovered.",
    timestamp: "4 min ago",
  },
  {
    category: "Nutrition Alert",
    color: "#f59e0b",
    text: "You're 20g below your protein target with 2 meals remaining. Consider adding Greek yogurt or a protein shake.",
    timestamp: "18 min ago",
  },
  {
    category: "Sleep Optimization",
    color: "#818cf8",
    text: "Based on your circadian patterns, start wind-down at 10:15 PM tonight for optimal deep sleep.",
    timestamp: "1 hr ago",
  },
  {
    category: "Cardiovascular",
    color: "#ef4444",
    text: "Resting HR has dropped 3 bpm over 2 weeks — your aerobic base is strengthening.",
    timestamp: "2 hrs ago",
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const userName = user.fullName || user.email.split("@")[0] || "User";

  const vitalGroups = [
    {
      label: "Cardiovascular",
      vitals: [
        { name: "Resting Heart Rate", value: "--", unit: "bpm", color: "#ef4444" },
        { name: "HRV", value: "--", unit: "ms", color: "#a78bfa" },
      ],
    },
    {
      label: "Metabolic",
      vitals: [
        { name: "Active Calories", value: "--", unit: "kcal", color: "#f59e0b" },
        { name: "Steps", value: "--", color: "#3b82f6" },
      ],
    },
    {
      label: "Recovery",
      vitals: [
        { name: "Recovery Score", value: "--", unit: "/100", color: "#10b981" },
        { name: "Sleep Score", value: "--", unit: "/100", color: "#818cf8" },
      ],
    },
  ];

  return (
    <div className="h-screen bg-background overflow-hidden grid grid-cols-[260px_1fr_320px]">
      {/* Left Panel */}
      <div className="border-r border-white/[0.04] flex flex-col p-5 overflow-hidden">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.3)]">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-base font-bold">Olympus</span>
        </div>

        <VitalsPanel groups={vitalGroups} />
        <NavList />
      </div>

      {/* Center: Persistent 3D Canvas + page overlay */}
      <div className="relative overflow-hidden">
        <BodyScene />
        {/* Page-specific overlay content (readiness score, breadcrumbs, etc.) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="pointer-events-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="border-l border-white/[0.04] p-5 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-end gap-3 mb-6">
          <div className="text-right">
            <div className="text-sm font-medium">{userName.split(" ")[0]}</div>
            <div className="text-[10px] text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-[11px] font-semibold text-white">
            {userName.slice(0, 2).toUpperCase()}
          </div>
        </div>

        <AIInsightsPanel insights={DEFAULT_INSIGHTS} />
      </div>
    </div>
  );
}
