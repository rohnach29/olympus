"use client";

import { useRef, useCallback, useMemo, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  useMotionValueEvent,
  MotionValue,
} from "framer-motion";
import dynamic from "next/dynamic";

// Dynamically import WebGL component to avoid SSR issues
const GlowingTorus = dynamic(
  () => import("./glowing-torus").then((mod) => mod.GlowingTorus),
  { ssr: false }
);

// ============================================
// Types
// ============================================
interface ScrollytellingHeroProps {
  userName: string;
  sleepScore: number;
  recoveryScore: number;
  readinessScore: number;
  recommendationText: string;
  onComplete: () => void;
  onSkip: () => void;
}

// ============================================
// Full-Screen Ambient Mist Component
// ============================================
interface AmbientMistProps {
  colorProgress: number;
  reducedMotion: boolean;
}

function AmbientMist({ colorProgress, reducedMotion }: AmbientMistProps) {
  // Create mist spots that float across the entire screen
  const mistSpots = [
    { x: "10%", y: "20%", size: 300, duration: 25, color: "cyan", delay: 0 },
    { x: "80%", y: "15%", size: 250, duration: 30, color: "blue", delay: 5 },
    { x: "70%", y: "70%", size: 350, duration: 28, color: "purple", delay: 8 },
    { x: "15%", y: "75%", size: 280, duration: 32, color: "teal", delay: 3 },
    { x: "50%", y: "10%", size: 200, duration: 22, color: "pink", delay: 12 },
    { x: "90%", y: "50%", size: 320, duration: 35, color: "indigo", delay: 7 },
    { x: "5%", y: "45%", size: 260, duration: 27, color: "cyan", delay: 15 },
    { x: "40%", y: "85%", size: 240, duration: 24, color: "blue", delay: 10 },
  ];

  // Softer, more muted colors
  const colorMap: Record<string, string> = {
    cyan: colorProgress > 0.5 ? "hsl(150 40% 38%)" : "hsl(180 35% 42%)",
    blue: colorProgress > 0.5 ? "hsl(148 38% 36%)" : "hsl(205 32% 45%)",
    purple: colorProgress > 0.5 ? "hsl(152 35% 34%)" : "hsl(260 28% 45%)",
    pink: colorProgress > 0.5 ? "hsl(150 40% 38%)" : "hsl(300 25% 45%)",
    teal: colorProgress > 0.5 ? "hsl(155 42% 38%)" : "hsl(175 32% 42%)",
    indigo: colorProgress > 0.5 ? "hsl(148 36% 35%)" : "hsl(230 28% 44%)",
  };

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {mistSpots.map((spot, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full transition-colors duration-1000"
          style={{
            width: spot.size,
            height: spot.size,
            left: spot.x,
            top: spot.y,
            background: `radial-gradient(circle, ${colorMap[spot.color]}30 0%, ${colorMap[spot.color]}15 40%, transparent 70%)`,
            filter: `blur(${50 + (i % 3) * 20}px)`,
            transform: "translate(-50%, -50%)",
          }}
          animate={!reducedMotion ? {
            x: [0, 50 * (i % 2 === 0 ? 1 : -1), 0],
            y: [0, 30 * (i % 3 === 0 ? 1 : -1), 0],
            scale: [1, 1.1, 1],
          } : {}}
          transition={{
            duration: spot.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: spot.delay,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// Emanating Wisps Component (Smoke from ring)
// ============================================
interface EmanatingWispsProps {
  ringRadius: number;
  colorProgress: number;
  reducedMotion: boolean;
}

function EmanatingWisps({ ringRadius, colorProgress, reducedMotion }: EmanatingWispsProps) {
  // Wisps positioned around the ring, extending outward
  const wisps = [
    { angle: 30, length: 120, width: 60, outward: true, delay: 0 },
    { angle: 75, length: 90, width: 45, outward: true, delay: 1.5 },
    { angle: 120, length: 140, width: 70, outward: true, delay: 0.8 },
    { angle: 165, length: 100, width: 50, outward: false, delay: 2.2 }, // inward
    { angle: 210, length: 130, width: 65, outward: true, delay: 1.2 },
    { angle: 255, length: 85, width: 40, outward: true, delay: 2.8 },
    { angle: 300, length: 110, width: 55, outward: false, delay: 0.5 }, // inward
    { angle: 345, length: 95, width: 48, outward: true, delay: 1.8 },
  ];

  // Softer color palette
  const softColors = [
    "hsl(175 40% 48%)", // soft cyan
    "hsl(200 35% 52%)", // muted blue
    "hsl(220 30% 55%)", // soft blue
    "hsl(260 28% 52%)", // soft lavender
    "hsl(175 38% 50%)", // teal
    "hsl(195 32% 50%)", // blue-cyan
  ];
  const greenColor = "hsl(145 50% 42%)";

  return (
    <div className="absolute inset-0 pointer-events-none">
      {wisps.map((wisp, i) => {
        const color = colorProgress > 0.5 ? greenColor : softColors[i % softColors.length];
        const angleRad = (wisp.angle * Math.PI) / 180;

        // Position at ring edge
        const startX = Math.cos(angleRad) * ringRadius;
        const startY = Math.sin(angleRad) * ringRadius;

        // Extend outward (or inward)
        const direction = wisp.outward ? 1 : -0.6;
        const endX = startX + Math.cos(angleRad) * wisp.length * direction;
        const endY = startY + Math.sin(angleRad) * wisp.length * direction;

        // Center point of wisp
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;

        return (
          <div
            key={i}
            className="absolute transition-colors duration-700"
            style={{
              width: wisp.length,
              height: wisp.width,
              left: `calc(50% + ${centerX}px - ${wisp.length / 2}px)`,
              top: `calc(50% + ${centerY}px - ${wisp.width / 2}px)`,
              background: `radial-gradient(ellipse at ${wisp.outward ? '30%' : '70%'} 50%, ${color}60 0%, ${color}30 40%, transparent 80%)`,
              filter: "blur(45px)",
              transform: `rotate(${wisp.angle}deg)`,
              opacity: 0.35,
              animation: reducedMotion ? 'none' : `wisp-pulse 4s ease-in-out infinite`,
              animationDelay: `${wisp.delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

// ============================================
// Tubular Ring Component (Scene 1-2)
// Multi-layer swirl with thick translucent tube
// ============================================
interface AnimatedRingProps {
  colorProgress: number; // 0 = iridescent, 1 = green
  showScore: boolean;
  score?: number;
  label?: string;
  greeting?: string;
  reducedMotion: boolean;
}

function AnimatedRing({
  colorProgress,
  showScore,
  score,
  label,
  greeting,
  reducedMotion,
}: AnimatedRingProps) {
  const ringSize = 420;
  const tubeThickness = 45; // Thick tubular stroke
  const radius = (ringSize - tubeThickness) / 2;
  const center = ringSize / 2;
  const contentPadding = 70;

  // Soft, muted color palette
  const getSwirlGradient = (layer: 1 | 2 | 3, opacity: number = 1) => {
    const greenTransition = colorProgress > 0.5;
    const greenMix = Math.min(1, Math.max(0, (colorProgress - 0.3) / 0.4));

    if (greenTransition && colorProgress > 0.7) {
      // Full green state
      return (
        <>
          <stop offset="0%" stopColor="hsl(148 45% 40%)" stopOpacity={0.7 * opacity} />
          <stop offset="50%" stopColor="hsl(142 50% 42%)" stopOpacity={0.8 * opacity} />
          <stop offset="100%" stopColor="hsl(148 45% 40%)" stopOpacity={0.7 * opacity} />
        </>
      );
    }

    // Each layer has offset colors for swirl effect
    if (layer === 1) {
      return (
        <>
          <stop offset="0%" stopColor={`hsl(${175 - greenMix * 30} ${42 + greenMix * 8}% ${48 - greenMix * 6}%)`} stopOpacity={0.65 * opacity} />
          <stop offset="33%" stopColor={`hsl(${200 - greenMix * 55} ${38 + greenMix * 12}% ${52 - greenMix * 8}%)`} stopOpacity={0.6 * opacity} />
          <stop offset="66%" stopColor={`hsl(${260 - greenMix * 115} ${30 + greenMix * 20}% ${52 - greenMix * 8}%)`} stopOpacity={0.55 * opacity} />
          <stop offset="100%" stopColor={`hsl(${175 - greenMix * 30} ${42 + greenMix * 8}% ${48 - greenMix * 6}%)`} stopOpacity={0.65 * opacity} />
        </>
      );
    } else if (layer === 2) {
      return (
        <>
          <stop offset="0%" stopColor={`hsl(${195 - greenMix * 50} ${35 + greenMix * 15}% ${50 - greenMix * 7}%)`} stopOpacity={0.55 * opacity} />
          <stop offset="33%" stopColor={`hsl(${220 - greenMix * 75} ${32 + greenMix * 18}% ${53 - greenMix * 9}%)`} stopOpacity={0.5 * opacity} />
          <stop offset="66%" stopColor={`hsl(${175 - greenMix * 30} ${40 + greenMix * 10}% ${49 - greenMix * 6}%)`} stopOpacity={0.55 * opacity} />
          <stop offset="100%" stopColor={`hsl(${195 - greenMix * 50} ${35 + greenMix * 15}% ${50 - greenMix * 7}%)`} stopOpacity={0.55 * opacity} />
        </>
      );
    } else {
      return (
        <>
          <stop offset="0%" stopColor={`hsl(${210 - greenMix * 65} ${33 + greenMix * 17}% ${52 - greenMix * 8}%)`} stopOpacity={0.5 * opacity} />
          <stop offset="33%" stopColor={`hsl(${180 - greenMix * 35} ${38 + greenMix * 12}% ${50 - greenMix * 7}%)`} stopOpacity={0.45 * opacity} />
          <stop offset="66%" stopColor={`hsl(${240 - greenMix * 95} ${28 + greenMix * 22}% ${50 - greenMix * 7}%)`} stopOpacity={0.5 * opacity} />
          <stop offset="100%" stopColor={`hsl(${210 - greenMix * 65} ${33 + greenMix * 17}% ${52 - greenMix * 8}%)`} stopOpacity={0.5 * opacity} />
        </>
      );
    }
  };

  // Glow color
  const glowColor = colorProgress > 0.7
    ? "hsl(145 45% 42%)"
    : colorProgress > 0.3
      ? `hsl(${180 - colorProgress * 40} 40% 48%)`
      : "hsl(190 38% 50%)";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: ringSize + 200, height: ringSize + 200 }}
    >
      {/* Emanating wisps (smoke from ring) */}
      <EmanatingWisps
        ringRadius={radius}
        colorProgress={colorProgress}
        reducedMotion={reducedMotion}
      />

      {/* Outer ambient glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: ringSize + 160,
          height: ringSize + 160,
          background: `radial-gradient(circle, ${glowColor}20 0%, ${glowColor}08 50%, transparent 75%)`,
          filter: "blur(50px)",
        }}
        animate={!reducedMotion ? {
          scale: [1, 1.06, 1],
          opacity: [0.4, 0.6, 0.4],
        } : {}}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Inner luminosity (glow from center) */}
      <div
        className="absolute rounded-full"
        style={{
          width: radius * 1.6,
          height: radius * 1.6,
          background: `radial-gradient(circle, ${glowColor}12 0%, ${glowColor}06 40%, transparent 70%)`,
          filter: "blur(30px)",
        }}
      />

      {/* === TUBULAR RING STRUCTURE === */}

      {/* Layer 1: Outer soft glow of tube */}
      <svg
        className="absolute"
        width={ringSize + 40}
        height={ringSize + 40}
        viewBox={`0 0 ${ringSize + 40} ${ringSize + 40}`}
        style={{ filter: "blur(20px)", opacity: 0.4 }}
      >
        <defs>
          <linearGradient id="tube-outer-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            {getSwirlGradient(1, 0.6)}
          </linearGradient>
        </defs>
        <circle
          cx={(ringSize + 40) / 2}
          cy={(ringSize + 40) / 2}
          r={radius}
          fill="none"
          stroke="url(#tube-outer-glow)"
          strokeWidth={tubeThickness + 20}
        />
      </svg>

      {/* Swirl Layer 1 - Slowest, clockwise */}
      <div
        className="absolute"
        style={{
          width: ringSize,
          height: ringSize,
          animation: reducedMotion ? 'none' : 'swirl-cw-slow 18s linear infinite',
        }}
      >
        <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <defs>
            <linearGradient id="swirl-1" x1="0%" y1="0%" x2="100%" y2="100%">
              {getSwirlGradient(1)}
            </linearGradient>
          </defs>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#swirl-1)"
            strokeWidth={tubeThickness}
            strokeLinecap="round"
            opacity={0.45}
          />
        </svg>
      </div>

      {/* Swirl Layer 2 - Medium, counter-clockwise */}
      <div
        className="absolute"
        style={{
          width: ringSize,
          height: ringSize,
          animation: reducedMotion ? 'none' : 'swirl-ccw-med 24s linear infinite',
        }}
      >
        <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <defs>
            <linearGradient id="swirl-2" x1="100%" y1="0%" x2="0%" y2="100%">
              {getSwirlGradient(2)}
            </linearGradient>
          </defs>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#swirl-2)"
            strokeWidth={tubeThickness - 5}
            strokeLinecap="round"
            opacity={0.4}
          />
        </svg>
      </div>

      {/* Swirl Layer 3 - Fastest, clockwise */}
      <div
        className="absolute"
        style={{
          width: ringSize,
          height: ringSize,
          animation: reducedMotion ? 'none' : 'swirl-cw-fast 30s linear infinite',
        }}
      >
        <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <defs>
            <linearGradient id="swirl-3" x1="50%" y1="0%" x2="50%" y2="100%">
              {getSwirlGradient(3)}
            </linearGradient>
          </defs>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#swirl-3)"
            strokeWidth={tubeThickness - 10}
            strokeLinecap="round"
            opacity={0.35}
          />
        </svg>
      </div>

      {/* Tube highlight - outer edge */}
      <svg
        className="absolute"
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        style={{ opacity: 0.25 }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius + tubeThickness / 2 - 2}
          fill="none"
          stroke="white"
          strokeWidth={1.5}
          filter="url(#ring-highlight-blur)"
        />
        <defs>
          <filter id="ring-highlight-blur">
            <feGaussianBlur stdDeviation="1" />
          </filter>
        </defs>
      </svg>

      {/* Tube highlight - inner edge */}
      <svg
        className="absolute"
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        style={{ opacity: 0.15 }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius - tubeThickness / 2 + 2}
          fill="none"
          stroke="white"
          strokeWidth={1}
        />
      </svg>

      {/* Content inside ring */}
      <div
        className="absolute flex flex-col items-center justify-center z-10"
        style={{
          width: (radius - contentPadding) * 2,
          height: (radius - contentPadding) * 2,
        }}
      >
        {/* Greeting */}
        <motion.div
          className="text-center px-4"
          animate={{ opacity: showScore ? 0 : 1, y: showScore ? -10 : 0 }}
          transition={{ duration: 0.5 }}
        >
          {greeting && (
            <p className="text-xl md:text-2xl lg:text-3xl font-light text-white/90 leading-tight">
              {greeting}
            </p>
          )}
        </motion.div>

        {/* Score */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
          animate={{ opacity: showScore ? 1 : 0, y: showScore ? 0 : 10 }}
          transition={{ duration: 0.5, delay: showScore ? 0.2 : 0 }}
        >
          {label && (
            <p className="text-xs md:text-sm text-white/70 uppercase tracking-wider mb-1">
              {label}
            </p>
          )}
          {score !== undefined && (
            <p className="text-5xl md:text-6xl lg:text-7xl font-light" style={{ color: "hsl(145 50% 45%)" }}>
              {score}
            </p>
          )}
          <p className="text-xs text-white/50 mt-1">Last night</p>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================
// Dynamic Background Component
// ============================================
interface DynamicBackgroundProps {
  colorProgress: number;
  reducedMotion: boolean;
}

function DynamicBackground({ colorProgress, reducedMotion }: DynamicBackgroundProps) {
  // Background shifts from iridescent tinge to green tinge
  const bgColor1 = colorProgress > 0.5
    ? "hsl(150 35% 6%)"
    : "hsl(210 30% 6%)";
  const bgColor2 = colorProgress > 0.5
    ? "hsl(145 25% 4%)"
    : "hsl(250 25% 5%)";

  return (
    <div className="fixed inset-0 -z-10">
      {/* Base gradient */}
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: `
            radial-gradient(ellipse 120% 100% at 50% 50%, ${bgColor1} 0%, ${bgColor2} 50%, hsl(0 0% 3%) 100%)
          `,
        }}
      />

      {/* Full-screen ambient mist */}
      <AmbientMist colorProgress={colorProgress} reducedMotion={reducedMotion} />
    </div>
  );
}

// ============================================
// Scroll-Reactive Ring Wrapper (WebGL Torus)
// ============================================
interface ScrollReactiveRingProps {
  colorProgress: MotionValue<number>;
  sleepScore: number;
  greeting: string;
  reducedMotion: boolean;
}

function ScrollReactiveRing({
  colorProgress,
  sleepScore,
  greeting,
  reducedMotion,
}: ScrollReactiveRingProps) {
  const [progress, setProgress] = useState(0);
  const [showScore, setShowScore] = useState(false);

  useMotionValueEvent(colorProgress, "change", (latest) => {
    setProgress(latest);
    setShowScore(latest > 0.6);
  });

  // Use CSS fallback for reduced motion, WebGL otherwise
  if (reducedMotion) {
    return (
      <AnimatedRing
        colorProgress={progress}
        showScore={showScore}
        score={sleepScore}
        label="Sleep"
        greeting={greeting}
        reducedMotion={reducedMotion}
      />
    );
  }

  // WebGL torus is now a fixed full-screen background
  // Text overlays are handled here with HTML
  return (
    <>
      {/* WebGL Torus - fixed full-screen background */}
      <GlowingTorus />

      {/* Text overlay - shifted right to align with ring (sidebar is ~200px) */}
      <div className="relative z-10 flex flex-col items-center justify-center pl-[100px]">
        {/* Greeting */}
        <motion.div
          className="text-center px-4"
          animate={{ opacity: showScore ? 0 : 1, y: showScore ? -20 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <p
            className="text-3xl md:text-4xl lg:text-5xl font-extralight tracking-wide text-white/95 leading-tight"
            style={{
              textShadow: "0 0 60px rgba(140, 100, 200, 0.5), 0 0 120px rgba(80, 180, 180, 0.3)",
              letterSpacing: "0.05em",
            }}
          >
            {greeting}
          </p>
        </motion.div>

        {/* Score - absolutely positioned to overlap greeting space */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
          animate={{ opacity: showScore ? 1 : 0, y: showScore ? 0 : 20 }}
          transition={{ duration: 0.5, delay: showScore ? 0.2 : 0 }}
        >
          <p className="text-xs md:text-sm text-white/50 uppercase tracking-[0.3em] mb-3 font-light">
            Sleep
          </p>
          <p
            className="text-6xl md:text-7xl lg:text-8xl font-extralight tracking-tight"
            style={{
              color: "#00FF88",
              textShadow: "0 0 60px rgba(0, 255, 136, 0.5), 0 0 120px rgba(0, 255, 136, 0.2)",
            }}
          >
            {sleepScore}
          </p>
          <p className="text-xs text-white/40 mt-3 tracking-wider font-light">Last night</p>
        </motion.div>
      </div>
    </>
  );
}

// ============================================
// Scroll-Reactive Background Wrapper
// ============================================
interface ScrollReactiveBackgroundProps {
  colorProgress: MotionValue<number>;
  reducedMotion: boolean;
}

function ScrollReactiveBackground({ colorProgress, reducedMotion }: ScrollReactiveBackgroundProps) {
  const [progress, setProgress] = useState(0);

  useMotionValueEvent(colorProgress, "change", (latest) => {
    setProgress(latest);
  });

  return <DynamicBackground colorProgress={progress} reducedMotion={reducedMotion} />;
}

// ============================================
// Progress Indicator Dot
// ============================================
interface ProgressDotProps {
  threshold: number;
  smoothProgress: MotionValue<number>;
}

function ProgressDot({ threshold, smoothProgress }: ProgressDotProps) {
  const scale = useTransform(
    smoothProgress,
    [Math.max(0, threshold - 0.1), threshold],
    [1, 1.3]
  );
  const opacity = useTransform(
    smoothProgress,
    [Math.max(0, threshold - 0.1), threshold],
    [0.3, 1]
  );

  return (
    <motion.div
      className="w-2 h-2 rounded-full bg-white/20"
      style={{ scale, opacity }}
    />
  );
}

// ============================================
// Main Scrollytelling Hero Component
// ============================================
export function ScrollytellingHero({
  userName,
  sleepScore,
  recoveryScore,
  readinessScore,
  recommendationText,
  onComplete,
  onSkip,
}: ScrollytellingHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Track scroll progress through the entire container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooth the scroll progress
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Scene 1 → 2 transition happens in first 33% of scroll
  const scene1to2Progress = useTransform(smoothProgress, [0, 0.33], [0, 1]);

  // Opacity for the main ring container
  const ringOpacity = useTransform(smoothProgress, [0, 0.4, 0.5], [1, 1, 0]);

  // Opacity for scroll hint
  const hintOpacity = useTransform(smoothProgress, [0, 0.05], [1, 0]);

  // Get greeting based on time of day
  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${userName}`;
    if (hour < 17) return `Good afternoon, ${userName}`;
    return `Good evening, ${userName}`;
  }, [userName]);

  const greeting = useMemo(() => getGreeting(), [getGreeting]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: "300vh" }} // 3x viewport for scroll room
    >
      {/* Dynamic background with ambient mist */}
      <ScrollReactiveBackground colorProgress={scene1to2Progress} reducedMotion={prefersReducedMotion} />

      {/* Skip button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={onSkip}
        className="fixed top-6 right-6 z-50 px-4 py-2 text-sm text-white/60 hover:text-white/90
                   bg-white/5 hover:bg-white/10 rounded-full border border-white/10
                   transition-colors duration-200 backdrop-blur-sm"
      >
        Skip
      </motion.button>

      {/* Progress indicator */}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        {[0, 0.33, 0.66, 1].map((threshold, i) => (
          <ProgressDot key={i} threshold={threshold} smoothProgress={smoothProgress} />
        ))}
      </div>

      {/* Sticky viewport for the animation */}
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        {/* Scene 1-2: Ring with greeting → sleep score */}
        <motion.div
          className="flex flex-col items-center"
          style={{ opacity: ringOpacity }}
        >
          <ScrollReactiveRing
            colorProgress={scene1to2Progress}
            sleepScore={sleepScore}
            greeting={greeting}
            reducedMotion={prefersReducedMotion}
          />
        </motion.div>
      </div>

      {/* Continue indicator */}
      <motion.div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
        style={{ opacity: hintOpacity }}
      >
        <div className="flex flex-col items-center gap-2 text-white/40">
          <span className="text-sm">Scroll to explore</span>
          <motion.svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </motion.svg>
        </div>
      </motion.div>
    </div>
  );
}
