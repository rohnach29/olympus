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
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ============================================
// Fragment Shader - Ethereal Glow with Color Gradient
// ============================================
const fragmentShader = /* glsl */ `
  uniform vec3 uCameraPosition;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    // Fresnel for soft edge glow
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    float glow = pow(fresnel, 2.0);

    // Angle around ring for color gradient
    float angle = atan(vWorldPosition.y, vWorldPosition.x);
    float t = (angle + 3.14159) / 6.28318;

    // Ethereal color palette
    vec3 purple = vec3(0.55, 0.25, 0.75);
    vec3 teal = vec3(0.25, 0.65, 0.65);
    vec3 green = vec3(0.25, 0.55, 0.4);
    vec3 blue = vec3(0.3, 0.4, 0.65);

    // 4-stop gradient
    vec3 c1 = mix(purple, teal, smoothstep(0.0, 0.25, t));
    vec3 c2 = mix(c1, green, smoothstep(0.25, 0.5, t));
    vec3 c3 = mix(c2, blue, smoothstep(0.5, 0.75, t));
    vec3 color = mix(c3, purple, smoothstep(0.75, 1.0, t));

    // Brighten
    color *= 1.5;

    gl_FragColor = vec4(color, glow);
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
        uniforms={{
          uCameraPosition: { value: [0, 0, 10] }
        }}
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
