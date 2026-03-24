# Body Map Phase 1: Foundation + 3D Engine + Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working body map dashboard with 3D constellation body, hotspots, three-column layout, vitals panel, and AI insights panel.

**Architecture:** Persistent Three.js `<Canvas>` lives in the dashboard layout and does NOT unmount between routes. GLTF models are loaded and rendered as constellation wireframes (Points + LineSegments). Left/right panels are Server Components; the 3D canvas is a client leaf node.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, @react-three/fiber, @react-three/drei, @react-three/postprocessing, Three.js

**Spec:** `docs/superpowers/specs/2026-03-24-body-map-ui-redesign-design.md`

**Prerequisite:** Before starting Task 7, you must have a low-poly human body GLTF model at `public/models/body.glb`. Search Sketchfab for "low poly human body" or "human wireframe" under CC0 license, download in GLB format. The model should be ~50-200KB, facing forward, centered at origin.

---

## File Map

### New Files
- `src/components/body-map/constellation-material.ts` — Reusable Three.js materials for dots + lines
- `src/components/body-map/constellation-mesh.tsx` — Converts any GLTF geometry → constellation rendering
- `src/components/body-map/body-scene.tsx` — Canvas wrapper with postprocessing
- `src/components/body-map/body-model.tsx` — Loads body.glb, renders as constellation
- `src/components/body-map/hotspot.tsx` — 3D-positioned HTML overlay hotspot
- `src/components/body-map/camera-controller.tsx` — Animated camera transitions
- `src/components/body-map/particles.tsx` — Background particle field
- `src/components/body-map/loading-fallback.tsx` — SVG constellation fallback
- `src/components/dashboard/vitals-panel.tsx` — Left panel vitals list
- `src/components/dashboard/ai-insights-panel.tsx` — Right panel AI feed
- `src/components/dashboard/nav-list.tsx` — Bottom nav items for left panel
- `public/models/body.glb` — Human body 3D model (sourced externally)

### Modified Files
- `package.json` — Add Three.js dependencies
- `src/app/layout.tsx` — Replace fonts (Geist → Outfit, DM Sans, JetBrains Mono)
- `src/app/globals.css` — Complete retheme (colors, tokens, animations)
- `src/components/ui/card.tsx` — Restyle to glass card
- `src/components/ui/button.tsx` — Restyle with new variants
- `src/components/ui/progress.tsx` — Restyle thin bars
- `src/app/(dashboard)/layout.tsx` — Three-column layout, persistent canvas
- `src/app/(dashboard)/page.tsx` — Rewrite for body map dashboard
- `src/components/dashboard/sidebar.tsx` — Replaced by vitals-panel + nav-list
- `src/components/dashboard/quick-actions.tsx` — Restyle as pills in right panel

### Removed Files
- `src/components/dashboard/header.tsx` — Greeting moves to layout, avatar to top-right
- `src/components/dashboard/metric-card.tsx` — Replaced by vitals-panel

---

### Task 1: Install Dependencies and Update Fonts

**Files:**
- Modify: `package.json`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install Three.js and React Three Fiber packages**

```bash
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
npm install -D @types/three
```

- [ ] **Step 2: Verify packages installed**

```bash
npm ls three @react-three/fiber @react-three/drei @react-three/postprocessing
```

Expected: All 4 packages listed with versions, no peer dependency errors.

- [ ] **Step 3: Replace fonts in root layout**

Replace `src/app/layout.tsx` — swap Geist for Outfit + DM Sans + JetBrains Mono:

```tsx
import type { Metadata } from "next";
import { Outfit, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Olympus",
  description: "AI-Augmented Health & Longevity Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} ${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify the app still builds**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx
git commit -m "feat: install Three.js deps and replace fonts with Outfit/DM Sans/JetBrains Mono"
```

---

### Task 2: Retheme globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace globals.css with new theme**

Replace the entire `src/app/globals.css` with the new Obsidian Vitality theme. Key changes:
- Background from `220 15% 4%` → custom hex-based tokens
- New font-family mappings for `--font-sans`, `--font-display`, `--font-mono`
- Updated health colors to match spec accent palette
- New animation keyframes (fade-up stagger, pulse-dot, heartbeat)
- Glassmorphism utility classes
- `prefers-reduced-motion` media query to disable animations

