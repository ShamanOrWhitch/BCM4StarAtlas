/**
 * What Fable's living planet looks like (planet-rules.ts, owner 24.11.2026 "Живая планета Fable"):
 * glowing spore pods on the wild ground, and vines that rise round the pilot's feet while the planet
 * watches too closely. Plain shapes, shared geometry and materials; our own look.
 */
import * as THREE from "three";
import type { PlanetBody } from "./planet-rules";

export function createFableLook(
  scene: THREE.Scene,
  body: PlanetBody,
  ground: (x: number, z: number) => number,
  track: { geos: Set<THREE.BufferGeometry>; mats: Set<THREE.Material> },
) {
  const keep = <T extends THREE.BufferGeometry | THREE.Material>(item: T) => {
    if (item instanceof THREE.BufferGeometry) track.geos.add(item);
    else track.mats.add(item as THREE.Material);
    return item;
  };
  const root = new THREE.Group();
  root.name = "fable-living";
  scene.add(root);

  const podGeo = keep(new THREE.IcosahedronGeometry(0.42, 0));
  const stemGeo = keep(new THREE.CylinderGeometry(0.05, 0.09, 0.9, 5));
  const podMat = keep(new THREE.MeshBasicMaterial({ color: 0x9fffe0 }));
  const stemMat = keep(new THREE.MeshStandardMaterial({ color: 0x2f6a4a, roughness: 0.9 }));
  const pods = body.spores.map((sp) => {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.45;
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.y = 1.05;
    g.add(stem, pod);
    g.position.set(sp.x, ground(sp.x, sp.z), sp.z);
    root.add(g);
    return { g, pod };
  });

  // Vines: a ring of thin curling stalks that grows round the pilot while body.vines is on.
  const vineGeo = keep(new THREE.ConeGeometry(0.08, 1.4, 5));
  const vineMat = keep(new THREE.MeshStandardMaterial({ color: 0x7a2a8a, emissive: 0x3a0a4a, roughness: 0.8 }));
  const vines = new THREE.Group();
  vines.name = "fable-vines";
  const stalks = Array.from({ length: 9 }, (_, i) => {
    const stalk = new THREE.Mesh(vineGeo, vineMat);
    const a = (i / 9) * Math.PI * 2;
    stalk.position.set(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7);
    stalk.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    vines.add(stalk);
    return stalk;
  });
  vines.visible = false;
  root.add(vines);
  let grow = 0;

  function update(elapsed: number, dt: number, x: number, y: number, z: number) {
    body.spores.forEach((sp, i) => {
      const p = pods[i];
      p.g.visible = !sp.taken;
      if (!p.g.visible) return;
      const pulse = 1 + Math.sin(elapsed * 2.2 + i) * 0.18;
      p.pod.scale.setScalar(pulse);
      p.pod.rotation.y = elapsed * 0.9 + i;
    });
    grow = Math.max(0, Math.min(1, grow + (body.vines ? 1.6 : -2.5) * dt));
    vines.visible = grow > 0.02;
    if (vines.visible) {
      vines.position.set(x, y, z);
      stalks.forEach((stalk, i) => {
        const sway = Math.sin(elapsed * 3 + i) * 0.15;
        stalk.scale.set(1, grow * (0.8 + (i % 3) * 0.2), 1);
        stalk.position.y = 0.7 * grow * stalk.scale.y;
        stalk.rotation.y = sway;
      });
    }
  }

  return { update };
}
