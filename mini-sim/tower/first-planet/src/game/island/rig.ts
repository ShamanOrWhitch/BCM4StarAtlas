import * as THREE from "three";

export type CrewRig = {
  update: (moving: boolean) => void;
};

function partNamed(root: THREE.Object3D, parts: string[]): THREE.Object3D | null {
  const hits: THREE.Object3D[] = [];
  root.traverse((obj) => {
    const name = obj.name.toLowerCase();
    if (parts.some((part) => name.includes(part))) hits.push(obj);
  });
  return hits[0] ?? null;
}

/**
 * Internal rig. If the mesh has hips/spine/arms, those bones swing.
 * Otherwise the whole body breathes, so a later Mixamo clip can replace this
 * without changing who calls update().
 */
export function bindCrewRig(root: THREE.Object3D): CrewRig {
  const hips = partNamed(root, ["hips", "pelvis"]);
  const spine = partNamed(root, ["spine", "torso"]);
  const armL = partNamed(root, ["sleeve_-1", "shoulder_-1", "leftarm", "arm_l"]);
  const armR = partNamed(root, ["sleeve_1", "shoulder_1", "rightarm", "arm_r"]);
  const rest = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const bone of [hips, spine, armL, armR]) {
    if (bone) rest.set(bone, bone.quaternion.clone());
  }
  const baseY = root.position.y;
  const swing = new THREE.Quaternion();
  return {
    update(moving) {
      const amp = moving ? 1 : 0.35;
      const wave = Math.sin(performance.now() / 1000 * (moving ? 8 : 2.2));
      if (!hips && !spine && !armL && !armR) {
        root.position.y = baseY + wave * 0.03 * amp;
        root.rotation.z = wave * 0.035 * amp;
        return;
      }
      if (hips) {
        swing.setFromEuler(new THREE.Euler(wave * 0.08 * amp, 0, 0));
        hips.quaternion.copy(rest.get(hips)!).multiply(swing);
      }
      if (spine) {
        swing.setFromEuler(new THREE.Euler(0, 0, wave * 0.05 * amp));
        spine.quaternion.copy(rest.get(spine)!).multiply(swing);
      }
      if (armL) {
        swing.setFromEuler(new THREE.Euler(wave * 0.4 * amp, 0, 0));
        armL.quaternion.copy(rest.get(armL)!).multiply(swing);
      }
      if (armR) {
        swing.setFromEuler(new THREE.Euler(-wave * 0.4 * amp, 0, 0));
        armR.quaternion.copy(rest.get(armR)!).multiply(swing);
      }
    },
  };
}
