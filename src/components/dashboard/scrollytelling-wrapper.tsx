"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { ScrollytellingHero } from "./scrollytelling-hero";

const STORAGE_KEY = "olympus_scrolly_last_shown";

interface ScrollytellingWrapperProps {
  children: ReactNode;
  userName: string;
  sleepScore: number;
  recoveryScore: number;
  readinessScore: number;
  recommendationText: string;
}

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function hasShownToday(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const lastShown = localStorage.getItem(STORAGE_KEY);
    return lastShown === getTodayDateString();
  } catch {
    return false;
  }
}

function markAsShown(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, getTodayDateString());
  } catch {
    // Ignore storage errors
  }
}

export function ScrollytellingWrapper({
  children,
  userName,
  sleepScore,
  recoveryScore,
  readinessScore,
  recommendationText,
}: ScrollytellingWrapperProps) {
  const [showScrolly, setShowScrolly] = useState<boolean | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    setShowScrolly(!hasShownToday());
  }, []);

  const handleComplete = useCallback(() => {
    markAsShown();
    setIsExiting(true);
    // Smooth transition to dashboard
    setTimeout(() => {
      setShowScrolly(false);
      // Scroll to top of dashboard
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 300);
  }, []);

  const handleSkip = useCallback(() => {
    markAsShown();
    setIsExiting(true);
    setTimeout(() => {
      setShowScrolly(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 200);
  }, []);

  // Loading state - don't render anything until we check localStorage
  if (showScrolly === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Show scrollytelling experience
  if (showScrolly) {
    return (
      <div
        className={`scrolly-container transition-opacity duration-300 ${
          isExiting ? "opacity-0" : "opacity-100"
        }`}
      >
        <ScrollytellingHero
          userName={userName}
          sleepScore={sleepScore}
          recoveryScore={recoveryScore}
          readinessScore={readinessScore}
          recommendationText={recommendationText}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </div>
    );
  }

  // Show dashboard
  return <>{children}</>;
}
