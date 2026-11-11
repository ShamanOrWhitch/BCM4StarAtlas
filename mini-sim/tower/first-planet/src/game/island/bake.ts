import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const shared = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.76,
  metalness: 0.08,
  side: THREE.DoubleSide,
});

export function bake(root: THREE.Object3D, target: number, axis: "y" | "xz") {
  const parts: THREE.BufferGeometry[] = [];
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const src = mesh.geometry.clone();
    src.applyMatrix4(mesh.matrixWorld);
    const base = src.index ? src.toNonIndexed() : src;
    const pos = base.getAttribute("position");
    if (!pos || pos.count === 0) {
      src.dispose();
      return;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", pos.clone());
    const normal = base.getAttribute("normal");
    if (normal && normal.count === pos.count && normal.itemSize === 3) {
      out.setAttribute("normal", normal.clone());
    } else {
      out.computeVertexNormals();
    }
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const tint = new THREE.Color(0xffffff);
    if (mat && "color" in mat && mat.color) tint.copy(mat.color as THREE.Color);
    const existing = base.getAttribute("color");
    const colors = new Float32Array(pos.count * 3);
    const tinted = Boolean(existing && existing.count === pos.count);
    for (let i = 0; i < pos.count; i++) {
      let r = tint.r;
      let g = tint.g;
      let b = tint.b;
      if (tinted && existing) {
        r *= existing.getX(i);
        g *= existing.getY(i);
        b *= existing.getZ(i);
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    out.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(out);
    if (base !== src) base.dispose();
    src.dispose();
  });
  if (!parts.length) throw new Error("empty glb");
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error("merge failed");
  merged.computeBoundingBox();
  const box = merged.boundingBox;
  if (!box) throw new Error("no bounds");
  const size = new THREE.Vector3();
  box.getSize(size);
  const basis = axis === "y" ? size.y : Math.max(size.x, size.z);
  const scale = target / Math.max(0.001, basis);
  merged.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  merged.scale(scale, scale, scale);
  const mesh = new THREE.Mesh(merged, shared);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** Keep a GLB's own materials. Used for textured characters, not vertex-color props. */
export function fitHeight(root: THREE.Object3D, target: number) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = target / Math.max(0.001, size.y);
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  const center = fitted.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= fitted.min.y;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const standard = mat as THREE.MeshStandardMaterial;
      if (standard.metalness !== undefined) standard.metalness = 0;
      if (standard.roughness !== undefined) standard.roughness = Math.min(1, Math.max(standard.roughness, 0.62));
      if ("envMapIntensity" in standard) standard.envMapIntensity = 0;
    }
  });
  return root;
}

/** Sit a ship on its length, not its height. Flat hulls were becoming buildings. */
export function fitLength(root: THREE.Object3D, length: number) {
  root.updateMatrixWorld(true);
  const points: THREE.Vector3[] = [];
  const tmp = new THREE.Vector3();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 80));
    for (let i = 0; i < pos.count; i += step) {
      tmp.fromBufferAttribute(pos, i);
      points.push(mesh.localToWorld(tmp.clone()));
    }
  });
  if (points.length < 12) return false;
  const xs = points.map((p) => p.x).sort((a, b) => a - b);
  const zs = points.map((p) => p.z).sort((a, b) => a - b);
  const at = (arr: number[], t: number) => arr[Math.min(arr.length - 1, Math.floor(t * (arr.length - 1)))];
  const span = Math.max(at(xs, 0.97) - at(xs, 0.03), at(zs, 0.97) - at(zs, 0.03));
  const full = Math.max(xs[xs.length - 1] - xs[0], zs[zs.length - 1] - zs[0]);
  const basis = span > 0.05 ? span : full;
  if (!(basis > 0.05)) return false;
  root.scale.multiplyScalar(length / basis);
  root.updateMatrixWorld(true);
  const sized = new THREE.Box3().setFromObject(root);
  const sizedSpan = new THREE.Vector3();
  sized.getSize(sizedSpan);
  const long = Math.max(sizedSpan.x, sizedSpan.z);
  if (long > length * 1.06) {
    root.scale.multiplyScalar((length * 1.06) / long);
    root.updateMatrixWorld(true);
  }
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const standard = mat as THREE.MeshStandardMaterial;
      const label = `${mesh.name} ${standard.name || ""}`.toLowerCase();
      const glow = standard.emissive ? standard.emissive.r + standard.emissive.g + standard.emissive.b : 0;
      const glassy = standard.transparent || /glass|window|canopy|visor|cockpit|lamp|light|head|emissive/.test(label);
      standard.polygonOffset = true;
      standard.polygonOffsetFactor = glassy || glow > 0.2 ? -4 : 2;
      standard.polygonOffsetUnits = glassy || glow > 0.2 ? -4 : 2;
      standard.depthTest = true;
      if (!glassy) {
        standard.depthWrite = true;
        standard.side = THREE.FrontSide;
      }
      if (standard.metalness !== undefined) standard.metalness = Math.min(standard.metalness, 0.35);
    }
  });
  return true;
}

function namedPoint(root: THREE.Object3D, pattern: RegExp) {
  root.updateMatrixWorld(true);
  const acc = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let n = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !pattern.test(mesh.name || "")) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 40));
    for (let i = 0; i < pos.count; i += step) {
      tmp.fromBufferAttribute(pos, i);
      mesh.localToWorld(tmp);
      acc.add(tmp);
      n += 1;
    }
  });
  return n ? acc.multiplyScalar(1 / n) : null;
}

/** Point the nose at world −Z. That is forward for the chase camera and the race. A blind quarter-turn made Ruch drive backwards and the others drive sideways. */
export function aimNose(root: THREE.Object3D) {
  root.rotation.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const front = namedPoint(root, /front|nose|grille|hood|fork|headlamp|needle/i);
  const rear = namedPoint(root, /rear|tail|aft|exhaust|flame/i);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  let x = 1;
  let z = 0;
  if (front && rear) {
    x = front.x - rear.x;
    z = front.z - rear.z;
  } else if (front) {
    x = front.x - center.x;
    z = front.z - center.z;
  } else if (rear) {
    x = center.x - rear.x;
    z = center.z - rear.z;
  } else {
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.z > size.x * 1.2) {
      x = 0;
      z = 1;
    }
  }
  if (x * x + z * z < 1e-6) {
    x = 1;
    z = 0;
  }
  // Opal's generated "front" spar is the tail of the hull the pilot flies.
  // Leaving it there makes that one ship drive backwards.
  let opal = false;
  root.traverse((obj) => {
    if (/forward_pods|folded_pods/i.test(obj.name || "")) opal = true;
  });
  if (opal) {
    x = -x;
    z = -z;
  }
  root.rotation.y = Math.atan2(x, -z);
  return root;
}

function bakeTransform(root: THREE.Object3D) {
  root.updateMatrix();
  const q = root.quaternion.clone();
  root.rotation.set(0, 0, 0);
  root.quaternion.identity();
  root.updateMatrix();
  for (const child of root.children) {
    child.position.applyQuaternion(q);
    child.quaternion.premultiply(q);
  }
  root.updateMatrixWorld(true);
}

/** Nose on local −Z and root rotation identity, so a parent yaw is the only facing. */
export function settleNose(root: THREE.Object3D) {
  root.rotation.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > size.x * 1.2 && size.y > size.z * 1.2) {
    root.rotation.x = -Math.PI / 2;
    bakeTransform(root);
  }
  aimNose(root);
  bakeTransform(root);
  return root;
}

export function faceForward(mesh: THREE.Object3D) {
  return aimNose(mesh);
}
