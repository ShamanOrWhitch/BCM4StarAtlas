import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { bake, faceForward } from "./bake";
import { createSim, type Sim } from "./sim";
import { createSeededRandom } from "./seed";
import {
  BIKE_PARK,
  BRAZIERS,
  BRIDGE,
  CHEST,
  CRYSTALS,
  HOUSES,
  KEY_SPOT,
  NPC,
  RING,
  SKY,
  SPAWN,
  TOWER_GATE,
  footY,
  groundY,
  houseAabbs,
  type House,
} from "./terrain";

export type Phase = "gate" | "play" | "pause";

export type IslandWorld = {
  sim: Sim;
  frame: (now: number, phase: Phase) => void;
  paintMap: (canvas: HTMLCanvasElement) => void;
  resize: () => void;
  dispose: () => void;
};

function makeLabel(text: string) {
  const board = document.createElement("canvas");
  board.width = 512;
  board.height = 128;
  const ctx = board.getContext("2d");
  if (!ctx) return new THREE.Sprite();
  ctx.fillStyle = "rgba(16,32,39,0.8)";
  ctx.beginPath();
  ctx.roundRect(8, 28, 496, 72, 28);
  ctx.fill();
  ctx.fillStyle = "#f4efe4";
  ctx.font = "600 42px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(board);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(2.7, 0.68, 1);
  sprite.position.y = 2.3;
  return sprite;
}

function fireSprite() {
  const board = document.createElement("canvas");
  board.width = 64;
  board.height = 64;
  const ctx = board.getContext("2d");
  const tex = new THREE.CanvasTexture(board);
  if (ctx) {
    const g = ctx.createRadialGradient(32, 28, 2, 32, 28, 30);
    g.addColorStop(0, "rgba(255,226,170,0.95)");
    g.addColorStop(0.45, "rgba(226,91,58,0.55)");
    g.addColorStop(1, "rgba(226,91,58,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sprite.scale.set(1.5, 1.9, 1);
  return sprite;
}

function meshUrl(file: string, library = false) {
  const config =
    typeof window === "undefined"
      ? {}
      : (window as Window & {
          BCMFirstPlanetConfig?: { meshBase?: string; meshLibraryBase?: string };
        }).BCMFirstPlanetConfig ?? {};
  const sharedBase = library ? config.meshLibraryBase : config.meshBase;
  const encodedPath = file.split("/").map((part) => encodeURIComponent(part)).join("/");
  if (sharedBase) return sharedBase.replace(/\/?$/, "/") + encodedPath;

  const prefix =
    typeof window === "undefined"
      ? ""
      : (previewPathPrefix(window.location.hostname, window.location.pathname) ?? "");
  return prefix + (library ? "/mesh-library/" : "/mesh/") + encodedPath;
}

function sunSprite(color: string, size: number) {
  const board = document.createElement("canvas");
  board.width = 128;
  board.height = 128;
  const ctx = board.getContext("2d");
  const tex = new THREE.CanvasTexture(board);
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, color);
    g.addColorStop(0.4, color);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
  );
  sprite.scale.set(size, size, 1);
  return sprite;
}

