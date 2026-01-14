"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ============================================
// Types
// ============================================
type Scene = 1 | 2 | 3 | 4 | 5 | 6;
type RingColor = "neutral" | "green" | "orange" | "red";

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
// Utility functions
// ============================================
function getScoreColor(score: number): RingColor {
  if (score >= 75) return "green";
  if (score >= 50) return "orange";
  return "red";
}

function getColorHSL(color: RingColor): string {
  switch (color) {
    case "green":
      return "142 71% 45%";
    case "orange":
      return "25 95% 53%";
    case "red":
      return "0 84% 60%";
    default:
      return "221 83% 53%";
  }
}

// ============================================
// Ring Component (Ethereal hollow design)
// ============================================
interface RingProps {
  size: "normal" | "large";
  color: RingColor;
  isPremium?: boolean;
  isActive?: boolean;
  label?: string;
  score?: number;
  subtitle?: string;
  className?: string;
  reducedMotion: boolean;
}

function Ring({
  size,
  color,
  isPremium = false,
  isActive = true,
  label,
  score,
  subtitle,
  className = "",
  reducedMotion,
}: RingProps) {
  const dimensions = size === "large"
    ? { container: "w-52 h-52 md:w-64 md:h-64", svgSize: 256, strokeWidth: isPremium ? 8 : 6 }
    : { container: "w-40 h-40 md:w-48 md:h-48", svgSize: 192, strokeWidth: 5 };

  const colorHSL = getColorHSL(color);
  const radius = (dimensions.svgSize - dimensions.strokeWidth * 2) / 2;
  const center = dimensions.svgSize / 2;

  // Generate unique gradient ID
  const gradientId = `ring-gradient-${color}-${size}-${Math.random().toString(36).slice(2, 9)}`;

  // Iridescent gradient colors for neutral state
  const getGradientStops = () => {
    if (color === "neutral") {
      return (
        <>
          <stop offset="0%" stopColor="hsl(180 70% 50%)" stopOpacity={0.9} />
          <stop offset="25%" stopColor="hsl(200 80% 60%)" stopOpacity={0.85} />
          <stop offset="50%" stopColor="hsl(260 70% 65%)" stopOpacity={0.8} />
          <stop offset="75%" stopColor="hsl(300 60% 55%)" stopOpacity={0.75} />
          <stop offset="100%" stopColor="hsl(180 70% 50%)" stopOpacity={0.9} />
        </>
      );
    }
    // Solid color with slight variation for depth
    return (
      <>
        <stop offset="0%" stopColor={`hsl(${colorHSL})`} stopOpacity={0.95} />
        <stop offset="50%" stopColor={`hsl(${colorHSL})`} stopOpacity={1} />
        <stop offset="100%" stopColor={`hsl(${colorHSL})`} stopOpacity={0.95} />
      </>
    );
  };

  const glowIntensity = isActive ? (isPremium ? 1 : 0.7) : 0.3;

  return (
    <motion.div
      className={`relative flex items-center justify-center ${dimensions.container} ${className}`}
      animate={
        !reducedMotion && isActive
          ? {
              scale: [1, 1.02, 1],
            }
          : {}
      }
      transition={
        !reducedMotion
          ? {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }
          : {}
      }
    >
      {/* Outer glow layer (blurred duplicate) */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${dimensions.svgSize} ${dimensions.svgSize}`}
        style={{
          filter: `blur(${isPremium ? 20 : 15}px)`,
          opacity: glowIntensity * 0.6,
        }}
      >
        <defs>
          <linearGradient id={`${gradientId}-glow`} x1="0%" y1="0%" x2="100%" y2="100%">
            {getGradientStops()}
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId}-glow)`}
          strokeWidth={dimensions.strokeWidth * 3}
        />
      </svg>

      {/* Secondary glow layer */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${dimensions.svgSize} ${dimensions.svgSize}`}
        style={{
          filter: `blur(${isPremium ? 12 : 8}px)`,
          opacity: glowIntensity * 0.8,
        }}
      >
        <defs>
          <linearGradient id={`${gradientId}-glow2`} x1="0%" y1="100%" x2="100%" y2="0%">
            {getGradientStops()}
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId}-glow2)`}
          strokeWidth={dimensions.strokeWidth * 2}
        />
      </svg>

      {/* Main ring */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${dimensions.svgSize} ${dimensions.svgSize}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {getGradientStops()}
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={dimensions.strokeWidth}
          strokeLinecap="round"
        />
      </svg>

      {/* Inner subtle ring for depth */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${dimensions.svgSize} ${dimensions.svgSize}`}
        style={{ opacity: 0.3 }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius - dimensions.strokeWidth}
          fill="none"
          stroke="white"
          strokeWidth={1}
          opacity={0.2}
        />
      </svg>

      {/* Content overlay */}
      <AnimatePresence mode="wait">
        {label && (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center z-10"
          >
            <p className="text-xs md:text-sm text-white/70 uppercase tracking-wider mb-1">
              {label}
            </p>
            {score !== undefined && (
              <p
                className="text-4xl md:text-5xl font-light"
                style={{ color: `hsl(${colorHSL})` }}
              >
                {score}
              </p>
            )}
            {subtitle && (
              <p className="text-xs text-white/50 mt-1">{subtitle}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// Connector Component (Flowing energy wave)
// ============================================
interface ConnectorProps {
  isActive: boolean;
  reducedMotion: boolean;
}

function Connector({ isActive, reducedMotion }: ConnectorProps) {
  const connectorId = `connector-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 md:w-48 h-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.8 }}
    >
      {/* Outer glow layer */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 200 100"
        preserveAspectRatio="none"
        style={{
          filter: "blur(12px)",
          opacity: isActive ? 0.5 : 0.2,
        }}
      >
        <defs>
          <linearGradient id={`${connectorId}-glow`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(180 70% 50%)" stopOpacity={0.8} />
            <stop offset="50%" stopColor="hsl(200 80% 60%)" stopOpacity={0.9} />
            <stop offset="100%" stopColor="hsl(160 70% 55%)" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <path
          d="M 0 50 Q 50 20, 100 50 Q 150 80, 200 50"
          fill="none"
          stroke={`url(#${connectorId}-glow)`}
          strokeWidth={8}
          strokeLinecap="round"
        />
      </svg>

      {/* Secondary wave layer */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 200 100"
        preserveAspectRatio="none"
        style={{
          filter: "blur(6px)",
          opacity: isActive ? 0.6 : 0.3,
        }}
      >
        <defs>
          <linearGradient id={`${connectorId}-wave2`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(260 70% 65%)" stopOpacity={0.6} />
            <stop offset="50%" stopColor="hsl(200 75% 55%)" stopOpacity={0.8} />
            <stop offset="100%" stopColor="hsl(180 70% 50%)" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <path
          d="M 0 50 Q 50 70, 100 50 Q 150 30, 200 50"
          fill="none"
          stroke={`url(#${connectorId}-wave2)`}
          strokeWidth={4}
          strokeLinecap="round"
        />
      </svg>

      {/* Main wave line */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 200 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`${connectorId}-main`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(180 70% 50%)" stopOpacity={0.9} />
            <stop offset="30%" stopColor="hsl(200 80% 60%)" stopOpacity={1} />
            <stop offset="70%" stopColor="hsl(200 80% 60%)" stopOpacity={1} />
            <stop offset="100%" stopColor="hsl(160 70% 55%)" stopOpacity={0.9} />
          </linearGradient>
        </defs>
        <motion.path
          d="M 0 50 Q 50 30, 100 50 Q 150 70, 200 50"
          fill="none"
          stroke={`url(#${connectorId}-main)`}
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: isActive ? 1 : 0,
            opacity: isActive ? 1 : 0,
          }}
          transition={{
            duration: reducedMotion ? 0.2 : 1,
            ease: "easeInOut",
          }}
        />
      </svg>
    </motion.div>
  );
}

// ============================================
// Recommendation Card Component (Frosted glass)
// ============================================
interface RecommendationCardProps {
  title: string;
  body: string;
}

function RecommendationCard({ title, body }: RecommendationCardProps) {
  const cardId = `card-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mt-10 relative max-w-md mx-auto"
    >
      {/* Outer glow effect */}
      <div
        className="absolute -inset-1 rounded-3xl opacity-40"
        style={{
          background: `linear-gradient(135deg,
            hsl(180 60% 50% / 0.3) 0%,
            hsl(200 70% 55% / 0.2) 50%,
            hsl(260 60% 60% / 0.3) 100%
          )`,
          filter: "blur(20px)",
        }}
      />

      {/* Card border glow */}
      <svg
        className="absolute -inset-0.5 w-[calc(100%+4px)] h-[calc(100%+4px)]"
        style={{ filter: "blur(8px)", opacity: 0.5 }}
      >
        <defs>
          <linearGradient id={`${cardId}-border`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(180 70% 50%)" stopOpacity={0.6} />
            <stop offset="50%" stopColor="hsl(200 80% 60%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(260 70% 65%)" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="calc(100% - 4px)"
          height="calc(100% - 4px)"
          rx="24"
          ry="24"
          fill="none"
          stroke={`url(#${cardId}-border)`}
          strokeWidth="2"
        />
      </svg>

      {/* Main card */}
      <div
        className="relative px-6 py-5 rounded-3xl"
        style={{
          background: `linear-gradient(135deg,
            hsl(180 30% 20% / 0.15) 0%,
            hsl(200 25% 15% / 0.2) 50%,
            hsl(180 30% 18% / 0.15) 100%
          )`,
          backdropFilter: "blur(20px)",
          border: "1px solid hsl(180 50% 60% / 0.15)",
          boxShadow: `
            inset 0 1px 0 0 hsl(180 50% 80% / 0.1),
            inset 0 -1px 0 0 hsl(0 0% 0% / 0.2)
          `,
        }}
      >
        <p className="text-xs text-white/60 uppercase tracking-wider mb-2">
          {title}
        </p>
        <p className="text-white/90 leading-relaxed">{body}</p>
      </div>
    </motion.div>
  );
}

// ============================================
// Scene Stage Component
// ============================================
interface SceneStageProps {
  scene: Scene;
  userName: string;
  sleepScore: number;
  recoveryScore: number;
  readinessScore: number;
  recommendationText: string;
  reducedMotion: boolean;
}

function SceneStage({
  scene,
  userName,
  sleepScore,
  recoveryScore,
  readinessScore,
  recommendationText,
  reducedMotion,
}: SceneStageProps) {
  const sleepColor = getScoreColor(sleepScore);
  const recoveryColor = getScoreColor(recoveryScore);
  const readinessColor = getScoreColor(readinessScore);

  const transitionDuration = reducedMotion ? 0.15 : 0.5;
  const transitionEase = [0.4, 0, 0.2, 1] as const;

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-4">
      {/* Scene 1: Greeting */}
      <AnimatePresence mode="wait">
        {scene === 1 && (
          <motion.div
            key="scene1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: transitionDuration, ease: transitionEase }}
            className="flex flex-col items-center"
          >
            <Ring
              size="normal"
              color="neutral"
              reducedMotion={reducedMotion}
            />
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: transitionDuration }}
              className="mt-8 text-2xl md:text-3xl font-light text-white/90"
            >
              Good morning, {userName}
            </motion.h1>
          </motion.div>
        )}

        {/* Scene 2: Sleep reveal */}
        {scene === 2 && (
          <motion.div
            key="scene2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: transitionDuration, ease: transitionEase }}
            className="flex flex-col items-center"
          >
            <Ring
              size="normal"
              color={sleepColor}
              label="Sleep"
              score={sleepScore}
              subtitle="Last night"
              reducedMotion={reducedMotion}
            />
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: transitionDuration }}
              className="mt-8 text-2xl md:text-3xl font-light text-white/90"
            >
              Good morning, {userName}
            </motion.h1>
          </motion.div>
        )}

        {/* Scene 3: Split into 2 bubbles */}
        {scene === 3 && (
          <motion.div
            key="scene3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: transitionDuration, ease: transitionEase }}
            className="flex flex-col items-center"
          >
            <div className="relative flex items-center justify-center gap-16 md:gap-24">
              <motion.div
                initial={{ x: 0 }}
                animate={{ x: 0 }}
                transition={{ duration: transitionDuration, ease: transitionEase }}
              >
                <Ring
                  size="normal"
                  color={sleepColor}
                  label="Sleep"
                  score={sleepScore}
                  subtitle="Last night"
                  reducedMotion={reducedMotion}
                />
              </motion.div>

              <Connector isActive={false} reducedMotion={reducedMotion} />

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: reducedMotion ? 0.15 : 0.6,
                  ease: transitionEase,
                }}
              >
                <Ring
                  size="normal"
                  color="neutral"
                  isActive={false}
                  reducedMotion={reducedMotion}
                />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Scene 4: Recovery reveal */}
        {scene === 4 && (
          <motion.div
            key="scene4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: transitionDuration, ease: transitionEase }}
            className="flex flex-col items-center"
          >
            <div className="relative flex items-center justify-center gap-16 md:gap-24">
              <Ring
                size="normal"
                color={sleepColor}
                label="Sleep"
                score={sleepScore}
                subtitle="Last night"
                reducedMotion={reducedMotion}
              />

              <Connector isActive={true} reducedMotion={reducedMotion} />

              <Ring
                size="normal"
                color={recoveryColor}
                label="Recovery"
                score={recoveryScore}
                reducedMotion={reducedMotion}
              />
            </div>
          </motion.div>
        )}

        {/* Scene 5: Merge into Readiness */}
        {scene === 5 && (
          <motion.div
            key="scene5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: transitionDuration, ease: transitionEase }}
            className="flex flex-col items-center"
          >
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
              animate={reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              transition={{
                duration: reducedMotion ? 0.15 : 0.7,
                ease: [0.34, 1.56, 0.64, 1],
              }}
            >
              <Ring
                size="large"
                color={readinessColor}
                isPremium
                label="Readiness"
                score={readinessScore}
                subtitle="Ready for today"
                reducedMotion={reducedMotion}
              />
            </motion.div>
          </motion.div>
        )}

        {/* Scene 6: Recommendation */}
        {scene === 6 && (
          <motion.div
            key="scene6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: transitionDuration, ease: transitionEase }}
            className="flex flex-col items-center"
          >
            <Ring
              size="large"
              color={readinessColor}
              isPremium
              label="Readiness"
              score={readinessScore}
              subtitle="Ready for today"
              reducedMotion={reducedMotion}
            />
            <RecommendationCard
              title="Today's Recommendation"
              body={recommendationText}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const [currentScene, setCurrentScene] = useState<Scene>(1);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Intersection observer for scene detection
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionRefs.current.forEach((section, index) => {
      if (!section) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setCurrentScene((index + 1) as Scene);
            }
          });
        },
        {
          threshold: 0.6,
          rootMargin: "-20% 0px -20% 0px",
        }
      );

      observer.observe(section);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  // Handle completion when scene 6 is reached
  useEffect(() => {
    if (currentScene === 6) {
      const timer = setTimeout(() => {
        onComplete();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScene, onComplete]);

  const setSectionRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      sectionRefs.current[index] = el;
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className="relative bg-[hsl(0_0%_7%)]"
      style={{ isolation: "isolate" }}
    >
      {/* Skip button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={onSkip}
        className="fixed top-6 right-6 z-50 px-4 py-2 text-sm text-white/60 hover:text-white/90
                   bg-white/5 hover:bg-white/10 rounded-full border border-white/10
                   transition-colors duration-200"
      >
        Skip
      </motion.button>

      {/* Scene indicator */}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        {[1, 2, 3, 4, 5, 6].map((scene) => (
          <motion.div
            key={scene}
            className="w-2 h-2 rounded-full"
            animate={{
              backgroundColor:
                currentScene >= scene
                  ? "hsl(0 0% 100% / 0.8)"
                  : "hsl(0 0% 100% / 0.2)",
              scale: currentScene === scene ? 1.3 : 1,
            }}
            transition={{ duration: 0.2 }}
          />
        ))}
      </div>

      {/* Sticky stage */}
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <SceneStage
          scene={currentScene}
          userName={userName}
          sleepScore={sleepScore}
          recoveryScore={recoveryScore}
          readinessScore={readinessScore}
          recommendationText={recommendationText}
          reducedMotion={prefersReducedMotion}
        />
      </div>

      {/* Scroll track - invisible sections that trigger scene changes */}
      <div className="relative" style={{ marginTop: "-100vh" }}>
        {[1, 2, 3, 4, 5, 6].map((scene) => (
          <div
            key={scene}
            ref={setSectionRef(scene - 1)}
            className="h-screen"
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Continue indicator at bottom of last scene */}
      {currentScene === 6 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
        >
          <button
            onClick={onComplete}
            className="flex flex-col items-center gap-2 text-white/60 hover:text-white/90 transition-colors"
          >
            <span className="text-sm">Continue to Dashboard</span>
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
          </button>
        </motion.div>
      )}
    </div>
  );
}
