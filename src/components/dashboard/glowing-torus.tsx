"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================
// Canvas-based Frame Scrollytelling
// ============================================

const TOTAL_FRAMES = 120;

// Generate frame paths
const framePaths = Array.from(
  { length: TOTAL_FRAMES },
  (_, i) => `/scrollytelling/f_${String(i + 1).padStart(3, "0")}.webp`
);

interface GlowingTorusProps {
  progress?: number;
}

export function GlowingTorus({ progress = 0 }: GlowingTorusProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const currentFrameRef = useRef(0);

  // Calculate current frame based on progress
  const currentFrame = Math.min(
    TOTAL_FRAMES - 1,
    Math.floor(progress * TOTAL_FRAMES)
  );

  // Draw frame to canvas
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imagesRef.current[frameIndex];

    if (canvas && ctx && img && img.complete) {
      // Set canvas size to match image (only once)
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      ctx.drawImage(img, 0, 0);
      currentFrameRef.current = frameIndex;
    }
  }, []);

  // Preload all frames
  useEffect(() => {
    let loadedCount = 0;
    const images: HTMLImageElement[] = [];

    framePaths.forEach((src, index) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        setLoadProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));

        if (loadedCount === TOTAL_FRAMES) {
          setLoaded(true);
          // Draw first frame once all loaded
          drawFrame(0);
        }
      };
      img.src = src;
      images[index] = img;
    });

    imagesRef.current = images;
  }, [drawFrame]);

  // Update canvas when progress changes
  useEffect(() => {
    if (loaded && currentFrame !== currentFrameRef.current) {
      drawFrame(currentFrame);
    }
  }, [currentFrame, loaded, drawFrame]);

  return (
    <div className="fixed inset-0 w-full h-full -z-10 pointer-events-none bg-[#050608]">
      {/* Canvas with scaling to fill viewport */}
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full"
        style={{
          objectFit: "cover",
          objectPosition: "center",
          // Scale up slightly to crop watermark and fill better
          transform: "scale(1.15)",
          transformOrigin: "center center",
        }}
      />

      {/* Vignette overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 80% at 43% 48%, transparent 30%, rgba(5,6,8,0.4) 70%, rgba(5,6,8,0.95) 100%)
          `,
        }}
      />

      {/* Top edge fade for header integration */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(5,6,8,0.8) 0%, transparent 100%)",
        }}
      />

      {/* Bottom edge fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(5,6,8,0.9) 0%, transparent 100%)",
        }}
      />

      {/* Loading indicator */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white/30 text-sm font-light tracking-wider">
            Loading {loadProgress}%
          </div>
        </div>
      )}
    </div>
  );
}
