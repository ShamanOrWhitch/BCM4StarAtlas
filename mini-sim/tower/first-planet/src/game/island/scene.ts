import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { bake, settleNose, fitHeight, fitLength } from "./bake";
import { bindCrewRig, type CrewRig } from "./rig";
import { ASTEROID_SHOW, characterHeight, characterPath, PILOT_SHIPS, pilotShip, shipUrl } from "@/game/ships";
import { meshUrl, propUrl } from "../mesh-url";
import { activeKeys } from "../input";
import { createSim, type Sim } from "./sim";
import {
  BIKE_PARK,
  BRAZIERS,
  BRIDGE,
  CHEST,
  CRYSTALS,
  HOUSES,
  JAHMAN,
  KEY_SPOT,
  NPC,
  RING,
  SKY,
  SPAWN,
  STORY_BOX,
  TAPES,
  TERRAIN_N,
  TERRAIN_SPAN,
  TOWER_GATE,
  footY,
  groundY,
  houseAabbs,
  onSky,
  surfaceY,
  type House,
} from "./terrain";

export type Phase = "gate" | "play" | "pause";

export type IslandWorld = {
  sim: Sim;
  frame: (now: number, phase: Phase) => void;
  paintMap: (canvas: HTMLCanvasElement) => void;
  resize: () => void;
  dispose: () => void;
  applyShip: (id?: string) => void;
  toggleTapeScreen: () => void;
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

type MaxhogController = {
  setMode: (mode: string) => unknown;
  setThrust: (value: number) => unknown;
  setGroundSpeed: (value: number) => unknown;
  setFlightMotion: (forward: number, vertical: number) => unknown;
  update: (time: number) => unknown;
  dispose: () => void;
};

let maxhogControlsScript: Promise<void> | null = null;

async function createMaxhogController(root: THREE.Object3D, mode: "pad" | "flight" = "pad") {
  const getFactory = () => (window as Window & {
    createMaxhogControls?: (root: THREE.Object3D, options?: { mode?: string }) => MaxhogController;
  }).createMaxhogControls;
  if (!getFactory()) {
    if (!maxhogControlsScript) {
      maxhogControlsScript = new Promise<void>((resolve, reject) => {
        const url = shipUrl("ships/xsmall/maxhog/maxhog_controls.js");
        const existing = document.querySelector<HTMLScriptElement>('script[data-bcm-maxhog-controls]');
        const script = existing || document.createElement("script");
        if (existing?.dataset.loaded === "true" && getFactory()) {
          resolve();
          return;
        }
        script.addEventListener("load", () => {
          script.dataset.loaded = "true";
          if (getFactory()) resolve();
          else reject(new Error("Max Hog controller factory missing"));
        }, { once: true });
        script.addEventListener("error", () => reject(new Error("Max Hog controller failed to load")), { once: true });
        if (!existing) {
          script.src = url;
          script.async = true;
          script.dataset.bcmMaxhogControls = "true";
          document.head.appendChild(script);
        }
      });
    }
    await maxhogControlsScript;
  }
  const factory = getFactory();
  if (!factory) throw new Error("Max Hog controller factory is unavailable");
  return factory(root, { mode });
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
  context: { planetSeed?: number; players?: Array<{ species?: string; name?: string }>; shipId?: string } = {},
): IslandWorld {
  const sim = createSim(Number(context.planetSeed) >>> 0);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  const host = canvas.parentElement ?? canvas;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xff7a3c);
  scene.fog = new THREE.Fog(0xe56a3a, 48, 200);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.12, 600);
  camera.position.set(16, 8, 58);
  // Point lights live on layer 1 and only touch the mesh they belong to.
  // The ground and sea stay on layer 0, so a brazier does not relight the whole island.
  const LOCAL = 1;
  camera.layers.enable(LOCAL);

  const hemi = new THREE.HemisphereLight(0xffc4a0, 0x7a3a32, 0.95);
  const gold = sunSprite("#ffe08a", 58);
  gold.position.set(78, 42, -40);
  const rose = sunSprite("#ff6a4a", 30);
  rose.position.set(-62, 30, -90);
  scene.add(gold, rose);
  // Specular on the water follows these lights. They sit on the sprites,
  // otherwise the glint lands to the left of the sun you actually see.
  const sun = new THREE.DirectionalLight(0xffb15a, 1.35);
  sun.position.copy(gold.position);
  sun.target.position.set(0, -0.55, 0);
  sun.castShadow = false;
  const fill = new THREE.DirectionalLight(0xffc4a0, 0.16);
  fill.position.copy(rose.position);
  fill.target.position.set(0, -0.55, 0);
  scene.add(hemi, sun, sun.target, fill, fill.target);

  const skyGeo = new THREE.SphereGeometry(420, 20, 12);
  const skyPos = skyGeo.getAttribute("position");
  const skyCol = new Float32Array(skyPos.count * 3);
  const top = new THREE.Color(0x3d245c);
  const mid = new THREE.Color(0xff7a3a);
  const low = new THREE.Color(0xffc48a);
  const c = new THREE.Color();
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i) / 420;
    if (y > 0.15) c.copy(mid).lerp(top, Math.min(1, (y - 0.15) / 0.85));
    else c.copy(low).lerp(mid, Math.min(1, (y + 0.35) / 0.5));
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
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x8d5340,
    roughness: 0.86,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
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
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    track(mesh);
    scene.add(mesh);
    return mesh;
  }

  const span = TERRAIN_SPAN;
  const n = TERRAIN_N;
  const groundGeo = new THREE.BufferGeometry();
  const gPos = new Float32Array((n + 1) * (n + 1) * 3);
  const gCol = new Float32Array((n + 1) * (n + 1) * 3);
  const sand = new THREE.Color(0xe3924e);
  const wet = new THREE.Color(0xc46a45);
  const rock = new THREE.Color(0x8a4038);
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
      color: 0x6a3d78,
      roughness: 0.42,
      metalness: 0.12,
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

  // The return to Tower is a lighthouse with a door, not a floating ring.
  // The door faces +Z, toward the landing pad the player walks in from.
  const towerGateY = groundY(TOWER_GATE.x, TOWER_GATE.z);
  const beacon = new THREE.Group();
  beacon.name = "tower-beacon";
  beacon.position.set(TOWER_GATE.x, towerGateY, TOWER_GATE.z);
  const beaconWhite = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.72 });
  const beaconRed = new THREE.MeshStandardMaterial({ color: 0xc4493a, roughness: 0.62 });
  const beaconDoor = new THREE.MeshStandardMaterial({ color: 0x24343c, roughness: 0.55 });
  mats.add(beaconWhite);
  mats.add(beaconRed);
  mats.add(beaconDoor);
  const beaconStandIn: THREE.Object3D[] = [];
  const addBeacon = (mesh: THREE.Mesh, standIn: boolean) => {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    track(mesh);
    beacon.add(mesh);
    if (standIn) beaconStandIn.push(mesh);
    return mesh;
  };
  addBeacon(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 6.6, 12), beaconWhite), true).position.y = 3.3;
  const beaconStripe = addBeacon(new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.38, 0.72, 12), beaconRed), true);
  beaconStripe.position.y = 4.6;
  const beaconLamp = addBeacon(
    new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.35, 1.15, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffe08a,
        emissive: 0xe4a322,
        emissiveIntensity: 0.85,
        roughness: 0.35,
      }),
    ),
    true,
  );
  beaconLamp.position.y = 7.05;
  addBeacon(new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.15, 12), beaconRed), true).position.y = 8.15;
  const beaconDoorMesh = addBeacon(new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.16), beaconDoor), false);
  beaconDoorMesh.position.set(0, 1.15, 1.35);
  addBeacon(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.35, 0.22), beaconRed), false).position.set(-0.68, 1.15, 1.36);
  addBeacon(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.35, 0.22), beaconRed), false).position.set(0.68, 1.15, 1.36);
  scene.add(beacon);
  const towerPortalLabel = makeLabel("МАЯК · ПОДЪЁМ");
  towerPortalLabel.position.set(TOWER_GATE.x, towerGateY + 9.2, TOWER_GATE.z);
  towerPortalLabel.scale.set(8.2, 2.05, 1);
  scene.add(towerPortalLabel);
  const towerPortalLight = new THREE.PointLight(0xffd27a, 2.1, 24, 2);
  towerPortalLight.position.set(TOWER_GATE.x, towerGateY + 7.1, TOWER_GATE.z);
  scene.add(towerPortalLight);

  for (let z = 30; z >= -6; z -= 4) {
    const y = groundY(0, z);
    addBox(0, y + 0.05, z, 3.1, 0.06, 3.6, pathMat);
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

  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x1c2430,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    roughness: 0.4,
    metalness: 0,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  mats.add(screenMat);
  const story = new THREE.Group();
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.62, 0.28), woodMat);
  cabinet.position.y = 0.72;
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.04), screenMat);
  screen.position.set(0, 0.76, -0.15);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), stoneMat);
  stand.position.y = 0.21;
  const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), goldMat);
  antenna.position.set(0.28, 1.12, 0);
  story.add(stand, cabinet, screen, antenna);
  story.position.set(STORY_BOX.x, groundY(STORY_BOX.x, STORY_BOX.z), STORY_BOX.z);
  story.rotation.y = Math.PI / 2;
  scene.add(story);
  story.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) track(mesh);
  });

  const tapeVideo = document.createElement("video");
  tapeVideo.crossOrigin = "anonymous";
  tapeVideo.playsInline = true;
  tapeVideo.setAttribute("playsinline", "");
  tapeVideo.preload = "none";
  tapeVideo.loop = false;
  tapeVideo.onended = () => {
    sim.tapePhase = "spent";
  };
  const tapeTex = new THREE.VideoTexture(tapeVideo);
  tapeTex.colorSpace = THREE.SRGBColorSpace;
  let cassetteHome = new THREE.Vector3();
  let cassette: THREE.Group | null = null;

  TAPES.forEach((tape) => {
    if (tape.x === null || tape.z === null) return;
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.16, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.55, metalness: 0.2 }),
    );
    const label = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 0.01),
      new THREE.MeshStandardMaterial({ color: 0xc4493a, roughness: 0.6 }),
    );
    label.position.z = -0.03;
    cassette = new THREE.Group();
    cassette.add(shell, label);
    cassette.position.set(tape.x, groundY(tape.x, tape.z) + 0.1, tape.z);
    cassette.rotation.y = 0.4;
    cassetteHome = cassette.position.clone();
    scene.add(cassette);
  });

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
  let crewRig: CrewRig | null = null;

  const bike = new THREE.Group();
  bike.rotation.order = "YXZ";
  scene.add(bike);
  let bikeOff: THREE.Object3D | null = null;
  let bikeFull: THREE.Object3D | null = null;
  let bikeDriveController: MaxhogController | null = null;

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
  let alive = true;
  const occupied: Array<[number, number, number]> = [
    [48, 6, 14],
    [46, -16, 12],
    [-58, 14, 10],
    [-40, 28, 8],
    [-28, 36, 8],
    [32, 28, 8],
    [-32, -22, 8],
    [40, -30, 9],
    [SPAWN.x, SPAWN.z, 6.5],
    [TOWER_GATE.x, TOWER_GATE.z, 6],
    [JAHMAN.x, JAHMAN.z, 2.4],
    [STORY_BOX.x, STORY_BOX.z, 2.2],
    [BIKE_PARK.x, BIKE_PARK.z, 3.2],
  ];
  function busy(x: number, z: number, r: number) {
    return occupied.some(([ox, oz, orad]) => (ox - x) ** 2 + (oz - z) ** 2 < (orad + r) ** 2);
  }
  function claim(x: number, z: number, r: number) {
    if (busy(x, z, r)) return false;
    occupied.push([x, z, r]);
    return true;
  }
  const seatBox = new THREE.Box3();
  function sit(obj: THREE.Object3D, x: number, z: number, y = surfaceY(x, z)) {
    obj.position.set(x, y, z);
    obj.updateWorldMatrix(true, true);
    seatBox.setFromObject(obj);
    if (!seatBox.isEmpty() && Number.isFinite(seatBox.min.y)) obj.position.y += y - seatBox.min.y;
    return obj.position.y;
  }
  function solidify(root: THREE.Object3D) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        const standard = mat as THREE.MeshStandardMaterial;
        standard.depthTest = true;
        standard.depthWrite = true;
        standard.side = THREE.FrontSide;
        if (standard.transparent) {
          standard.alphaTest = Math.max(standard.alphaTest || 0, 0.42);
          standard.transparent = false;
        }
      }
    });
  }
  const loadMesh = async (url: string, target: number, axis: "y" | "xz") => {
    const gltf = await loader.loadAsync(url);
    const mesh = bake(gltf.scene, target, axis);
    track(mesh);
    return mesh;
  };

  function fits(x: number, z: number, pad: number) {
    for (const house of HOUSES) {
      if (Math.abs(x - house.x) < house.w / 2 + pad && Math.abs(z - house.z) < house.d / 2 + pad) return false;
    }
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 6.5) return false;
    if (Math.hypot(x - TOWER_GATE.x, z - TOWER_GATE.z) < 5.5) return false;
    if (Math.abs(x - BRIDGE.x) < BRIDGE.half + pad && z > BRIDGE.z0 - 1.5 && z < BRIDGE.z1 + 1.5) return false;
    for (const person of Object.values(NPC)) {
      if (Math.hypot(x - person.x, z - person.z) < pad + 1.2) return false;
    }
    return true;
  }
  function block(x: number, z: number, radius: number, height: number) {
    const y = groundY(x, z);
    sim.addProp({
      minX: x - radius,
      maxX: x + radius,
      minY: y,
      maxY: y + height,
      minZ: z - radius,
      maxZ: z + radius,
    });
  }

  void (async () => {
    const lighthouse = propUrl("coastal_environment/coastal_environment/lighthouse.glb");
    if (lighthouse) {
      try {
        const model = await loadMesh(lighthouse, 8.6, "y");
        if (!alive) return;
        beacon.add(model);
        for (const part of beaconStandIn) part.visible = false;
      } catch (err) {
        console.warn("BCM lighthouse kept the built beacon", err);
      }
    }
    const scatter: Array<[string, number, Array<[number, number]>]> = [
      ["desert_pack01/cactus_tall.glb", 2.6, [[-18, 29], [22, 26], [-24, 12], [26, -6], [-10, -26], [16, -24], [-28, -4], [8, -30]]],
      ["desert_details/rocks_gray.glb", 1.5, [[-12, 34], [14, 35], [-26, 20], [28, 10], [4, -32], [-18, -14]]],
      // Small branching cactus — the twigs that used to be strewn over the dunes.
      ["desert_details/cactus_branching.glb", 1.15, [[-16, 22], [19, 14], [-9, 27], [27, 4], [-22, -6], [11, -16], [-4, -27], [31, -12], [-31, 18], [7, 11], [15, -8], [-14, 8]]],
      ["desert_details/shrub_dry.glb", 0.85, [[-7, 24], [17, 22], [-19, 4], [23, -14], [-12, -22], [5, -26], [28, 16], [-25, 24]]],
    ];
    const dummy = new THREE.Object3D();
    for (const [file, height, spots] of scatter) {
      const name = file.slice(file.lastIndexOf("/") + 1);
      const previewHas = name === "cactus_branching.glb" || name === "shrub_dry.glb";
      const url = propUrl(file) || (previewHas ? meshUrl(name) : "");
      if (!url || !alive) continue;
      try {
        const mesh = await loadMesh(url, height, "y");
        if (!alive) return;
        const placed = spots.filter(([x, z]) => fits(x, z, height > 2 ? 2.8 : 1.6));
        if (!placed.length) continue;
        const batch = new THREE.InstancedMesh(mesh.geometry, mesh.material, placed.length);
        batch.castShadow = false;
        batch.receiveShadow = false;
        placed.forEach(([x, z], i) => {
          dummy.position.set(x, groundY(x, z), z);
          dummy.rotation.set(0, i * 0.7, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          batch.setMatrixAt(i, dummy.matrix);
        });
        batch.instanceMatrix.needsUpdate = true;
        scene.add(batch);
      } catch (err) {
        console.warn("BCM prop skipped", file, err);
      }
    }
    const landmarks: Array<[string, string, number, number, number, number]> = [
      ["desert_next_stage/models/mesa_tall.glb", "desert/mesa_tall.glb", 16, 48, 6, 0.35],
      ["desert_next_stage/models/mesa_wide.glb", "desert/mesa_wide.glb", 7.2, 46, -16, 1.1],
      ["desert_next_stage/models/red_rock_spires.glb", "desert/spires.glb", 12, -58, 14, 0.4],
      ["desert_next_stage/models/red_boulder_cluster.glb", "desert/boulders.glb", 3.1, -40, 28, 0.7],
      ["desert_next_stage/models/desert_flat_canopy_tree.glb", "desert/canopy.glb", 6.4, -28, 36, 0.25],
      ["desert_next_stage/models/desert_dome_house.glb", "desert/dome_house.glb", 5.4, 32, 28, 0.6],
      ["desert_next_stage/models/ruined_wall.glb", "desert/ruined_wall.glb", 3.3, -32, -22, 0.45],
      ["desert_next_stage/models/ruined_watchtower.glb", "desert/watchtower.glb", 8.2, 40, -30, 0.9],
    ];
    for (const [propPath, previewFile, height, x, z, yaw] of landmarks) {
      if (!alive || !fits(x, z, 3.2)) continue;
      try {
        const mesh = await loadMesh(propUrl(propPath) || meshUrl(previewFile), height, "y");
        if (!alive) return;
        let y = surfaceY(x, z);
        mesh.position.set(x, y, z);
        mesh.rotation.y = yaw;
        scene.add(mesh);
        sit(mesh, x, z, y);
        mesh.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(mesh);
        const sx = bounds.max.x - bounds.min.x;
        const sz = bounds.max.z - bounds.min.z;
        if (sx > 1.2 && sz > 1.2 && sx < 28 && sz < 28) {
          sim.addProp({
            minX: bounds.min.x + 0.3,
            maxX: bounds.max.x - 0.3,
            minY: bounds.min.y,
            maxY: bounds.max.y,
            minZ: bounds.min.z + 0.3,
            maxZ: bounds.max.z - 0.3,
          });
        } else if (height > 4) {
          block(x, z, Math.min(12, 2 + height * 0.45), height);
        }
      } catch (err) {
        console.warn("BCM landmark skipped", propPath, err);
      }
    }
  })();

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
    void hover;
    void space;
    void airOff;
    void airFull;

    const drop = (mesh: THREE.Object3D, x: number, z: number, yaw = 0, y?: number) => {
      const pivot = new THREE.Group();
      pivot.add(mesh.clone());
      pivot.rotation.y = yaw;
      scene.add(pivot);
      sit(pivot, x, z, y ?? surfaceY(x, z));
      return pivot;
    };

    const sera = drop(hooded, NPC.sera.x, NPC.sera.z, NPC.sera.yaw);
    sera.add(makeLabel(NPC.sera.name));
    solidify(sera);
    const orr = drop(eye, NPC.orr.x, NPC.orr.z, NPC.orr.yaw);
    orr.add(makeLabel(NPC.orr.name));
    solidify(orr);
    const lampNpc = drop(bulb, NPC.bulb.x, NPC.bulb.z, NPC.bulb.yaw);
    lampNpc.add(makeLabel(NPC.bulb.name));
    solidify(lampNpc);
    npcPivots.push(sera, orr, lampNpc);

    try {
      const jahUrl = propUrl("jahman_optimized/jahman_mobile.glb") || meshUrl("desert/jahman_mobile.glb");
      const gltf = await loader.loadAsync(jahUrl);
      if (!alive) return;
      const man = fitHeight(gltf.scene, 1.72);
      solidify(man);
      const pivot = new THREE.Group();
      pivot.add(man);
      pivot.position.set(JAHMAN.x, surfaceY(JAHMAN.x, JAHMAN.z), JAHMAN.z);
      pivot.rotation.y = JAHMAN.yaw;
      const floor = groundY(JAHMAN.x, JAHMAN.z) + 0.12;
      sit(pivot, JAHMAN.x, JAHMAN.z, floor);
      const fillLight = new THREE.PointLight(0xffaa77, 0.85, 5.5, 2);
      fillLight.layers.set(LOCAL);
      fillLight.position.set(0, 1.55, -0.7);
      pivot.add(fillLight);
      man.traverse((obj) => obj.layers.enable(LOCAL));
      pivot.add(makeLabel(JAHMAN.name));
      scene.add(pivot);
      npcPivots.push(pivot);
    } catch (err) {
      console.warn("BCM JahMan skipped", err);
    }

    const parked: {
      pivot: THREE.Group;
      hull: THREE.Object3D;
      parkedFile: string;
      flightFile: string;
      fitLength: number;
      flightHull?: THREE.Object3D | null;
      flightLoading?: boolean;
      driveController?: MaxhogController;
      x: number;
      z: number;
      y: number;
      crew: string;
    }[] = [];
    const pads: Array<[number, number]> = [
      [-18, 41], [16, 44], [-28, 30], [22, 42], [30, -12], [-44, -28],
      [14, -40], [-16, -40], [54, 26], [-52, 30], [38, 42], [-36, -34],
      [24, 16], [-24, -34], [-58, 2], [58, -42], [56, 42], [-56, -44],
      [2, 56], [44, 52], [-42, 50], [58, 8], [-58, -14], [8, -52],
      [-10, 50], [30, -50],
    ];
    const slope = (x: number, z: number) => {
      const h = surfaceY(x, z);
      return Math.max(
        Math.abs(surfaceY(x + 2.2, z) - h),
        Math.abs(surfaceY(x - 2.2, z) - h),
        Math.abs(surfaceY(x, z + 2.2) - h),
        Math.abs(surfaceY(x, z - 2.2) - h),
      );
    };
    for (let i = 0; i < PILOT_SHIPS.length; i++) {
      const spot = pads[i];
      const spec = PILOT_SHIPS[i];
      if (!spot || !spec) continue;
      const [x, z] = spot;
      if (!fits(x, z, 3.4) || slope(x, z) > 0.55 || !claim(x, z, 4.2)) continue;
      try {
        const gltf = await loader.loadAsync(shipUrl(spec.file));
        if (!alive) return;
        const hull = gltf.scene;
        settleNose(hull);
        if (!fitLength(hull, spec.island)) continue;
        const driveController = spec.id === "maxhog"
          ? await createMaxhogController(hull, "pad").catch((err) => { console.warn("Max Hog island controller unavailable", err); return undefined; })
          : undefined;
        const pivot = new THREE.Group();
        pivot.add(hull);
        pivot.rotation.y = i * 0.55;
        scene.add(pivot);
        const y = sit(pivot, x, z);
        block(x, z, 1.5, 1.5);
        parked.push({
          pivot, hull, parkedFile: spec.file, flightFile: spec.flightFile,
          fitLength: spec.island, x, z, y, crew: spec.crew, driveController,
        });
      } catch (err) {
        console.warn("BCM island ship skipped", spec.file, err);
      }
    }
    const show = [
      { spec: pilotShip("jetjet"), x: SKY.x + 11, z: SKY.z + 2 },
      { spec: pilotShip("scud"), x: SKY.x - 12, z: SKY.z + 8 },
      { spec: pilotShip("maxhog"), x: SKY.x + 2, z: SKY.z - 14 },
      ...ASTEROID_SHOW.map((spec, index) => {
        const angle = -Math.PI / 2 + (index / Math.max(1, ASTEROID_SHOW.length)) * Math.PI * 2;
        const radius = 48;
        return {
          spec,
          x: SKY.x + Math.cos(angle) * radius,
          z: SKY.z + Math.sin(angle) * radius,
        };
      }),
    ];
    for (const entry of show) {
      try {
        const gltf = await loader.loadAsync(shipUrl(entry.spec.file));
        if (!alive) return;
        const hull = gltf.scene;
        settleNose(hull);
        if (!fitLength(hull, entry.spec.show)) continue;
        const driveController = entry.spec.id === "maxhog"
          ? await createMaxhogController(hull, "pad").catch((err) => { console.warn("Max Hog showcase controller unavailable", err); return undefined; })
          : undefined;
        const pivot = new THREE.Group();
        pivot.add(hull);
        pivot.rotation.y = 0.4;
        scene.add(pivot);
        const y = sit(pivot, entry.x, entry.z, SKY.y);
        parked.push({
          pivot, hull, parkedFile: entry.spec.file, flightFile: entry.spec.flightFile,
          fitLength: entry.spec.show, x: entry.x, z: entry.z, y, crew: entry.spec.crew, driveController,
        });
      } catch (err) {
        console.warn("BCM asteroid ship skipped", entry.spec.file, err);
      }
    }
    (scene.userData as { parked?: typeof parked }).parked = parked;

    const crystals = [amber, cyan, violet];
    CRYSTALS.forEach((spot, i) => {
      const pivot = drop(crystals[i % crystals.length], spot.x, spot.z, 0.4 + i * 0.2);
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
    trees.forEach(([x, z], i) => {
      if (!fits(x, z, 2.8) || !claim(x, z, 3.4)) return;
      drop(tree, x, z, i * 0.8);
    });

    for (let z = 24; z <= 32; z += 2.4) {
      drop(fence, -5.4, z, Math.PI / 2);
      drop(fence, 5.4, z, Math.PI / 2);
    }
    const segment = 3.05;
    const count = Math.max(3, Math.round((BRIDGE.z1 - BRIDGE.z0) / segment));
    const used = count * segment;
    const zStart = (BRIDGE.z0 + BRIDGE.z1) / 2 - used / 2 + segment / 2;
    for (let i = 0; i < count; i++) {
      // Planks sit 0.41 above the baked pivot. Feet use BRIDGE.deck, so the body is not left hanging on the rails.
      drop(bridge, BRIDGE.x, zStart + i * segment, Math.PI / 2, BRIDGE.deck - 0.41);
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
    block(2.4, 6.4, 0.7, 0.9);
    block(-2.2, 5.2, 0.7, 0.9);
    BRAZIERS.forEach((spot, i) => {
      const y = i === 1 ? BRIDGE.deck : groundY(spot.x, spot.z);
      const stand = drop(brazier, spot.x, spot.z, i, y);
      const flame = fireSprite();
      flame.position.set(spot.x, y + 1.15, spot.z);
      scene.add(flame);
      fireSprites.push(flame);
      fireMarkers.push(marker(spot.x, y + 1.8, spot.z));
      const light = new THREE.PointLight(0xff8a3c, 0, 7, 2);
      light.layers.set(LOCAL);
      light.position.set(spot.x, y + 1.3, spot.z);
      stand.traverse((obj) => obj.layers.enable(LOCAL));
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
    for (const [x, z, yaw] of [
      [-6.4, -20.6, 0.4],
      [7.4, -21.4, 1.1],
      [-14.2, -18.2, 0.2],
      [-20.5, 24.2, 0.6],
      [24.2, 18.4, 1.4],
      [-3.6, 28.4, 0.8],
      [18.6, -12.2, 0.3],
      [-28.4, -10.2, 1.2],
      [6.2, 22.4, 0.5],
      [30.4, 8.2, 0.9],
      [-8.4, -12.6, 1.6],
    ] as const) {
      if (!fits(x, z, 1.2)) continue;
      drop(fern, x, z, yaw);
    }
    drop(coral, 6.2, -15.4, 0.5, -0.25);
    drop(coral, -0.6, -19.2, 1.2, -0.35);
    drop(lily, 3.6, -16.8, 0.4, -0.32);
    drop(lily, 1.1, -18.6, 1.5, -0.32);

    isle.geometry.computeBoundingBox();
    const isleH = isle.geometry.boundingBox?.max.y ?? 4;
    const skyPivot = new THREE.Group();
    skyPivot.add(isle);
    skyPivot.position.set(SKY.x, SKY.y - isleH, SKY.z);
    scene.add(skyPivot);
    drop(orb, SKY.x + 1.3, SKY.z + 0.5, 0, SKY.y);
    drop(bud, SKY.x - 1.5, SKY.z - 0.8, 0.7, SKY.y);
    const skyLight = new THREE.PointLight(0x8fd0ff, 1.4, 16, 2);
    skyLight.layers.set(LOCAL);
    skyLight.position.set(SKY.x + 1.3, SKY.y + 1.2, SKY.z);
    skyPivot.traverse((obj) => obj.layers.enable(LOCAL));
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
  let boarded: {
    pivot: THREE.Group;
    hull: THREE.Object3D;
    parkedFile: string;
    flightFile: string;
    fitLength: number;
    flightHull?: THREE.Object3D | null;
    flightLoading?: boolean;
    driveController?: MaxhogController;
    x: number;
    z: number;
    y: number;
  } | null = null;
  let gPrev = false;
  let wantedShip = context.shipId || PILOT_SHIPS[0].id;
  let shipChain: Promise<void> = Promise.resolve();
  let crewBody: THREE.Object3D | null = null;
  let seenPlay = 0;
  let eject = 0;
  const ejectFrom = new THREE.Vector3();
  const ejectTo = new THREE.Vector3();
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
    const stance = sim.mood === "stealth" ? 0.62 : 1;
    pilot.scale.set(sim.mood === "fight" ? 1.08 : 1, stance, sim.mood === "fight" ? 1.08 : 1);
    pilot.position.y += sim.mode === "foot" && Math.abs(sim.speed) > 0.35 ? Math.abs(Math.sin(elapsed * (sim.mood === "sport" ? 14 : 11))) * 0.05 : 0;
    crewRig?.update(sim.mode === "foot" && Math.abs(sim.speed) > 0.35);
    const tapePhase = sim.tapePhase;
    const tapeOn = tapePhase === "playing" || tapePhase === "paused";
    screenMat.map = tapeOn ? tapeTex : null;
    screenMat.emissiveMap = tapeOn ? tapeTex : null;
    screenMat.emissiveIntensity = tapeOn ? 0.5 : 0;
    screenMat.needsUpdate = true;
    if (tapePhase === "playing") {
      if (sim.tapeUrl && tapeVideo.getAttribute("src") !== sim.tapeUrl) tapeVideo.src = sim.tapeUrl;
      if (sim.tapePlay !== seenPlay) {
        seenPlay = sim.tapePlay;
        try {
          tapeVideo.currentTime = 0;
        } catch {
          /* metadata */
        }
      }
      if (tapeVideo.paused) tapeVideo.play()?.catch(() => {});
    } else if (!tapeVideo.paused) {
      tapeVideo.pause();
    }
    const distanceToTape = Math.hypot(sim.x - STORY_BOX.x, sim.z - STORY_BOX.z);
    const falloff = Math.max(0, Math.min(1, (distanceToTape - 2) / 14));
    const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
    const hear = 1 - smoothFalloff;
    tapeVideo.volume = tapePhase === "playing" ? (tapeOverlay ? 0.85 : 0.82 * hear) : 0;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bcm:tape-near", { detail: tapePhase === "playing" ? hear : 0 }));
    }
    if (cassette) {
      const ownsFloorTape = sim.tapes.includes("ded");
      const loose = (tapePhase === "floor" && !ownsFloorTape) || tapePhase === "spent";
      cassette.visible = loose;
      if (tapePhase === "spent") closeTapeOverlay();
      else eject = 0;
      if (tapePhase === "floor" || tapePhase === "held") {
        cassette.position.copy(cassetteHome);
        cassette.rotation.set(0.15, 0.4, 0);
      } else if (tapePhase === "spent") {
        if (eject === 0) {
          screen.getWorldPosition(ejectFrom);
          ejectTo.set(STORY_BOX.x - 0.95, surfaceY(STORY_BOX.x - 0.95, STORY_BOX.z) + 0.08, STORY_BOX.z + 0.2);
        }
        eject = Math.min(1, eject + dt * 0.8);
        cassette.position.lerpVectors(ejectFrom, ejectTo, eject);
        cassette.position.y += Math.sin(eject * Math.PI) * 0.28;
        cassette.rotation.x = eject * 1.35;
      }
    }
    const keys = activeKeys();
    const pressedG = keys.has("KeyG");
    type Parked = {
      pivot: THREE.Group;
      hull: THREE.Object3D;
      parkedFile: string;
      flightFile: string;
      fitLength: number;
      flightHull?: THREE.Object3D | null;
      flightLoading?: boolean;
      driveController?: MaxhogController;
      x: number;
      z: number;
      y: number;
      crew: string;
    };
    const parked = ((scene.userData as { parked?: Parked[] }).parked) ?? [];
    const nearShip = (spot: Parked) => {
      const reach = spot.y > 8 ? Math.max(54, spot.fitLength * 0.65) : 8;
      return (spot.x - sim.x) ** 2 + (spot.z - sim.z) ** 2 < reach * reach;
    };
    if (boarded && sim.mode === "foot") {
      boarded.driveController?.setMode("pad");
      boarded.driveController?.setThrust(0);
      boarded.driveController?.setGroundSpeed(0);
      bike.remove(boarded.hull);
      boarded.hull.visible = true;
      boarded.pivot.add(boarded.hull);
      if (boarded.flightHull) {
        bike.remove(boarded.flightHull);
        boarded.flightHull.visible = false;
        boarded.pivot.add(boarded.flightHull);
      }
      const py = onSky(sim.x, sim.z) && sim.y > SKY.y - 2 ? SKY.y : surfaceY(sim.bikeX, sim.bikeZ);
      boarded.x = sim.bikeX;
      boarded.z = sim.bikeZ;
      boarded.y = sit(boarded.pivot, sim.bikeX, sim.bikeZ, py);
      boarded = null;
    }
    if (pressedG && !gPrev && tapeOn) toggleTapeScreen();
    gPrev = pressedG;
    if (sim.mode === "foot" && !sim.prompt && parked.some(nearShip)) {
      sim.prompt = "E — пересесть";
    }

    if (sim.mode === "bike") {
      bike.position.set(sim.x, sim.y, sim.z);
      bike.rotation.y = sim.yaw;
      bike.rotation.z = -sim.steer * 0.18;
    } else {
      bike.position.set(sim.bikeX, groundY(sim.bikeX, sim.bikeZ), sim.bikeZ);
      bike.rotation.y = sim.bikeYaw;
      bike.rotation.z = 0;
    }
    const driveController = boarded?.driveController || bikeDriveController;
    const blazing = sim.mode === "bike" && sim.flightMode;
    if (driveController) {
      driveController.setMode(blazing ? "flight" : "pad");
      driveController.setGroundSpeed(sim.mode === "bike" && !blazing ? sim.speed : 0);
      driveController.setFlightMotion(sim.engineForward, sim.engineVertical);
      driveController.setThrust(blazing ? 0.72 : 0);
      driveController.update(elapsed);
      bike.rotation.z = blazing ? -sim.steer * 0.14 : 0;
    }
    if (bikeOff) bikeOff.visible = !boarded && (!blazing || !bikeFull);
    if (bikeFull) bikeFull.visible = !boarded && blazing;
    if (boarded) {
      boarded.hull.visible = !blazing || !boarded.flightHull;
      if (boarded.flightHull) boarded.flightHull.visible = blazing;
    }

    crystalPivots.forEach((pivot, i) => {
      pivot.visible = !sim.crystals[i];
      pivot.rotation.y += dt * (0.85 + i * 0.18);
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
      const data = pivot.userData as { baseY?: number };
      if (data.baseY === undefined) data.baseY = pivot.position.y;
      pivot.position.y = data.baseY + Math.sin(elapsed * 1.6 + i) * 0.03;
    });
    if (coinPivot?.visible) coinPivot.rotation.y += dt;

    const fx = -Math.sin(sim.yaw);
    const fz = -Math.cos(sim.yaw);
    if (phase !== "play") {
      desired.set(14, 7.6, 56);
      look.set(BIKE_PARK.x, 1.3, BIKE_PARK.z - 2);
    } else {
      let dist = 5.4;
      let height = 2.2;
      let lookAhead = 1.2;
      if (sim.mode === "bike") {
        seatBox.setFromObject(bike);
        if (!seatBox.isEmpty()) {
          const size = seatBox.getSize(new THREE.Vector3());
          const long = Math.max(size.x, size.z, 2.4);
          dist = long * 1.15 + 3.2;
          height = Math.max(2.8, size.y + long * 0.34);
          lookAhead = long * 0.2;
        }
      }
      desired.set(sim.x - fx * dist, sim.y + height, sim.z - fz * dist);
      look.set(sim.x + fx * lookAhead, sim.y + 1.05, sim.z + fz * lookAhead);
      pullCam(desired);
    }
    const k = snapping ? 1 : 1 - Math.exp(-4.2 * dt);
    camera.position.lerp(desired, k);
    lookSmoothed.lerp(look, k);
    camera.lookAt(lookSmoothed);

    sun.position.copy(gold.position);
    sun.target.position.set(0, -0.55, 0);
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
    document.removeEventListener("fullscreenchange", handleTapeFullscreenChange);
    closeTapeOverlay();
    window.dispatchEvent(new CustomEvent("bcm:tape-near", { detail: 0 }));
    tapeVideo.pause();
    tapeVideo.removeAttribute("src");
    tapeTex.dispose();
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

  let crewToken = 0;
  async function wearCrew(species: string) {
    const token = ++crewToken;
    try {
      const gltf = await loader.loadAsync(shipUrl(characterPath(species)));
      if (!alive || token !== crewToken) return;
      const body = gltf.scene;
      fitHeight(body, characterHeight(species));
      solidify(body);
      body.rotation.y = Math.PI;
      if (crewBody) pilot.remove(crewBody);
      pilot.children.forEach((child) => {
        child.visible = false;
      });
      pilot.add(body);
      crewBody = body;
      crewRig = bindCrewRig(body);
    } catch (err) {
      console.warn("BCM crew body skipped", err);
    }
  }

  function applyShip(id?: string) {
    if (id) wantedShip = id;
    const spec = pilotShip(wantedShip);
    shipChain = shipChain
      .then(async () => {
        if (!alive) return;
        if (boarded) {
          boarded.driveController?.setMode("pad");
          boarded.driveController?.setThrust(0);
          boarded.driveController?.setGroundSpeed(0);
          bike.remove(boarded.hull);
          boarded.hull.visible = true;
          boarded.pivot.add(boarded.hull);
          if (boarded.flightHull) {
            bike.remove(boarded.flightHull);
            boarded.flightHull.visible = false;
            boarded.pivot.add(boarded.flightHull);
          }
          boarded = null;
          sim.mode = "foot";
        }
        const parkedGltf = await loader.loadAsync(shipUrl(spec.file));
        if (!alive) return;
        const parkedHull = parkedGltf.scene;
        settleNose(parkedHull);
        if (!fitLength(parkedHull, spec.island)) return;
        let flightHull: THREE.Object3D | null = null;
        if (spec.flightFile && spec.flightFile !== spec.file) {
          const flightGltf = await loader.loadAsync(shipUrl(spec.flightFile));
          if (!alive) return;
          flightHull = flightGltf.scene;
          settleNose(flightHull);
          if (!fitLength(flightHull, spec.island)) flightHull = null;
          if (flightHull) flightHull.visible = false;
        }
        bike.clear();
        bike.add(parkedHull);
        if (flightHull) bike.add(flightHull);
        bikeDriveController?.dispose();
        bikeOff = parkedHull;
        bikeFull = flightHull;
        bikeDriveController = spec.id === "maxhog"
          ? await createMaxhogController(parkedHull, "pad").catch((err) => { console.warn("Max Hog pilot controller unavailable", err); return null; })
          : null;
        await wearCrew(pilotSpecies(spec.crew));
      })
      .catch((err) => console.warn("BCM pilot ship skipped", spec.id, err));
  }

  function crewSelection() {
    if (typeof window === "undefined") return undefined;
    return (window as Window & { BCMMiniCrewSelection?: { shipId?: string; players?: Array<{ species?: string }> } }).BCMMiniCrewSelection;
  }
  function pilotSpecies(fallback: string) {
    const people = crewSelection()?.players || context.players;
    return people?.find((person) => person.species)?.species || fallback;
  }

  let tapeOverlay: HTMLDivElement | null = null;
  function setTapeAudioFocus(active: boolean) {
    window.dispatchEvent(new CustomEvent("bcm:tape-focus", { detail: active }));
  }
  function closeTapeOverlay() {
    const overlay = tapeOverlay;
    if (!overlay) {
      setTapeAudioFocus(false);
      return;
    }
    tapeOverlay = null;
    overlay.remove();
    if (document.fullscreenElement === overlay) document.exitFullscreen?.();
    tapeVideo.style.cssText = "position:fixed;width:2px;height:2px;opacity:0;pointer-events:none";
    host.appendChild(tapeVideo);
    setTapeAudioFocus(false);
  }
  function handleTapeFullscreenChange() {
    if (tapeOverlay && document.fullscreenElement !== tapeOverlay) closeTapeOverlay();
  }
  document.addEventListener("fullscreenchange", handleTapeFullscreenChange);
  function toggleTapeScreen() {
    const tapeOn = sim.tapePhase === "playing" || sim.tapePhase === "paused";
    if (!tapeOn) {
      closeTapeOverlay();
      return;
    }
    if (tapeOverlay) {
      closeTapeOverlay();
      return;
    }
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:80;background:#000;display:flex;align-items:center;justify-content:center";
    tapeVideo.style.cssText = "width:100%;height:100%;object-fit:contain;background:#000";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Закрыть";
    close.style.cssText = "position:absolute;top:16px;right:16px;z-index:2;border:0;border-radius:999px;padding:8px 14px;background:#e4a322;color:#102027;font:600 14px sans-serif;cursor:pointer";
    close.addEventListener("click", () => closeTapeOverlay());
    overlay.appendChild(tapeVideo);
    overlay.appendChild(close);
    document.body.appendChild(overlay);
    tapeOverlay = overlay;
    setTapeAudioFocus(true);
    const request = overlay.requestFullscreen || (overlay as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
    if (request) request.call(overlay, { navigationUI: "hide" })?.catch(() => {});
    void tapeVideo.play()?.catch(() => {});
  }

  sim.board = () => {
    if (sim.mode !== "foot" || boarded) return false;
    const parked = ((scene.userData as { parked?: Array<{
      pivot: THREE.Group; hull: THREE.Object3D; parkedFile: string; flightFile: string;
      fitLength: number; flightHull?: THREE.Object3D | null; flightLoading?: boolean;
      driveController?: MaxhogController;
      x: number; z: number; y: number;
    }> }).parked) ?? [];
    let near: (typeof parked)[number] | undefined;
    let bestDistance = Infinity;
    for (const spot of parked) {
      const distance = (spot.x - sim.x) ** 2 + (spot.z - sim.z) ** 2;
      const reach = spot.y > 8 ? Math.max(48, spot.fitLength * 0.65) : 8;
      if (distance < reach * reach && distance < bestDistance) {
        near = spot;
        bestDistance = distance;
      }
    }
    if (!near) return false;
    boarded = near;
    sim.flightMode = false;
    sim.engineForward = 0;
    sim.engineVertical = 0;
    sim.vy = 0;
    near.pivot.remove(near.hull);
    near.hull.visible = true;
    bike.add(near.hull);
    if (near.flightHull) {
      near.pivot.remove(near.flightHull);
      near.flightHull.visible = false;
      bike.add(near.flightHull);
    } else if (near.flightFile && near.flightFile !== near.parkedFile && !near.flightLoading) {
      near.flightLoading = true;
      void loader.loadAsync(shipUrl(near.flightFile)).then((gltf) => {
        if (!alive) return;
        const flightHull = gltf.scene;
        settleNose(flightHull);
        if (!fitLength(flightHull, near.fitLength)) return;
        flightHull.visible = false;
        near.flightHull = flightHull;
        if (boarded === near && sim.mode === "bike") bike.add(flightHull);
        else near.pivot.add(flightHull);
      }).catch((err) => {
        console.warn("BCM ship flight form skipped", near.flightFile, err);
      }).finally(() => {
        near.flightLoading = false;
      });
    }
    sim.mode = "bike";
    sim.x = near.x;
    sim.z = near.z;
    sim.y = near.y + 0.6;
    sim.yaw = near.pivot.rotation.y + near.hull.rotation.y;
    return true;
  };

  pilot.position.set(SPAWN.x, footY(SPAWN.x, SPAWN.z, 0), SPAWN.z);
  applyShip(crewSelection()?.shipId);

  return { sim, frame, paintMap, resize, dispose, applyShip, toggleTapeScreen };
}
