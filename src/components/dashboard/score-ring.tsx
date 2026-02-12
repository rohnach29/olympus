"use client";

import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number | null;
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

type ScoreColor = {
  gradient: [string, string];
  glow: string;
  text: string;
};

function getScoreColor(percentage: number): ScoreColor {
  if (percentage >= 0.8) {
    return {
      gradient: ["#22c55e", "#10b981"],
      glow: "hsl(142, 71%, 45%)",
      text: "text-green-400",
    };
  }
  if (percentage >= 0.6) {
    return {
      gradient: ["#eab308", "#f59e0b"],
      glow: "hsl(48, 96%, 53%)",
      text: "text-yellow-400",
    };
  }
  if (percentage >= 0.4) {
    return {
      gradient: ["#f97316", "#ea580c"],
      glow: "hsl(25, 95%, 53%)",
      text: "text-orange-400",
    };
  }
  return {
    gradient: ["#ef4444", "#dc2626"],
    glow: "hsl(0, 84%, 60%)",
    text: "text-red-400",
  };
}

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

  const hasScore = score !== null;
  const percentage = hasScore ? Math.min(score / maxScore, 1) : 0;
  const offset = circumference * (1 - percentage);

  const color = hasScore ? getScoreColor(percentage) : null;
  const gradientId = `score-gradient-${label?.replace(/\s/g, "-") ?? "default"}-${size}`;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        className="relative"
        style={{
          width: config.width,
          height: config.width,
          filter: hasScore
            ? `drop-shadow(0 0 8px ${color!.glow}40)`
            : undefined,
        }}
      >
        {/* Radial background glow */}
        {hasScore && (
          <div
            className="absolute inset-0 rounded-full opacity-20"
            style={{
              background: `radial-gradient(circle, ${color!.glow}30 0%, transparent 70%)`,
            }}
          />
        )}
        <svg
          width={config.width}
          height={config.width}
          viewBox={`0 0 ${config.width} ${config.width}`}
          className="transform -rotate-90"
        >
          <defs>
            {hasScore && (
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color!.gradient[0]} />
                <stop offset="100%" stopColor={color!.gradient[1]} />
              </linearGradient>
            )}
          </defs>
          {/* Background ring */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            strokeWidth={config.strokeWidth}
            className="stroke-white/[0.06]"
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
            stroke={hasScore ? `url(#${gradientId})` : undefined}
            className={cn(
              "score-ring transition-all duration-1000",
              !hasScore && "stroke-muted/30"
            )}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-bold",
              config.fontSize,
              hasScore ? "text-white" : "text-muted-foreground"
            )}
            style={
              hasScore
                ? { textShadow: `0 0 20px ${color!.glow}50` }
                : undefined
            }
          >
            {hasScore ? Math.round(score) : "--"}
          </span>
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
