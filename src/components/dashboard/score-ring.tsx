"use client";

import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  sublabel?: string;
  className?: string;
}

const sizeConfig = {
  sm: { width: 80, strokeWidth: 6, fontSize: "text-lg" },
  md: { width: 120, strokeWidth: 8, fontSize: "text-3xl" },
  lg: { width: 160, strokeWidth: 10, fontSize: "text-4xl" },
};

export function ScoreRing({
  score,
  maxScore = 100,
  size = "md",
  label,
  sublabel,
  className,
}: ScoreRingProps) {
  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - percentage);

  const getColor = () => {
    if (percentage >= 0.8) return "stroke-[hsl(var(--health-green))]";
    if (percentage >= 0.6) return "stroke-[hsl(var(--health-yellow))]";
    if (percentage >= 0.4) return "stroke-[hsl(var(--health-orange))]";
    return "stroke-[hsl(var(--health-red))]";
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg
          width={config.width}
          height={config.width}
          viewBox={`0 0 ${config.width} ${config.width}`}
          className="transform -rotate-90"
        >
          {/* Background ring */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted/30"
          />
          {/* Score ring */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn("score-ring transition-all duration-1000", getColor())}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold", config.fontSize)}>{Math.round(score)}</span>
          {sublabel && (
            <span className="text-xs text-muted-foreground">{sublabel}</span>
          )}
        </div>
      </div>
      {label && (
        <span className="mt-2 text-sm font-medium text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
