"use client";

import { MotionValue, motion } from "framer-motion";
import { Scene } from "./scene";

interface IntroSceneProps {
  userName: string;
  opacity: MotionValue<number>;
}

export function IntroScene({ userName, opacity }: IntroSceneProps) {
  return (
    <Scene backgroundImage="/briefing/intro.png" opacity={opacity}>
      <div className="text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl md:text-7xl font-light text-white tracking-wide"
        >
          Good morning,
        </motion.h1>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-6xl md:text-8xl font-semibold text-white mt-4 tracking-tight"
        >
          {userName}
        </motion.h2>
      </div>
    </Scene>
  );
}
