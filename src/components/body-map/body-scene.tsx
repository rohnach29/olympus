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
