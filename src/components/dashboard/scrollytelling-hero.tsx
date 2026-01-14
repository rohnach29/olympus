"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ============================================
// Types
// ============================================
type Scene = 1 | 2 | 3 | 4 | 5 | 6;
type BubbleColor = "neutral" | "green" | "orange" | "red";

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
function getScoreColor(score: number): BubbleColor {
  if (score >= 75) return "green";
  if (score >= 50) return "orange";
  return "red";
}

function getColorHSL(color: BubbleColor): string {
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
// Bubble Component
// ============================================
interface BubbleProps {
  size: "normal" | "large";
  color: BubbleColor;
  isPremium?: boolean;
  isActive?: boolean;
  label?: string;
  score?: number;
  subtitle?: string;
  className?: string;
  reducedMotion: boolean;
}

function Bubble({
  size,
  color,
  isPremium = false,
  isActive = true,
  label,
  score,
  subtitle,
  className = "",
  reducedMotion,
}: BubbleProps) {
  const sizeClass = size === "large" ? "w-52 h-52 md:w-64 md:h-64" : "w-40 h-40 md:w-48 md:h-48";
  const colorHSL = getColorHSL(color);
  const glowOpacity = isActive ? (isPremium ? 0.5 : 0.35) : 0.15;

  return (
    <motion.div
      className={`relative rounded-full flex flex-col items-center justify-center ${sizeClass} ${className}`}
      style={{
        background: isPremium
          ? `
            radial-gradient(ellipse at 25% 25%, hsl(0 0% 100% / 0.25) 0%, hsl(0 0% 100% / 0.08) 25%, transparent 60%),
            radial-gradient(ellipse at 75% 75%, hsl(262 83% 58% / 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, hsl(0 0% 10% / 0.95) 0%, hsl(0 0% 7% / 0.9) 100%)
          `
          : `
            radial-gradient(ellipse at 30% 30%, hsl(0 0% 100% / 0.2) 0%, hsl(0 0% 100% / 0.05) 30%, transparent 70%),
            radial-gradient(ellipse at 70% 80%, hsl(0 0% 100% / 0.1) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, hsl(0 0% 10% / 0.9) 0%, hsl(0 0% 7% / 0.8) 100%)
          `,
        boxShadow: `
          0 0 ${isPremium ? "60px" : "40px"} ${isPremium ? "20px" : "10px"} hsl(${colorHSL} / ${glowOpacity}),
          0 0 ${isPremium ? "100px" : "80px"} ${isPremium ? "40px" : "20px"} hsl(${colorHSL} / ${glowOpacity * 0.5}),
          inset 0 0 ${isPremium ? "30px" : "20px"} ${isPremium ? "10px" : "5px"} hsl(0 0% 100% / 0.1),
          inset 0 -20px 40px -20px hsl(0 0% 0% / 0.3)
        `,
        border: `1px solid hsl(0 0% 100% / ${isPremium ? 0.2 : 0.15})`,
      }}
      animate={
        !reducedMotion && isActive
          ? {
              scale: [1, 1.02, 1],
              filter: ["brightness(1)", "brightness(1.05)", "brightness(1)"],
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
      {/* Inner content */}
      <AnimatePresence mode="wait">
        {label && (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.3 }}
            className="text-center"
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
// Connector Component
// ============================================
interface ConnectorProps {
  isActive: boolean;
  reducedMotion: boolean;
}

function Connector({ isActive, reducedMotion }: ConnectorProps) {
  return (
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 md:w-32 h-0.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.5 }}
      style={{
        background: `linear-gradient(
          90deg,
          transparent 0%,
          hsl(0 0% 100% / ${isActive ? 0.3 : 0.1}) 20%,
          hsl(0 0% 100% / ${isActive ? 0.5 : 0.2}) 50%,
          hsl(0 0% 100% / ${isActive ? 0.3 : 0.1}) 80%,
          transparent 100%
        )`,
      }}
    />
  );
}

// ============================================
// Recommendation Card Component
// ============================================
interface RecommendationCardProps {
  title: string;
  body: string;
}

function RecommendationCard({ title, body }: RecommendationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mt-8 px-6 py-4 rounded-2xl max-w-md mx-auto"
      style={{
        background: "hsl(0 0% 100% / 0.05)",
        backdropFilter: "blur(10px)",
        border: "1px solid hsl(0 0% 100% / 0.1)",
      }}
    >
      <p className="text-xs text-white/50 uppercase tracking-wider mb-1">
        {title}
      </p>
      <p className="text-white/90">{body}</p>
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
            <Bubble
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
            <Bubble
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
                <Bubble
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
                <Bubble
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
              <Bubble
                size="normal"
                color={sleepColor}
                label="Sleep"
                score={sleepScore}
                subtitle="Last night"
                reducedMotion={reducedMotion}
              />

              <Connector isActive={true} reducedMotion={reducedMotion} />

              <Bubble
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
              <Bubble
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
            <Bubble
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
