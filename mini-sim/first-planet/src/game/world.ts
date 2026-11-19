import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Race } from "./sim";
import { RACE_SHIP_FORMS, shipUrl } from "./ships";
import { faceUp, readTrackSkin, skinnedRoad, type Rgb, type TrackSkin } from "./track-skin";
import { createSeededRandom, seededShuffle } from "./seed";
import { ROAD_Y, sampleAt, type Track } from "./track";
import { aimNose, bake } from "./island/bake";
import { libraryUrl, propUrl } from "./mesh-url";
import { raceSceneryFor, sceneryProps, type RaceScenery, type SceneryProp } from "./race-scenery";

export type Phase = "gate" | "race" | "pause" | "finish";

type Kart = {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  shell: THREE.MeshStandardMaterial;
  /** Engine-on and engine-off models of a ship; absent on the stand-in kart. */
  running?: THREE.Object3D;
  rest?: THREE.Object3D;
  /** Seconds the running form stays after the engine stops, so it does not flicker. */
  engineHold?: number;
};

export type World = {
  update: (race: Race, phase: Phase, view: number, dt: number, elapsed: number) => void;
  resize: () => void;
  dispose: () => void;
};

function ribbon(
  track: Track,
  left: number,
  right: number,
  y: number,
  paint: (s: number) => THREE.Color,
) {
  const n = track.samples.length;
  const pos = new Float32Array(n * 2 * 3);
  const col = new Float32Array(n * 2 * 3);
  const idx: number[] = [];
  const color = new THREE.Color();
  const offsets = [left, right];
  for (let i = 0; i < n; i++) {
    const sample = track.samples[i];
    color.copy(paint(sample.s));
    for (let side = 0; side < 2; side++) {
      const o = (i * 2 + side) * 3;
      pos[o] = sample.x + sample.nx * offsets[side];
      pos[o + 1] = y;
      pos[o + 2] = sample.z + sample.nz * offsets[side];
      col[o] = color.r;
      col[o + 1] = color.g;
      col[o + 2] = color.b;
    }
    const i1 = (i + 1) % n;
    const a = i * 2;
    const b = a + 1;
    const c = i1 * 2;
    const d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  // The strip was wound face down and could not be seen from above.
  faceUp(pos, idx);
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function makeKart(color: number): Kart {
  const shell = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2428, roughness: 0.6 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 1.7), shell);
  body.position.set(0, 0.48, -0.05);
  body.castShadow = true;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.28, 0.62), shell);
  nose.position.set(0, 0.42, -1.05);
  nose.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, 0.62), dark);
  cabin.position.set(0, 0.78, 0.05);
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [
    [-0.58, 0.55],
    [0.58, 0.55],
    [-0.58, -0.82],
    [0.58, -0.82],
  ] as const) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(x, 0.28, z);
    wheel.castShadow = true;
    wheels.push(wheel);
    group.add(wheel);
  }
  group.add(body, nose, cabin);
  return { group, wheels, shell };
}

