"use client";

import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  useMotionValueEvent,
  MotionValue,
} from "framer-motion";

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

  const colorMap: Record<string, string> = {
    cyan: colorProgress > 0.5 ? "hsl(150 60% 40%)" : "hsl(180 60% 45%)",
    blue: colorProgress > 0.5 ? "hsl(145 55% 38%)" : "hsl(210 65% 50%)",
    purple: colorProgress > 0.5 ? "hsl(155 50% 35%)" : "hsl(270 55% 50%)",
    pink: colorProgress > 0.5 ? "hsl(148 58% 42%)" : "hsl(320 50% 50%)",
    teal: colorProgress > 0.5 ? "hsl(152 62% 40%)" : "hsl(175 55% 45%)",
    indigo: colorProgress > 0.5 ? "hsl(147 52% 37%)" : "hsl(240 50% 48%)",
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
// Ring Orbiting Mist Particles
// ============================================
interface RingMistProps {
  ringRadius: number;
  colorProgress: number;
  reducedMotion: boolean;
}

function RingMist({ ringRadius, colorProgress, reducedMotion }: RingMistProps) {
  const particles = Array.from({ length: 16 }, (_, i) => ({
    index: i,
    baseAngle: (i / 16) * 360,
    duration: 15 + (i % 6) * 4,
    size: 80 + (i % 4) * 40,
    blur: 35 + (i % 3) * 20,
    orbitRadius: ringRadius + (i % 3 - 1) * 30, // Vary orbit slightly
  }));

  const iridescentColors = [
    "hsl(180 70% 50%)",
    "hsl(200 75% 55%)",
    "hsl(260 65% 58%)",
    "hsl(300 55% 52%)",
    "hsl(160 65% 48%)",
    "hsl(220 70% 55%)",
    "hsl(280 60% 55%)",
    "hsl(175 68% 50%)",
  ];
  const greenColor = "hsl(142 71% 45%)";

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p) => {
        const color = colorProgress > 0.5 ? greenColor : iridescentColors[p.index % iridescentColors.length];
        const opacity = 0.4 + (1 - Math.min(colorProgress, 0.7)) * 0.3;

        if (reducedMotion) {
          const x = Math.cos((p.baseAngle * Math.PI) / 180) * p.orbitRadius;
          const y = Math.sin((p.baseAngle * Math.PI) / 180) * p.orbitRadius;
          return (
            <div
              key={p.index}
              className="absolute rounded-full transition-colors duration-700"
              style={{
                width: p.size,
                height: p.size,
                background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                filter: `blur(${p.blur}px)`,
                opacity: opacity * 0.5,
                left: `calc(50% + ${x}px - ${p.size / 2}px)`,
                top: `calc(50% + ${y}px - ${p.size / 2}px)`,
              }}
            />
          );
        }

        return (
          <div
            key={p.index}
            className="absolute left-1/2 top-1/2"
            style={{
              width: p.orbitRadius * 2,
              height: p.orbitRadius * 2,
              marginLeft: -p.orbitRadius,
              marginTop: -p.orbitRadius,
              animation: `orbit-${p.index % 2 === 0 ? 'cw' : 'ccw'} ${p.duration}s linear infinite`,
              animationDelay: `${-p.index * 1.2}s`,
            }}
          >
            <div
              className="absolute rounded-full transition-colors duration-700"
              style={{
                width: p.size,
                height: p.size,
                background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                filter: `blur(${p.blur}px)`,
                opacity,
                left: `calc(50% + ${p.orbitRadius}px - ${p.size / 2}px)`,
                top: `calc(50% - ${p.size / 2}px)`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Animated Ring Component (Scene 1-2)
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
  const ringSize = 420; // Large ring
  const strokeWidth = 10; // Main stroke
  const radius = (ringSize - strokeWidth * 2) / 2;
  const center = ringSize / 2;
  const gradientId = "main-ring-gradient";
  const contentPadding = 60; // Padding so text doesn't touch ring

  // Calculate interpolated colors based on progress
  const getStrokeGradient = (opacity: number = 1) => {
    if (colorProgress < 0.3) {
      return (
        <>
          <stop offset="0%" stopColor="hsl(175 65% 55%)" stopOpacity={0.9 * opacity} />
          <stop offset="20%" stopColor="hsl(195 70% 55%)" stopOpacity={0.85 * opacity} />
          <stop offset="40%" stopColor="hsl(230 60% 60%)" stopOpacity={0.8 * opacity} />
          <stop offset="60%" stopColor="hsl(270 55% 58%)" stopOpacity={0.8 * opacity} />
          <stop offset="80%" stopColor="hsl(310 50% 55%)" stopOpacity={0.85 * opacity} />
          <stop offset="100%" stopColor="hsl(175 65% 55%)" stopOpacity={0.9 * opacity} />
        </>
      );
    } else if (colorProgress < 0.7) {
      const greenMix = (colorProgress - 0.3) / 0.4;
      return (
        <>
          <stop offset="0%" stopColor={`hsl(${160 - greenMix * 20} ${65 + greenMix * 10}% ${52 - greenMix * 7}%)`} stopOpacity={0.9 * opacity} />
          <stop offset="25%" stopColor={`hsl(${175 - greenMix * 35} ${68 + greenMix * 8}% ${53 - greenMix * 8}%)`} stopOpacity={0.85 * opacity} />
          <stop offset="50%" stopColor={`hsl(${190 - greenMix * 50} ${65 + greenMix * 10}% ${52 - greenMix * 7}%)`} stopOpacity={0.85 * opacity} />
          <stop offset="75%" stopColor={`hsl(${165 - greenMix * 25} ${67 + greenMix * 9}% ${50 - greenMix * 5}%)`} stopOpacity={0.85 * opacity} />
          <stop offset="100%" stopColor={`hsl(${160 - greenMix * 20} ${65 + greenMix * 10}% ${52 - greenMix * 7}%)`} stopOpacity={0.9 * opacity} />
        </>
      );
    } else {
      return (
        <>
          <stop offset="0%" stopColor="hsl(145 72% 43%)" stopOpacity={0.9 * opacity} />
          <stop offset="50%" stopColor="hsl(142 71% 45%)" stopOpacity={0.95 * opacity} />
          <stop offset="100%" stopColor="hsl(145 72% 43%)" stopOpacity={0.9 * opacity} />
        </>
      );
    }
  };

  // Glow color based on progress
  const glowColor = colorProgress > 0.7
    ? "hsl(142 71% 45%)"
    : colorProgress > 0.3
      ? `hsl(${175 - colorProgress * 35} 65% 50%)`
      : "hsl(195 70% 55%)";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: ringSize + 200, height: ringSize + 200 }}
    >
      {/* Ring orbiting mist */}
      <RingMist
        ringRadius={radius}
        colorProgress={colorProgress}
        reducedMotion={reducedMotion}
      />

      {/* Outermost diffuse glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: ringSize + 180,
          height: ringSize + 180,
          background: `radial-gradient(circle, ${glowColor}15 0%, ${glowColor}08 40%, transparent 70%)`,
          filter: "blur(60px)",
        }}
        animate={!reducedMotion ? {
          scale: [1, 1.08, 1],
          opacity: [0.5, 0.7, 0.5],
        } : {}}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Ghost ring 1 - outer, very blurred */}
      <svg
        className="absolute"
        width={ringSize + 80}
        height={ringSize + 80}
        viewBox={`0 0 ${ringSize + 80} ${ringSize + 80}`}
        style={{ filter: "blur(40px)", opacity: 0.35 }}
      >
        <defs>
          <linearGradient id={`${gradientId}-ghost1`} x1="0%" y1="100%" x2="100%" y2="0%">
            {getStrokeGradient(0.6)}
          </linearGradient>
        </defs>
        <circle
          cx={(ringSize + 80) / 2}
          cy={(ringSize + 80) / 2}
          r={radius + 15}
          fill="none"
          stroke={`url(#${gradientId}-ghost1)`}
          strokeWidth={strokeWidth * 3}
        />
      </svg>

      {/* Ghost ring 2 - medium blur */}
      <svg
        className="absolute"
        width={ringSize + 40}
        height={ringSize + 40}
        viewBox={`0 0 ${ringSize + 40} ${ringSize + 40}`}
        style={{ filter: "blur(25px)", opacity: 0.45 }}
      >
        <defs>
          <linearGradient id={`${gradientId}-ghost2`} x1="100%" y1="0%" x2="0%" y2="100%">
            {getStrokeGradient(0.7)}
          </linearGradient>
        </defs>
        <circle
          cx={(ringSize + 40) / 2}
          cy={(ringSize + 40) / 2}
          r={radius + 5}
          fill="none"
          stroke={`url(#${gradientId}-ghost2)`}
          strokeWidth={strokeWidth * 2}
        />
      </svg>

      {/* Ghost ring 3 - inner soft glow */}
      <svg
        className="absolute"
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        style={{ filter: "blur(15px)", opacity: 0.5 }}
      >
        <defs>
          <linearGradient id={`${gradientId}-ghost3`} x1="0%" y1="0%" x2="100%" y2="100%">
            {getStrokeGradient(0.8)}
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId}-ghost3)`}
          strokeWidth={strokeWidth * 1.5}
        />
      </svg>

      {/* Main ring with subtle pulsating */}
      <motion.svg
        className="absolute"
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        animate={!reducedMotion ? {
          scale: [1, 1.015, 1],
        } : {}}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {getStrokeGradient()}
          </linearGradient>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter="url(#ring-glow)"
        />
      </motion.svg>

      {/* Inner highlight ring */}
      <svg
        className="absolute"
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        style={{ opacity: 0.12 }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius - strokeWidth * 2}
          fill="none"
          stroke="white"
          strokeWidth={0.5}
        />
      </svg>

      {/* Content inside ring - with padding */}
      <div
        className="absolute flex flex-col items-center justify-center z-10"
        style={{
          width: (radius - contentPadding) * 2,
          height: (radius - contentPadding) * 2,
        }}
      >
        {/* Greeting (fades out as score fades in) */}
        <motion.div
          className="text-center px-4"
          animate={{
            opacity: showScore ? 0 : 1,
            y: showScore ? -10 : 0,
          }}
          transition={{ duration: 0.5 }}
        >
          {greeting && (
            <p className="text-xl md:text-2xl lg:text-3xl font-light text-white/90 leading-tight">
              {greeting}
            </p>
          )}
        </motion.div>

        {/* Score (fades in) */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
          animate={{
            opacity: showScore ? 1 : 0,
            y: showScore ? 0 : 10,
          }}
          transition={{ duration: 0.5, delay: showScore ? 0.2 : 0 }}
        >
          {label && (
            <p className="text-xs md:text-sm text-white/70 uppercase tracking-wider mb-1">
              {label}
            </p>
          )}
          {score !== undefined && (
            <p
              className="text-5xl md:text-6xl lg:text-7xl font-light"
              style={{ color: "hsl(142 71% 45%)" }}
            >
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
// Scroll-Reactive Ring Wrapper
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
