"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";

// ============================================
// Vertex Shader - Passes world position for angular color mapping
// ============================================
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ============================================
// Fragment Shader - Dark Ethereal with Angular Gradient + Grain
// ============================================
const fragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // Simple hash function for film grain
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = dot(viewDirection, vNormal);

    // Softer glow - reduced power for diffuse edges
    float glow = pow(1.0 - fresnel, 3.0);

    // Calculate angle around the torus center (XY plane)
    // atan returns -PI to PI, we normalize to 0-1
    float angle = atan(vWorldPosition.y, vWorldPosition.x);
    float t = (angle + 3.14159) / (2.0 * 3.14159);

    // Dark, muted color palette matching the target aesthetic
    vec3 colorPurple = vec3(0.25, 0.08, 0.35);   // Right side - dark violet
    vec3 colorTeal   = vec3(0.05, 0.25, 0.28);   // Top - dark teal/cyan
    vec3 colorGreen  = vec3(0.08, 0.22, 0.15);   // Left side - dark mint/green
    vec3 colorBlue   = vec3(0.08, 0.12, 0.25);   // Bottom - dark blue

    // Smooth multi-stop gradient around the ring
    // smoothstep provides smooth interpolation between color stops
    vec3 color;
    if (t < 0.25) {
      color = mix(colorPurple, colorTeal, smoothstep(0.0, 0.25, t));
    } else if (t < 0.5) {
      color = mix(colorTeal, colorGreen, smoothstep(0.25, 0.5, t));
    } else if (t < 0.75) {
      color = mix(colorGreen, colorBlue, smoothstep(0.5, 0.75, t));
    } else {
      color = mix(colorBlue, colorPurple, smoothstep(0.75, 1.0, t));
    }

    // Add subtle film grain for cinematic texture
    float grain = hash(gl_FragCoord.xy * 0.5) * 0.06 - 0.03;
    color += vec3(grain);

    // Output with softer alpha (no multiplier boost)
    float alpha = glow * 0.9;
    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================
// Ethereal Torus - Tilted for 3D depth
// ============================================
function EtherealTorus() {
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
    // Slight tilt: X rotation for forward lean, Z for subtle angle
    <mesh material={material} rotation={[0.3, 0, 0.1]}>
      {/* Larger radius (2.8), thinner tube (0.35) for elegant look */}
      <torusGeometry args={[2.8, 0.35, 64, 128]} />
    </mesh>
  );
}

// ============================================
// Scene - Dark background with soft post-processing
// ============================================
function Scene() {
  return (
    <>
      {/* Dark background - nearly black with subtle blue tint */}
      <color attach="background" args={["#0a0b0f"]} />

      <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={50} />
      <EtherealTorus />

      <EffectComposer>
        {/* Reduced bloom for soft glow instead of blown-out effect */}
        <Bloom
          luminanceThreshold={0.4}
          luminanceSmoothing={0.95}
          intensity={0.3}
          mipmapBlur
        />
        {/* Film grain overlay for cinematic texture */}
        <Noise
          premultiply
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={0.12}
        />
      </EffectComposer>
    </>
  );
}

// ============================================
// Main Component - Full-screen dark background
// ============================================
export function GlowingTorus() {
  return (
    <div className="fixed inset-0 w-full h-full -z-10 pointer-events-none">
      <Canvas
        gl={{
          alpha: false, // Opaque background (not transparent)
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
