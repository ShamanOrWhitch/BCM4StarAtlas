import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Race } from "./sim";
import { RACE_SHIPS, shipUrl } from "./ships";
import { ROAD_Y, type Track } from "./track";
import { bake, faceForward } from "./island/bake";
import { propUrl } from "./mesh-url";

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
  scene.background = new THREE.Color(0x8ec4dc);
  scene.fog = new THREE.Fog(0xb7d6e4, 80, 360);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
  camera.position.set(0, 48, 120);

  const hemi = new THREE.HemisphereLight(0xd5e7f2, 0x1a6e82, 0.95);
  const goldSun = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow("#ffd27a"), transparent: true, depthWrite: false, fog: false }),
  );
  goldSun.position.set(150, 78, -40);
  goldSun.scale.set(46, 46, 1);
  const roseSun = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow("#ffb089"), transparent: true, depthWrite: false, fog: false }),
  );
  roseSun.position.set(-120, 54, -150);
  roseSun.scale.set(28, 28, 1);
  scene.add(goldSun, roseSun);
  // Same rule as the island: the water glint uses the sun you see, not a light off to the side.
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.15);
  sun.position.copy(goldSun.position);
  sun.target.position.set(0, 0.2, 0);
  sun.castShadow = false;
  const coral = new THREE.DirectionalLight(0xc5d8e6, 0.22);
  coral.position.copy(roseSun.position);
  coral.target.position.set(0, 0.2, 0);
  scene.add(hemi, sun, sun.target, coral, coral.target);

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

  const trackRef = { current: null as Track | null };
  const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 });
  let road: THREE.Mesh | null = null;
  let curb: THREE.Mesh | null = null;
  const asphalt = new THREE.Color(0x3a414b);
  const stripe = new THREE.Color(0xf4efe4);
  const sand = new THREE.Color(0xe6d3a3);
  const curbCoral = new THREE.Color(0xe25b3a);

  const karts: Kart[] = [];
  const vehicleTemplates: THREE.Object3D[] = [];
  const vehicleLoader = new GLTFLoader();
  void (async () => {
    const sizes = RACE_SHIPS.map(() => 3.15);
    for (let i = 0; i < RACE_SHIPS.length; i++) {
      try {
        const gltf = await vehicleLoader.loadAsync(shipUrl(RACE_SHIPS[i]));
        const mesh = bake(gltf.scene, sizes[i] ?? 3.15, "xz");
        faceForward(mesh);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        vehicleTemplates.push(mesh);
      } catch (err) {
        console.warn("BCM race ship skipped", RACE_SHIPS[i], err);
      }
    }
  })();
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
    const model = template.clone();
    model.position.y = 0.08;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 14), shell);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.04;
    group.add(model, glow);
    return { group, wheels: [], shell };
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
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d45, roughness: 0.8 });
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 3.1, 5);
  const leafGeo = new THREE.SphereGeometry(1.05, 6, 4);
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const lookS = new THREE.Vector3(0, 8, 0);
  let sized = false;

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

    const railCount = Math.max(12, Math.floor(track.length / 12));
    const railWhite = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.55 });
    const railRed = new THREE.MeshStandardMaterial({ color: 0xc4493a, roughness: 0.55 });
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
    scene.add(rails[0], rails[1]);

    const barrierUrl = propUrl("coastal_pack02/coastal_pack02/barrier_redwhite.glb");
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
        scene.add(mesh);
      }).catch(() => {});
    }

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

    for (let i = 0; i < 14; i++) {
      const sample = track.samples[Math.floor((i / 14) * track.samples.length)];
      const side = i % 2 === 0 ? 1 : -1;
      const reach = track.halfWidth + 8 + (i % 3) * 2.2;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.9 + (i % 3) * 0.45, 0),
        new THREE.MeshStandardMaterial({ color: 0x8d8478, roughness: 0.95 }),
      );
      rock.position.set(sample.x + sample.nx * side * reach, ROAD_Y + 0.4, sample.z + sample.nz * side * reach);
      scene.add(rock);
    }
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
      ensureTrack(race.track);
      while (karts.length < race.cars.length) {
        const kart = makeKart(race.cars[karts.length].color);
        scene.add(kart.group);
        karts.push(kart);
      }
      if (vehicleTemplates.length) {
        for (let i = 0; i < karts.length; i++) {
          if (karts[i].wheels.length === 0) continue;
          const next = makeModelKart(i, race.cars[i].color);
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