```css
@import "tailwindcss";

/* Olympus: Obsidian Vitality Theme */
:root {
  --background: 228 14% 1%;
  --foreground: 213 20% 93%;
  --card: 228 12% 5%;
  --card-foreground: 213 20% 93%;
  --popover: 228 12% 5%;
  --popover-foreground: 213 20% 93%;
  --primary: 160 84% 39%;
  --primary-foreground: 0 0% 100%;
  --secondary: 228 12% 8%;
  --secondary-foreground: 213 20% 93%;
  --muted: 228 12% 8%;
  --muted-foreground: 215 15% 50%;
  --accent: 228 12% 8%;
  --accent-foreground: 213 20% 93%;
  --destructive: 0 62% 30%;
  --destructive-foreground: 213 20% 93%;
  --border: 220 10% 8%;
  --input: 220 10% 8%;
  --ring: 160 84% 39%;
  --radius: 0.75rem;

  /* Domain accent colors */
  --health-green: 160 84% 39%;
  --health-red: 0 72% 51%;
  --health-indigo: 234 89% 74%;
  --health-amber: 38 92% 50%;
  --health-blue: 217 91% 60%;
  --health-yellow: 45 93% 47%;
  --health-purple: 263 70% 76%;

  /* Score colors */
  --score-excellent: 160 84% 39%;
  --score-good: 160 84% 39%;
  --score-moderate: 45 93% 47%;
  --score-low: 25 95% 53%;
  --score-poor: 0 72% 51%;
}

.dark {
  --background: 228 14% 1%;
  --foreground: 213 20% 93%;
  --card: 228 12% 5%;
  --card-foreground: 213 20% 93%;
  --popover: 228 12% 5%;
  --popover-foreground: 213 20% 93%;
  --primary: 160 84% 39%;
  --primary-foreground: 0 0% 100%;
  --secondary: 228 12% 8%;
  --secondary-foreground: 213 20% 93%;
  --muted: 228 12% 8%;
  --muted-foreground: 215 15% 50%;
  --accent: 228 12% 8%;
  --accent-foreground: 213 20% 93%;
  --destructive: 0 62% 30%;
  --destructive-foreground: 213 20% 93%;
  --border: 220 10% 8%;
  --input: 220 10% 8%;
  --ring: 160 84% 39%;
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  /* Health colors */
  --color-health-green: hsl(var(--health-green));
  --color-health-red: hsl(var(--health-red));
  --color-health-indigo: hsl(var(--health-indigo));
  --color-health-amber: hsl(var(--health-amber));
  --color-health-blue: hsl(var(--health-blue));
  --color-health-yellow: hsl(var(--health-yellow));
  --color-health-purple: hsl(var(--health-purple));

  /* Font families */
  --font-sans: var(--font-sans), "DM Sans", system-ui, sans-serif;
  --font-display: var(--font-display), "Outfit", system-ui, sans-serif;
  --font-mono: var(--font-mono), "JetBrains Mono", monospace;
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --background: 228 14% 1%;
    --foreground: 213 20% 93%;
    --card: 228 12% 5%;
    --card-foreground: 213 20% 93%;
    --popover: 228 12% 5%;
    --popover-foreground: 213 20% 93%;
    --primary: 160 84% 39%;
    --primary-foreground: 0 0% 100%;
    --secondary: 228 12% 8%;
    --secondary-foreground: 213 20% 93%;
    --muted: 228 12% 8%;
    --muted-foreground: 215 15% 50%;
    --accent: 228 12% 8%;
    --accent-foreground: 213 20% 93%;
    --destructive: 0 62% 30%;
    --destructive-foreground: 213 20% 93%;
    --border: 220 10% 8%;
    --input: 220 10% 8%;
    --ring: 160 84% 39%;
  }
}

* {
  border-color: hsl(var(--border));
}

body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-feature-settings: "rlig" 1, "calt" 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.15); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.3); }

/* ============================
   Animations
   ============================ */
@keyframes score-fill {
  from { stroke-dashoffset: 283; }
}
.score-ring {
  animation: score-fill 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fade-in-up 0.4s ease-out both;
}

.animation-delay-100 { animation-delay: 50ms; }
.animation-delay-200 { animation-delay: 100ms; }
.animation-delay-300 { animation-delay: 150ms; }
.animation-delay-400 { animation-delay: 200ms; }
.animation-delay-500 { animation-delay: 250ms; }

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.8); opacity: 0; }
}
/* Use on the dot element itself — the ::after creates the pulsing ring */
.animate-pulse-dot {
  position: relative;
}
.animate-pulse-dot::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  animation: pulse-dot 2.5s ease infinite;
}
/* Standalone pulsing ring (for use as a separate div) */
.pulse-ring {
  animation: pulse-dot 2.5s ease infinite;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  14% { transform: scale(1.25); }
  28% { transform: scale(1); }
  42% { transform: scale(1.12); }
  56% { transform: scale(1); }
}
.animate-heartbeat {
  animation: heartbeat 1.2s ease infinite;
}

@keyframes pulse-glow {
  0%, 100% { filter: drop-shadow(0 0 6px currentColor); opacity: 1; }
  50% { filter: drop-shadow(0 0 12px currentColor); opacity: 0.9; }
}
.animate-pulse-glow {
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes notification-pulse {
  0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); }
  50% { box-shadow: 0 0 0 4px hsl(var(--primary) / 0); }
}
.animate-notification-pulse {
  animation: notification-pulse 2s ease-in-out infinite;
}

/* ============================
   Glassmorphism
   ============================ */
.glass-card {
  background: hsl(var(--card) / 0.5);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border: 1px solid hsl(0 0% 100% / 0.04);
}

/* ============================
   Glow effects
   ============================ */
.glow-green { box-shadow: 0 0 20px -4px hsl(var(--health-green) / 0.3); }
.glow-red { box-shadow: 0 0 20px -4px hsl(var(--health-red) / 0.3); }
.glow-indigo { box-shadow: 0 0 20px -4px hsl(var(--health-indigo) / 0.3); }
.glow-amber { box-shadow: 0 0 20px -4px hsl(var(--health-amber) / 0.3); }
.glow-blue { box-shadow: 0 0 20px -4px hsl(var(--health-blue) / 0.3); }
.glow-purple { box-shadow: 0 0 20px -4px hsl(var(--health-purple) / 0.3); }

/* ============================
   Text utilities
   ============================ */
.gradient-text {
  background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--health-indigo)));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.score-excellent { color: hsl(var(--health-green)); }
.score-good { color: hsl(var(--health-green)); }
.score-moderate { color: hsl(var(--health-yellow)); }
.score-low { color: hsl(var(--health-amber)); }
.score-poor { color: hsl(var(--health-red)); }

/* ============================
   Accessibility
   ============================ */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .score-ring { animation: none; }
}
```

