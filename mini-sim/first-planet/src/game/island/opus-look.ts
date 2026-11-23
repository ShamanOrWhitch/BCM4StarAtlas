/**
 * What the Opus flight loop looks like (IDEA-026 step 1): the spark store by the pad, the sparks,
 * the wardens on the spark nodes and the bolts. Built from plain shapes with shared geometry and
 * materials (one draw per object, no new model files); our own look, not a copy of any game.
 * The loop itself is carpet.ts.
 */
import * as THREE from "three";
import { LOOP, type CarpetState } from "./carpet";
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
  const shotPool = pool(0x7ff6ff, 12);

  function update(elapsed: number) {
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
    for (const w of carpet.wardens) {
      ctx.fillStyle = w.down > 0 ? "#555" : "#ff5a3a";
      ctx.beginPath();
      ctx.arc(toX(w.x), toY(w.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { update, paint, range: LOOP.wardenRange };
}

export type OpusLook = ReturnType<typeof createOpusLook>;
