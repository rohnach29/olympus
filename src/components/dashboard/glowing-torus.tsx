"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
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
// Fragment Shader - Ethereal Gaseous Halo
// Spectral: transparent center, glowing edges
// Emissive: light emanates from within, not reflected
// ============================================
const fragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = dot(viewDirection, vNormal);

    // Very soft, gaseous falloff - low power for gradual transition
    // This creates the "could put my hand through it" feel
    float glow = pow(1.0 - fresnel, 2.0);

    // Add a secondary softer outer glow layer for misty atmosphere
    float outerGlow = pow(1.0 - fresnel, 1.2) * 0.4;

    // Calculate angle around the torus center
    float angle = atan(vWorldPosition.y, vWorldPosition.x);
    float t = (angle + 3.14159) / (2.0 * 3.14159);

    // Luminous, emissive color palette - brighter for internal glow effect
    // These are "neon gas" / "bioluminescent" colors
    vec3 colorPurple = vec3(0.5, 0.2, 0.7);    // Glowing violet
    vec3 colorTeal   = vec3(0.2, 0.6, 0.6);    // Luminous teal
    vec3 colorGreen  = vec3(0.2, 0.5, 0.4);    // Ethereal mint
    vec3 colorBlue   = vec3(0.2, 0.35, 0.6);   // Soft azure

    // Smooth gradient around the ring
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

    // Boost color intensity for emissive/luminous appearance
    // This makes the light appear to come FROM the surface
    color *= 1.3;

    // Combine main glow with outer atmospheric glow
    float totalGlow = glow + outerGlow;

    // Soft alpha - spectral transparency
    // Lower base opacity makes it feel less solid
    float alpha = totalGlow * 0.7;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================
// Ethereal Torus - Gaseous Halo
// ============================================
function EtherealTorus() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // Additive for glowing/emissive look
    });
  }, []);

  return (
    <mesh material={material} rotation={[0.3, 0, 0.1]}>
      <torusGeometry args={[2.8, 0.4, 64, 128]} />
    </mesh>
  );
}

// ============================================
// Scene - Ethereal atmosphere with heavy bloom
// ============================================
function Scene() {
  return (
    <>
      {/* Dark background */}
      <color attach="background" args={["#0a0b0f"]} />

      <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={50} />
      <EtherealTorus />

      <EffectComposer>
        {/* Heavy bloom for soft, misty glow bleeding into background */}
        <Bloom
          luminanceThreshold={0.1}   // Lower = more glow triggers
          luminanceSmoothing={0.9}
          intensity={1.2}            // Higher = softer, more atmospheric
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
