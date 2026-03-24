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