function glow(color: string) {
  const board = document.createElement("canvas");
  board.width = 128;
  board.height = 128;
  const ctx = board.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(board);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(board);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(canvas: HTMLCanvasElement): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  const host = canvas.parentElement ?? canvas;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xff7a3c);
  scene.fog = new THREE.Fog(0xe56a3a, 70, 280);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
  camera.position.set(0, 48, 120);

  const hemi = new THREE.HemisphereLight(0xffc4a0, 0x7a3a32, 1.15);
  const goldSun = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow("#ffe08a"), transparent: true, depthWrite: false, fog: false }),
  );
  goldSun.position.set(150, 78, -40);
  goldSun.scale.set(52, 52, 1);
  const roseSun = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow("#ff6a4a"), transparent: true, depthWrite: false, fog: false }),
  );
  roseSun.position.set(-120, 54, -150);
  roseSun.scale.set(32, 32, 1);
  scene.add(goldSun, roseSun);
  const sun = new THREE.DirectionalLight(0xffb15a, 1.45);
  sun.position.copy(goldSun.position);
  sun.target.position.set(0, 0.2, 0);
  sun.castShadow = false;
  const coral = new THREE.DirectionalLight(0xffb089, 0.34);
  coral.position.copy(roseSun.position);
  coral.target.position.set(0, 0.2, 0);
  scene.add(hemi, sun, sun.target, coral, coral.target);

  const skyGeo = new THREE.SphereGeometry(520, 20, 12);
  const skyPos = skyGeo.getAttribute("position");
  const skyCol = new Float32Array(skyPos.count * 3);
  const skyMix = new THREE.Color();
  const skyAttr = new THREE.BufferAttribute(skyCol, 3);
  function paintSky(top: number, mid: number, low: number) {
    const skyTop = new THREE.Color(top);
    const skyMid = new THREE.Color(mid);
    const skyLow = new THREE.Color(low);
    for (let i = 0; i < skyPos.count; i++) {
      const y = skyPos.getY(i) / 520;
      if (y > 0.12) skyMix.copy(skyMid).lerp(skyTop, Math.min(1, (y - 0.12) / 0.88));
      else skyMix.copy(skyLow).lerp(skyMid, Math.min(1, (y + 0.4) / 0.52));
      skyCol[i * 3] = skyMix.r;
      skyCol[i * 3 + 1] = skyMix.g;
      skyCol[i * 3 + 2] = skyMix.b;
    }
    skyAttr.needsUpdate = true;
  }
  paintSky(0x3d245c, 0xff7a3a, 0xffc48a);
  skyGeo.setAttribute("color", skyAttr);
  const raceSky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  scene.add(raceSky);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(240, 48),
    new THREE.MeshStandardMaterial({ color: 0x14748c, roughness: 0.48, metalness: 0.08 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.2;
  water.receiveShadow = true;
  scene.add(water);

  const shoal = new THREE.Mesh(
    new THREE.RingGeometry(48, 136, 80),
    new THREE.MeshStandardMaterial({ color: 0xe6d3a3, roughness: 0.92 }),
  );
  shoal.rotation.x = -Math.PI / 2;
  shoal.position.y = 1.05;
  shoal.receiveShadow = true;
  scene.add(shoal);

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(27, 31, 2.8, 28),
    new THREE.MeshStandardMaterial({ color: 0xd2c09a, roughness: 0.9 }),
  );
  island.position.y = 2.2;
  island.receiveShadow = true;
  island.castShadow = true;
  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(22, 22, 0.45, 24),
    new THREE.MeshStandardMaterial({ color: 0x6f9a5c, roughness: 0.95 }),
  );
  grass.position.y = 3.7;
  grass.receiveShadow = true;
  scene.add(island, grass);

  const stone = new THREE.MeshStandardMaterial({ color: 0xd2c2a4, roughness: 0.78 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xe25b3a, roughness: 0.55 });
  const keep = new THREE.Mesh(new THREE.BoxGeometry(11, 4.2, 11), stone);
  keep.position.y = 6.1;
  keep.castShadow = true;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.5, 16, 12), stone);
  shaft.position.y = 15.2;
  shaft.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 4.2, 12), roofMat);
  roof.position.y = 25.2;
  roof.castShadow = true;
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xe4a322,
    emissive: 0xe4a322,
    emissiveIntensity: 0.7,
  });
  const tower = new THREE.Group();
  tower.add(keep, shaft, roof);
  for (let i = 0; i < 4; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.2), winMat);
    const a = (i / 4) * Math.PI * 2;
    win.position.set(Math.cos(a) * 3.15, 16.4, Math.sin(a) * 3.15);
    win.lookAt(0, 16.4, 0);
    tower.add(win);
  }
  scene.add(tower);

  // Race scenery per planet (race-scenery.ts, sheets in art/race-kits): sky, light,
  // the plane round the island, the island and tower, the road, the props.
  let scenery: RaceScenery = raceSceneryFor(undefined);
  let lookKey: string | null = null;
  let sceneSeed = 0;
  const material = (m: THREE.Material) => m as THREE.MeshStandardMaterial;
  function applyScenery(next: RaceScenery) {
    scenery = next;
    paintSky(next.sky[0], next.sky[1], next.sky[2]);
    (scene.background as THREE.Color).set(next.sky[1]);
    (scene.fog as THREE.Fog).color.set(next.fog);
    hemi.color.set(next.hemi[0]);
    hemi.groundColor.set(next.hemi[1]);
    sun.color.set(next.sun);
    const sea = material(water.material as THREE.Material);
    sea.color.set(next.water);
    sea.emissive.set(next.waterGlow);
    sea.emissiveIntensity = next.waterGlow ? 0.65 : 0;
    material(shoal.material as THREE.Material).color.set(next.ground);
    material(island.material as THREE.Material).color.set(next.island);
    material(grass.material as THREE.Material).color.set(next.grass);
    stone.color.set(next.tower[0]);
    roofMat.color.set(next.tower[1]);
    const lava = next.id === "lava";
    goldSun.visible = !lava;
    roseSun.material.color.set(lava ? 0xff5a2a : 0xffffff);
  }
  function ensureScenery(race: Race) {
    const key = (race.planet || "") + ":" + race.seed;
    if (key === lookKey) return;
    lookKey = key;
    sceneSeed = race.seed;
    applyScenery(raceSceneryFor(race.planet));
    trackRef.current = null; // rebuild road and props in the planet's look
  }

  // Simple-geometry props until Dr Arena's GLB stand in the same spots.
  const propMats = new Map<string, THREE.Material>();
  const propMat = (color: number, glow = 0, basic = false) => {
    const key = color + ":" + glow + ":" + basic;
    let m = propMats.get(key);
    if (!m) {
      m = basic
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshStandardMaterial({ color, roughness: 0.82, emissive: glow, emissiveIntensity: glow ? 0.18 : 0 });
      propMats.set(key, m);
    }
    return m;
  };
  const propGeo = {
    trunk: new THREE.CylinderGeometry(0.16, 0.28, 3.1, 5),
    crown: new THREE.SphereGeometry(1.05, 6, 4),
    rock: new THREE.DodecahedronGeometry(1.1, 0),
    buoy: new THREE.CylinderGeometry(0.55, 0.7, 1.6, 8),
    cap: new THREE.ConeGeometry(0.45, 0.9, 8),
    pyramid: new THREE.ConeGeometry(4.2, 5, 4),
    obelisk: new THREE.CylinderGeometry(0.32, 0.75, 7, 4),
    tip: new THREE.ConeGeometry(0.42, 1, 4),
    stem: new THREE.CylinderGeometry(0.34, 0.4, 3.2, 7),
    arm: new THREE.CylinderGeometry(0.22, 0.22, 1.3, 6),
    mound: new THREE.SphereGeometry(2.6, 9, 5),
    spire: new THREE.ConeGeometry(1.1, 6, 5),
    crack: new THREE.TorusGeometry(1.15, 0.12, 4, 10),
    vent: new THREE.CylinderGeometry(1.2, 2, 1.3, 7),
    flame: new THREE.ConeGeometry(0.55, 2.4, 6),
    branch: new THREE.CylinderGeometry(0.08, 0.14, 1.8, 4),
    pine: new THREE.ConeGeometry(1.6, 2.6, 7),
    crystal: new THREE.ConeGeometry(0.45, 3, 6),
  };
  const GROUND_Y = 1.05;
  function buildProp(prop: SceneryProp): THREE.Object3D {
    const spec = scenery.props.find((p) => p.kind === prop.kind) ?? scenery.props[0];
    const mat = propMat(spec.color, spec.glow ?? 0);
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      g.add(mesh);
      return mesh;
    };
    switch (prop.kind) {
      case "palm":
        add(propGeo.trunk, propMat(0x6b4a32), 0, 1.55, 0);
        add(propGeo.crown, mat, 0, 3.3, 0, 1.3, 0.42, 1.3);
        break;
      case "rock":
        add(propGeo.rock, mat, 0, 0.5, 0, 1, 0.75, 1);
        break;
      case "buoy":
        add(propGeo.buoy, mat, 0, 0.8, 0);
        add(propGeo.cap, propMat(0xf4efe4), 0, 2, 0);
        break;
      case "pyramid":
        add(propGeo.pyramid, mat, 0, 2.5, 0).rotation.y = Math.PI / 4;
        break;
      case "obelisk":
        add(propGeo.obelisk, mat, 0, 3.5, 0);
        add(propGeo.tip, propMat(0xe4b03a, 0x6a4a10), 0, 7.5, 0);
        break;
      case "cactus": {
        add(propGeo.stem, mat, 0, 1.6, 0);
        add(propGeo.arm, mat, 0.55, 1.9, 0).rotation.z = Math.PI / 2.6;
        add(propGeo.arm, mat, -0.5, 2.3, 0).rotation.z = -Math.PI / 2.6;
        break;
      }
      case "dune":
        add(propGeo.mound, mat, 0, 0, 0, 1.4, 0.32, 1);
        break;
      case "spire":
        add(propGeo.spire, mat, 0, 3, 0);
        add(propGeo.crack, propMat(spec.glow ?? 0xff5a14, 0, true), 0, 0.2, 0).rotation.x = Math.PI / 2;
        break;
      case "vent":
        add(propGeo.vent, mat, 0, 0.65, 0);
        add(propGeo.flame, propMat(0xff8a2a, 0, true), 0, 2.4, 0);
        add(propGeo.flame, propMat(0xffd24a, 0, true), 0, 2.1, 0, 0.55, 0.7, 0.55);
        break;
      case "deadtree":
        add(propGeo.trunk, mat, 0, 1.55, 0, 0.8, 1, 0.8);
        add(propGeo.branch, mat, 0.5, 2.8, 0).rotation.z = -0.8;
        add(propGeo.branch, mat, -0.45, 2.4, 0.2).rotation.z = 0.9;
        break;
      case "pine":
        add(propGeo.trunk, propMat(0x4a3424), 0, 0.8, 0, 0.8, 0.5, 0.8);
        add(propGeo.pine, mat, 0, 2.2, 0);
        add(propGeo.pine, mat, 0, 3.4, 0, 0.75, 0.85, 0.75);
        add(propGeo.pine, propMat(0xf6fbff), 0, 4.4, 0, 0.45, 0.6, 0.45);
        break;
      case "crystal":
        add(propGeo.crystal, mat, 0, 1.5, 0);
        add(propGeo.crystal, mat, 0.6, 1, 0.2, 0.7, 0.66, 0.7).rotation.z = -0.35;
        add(propGeo.crystal, mat, -0.5, 0.9, -0.2, 0.6, 0.6, 0.6).rotation.z = 0.4;
        break;
      case "snow":
        add(propGeo.mound, mat, 0, 0, 0, 0.75, 0.38, 0.6);
        break;
    }
    g.position.set(prop.x, GROUND_Y, prop.z);
    g.rotation.y = prop.turn;
    g.scale.setScalar(prop.scale);
    return g;
  }

  // A checkered banner for the finish arch.
  const checker = (() => {
    const board = document.createElement("canvas");
    board.width = 64;
    board.height = 8;
    const ctx = board.getContext("2d");
    if (ctx) for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 ? "#111111" : "#f4f4f4";
      ctx.fillRect(x * 4, y * 4, 4, 4);
    }
    const tex = new THREE.CanvasTexture(board);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    return tex;
  })();

  const trackRef = { current: null as Track | null };
  let decor: THREE.Group | null = null;
  const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 });
  let road: THREE.Mesh | null = null;
  let curb: THREE.Mesh | null = null;
  const asphalt = new THREE.Color(0x3a414b);
  const stripe = new THREE.Color(0xf4efe4);
  const sand = new THREE.Color(0xe6d3a3);
  const curbCoral = new THREE.Color(0xe25b3a);

  // The road takes its look from the coast track piece in assets/mesh: asphalt,
  // kerbs and the dashed centre line, in the piece's own colours and proportions.
  let trackSkin: TrackSkin | null = null;
  const trackPieceUrl = propUrl("coast_straight.glb");
  if (trackPieceUrl) {
    void new GLTFLoader().loadAsync(trackPieceUrl).then((gltf) => {
      let piece: THREE.Mesh | null = null;
      gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!piece && mesh.isMesh && mesh.geometry?.getAttribute("color")) piece = mesh;
      });
      const found = piece as THREE.Mesh | null;
      if (!found) return;
      const position = found.geometry.getAttribute("position");
      const tint = found.geometry.getAttribute("color");
      const xyz = new Float32Array(position.count * 3);
      const rgb = new Float32Array(position.count * 3);
      let peak = 0;
      for (let i = 0; i < position.count; i++) {
        xyz.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
        rgb.set([tint.getX(i), tint.getY(i), tint.getZ(i)], i * 3);
        peak = Math.max(peak, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
      }
      if (peak > 1.5) for (let i = 0; i < rgb.length; i++) rgb[i] /= 255; // bytes not normalised by the loader
      const read = readTrackSkin(xyz, rgb, 3);
      // The piece was painted for the screen (its preview shows dark asphalt), so
      // its colours are sRGB; the vertex colours of the road are linear.
      const linear = (c: Rgb): Rgb => {
        const out = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
        return [out.r, out.g, out.b];
      };
      trackSkin = { ...read, surface: linear(read.surface), kerb: linear(read.kerb), line: read.line ? linear(read.line) : null };
      trackRef.current = null; // rebuild the road in the new look
    }).catch((err) => console.warn("BCM track piece skipped", trackPieceUrl, err));
  }

  const karts: Kart[] = [];
  const vehicleTemplates: Array<{ running: THREE.Object3D; rest: THREE.Object3D | null }> = [];
  let fleetReady = false;
  const vehicleLoader = new GLTFLoader();
  void (async () => {
    const shape = async (file: string, nose: string, length: number) => {
      const gltf = await vehicleLoader.loadAsync(shipUrl(file));
      aimNose(gltf.scene, nose);
      const mesh = bake(gltf.scene, length, "xz");
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return mesh;
    };
    for (const form of RACE_SHIP_FORMS) {
      try {
        const running = await shape(form.running, form.nose, form.length);
        // A missing rest model is not a reason to lose the ship.
        const rest = form.rest !== form.running
          ? await shape(form.rest, form.nose, form.length).catch(() => null)
          : null;
        vehicleTemplates.push({ running, rest });
      } catch (err) {
        console.warn("BCM race ship skipped", form.running, err);
      }
    }
    fleetReady = vehicleTemplates.length > 0;
  })();
  let fleetAssigned = false;
  function makeModelKart(index: number, color: number): Kart | null {
    const template = vehicleTemplates[index % vehicleTemplates.length];
    if (!template) return null;
    const shell = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0,
      roughness: 0.45,
    });
    const group = new THREE.Group();
    const dress = (source: THREE.Object3D) => {
      const model = source.clone();
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const tint = src.clone();
        tint.color = new THREE.Color(0xffffff).lerp(new THREE.Color(color), 0.62);
        tint.vertexColors = true;
        mesh.material = tint;
      });
      model.position.y = 0.08;
      return model;
    };
    const running = dress(template.running);
    const rest = template.rest ? dress(template.rest) : undefined;
    // On the grid the engine is off.
    if (rest) running.visible = false;
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 14), shell);
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = 0.04;
    group.add(running, glowDisc);
    if (rest) group.add(rest);
    return { group, wheels: [], shell, running, rest, engineHold: 0 };
  }
  const boxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1.15, 1.15),
    new THREE.MeshStandardMaterial({
      color: 0xe4a322,
      emissive: 0xe4a322,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    }),
  );
  const boxes: THREE.Mesh[] = [];
  const slickGeo = new THREE.CircleGeometry(3.1, 16);
  const slickMat = new THREE.MeshBasicMaterial({ color: 0x1a2428, transparent: true, opacity: 0.72 });
  const slicks: THREE.Mesh[] = [];
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const lookS = new THREE.Vector3(0, 8, 0);
  let sized = false;

  // Fable slalom: gates of light over the road (race.gates, sim.ts).
  let gatesFor: Race["gates"] | null = null;
  let gateGroup: THREE.Group | null = null;
  const gatePostGeo = new THREE.CylinderGeometry(0.22, 0.3, 4.2, 8);
  const gateMat = new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.85 });
  const gateBeamMat = new THREE.MeshBasicMaterial({ color: 0xc89bff, transparent: true, opacity: 0.6 });
  function ensureGates(race: Race) {
    if (gatesFor === race.gates) return;
    gatesFor = race.gates;
    if (gateGroup) scene.remove(gateGroup);
    gateGroup = null;
    if (!race.gates.length) return;
    gateGroup = new THREE.Group();
    gateGroup.name = "race-gates";
    for (const gate of race.gates) {
      const p = sampleAt(race.track, gate.s);
      const cx = p.x + p.nx * gate.lat;
      const cz = p.z + p.nz * gate.lat;
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(gatePostGeo, gateMat);
        post.position.set(cx + p.nx * gate.half * side, ROAD_Y + 2.1, cz + p.nz * gate.half * side);
        gateGroup.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(gate.half * 2 + 0.5, 0.18, 0.18), gateBeamMat);
      beam.position.set(cx, ROAD_Y + 4.2, cz);
      beam.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI / 2;
      gateGroup.add(beam);
    }
    scene.add(gateGroup);
  }

  function ensureTrack(track: Track) {
    if (trackRef.current === track && road) return;
    trackRef.current = track;
    if (road) scene.remove(road);
    if (curb) scene.remove(curb);
    curb = null;
    // Everything placed along the road lives in one group, so a rebuild (track
    // piece loaded, other planet) replaces it instead of adding a second set.
    if (decor) scene.remove(decor);
    decor = new THREE.Group();
    decor.name = "race-decor-" + scenery.id;
    const here = decor;
    scene.add(decor);
    const lin = (c: [number, number, number]): Rgb => {
      const out = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
      return [out.r, out.g, out.b];
    };
    // The coast keeps the track piece's own colours; other planets repaint it.
    const skin = trackSkin && scenery.id !== "coast"
      ? { ...trackSkin, surface: lin(scenery.road.surface), kerb: lin(scenery.road.kerb), line: lin(scenery.road.line) }
      : trackSkin;
    asphalt.setRGB(...scenery.road.surface, THREE.SRGBColorSpace);
    curbCoral.setRGB(...scenery.road.kerb, THREE.SRGBColorSpace);
    sand.set(scenery.ground);
    const startStripe = (s: number) => {
      const nearLine = s < 5 || s > track.length - 5;
      return nearLine && Math.floor(s * 2) % 2 === 0;
    };
    if (skin) {
      const skinned = skinnedRoad(track, skin, ROAD_Y, (s) => (startStripe(s) ? [stripe.r, stripe.g, stripe.b] : null));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(skinned.position, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(skinned.color, 3));
      geo.setIndex(skinned.index);
      geo.computeVertexNormals();
      road = new THREE.Mesh(geo, roadMat);
      road.receiveShadow = true;
      scene.add(road);
    } else {
      // Until the track piece is loaded (or if it is missing): the plain ribbon.
      road = new THREE.Mesh(
        ribbon(track, -track.halfWidth, track.halfWidth, ROAD_Y, (s) => (startStripe(s) ? stripe : asphalt)),
        roadMat,
      );
      road.receiveShadow = true;
      curb = new THREE.Mesh(
        ribbon(track, track.halfWidth, track.halfWidth + 0.7, ROAD_Y + 0.05, (s) =>
          Math.floor(s / 5) % 2 === 0 ? curbCoral : sand,
        ),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
      );
      scene.add(road, curb);
    }

    const start = track.samples[0];
    const gantry = new THREE.Group();
    gantry.name = "race-arch-" + scenery.id;
    // The finish arch in the planet's style: posts, beam, a checkered banner,
    // fire bowls on the lava planet.
    const thick = scenery.id === "coast" ? 0.45 : 0.9;
    const postGeo = new THREE.BoxGeometry(thick, 4.6, thick);
    const postMat = new THREE.MeshStandardMaterial({ color: scenery.arch.post, roughness: 0.5 });
    for (const sign of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(
        start.x + start.nx * (track.halfWidth + 0.4) * sign,
        ROAD_Y + 2.3,
        start.z + start.nz * (track.halfWidth + 0.4) * sign,
      );
      post.castShadow = true;
      gantry.add(post);
      if (scenery.arch.flame) {
        const fire = new THREE.Mesh(propGeo.flame, propMat(0xff8a2a, 0, true));
        fire.position.set(post.position.x, ROAD_Y + 5.6, post.position.z);
        gantry.add(fire);
      }
    }
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(track.halfWidth * 2 + 1.6, 0.38, 0.45),
      new THREE.MeshStandardMaterial({ color: scenery.arch.beam, roughness: 0.45 }),
    );
    beam.position.set(start.x, ROAD_Y + 4.6, start.z);
    beam.rotation.y = Math.atan2(start.tx, start.tz);
    gantry.add(beam);
    if (scenery.id !== "coast") {
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(track.halfWidth * 2, 0.7),
        new THREE.MeshBasicMaterial({ map: checker, side: THREE.DoubleSide }),
      );
      banner.position.set(start.x, ROAD_Y + 4.05, start.z);
      banner.rotation.y = Math.atan2(start.tx, start.tz) + Math.PI / 2;
      gantry.add(banner);
    }
    here.add(gantry);

    const dashCount = Math.floor(track.length / 7);
    const dashes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.16, 0.05, 1.5),
      new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.5 }),
      dashCount,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < dashCount; i++) {
      const s = track.samples[Math.floor((i / dashCount) * track.samples.length)];
      dummy.position.set(s.x, ROAD_Y + 0.08, s.z);
      dummy.rotation.y = Math.atan2(s.tx, s.tz);
      dummy.updateMatrix();
      dashes.setMatrixAt(i, dummy.matrix);
    }
    here.add(dashes);

    const railCount = Math.max(12, Math.floor(track.length / 12));
    const railWhite = new THREE.MeshStandardMaterial({ color: scenery.rails[0], roughness: 0.55 });
    const railRed = new THREE.MeshStandardMaterial({ color: scenery.rails[1], roughness: 0.55 });
    const railGeo = new THREE.BoxGeometry(0.34, 0.62, 2.15);
    const rails = [
      new THREE.InstancedMesh(railGeo, railWhite, railCount + 2),
      new THREE.InstancedMesh(railGeo, railRed, railCount + 2),
    ];
    const railDummy = new THREE.Object3D();
    let whiteIndex = 0;
    let redIndex = 0;
    for (let i = 0; i < railCount * 2; i++) {
      const sample = track.samples[Math.floor((i / (railCount * 2)) * track.samples.length) % track.samples.length];
      const side = i % 2 === 0 ? 1 : -1;
      railDummy.position.set(
        sample.x + sample.nx * side * (track.halfWidth + 1.35),
        ROAD_Y + 0.36,
        sample.z + sample.nz * side * (track.halfWidth + 1.35),
      );
      railDummy.rotation.set(0, Math.atan2(sample.tx, sample.tz), 0);
      railDummy.updateMatrix();
      if ((Math.floor(i / 2) % 2) === 0) rails[0].setMatrixAt(whiteIndex++, railDummy.matrix);
      else rails[1].setMatrixAt(redIndex++, railDummy.matrix);
    }
    rails[0].count = whiteIndex;
    rails[1].count = redIndex;
    here.add(rails[0], rails[1]);

    const barrierUrl = scenery.barriers ? libraryUrl("coastal_pack02/coastal_pack02/barrier_redwhite.glb") : "";
    if (barrierUrl) {
      const barrierLoader = new GLTFLoader();
      void barrierLoader.loadAsync(barrierUrl).then((gltf) => {
        const source = bake(gltf.scene, 1.7, "xz");
        const count = Math.max(8, Math.floor(track.length / 28));
        const mesh = new THREE.InstancedMesh(source.geometry, source.material, count);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
          const sample = track.samples[Math.floor((i / count) * track.samples.length) % track.samples.length];
          const side = i % 2 === 0 ? 1 : -1;
          dummy.position.set(
            sample.x + sample.nx * side * (track.halfWidth + 3.4),
            ROAD_Y,
            sample.z + sample.nz * side * (track.halfWidth + 3.4),
          );
          dummy.rotation.y = Math.atan2(sample.tx, sample.tz);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        here.add(mesh);
      }).catch(() => {});
    }

    for (const prop of sceneryProps(track, scenery, sceneSeed)) here.add(buildProp(prop));
  }

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    sized = true;
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(host);
  resize();

  return {
    resize,
    dispose() {
      observer.disconnect();
      renderer.dispose();
    },
    update(race, phase, view, dt, elapsed) {
      if (!sized) resize();
      ensureScenery(race);
      ensureTrack(race.track);
      ensureGates(race);
      while (karts.length < race.cars.length) {
        const kart = makeKart(race.cars[karts.length].color);
        scene.add(kart.group);
        karts.push(kart);
      }
      if (fleetReady && !fleetAssigned && karts.length === race.cars.length) {
        fleetAssigned = true;
        const random = createSeededRandom(race.seed || 1, "race-ships");
        const order = seededShuffle(
          vehicleTemplates.map((_, index) => index),
          random,
        );
        for (let i = 0; i < karts.length; i++) {
          const next = makeModelKart(order[i % order.length], race.cars[i].color);
          if (!next) continue;
          next.group.position.copy(karts[i].group.position);
          next.group.rotation.copy(karts[i].group.rotation);
          scene.add(next.group);
          scene.remove(karts[i].group);
          karts[i] = next;
        }
      }
      race.cars.forEach((car, i) => {
        const kart = karts[i];
        kart.group.position.set(car.x, ROAD_Y, car.z);
        kart.group.rotation.y = car.yaw;
        const spin = car.speed * dt * 3.2;
        for (const wheel of kart.wheels) wheel.rotation.x += spin;
        // Engine on: the ship is moving or boosting. On the grid and at a
        // standstill it shows its rest form.
        if (kart.running && kart.rest) {
          const engineOn = phase !== "gate" && (Math.abs(car.speed) > 1.5 || car.boost > 0);
          kart.engineHold = engineOn ? 0.35 : Math.max(0, (kart.engineHold ?? 0) - dt);
          const showRunning = engineOn || (kart.engineHold ?? 0) > 0;
          kart.running.visible = showRunning;
          kart.rest.visible = !showRunning;
        }
        const hot = car.boost > 0 ? 0.55 : car.drifting ? 0.2 : 0;
        kart.shell.emissive.setHex(car.color);
        kart.shell.emissiveIntensity = hot;
      });

      while (boxes.length < race.boxes.length) {
        const mesh = boxMesh.clone();
        scene.add(mesh);
        boxes.push(mesh);
      }
      race.boxes.forEach((box, i) => {
        boxes[i].visible = box.alive;
        boxes[i].position.set(box.x, ROAD_Y + 0.85 + Math.sin(elapsed * 2.4 + i) * 0.12, box.z);
        boxes[i].rotation.y = elapsed * 0.8 + i;
      });

      while (slicks.length < race.slicks.length) {
        const mesh = new THREE.Mesh(slickGeo, slickMat);
        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);
        slicks.push(mesh);
      }
      slicks.forEach((mesh, i) => {
        const slick = race.slicks[i];
        mesh.visible = Boolean(slick);
        if (!slick) return;
        mesh.position.set(slick.x, ROAD_Y + 0.08, slick.z);
      });

      water.position.y = 0.2 + Math.sin(elapsed * 0.7) * 0.04;
      raceSky.position.copy(camera.position);

      const you = race.cars[0];
      const fx = -Math.sin(you.yaw);
      const fz = -Math.cos(you.yaw);
      if (phase === "gate") {
        const orbit = elapsed * 0.18;
        camera.position.set(Math.sin(orbit) * 108, 42, Math.cos(orbit) * 108);
        camera.lookAt(0, 10, 0);
        lookS.copy(camera.position);
      } else if (phase === "finish") {
        desired.set(you.x - fx * 16 + 8, 18, you.z - fz * 16);
        camera.position.lerp(desired, 1 - Math.exp(-2.2 * dt));
        camera.lookAt(you.x, 3, you.z);
      } else {
        const dist = view === 1 ? 8.2 : view === 2 ? 18 : 11.5;
        const height = view === 1 ? 2.4 : 5.6;
        desired.set(you.x - fx * dist, ROAD_Y + height, you.z - fz * dist);
        camera.position.lerp(desired, 1 - Math.exp(-4.2 * dt));
        look.set(you.x + fx * 7, ROAD_Y + 1.4, you.z + fz * 7);
        lookS.lerp(look, 1 - Math.exp(-6 * dt));
        camera.lookAt(lookS);
        const kick = you.boost > 0 ? 8 : 0;
        const nextFov = 58 + Math.min(14, you.speed * 0.28) + kick;
        camera.fov += (nextFov - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    },
  };
}

