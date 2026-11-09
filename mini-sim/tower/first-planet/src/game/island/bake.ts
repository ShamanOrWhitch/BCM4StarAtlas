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

/** Blockout vehicles are long on +X and the nose is +X. Turn that nose onto −Z, which is forward. */
export function faceForward(mesh: THREE.Object3D) {
  mesh.rotation.y = Math.PI / 2;
  return mesh;
}
