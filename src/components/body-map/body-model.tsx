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
    const geometries: THREE.BufferGeometry[] = [];
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geo = child.geometry.clone();
        child.updateWorldMatrix(true, false);
        geo.applyMatrix4(child.matrixWorld);
        geometries.push(geo);
      }
    });

    if (geometries.length === 0) return null;

    // Merge all geometries into one
    let merged: THREE.BufferGeometry;
    if (geometries.length === 1) {
      merged = geometries[0];
    } else {
      // Use BufferGeometryUtils to merge
      const { mergeGeometries } = require("three/examples/jsm/utils/BufferGeometryUtils.js");
      const result = mergeGeometries(geometries);
      if (!result) return null;
      merged = result;
    }

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

    // Dispose individual geometries after merging (if we merged)
    if (geometries.length > 1) {
      geometries.forEach((g) => g.dispose());
    }

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
