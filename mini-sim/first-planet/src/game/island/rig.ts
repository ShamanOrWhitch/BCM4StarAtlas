import * as THREE from "three";

/**
 * Walking rig for the 3D crew on First Planet (BUG-005).
 *
 * The race models have no skeleton: each GLB is a flat list of parts
 * (thigh_-1, shin_-1, boot_-1, upper_leg_1, leg_-1_004, paw_1_011 ...), all in
 * one space with the feet at y = 0 and the toes towards +z. The rig groups
 * those parts into hip, knee and shoulder pivots measured from the mesh, and
 * poses them with the same generator the 2D cut-outs use in Tower and Ring
 * (window.BCMCrewRig from mini-sim/assets/js/crew-rig.js), so a race walks the
 * same way in every view. Phase advances by dt, never by the wall clock.
 */
export type CrewRig = {
  /** moving: false, true, or a speed multiplier (1 = walk, 2 = run). */
  update: (moving: boolean | number, dt?: number) => void;
};

type Pose = {
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  footL: number;
  footR: number;
  armL: number;
  armR: number;
  bob: number;
  sway: number;
};

type CrewRigApi = {
  rigProfile: (species: string, sex?: string) => unknown;
  stepPhase: (phase: number, dt: number, profile: unknown, moving: boolean | number) => number;
  walkPose: (phase: number, profile: unknown) => Pose;
};

/* Used only when crew-rig.js is not on the page (the standalone First Planet
   dev app). Same shape and joint signs as crew-rig.js walkPose. */
const FALLBACK: CrewRigApi = {
  rigProfile: () => null,
  stepPhase: (phase, dt, _profile, moving) => {
    const speed = Math.min(2, Math.max(0, typeof moving === "number" ? moving : moving ? 1 : 0));
    const rate = speed > 0 ? speed : 0.32;
    return (((phase + Math.max(0, dt) * rate) % 1) + 1) % 1;
  },
  walkPose: (phase) => {
    const t = phase * Math.PI * 2;
    const s = Math.sin(t);
    return {
      hipL: s * 0.5,
      hipR: -s * 0.5,
      kneeL: -Math.max(0, -s) * 0.9,
      kneeR: -Math.max(0, s) * 0.9,
      footL: Math.max(0, -s) * 0.35,
      footR: Math.max(0, s) * 0.35,
      armL: -s * 0.38,
      armR: s * 0.38,
      bob: Math.abs(Math.cos(t)) * 0.045,
      sway: s * 0.02,
    };
  },
};

function crewRigApi(): CrewRigApi {
  const api = (globalThis as { BCMCrewRig?: CrewRigApi }).BCMCrewRig;
  return api && typeof api.walkPose === "function" && typeof api.stepPhase === "function" ? api : FALLBACK;
}

type Box = { min: THREE.Vector3; max: THREE.Vector3 };

/** Name tokens without the numeric suffixes the exporter adds (leg_-1_004). */
function tokens(name: string) {
  return name
    .toLowerCase()
    .split(/[_\s.]+/)
    .filter((t) => t && !/^-?\d+$/.test(t));
}

const LOWER_LEG = ["knee", "shin", "boot", "foot", "paw"];
const ARM = ["sleeve", "arm", "forearm", "elbow", "glove", "hand", "fist", "wrist", "finger"];

export type LimbRole = "upperLeg" | "lowerLeg" | "arm" | null;

/** What a part is, from its name. Side comes from the mesh, not the name. */
export function limbRole(name: string): LimbRole {
  const lower = name.toLowerCase();
  const t = tokens(name);
  if (lower.includes("lower_leg") || t.some((x) => LOWER_LEG.includes(x))) return "lowerLeg";
  if (t.includes("thigh") || t.includes("leg") || t.includes("trouser")) return "upperLeg";
  if (t.some((x) => ARM.includes(x)) || lower.includes("bare_arm")) return "arm";
  return null;
}

function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const min = boxes[0].min.clone();
  const max = boxes[0].max.clone();
  for (const b of boxes) {
    min.min(b.min);
    max.max(b.max);
  }
  return { min, max };
}

type Joint = { pivot: THREE.Group; rest: THREE.Euler; side: number; kind: "hip" | "knee" | "foot" | "arm" };

