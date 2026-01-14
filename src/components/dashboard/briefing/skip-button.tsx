"use client";

import { motion, MotionValue, useTransform } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface SkipButtonProps {
  scrollProgress: MotionValue<number>;
  onSkip: () => void;
}

export function SkipButton({ scrollProgress, onSkip }: SkipButtonProps) {
  // Fade out the button as user approaches the dashboard
  const opacity = useTransform(scrollProgress, [0, 0.8, 0.95], [1, 1, 0]);

  return (
    <motion.button
      style={{ opacity }}
      onClick={onSkip}
      className="fixed bottom-8 right-8 z-50 flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/20 transition-colors pointer-events-auto"
    >
      <span className="text-sm font-medium">Skip to Dashboard</span>
      <ChevronDown className="w-4 h-4" />
    </motion.button>
  );
}
