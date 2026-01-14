"use client";

import { useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { IntroScene } from "./intro-scene";
import { SleepScene } from "./sleep-scene";
import { TransitionScene } from "./transition-scene";
import { RecoveryScene } from "./recovery-scene";
import { ReadinessScene } from "./readiness-scene";
import { SkipButton } from "./skip-button";

interface BriefingProps {
  userName: string;
  sleepScore: number;
  recoveryScore: number;
  readinessScore: number;
  onSkip: () => void;
}

export function Briefing({
  userName,
  sleepScore,
  recoveryScore,
  readinessScore,
  onSkip,
}: BriefingProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Scene opacities - each scene fades in and out
  // Scene 1: Intro (0% - 20%)
  const scene1Opacity = useTransform(
    scrollYProgress,
    [0, 0.05, 0.15, 0.2],
    [1, 1, 1, 0]
  );

  // Scene 2: Sleep (15% - 40%)
  const scene2Opacity = useTransform(
    scrollYProgress,
    [0.15, 0.2, 0.35, 0.4],
    [0, 1, 1, 0]
  );

  // Scene 3: Transition (35% - 60%)
  const scene3Opacity = useTransform(
    scrollYProgress,
    [0.35, 0.4, 0.55, 0.6],
    [0, 1, 1, 0]
  );

  // Scene 4: Recovery (55% - 80%)
  const scene4Opacity = useTransform(
    scrollYProgress,
    [0.55, 0.6, 0.75, 0.8],
    [0, 1, 1, 0]
  );

  // Scene 5: Readiness (75% - 100%)
  const scene5Opacity = useTransform(
    scrollYProgress,
    [0.75, 0.8, 0.95, 1],
    [0, 1, 1, 0]
  );

  return (
    <>
      {/* Scroll container - 500vh to allow for scrolling through scenes */}
      <div ref={containerRef} className="relative h-[500vh]">
        {/* Black background for the briefing area */}
        <div className="fixed inset-0 bg-black -z-10" />

        {/* All scenes are fixed and layered */}
        <IntroScene userName={userName} opacity={scene1Opacity} />
        <SleepScene sleepScore={sleepScore} opacity={scene2Opacity} />
        <TransitionScene opacity={scene3Opacity} />
        <RecoveryScene recoveryScore={recoveryScore} opacity={scene4Opacity} />
        <ReadinessScene readinessScore={readinessScore} opacity={scene5Opacity} />
      </div>
      
      {/* Skip button - outside scroll container for proper click handling */}
      <SkipButton scrollProgress={scrollYProgress} onSkip={onSkip} />
    </>
  );
}

export { IntroScene } from "./intro-scene";
export { SleepScene } from "./sleep-scene";
export { TransitionScene } from "./transition-scene";
export { RecoveryScene } from "./recovery-scene";
export { ReadinessScene } from "./readiness-scene";
export { SkipButton } from "./skip-button";
