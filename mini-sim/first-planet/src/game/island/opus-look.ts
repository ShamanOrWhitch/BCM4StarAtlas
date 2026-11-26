/**
 * What the Opus flight loop looks like (IDEA-026 step 1): the spark store by the pad, the sparks,
 * the wardens on the spark nodes and the bolts. Built from plain shapes with shared geometry and
 * materials (one draw per object, no new model files); our own look, not a copy of any game.
 * The loop itself is carpet.ts.
 */
import * as THREE from "three";
import { LOOP, NODE, type CarpetState } from "./carpet";
import { OPUS_BASE, OPUS_PILLARS } from "./terrain";

export function createOpusLook(
  scene: THREE.Scene,
  carpet: CarpetState,
  ground: (x: number, z: number) => number,
  track: { geos: Set<THREE.BufferGeometry>; mats: Set<THREE.Material> },
) {
  const keep = <T extends THREE.BufferGeometry | THREE.Material>(item: T) => {
    if (item instanceof THREE.BufferGeometry) track.geos.add(item);
    else track.mats.add(item as THREE.Material);
    return item;
  };
  const root = new THREE.Group();
  root.name = "opus-loop";
  scene.add(root);

  // The store: a limestone ring with an amber column of light that grows with the store.
  const baseY = ground(OPUS_BASE.x, OPUS_BASE.z);
  const ringMesh = new THREE.Mesh(
    keep(new THREE.TorusGeometry(OPUS_BASE.r - 0.6, 0.35, 8, 36)),
    keep(new THREE.MeshStandardMaterial({ color: 0xe8dcc2, roughness: 0.8 })),
  );
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.set(OPUS_BASE.x, baseY + 0.25, OPUS_BASE.z);
  const columnMat = keep(new THREE.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0.55, depthWrite: false }));
  const column = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.7, 0.9, 1, 14, 1, true)), columnMat);
  column.position.set(OPUS_BASE.x, baseY, OPUS_BASE.z);
  const plinth = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(1.4, 1.7, 0.9, 10)),
    keep(new THREE.MeshStandardMaterial({ color: 0x6d675c, roughness: 0.9 })),
  );
  plinth.position.set(OPUS_BASE.x, baseY + 0.45, OPUS_BASE.z);
  root.add(ringMesh, column, plinth);

  // Owner 26.11.2026: "особых механик как в magic carpet, где надо свою базу (замок) отстраивать".
  // The castle beside the base grows with each upgrade bought there: a foundation from the start,
  // then the walls, the corner towers, and the keep with its flag.
  const CASTLE = { x: OPUS_BASE.x - 10, z: OPUS_BASE.z + 3, half: 3.6 };
  const castleY = ground(CASTLE.x, CASTLE.z);
  const stone = keep(new THREE.MeshStandardMaterial({ color: 0xe2d5bb, roughness: 0.9 }));
  const darkStone = keep(new THREE.MeshStandardMaterial({ color: 0xa89a80, roughness: 0.95 }));
  const flagMat = keep(new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.6, side: THREE.DoubleSide }));
  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const castle = new THREE.Group();
  castle.name = "opus-castle";
  castle.position.set(CASTLE.x, castleY, CASTLE.z);
  root.add(castle);
  const piece = (mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const m = new THREE.Mesh(box, mat);
    m.position.set(x, y + sy / 2, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const H = CASTLE.half;
  // Tier 0: the foundation and the corner stones — the plot is claimed from the first landing.
  const tier0 = new THREE.Group();
  tier0.add(piece(darkStone, 0, -0.2, 0, H * 2 + 0.6, 0.5, H * 2 + 0.6));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => tier0.add(piece(stone, sx * H, 0.3, sz * H, 0.9, 0.7, 0.9)));
  // Tier 1: the walls, with a gate towards the pad.
  const tier1 = new THREE.Group();
  tier1.add(piece(stone, 0, 0.3, -H, H * 2, 2.2, 0.45));
  tier1.add(piece(stone, -H, 0.3, 0, 0.45, 2.2, H * 2));
  tier1.add(piece(stone, 0, 0.3, H, H * 2, 2.2, 0.45));
  tier1.add(piece(stone, H, 0.3, -H * 0.55, 0.45, 2.2, H * 0.9));
  tier1.add(piece(stone, H, 0.3, H * 0.55, 0.45, 2.2, H * 0.9));
  // Tier 2: four corner towers with crenellations.
  const tier2 = new THREE.Group();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    tier2.add(piece(stone, sx * H, 0.3, sz * H, 1.4, 3.6, 1.4));
    [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].forEach(([cx, cz]) =>
      tier2.add(piece(darkStone, sx * H + cx, 3.9, sz * H + cz, 0.35, 0.45, 0.35)));
  });
  // Tier 3: the keep and its flag.
  const tier3 = new THREE.Group();
  tier3.add(piece(stone, 0, 0.3, 0, 2.6, 5.2, 2.6));
  tier3.add(piece(darkStone, 0, 5.5, 0, 3.0, 0.4, 3.0));
  tier3.add(piece(darkStone, 0, 5.9, 0, 0.12, 2.4, 0.12));
  const flag = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.4, 0.8)), flagMat);
  flag.position.set(0.72, 7.8, 0);
  tier3.add(flag);
  const castleTiers = [tier0, tier1, tier2, tier3];
  castle.add(...castleTiers);

  // Karst pillars: a crisp limestone shaft over the coarse ground mesh, so a pillar reads as rock.
  const pillarGeo = keep(new THREE.CylinderGeometry(0.82, 1.06, 1, 9));
  const limestone = keep(new THREE.MeshStandardMaterial({ color: 0xd9cbb0, roughness: 0.92 }));
  for (const p of OPUS_PILLARS) {
    const mesh = new THREE.Mesh(pillarGeo, limestone);
    const h = p.top + 1.7;
    mesh.scale.set(p.r, h, p.r);
    mesh.position.set(p.x, -1.7 + h / 2, p.z);
    mesh.rotation.y = p.x * 0.37;
    root.add(mesh);
  }

  // Sparks: small amber crystals; the guarded ones burn a colder white.
  const sparkGeo = keep(new THREE.OctahedronGeometry(0.42, 0));
  const freeMat = keep(new THREE.MeshBasicMaterial({ color: 0xffb347 }));
  const guardedMat = keep(new THREE.MeshBasicMaterial({ color: 0xf4fbff }));
  const sparks = carpet.sparks.map((spark) => {
    const mesh = new THREE.Mesh(sparkGeo, spark.guarded === null ? freeMat : guardedMat);
    mesh.position.set(spark.x, ground(spark.x, spark.z) + 1, spark.z);
    root.add(mesh);
    return mesh;
  });

  // Wardens: a squat slate dome on three legs with one eye that tracks the ship.
  const domeGeo = keep(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const legGeo = keep(new THREE.CylinderGeometry(0.09, 0.12, 1.3, 5));
  const eyeGeo = keep(new THREE.SphereGeometry(0.24, 8, 6));
  const slate = keep(new THREE.MeshStandardMaterial({ color: 0x3c4a56, roughness: 0.6, metalness: 0.3 }));
  const eyeOn = keep(new THREE.MeshBasicMaterial({ color: 0xff5a3a }));
  const eyeOff = keep(new THREE.MeshBasicMaterial({ color: 0x3a3a3a }));
  const wardens = carpet.wardens.map((w) => {
    const pivot = new THREE.Group();
    pivot.position.set(w.x, ground(w.x, w.z), w.z);
    const head = new THREE.Group();
    head.position.y = 1.1;
    head.add(new THREE.Mesh(domeGeo, slate));
    const eye = new THREE.Mesh(eyeGeo, eyeOn);
    eye.position.set(0, 0.35, 0.72);
    head.add(eye);
    pivot.add(head);
    for (let k = 0; k < 3; k += 1) {
      const leg = new THREE.Mesh(legGeo, slate);
      const a = (k / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.6, 0.55, Math.sin(a) * 0.6);
      leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      pivot.add(leg);
    }
    root.add(pivot);
    return { pivot, head, eye };
  });

  // Bolts: pooled glowing balls, warm for the wardens, cyan for the ship.
  const boltGeo = keep(new THREE.SphereGeometry(0.3, 8, 6));
  const pool = (color: number, count: number) => {
    const mat = keep(new THREE.MeshBasicMaterial({ color }));
    return Array.from({ length: count }, () => {
      const mesh = new THREE.Mesh(boltGeo, mat);
      mesh.visible = false;
      root.add(mesh);
      return mesh;
    });
  };
  const enemyPool = pool(0xff6a3a, 16);

  // Our module on a captured node: a limestone foot with an amber mast whose crystals fill with the bank.
  const mastGeo = keep(new THREE.CylinderGeometry(0.16, 0.22, 3.2, 6));
  const footGeo = keep(new THREE.CylinderGeometry(1.1, 1.4, 0.5, 8));
  const amber = keep(new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0x7a4a10, roughness: 0.5 }));
  const modules = carpet.nodes.map((node) => {
    const pivot = new THREE.Group();
    pivot.position.set(node.x, ground(node.x, node.z), node.z);
    const foot = new THREE.Mesh(footGeo, limestone);
    foot.position.y = 0.25;
    const mast = new THREE.Mesh(mastGeo, amber);
    mast.position.y = 2.1;
    pivot.add(foot, mast);
    const gems = Array.from({ length: NODE.bankMax }, (_, k) => {
      const gem = new THREE.Mesh(sparkGeo, freeMat);
      const a = (k / NODE.bankMax) * Math.PI * 2;
      gem.position.set(Math.cos(a) * 1.1, 1.2, Math.sin(a) * 1.1);
      gem.scale.setScalar(0.6);
      pivot.add(gem);
      return gem;
    });
    pivot.visible = false;
    root.add(pivot);
    return { pivot, gems };
  });

  // The raider: a dark wedge with a red belly light.
  const raider = new THREE.Group();
  const hull = new THREE.Mesh(keep(new THREE.ConeGeometry(0.9, 3.2, 4)), slate);
  hull.rotation.x = Math.PI / 2;
  const belly = new THREE.Mesh(eyeGeo, eyeOn);
  belly.position.y = -0.5;
  belly.scale.setScalar(1.4);
  raider.add(hull, belly);
  raider.visible = false;
  root.add(raider);
  const shotPool = pool(0x7ff6ff, 12);

  function update(elapsed: number) {
    // The castle shows one more tier for each upgrade bought at the base.
    const built = carpet.owned.length;
    castleTiers.forEach((tier, i) => { tier.visible = i <= built; });
    flag.rotation.y = Math.sin(elapsed * 1.3) * 0.25;
    carpet.nodes.forEach((node, i) => {
      const m = modules[i];
      m.pivot.visible = node.owner === "ship";
      if (!m.pivot.visible) return;
      m.pivot.rotation.y = elapsed * 0.4;
      m.gems.forEach((gem, k) => { gem.visible = k < node.bank; });
    });
    const r = carpet.raider;
    raider.visible = !!r;
    if (r) {
      const node = carpet.nodes[r.node];
      raider.position.set(r.x, r.y + Math.sin(elapsed * 4) * 0.2, r.z);
      raider.rotation.y = Math.atan2(node.x - r.x, node.z - r.z);
    }
    carpet.sparks.forEach((spark, i) => {
      const mesh = sparks[i];
      mesh.visible = !spark.taken;
      if (!mesh.visible) return;
      mesh.rotation.y = elapsed * 1.6 + i;
      mesh.position.y = ground(spark.x, spark.z) + 1 + Math.sin(elapsed * 2.4 + i) * 0.18;
    });
    carpet.wardens.forEach((w, i) => {
      const look = wardens[i];
      const down = w.down > 0;
      look.head.rotation.y = down ? look.head.rotation.y : w.aim;
      look.head.rotation.z = down ? 0.6 : 0;
      look.head.position.y = down ? 0.55 : 1.1 + Math.sin(elapsed * 3 + i) * 0.04;
      look.eye.material = down ? eyeOff : eyeOn;
      look.pivot.visible = !w.gone;
    });
    enemyPool.forEach((mesh, i) => {
      const b = carpet.enemyBolts[i];
      mesh.visible = !!b;
      if (b) mesh.position.set(b.x, b.y, b.z);
    });
    shotPool.forEach((mesh, i) => {
      const b = carpet.shots[i];
      mesh.visible = !!b;
      if (b) mesh.position.set(b.x, b.y, b.z);
    });
    const fill = Math.min(1, carpet.store / 30);
    column.scale.y = 1.5 + fill * 9;
    column.position.y = baseY + column.scale.y / 2;
    columnMat.opacity = (carpet.atBase ? 0.75 : 0.45) + Math.sin(elapsed * 2) * 0.08;
  }

  /** Minimap marks: the store, the sparks and the wardens. */
  function paint(ctx: CanvasRenderingContext2D, toX: (x: number) => number, toY: (z: number) => number) {
    ctx.fillStyle = "#ffc35a";
    ctx.beginPath();
    ctx.arc(toX(OPUS_BASE.x), toY(OPUS_BASE.z), 5, 0, Math.PI * 2);
    ctx.fill();
    for (const spark of carpet.sparks) {
      if (spark.taken) continue;
      ctx.fillStyle = spark.guarded === null ? "#ffb347" : "#f4fbff";
      ctx.fillRect(toX(spark.x) - 1.5, toY(spark.z) - 1.5, 3, 3);
    }
    for (const node of carpet.nodes) {
      if (node.owner !== "ship") continue;
      ctx.strokeStyle = "#ffb347";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(node.x), toY(node.z), 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (carpet.raider) {
      ctx.fillStyle = "#ff2a2a";
      ctx.fillRect(toX(carpet.raider.x) - 3, toY(carpet.raider.z) - 3, 6, 6);
    }
    for (const w of carpet.wardens) {
      if (w.gone) continue;
      ctx.fillStyle = w.down > 0 ? "#555" : "#ff5a3a";
      ctx.beginPath();
      ctx.arc(toX(w.x), toY(w.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { update, paint, range: LOOP.wardenRange };
}

export type OpusLook = ReturnType<typeof createOpusLook>;
