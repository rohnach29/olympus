"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Float } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// ============================================
// Vertex Shader
// ============================================
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ============================================
// Fragment Shader - Holographic Ghostly Ring
// ============================================
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uColorProgress;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    // Calculate view direction
    vec3 viewDirection = normalize(vViewPosition);

    // Fresnel effect: dot product of view and normal
    float fresnel = dot(viewDirection, vNormal);

    // Invert so edges are bright, center is transparent
    float glow = pow(1.0 - fresnel, 3.0);

    // Color gradient: Cyan to Purple based on UV + slow time
    vec3 cyan = vec3(0.0, 1.0, 1.0);
    vec3 purple = vec3(0.6, 0.2, 1.0);
    vec3 lime = vec3(0.2, 1.0, 0.4);

    // Animate color position
    float colorPos = vUv.x + uTime * 0.1;
    colorPos = fract(colorPos); // Keep in 0-1 range

    // Mix colors based on progress
    vec3 color;
    if (uColorProgress < 0.5) {
      // Cyan to Purple gradient
      color = mix(cyan, purple, colorPos);
    } else {
      // Transition to green
      float greenMix = (uColorProgress - 0.5) * 2.0;
      vec3 baseColor = mix(cyan, purple, colorPos);
      color = mix(baseColor, lime, greenMix);
    }

    // Boost color intensity for bloom
    color *= 1.5;

    // Use glow as alpha - edges visible, center transparent
    gl_FragColor = vec4(color, glow);
  }
`;

// ============================================
// Holographic Torus
// ============================================
interface HolographicTorusProps {
  colorProgress: number;
}

function HolographicTorus({ colorProgress }: HolographicTorusProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColorProgress: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  // Animate
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uColorProgress.value = colorProgress;
  });

  return (
    <Float
      speed={2}
      rotationIntensity={0.2}
      floatIntensity={0.3}
    >
      <mesh ref={meshRef} material={material}>
        <torusGeometry args={[1.8, 0.4, 64, 128]} />
      </mesh>
    </Float>
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
              textShadow: "0 0 30px rgba(0, 255, 255, 0.5)",
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
// Scene - No lights needed, color from shader math
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
      <HolographicTorus colorProgress={colorProgress} />
      <TextOverlay greeting={greeting} showScore={showScore} score={score} />

      {/* Bloom with high intensity and zero threshold */}
      <EffectComposer>
        <Bloom
          intensity={2.0}
          luminanceThreshold={0}
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
        style={{ background: "#030305" }}
      >
        <color attach="background" args={["#030305"]} />

        {/* No lights - color comes from shader math */}

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
