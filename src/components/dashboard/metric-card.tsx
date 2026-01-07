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

export function MetricCard({
  title,
  value,
  unit,
  change,
  icon: Icon,
  iconColor = "text-primary",
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{value ?? "--"}</span>
              {unit && value !== null && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
            {change !== undefined && (
              <p
                className={cn(
                  "text-xs font-medium",
                  change >= 0 ? "text-green-500" : "text-red-500"
                )}
              >
                {change >= 0 ? "+" : ""}
                {change}% vs last week
              </p>
            )}
          </div>
          <div className={cn("p-2.5 rounded-xl bg-primary/10", iconColor.replace("text-", "bg-").replace("500", "100"))}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
