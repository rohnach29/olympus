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
