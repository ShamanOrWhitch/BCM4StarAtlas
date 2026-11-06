import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { bake } from "./island/bake";
import { createSeededRandom } from "./seed";
import type { Race } from "./sim";
import { ROAD_Y, sampleAt, type Track } from "./track";

export type Phase = "gate" | "race" | "pause" | "finish";

type Kart = {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  shell: THREE.MeshStandardMaterial;
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

export function createWorld(canvas: HTMLCanvasElement, seed = 0): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  const host = canvas.parentElement ?? canvas;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ec4dc);
  scene.fog = new THREE.Fog(0xb7d6e4, 80, 360);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
  camera.position.set(0, 48, 120);

  const hemi = new THREE.HemisphereLight(0xfff1d2, 0x1a6e82, 0.9);
  const sun = new THREE.DirectionalLight(0xffe0a8, 1.45);
  sun.position.set(90, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  const coral = new THREE.DirectionalLight(0xe25b3a, 0.45);
  coral.position.set(-70, 40, -40);
  scene.add(hemi, sun, coral);

  const goldSun = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow("#ffd27a"), transparent: true, depthWrite: false, fog: false }),
  );
  goldSun.position.set(150, 78, -40);
  goldSun.scale.set(46, 46, 1);
  const roseSun = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow("#ff8d6a"), transparent: true, depthWrite: false, fog: false }),
  );
  roseSun.position.set(-120, 54, -150);
  roseSun.scale.set(28, 28, 1);
  scene.add(goldSun, roseSun);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(240, 48),
    new THREE.MeshStandardMaterial({ color: 0x146e86, roughness: 0.22, metalness: 0.35 }),
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

  const trackRef = { current: null as Track | null };
  const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 });
  let road: THREE.Mesh | null = null;
  let curb: THREE.Mesh | null = null;
  const asphalt = new THREE.Color(0x3a414b);
  const stripe = new THREE.Color(0xf4efe4);
  const sand = new THREE.Color(0xe6d3a3);
  const curbCoral = new THREE.Color(0xe25b3a);

  const karts: Kart[] = [];
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
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d45, roughness: 0.8 });
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 3.1, 5);
  const leafGeo = new THREE.SphereGeometry(1.05, 6, 4);
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const lookS = new THREE.Vector3(0, 8, 0);
  let sized = false;
  const worldSeed = Number(seed) >>> 0;
  const coastalRoot = new THREE.Group();
  coastalRoot.name = "shoal-race-coastal-scenery";
  scene.add(coastalRoot);
  const coastalLoader = new GLTFLoader();
  const coastalGeometries = new Set<THREE.BufferGeometry>();
  const coastalMaterials = new Set<THREE.Material>();
  let coastalTrack: Track | null = null;
  let disposed = false;
  let simpleGantry: THREE.Group | null = null;

  const coastalUrl = (file: string) => {
    const config = (window as Window & {
      BCMFirstPlanetConfig?: { meshLibraryBase?: string };
    }).BCMFirstPlanetConfig;
    const encoded = file.split("/").map((part) => encodeURIComponent(part)).join("/");
    if (config?.meshLibraryBase) {
      return config.meshLibraryBase.replace(/\/?$/, "/") + encoded;
    }
    const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
    return `${prefix}/mesh-library/${encoded}`;
  };

  const coastalSpecs = [
    { key: "lighthouse", file: "coastal_environment/coastal_environment/lighthouse.glb", target: 18, axis: "y" as const },
    { key: "redBuoy", file: "coastal_environment/coastal_environment/navigation_buoy_red.glb", target: 2.8, axis: "y" as const },
    { key: "palm", file: "coastal_environment/coastal_environment/palm_tree.glb", target: 8.5, axis: "y" as const },
    { key: "finishGate", file: "coastal_environment/coastal_environment/race_finish_gate.glb", target: 18, axis: "xz" as const },
    { key: "shoreRocks", file: "coastal_pack02/coastal_pack02/shore_rocks.glb", target: 6.5, axis: "xz" as const },
    { key: "seaArch", file: "coastal_pack02/coastal_pack02/sea_rock_arch.glb", target: 15, axis: "xz" as const },
    { key: "dock", file: "coastal_pack02/coastal_pack02/dock_straight.glb", target: 20, axis: "xz" as const },
    { key: "dockPlatform", file: "coastal_pack02/coastal_pack02/dock_platform.glb", target: 12, axis: "xz" as const },
    { key: "barrierSandstone", file: "coastal_pack02/coastal_pack02/barrier_sandstone.glb", target: 5, axis: "xz" as const },
    { key: "barrierRed", file: "coastal_pack02/coastal_pack02/barrier_redwhite.glb", target: 5.5, axis: "xz" as const },
    { key: "buoyYellow", file: "coastal_pack02/coastal_pack02/buoy_yellow.glb", target: 2.8, axis: "y" as const },
    { key: "buoyGreen", file: "coastal_pack02/coastal_pack02/buoy_green.glb", target: 2.8, axis: "y" as const },
    { key: "sandIslet", file: "coastal_pack02/coastal_pack02/small_sand_islet.glb", target: 8, axis: "xz" as const },
    { key: "boat", file: "coastal_pack02/coastal_pack02/wooden_boat.glb", target: 6.5, axis: "xz" as const },
    { key: "driftwood", file: "coastal_pack02/coastal_pack02/driftwood.glb", target: 3.5, axis: "xz" as const },
  ];

  async function loadCoastalScenery(track: Track) {
    if (coastalTrack === track) return;
    coastalTrack = track;
    const models = new Map<string, THREE.Mesh>();
    const loadOne = async (spec: (typeof coastalSpecs)[number]) => {
      try {
        const gltf = await coastalLoader.loadAsync(coastalUrl(spec.file));
        const mesh = bake(gltf.scene, spec.target, spec.axis);
        mesh.material = mesh.material.clone();
        return { key: spec.key, mesh };
      } catch (error) {
        console.warn("Shoal Race coastal prop skipped:", spec.file, error);
        return null;
      }
    };
    for (let i = 0; i < coastalSpecs.length; i += 3) {
      const batch = await Promise.all(coastalSpecs.slice(i, i + 3).map(loadOne));
      if (disposed) {
        batch.forEach((entry) => {
          if (!entry) return;
          entry.mesh.geometry.dispose();
          (entry.mesh.material as THREE.Material).dispose();
        });
        return;
      }
      batch.forEach((entry) => {
        if (!entry) return;
        models.set(entry.key, entry.mesh);
        coastalGeometries.add(entry.mesh.geometry);
        coastalMaterials.add(entry.mesh.material as THREE.Material);
      });
    }
    if (disposed) return;

    const pointAt = (fraction: number, side: number, lateral: number) => {
      const sample = sampleAt(track, fraction * track.length);
      return {
        x: sample.x + sample.nx * side * lateral,
        z: sample.z + sample.nz * side * lateral,
        yaw: Math.atan2(-sample.tx, -sample.tz),
      };
    };

    const place = (
      key: string,
      fraction: number,
      side: number,
      lateral: number,
      scale = 1,
      y = 1.08,
      yawOffset = 0,
    ) => {
      const source = models.get(key);
      if (!source) return;
      const p = pointAt(fraction, side, lateral);
      const mesh = new THREE.Mesh(source.geometry, source.material);
      mesh.position.set(p.x, y, p.z);
      mesh.rotation.y = p.yaw + yawOffset;
      mesh.scale.setScalar(scale);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      coastalRoot.add(mesh);
    };

    const scatter = (
      key: string,
      fractions: number[],
      lateral: number,
      salt: string,
      options: { jitter?: number; minScale?: number; maxScale?: number; y?: number; randomYaw?: boolean } = {},
    ) => {
      const source = models.get(key);
      if (!source || !fractions.length) return;
      const random = createSeededRandom(worldSeed, salt);
      const instances = new THREE.InstancedMesh(source.geometry, source.material, fractions.length);
      const transform = new THREE.Object3D();
      fractions.forEach((fraction, index) => {
        const side = index % 2 === 0 ? 1 : -1;
        const p = pointAt(fraction, side, lateral + (random() - 0.5) * (options.jitter ?? 1.6));
        transform.position.set(p.x, options.y ?? 1.08, p.z);
        transform.rotation.set(0, p.yaw + (options.randomYaw ? random() * Math.PI * 2 : (random() - 0.5) * 0.18), 0);
        const minScale = options.minScale ?? 0.88;
        const maxScale = options.maxScale ?? 1.12;
        transform.scale.setScalar(minScale + random() * (maxScale - minScale));
        transform.updateMatrix();
        instances.setMatrixAt(index, transform.matrix);
      });
      instances.instanceMatrix.needsUpdate = true;
      instances.castShadow = false;
      instances.receiveShadow = false;
      instances.computeBoundingBox();
      instances.computeBoundingSphere();
      coastalRoot.add(instances);
    };

    // The GLB replaces the simple blockout gate when it loads; if it fails,
    // the existing gate stays visible. Racing physics and the road are untouched.
    place("finishGate", 0, 0, 0, 1, ROAD_Y, 0);
    if (models.has("finishGate") && simpleGantry) simpleGantry.visible = false;

    // A navigational landmark beyond the outer racing edge.
    place("lighthouse", 0.29, -1, 27.5, 1, 1.08, 0.15);
    place("seaArch", 0.56, 1, 24.5, 0.94, 1.08, -0.25);

    // A compact working harbour on the broad shoal, away from the road.
    place("dock", 0.76, 1, 24.5, 0.94, 1.08, 0);
    place("dockPlatform", 0.76, 1, 16.5, 0.9, 1.08, 0);
    place("boat", 0.775, 1, 13.2, 1, 0.56, 0.24);
    place("sandIslet", 0.18, -1, 29, 0.9, 0.72, 0.2);
    place("sandIslet", 0.48, 1, 30.5, 0.82, 0.72, -0.3);

    // Repeated shoreline dressing is instanced per family, deterministic per
    // race seed and deliberately non-colliding.
    scatter("palm", [0.035, 0.14, 0.245, 0.36, 0.485, 0.61, 0.735, 0.86, 0.955], 22, "race-coastal-palms", {
      jitter: 2.8, minScale: 0.88, maxScale: 1.16, randomYaw: true,
    });
    scatter("shoreRocks", [0.02, 0.095, 0.19, 0.28, 0.39, 0.49, 0.59, 0.69, 0.8, 0.9], 18.6, "race-shore-rocks", {
      jitter: 2.4, minScale: 0.82, maxScale: 1.18, randomYaw: true,
    });
    scatter("redBuoy", [0.08, 0.31, 0.56, 0.82], 26, "race-red-buoys", {
      jitter: 1.4, minScale: 0.88, maxScale: 1.12, y: 0.48, randomYaw: true,
    });
    scatter("buoyYellow", [0.18, 0.43, 0.68, 0.93], 28, "race-yellow-buoys", {
      jitter: 1.5, minScale: 0.9, maxScale: 1.12, y: 0.48, randomYaw: true,
    });
    scatter("buoyGreen", [0.055, 0.295, 0.545, 0.795], 30, "race-green-buoys", {
      jitter: 1.5, minScale: 0.9, maxScale: 1.12, y: 0.48, randomYaw: true,
    });
    scatter("barrierRed", [0.12, 0.16, 0.35, 0.39, 0.62, 0.66, 0.86, 0.9], 10.9, "race-redwhite-barriers", {
      jitter: 0.55, minScale: 0.9, maxScale: 1.08,
    });
    scatter("barrierSandstone", [0.24, 0.47, 0.73], 12.2, "race-sandstone-barriers", {
      jitter: 0.7, minScale: 0.9, maxScale: 1.08,
    });
    scatter("driftwood", [0.21, 0.52, 0.88], 24, "race-driftwood", {
      jitter: 2, minScale: 0.8, maxScale: 1.18, randomYaw: true,
    });
  }

  function ensureTrack(track: Track) {
    if (trackRef.current === track && road) return;
    trackRef.current = track;
    if (road) scene.remove(road);
    if (curb) scene.remove(curb);
    road = new THREE.Mesh(
      ribbon(track, -track.halfWidth, track.halfWidth, ROAD_Y, (s) => {
        const nearLine = s < 5 || s > track.length - 5;
        return nearLine && Math.floor(s * 2) % 2 === 0 ? stripe : asphalt;
      }),
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

    const start = track.samples[0];
    const gantry = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.45, 4.6, 0.45);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.5 });
    for (const sign of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(
        start.x + start.nx * (track.halfWidth + 0.4) * sign,
        ROAD_Y + 2.3,
        start.z + start.nz * (track.halfWidth + 0.4) * sign,
      );
      post.castShadow = true;
      gantry.add(post);
    }
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(track.halfWidth * 2 + 1.6, 0.38, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xe4a322, roughness: 0.45 }),
    );
    beam.position.set(start.x, ROAD_Y + 4.6, start.z);
    beam.rotation.y = Math.atan2(start.tx, start.tz);
    gantry.add(beam);
    simpleGantry = gantry;
    scene.add(gantry);

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
    scene.add(dashes);

    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const x = Math.cos(ang) * 58;
      const z = Math.sin(ang) * 58;
      let clear = true;
      for (const sample of track.samples) {
        if ((sample.x - x) ** 2 + (sample.z - z) ** 2 < 16 * 16) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = ROAD_Y + 1.5;
      trunk.castShadow = true;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = ROAD_Y + 3.3;
      leaf.scale.set(1, 0.38, 1);
      palm.add(trunk, leaf);
      palm.position.set(x, 0, z);
      scene.add(palm);
    }

    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + 0.4;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2.4 + (i % 3)),
        new THREE.MeshStandardMaterial({ color: 0x8d8478, roughness: 0.95 }),
      );
      rock.position.set(Math.cos(ang) * 150, 1.2, Math.sin(ang) * 150);
      rock.castShadow = true;
      scene.add(rock);
    }
    void loadCoastalScenery(track);
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
      disposed = true;
      observer.disconnect();
      coastalGeometries.forEach((geometry) => geometry.dispose());
      coastalMaterials.forEach((material) => material.dispose());
      coastalRoot.clear();
      renderer.dispose();
    },
    update(race, phase, view, dt, elapsed) {
      if (!sized) resize();
      ensureTrack(race.track);
      while (karts.length < race.cars.length) {
        const kart = makeKart(race.cars[karts.length].color);
        scene.add(kart.group);
        karts.push(kart);
      }
      race.cars.forEach((car, i) => {
        const kart = karts[i];
        kart.group.position.set(car.x, ROAD_Y, car.z);
        kart.group.rotation.y = car.yaw;
        const spin = car.speed * dt * 3.2;
        for (const wheel of kart.wheels) wheel.rotation.x += spin;
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
        const dist = view === 1 ? 7.5 : view === 2 ? 18 : 12.5;
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
