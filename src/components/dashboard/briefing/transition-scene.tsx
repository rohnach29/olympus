"use client";

import { MotionValue } from "framer-motion";
import { Scene } from "./scene";

interface TransitionSceneProps {
  opacity: MotionValue<number>;
}

export function TransitionScene({ opacity }: TransitionSceneProps) {
  return (
    <Scene backgroundVideo="/briefing/transition.mp4" opacity={opacity} />
  );
}
