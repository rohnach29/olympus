import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  change?: number;
  icon: LucideIcon;
  iconColor?: string;
  className?: string;
}

const iconGlowMap: Record<string, string> = {
  "text-red-500": "shadow-red-500/20",
  "text-purple-500": "shadow-purple-500/20",
  "text-blue-500": "shadow-blue-500/20",
  "text-orange-500": "shadow-orange-500/20",
  "text-indigo-500": "shadow-indigo-500/20",
  "text-green-500": "shadow-green-500/20",
};

const iconBgMap: Record<string, string> = {
  "text-red-500": "bg-red-500/10",
  "text-purple-500": "bg-purple-500/10",
  "text-blue-500": "bg-blue-500/10",
  "text-orange-500": "bg-orange-500/10",
  "text-indigo-500": "bg-indigo-500/10",
  "text-green-500": "bg-green-500/10",
};

export function MetricCard({
  title,
  value,
  unit,
  change,
  icon: Icon,
  iconColor = "text-primary",
  className,
}: MetricCardProps) {
  const glowClass = iconGlowMap[iconColor] ?? "shadow-primary/20";
  const bgClass = iconBgMap[iconColor] ?? "bg-primary/10";

  return (
    <Card className={cn("group", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight">{value ?? "--"}</span>
              {unit && value !== null && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
            {change !== undefined && (
              <p
                className={cn(
                  "text-xs font-medium",
                  change >= 0 ? "text-green-400" : "text-red-400"
                )}
              >
                {change >= 0 ? "+" : ""}
                {change}% vs last week
              </p>
            )}
          </div>
          <div
            className={cn(
              "p-2.5 rounded-xl shadow-lg transition-all duration-300 group-hover:shadow-xl",
              bgClass,
              glowClass
            )}
          >
            <Icon className={cn("h-5 w-5 transition-colors", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