export function createIsland(
  canvas: HTMLCanvasElement,
  onProps?: () => void,
  onLoadError?: (error: unknown) => void,
  context: { planetSeed?: number } = {},
): IslandWorld {
  const sim = createSim(Number(context.planetSeed) >>> 0);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  const host = canvas.parentElement ?? canvas;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc5d4df);
  scene.fog = new THREE.Fog(0xe7d3b0, 55, 210);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.12, 600);
  camera.position.set(16, 8, 58);

  const hemi = new THREE.HemisphereLight(0xffe6c4, 0x8a6246, 0.85);
  const sun = new THREE.DirectionalLight(0xffd7a1, 1.55);
  sun.position.set(40, 54, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 140;
  sun.shadow.camera.left = -36;
  sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 36;
  sun.shadow.camera.bottom = -36;
  scene.add(hemi, sun, sun.target);
  const fill = new THREE.DirectionalLight(0xe25b3a, 0.28);
  fill.position.set(-30, 20, -20);
  scene.add(fill);

  const gold = sunSprite("#ffd27a", 42);
  gold.position.set(90, 48, -30);
  const rose = sunSprite("#ff8d6a", 24);
  rose.position.set(-70, 36, -80);
  scene.add(gold, rose);

  const skyGeo = new THREE.SphereGeometry(420, 20, 12);
  const skyPos = skyGeo.getAttribute("position");
  const skyCol = new Float32Array(skyPos.count * 3);
  const top = new THREE.Color(0x8eb4c9);
  const mid = new THREE.Color(0xf0d2a8);
  const c = new THREE.Color();
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i) / 420;
    c.copy(mid).lerp(top, Math.min(1, Math.max(0, y * 0.85 + 0.15)));
    skyCol[i * 3] = c.r;
    skyCol[i * 3 + 1] = c.g;
    skyCol[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  scene.add(sky);

  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const track = (mesh: THREE.Mesh) => {
    geos.add(mesh.geometry);
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => mats.add(m));
    else mats.add(mat);
  };

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe0c7a2, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8d5340, roughness: 0.86 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc9ae84, roughness: 0.95 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb7aea0, roughness: 0.8 });
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0xd2b48c,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b3f2c, roughness: 0.8 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xe4a322,
    emissive: 0x6a4a10,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.2,
  });
  for (const m of [wallMat, roofMat, floorMat, stoneMat, pathMat, woodMat, goldMat]) mats.add(m);

  function addBox(
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
    yaw = 0,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(cx, cy, cz);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    track(mesh);
    scene.add(mesh);
    return mesh;
  }

  const span = 168;
  const n = 88;
  const groundGeo = new THREE.BufferGeometry();
  const gPos = new Float32Array((n + 1) * (n + 1) * 3);
  const gCol = new Float32Array((n + 1) * (n + 1) * 3);
  const sand = new THREE.Color(0xe0c092);
  const wet = new THREE.Color(0xb88858);
  const rock = new THREE.Color(0x8a6550);
  const grass = new THREE.Color(0x3f7d68);
  const index: number[] = [];
  for (let iz = 0; iz <= n; iz++) {
    for (let ix = 0; ix <= n; ix++) {
      const x = (ix / n - 0.5) * span;
      const z = (iz / n - 0.5) * span;
      const y = groundY(x, z);
      const o = (iz * (n + 1) + ix) * 3;
      gPos[o] = x;
      gPos[o + 1] = y;
      gPos[o + 2] = z;
      const slope = Math.abs(y - groundY(x + 1.2, z)) + Math.abs(y - groundY(x, z + 1.2));
      c.copy(sand);
      if (y < -0.15) c.lerp(wet, Math.min(1, (-0.15 - y) / 1.2));
      if (slope > 0.45) c.lerp(rock, Math.min(1, (slope - 0.45) / 0.8));
      if (Math.hypot(x - 2.4, z + 17) < 8 && y > -0.2 && y < 0.9) c.lerp(grass, 0.55);
      gCol[o] = c.r;
      gCol[o + 1] = c.g;
      gCol[o + 2] = c.b;
      if (ix < n && iz < n) {
        const a = iz * (n + 1) + ix;
        const b = a + 1;
        const d = a + (n + 1);
        const e = d + 1;
        index.push(a, d, b, b, d, e);
      }
    }
  }
  groundGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3));
  groundGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3));
  groundGeo.setIndex(index);
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  ground.receiveShadow = true;
  track(ground);
  scene.add(ground);

  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(420, 48),
    new THREE.MeshStandardMaterial({
      color: 0x1a6e82,
      roughness: 0.35,
      metalness: 0.08,
      transparent: true,
      opacity: 0.86,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.55;
  track(sea);
  scene.add(sea);

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.6, 0.1, 36), stoneMat);
  pad.position.set(0.4, groundY(0.4, 38) + 0.05, 38);
  pad.receiveShadow = true;
  track(pad);
  scene.add(pad);
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.08, 8, 40), goldMat);
  padRing.rotation.x = Math.PI / 2;
  padRing.position.set(0.4, groundY(0.4, 38) + 0.12, 38);
  track(padRing);
  scene.add(padRing);

  // A visible, walk-up Tower portal on the shared arrival pad.
  const towerGateY = groundY(TOWER_GATE.x, TOWER_GATE.z);
  const towerPortal = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.2, 14, 64),
    new THREE.MeshStandardMaterial({
      color: 0x8deaff,
      emissive: 0x1689b3,
      emissiveIntensity: 1.15,
      metalness: 0.52,
      roughness: 0.28,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    }),
  );
  towerPortal.position.set(TOWER_GATE.x, towerGateY + 3.05, TOWER_GATE.z - 2.35);
  track(towerPortal);
  scene.add(towerPortal);
  const towerPortalCore = new THREE.Mesh(
    new THREE.CircleGeometry(2.34, 48),
    new THREE.MeshBasicMaterial({
      color: 0x42bfe0,
      transparent: true,
      opacity: 0.17,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  towerPortalCore.position.set(TOWER_GATE.x, towerGateY + 3.05, TOWER_GATE.z - 2.31);
  track(towerPortalCore);
  scene.add(towerPortalCore);
  const towerPortalPostMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e6278,
    emissive: 0x12536c,
    emissiveIntensity: 0.5,
    metalness: 0.66,
    roughness: 0.34,
  });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.9, 0.42), towerPortalPostMaterial);
    post.position.set(TOWER_GATE.x + side * 2.55, towerGateY + 2.45, TOWER_GATE.z - 2.35);
    track(post);
    scene.add(post);
  }
  const towerPortalLabel = makeLabel("TOWER · ВХОД");
  towerPortalLabel.position.set(TOWER_GATE.x, towerGateY + 6.0, TOWER_GATE.z - 2.35);
  towerPortalLabel.scale.set(8.2, 2.05, 1);
  scene.add(towerPortalLabel);
  const towerPortalLight = new THREE.PointLight(0x54d7f4, 1.8, 18, 2);
  towerPortalLight.position.set(TOWER_GATE.x, towerGateY + 3.1, TOWER_GATE.z - 2.1);
  scene.add(towerPortalLight);

  for (let z = 30; z >= -6; z -= 4) {
    const y = groundY(0, z);
    addBox(0, y + 0.05, z, 3.1, 0.06, 3.6, pathMat);
  }

  for (const house of HOUSES) {
    const glow = new THREE.PointLight(0xffe2b8, 0.85, 10, 2);
    glow.position.set(house.x, groundY(house.x, house.z) + 2.15, house.z);
    scene.add(glow);
  }

  const archiveDoor = { mesh: null as THREE.Mesh | null };
  for (const house of HOUSES) {
    const boxes = houseAabbs(house, false);
    for (const box of boxes) {
      const sx = box.maxX - box.minX;
      const sy = box.maxY - box.minY;
      const sz = box.maxZ - box.minZ;
      const roof = box.minY > groundY(house.x, house.z) + 1.5;
      addBox(
        (box.minX + box.maxX) / 2,
        (box.minY + box.maxY) / 2,
        (box.minZ + box.maxZ) / 2,
        sx,
        sy,
        sz,
        roof ? roofMat : wallMat,
      );
    }
    const y0 = groundY(house.x, house.z);
    addBox(house.x, y0 + 0.04, house.z, house.w - 1.1, 0.08, house.d - 1.1, floorMat);
    dressDoor(house, y0);
    if (house.id === "archive") {
      const slab = doorSlab(house, y0);
      archiveDoor.mesh = slab;
    }
  }

  function dressDoor(house: House, y0: number) {
    const gap = 1.7;
    const top = y0 + 2.42;
    if (house.door === "e" || house.door === "w") {
      const x = house.door === "e" ? house.x + house.w / 2 : house.x - house.w / 2;
      addBox(x, top, house.z, 0.28, 0.16, gap, goldMat);
      addBox(x, y0 + 1.15, house.z - gap / 2, 0.22, 2.3, 0.16, goldMat);
      addBox(x, y0 + 1.15, house.z + gap / 2, 0.22, 2.3, 0.16, goldMat);
    } else {
      const z = house.door === "n" ? house.z + house.d / 2 : house.z - house.d / 2;
      addBox(house.x, top, z, gap, 0.16, 0.28, goldMat);
      addBox(house.x - gap / 2, y0 + 1.15, z, 0.16, 2.3, 0.22, goldMat);
      addBox(house.x + gap / 2, y0 + 1.15, z, 0.16, 2.3, 0.22, goldMat);
    }
  }

  function doorSlab(house: House, y0: number) {
    const x = house.x + house.w / 2 - 0.08;
    return addBox(x, y0 + 1.15, house.z, 0.16, 2.25, 1.58, woodMat);
  }

  addBox(-12.6, groundY(-12.6, 17) + 0.45, 16.2, 1.1, 0.7, 0.6, woodMat);
  addBox(12.2, groundY(12.2, 15) + 0.4, 14.2, 0.9, 0.55, 0.55, woodMat);
  addBox(-14.2, groundY(-14.2, -1.2) + 0.55, -2.4, 0.8, 0.9, 0.5, woodMat);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.11, 10, 36), goldMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(RING.x, groundY(RING.x, RING.z) + 2.3, RING.z);
  track(ring);
  scene.add(ring);

  const pilot = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x24343c, roughness: 0.7 });
  const suit = new THREE.MeshStandardMaterial({ color: 0xd7b48a, roughness: 0.62 });
  const visor = new THREE.MeshStandardMaterial({
    color: 0x17313b,
    emissive: 0xe4a322,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.5,
  });
  mats.add(cloth);
  mats.add(suit);
  mats.add(visor);
  const legGeo = new THREE.BoxGeometry(0.2, 0.62, 0.2);
  const legL = new THREE.Mesh(legGeo, cloth);
  legL.position.set(-0.13, 0.31, 0);
  const legR = new THREE.Mesh(legGeo, cloth);
  legR.position.set(0.13, 0.31, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.26), suit);
  torso.position.set(0, 0.82, 0);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), cloth);
  helm.position.set(0, 1.24, 0);
  const vis = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.06), visor);
  vis.position.set(0, 1.24, -0.16);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.14), goldMat);
  pack.position.set(0, 0.86, 0.18);
  pilot.add(legL, legR, torso, helm, vis, pack);
  pilot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      track(mesh);
    }
  });
  scene.add(pilot);

  const bike = new THREE.Group();
  bike.rotation.order = "YXZ";
  scene.add(bike);
  let bikeOff: THREE.Object3D | null = null;
  let bikeFull: THREE.Object3D | null = null;

  const crystalPivots: THREE.Object3D[] = [];
  const crystalMarkers: THREE.Object3D[] = [];
  let keyPivot: THREE.Object3D | null = null;
  let keyMarker: THREE.Object3D | null = null;
  const fireSprites: THREE.Object3D[] = [];
  const fireMarkers: THREE.Object3D[] = [];
  const fireLights: THREE.PointLight[] = [];
  let coinPivot: THREE.Object3D | null = null;
  const npcPivots: THREE.Object3D[] = [];

  const markerMat = new THREE.MeshStandardMaterial({
    color: 0xe4a322,
    emissive: 0xe4a322,
    emissiveIntensity: 0.55,
  });
  mats.add(markerMat);
  function marker(x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 5), markerMat);
    mesh.position.set(x, y, z);
    track(mesh);
    scene.add(mesh);
    return mesh;
  }

  const loader = new GLTFLoader();
  const loadMesh = async (url: string, target: number, axis: "y" | "xz") => {
    const gltf = await loader.loadAsync(url);
    const mesh = bake(gltf.scene, target, axis);
    track(mesh);
    return mesh;
  };
  const loadLibraryMesh = async (file: string, target: number, axis: "y" | "xz") => {
    try {
      return await loadMesh(meshUrl(file, true), target, axis);
    } catch (error) {
      // Scenery is optional: a missing decoration must never prevent landing.
      console.warn("First Planet desert prop skipped:", file, error);
      return null;
    }
  };

  let alive = true;
  const props = (async () => {
    const entries = await Promise.all([
      loadMesh(meshUrl("airbike_off.glb"), 1.15, "y"),
      loadMesh(meshUrl("airbike_full.glb"), 1.15, "y"),
      loadMesh(meshUrl("hovercar.glb"), 4.3, "xz"),
      loadMesh(meshUrl("spacebike.glb"), 3.5, "xz"),
      loadMesh(meshUrl("hooded.glb"), 1.74, "y"),
      loadMesh(meshUrl("one_eye.glb"), 1.7, "y"),
      loadMesh(meshUrl("sphere_bot.glb"), 1.55, "y"),
      loadMesh(meshUrl("crystal_amber.glb"), 1.7, "y"),
      loadMesh(meshUrl("crystal_cyan.glb"), 1.85, "y"),
      loadMesh(meshUrl("crystal_violet.glb"), 1.55, "y"),
      loadMesh(meshUrl("tree.glb"), 4.8, "y"),
      loadMesh(meshUrl("fence.glb"), 1.15, "y"),
      loadMesh(meshUrl("bridge.glb"), 1.05, "y"),
      loadMesh(meshUrl("lamp.glb"), 2.45, "y"),
      loadMesh(meshUrl("bench.glb"), 1.55, "xz"),
      loadMesh(meshUrl("brazier.glb"), 1.05, "y"),
      loadMesh(meshUrl("chest.glb"), 0.78, "y"),
      loadMesh(meshUrl("pot.glb"), 0.82, "y"),
      loadMesh(meshUrl("fern.glb"), 1.25, "y"),
      loadMesh(meshUrl("coral.glb"), 1.15, "y"),
      loadMesh(meshUrl("lily.glb"), 1.7, "xz"),
      loadMesh(meshUrl("key.glb"), 0.48, "xz"),
      loadMesh(meshUrl("coin.glb"), 0.32, "xz"),
      loadMesh(meshUrl("potion.glb"), 0.42, "y"),
      loadMesh(meshUrl("rune.glb"), 1.2, "y"),
      loadMesh(meshUrl("mushrooms.glb"), 1.25, "y"),
      loadMesh(meshUrl("orb.glb"), 0.7, "y"),
      loadMesh(meshUrl("bud.glb"), 1.15, "y"),
      loadMesh(meshUrl("float_isle.glb"), 13, "xz"),
    ]);
    if (!alive) return;
    const [
      airOff,
      airFull,
      hover,
      space,
      hooded,
      eye,
      bulb,
      amber,
      cyan,
      violet,
      tree,
      fence,
      bridge,
      lamp,
      bench,
      brazier,
      chest,
      pot,
      fern,
      coral,
      lily,
      key,
      coin,
      potion,
      rune,
      shroom,
      orb,
      bud,
      isle,
    ] = entries;

    // Desert props come from the shared mesh library. Each multi-part GLB is
    // baked to a single mesh before instancing, keeping draw calls bounded.
    // Load optional desert scenery in small batches: the planet may warm up
    // while Tower is active, but its hidden preparation must not flood requests.
    const desertRequests: Array<[string, number, "y" | "xz"]> = [
      ["desert_pack01/cactus_tall.glb", 2.9, "y"],
      ["desert_pack01/cactus_cluster.glb", 3.7, "y"],
      ["desert_pack01/barrel_cactus_flower.glb", 1.55, "y"],
      ["desert_pack01/sandstone_boulders.glb", 2.7, "xz"],
      ["desert_pack01/sandstone_arch.glb", 4.6, "y"],
      ["desert_pack01/stepped_desert_temple.glb", 4.4, "y"],
      ["desert_pack01/desert_market_awning.glb", 6.8, "xz"],
      ["desert_pack01/dead_desert_tree.glb", 4.1, "y"],
      ["desert_pack01/small_oasis.glb", 5.8, "xz"],
      ["desert_pack01/sandstone_column.glb", 2.1, "y"],
      ["desert_pack01/desert_race_banner.glb", 3.3, "y"],
      ["desert_details/shrub_dry.glb", 1.55, "y"],
      ["desert_details/shrub_green.glb", 1.55, "y"],
      ["desert_details/shrub_sage.glb", 1.5, "y"],
      ["desert_details/cairn_wide.glb", 1.45, "y"],
      ["desert_details/cairn_tall.glb", 2.0, "y"],
      ["desert_details/cactus_branching.glb", 2.65, "y"],
      ["desert_details/rocks_gray.glb", 2.45, "xz"],
      ["desert_oasis_pack/desert_oasis_pack/oasis_orchid_palms.glb", 11.8, "xz"],
      ["desert_oasis_pack/desert_oasis_pack/oasis_flower_garden.glb", 11.2, "xz"],
      ["desert_oasis_pack/desert_oasis_pack/rare_turquoise_bloom.glb", 1.85, "y"],
      ["desert_oasis_pack/desert_oasis_pack/orchid_pink.glb", 1.5, "y"],
      ["desert_oasis_pack/desert_oasis_pack/orchid_white.glb", 1.5, "y"],
    ];
    const desertEntries: Array<THREE.Mesh | null> = [];
    for (let i = 0; i < desertRequests.length; i += 4) {
      const batch = await Promise.all(
        desertRequests.slice(i, i + 4).map(([file, target, axis]) =>
          loadLibraryMesh(file, target, axis),
        ),
      );
      desertEntries.push(...batch);
      if (!alive) return;
    }
    if (!alive) return;
    const [
      cactusTall,
      cactusCluster,
      barrelCactus,
      sandstoneBoulders,
      sandstoneArch,
      desertTemple,
      marketAwning,
      deadDesertTree,
      smallOasis,
      sandstoneColumn,
      raceBanner,
      shrubDry,
      shrubGreen,
      shrubSage,
      cairnWide,
      cairnTall,
      cactusBranching,
      grayRocks,
      oasisPalms,
      oasisGarden,
      rareBloom,
      orchidPink,
      orchidWhite,
    ] = desertEntries;
    faceForward(airOff);
    faceForward(airFull);
    faceForward(hover);
    faceForward(space);
    bikeOff = airOff;
    bikeFull = airFull;
    bike.add(airOff, airFull);

    const drop = (mesh: THREE.Object3D, x: number, z: number, yaw = 0, y?: number) => {
      const pivot = new THREE.Group();
      pivot.add(mesh.clone());
      pivot.position.set(x, y ?? groundY(x, z), z);
      pivot.rotation.y = yaw;
      scene.add(pivot);
      return pivot;
    };

    type DesertSpot = { x: number; z: number; yaw: number; scale: number };
    const seededSpots = (
      anchors: ReadonlyArray<readonly [number, number]>,
      salt: string,
      jitter = 1.6,
      minScale = 0.84,
      maxScale = 1.16,
    ): DesertSpot[] => {
      const random = createSeededRandom(planetSeed, salt);
      return anchors.map(([x, z]) => ({
        x: x + (random() - 0.5) * jitter,
        z: z + (random() - 0.5) * jitter,
        yaw: random() * Math.PI * 2,
        scale: minScale + random() * (maxScale - minScale),
      }));
    };
    const scatter = (
      source: THREE.Mesh | null,
      spots: DesertSpot[],
      castShadow = false,
    ) => {
      if (!source || spots.length === 0) return;
      const instances = new THREE.InstancedMesh(source.geometry, source.material, spots.length);
      const transform = new THREE.Object3D();
      spots.forEach((spot, index) => {
        transform.position.set(spot.x, groundY(spot.x, spot.z), spot.z);
        transform.rotation.set(0, spot.yaw, 0);
        transform.scale.setScalar(spot.scale);
        transform.updateMatrix();
        instances.setMatrixAt(index, transform.matrix);
      });
      instances.instanceMatrix.needsUpdate = true;
      instances.castShadow = castShadow;
      instances.receiveShadow = true;
      instances.computeBoundingBox();
      instances.computeBoundingSphere();
      track(instances);
      scene.add(instances);
    };

    drop(hover, 21.2, 30.8, 2.4);
    drop(space, -8.4, 32.4, -0.4);

    const sera = drop(hooded, NPC.sera.x, NPC.sera.z, NPC.sera.yaw);
    sera.add(makeLabel(NPC.sera.name));
    const orr = drop(eye, NPC.orr.x, NPC.orr.z, NPC.orr.yaw);
    orr.add(makeLabel(NPC.orr.name));
    const lampNpc = drop(bulb, NPC.bulb.x, NPC.bulb.z, NPC.bulb.yaw);
    lampNpc.add(makeLabel(NPC.bulb.name));
    npcPivots.push(sera, orr, lampNpc);

    const crystals = [amber, cyan, violet];
    CRYSTALS.forEach((spot, i) => {
      const pivot = drop(crystals[i % crystals.length], spot.x, spot.z, i);
      crystalPivots.push(pivot);
      crystalMarkers.push(marker(spot.x, groundY(spot.x, spot.z) + 2.4, spot.z));
    });
    drop(amber, -20, 24, 0.4).scale.setScalar(0.55);
    drop(violet, 27, 12, 1.2).scale.setScalar(0.5);
    drop(cyan, -18, -30, 0.8).scale.setScalar(0.62);

    keyPivot = drop(key, KEY_SPOT.x, KEY_SPOT.z, 0.6);
    keyMarker = marker(KEY_SPOT.x, groundY(KEY_SPOT.x, KEY_SPOT.z) + 1.4, KEY_SPOT.z);

    const trees = [
      [-20, 30],
      [-24, 6],
      [20, 27],
      [26, 6],
      [-18, -30],
      [12, -32],
      [32, 18],
      [-8, 26],
      [18, -6],
      [-30, 8],
      [8, 22],
      [-16, 4],
    ];
    trees.forEach(([x, z], i) => drop(tree, x, z, i * 0.8));

    for (let z = 24; z <= 32; z += 2.4) {
      drop(fence, -5.4, z, Math.PI / 2);
      drop(fence, 5.4, z, Math.PI / 2);
    }
    for (let i = 0; i < 4; i++) {
      const z = BRIDGE.z0 + 1.2 + i * 2.7;
      drop(bridge, BRIDGE.x, z, Math.PI / 2, -0.05);
    }
    const lamps = [
      [-4.2, 26],
      [4.2, 20],
      [-4.2, 8],
      [4.4, -2],
    ];
    lamps.forEach(([x, z]) => drop(lamp, x, z, 0));
    drop(bench, 2.4, 6.4, 0.2);
    drop(bench, -2.2, 5.2, 2.6);
    BRAZIERS.forEach((spot, i) => {
      const y = i === 1 ? BRIDGE.deck : groundY(spot.x, spot.z);
      drop(brazier, spot.x, spot.z, i, y);
      const flame = fireSprite();
      flame.position.set(spot.x, y + 1.15, spot.z);
      scene.add(flame);
      fireSprites.push(flame);
      fireMarkers.push(marker(spot.x, y + 1.8, spot.z));
      const light = new THREE.PointLight(0xff8a3c, 0, 7, 2);
      light.position.set(spot.x, y + 1.3, spot.z);
      scene.add(light);
      fireLights.push(light);
    });
    drop(chest, CHEST.x, CHEST.z, 0.4);
    coinPivot = drop(coin, CHEST.x + 0.35, CHEST.z + 0.2, 0);
    drop(pot, -6.5, 18.6, 0.3);
    drop(pot, 8.2, 16.4, 1);
    drop(pot, -7.2, 0.4, 0.6);
    drop(potion, -12.4, 16.6, 0.2);
    drop(rune, -8.2, -3.4, 0.5);
    drop(shroom, -22, -8, 0.4);
    drop(shroom, 16, -28, 1.1);
    drop(fern, -3.5, 22, 0.8);
    drop(fern, 3.2, 12, 1.4);
    drop(fern, -8, -8, 0.2);
    drop(coral, 6.2, -15.4, 0.5, -0.25);
    drop(coral, -0.6, -19.2, 1.2, -0.35);
    drop(lily, 3.6, -16.8, 0.4, -0.32);
    drop(lily, 1.1, -18.6, 1.5, -0.32);

    // The village square gets a market canopy and a sandstone entrance marker.
    if (marketAwning) drop(marketAwning, 8.2, 23.8, -0.12);
    if (sandstoneArch) drop(sandstoneArch, -24.5, 1.8, Math.PI / 2);
    if (desertTemple) drop(desertTemple, 37.5, -8.5, 0.35);
    if (smallOasis) drop(smallOasis, 29, -25, 0.42).scale.setScalar(0.86);
    if (cairnTall) drop(cairnTall, -41, -7.2, 0.8);

    // Keep the ring approach corridor open; banners frame it from both sides.
    // Two distinct planted-water clearings extend the existing oasis basin.
    if (oasisPalms) drop(oasisPalms, -8.7, -18.2, 0.24).scale.setScalar(0.96);
    if (oasisGarden) drop(oasisGarden, 13.8, -18.6, -0.36).scale.setScalar(0.9);
    if (rareBloom) drop(rareBloom, 8.7, -25.2, 0.3);
    if (orchidPink) drop(orchidPink, -11.5, -24.1, 1.1).scale.setScalar(0.9);
    if (orchidWhite) drop(orchidWhite, 16.8, -24.8, 2.1).scale.setScalar(0.9);

    // Repeated scenery uses one InstancedMesh per model family. The dedicated
    // salts keep decoration deterministic without consuming quest/route RNG.
    scatter(cactusTall, seededSpots(
      [[-38, 17], [37, 17], [-39, -3], [41, -13], [24, -34]],
      "desert-cactus-tall",
      2.6,
      0.9,
      1.14,
    ), true);
    scatter(cactusCluster, seededSpots(
      [[32, 27], [44, 3], [-42, -20], [-34, 30]],
      "desert-cactus-cluster",
      2.2,
      0.86,
      1.12,
    ), true);
    scatter(barrelCactus, seededSpots(
      [[25, 16], [-23, 20], [35, -31], [-36, -6]],
      "desert-barrel-cactus",
      1.8,
      0.82,
      1.2,
    ));
    scatter(cactusBranching, seededSpots(
      [[19, -28], [-29, 5], [-41, 8]],
      "desert-cactus-branching",
      2.0,
      0.9,
      1.15,
    ), true);
    scatter(shrubDry, seededSpots(
      [[-18, 24], [18, 23], [-19.5, -8], [20, -11], [-31, 1]],
      "desert-shrub-dry",
      2.1,
      0.85,
      1.16,
    ));
    scatter(shrubGreen, seededSpots(
      [[-18, 17], [18, 16], [-19, -1], [19, -5]],
      "desert-shrub-green",
      1.7,
      0.84,
      1.14,
    ));
    scatter(shrubSage, seededSpots(
      [[-9, -24], [8, -26], [-20, -18], [18, -17]],
      "desert-shrub-sage",
      1.8,
      0.9,
      1.13,
    ));
    scatter(sandstoneBoulders, seededSpots(
      [[-28, 18], [25, 8], [-25, -30], [34, -31]],
      "desert-sandstone-boulders",
      2.8,
      0.9,
      1.2,
    ));
    scatter(grayRocks, seededSpots(
      [[25, -12], [-28, 4], [40, 20]],
      "desert-gray-rocks",
      2.0,
      0.9,
      1.15,
    ));
    scatter(cairnWide, seededSpots(
      [[-36, -33], [40, -20], [-41, 10]],
      "desert-cairns",
      1.8,
      0.9,
      1.1,
    ));
    scatter(deadDesertTree, seededSpots(
      [[-28, 24], [30, 26], [38, -10]],
      "desert-dead-trees",
      2.4,
      0.86,
      1.18,
    ), true);
    scatter(sandstoneColumn, seededSpots(
      [[-28.4, 8.8], [42.5, 17.8], [35.5, -32.8]],
      "desert-sandstone-columns",
      0.8,
      0.92,
      1.08,
    ));
    scatter(raceBanner, seededSpots(
      [[-9.2, -36.5], [9.2, -36.5]],
      "desert-race-banners",
      0.5,
      0.96,
      1.04,
    ));

    isle.geometry.computeBoundingBox();
    const isleH = isle.geometry.boundingBox?.max.y ?? 4;
    const skyPivot = new THREE.Group();
    skyPivot.add(isle);
    skyPivot.position.set(SKY.x, SKY.y - isleH, SKY.z);
    scene.add(skyPivot);
    drop(orb, SKY.x + 1.3, SKY.z + 0.5, 0, SKY.y);
    drop(bud, SKY.x - 1.5, SKY.z - 0.8, 0.7, SKY.y);
    const skyLight = new THREE.PointLight(0x8fd0ff, 1.4, 16, 2);
    skyLight.position.set(SKY.x + 1.3, SKY.y + 1.2, SKY.z);
    scene.add(skyLight);
    onProps?.();
  })().catch((err) => {
    console.error(err);
    onLoadError?.(err);
  });
  void props;

  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const lookSmoothed = new THREE.Vector3(1, 1.4, 34);
  let last = performance.now();
  let acc = 0;
  let prevPhase: Phase = "gate";
  let elapsed = 0;

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();
  const observer = new ResizeObserver(() => resize());
  observer.observe(host);

  function pullCam(cam: THREE.Vector3) {
    const px = sim.x;
    const py = sim.y + 1.25;
    const pz = sim.z;
    const dx = cam.x - px;
    const dy = cam.y - py;
    const dz = cam.z - pz;
    let scale = 1;
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const x = px + dx * t;
      const y = py + dy * t;
      const z = pz + dz * t;
      for (const box of sim.walls) {
        if (y < box.minY || y > box.maxY) continue;
        if (x < box.minX || x > box.maxX) continue;
        if (z < box.minZ || z > box.maxZ) continue;
        scale = Math.min(scale, Math.max(0.18, (i - 1) / 10));
      }
    }
    cam.x = px + dx * scale;
    cam.y = py + dy * scale;
    cam.z = pz + dz * scale;
  }

  function frame(now: number, phase: Phase) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    if (phase === "play") {
      acc += dt;
      if (acc > 0.2) acc = 0.2;
      const step = 1 / 60;
      while (acc >= step) {
        sim.step(step);
        acc -= step;
      }
    } else acc = 0;

    const snapping = prevPhase !== "play" && phase === "play";
    prevPhase = phase;

    const bob = Math.sin(elapsed * 2.2);
    pilot.visible = sim.mode === "foot";
    pilot.position.set(sim.x, sim.mode === "foot" ? sim.y : footY(sim.x, sim.z, sim.y), sim.z);
    pilot.rotation.y = sim.yaw;
    pilot.position.y += sim.mode === "foot" && Math.abs(sim.speed) > 0.35 ? Math.abs(Math.sin(elapsed * 11)) * 0.05 : 0;

    if (sim.mode === "bike") {
      bike.position.set(sim.x, sim.y, sim.z);
      bike.rotation.y = sim.yaw;
      bike.rotation.z = -sim.steer * 0.18;
    } else {
      bike.position.set(sim.bikeX, groundY(sim.bikeX, sim.bikeZ), sim.bikeZ);
      bike.rotation.y = sim.bikeYaw;
      bike.rotation.z = 0;
    }
    const blazing = sim.mode === "bike" && Math.abs(sim.speed) > 2.4;
    if (bikeOff) bikeOff.visible = !blazing;
    if (bikeFull) bikeFull.visible = blazing;

    crystalPivots.forEach((pivot, i) => {
      pivot.visible = !sim.crystals[i];
      pivot.rotation.y += dt * 0.4;
      const mark = crystalMarkers[i];
      if (mark) mark.visible = sim.quests.sera === "go" && !sim.crystals[i];
      if (mark?.visible) mark.position.y = groundY(CRYSTALS[i].x, CRYSTALS[i].z) + 2.35 + bob * 0.12;
    });
    if (keyPivot) {
      keyPivot.visible = !sim.key;
      keyPivot.rotation.y += dt * 0.8;
    }
    if (keyMarker) {
      keyMarker.visible = sim.quests.orr === "go" && !sim.key;
      keyMarker.position.y = groundY(KEY_SPOT.x, KEY_SPOT.z) + 1.35 + bob * 0.1;
    }
    fireSprites.forEach((flame, i) => {
      flame.visible = sim.fires[i];
      flame.scale.setScalar(sim.fires[i] ? 1 + Math.sin(elapsed * 7 + i) * 0.08 : 1);
      const light = fireLights[i];
      if (light) light.intensity = sim.fires[i] ? 2.2 : 0;
      const mark = fireMarkers[i];
      if (mark) mark.visible = sim.quests.bulb === "go" && !sim.fires[i];
    });
    if (coinPivot) coinPivot.visible = sim.chest;
    if (archiveDoor.mesh) archiveDoor.mesh.visible = sim.quests.orr !== "done";
    npcPivots.forEach((pivot, i) => {
      const base = groundY(pivot.position.x, pivot.position.z);
      pivot.position.y = base + Math.sin(elapsed * 1.6 + i) * 0.03;
    });
    if (coinPivot?.visible) coinPivot.rotation.y += dt;

    const fx = -Math.sin(sim.yaw);
    const fz = -Math.cos(sim.yaw);
    if (phase !== "play") {
      desired.set(14, 7.6, 56);
      look.set(BIKE_PARK.x, 1.3, BIKE_PARK.z - 2);
    } else {
      const dist = sim.mode === "bike" ? 8.4 : 5.2;
      const height = sim.mode === "bike" ? 3.15 : 2.2;
      desired.set(sim.x - fx * dist, sim.y + height, sim.z - fz * dist);
      look.set(sim.x + fx * 1.6, sim.y + 1.2, sim.z + fz * 1.6);
      pullCam(desired);
    }
    const k = snapping ? 1 : 1 - Math.exp(-4.2 * dt);
    camera.position.lerp(desired, k);
    lookSmoothed.lerp(look, k);
    camera.lookAt(lookSmoothed);

    sun.position.set(sim.x + 36, 50, sim.z + 18);
    sun.target.position.set(sim.x, 0, sim.z);
    sky.position.copy(camera.position);

    renderer.render(scene, camera);
  }

  function paintMap(canvasMap: HTMLCanvasElement) {
    const ctx = canvasMap.getContext("2d");
    if (!ctx) return;
    const w = canvasMap.width;
    const h = canvasMap.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(16,32,39,0.72)";
    ctx.fillRect(0, 0, w, h);
    const scale = 48;
    const toX = (x: number) => w / 2 + ((x - sim.x) / scale) * w;
    const toY = (z: number) => h / 2 - ((z - sim.z) / scale) * h;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(226,163,34,0.7)";
    ctx.lineWidth = 2;
    for (let a = 0; a <= 32; a++) {
      const ang = (a / 32) * Math.PI * 2;
      const x = Math.cos(ang) * 54;
      const z = Math.sin(ang) * 54;
      if (a === 0) ctx.moveTo(toX(x), toY(z));
      else ctx.lineTo(toX(x), toY(z));
    }
    ctx.stroke();
    ctx.fillStyle = "#e4a322";
    for (const house of HOUSES) {
      ctx.fillRect(toX(house.x) - 3, toY(house.z) - 3, 6, 6);
    }
    ctx.fillStyle = "#8fd0c8";
    ctx.beginPath();
    ctx.arc(toX(SKY.x), toY(SKY.z), 3, 0, Math.PI * 2);
    ctx.fill();
    const fx = -Math.sin(sim.yaw);
    const fz = -Math.cos(sim.yaw);
    ctx.strokeStyle = "#f4efe4";
    ctx.beginPath();
    ctx.moveTo(toX(sim.x), toY(sim.z));
    ctx.lineTo(toX(sim.x + fx * 3.2), toY(sim.z + fz * 3.2));
    ctx.stroke();
  }

  function dispose() {
    alive = false;
    observer.disconnect();
    renderer.dispose();
    geos.forEach((geo) => geo.dispose());
    mats.forEach((mat) => mat.dispose());
    scene.traverse((obj) => {
      const sprite = obj as THREE.Sprite;
      if (sprite.isSprite) {
        const mat = sprite.material;
        mat.map?.dispose();
        mat.dispose();
      }
    });
  }

  // Keep spawn referenced so the pad and the pilot share one origin story.
  pilot.position.set(SPAWN.x, footY(SPAWN.x, SPAWN.z, 0), SPAWN.z);

  return { sim, frame, paintMap, resize, dispose };
}
