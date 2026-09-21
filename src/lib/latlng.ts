import * as THREE from "three";

const DEG = Math.PI / 180;

/** three-globe convention: lat/lng on a Y-up sphere. */
export function latLngToVec3(lat: number, lng: number, radius: number, target = new THREE.Vector3()) {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  target.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
  return target;
}
