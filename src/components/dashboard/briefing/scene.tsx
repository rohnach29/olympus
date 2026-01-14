"use client";

import { motion, MotionValue } from "framer-motion";
import { ReactNode } from "react";

interface SceneProps {
  children?: ReactNode;
  backgroundImage?: string;
  backgroundVideo?: string;
  opacity: MotionValue<number>;
  className?: string;
}

export function Scene({
  children,
  backgroundImage,
  backgroundVideo,
  opacity,
  className = "",
}: SceneProps) {
  return (
    <motion.div
      style={{ opacity }}
      className={`fixed inset-0 w-full h-screen pointer-events-none ${className}`}
    >
      {/* Background Image */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}

      {/* Background Video */}
      {backgroundVideo && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={backgroundVideo} type="video/mp4" />
        </video>
      )}

      {/* Content Overlay */}
      {children && (
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          {children}
        </div>
      )}
    </motion.div>
  );
}
