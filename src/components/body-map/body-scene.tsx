"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { usePathname } from "next/navigation";
import { BodyModel } from "./body-model";
import { Hotspot } from "./hotspot";
import { Particles } from "./particles";
import { CameraController, type CameraTarget } from "./camera-controller";
import { LoadingFallback } from "./loading-fallback";
import { Moon, Heart, Utensils, Activity, Dumbbell, Footprints } from "lucide-react";

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
        {showBody && (
          <>
            <Hotspot position={[0, 1.4, 0.3]} color="#818cf8" label="Sleep" value="87" href="/sleep" icon={Moon} />
            <Hotspot position={[-0.4, 0.6, 0.3]} color="#ef4444" label="Heart" value="62 bpm" href="/recovery?focus=cardiac" icon={Heart} heartbeat />
            <Hotspot position={[0, -0.1, 0.4]} color="#f59e0b" label="Nutrition" value="1,840 kcal" href="/nutrition" icon={Utensils} />
            <Hotspot position={[0.1, 0.2, -0.2]} color="#10b981" label="Recovery" value="72" href="/recovery" icon={Activity} />
            <Hotspot position={[0.6, 0.7, 0.2]} color="#fbbf24" label="Strain" value="14.2" href="/workouts" icon={Dumbbell} />
            <Hotspot position={[0.2, -1.0, 0.3]} color="#3b82f6" label="Activity" value="8,432" href="/workouts?focus=activity" icon={Footprints} />
          </>
        )}
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
