"use client";

import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

// ============================================
// Vertex Shader
// ============================================
const vertexShader = /* glsl */ `
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ============================================
// Fragment Shader - Simple test
// ============================================
const fragmentShader = /* glsl */ `
  varying vec3 vNormal;

  void main() {
    // Just output a solid bright color
    gl_FragColor = vec4(0.5, 0.2, 0.8, 1.0);
  }
`;

// ============================================
// Ethereal Torus Component
// ============================================
function EtherealTorus() {
  return (
    <mesh rotation={[0.3, 0, 0.1]}>
      <torusGeometry args={[2.8, 0.4, 64, 128]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
}

// ============================================
// Scene
// ============================================
function Scene() {
  return (
    <>
      <color attach="background" args={["#0a0b0f"]} />
      <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={50} />
      <EtherealTorus />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={0.8}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// ============================================
// Main Component
// ============================================
export function GlowingTorus() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="fixed inset-0 w-full h-full -z-10 pointer-events-none bg-[#0a0b0f]" />;
  }

  return (
    <div className="fixed inset-0 w-full h-full -z-10 pointer-events-none">
      <Canvas
        gl={{
          alpha: false,
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