export function bindCrewRig(root: THREE.Object3D, species = "", sex = ""): CrewRig {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const parts: Array<{ obj: THREE.Object3D; role: LimbRole; side: number; box: Box }> = [];
  for (const obj of [...root.children]) {
    const role = limbRole(obj.name);
    if (!role) continue;
    const world = new THREE.Box3().setFromObject(obj);
    if (world.isEmpty()) continue;
    const box = world.clone().applyMatrix4(toRoot);
    const cx = (box.min.x + box.max.x) / 2;
    // A part across the middle (one mesh for both legs) cannot swing alone.
    // (A thigh may overlap the middle by a few millimetres; that is still one side.)
    const across = Math.min(-box.min.x, box.max.x);
    if (Math.abs(cx) < 0.012 || across > Math.abs(cx) * 0.5) continue;
    parts.push({ obj, role, side: cx > 0 ? 1 : -1, box: { min: box.min, max: box.max } });
  }

  const joints: Joint[] = [];
  const pivotAt = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const pivot = new THREE.Group();
    pivot.name = "bcm_rig_pivot";
    pivot.position.set(x, y, z);
    parent.add(pivot);
    pivot.updateMatrixWorld(true);
    return pivot;
  };

  for (const side of [-1, 1]) {
    const upper = parts.filter((p) => p.side === side && p.role === "upperLeg");
    const lower = parts.filter((p) => p.side === side && p.role === "lowerLeg");
    const top = union(upper.map((p) => p.box));
    if (top && lower.length) {
      const cx = (top.min.x + top.max.x) / 2;
      const cz = (top.min.z + top.max.z) / 2;
      const hip = pivotAt(root, cx, top.max.y, cz);
      upper.forEach((p) => hip.attach(p.obj));
      joints.push({ pivot: hip, rest: hip.rotation.clone(), side, kind: "hip" });
      // A separate shin bends at the knee. A one-piece leg only flexes the foot.
      const shins = lower.filter((p) => /shin|lower_leg/.test(p.obj.name.toLowerCase()));
      const jointBox = union((shins.length ? shins : lower).map((p) => p.box))!;
      const kind = shins.length ? "knee" : "foot";
      const knee = pivotAt(hip, 0, 0, 0);
      knee.position.copy(hip.worldToLocal(root.localToWorld(new THREE.Vector3(cx, jointBox.max.y, cz))));
      knee.updateMatrixWorld(true);
      lower.forEach((p) => knee.attach(p.obj));
      joints.push({ pivot: knee, rest: knee.rotation.clone(), side, kind });
    }
    const arm = parts.filter((p) => p.side === side && p.role === "arm");
    const armBox = union(arm.map((p) => p.box));
    if (armBox) {
      const shoulder = pivotAt(
        root,
        (armBox.min.x + armBox.max.x) / 2,
        armBox.max.y,
        (armBox.min.z + armBox.max.z) / 2,
      );
      arm.forEach((p) => shoulder.attach(p.obj));
      joints.push({ pivot: shoulder, rest: shoulder.rotation.clone(), side, kind: "arm" });
    }
  }

  const api = crewRigApi();
  const profile = api.rigProfile(species, sex);
  const height = (() => {
    const b = new THREE.Box3().setFromObject(root).applyMatrix4(toRoot);
    return b.isEmpty() ? 1.7 : b.max.y - b.min.y;
  })();
  const baseY = root.position.y;
  const baseZ = root.rotation.z;
  const hasLegs = joints.some((j) => j.kind === "hip");
  let phase = 0;

  return {
    update(moving, dt = 1 / 60) {
      const step = Math.min(0.1, Math.max(0, Number(dt) || 0));
      const speed = typeof moving === "number" ? moving : moving ? 1 : 0;
      phase = api.stepPhase(phase, step, profile, speed);
      const walking = speed > 0;
      const pose = api.walkPose(phase, profile);
      // Standing: the idle phase still breathes, but the legs stay planted.
      const k = walking ? 1 : 0;
      for (const j of joints) {
        // The model faces +z and +x is its left, so L is side +1.
        const left = j.side > 0;
        // Positive pose angle = forward. Rotating about x by a negative angle
        // carries a hanging limb towards +z.
        let angle = 0;
        if (j.kind === "hip") angle = (left ? pose.hipL : pose.hipR) * k;
        else if (j.kind === "knee") angle = (left ? pose.kneeL : pose.kneeR) * k;
        else if (j.kind === "foot") angle = -(left ? pose.footL : pose.footR) * k;
        else angle = (left ? pose.armL : pose.armR) * (walking ? 1 : 0.08);
        j.pivot.rotation.set(j.rest.x - angle, j.rest.y, j.rest.z);
      }
      const scale = root.scale.y || 1;
      if (hasLegs) {
        root.position.y = baseY + pose.bob * height * scale * 0.35 * k;
        root.rotation.z = baseZ + pose.sway * k;
      } else {
        // No separable legs (one mesh for both): keep the old breathing body.
        root.position.y = baseY + pose.bob * height * scale * (walking ? 0.6 : 0.15);
        root.rotation.z = baseZ + pose.sway * (walking ? 1.5 : 0.4);
      }
    },
  };
}
