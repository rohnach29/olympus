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
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ============================================
// Fragment Shader - Ethereal Glow
// ============================================
const fragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    // Fresnel for edge glow
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    float glow = pow(fresnel, 2.5);

    // Angle around the ring for color gradient
    float angle = atan(vWorldPosition.y, vWorldPosition.x);
    float t = (angle + 3.14159) / 6.28318; // 0 to 1

    // Color stops - ethereal palette
    vec3 purple = vec3(0.6, 0.2, 0.8);
    vec3 teal = vec3(0.2, 0.7, 0.7);
    vec3 green = vec3(0.2, 0.6, 0.4);
    vec3 blue = vec3(0.3, 0.4, 0.7);

    // Smooth 4-stop gradient using mix
    vec3 color1 = mix(purple, teal, smoothstep(0.0, 0.25, t));
    vec3 color2 = mix(color1, green, smoothstep(0.25, 0.5, t));
    vec3 color3 = mix(color2, blue, smoothstep(0.5, 0.75, t));
    vec3 finalColor = mix(color3, purple, smoothstep(0.75, 1.0, t));

    // Brighten for glow effect
    finalColor *= 1.4;

    // Output with glow-based alpha
    gl_FragColor = vec4(finalColor, glow);
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
