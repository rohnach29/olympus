"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, MeshTransmissionMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// ============================================
// Ethereal Torus with Transmission Material
// ============================================
interface EtherealTorusProps {
  colorProgress: number;
}

function EtherealTorus({ colorProgress }: EtherealTorusProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerMeshRef = useRef<THREE.Mesh>(null);

  // Animate rotation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.02;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
    }
    if (innerMeshRef.current) {
      innerMeshRef.current.rotation.z = -state.clock.elapsedTime * 0.03;
    }
  });

  // Color interpolation
  const baseColor = colorProgress > 0.5
    ? new THREE.Color("#00ff88")
    : new THREE.Color("#00ffff");

  const accentColor = colorProgress > 0.5
    ? new THREE.Color("#40ffa0")
    : new THREE.Color("#8a2be2");

  return (
    <group>
      {/* Main torus with transmission material for glass effect */}
      <mesh ref={meshRef}>
        <torusGeometry args={[1.6, 0.35, 64, 128]} />
        <MeshTransmissionMaterial
          backside
          samples={16}
          thickness={0.5}
          chromaticAberration={0.2}
          anisotropy={0.3}
          distortion={0.5}
          distortionScale={0.5}
          temporalDistortion={0.1}
          iridescence={1}
          iridescenceIOR={1}
          iridescenceThicknessRange={[0, 1400]}
          color={baseColor}
          transmission={0.95}
          roughness={0.1}
          ior={1.5}
        />
      </mesh>

      {/* Inner glow ring */}
      <mesh ref={innerMeshRef}>
        <torusGeometry args={[1.6, 0.2, 32, 64]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer glow halo */}
      <mesh>
        <torusGeometry args={[1.6, 0.5, 32, 64]} />
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ============================================
// Text Overlay
// ============================================
interface TextOverlayProps {
  greeting: string;
  showScore: boolean;
  score: number;
}

function TextOverlay({ greeting, showScore, score }: TextOverlayProps) {
  return (
    <Html center>
      <div
        className="flex flex-col items-center justify-center pointer-events-none select-none"
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          textAlign: "center",
          minWidth: "280px",
        }}
      >
        {!showScore ? (
          <p
            className="text-white font-light tracking-wide"
            style={{
              fontSize: "1.5rem",
              opacity: 0.95,
              textShadow: "0 0 30px rgba(0, 255, 255, 0.4)",
            }}
          >
            {greeting}
          </p>
        ) : (
          <div className="flex flex-col items-center">
            <p
              className="text-white/70 uppercase tracking-widest"
              style={{ fontSize: "0.7rem", marginBottom: "0.25rem" }}
            >
              Sleep
            </p>
            <p
              className="font-light"
              style={{
                fontSize: "4rem",
                color: "#00FF88",
                textShadow: "0 0 40px rgba(0, 255, 136, 0.6)",
              }}
            >
              {score}
            </p>
            <p
              className="text-white/50"
              style={{ fontSize: "0.65rem", marginTop: "0.25rem" }}
            >
              Last night
            </p>
          </div>
        )}
      </div>
    </Html>
  );
}

// ============================================
// Scene
// ============================================
interface SceneProps {
  colorProgress: number;
  greeting: string;
  showScore: boolean;
  score: number;
}

function Scene({ colorProgress, greeting, showScore, score }: SceneProps) {
  return (
    <>
      <EtherealTorus colorProgress={colorProgress} />
      <TextOverlay greeting={greeting} showScore={showScore} score={score} />

      {/* Bloom post-processing */}
      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// ============================================
// Main Component
// ============================================
interface GlowingTorusProps {
  colorProgress?: number;
  greeting?: string;
  showScore?: boolean;
  score?: number;
  className?: string;
}

export function GlowingTorus({
  colorProgress = 0,
  greeting = "Good morning, Rohan",
  showScore = false,
  score = 85,
  className = "",
}: GlowingTorusProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{ background: "#050508" }}
      >
        <color attach="background" args={["#050508"]} />

        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={1} color="#00ffff" />
        <pointLight position={[-5, -5, 5]} intensity={0.5} color="#8a2be2" />
        <pointLight position={[0, 0, 3]} intensity={0.3} color="#00ff88" />

        <Scene
          colorProgress={colorProgress}
          greeting={greeting}
          showScore={showScore}
          score={score}
        />
      </Canvas>
    </div>
  );
}
