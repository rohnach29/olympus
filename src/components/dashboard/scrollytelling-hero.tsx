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
// Mist Particle Component (Orbiting)
// ============================================
interface MistParticleProps {
  index: number;
  ringRadius: number;
  colorProgress: number; // 0 = iridescent, 1 = green
  reducedMotion: boolean;
}

function MistParticle({ index, ringRadius, colorProgress, reducedMotion }: MistParticleProps) {
  const particleCount = 12;
  const baseAngle = (index / particleCount) * 360;
  const duration = 12 + (index % 5) * 3; // 12-24 seconds for slow orbit
  const size = 60 + (index % 4) * 30; // 60-150px for large misty effect
  const blur = 25 + (index % 3) * 15; // 25-55px blur for soft mist

  // Iridescent colors
  const iridescentColors = [
    "hsl(180 70% 50%)", // cyan
    "hsl(200 80% 55%)", // blue
    "hsl(260 70% 60%)", // purple
    "hsl(300 60% 55%)", // pink
    "hsl(160 70% 50%)", // teal
    "hsl(220 75% 58%)", // indigo
  ];
  const greenColor = "hsl(142 71% 45%)";

  // Smoothly interpolate color based on progress
  const baseColor = iridescentColors[index % iridescentColors.length];
  const currentColor = colorProgress > 0.5 ? greenColor : baseColor;
  const opacity = 0.35 + (1 - Math.min(colorProgress, 0.7)) * 0.25;

  // For reduced motion, just show static positioned particles
  if (reducedMotion) {
    const x = Math.cos((baseAngle * Math.PI) / 180) * ringRadius;
    const y = Math.sin((baseAngle * Math.PI) / 180) * ringRadius;
    return (
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, ${currentColor} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity: opacity * 0.5,
          left: `calc(50% + ${x}px - ${size / 2}px)`,
          top: `calc(50% + ${y}px - ${size / 2}px)`,
        }}
      />
    );
  }

  // Use CSS animation for smooth orbital motion
  const animationStyle = {
    animation: `orbit-${index % 2 === 0 ? 'cw' : 'ccw'} ${duration}s linear infinite`,
    animationDelay: `${-index * 1.5}s`,
  };

  return (
    <div
      className="absolute"
      style={{
        width: ringRadius * 2,
        height: ringRadius * 2,
        left: `calc(50% - ${ringRadius}px)`,
        top: `calc(50% - ${ringRadius}px)`,
        ...animationStyle,
      }}
    >
      <div
        className="absolute rounded-full transition-all duration-700"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, ${currentColor} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity,
          left: `calc(50% + ${ringRadius}px - ${size / 2}px)`,
          top: `calc(50% - ${size / 2}px)`,
          transform: `rotate(-${baseAngle}deg)`, // Counter-rotate to keep glow oriented
        }}
      />
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
  const ringSize = 320; // Much bigger ring
  const strokeWidth = 12; // Thicker stroke
  const radius = (ringSize - strokeWidth * 2) / 2;
  const center = ringSize / 2;
  const gradientId = "main-ring-gradient";

  // Smooth spring for color transitions
  const springConfig = { stiffness: 100, damping: 30 };
  const smoothProgress = useSpring(colorProgress, springConfig);

  // Calculate interpolated colors based on progress
  const getStrokeGradient = () => {
    // When progress is 0, show full iridescent
    // When progress is 1, show solid green
    if (colorProgress < 0.3) {
      return (
        <>
          <stop offset="0%" stopColor="hsl(180 70% 50%)" stopOpacity={0.95} />
          <stop offset="20%" stopColor="hsl(200 80% 55%)" stopOpacity={0.9} />
          <stop offset="40%" stopColor="hsl(240 70% 60%)" stopOpacity={0.85} />
          <stop offset="60%" stopColor="hsl(280 65% 58%)" stopOpacity={0.85} />
          <stop offset="80%" stopColor="hsl(320 60% 55%)" stopOpacity={0.9} />
          <stop offset="100%" stopColor="hsl(180 70% 50%)" stopOpacity={0.95} />
        </>
      );
    } else if (colorProgress < 0.7) {
      // Transitioning - mix of colors shifting to green
      const greenMix = (colorProgress - 0.3) / 0.4; // 0 to 1 during this phase
      return (
        <>
          <stop offset="0%" stopColor={`hsl(${160 - greenMix * 20} ${70 + greenMix * 10}% ${50 - greenMix * 5}%)`} stopOpacity={0.95} />
          <stop offset="25%" stopColor={`hsl(${180 - greenMix * 40} ${75 + greenMix * 5}% ${52 - greenMix * 7}%)`} stopOpacity={0.9} />
          <stop offset="50%" stopColor={`hsl(${200 - greenMix * 60} ${70 + greenMix * 10}% ${50 - greenMix * 5}%)`} stopOpacity={0.9} />
          <stop offset="75%" stopColor={`hsl(${170 - greenMix * 30} ${72 + greenMix * 8}% ${48 - greenMix * 3}%)`} stopOpacity={0.9} />
          <stop offset="100%" stopColor={`hsl(${160 - greenMix * 20} ${70 + greenMix * 10}% ${50 - greenMix * 5}%)`} stopOpacity={0.95} />
        </>
      );
    } else {
      // Full green
      return (
        <>
          <stop offset="0%" stopColor="hsl(142 76% 42%)" stopOpacity={0.95} />
          <stop offset="50%" stopColor="hsl(142 71% 45%)" stopOpacity={1} />
          <stop offset="100%" stopColor="hsl(142 76% 42%)" stopOpacity={0.95} />
        </>
      );
    }
  };

  // Glow color based on progress
  const glowColor = colorProgress > 0.7
    ? "hsl(142 71% 45%)"
    : colorProgress > 0.3
      ? `hsl(${180 - colorProgress * 40} 70% 50%)`
      : "hsl(200 75% 55%)";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: ringSize, height: ringSize }}
    >
      {/* Mist particles container */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ width: ringSize, height: ringSize }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <MistParticle
            key={i}
            index={i}
            ringRadius={radius}
            colorProgress={colorProgress}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      {/* Outer diffuse glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: ringSize + 100,
          height: ringSize + 100,
          background: `radial-gradient(circle, ${glowColor}20 0%, ${glowColor}10 30%, transparent 70%)`,
          filter: "blur(40px)",
        }}
        animate={!reducedMotion ? {
          scale: [1, 1.05, 1],
          opacity: [0.6, 0.8, 0.6],
        } : {}}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary glow layer */}
      <svg
        className="absolute"
        width={ringSize + 60}
        height={ringSize + 60}
        viewBox={`0 0 ${ringSize + 60} ${ringSize + 60}`}
        style={{
          filter: "blur(25px)",
          opacity: 0.5,
        }}
      >
        <defs>
          <linearGradient id={`${gradientId}-glow`} x1="0%" y1="0%" x2="100%" y2="100%">
            {getStrokeGradient()}
          </linearGradient>
        </defs>
        <circle
          cx={(ringSize + 60) / 2}
          cy={(ringSize + 60) / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId}-glow)`}
          strokeWidth={strokeWidth * 4}
        />
      </svg>

      {/* Main ring with pulsating effect */}
      <motion.svg
        className="absolute"
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        animate={!reducedMotion ? {
          scale: [1, 1.02, 1],
        } : {}}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {getStrokeGradient()}
          </linearGradient>
          {/* Glow filter */}
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
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

      {/* Inner subtle highlight ring */}
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
          r={radius - strokeWidth * 1.5}
          fill="none"
          stroke="white"
          strokeWidth={1}
        />
      </svg>

      {/* Content inside ring */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        {/* Greeting (fades out as score fades in) */}
        <motion.div
          className="text-center"
          animate={{
            opacity: showScore ? 0 : 1,
            y: showScore ? -10 : 0,
          }}
          transition={{ duration: 0.5 }}
        >
          {greeting && (
            <p className="text-2xl md:text-3xl font-light text-white/90">
              {greeting}
            </p>
          )}
        </motion.div>

        {/* Score (fades in) */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
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
              className="text-5xl md:text-6xl font-light"
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
}

function DynamicBackground({ colorProgress }: DynamicBackgroundProps) {
  // Background shifts from iridescent tinge to green tinge
  const bgColor1 = colorProgress > 0.5
    ? "hsl(142 50% 8%)"
    : "hsl(200 40% 8%)";
  const bgColor2 = colorProgress > 0.5
    ? "hsl(142 30% 5%)"
    : "hsl(260 30% 6%)";
  const accentColor = colorProgress > 0.5
    ? "hsl(142 60% 20%)"
    : "hsl(200 50% 15%)";

  return (
    <div className="fixed inset-0 -z-10">
      {/* Base gradient */}
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{
          background: `
            radial-gradient(ellipse at 30% 20%, ${accentColor}15 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, ${bgColor2} 0%, transparent 60%),
            radial-gradient(ellipse at 50% 50%, ${bgColor1} 0%, hsl(0 0% 4%) 100%)
          `,
        }}
      />

      {/* Ambient glow spots */}
      <motion.div
        className="absolute w-96 h-96 rounded-full opacity-20"
        style={{
          background: colorProgress > 0.5
            ? "radial-gradient(circle, hsl(142 60% 30%) 0%, transparent 70%)"
            : "radial-gradient(circle, hsl(200 60% 30%) 0%, transparent 70%)",
          filter: "blur(60px)",
          top: "10%",
          left: "20%",
        }}
        animate={{
          x: [0, 30, 0],
          y: [0, 20, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute w-80 h-80 rounded-full opacity-15"
        style={{
          background: colorProgress > 0.5
            ? "radial-gradient(circle, hsl(160 50% 25%) 0%, transparent 70%)"
            : "radial-gradient(circle, hsl(280 50% 25%) 0%, transparent 70%)",
          filter: "blur(50px)",
          bottom: "15%",
          right: "15%",
        }}
        animate={{
          x: [0, -20, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
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
}

function ScrollReactiveBackground({ colorProgress }: ScrollReactiveBackgroundProps) {
  const [progress, setProgress] = useState(0);

  useMotionValueEvent(colorProgress, "change", (latest) => {
    setProgress(latest);
  });

  return <DynamicBackground colorProgress={progress} />;
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
      {/* Dynamic background */}
      <ScrollReactiveBackground colorProgress={scene1to2Progress} />

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
