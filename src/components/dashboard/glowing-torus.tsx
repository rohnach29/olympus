"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// ============================================
// Vertex Shader
// ============================================
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ============================================
// Fragment Shader - Ethereal Fresnel Halo
// ============================================
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uColorProgress;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  // Simplex 3D Noise
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    // Fresnel calculation - transparent center, opaque edges
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 2.5); // Sharper edge falloff

    // Animated noise for drifting smoke effect
    float timeScale = uTime * 0.08; // Slow drift
    vec3 noiseCoord = vPosition * 1.5 + vec3(timeScale, timeScale * 0.7, timeScale * 0.5);
    float noise = snoise(noiseCoord) * 0.5 + 0.5;

    // Second noise layer for more organic movement
    vec3 noiseCoord2 = vPosition * 2.5 + vec3(-timeScale * 0.5, timeScale * 0.3, -timeScale * 0.8);
    float noise2 = snoise(noiseCoord2) * 0.5 + 0.5;

    // Blend noises
    float blendedNoise = mix(noise, noise2, 0.5);

    // Color gradient: Cyan (#00FFFF) -> Lime (#00FF00) -> Violet (#8A2BE2)
    vec3 cyan = vec3(0.0, 1.0, 1.0);
    vec3 lime = vec3(0.0, 1.0, 0.0);
    vec3 violet = vec3(0.54, 0.17, 0.89);

    // Green transition colors
    vec3 emerald = vec3(0.2, 0.9, 0.4);
    vec3 mint = vec3(0.4, 1.0, 0.6);

    // Mix based on noise and position for flowing gradient
    float gradientPos = fract(blendedNoise + vUv.x * 0.5 + uTime * 0.02);

    vec3 baseColor;
    if (uColorProgress < 0.5) {
      // Cyan -> Lime -> Violet palette
      if (gradientPos < 0.33) {
        baseColor = mix(cyan, lime, gradientPos * 3.0);
      } else if (gradientPos < 0.66) {
        baseColor = mix(lime, violet, (gradientPos - 0.33) * 3.0);
      } else {
        baseColor = mix(violet, cyan, (gradientPos - 0.66) * 3.0);
      }
    } else {
      // Transition to green palette
      float greenMix = (uColorProgress - 0.5) * 2.0;
      vec3 greenBase;
      if (gradientPos < 0.5) {
        greenBase = mix(emerald, mint, gradientPos * 2.0);
      } else {
        greenBase = mix(mint, emerald, (gradientPos - 0.5) * 2.0);
      }

      // Blend between original and green
      if (gradientPos < 0.33) {
        baseColor = mix(mix(cyan, lime, gradientPos * 3.0), greenBase, greenMix);
      } else if (gradientPos < 0.66) {
        baseColor = mix(mix(lime, violet, (gradientPos - 0.33) * 3.0), greenBase, greenMix);
      } else {
        baseColor = mix(mix(violet, cyan, (gradientPos - 0.66) * 3.0), greenBase, greenMix);
      }
    }

    // Apply fresnel - edges are bright and opaque, center is transparent
    vec3 finalColor = baseColor * (0.5 + fresnel * 1.5);

    // Add extra glow at edges for bloom to pick up
    finalColor += baseColor * fresnel * 0.8;

    // Alpha: transparent in center, opaque at edges (fresnel-based)
    float alpha = fresnel * 0.9;

    // Boost alpha slightly for visibility
    alpha = clamp(alpha + 0.1, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// ============================================
// Ethereal Torus Mesh
// ============================================
interface EtherealTorusProps {
  colorProgress: number;
}

function EtherealTorus({ colorProgress }: EtherealTorusProps) {
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
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Animate
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uColorProgress.value = colorProgress;

    // Very subtle rotation
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.02;
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.015;
    }
  });

  return (
    <mesh ref={meshRef} material={material}>
      {/* High segment count for smooth appearance */}
      <torusGeometry args={[1.8, 0.4, 128, 128]} />
    </mesh>
  );
}

// ============================================
// Text Overlay Component
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
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        {!showScore ? (
          <p
            className="text-white font-light tracking-wide"
            style={{
              fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
              opacity: 0.95,
              textShadow: "0 0 20px rgba(0, 255, 255, 0.3)",
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
                fontSize: "clamp(3rem, 8vw, 4.5rem)",
                color: "#00FF88",
                textShadow: "0 0 30px rgba(0, 255, 136, 0.5)",
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
// Main Scene Component
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
      {/* Ethereal Torus */}
      <EtherealTorus colorProgress={colorProgress} />

      {/* Text Overlay */}
      <TextOverlay greeting={greeting} showScore={showScore} score={score} />

      {/* Post-processing: Bloom for mystical glow */}
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// ============================================
// Main Exported Component
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
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ background: "#050505" }}
      >
        {/* Minimal ambient light */}
        <ambientLight intensity={0.1} />

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
