"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { extend } from "@react-three/fiber";

// ============================================
// Shader Material Definition
// ============================================

// Vertex Shader
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vUv = uv;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment Shader with Fresnel, Perlin Noise, and Chromatic Aberration
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uColorProgress; // 0 = cyan/purple, 1 = green
  uniform vec3 uCameraPosition;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // ============================================
  // Simplex 3D Noise (for smoky effect)
  // ============================================
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

  // Fractal Brownian Motion for more complex noise
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value;
  }

  // ============================================
  // Main Fragment Shader
  // ============================================
  void main() {
    // Calculate view direction for Fresnel
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);

    // ============================================
    // Fresnel Effect (glass-like edges)
    // ============================================
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
    fresnel = clamp(fresnel, 0.0, 1.0);

    // ============================================
    // Perlin Noise for smoky color flow
    // ============================================
    // Animate noise through the torus
    vec3 noisePos = vPosition * 2.0 + vec3(uTime * 0.15, uTime * 0.1, uTime * 0.12);
    float noise1 = fbm(noisePos);
    float noise2 = fbm(noisePos + vec3(100.0, 0.0, 0.0));
    float noise3 = fbm(noisePos + vec3(0.0, 100.0, 0.0));

    // Remap noise to 0-1 range
    noise1 = noise1 * 0.5 + 0.5;
    noise2 = noise2 * 0.5 + 0.5;
    noise3 = noise3 * 0.5 + 0.5;

    // ============================================
    // Color Palette (Cyberpunk: Cyan, Purple, Deep Black)
    // ============================================
    vec3 cyanColor = vec3(0.0, 0.9, 0.95);      // Neon cyan
    vec3 purpleColor = vec3(0.6, 0.2, 0.9);     // Neon purple
    vec3 tealColor = vec3(0.1, 0.7, 0.7);       // Deep teal
    vec3 pinkColor = vec3(0.9, 0.3, 0.6);       // Hot pink accent

    // Green palette for transition
    vec3 greenColor = vec3(0.2, 0.9, 0.4);      // Neon green
    vec3 emeraldColor = vec3(0.1, 0.7, 0.5);    // Emerald

    // Mix colors based on noise and color progress
    vec3 baseColor1 = mix(cyanColor, greenColor, uColorProgress);
    vec3 baseColor2 = mix(purpleColor, emeraldColor, uColorProgress);
    vec3 baseColor3 = mix(tealColor, greenColor * 0.8, uColorProgress);

    // Create smoky color blend using noise
    vec3 smokyColor = mix(baseColor1, baseColor2, noise1);
    smokyColor = mix(smokyColor, baseColor3, noise2 * 0.5);

    // Add pink/accent highlights in high noise areas
    vec3 accentColor = mix(pinkColor, vec3(0.4, 0.95, 0.6), uColorProgress);
    smokyColor = mix(smokyColor, accentColor, pow(noise3, 2.0) * 0.4);

    // ============================================
    // Chromatic Aberration (RGB channel separation)
    // ============================================
    float aberrationStrength = 0.15 * fresnel;

    // Offset each color channel slightly based on fresnel
    vec3 aberratedColor;
    aberratedColor.r = smokyColor.r * (1.0 + aberrationStrength);
    aberratedColor.g = smokyColor.g;
    aberratedColor.b = smokyColor.b * (1.0 - aberrationStrength * 0.5);

    // ============================================
    // Final Color Composition
    // ============================================

    // Core glow (inner part of torus)
    float coreGlow = 1.0 - fresnel;
    coreGlow = pow(coreGlow, 1.5);

    // Edge glow (fresnel-based)
    float edgeGlow = pow(fresnel, 2.0);

    // Combine: smoky interior + bright edges
    vec3 finalColor = aberratedColor * coreGlow * 0.6;
    finalColor += aberratedColor * edgeGlow * 1.5;

    // Add extra bloom on edges
    vec3 bloomColor = mix(cyanColor, greenColor, uColorProgress);
    finalColor += bloomColor * edgeGlow * 0.5;

    // Add subtle noise-based shimmer
    float shimmer = snoise(vPosition * 10.0 + uTime * 0.5) * 0.1 + 0.9;
    finalColor *= shimmer;

    // Alpha based on visibility (more opaque at edges, translucent in middle)
    float alpha = 0.3 + edgeGlow * 0.6 + coreGlow * 0.2;
    alpha *= 0.85; // Overall transparency

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Create the shader material class
const GlowingTorusMaterial = shaderMaterial(
  {
    uTime: 0,
    uColorProgress: 0,
    uCameraPosition: new THREE.Vector3(0, 0, 5),
  },
  vertexShader,
  fragmentShader
);

// Extend Three.js with our custom material
extend({ GlowingTorusMaterial });

// Type for the material ref
type GlowingTorusMaterialType = THREE.ShaderMaterial & {
  uniforms: {
    uTime: { value: number };
    uColorProgress: { value: number };
    uCameraPosition: { value: THREE.Vector3 };
  };
};

// ============================================
// Torus Mesh Component
// ============================================
interface TorusMeshProps {
  colorProgress: number;
}

function TorusMesh({ colorProgress }: TorusMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<GlowingTorusMaterialType>(null);

  // Create material instance
  const material = useMemo(() => {
    const mat = new GlowingTorusMaterial();
    mat.transparent = true;
    mat.side = THREE.DoubleSide;
    mat.depthWrite = false;
    return mat;
  }, []);

  // Animate the shader
  useFrame((state) => {
    if (material) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uColorProgress.value = colorProgress;
      material.uniforms.uCameraPosition.value.copy(state.camera.position);
    }

    // Subtle rotation
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} material={material}>
      {/* Torus: radius, tube radius, radial segments, tubular segments */}
      <torusGeometry args={[2.2, 0.35, 64, 128]} />
    </mesh>
  );
}

// ============================================
// Outer Glow Effect (Post-process bloom simulation)
// ============================================
function OuterGlow({ colorProgress }: { colorProgress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      // Pulsing scale
      const pulse = Math.sin(state.clock.elapsedTime * 0.5) * 0.05 + 1;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  const glowColor = useMemo(() => {
    if (colorProgress > 0.7) {
      return new THREE.Color(0.2, 0.9, 0.5); // Green
    } else if (colorProgress > 0.3) {
      const t = (colorProgress - 0.3) / 0.4;
      return new THREE.Color(
        0.0 + t * 0.2,
        0.8 + t * 0.1,
        0.9 - t * 0.4
      );
    }
    return new THREE.Color(0.0, 0.8, 0.9); // Cyan
  }, [colorProgress]);

  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[2.2, 0.5, 32, 64]} />
      <meshBasicMaterial
        color={glowColor}
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ============================================
// Main Canvas Component
// ============================================
interface GlowingTorusProps {
  colorProgress?: number;
  className?: string;
}

export function GlowingTorus({ colorProgress = 0, className = "" }: GlowingTorusProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        {/* Ambient light for base illumination */}
        <ambientLight intensity={0.2} />

        {/* Point lights for dramatic effect */}
        <pointLight position={[5, 5, 5]} intensity={0.5} color="#00ffff" />
        <pointLight position={[-5, -5, 5]} intensity={0.3} color="#9933ff" />

        {/* Outer glow layer */}
        <OuterGlow colorProgress={colorProgress} />

        {/* Main torus with shader */}
        <TorusMesh colorProgress={colorProgress} />
      </Canvas>
    </div>
  );
}