- [ ] **Step 2: Verify build still works**

```bash
npm run build
```

Expected: Build succeeds. Some pages may look different due to color changes — that's expected.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: retheme globals.css with Obsidian Vitality design tokens"
```

---

### Task 3: Restyle Shared UI Components

**Files:**
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/progress.tsx`

- [ ] **Step 1: Restyle Card component**

Update `src/components/ui/card.tsx` — change the Card base class to use new glassmorphism:

Replace the Card className string:
```
"rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-xl text-card-foreground shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/5 hover:border-white/[0.1]"
```
With:
```
"rounded-2xl border border-white/[0.04] bg-card/50 backdrop-blur-xl text-card-foreground transition-all duration-200 hover:border-white/[0.08]"
```

- [ ] **Step 2: Restyle Button component**

Update `src/components/ui/button.tsx` — update the variant styles:

Replace the `default` variant:
```
"bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:brightness-110 active:brightness-95"
```
With:
```
"bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 hover:brightness-110 active:brightness-95"
```

Replace the `outline` variant:
```
"border border-white/[0.08] bg-card/30 backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.15] hover:text-accent-foreground"
```
With:
```
"border border-white/[0.06] bg-transparent hover:bg-white/[0.04] hover:border-white/[0.1] hover:text-accent-foreground"
```

- [ ] **Step 3: Restyle Progress component**

Update `src/components/ui/progress.tsx` — ensure the track uses new ultra-subtle background. Read the current file first, then update the track className to use `bg-white/[0.04]` and make the default height `h-1` (4px).

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/card.tsx src/components/ui/button.tsx src/components/ui/progress.tsx
git commit -m "feat: restyle Card, Button, Progress with Obsidian Vitality theme"
```

---

### Task 4: Create Constellation Renderer

**Files:**
- Create: `src/components/body-map/constellation-material.ts`
- Create: `src/components/body-map/constellation-mesh.tsx`

This is the core reusable utility that converts any Three.js geometry into the constellation rendering (glowing dots + thin lines).

- [ ] **Step 1: Create constellation materials**

Create `src/components/body-map/constellation-material.ts`:

```ts
import * as THREE from "three";

