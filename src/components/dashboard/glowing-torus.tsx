"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// ============================================
// Vertex Shader - Passes position, normal, UV to fragment
// ============================================
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ============================================
// Fragment Shader - Static & Colorful
// ============================================
const fragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = dot(viewDirection, vNormal);

    // Sharp Halo Effect
    float glow = pow(1.0 - fresnel, 6.0);

    // Static Gradient: Deep Purple (Bottom) to Neon Cyan (Top)
    vec3 colorA = vec3(0.6, 0.0, 1.0); // Purple
    vec3 colorB = vec3(0.0, 1.0, 1.0); // Cyan
    vec3 finalColor = mix(colorA, colorB, vUv.y);

    // Output: Use glow as Alpha
    gl_FragColor = vec4(finalColor, glow * 1.5);
  }
`;

// ============================================
// Static Halo Torus - NO animation
// ============================================
function StaticHaloTorus() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  return (
    <mesh material={material}>
      <torusGeometry args={[2.5, 0.5, 64, 128]} />
    </mesh>
  );
}

// ============================================
// Scene - Static render with controlled Bloom
// ============================================
function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 12]} />
      <StaticHaloTorus />

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
// Main Component - Transparent Background
// ============================================
export function GlowingTorus() {
  return (
    <div className="fixed inset-0 w-full h-full -z-10 pointer-events-none">
      <Canvas
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
