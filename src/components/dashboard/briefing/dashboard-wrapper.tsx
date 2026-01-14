"use client";

import { useRef, useCallback } from "react";
import { Briefing } from "./index";

interface DashboardWrapperProps {
  userName: string;
  sleepScore: number | null;
  recoveryScore: number | null;
  readinessScore: number | null;
  children: React.ReactNode;
}

export function DashboardWrapper({
  userName,
  sleepScore,
  recoveryScore,
  readinessScore,
  children,
}: DashboardWrapperProps) {
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Use default values if scores are null
  const displaySleepScore = sleepScore ?? 0;
  const displayRecoveryScore = recoveryScore ?? 0;
  const displayReadinessScore = readinessScore ?? 0;

  const handleSkipToDashboard = useCallback(() => {
    if (dashboardRef.current) {
      const top = dashboardRef.current.offsetTop;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  return (
    <>
      {/* Morning Briefing - scrollytelling experience */}
      <Briefing
        userName={userName}
        sleepScore={displaySleepScore}
        recoveryScore={displayRecoveryScore}
        readinessScore={displayReadinessScore}
        onSkip={handleSkipToDashboard}
      />

      {/* Standard Dashboard */}
      <div ref={dashboardRef} id="dashboard" className="min-h-screen bg-background relative">
        {children}
      </div>
    </>
  );
}