export function createPointsMaterial(color: string = "#10b981", size: number = 3) {
  return new THREE.PointsMaterial({
    color: new THREE.Color(color),
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export function createLineMaterial(color: string = "#10b981", opacity: number = 0.12) {
  return new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
```

- [ ] **Step 2: Create constellation mesh component**

Create `src/components/body-map/constellation-mesh.tsx`:

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createPointsMaterial, createLineMaterial } from "./constellation-material";

interface ConstellationMeshProps {
  geometry: THREE.BufferGeometry;
  color?: string;
  pointSize?: number;
  lineOpacity?: number;
  visible?: boolean;
  breathe?: boolean;
}

export function ConstellationMesh({
  geometry,
  color = "#10b981",
  pointSize = 3,
  lineOpacity = 0.12,
  visible = true,
  breathe = false,
}: ConstellationMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  const { pointsMat, lineMat, wireGeo } = useMemo(() => {
    const pm = createPointsMaterial(color, pointSize);
    const lm = createLineMaterial(color, lineOpacity);
    const wg = new THREE.WireframeGeometry(geometry);
    return { pointsMat: pm, lineMat: lm, wireGeo: wg };
  }, [geometry, color, pointSize, lineOpacity]);

  // Clean up GPU resources when geometry changes
  useEffect(() => {
    return () => {
      wireGeo.dispose();
      pointsMat.dispose();
      lineMat.dispose();
    };
  }, [wireGeo, pointsMat, lineMat]);

  useFrame((state) => {
    if (!groupRef.current || !breathe) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.scale.y = 1 + Math.sin(t * 0.5) * 0.008;
  });

  return (
    <group ref={groupRef} visible={visible}>
      <points geometry={geometry} material={pointsMat} />
      <lineSegments geometry={wireGeo} material={lineMat} />
    </group>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors in the new files (there may be pre-existing errors elsewhere).

- [ ] **Step 4: Commit**

```bash
git add src/components/body-map/
git commit -m "feat: add constellation renderer (materials + mesh component)"
```

---

### Task 5: Create Particles, Camera Controller, and Loading Fallback

**Files:**
- Create: `src/components/body-map/particles.tsx`
- Create: `src/components/body-map/camera-controller.tsx`
- Create: `src/components/body-map/loading-fallback.tsx`

- [ ] **Step 1: Create particles component**

Create `src/components/body-map/particles.tsx`:

```tsx
"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ParticlesProps {
  count?: number;
  spread?: number;
  color?: string;
}

export function Particles({ count = 200, spread = 8, color = "#10b981" }: ParticlesProps) {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, [count, spread]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color(color),
        size: 0.02,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color]
  );

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.02;
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}
```

- [ ] **Step 2: Create camera controller**

Create `src/components/body-map/camera-controller.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface CameraTarget {
  position: [number, number, number];
  lookAt: [number, number, number];
}

interface CameraControllerProps {
  target: CameraTarget;
  duration?: number;
}

export function CameraController({ target, duration = 0.8 }: CameraControllerProps) {
  const { camera } = useThree();
  const startPos = useRef(new THREE.Vector3());
  const startLookAt = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const endLookAt = useRef(new THREE.Vector3());
  const progress = useRef(1);
  const currentLookAt = useRef(new THREE.Vector3());

  useEffect(() => {
    startPos.current.copy(camera.position);
    startLookAt.current.copy(currentLookAt.current);
    endPos.current.set(...target.position);
    endLookAt.current.set(...target.lookAt);
    progress.current = 0;
  }, [target, camera]);

  useFrame((_, delta) => {
    if (progress.current >= 1) return;

    progress.current = Math.min(progress.current + delta / duration, 1);
    const t = easeInOutCubic(progress.current);

    camera.position.lerpVectors(startPos.current, endPos.current, t);
    currentLookAt.current.lerpVectors(startLookAt.current, endLookAt.current, t);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

- [ ] **Step 3: Create loading fallback SVG**

Create `src/components/body-map/loading-fallback.tsx`:

```tsx
export function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="relative">
        {/* Simple constellation SVG placeholder */}
        <svg width="200" height="400" viewBox="0 0 200 400" fill="none" className="opacity-20">
          {/* Head */}
          <circle cx="100" cy="30" r="15" stroke="#10b981" strokeWidth="0.5" />
          {/* Spine */}
          <line x1="100" y1="45" x2="100" y2="250" stroke="#10b981" strokeWidth="0.5" />
          {/* Shoulders */}
          <line x1="60" y1="80" x2="140" y2="80" stroke="#10b981" strokeWidth="0.5" />
          {/* Arms */}
          <line x1="60" y1="80" x2="30" y2="180" stroke="#10b981" strokeWidth="0.5" />
          <line x1="140" y1="80" x2="170" y2="180" stroke="#10b981" strokeWidth="0.5" />
          {/* Legs */}
          <line x1="100" y1="250" x2="70" y2="380" stroke="#10b981" strokeWidth="0.5" />
          <line x1="100" y1="250" x2="130" y2="380" stroke="#10b981" strokeWidth="0.5" />
          {/* Dots at joints */}
          {[
            [100, 30], [100, 80], [60, 80], [140, 80],
            [30, 180], [170, 180], [100, 160], [100, 250],
            [70, 380], [130, 380],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="#10b981" opacity="0.5" />
          ))}
        </svg>
        <p className="text-center text-xs text-muted-foreground mt-4">Loading body map...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/body-map/
git commit -m "feat: add particles, camera controller, and loading fallback"
```

---

### Task 6: Create Hotspot Component

**Files:**
- Create: `src/components/body-map/hotspot.tsx`

- [ ] **Step 1: Create hotspot component**

Create `src/components/body-map/hotspot.tsx`:

```tsx
"use client";

import { Html } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface HotspotProps {
  position: [number, number, number];
  color: string;
  label: string;
  value: string | number | null;
  href: string;
  icon: LucideIcon;
  heartbeat?: boolean;
}

export function Hotspot({
  position,
  color,
  label,
  value,
  href,
  icon: Icon,
  heartbeat = false,
}: HotspotProps) {
  const router = useRouter();

  return (
    <group position={position}>
      <Html center distanceFactor={5} zIndexRange={[10, 0]}>
        <button
          onClick={() => router.push(href)}
          className="flex items-center gap-2 cursor-pointer group"
        >
          {/* Pulsing dot */}
          <div className="relative">
            <div
              className={cn(
                "w-3 h-3 rounded-full",
                heartbeat && "animate-heartbeat"
              )}
              style={{
                background: color,
                boxShadow: `0 0 12px ${color}80`,
              }}
            />
            <div
              className="absolute inset-[-6px] rounded-full animate-pulse-dot"
              style={{ borderColor: color }}
            />
          </div>

          {/* Connector line */}
          <div
            className="w-10 h-px"
            style={{
              background: `linear-gradient(90deg, ${color}60, transparent)`,
            }}
          />

          {/* Label tag */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 border border-white/[0.08] backdrop-blur-xl text-[11px] font-medium text-white/70 whitespace-nowrap group-hover:bg-black/90 group-hover:border-white/[0.15] transition-all">
            <Icon className="w-3 h-3" style={{ color }} />
            <span>{label}</span>
            <span className="font-mono font-semibold text-xs" style={{ color }}>
              {value ?? "--"}
            </span>
          </div>
        </button>
      </Html>
    </group>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/body-map/hotspot.tsx
git commit -m "feat: add 3D-positioned hotspot component with HTML overlay"
```

---

### Task 7: Create Body Model and Scene

**Files:**
- Create: `src/components/body-map/body-model.tsx`
- Create: `src/components/body-map/body-scene.tsx`

**Prerequisite:** A GLTF model must exist at `public/models/body.glb`. If not available yet, this task creates a placeholder that uses a simple capsule geometry so the scene is testable.

- [ ] **Step 1: Create body model component**

Create `src/components/body-map/body-model.tsx`:

```tsx
"use client";

import { useMemo, Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ConstellationMesh } from "./constellation-mesh";

interface BodyModelProps {
  visible?: boolean;
}

function BodyModelInner({ visible = true }: BodyModelProps) {
  const gltf = useGLTF("/models/body.glb");

  const geometry = useMemo(() => {
    // Collect ALL mesh geometries from the GLTF (models often have multiple meshes)
    const geometries: THREE.BufferGeometry[] = [];
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geo = child.geometry.clone();
        // Apply the mesh's world transform so all geometries are in the same space
        child.updateWorldMatrix(true, false);
        geo.applyMatrix4(child.matrixWorld);
        geometries.push(geo);
      }
    });

    if (geometries.length === 0) return null;

    // Merge all geometries into one
    const { mergeGeometries } = require("three/examples/jsm/utils/BufferGeometryUtils.js");
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
    if (!merged) return null;

    // Center and normalize
    merged.computeBoundingBox();
    const box = merged.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    merged.translate(-center.x, -center.y, -center.z);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim;
    merged.scale(scale, scale, scale);

    // Dispose individual geometries after merging
    geometries.forEach((g) => g.dispose());

    return merged;
  }, [gltf]);

  if (!geometry) return null;

  return (
    <ConstellationMesh
      geometry={geometry}
      color="#10b981"
      pointSize={2.5}
      lineOpacity={0.1}
      visible={visible}
      breathe
    />
  );
}

// Fallback: simple capsule wireframe while model loads
function PlaceholderBody({ visible = true }: BodyModelProps) {
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.4, 2, 8, 16), []);
  return (
    <ConstellationMesh
      geometry={geo}
      color="#10b981"
      pointSize={2}
      lineOpacity={0.08}
      visible={visible}
      breathe
    />
  );
}

export function BodyModel(props: BodyModelProps) {
  return (
    <Suspense fallback={<PlaceholderBody {...props} />}>
      <BodyModelInner {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create body scene (Canvas wrapper)**

Create `src/components/body-map/body-scene.tsx`:

```tsx
"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { usePathname } from "next/navigation";
import { BodyModel } from "./body-model";
import { Particles } from "./particles";
import { CameraController, type CameraTarget } from "./camera-controller";
import { LoadingFallback } from "./loading-fallback";

const CAMERA_TARGETS: Record<string, CameraTarget> = {
  "/": { position: [0, 0.2, 4.5], lookAt: [0, 0, 0] },
  "/sleep": { position: [0, 1.5, 1.5], lookAt: [0, 1.5, 0] },
  "/nutrition": { position: [0, -0.2, 1.5], lookAt: [0, -0.3, 0] },
  "/workouts": { position: [0, 0.3, 2], lookAt: [0, 0.5, 0] },
  "/recovery": { position: [0, 0, 2], lookAt: [0, -0.1, 0] },
  "/blood-work": { position: [1, 0.2, 2], lookAt: [0.5, 0, 0] },
  "/longevity": { position: [0, 0, 5.5], lookAt: [0, 0, 0] },
};

export function BodyScene() {
  const pathname = usePathname();
  const target = useMemo(
    () => CAMERA_TARGETS[pathname] ?? CAMERA_TARGETS["/"],
    [pathname]
  );

  // Body model visible on dashboard and any route without a dedicated organ model
  const showBody = pathname === "/" || pathname === "/settings" || pathname === "/coach";

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Canvas
        camera={{ position: [0, 0.2, 4.5], fov: 45, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <CameraController target={target} />
        <ambientLight intensity={0.1} />

        <BodyModel visible={showBody} />
        <Particles count={200} spread={10} />

        <EffectComposer>
          <Bloom
            intensity={0.8}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/body-map/
git commit -m "feat: add body model (GLTF constellation) and body scene canvas"
```

---

### Task 8: Create Left Panel Components

**Files:**
- Create: `src/components/dashboard/vitals-panel.tsx`
- Create: `src/components/dashboard/nav-list.tsx`

- [ ] **Step 1: Create nav list component**

Create `src/components/dashboard/nav-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Utensils,
  Dumbbell,
  Moon,
  Heart,
  FlaskConical,
  Sparkles,
  MessageCircle,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Nutrition", href: "/nutrition", icon: Utensils },
  { name: "Workouts", href: "/workouts", icon: Dumbbell },
  { name: "Sleep", href: "/sleep", icon: Moon },
  { name: "Recovery", href: "/recovery", icon: Heart },
  { name: "Blood Work", href: "/blood-work", icon: FlaskConical },
  { name: "Longevity", href: "/longevity", icon: Sparkles },
  { name: "AI Coach", href: "/coach", icon: MessageCircle },
];

export function NavList() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="border-t border-white/[0.04] pt-3 mt-auto space-y-0.5">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
              isActive
                ? "bg-primary/8 text-primary"
                : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-4 w-4", isActive ? "opacity-100" : "opacity-50")} />
            {item.name}
          </Link>
        );
      })}
      <div className="pt-2 space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-all"
        >
          <Settings className="h-4 w-4 opacity-50" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-all"
        >
          <LogOut className="h-4 w-4 opacity-50" />
          Sign out
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create vitals panel component**

Create `src/components/dashboard/vitals-panel.tsx`. This is a Server Component that receives data as props:

```tsx
import { cn } from "@/lib/utils";

interface Vital {
  name: string;
  value: string | number | null;
  unit?: string;
  color: string;
  trend?: { direction: "up" | "down"; label: string };
}

interface VitalsPanelProps {
  groups: {
    label: string;
    vitals: Vital[];
  }[];
}

export function VitalsPanel({ groups }: VitalsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto space-y-1">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 py-2 text-[9px] uppercase tracking-[2.5px] text-white/[0.18] font-semibold">
            {group.label}
          </div>
          {group.vitals.map((vital) => (
            <div
              key={vital.name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border border-transparent hover:bg-white/[0.03] hover:border-white/[0.05]"
            >
              <div
                className="w-2.5 h-2.5 rounded-full relative animate-pulse-dot"
                style={{ background: vital.color, color: vital.color }}
              />
              <div className="flex-1">
                <div className="text-[11px] text-white/[0.4]">{vital.name}</div>
              </div>
              <div className="text-right">
                <span className="font-mono text-lg font-semibold text-white">
                  {vital.value ?? "--"}
                </span>
                {vital.unit && (
                  <span className="text-[10px] text-white/[0.2] ml-0.5">{vital.unit}</span>
                )}
                {vital.trend && (
                  <div
                    className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-0.5",
                      vital.trend.direction === "up"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    )}
                  >
                    {vital.trend.label}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// cn is imported from @/lib/utils at the top of this file
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/vitals-panel.tsx src/components/dashboard/nav-list.tsx
git commit -m "feat: add vitals panel and nav list for left panel"
```

---

### Task 9: Create Right Panel (AI Insights)

**Files:**
- Create: `src/components/dashboard/ai-insights-panel.tsx`

- [ ] **Step 1: Create AI insights panel**

Create `src/components/dashboard/ai-insights-panel.tsx`:

```tsx
interface Insight {
  category: string;
  color: string;
  text: string;
  timestamp: string;
}

interface AIInsightsPanelProps {
  insights: Insight[];
}

export function AIInsightsPanel({ insights }: AIInsightsPanelProps) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" />
        <span className="text-[10px] uppercase tracking-[2.5px] text-primary/50 font-semibold">
          AI Insights — Live
        </span>
      </div>

      {/* Insight cards */}
      {insights.map((insight, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] cursor-pointer transition-all hover:bg-white/[0.04] hover:border-white/[0.08]"
        >
          <div
            className="flex items-center gap-1.5 text-[9px] uppercase tracking-[1.5px] font-semibold mb-2"
            style={{ color: insight.color }}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: insight.color }}
            />
            {insight.category}
          </div>
          <p className="text-xs text-white/[0.6] leading-relaxed">
            {insight.text}
          </p>
          <div className="text-[10px] text-white/[0.15] font-mono mt-2.5">
            {insight.timestamp}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/ai-insights-panel.tsx
git commit -m "feat: add AI insights panel for right panel"
```

---

### Task 10: Rewrite Dashboard Layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

This replaces the sidebar + header layout with the three-column layout. The key architectural decision: **the layout owns all three columns directly**. The `{children}` slot renders as an invisible data-passing component (page components return null for visual output but pass data via React context or props). For Phase 1, the left and right panels are hardcoded in the layout and the dashboard page passes its data to them via a client-side context provider.

Simpler approach for Phase 1: the layout renders the static shell (logo, nav, avatar, canvas), and `{children}` is rendered as an overlay on top of the center column where each page can render page-specific UI (readiness score, etc.). Left panel vitals and right panel insights are fetched directly in the layout for now.

- [ ] **Step 1: Rewrite dashboard layout**

Replace `src/app/(dashboard)/layout.tsx`:

```tsx
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { BodyScene } from "@/components/body-map/body-scene";
import { NavList } from "@/components/dashboard/nav-list";
import { VitalsPanel } from "@/components/dashboard/vitals-panel";
import { AIInsightsPanel } from "@/components/dashboard/ai-insights-panel";
import { db, healthMetrics } from "@/lib/db";
import { eq, gte, and, sql, desc } from "drizzle-orm";

const DEFAULT_INSIGHTS = [
  {
    category: "Recovery Analysis",
    color: "#34d399",
    text: "Your HRV is trending above your 30-day baseline. Combined with last night's sleep score, your autonomic nervous system is well-recovered.",
    timestamp: "4 min ago",
  },
  {
    category: "Nutrition Alert",
    color: "#f59e0b",
    text: "You're 20g below your protein target with 2 meals remaining. Consider adding Greek yogurt or a protein shake.",
    timestamp: "18 min ago",
  },
  {
    category: "Sleep Optimization",
    color: "#818cf8",
    text: "Based on your circadian patterns, start wind-down at 10:15 PM tonight for optimal deep sleep.",
    timestamp: "1 hr ago",
  },
  {
    category: "Cardiovascular",
    color: "#ef4444",
    text: "Resting HR has dropped 3 bpm over 2 weeks — your aerobic base is strengthening.",
    timestamp: "2 hrs ago",
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const userName = user.fullName || user.email.split("@")[0] || "User";

  // Fetch vitals for left panel (simplified — reuses existing query patterns from page.tsx)
  // In production, extract shared data-fetching into a utility
  const vitalGroups = [
    {
      label: "Cardiovascular",
      vitals: [
        { name: "Resting Heart Rate", value: "--", unit: "bpm", color: "#ef4444" },
        { name: "HRV", value: "--", unit: "ms", color: "#a78bfa" },
      ],
    },
    {
      label: "Metabolic",
      vitals: [
        { name: "Active Calories", value: "--", unit: "kcal", color: "#f59e0b" },
        { name: "Steps", value: "--", color: "#3b82f6" },
      ],
    },
    {
      label: "Recovery",
      vitals: [
        { name: "Recovery Score", value: "--", unit: "/100", color: "#10b981" },
        { name: "Sleep Score", value: "--", unit: "/100", color: "#818cf8" },
      ],
    },
  ];

  return (
    <div className="h-screen bg-background overflow-hidden grid grid-cols-[260px_1fr_320px]">
      {/* Left Panel */}
      <div className="border-r border-white/[0.04] flex flex-col p-5 overflow-hidden">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.3)]">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-base font-bold">Olympus</span>
        </div>

        <VitalsPanel groups={vitalGroups} />
        <NavList />
      </div>

      {/* Center: Persistent 3D Canvas + page overlay */}
      <div className="relative overflow-hidden">
        <BodyScene />
        {/* Page-specific overlay content (readiness score, breadcrumbs, etc.) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="pointer-events-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="border-l border-white/[0.04] p-5 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-end gap-3 mb-6">
          <div className="text-right">
            <div className="text-sm font-medium">{userName.split(" ")[0]}</div>
            <div className="text-[10px] text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-[11px] font-semibold text-white">
            {userName.slice(0, 2).toUpperCase()}
          </div>
        </div>

        <AIInsightsPanel insights={DEFAULT_INSIGHTS} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

```bash
npm run build
```

Expected: Build succeeds. The dashboard will look different but functional.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat: rewrite dashboard layout with three-column grid, persistent canvas, vitals and insights panels"
```

---

### Task 11: Rewrite Dashboard Page with Readiness Score Overlay

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

The layout now handles the three-column shell. The page component renders content that overlays on top of the center canvas — specifically the readiness score badge at the top center.

- [ ] **Step 1: Rewrite page.tsx**

Read the existing `src/app/(dashboard)/page.tsx` to understand the data-fetching. Keep the score calculation logic but strip all the old card-based UI. The new page renders a readiness score overlay:

```tsx
import { getCurrentUser } from "@/lib/auth/session";
import { db, healthMetrics, sleepSessions, workouts } from "@/lib/db";
import { eq, gte, and, sql } from "drizzle-orm";
import { getYesterdayDateString } from "@/lib/utils/timezone";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  let readiness: number | null = null;

  if (user) {
    try {
      const userSettings = user.settings as { timezone?: string } | null;
      const userTimezone = userSettings?.timezone || "UTC";
      const lastNightDate = getYesterdayDateString(userTimezone);

      // Fetch last night's sleep for readiness calculation
      const lastNightSleep = await db
        .select()
        .from(sleepSessions)
        .where(
          and(
            eq(sleepSessions.userId, user.id),
            eq(sleepSessions.sleepDate, lastNightDate)
          )
        )
        .limit(1);

      if (lastNightSleep.length > 0) {
        const sleep = lastNightSleep[0];
        readiness = sleep.sleepScore;
      }
    } catch (error) {
      console.error("Could not fetch dashboard data:", error);
    }
  }

  return (
    <div className="flex flex-col items-center pt-5">
      {/* Readiness Score */}
      <div className="text-center">
        <div
          className="font-display text-7xl font-extrabold tracking-tighter text-white leading-none"
          style={{ textShadow: "0 0 50px rgba(16,185,129,0.25)" }}
        >
          {readiness ?? "--"}
        </div>
        <div className="text-[9px] uppercase tracking-[4px] text-primary/45 mt-1">
          Readiness
        </div>
        {readiness !== null && readiness >= 70 && (
          <div className="inline-block mt-2 px-3.5 py-1 rounded-full bg-primary/8 border border-primary/12 text-[11px] font-medium text-primary">
            Ready to train
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds and renders**

```bash
npm run build && npm run dev
```

Open http://localhost:3000. Expected: Readiness score shows at top center, 3D body visible behind it, vitals on left, insights on right.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/page.tsx
git commit -m "feat: rewrite dashboard page with readiness score overlay"
```

---

### Task 11b: Add Hotspots to Body Scene

**Files:**
- Modify: `src/components/body-map/body-scene.tsx`

The hotspot component exists (Task 6) but is not yet instantiated in the scene. Add the 6 hotspots from the spec.

- [ ] **Step 1: Add hotspot imports and instances to body-scene.tsx**

Add to the imports in `body-scene.tsx`:

```tsx
import { Hotspot } from "./hotspot";
import { Moon, Heart, Utensils, Activity, Dumbbell, Footprints } from "lucide-react";
```

Add inside the `<Canvas>` after `<BodyModel>`, only when `showBody` is true:

```tsx
{showBody && (
  <>
    <Hotspot position={[0, 1.4, 0.3]} color="#818cf8" label="Sleep" value="87" href="/sleep" icon={Moon} />
    <Hotspot position={[-0.4, 0.6, 0.3]} color="#ef4444" label="Heart" value="62 bpm" href="/recovery?focus=cardiac" icon={Heart} heartbeat />
    <Hotspot position={[0, -0.1, 0.4]} color="#f59e0b" label="Nutrition" value="1,840 kcal" href="/nutrition" icon={Utensils} />
    <Hotspot position={[0.1, 0.2, -0.2]} color="#10b981" label="Recovery" value="72" href="/recovery" icon={Activity} />
    <Hotspot position={[0.6, 0.7, 0.2]} color="#fbbf24" label="Strain" value="14.2" href="/workouts" icon={Dumbbell} />
    <Hotspot position={[0.2, -1.0, 0.3]} color="#3b82f6" label="Activity" value="8,432 steps" href="/workouts?focus=activity" icon={Footprints} />
  </>
)}
```

**Note:** The exact `position` values depend on the body GLTF model's dimensions. These are estimates for a body ~3 units tall centered at origin. Adjust after seeing the actual model render.

- [ ] **Step 2: Verify hotspots render in dev**

```bash
npm run dev
```

Open http://localhost:3000. Expected: 6 hotspot labels visible around the body with pulsing dots and connector lines. Clicking a hotspot navigates to the target page.

- [ ] **Step 3: Commit**

```bash
git add src/components/body-map/body-scene.tsx
git commit -m "feat: add 6 interactive hotspots to body scene"
```

---

### Task 12: Clean Up Deprecated Components

**Files:**
- Delete: `src/components/dashboard/header.tsx`
- Delete: `src/components/dashboard/metric-card.tsx`
- Modify: `src/components/dashboard/quick-actions.tsx`

- [ ] **Step 1: Verify no other files import header.tsx or metric-card.tsx**

```bash
grep -r "header" src/app/ src/components/ --include="*.tsx" --include="*.ts" -l
grep -r "metric-card\|MetricCard" src/app/ src/components/ --include="*.tsx" --include="*.ts" -l
```

Expected: Only the old `page.tsx` (now rewritten) and `layout.tsx` (now rewritten) should reference these. If other files still import them, update those first.

- [ ] **Step 2: Delete deprecated components**

```bash
rm src/components/dashboard/header.tsx
rm src/components/dashboard/metric-card.tsx
```

- [ ] **Step 3: Restyle quick-actions as pills**

Update `src/components/dashboard/quick-actions.tsx` — change buttons to pill style with smaller sizing:

Read the current file, then update the Button classes to use `rounded-full px-4 py-1.5 text-xs` styling with the outline variant. Keep the same actions array and Link structure.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no missing import errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove deprecated header/metric-card, restyle quick-actions as pills"
```

---

### Task 13: Integration Test — Full Dashboard Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify dashboard loads at http://localhost:3000**

Check:
- Three-column layout renders (left panel, center canvas, right panel)
- Fonts are Outfit/DM Sans/JetBrains Mono (inspect in browser dev tools)
- Background is deep black (#030305 range)
- 3D canvas renders (either constellation body or capsule placeholder)
- Particles are visible floating in the background
- Left panel shows vitals with pulse dots
- Navigation links work at bottom of left panel
- No console errors related to Three.js or React

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: Build succeeds with exit code 0.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors (or only pre-existing errors unrelated to new code).

- [ ] **Step 5: Final commit with any fixes**

If any fixes were needed during smoke testing, commit them:

```bash
git add -A
git commit -m "fix: smoke test fixes for dashboard body map"
```

---

## Summary

After completing all 14 tasks (1-11b, 12, 13), you will have:
- New font stack (Outfit + DM Sans + JetBrains Mono)
- Obsidian Vitality color theme with glassmorphism
- Restyled Card, Button, Progress components
- Reusable constellation renderer (GLTF → wireframe)
- Persistent Three.js canvas with body model, particles, bloom
- Camera controller with animated transitions
- Interactive hotspot components
- Three-column dashboard layout (vitals | 3D body | AI insights)
- Navigation via left panel nav list

## What's Next

- **Plan 2: Organ Pages** — Sleep (brain), Nutrition (gut), Workouts (muscles), Recovery (spine), Blood Work (circulatory), Longevity (vitality overlay). Each follows the same pattern: source GLTF model → constellation render → page-specific panels.
- **Plan 3: Utilities** — Command palette (Cmd+K), AI Coach chat overlay, Auth page restyle, Settings restyle.
