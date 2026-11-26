/**
 * The scene of Orbis (orbis.ts): a sphere planet with rolling hills, the home base and the captain's
 * ships on the north pole, the castle tiers, six pirate towers, two villages, the shielded fortress on
 * the south pole, the loot on the ground and the bolts. The camera follows the ship over the curve of
 * the sphere. One WebGL context.
 *
 * Owner 26.11.2026: "мы разработали кучу моделек, а ты генеришь простейшие модели … старайся
 * использовать готовые решения по glb в репозитории". The ships are the catalogue's own GLBs
 * (game/ships.ts), the captain a Crew model, the crate the island's chest; a simple shape stands in
 * only while a model loads (or where the repository has none yet: boards, barrels, backpacks).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { meshUrl, propUrl } from "@/game/mesh-url";
import { pilotShip, shipUrl } from "@/game/ships";
import { aimNose } from "@/game/island/bake";
import {
  CAPTAIN_MODEL,
  PIRATE_MODEL,
  CASTLE_TIERS,
  FLEET,
  FORTRESS,
  HOME,
  ORBIS,
  VILLAGES,
  orbisHeight,
  type LootKind,
  type Orbis,
} from "./orbis";

type V = { x: number; y: number; z: number };
const Y = new THREE.Vector3(0, 1, 0);

export function createOrbisScene(canvas: HTMLCanvasElement, game: Orbis) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2440);
  scene.fog = new THREE.Fog(0x1b2440, 120, 420);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 900);
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x3a2c1e, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.25);
  sun.position.set(260, 320, 180);
  scene.add(sun);

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const keepG = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g; };
  const keepM = <T extends THREE.Material>(m: T) => { mats.push(m); return m; };
  const R = ORBIS.radius;
  const ground = (n: V, lift = 0) => game.state.ground(n, lift);
  /** Stand an object on the sphere at unit direction n, its +Y along the normal. */
  const stand = (obj: THREE.Object3D, n: V, lift = 0) => {
    const p = ground(n, lift);
    obj.position.set(p.x, p.y, p.z);
    const u = new THREE.Vector3(n.x, n.y, n.z).normalize();
    obj.quaternion.setFromUnitVectors(Y, u);
    return obj;
  };

  // The planet: an icosphere displaced by the hills, coloured by height and latitude.
  const planetGeo = keepG(new THREE.IcosahedronGeometry(R, 40));
  const pos = planetGeo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const n = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const h = orbisHeight(n);
    const r = R + h;
    pos.setXYZ(i, n.x * r, n.y * r, n.z * r);
    if (Math.abs(n.y) > 0.93) c.setHex(0x9a958a);
    else if (h < 2.2) c.setHex(0x3f7a4a);
    else if (h < 4.4) c.setHex(0x6d8c45);
    else c.setHex(0xb39a6a);
    colors.push(c.r, c.g, c.b);
  }
  planetGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  planetGeo.computeVertexNormals();
  const planet = new THREE.Mesh(planetGeo, keepM(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })));
  scene.add(planet);

  const box = keepG(new THREE.BoxGeometry(1, 1, 1));
  const cyl = keepG(new THREE.CylinderGeometry(0.5, 0.5, 1, 12));
  const cone = keepG(new THREE.ConeGeometry(0.5, 1, 10));
  const ball = keepG(new THREE.SphereGeometry(0.5, 12, 8));
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => keepM(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }));
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  };

  // Ready GLBs from the repository. A model is fitted to a length (ships) or a height (people) and
  // turned so its nose looks along +Z, the way the ship group flies.
  const loader = new GLTFLoader();
  let alive = true;
  function dressWith(holder: THREE.Group, url: string, fit: { length?: number; height?: number }, nose = "") {
    if (!url) return;
    loader.load(url, (gltf) => {
      if (!alive) return;
      const model = gltf.scene;
      // A hull's nose is found as the island finds it (bake.ts aimNose: the catalogue axis, else the
      // part names) and then turned to +Z, the way the Orbis ship flies.
      if (fit.length) { aimNose(model, nose); model.rotation.y += Math.PI; }
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const k = fit.height ? fit.height / Math.max(0.01, size.y) : (fit.length ?? 6) / Math.max(0.01, Math.max(size.x, size.z));
      const pivot = new THREE.Group();
      const centre = box.getCenter(new THREE.Vector3());
      model.position.sub(new THREE.Vector3(centre.x, fit.height ? box.min.y : centre.y, centre.z));
      pivot.add(model);
      pivot.scale.setScalar(k);
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) { geos.push(mesh.geometry); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => mats.push(m)); }
      });
      holder.clear();
      holder.add(pivot);
    }, undefined, () => { /* keep the stand-in shape */ });
  }
  const shipModel = (id: string, length: number) => {
    const ship = pilotShip(id);
    const holder = new THREE.Group();
    holder.add(makeShip(0x9aa4b2));
    dressWith(holder, shipUrl(ship.flightFile), { length }, ship.nose);
    return holder;
  };

  // Home base: a stone apron, the captain, three parked ships, and the castle that grows.
  const stone = mat(0xd9ccb0);
  const dark = mat(0x8c8070);
  const home = new THREE.Group();
  home.add(part(cyl, dark, 0, 0, 0, 26, 0.6, 26));
  const captain = new THREE.Group();
  captain.add(part(cyl, mat(0x2d4a7a), 0, 0.9, 0, 0.7, 1.8, 0.7), part(ball, mat(0xe7c7a5), 0, 2.1, 0, 0.6, 0.6, 0.6));
  captain.position.set(4, 0.3, 6);
  dressWith(captain, propUrl(CAPTAIN_MODEL), { height: 1.85 });
  home.add(captain);
  const fleetColors: Record<string, number> = { skiff: 0x3fb4ff, barge: 0xc7903a, lancer: 0xd84a4a };
  const makeShip = (color: number) => {
    const g = new THREE.Group();
    g.add(part(box, mat(color), 0, 0, 0, 1.6, 0.6, 3.6));
    g.add(part(box, mat(0x2a2f38), 0, 0, 0.4, 4.6, 0.18, 1.2));
    g.add(part(cone, mat(0xffd27a, { emissive: 0x553300 }), 0, 0, 2.1, 0.5, 0.9, 0.5).rotateX(Math.PI / 2));
    return g;
  };
  const parked: THREE.Group[] = [];
  FLEET.forEach((make, i) => {
    const s = shipModel(make.model, make.length);
    s.position.set(-9 + i * 9, 1.4, 10);
    home.add(s);
    parked.push(s);
  });
  void fleetColors;
  const castle = new THREE.Group();
  castle.position.set(-6, 0.3, -6);
  const H = 3.6;
  const tiers = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
  tiers[0].add(part(box, dark, 0, 0.2, 0, H * 2 + 0.6, 0.5, H * 2 + 0.6));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => tiers[0].add(part(box, stone, sx * H, 0.6, sz * H, 0.9, 0.8, 0.9)));
  tiers[1].add(part(box, stone, 0, 1.3, -H, H * 2, 2.2, 0.45), part(box, stone, -H, 1.3, 0, 0.45, 2.2, H * 2), part(box, stone, 0, 1.3, H, H * 2, 2.2, 0.45));
  tiers[1].add(part(box, stone, H, 1.3, -H * 0.55, 0.45, 2.2, H * 0.9), part(box, stone, H, 1.3, H * 0.55, 0.45, 2.2, H * 0.9));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => tiers[2].add(part(box, stone, sx * H, 2.1, sz * H, 1.4, 3.6, 1.4)));
  tiers[3].add(part(box, stone, 0, 2.9, 0, 2.6, 5.2, 2.6), part(box, dark, 0, 5.7, 0, 3, 0.4, 3), part(box, dark, 0, 7, 0, 0.12, 2.4, 0.12));
  const flag = new THREE.Mesh(keepG(new THREE.PlaneGeometry(1.4, 0.8)), mat(0xffb347, { side: THREE.DoubleSide }));
  flag.position.set(0.72, 7.8, 0);
  tiers[3].add(flag);
  castle.add(...tiers);
  home.add(castle);
  stand(home, HOME, 0);
  scene.add(home);

  // Villages: a few houses around a well.
  for (const v of VILLAGES) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2;
      g.add(part(box, mat(0xe3d2b0), Math.cos(a) * 7, 1.2, Math.sin(a) * 7, 3, 2.4, 3));
      g.add(part(cone, mat(0x9a4f35), Math.cos(a) * 7, 3, Math.sin(a) * 7, 4.4, 1.6, 4.4));
    }
    g.add(part(cyl, dark, 0, 0.5, 0, 1.6, 1, 1.6));
    stand(g, v.n, 0);
    scene.add(g);
  }

  // Pirate towers: a dark shaft with a red crown; rubble when down.
  const towerMat = mat(0x3a3740);
  const crownMat = mat(0xff4a3a, { emissive: 0x661010 });
  const towers = game.state.towers.map((t) => {
    const g = new THREE.Group();
    const up = new THREE.Group();
    up.add(part(cyl, towerMat, 0, 4, 0, 2.2, 8, 2.2), part(cone, crownMat, 0, 9, 0, 3, 2.4, 3));
    const gunship = shipModel(PIRATE_MODEL, 6);
    gunship.position.y = 12.5;
    up.add(gunship);
    const rubble = new THREE.Group();
    for (let k = 0; k < 6; k += 1) rubble.add(part(box, towerMat, (k % 3) - 1, 0.4, Math.floor(k / 3) - 0.5, 1.2, 0.8, 1.1));
    rubble.visible = false;
    g.add(up, rubble);
    stand(g, t.n, -0.2);
    scene.add(g);
    return { up, rubble };
  });

  // The fortress on the south pole and its shield.
  const fortress = new THREE.Group();
  fortress.add(part(cyl, mat(0x2c2a33), 0, 4, 0, 16, 8, 16), part(cone, crownMat, 0, 10, 0, 10, 5, 10));
  const hatch = part(cyl, mat(0x0d0d12), 0, 8.2, 0, 5, 0.3, 5);
  hatch.visible = false;
  fortress.add(hatch);
  const shield = new THREE.Mesh(ball, keepM(new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.22, depthWrite: false })));
  shield.scale.setScalar(30);
  shield.position.y = 4;
  fortress.add(shield);
  stand(fortress, FORTRESS, 0);
  scene.add(fortress);

  // Loot on the ground: boards, crates, barrels, backpacks.
  const lootLook: Record<LootKind, () => THREE.Object3D> = {
    board: () => { const g = new THREE.Group(); [0, 0.22, 0.44].forEach((y) => g.add(part(box, mat(0xa0703c), 0, y, 0, 2.4, 0.18, 0.5))); return g; },
    crate: () => { const g = new THREE.Group(); g.add(part(box, mat(0xc69a52), 0, 0.5, 0, 1.1, 1.1, 1.1)); dressWith(g, meshUrl("chest.glb"), { height: 1.1 }); return g; },
    barrel: () => part(cyl, mat(0x6b4a2e), 0, 0.65, 0, 1, 1.3, 1),
    backpack: () => part(box, mat(0x5f7d3a), 0, 0.45, 0, 0.9, 1, 0.6),
  };
  const dropMeshes: THREE.Object3D[] = [];

  // The player's ship (the model of the ship the captain lent) and the bolts.
  const shipMesh = new THREE.Group();
  scene.add(shipMesh);
  let shipMeshFor = "";
  const boltGeo = keepG(new THREE.SphereGeometry(0.35, 8, 6));
  const ours = keepM(new THREE.MeshBasicMaterial({ color: 0x8ff8ff }));
  const theirs = keepM(new THREE.MeshBasicMaterial({ color: 0xff5a3a }));
  const boltMeshes: THREE.Mesh[] = [];

  let w = 1, h = 1;
  function resize() {
    const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
    if (cw === w && ch === h) return;
    w = cw; h = ch;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const basis = new THREE.Matrix4();
  function frame(time: number) {
    resize();
    const s = game.state;
    tiers.forEach((tier, i) => { tier.visible = i <= s.castle; });
    flag.rotation.y = Math.sin(time * 0.0013) * 0.25;
    s.towers.forEach((t, i) => { towers[i].up.visible = t.hp > 0; towers[i].rubble.visible = t.hp <= 0; });
    shield.visible = game.shieldUp();
    hatch.visible = s.fortress.open;

    while (dropMeshes.length < s.drops.length) {
      const d = s.drops[dropMeshes.length];
      const m = lootLook[d.kind]();
      const n = { x: d.at.x, y: d.at.y, z: d.at.z };
      stand(m, n, 0);
      scene.add(m);
      dropMeshes.push(m);
    }
    s.drops.forEach((d, i) => { dropMeshes[i].visible = !d.taken; dropMeshes[i].rotateY(0.01); });

    while (boltMeshes.length < s.bolts.length) { const m = new THREE.Mesh(boltGeo, ours); scene.add(m); boltMeshes.push(m); }
    boltMeshes.forEach((m, i) => {
      const b = s.bolts[i];
      m.visible = !!b;
      if (!b) return;
      m.material = b.enemy ? theirs : ours;
      m.position.set(b.at.x, b.at.y, b.at.z);
    });

    const ship = s.ship;
    if (ship && s.fleetId !== shipMeshFor) {
      shipMeshFor = s.fleetId ?? "";
      const make = FLEET.find((m) => m.id === s.fleetId) ?? FLEET[0];
      shipMesh.clear();
      shipMesh.add(shipModel(make.model, make.length));
      // The ship taken leaves its berth.
      parked.forEach((p, i) => { p.visible = FLEET[i].id !== s.fleetId; });
    }
    if (ship) {
      shipMesh.visible = true;
      const f = new THREE.Vector3(ship.forward.x, ship.forward.y, ship.forward.z);
      const u = new THREE.Vector3(ship.up.x, ship.up.y, ship.up.z);
      const r = new THREE.Vector3().crossVectors(u, f).normalize();
      basis.makeBasis(r, u, f);
      shipMesh.quaternion.setFromRotationMatrix(basis);
      shipMesh.rotateZ(ship.bank);
      shipMesh.position.set(ship.position.x, ship.position.y, ship.position.z);
      const p = new THREE.Vector3(ship.position.x, ship.position.y, ship.position.z);
      camera.position.copy(p).addScaledVector(f, -15).addScaledVector(u, 6);
      camera.up.copy(u);
      camera.lookAt(p.clone().addScaledVector(f, 8));
    } else {
      // Before the captain's word: look at the home base from above.
      shipMesh.visible = false;
      const top = ground(HOME, 0);
      camera.position.set(top.x + 26, top.y + 22, top.z + 30);
      camera.up.set(0, 1, 0);
      camera.lookAt(top.x, top.y, top.z);
    }
    renderer.render(scene, camera);
  }

  function dispose() {
    alive = false;
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    renderer.dispose();
  }

  /** The castle's next tier and what it still needs (for the HUD). */
  function nextTier() {
    const t = CASTLE_TIERS[game.state.castle];
    return t ? t : null;
  }

  return { frame, dispose, nextTier };
}
