"use client";

import { MotionValue } from "framer-motion";
import { Scene } from "./scene";
import { AnimatedScore } from "./animated-score";

interface RecoverySceneProps {
  recoveryScore: number;
  opacity: MotionValue<number>;
}

export function RecoveryScene({ recoveryScore, opacity }: RecoverySceneProps) {
  return (
    <Scene backgroundImage="/briefing/recovery.png" opacity={opacity}>
      <div className="text-center relative">
        {/* Score display positioned to match the image layout */}
        <div className="flex flex-col items-center">
          <AnimatedScore
            value={recoveryScore}
            className="text-[120px] md:text-[180px] font-bold text-white leading-none"
          />
          <span className="text-lg md:text-xl text-white/70 uppercase tracking-[0.3em] mt-2">
            Recovery Score
          </span>
        </div>
      </div>
    </Scene>
  );
}