export function paintMap(board: HTMLCanvasElement, race: Race) {
  const ctx = board.getContext("2d");
  if (!ctx) return;
  const w = board.width;
  const h = board.height;
  ctx.clearRect(0, 0, w, h);
  const scale = (Math.min(w, h) * 0.46) / 136;
  const cx = w / 2;
  const cy = h / 2;
  const X = (x: number) => cx + x * scale;
  const Y = (z: number) => cy + z * scale;
  ctx.fillStyle = "rgba(16,32,39,0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#146e86";
  ctx.beginPath();
  ctx.arc(cx, cy, 136 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6d3a3";
  ctx.beginPath();
  ctx.arc(cx, cy, 136 * scale, 0, Math.PI * 2);
  ctx.arc(cx, cy, 48 * scale, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.fillStyle = "#6f9a5c";
  ctx.beginPath();
  ctx.arc(cx, cy, 22 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a414b";
  ctx.lineWidth = Math.max(3, race.track.halfWidth * scale * 1.7);
  ctx.lineJoin = "round";
  ctx.beginPath();
  race.track.samples.forEach((sample, i) => {
    const px = X(sample.x);
    const py = Y(sample.z);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.stroke();
  for (const car of race.cars) {
    ctx.fillStyle = `#${car.color.toString(16).padStart(6, "0")}`;
    ctx.beginPath();
    ctx.arc(X(car.x), Y(car.z), car.you ? 4.5 : 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
