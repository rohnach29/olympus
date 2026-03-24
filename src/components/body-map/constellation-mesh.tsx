"use client";

import { useMemo, useRef, useEffect } from "react";
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
