"use client";

import { MotionValue, motion } from "framer-motion";
import { Scene } from "./scene";
import { AnimatedScore } from "./animated-score";

interface ReadinessSceneProps {
  readinessScore: number;
  opacity: MotionValue<number>;
}

export function ReadinessScene({ readinessScore, opacity }: ReadinessSceneProps) {
  return (
    <Scene backgroundImage="/briefing/readiness.png" opacity={opacity}>
      <div className="text-center relative w-full h-full">
        {/* Content positioned to match the image layout */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center">
            {/* Main score */}
            <AnimatedScore
              value={readinessScore}
              className="text-[100px] md:text-[150px] font-bold text-white leading-none"
            />
            <span className="text-lg md:text-xl text-white/70 uppercase tracking-[0.3em] mt-2">
              Readiness Score
            </span>
            
            {/* Glassmorphism recommendation card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-8 md:mt-12 backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl px-8 py-6 max-w-sm"
            >
              <div className="text-left">
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
                  Recommended Workout
                </span>
                <h3 className="text-xl md:text-2xl font-semibold text-white mt-2">
                  High Intensity Training
                </h3>
                <p className="text-white/60 text-sm mt-2">
                  Your body is well recovered. Push yourself today.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Scene>
  );
}
