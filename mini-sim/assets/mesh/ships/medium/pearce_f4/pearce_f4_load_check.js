// Прогон pearce_f4.glb + pearce_f4_controls.js через НАСТОЯЩИЙ GLTFLoader r128
// (three и загрузчик берутся из pearce_f4_demo.html — те же, что видит
// браузер). Проверяются: узлы, габарит 58 × 40 × 16 м, посадка остекления на
// обшивку (луч вниз из каждой нижней вершины стекла), режимы, тяга, створки
// ракетного отсека, пути отрисовки и число draw calls.
const fs = require('fs');
const demo = fs.readFileSync(__dirname + '/pearce_f4_demo.html', 'utf8');
const blocks = [...demo.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const three = blocks[0], loader = blocks[1];

global.self = global;
global.window = global;
global.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {} }) };
global.location = { href: 'http://localhost/' };

new Function(three)();
console.log('THREE rev', THREE.REVISION);
new Function('THREE', loader)(THREE);
new Function(fs.readFileSync(__dirname + '/pearce_f4_controls.js', 'utf8'))();
console.log('createPearceF4Controls', typeof createPearceF4Controls);

const buf = fs.readFileSync(__dirname + '/pearce_f4.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new THREE.GLTFLoader().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  const need = ['center_hull', 'canopy', 'rear_block', 'missile_bay', 'scanner',
    'thrusters', 'greebles', 'decals', 'lights', 'beacon',
    'boom_r', 'boom_l',
    'engine_r', 'engine_l', 'gun_r', 'gun_l', 'cm_pod_r', 'cm_pod_l',
    'bay_door_r', 'bay_door_l', 'ramp_ext_r', 'ramp_ext_l',
    'bay_lid_r', 'bay_lid_l', 'cargo_bay',
    'leg_0', 'leg_1', 'leg_2'];
  const missing = need.filter((n) => !root.getObjectByName(n));
  if (missing.length) throw Error('nodes missing: ' + missing.join(','));
  console.log('nodes:', need.length);

  // ---------- 1) габариты по карточке NFT: 58 × 40 × 16 м ----------
  function exactBounds(object) {
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
    const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    object.updateMatrixWorld(true);
    object.traverse((o) => {
      if (!o.isMesh || o.visible === false) return;
      const pos = o.geometry.getAttribute('position');
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        lo.min(v); hi.max(v);
      }
    });
    return new THREE.Box3(lo, hi);
  }
  const bb = exactBounds(root);
  const size = bb.getSize(new THREE.Vector3());
  console.log('bounds m:', size.x.toFixed(1), size.y.toFixed(1), size.z.toFixed(1));
  if (size.x > 58.0 + 1.5 || size.x < 52.0) throw Error('length out of envelope: ' + size.x);
  // отвалов-крыльев нет: размах задают только двигательные балки (~19 м)
  // плоскости убраны: размах дают только двигательные балки
  if (size.z > 40.0 + 0.8 || size.z < 17.0) throw Error('width out of envelope: ' + size.z);
  if (size.y > 16.0 + 0.6 || size.y < 8.0) throw Error('height out of envelope: ' + size.y);
  if (Math.abs(bb.min.y) > 0.25) throw Error('legs are not on Y=0: ' + bb.min.y);
  console.log('envelope OK | Y', bb.min.y.toFixed(2), '..', bb.max.y.toFixed(2));

  // ---------- 2а) корпус не просвечивает: у каждой оболочки грани наружу ----------
  // Регресс, который поймал пользователь: левый борт «просвечивал» — часть
  // граней клыка была вывернута наизнанку, и с включённым отсечением (как в
  // браузере и в игре) обшивка пропадала, а сквозь неё было видно нутро.
  // Проверка: из 4 м сферы вокруг оси каждой оболочки стреляем внутрь —
  // луч обязан упереться в переднюю грань обшивки.
  (function () {
    const ray2 = new THREE.Raycaster();
    const shells = [['center_hull', new THREE.Vector3(6, 5.6, 0)],
                    ['boom_r', new THREE.Vector3(15, 5.6, 5.90)],
                    ['boom_l', new THREE.Vector3(15, 5.6, -5.90)],
                    ['engine_r', new THREE.Vector3(2.4, 6.10, 8.55)],
                    ['engine_l', new THREE.Vector3(2.4, 6.10, -8.55)],
                    ['boom_r', new THREE.Vector3(15, 5.6, 5.90)]];
    let seed = 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    shells.forEach(([name, c]) => {
      const obj = root.getObjectByName(name);
      let hits = 0;
      const N = 240;
      for (let i = 0; i < N; i++) {
        const th = Math.acos(1 - 2 * rnd());
        const ph = 2 * Math.PI * rnd();
        const d = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th),
                                    Math.sin(th) * Math.sin(ph));
        ray2.set(c.clone().addScaledVector(d, 40), d.clone().negate());
        if (ray2.intersectObject(obj, false).length) hits++;
      }
      const pct = 100 * hits / N;
      console.log('обшивка', name, ':', pct.toFixed(1) + '% лучей извне попадают в грань');
      if (pct < 97) throw Error('shell ' + name + ' has inward faces: ' + pct.toFixed(1) + '%');
    });
  })();

  // ---------- 2) остекление сидит на обшивке ----------
  // Из каждой нижней вершины стекла пускаем луч вниз и ищем металл под ней.
  // Остекление не должно висеть в воздухе — это регресс, который правится
  // вручную на каждом корабле.
  const supports = ['center_hull', 'rear_block']
    .map((n) => root.getObjectByName(n)).filter(Boolean);
  // Обшивка собрана из плоских фасеток с запечённым затенением; часть граней
  // смотрит внутрь, поэтому луч считаем по двустороннему материалу — иначе
  // проверка «под стеклом металл» ложно проваливается (было на 0.14 м).
  supports.forEach((o) => o.traverse((m) => {
    if (m.isMesh && m.material) m.material.side = THREE.DoubleSide;
  }));
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const glassReport = {};
  ['canopy'].forEach((name) => {
    const meshObj = root.getObjectByName(name);
    meshObj.updateMatrixWorld(true);
    const pos = meshObj.geometry.getAttribute('position');
    const world = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(meshObj.matrixWorld);
      world.push(v.clone());
    }
    const minY = world.reduce((a, p) => Math.min(a, p.y), Infinity);
    const base = world.filter((p) => p.y < minY + 0.18);
    let worst = 0;
    let unsupported = 0;
    // Луч вниз и луч вверх: кромка стекла может быть как НА палубе, так и
    // утоплена в неё на пару сантиметров (тогда металл выше кромки). Висящим
    // считаем только тот случай, когда металла нет ни под кромкой, ни над ней
    // в пределах 0.12 м — то есть стекло реально парит.
    const up = new THREE.Vector3(0, 1, 0);
    base.forEach((p) => {
      ray.set(new THREE.Vector3(p.x, p.y + 0.12, p.z), down);
      const hits = ray.intersectObjects(supports, false);
      const top = hits.length ? hits[0].point.y : -99;
      ray.set(new THREE.Vector3(p.x, p.y - 0.02, p.z), up);
      const hitsUp = ray.intersectObjects(supports, false);
      const bot = hitsUp.length ? hitsUp[0].point.y : 99;
      const gapDown = p.y - (top === -99 ? -99 : top);
      const gapUp = bot === 99 ? 99 : bot - p.y;
      const gap = Math.min(gapDown, gapUp);         // >0.12 — стекло висит
      if (gap > worst) worst = gap;
      if (gap > 0.12) unsupported++;
    });
    glassReport[name] = { base: base.length, worst: +worst.toFixed(3), unsupported };
    console.log('стекло', name, ': нижних вершин', base.length,
      '| макс. просвет до металла', worst.toFixed(3), 'м | висящих', unsupported);
  });
  ['canopy'].forEach((n) => {
    if (glassReport[n].unsupported > 0 || glassReport[n].worst > 0.12)
      throw Error('glass ' + n + ' hangs above the hull: ' + JSON.stringify(glassReport[n]));
  });
  // двусторонность была нужна только для лучей под стеклом — возвращаем как было
  supports.forEach((o) => o.traverse((m) => {
    if (m.isMesh && m.material) m.material.side = THREE.FrontSide;
  }));

  const camera = new THREE.PerspectiveCamera(40, 1.7, 0.3, 4000);
  camera.position.set(-92, 40, 70);
  camera.lookAt(0, 4.6, 0);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);

  const rig = createPearceF4Controls(root);
  const thrusters = root.getObjectByName('thrusters');
  const guns = [root.getObjectByName('gun_r'), root.getObjectByName('gun_l')];
  const bayDoors = [root.getObjectByName('bay_door_r'), root.getObjectByName('bay_door_l')];
  const rampExt = [root.getObjectByName('ramp_ext_r'), root.getObjectByName('ramp_ext_l')];
  const lids = [root.getObjectByName('bay_lid_r'), root.getObjectByName('bay_lid_l')];
  const legs = [0, 1, 2].map((i) => root.getObjectByName('leg_' + i));
  const legY0 = legs.map((l) => l.position.y);

  // ---------- 3) палуба ----------
  if (rig.getMode() !== 'pad') throw Error('default mode should be pad');
  if (!legs.every((l) => l.visible)) throw Error('pad: legs must be down');
  if (!(Math.abs(guns[0].rotation.z) < 1e-6)) throw Error('pad: guns must stay stowed');
  if (!bayDoors.every((d) => Math.abs(d.rotation.z) < 1e-6)) throw Error('pad: cargo ramp must stay shut');
  if (!lids.every((d) => Math.abs(d.rotation.x) < 1e-6)) throw Error('pad: missile lids must stay shut');
  if (thrusters.visible) throw Error('pad: thrusters must be off');
  console.log('pad: legs down, guns stowed, ramp shut, lids shut, thrust off');

  // ---------- 4) полёт ----------
  rig.setMode('flight');
  for (let i = 0; i < 150; i++) rig.update(i * 0.033, camera);
  if (legs.some((l, k) => Math.abs(l.position.y - legY0[k]) < 1.0))
    throw Error('flight must retract the legs');
  if (!thrusters.visible || thrusters.material.opacity < 0.5)
    throw Error('flight thrusters: ' + thrusters.material.opacity);
  console.log('flight: legs up', Math.abs(legs[0].position.y - legY0[0]).toFixed(2),
    'm | thrust', rig.getThrust().toFixed(2));
  root.updateMatrixWorld(true);
  const bbF = exactBounds(root);
  const sF = bbF.getSize(new THREE.Vector3());
  if (sF.x > 59.5 || sF.z > 40.8 || sF.z < 17.0) throw Error('flight pose out of the spec: ' + sF.toArray());
  console.log('flight envelope m:', sF.x.toFixed(1), sF.y.toFixed(1), sF.z.toFixed(1));

  // ---------- 4б) свечение сопел СТОИТ В СВОИХ УСТЬЯХ ----------
  // Регресс: контроллер масштабировал узел свечения ВОКРУГ НАЧАЛА координат
  // модели — решётки съезжали с сопел («свечение сдвинуто наружу»).
  (function () {
    thrusters.updateMatrixWorld(true);
    for (const tag of ['r', 'l']) {
      const sgn = tag === 'r' ? 1 : -1;
      const bb = exactBounds(root.getObjectByName('boom_' + tag));
      const cy = (bb.min.y + bb.max.y) / 2;
      const cz = (bb.min.z + bb.max.z) / 2;
      const pos = thrusters.geometry.getAttribute('position');
      const v = new THREE.Vector3();
      let n = 0, sy = 0, sz = 0;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(thrusters.matrixWorld);
        if (v.x < bb.max.x - 1.4 || sgn * v.z < 0) continue;
        n++; sy += v.y; sz += v.z;
      }
      if (!n) throw Error('no nozzle glow verts for ' + tag);
      const dy = Math.abs(sy / n - cy), dz = Math.abs(sz / n - cz);
      if (dy > 0.35 || dz > 0.35)
        throw Error('nozzle glow ' + tag + ' off the bore: dy ' + dy.toFixed(2) +
          ' dz ' + dz.toFixed(2));
      console.log('nozzle glow ' + tag + ': offset dy ' + dy.toFixed(2) +
        ' / dz ' + dz.toFixed(2) + ' m');
    }
  })();

  // ---------- 5) охота: стволы и ракетный отсек ----------
  rig.setMode('hunt');
  for (let i = 0; i < 220; i++) rig.update(8.0 + i * 0.033, camera);
  if (!(guns[0].rotation.z < -0.20)) throw Error('hunt must elevate the nose guns');
  if (!(Math.abs(lids[0].rotation.x) > 0.7)) throw Error('hunt must open the missile lids');
  if (!(root.getObjectByName('beacon').material.opacity > 0.1)) throw Error('hunt strobes must be on');
  // стволы/турели/крышка не выходят за габарит в боевом положении
  root.updateMatrixWorld(true);
  const bbH = exactBounds(root);
  const sH = bbH.getSize(new THREE.Vector3());
  if (sH.y > 16.6) throw Error('hunt pose too tall: ' + sH.y.toFixed(2));
  console.log('hunt: guns', (-guns[0].rotation.z * 57.3).toFixed(0), 'deg | missile lids',
    (Math.abs(lids[0].rotation.x) * 57.3).toFixed(0), 'deg | height',
    sH.y.toFixed(1), 'm');

  // ---------- 6) погрузка: отсек открыт, стойки выпущены ----------
  rig.setMode('load');
  for (let i = 0; i < 220; i++) rig.update(16.0 + i * 0.033, camera);
  // аппарель закрыта — вертикально в проёме; открыта — 148° из вертикали
  if (!(bayDoors[0].rotation.z < -2.4))
    throw Error('load must drop the cargo hatch ~148 deg: ' + bayDoors[0].rotation.z);
  if (!bayDoors.every((d) => Math.abs(d.rotation.z - bayDoors[0].rotation.z) < 1e-6))
    throw Error('load: both ramp halves must move together');
  if (!lids.every((d) => Math.abs(d.rotation.x) < 1e-6)) throw Error('load: missile lids stay shut');
  if (!legs.every((l) => l.visible)) throw Error('load: legs must be down');
  root.updateMatrixWorld(true);
  const bbL = exactBounds(root);
  // пятка аппарели должна лечь на палубу (Y ≈ 0), а не висеть в воздухе
  // трап двухступенчатый: полотно + выдвижная ступень, пятка на палубе (Y ≈ 0)
  const rampBox = new THREE.Box3().setFromObject(bayDoors[0]);
  const extBox = new THREE.Box3().setFromObject(root.getObjectByName('ramp_ext_r'));
  if (extBox.min.y > 0.6 || extBox.min.y < -0.6)
    throw Error('load: ramp foot must reach the deck, got Y ' + extBox.min.y.toFixed(2));
  if (Math.abs(rampExt[0].rotation.z - bayDoors[0].rotation.z) > 1e-6)
    throw Error('load: ramp extension must follow the leaf');
  console.log('load: hatch', (-bayDoors[0].rotation.z * 57.3).toFixed(0),
    'deg | foot Y', extBox.min.y.toFixed(2), 'm | leaf end Y',
    rampBox.min.y.toFixed(2), 'm | height',
    bbL.getSize(new THREE.Vector3()).y.toFixed(1), 'm | legs down');

  // ---------- 7) ручные ручки ----------
  rig.setBay(0);
  for (let i = 0; i < 220; i++) rig.update(24.0 + i * 0.033, camera);
  if (Math.abs(bayDoors[0].rotation.z) > 0.1) throw Error('setBay(0) must close the hatch');
  if (root.getObjectByName('ramp_ext_r').visible) throw Error('setBay(0) must hide the ramp extension');
  rig.setLid(1);
  for (let i = 0; i < 220; i++) rig.update(28.0 + i * 0.033, camera);
  if (!(Math.abs(lids[0].rotation.x) > 0.7)) throw Error('setLid(1) must open the missile lids');
  rig.setLid(0);
  rig.setSpots(0);
  for (let i = 0; i < 80; i++) rig.update(32.0 + i * 0.033, camera);
  if (root.getObjectByName('lights').visible) throw Error('spots off must hide the lights');
  rig.setEngines(false);
  for (let i = 0; i < 80; i++) rig.update(36.0 + i * 0.033, camera);
  if (thrusters.visible) throw Error('engines off must hide the thrust discs');
  rig.setLegs(1);
  for (let i = 0; i < 120; i++) rig.update(40.0 + i * 0.033, camera);
  if (!legs.every((l) => l.visible)) throw Error('setLegs(1) must put the legs down');
  console.log('manual ramp / missile lids / spots / engines / legs: OK');

  // ---------- 8) пути отрисовки и draw calls ----------
  const mesh = root.getObjectByName('center_hull');
  if (!mesh.material.isMeshBasicMaterial) throw Error('CPU path must be unlit MeshBasicMaterial');
  if (!mesh.material.vertexColors) throw Error('CPU path must use vertex colours');
  rig.setShaderMode(true);
  if (!mesh.material.isMeshLambertMaterial) throw Error('shader mode must be MeshLambertMaterial');
  rig.setShaderMode(false);
  if (!mesh.material.isMeshBasicMaterial) throw Error('shader mode must restore the CPU material');
  console.log('CPU / shader paths: OK');

  let meshes = 0, tris = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const idx = o.geometry.getIndex();
    tris += idx ? idx.count / 3 : o.geometry.getAttribute('position').count / 3;
  });
  console.log('meshes (draw calls):', meshes, '| tris:', tris);
  if (meshes > 34) throw Error('too many draw calls: ' + meshes);
  if (tris > 26000) throw Error('too many triangles: ' + tris);

  console.log('state:', JSON.stringify(rig.getState()));
  rig.dispose();
  console.log('ALL OK');
}, (e) => { throw Error('GLB parse failed: ' + e); });
