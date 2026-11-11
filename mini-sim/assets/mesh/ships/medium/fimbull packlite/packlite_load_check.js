// Прогон packlite.glb + packlite_controls.js через НАСТОЯЩИЙ GLTFLoader r128
// (three и загрузчик берутся из packlite_demo.html — те же, что видит
// браузер). Проверяются: узлы, габарит 67.1 × 26.5 × 21.6 м, посадка
// остекления рубки на надстройку, режимы, тяга, створки грузового люка,
// пути отрисовки и число draw calls.
const fs = require('fs');
const demo = fs.readFileSync(__dirname + '/packlite_demo.html', 'utf8');
const blocks = [...demo.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const three = blocks[0], loader = blocks[1];

global.self = global;
global.window = global;
global.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {} }) };
global.location = { href: 'http://localhost/' };

new Function(three)();
console.log('THREE rev', THREE.REVISION);
new Function('THREE', loader)(THREE);
new Function(fs.readFileSync(__dirname + '/packlite_controls.js', 'utf8'))();
console.log('createPackliteControls', typeof createPackliteControls);

const buf = fs.readFileSync(__dirname + '/packlite.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new THREE.GLTFLoader().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  const need = ['center_hull', 'bridge', 'canopy', 'intake_r', 'intake_l',
    'cargo_deck', 'cargo_hold', 'radar_tower', 'deck_crane', 'engine_frame', 'nozzle_cluster',
    'pod_r0', 'pod_r1', 'pod_l0', 'pod_l1', 'cm_pod_r', 'cm_pod_l',
    'thrusters', 'greebles', 'decals', 'lights', 'beacon',
    'turret_r', 'turret_l', 'cargo_lid_r', 'cargo_lid_l',
    'leg_0', 'leg_1', 'leg_2', 'leg_3'];
  const missing = need.filter((n) => !root.getObjectByName(n));
  if (missing.length) throw Error('nodes missing: ' + missing.join(','));
  console.log('nodes:', need.length);

  // ---------- 1) габариты по карточке NFT: 67.1 × 26.5 × 21.6 м ----------
  function exactBounds(object) {
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
    const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    object.updateMatrixWorld(true);
    object.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.getAttribute('position');
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        lo.min(v); hi.max(v);
      }
    });
    return new THREE.Box3(lo, hi);
  }
  root.updateMatrixWorld(true);
  const bb = exactBounds(root);
  const s = bb.getSize(new THREE.Vector3());
  console.log('bounds m: ' + s.x.toFixed(1), s.y.toFixed(1), s.z.toFixed(1));
  if (s.x > 67.1 + 1.0 || s.x < 60.0) throw Error('length out of spec: ' + s.x.toFixed(2));
  if (s.z > 26.5 + 0.6 || s.z < 20.0) throw Error('width out of spec: ' + s.z.toFixed(2));
  if (s.y > 21.6 + 0.8 || s.y < 17.0) throw Error('height out of spec: ' + s.y.toFixed(2));
  if (Math.abs(bb.min.y) > 0.2) throw Error('legs must touch Y=0, got ' + bb.min.y.toFixed(2));
  console.log('envelope OK | Y ' + bb.min.y.toFixed(2) + ' .. ' + bb.max.y.toFixed(2));

  // ---------- 2) остекление рубки ПРИКЛЕЕНО к надстройке ----------
  // У баржи стекло — лента по стене рубки, а не купол на крыше, поэтому
  // «луч вниз» тут не годится: из каждой вершины стекла пускаем луч ВНУТРЬ
  // рубки (к её оси) и требуем металл не дальше 0.45 м. Так ловятся
  // «стёкла, отвалившиеся от корпуса».
  const bridgeObj = root.getObjectByName('bridge');
  const supports = [bridgeObj].filter(Boolean);
  supports.forEach((o) => o.traverse((m) => {
    if (m.isMesh && m.material) m.material.side = THREE.DoubleSide;
  }));
  const ray = new THREE.Raycaster();
  (function () {
    const bbB = exactBounds(bridgeObj);
    const cx = (bbB.min.x + bbB.max.x) / 2, cz = (bbB.min.z + bbB.max.z) / 2;
    const meshObj = root.getObjectByName('canopy');
    meshObj.updateMatrixWorld(true);
    const pos = meshObj.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    const dir = new THREE.Vector3();
    let worst = 0, unsupported = 0, n = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(meshObj.matrixWorld);
      dir.set(cx - v.x, 0, cz - v.z);
      if (dir.length() < 1e-4) continue;
      dir.normalize();
      ray.set(v, dir);
      const hIn = ray.intersectObjects(supports, false);
      const dIn = hIn.length ? hIn[0].distance : 99;
      ray.set(v, dir.clone().negate());
      const hOut = ray.intersectObjects(supports, false);
      const dOut = hOut.length ? hOut[0].distance : 99;
      // стекло либо выступает над стенкой (близко «внутрь»), либо утоплено
      // в неё (близко «наружу») — обе ситуации нормальны, важна близость
      const gap = Math.min(dIn, dOut);
      n++;
      if (gap > worst) worst = gap;
      if (gap > 0.45) unsupported++;
    }
    const bbG = exactBounds(meshObj);
    if (bbG.min.x < bbB.min.x - 0.12 || bbG.max.x > bbB.max.x + 0.12)
      throw Error('canopy sticks out of the bridge along X');
    console.log('стекло canopy: вершин', n, '| макс. отход от стенки рубки',
      worst.toFixed(3), 'м | отвалившихся', unsupported);
    if (unsupported > 0)
      throw Error('canopy detached from the bridge: ' + unsupported + '/' + n);
  })();
  supports.forEach((o) => o.traverse((m) => {
    if (m.isMesh && m.material) m.material.side = THREE.FrontSide;
  }));

  const camera = new THREE.PerspectiveCamera(40, 1.7, 0.3, 4000);
  camera.position.set(-110, 46, 84);
  camera.lookAt(0, 8.0, 0);
  camera.updateMatrixWorld(true);

  const rig = createPackliteControls(root);
  const thrusters = root.getObjectByName('thrusters');
  const turrets = [root.getObjectByName('turret_r'), root.getObjectByName('turret_l')];
  const lids = [root.getObjectByName('cargo_lid_r'), root.getObjectByName('cargo_lid_l')];
  const legs = [0, 1, 2, 3].map((i) => root.getObjectByName('leg_' + i));
  const legY0 = legs.map((l) => l.position.y);
  const nozzle = root.getObjectByName('nozzle_cluster');
  const nozBox = exactBounds(nozzle);

  // ---------- 3) палуба ----------
  if (rig.getMode() !== 'pad') throw Error('default mode should be pad');
  if (!legs.every((l) => l.visible)) throw Error('pad: legs must be down');
  if (!turrets.every((t) => Math.abs(t.rotation.z) < 1e-6)) throw Error('pad: turrets stowed');
  if (!lids.every((d) => Math.abs(d.rotation.x) < 1e-6)) throw Error('pad: cargo lids shut');
  if (thrusters.visible) throw Error('pad: thrusters must be off');
  console.log('pad: legs down, turrets stowed, cargo lids shut, thrust off');

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
  const sF = exactBounds(root).getSize(new THREE.Vector3());
  if (sF.x > 68.2 || sF.z > 27.2 || sF.z < 20.0) throw Error('flight out of spec: ' + sF.toArray());
  console.log('flight envelope m:', sF.x.toFixed(1), sF.y.toFixed(1), sF.z.toFixed(1));

  // ---------- 4б) свечение сопел СТОИТ В СВОИХ УСТЬЯХ ----------
  // Регресс PF4: контроллер масштабировал узел свечения ВОКРУГ НАЧАЛА
  // координат — решётки съезжали с сопел. Здесь это ловится по числам:
  // каждая вершина свечения должна попасть внутрь одного из пяти срезов.
  (function () {
    thrusters.updateMatrixWorld(true);
    const cz = (nozBox.min.z + nozBox.max.z) / 2;
    const cy = (nozBox.min.y + nozBox.max.y) / 2;
    const v = new THREE.Vector3();
    const pos = thrusters.geometry.getAttribute('position');
    let outside = 0, n = 0, worst = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(thrusters.matrixWorld);
      n++;
      if (v.x > nozBox.max.x + 1e-3) { outside++; continue; }
      // радиус в плоскости среза: до ближайшего из пяти центров
      const centres = [[0, 0], [2.95, 2.95], [2.95, -2.95], [-2.95, 2.95], [-2.95, -2.95]];
      let best = Infinity;
      for (const [dy, dz] of centres) {
        const d = Math.hypot(v.y - (cy + dy), v.z - (cz + dz));
        best = Math.min(best, d);
      }
      worst = Math.max(worst, best);
      if (best > 2.2) outside++;
    }
    if (!n) throw Error('no nozzle glow verts');
    if (outside) throw Error('nozzle glow outside the bores: ' + outside + '/' + n);
    console.log('nozzle glow: ' + n + ' вершин, все внутри срезов (макс. радиус ' +
      worst.toFixed(2) + ' м)');
  })();

  // ---------- 5) охота: турели + стробы ----------
  rig.setMode('hunt');
  for (let i = 0; i < 220; i++) rig.update(8.0 + i * 0.033, camera);
  if (!(turrets[0].rotation.z < -0.15)) throw Error('hunt must elevate the turrets');
  if (!(root.getObjectByName('beacon').material.opacity > 0.1)) throw Error('hunt strobes on');
  root.updateMatrixWorld(true);
  const sH = exactBounds(root).getSize(new THREE.Vector3());
  if (sH.y > 21.9) throw Error('hunt pose too tall: ' + sH.y.toFixed(2));
  console.log('hunt: turrets', (-turrets[0].rotation.z * 57.3).toFixed(0), 'deg | height',
    sH.y.toFixed(1), 'm');

  // ---------- 6) погрузка: створки трюма раскрыты, лыжи выпущены ----------
  rig.setMode('load');
  for (let i = 0; i < 220; i++) rig.update(16.0 + i * 0.033, camera);
  if (!(Math.abs(lids[0].rotation.x) > 0.7)) throw Error('load must open the cargo lids');
  if (!lids.every((d) => Math.abs(Math.abs(d.rotation.x) - Math.abs(lids[0].rotation.x)) < 1e-6))
    throw Error('load: both lids must move symmetrically');
  if (!legs.every((l) => l.visible)) throw Error('load: legs must be down');
  // открытые створки не выходят за габарит по ширине и не задираются выше рубки
  root.updateMatrixWorld(true);
  const bbL = exactBounds(root);
  const sL = bbL.getSize(new THREE.Vector3());
  if (sL.z > 27.3) throw Error('open lids widen the ship: ' + sL.z.toFixed(2));
  if (sL.y > 21.9) throw Error('open lids too tall: ' + sL.y.toFixed(2));
  console.log('load: cargo lids', (Math.abs(lids[0].rotation.x) * 57.3).toFixed(0),
    'deg | width', sL.z.toFixed(1), 'm | height', sL.y.toFixed(1), 'm | legs down');

  // ---------- 7) ручные ручки ----------
  rig.setLid(0);
  for (let i = 0; i < 220; i++) rig.update(24.0 + i * 0.033, camera);
  if (Math.abs(lids[0].rotation.x) > 0.1) throw Error('setLid(0) must close the cargo lids');
  rig.setGuns(1);
  for (let i = 0; i < 220; i++) rig.update(28.0 + i * 0.033, camera);
  if (!(turrets[0].rotation.z < -0.15)) throw Error('setGuns(1) must elevate turrets');
  rig.setSpots(0);
  for (let i = 0; i < 80; i++) rig.update(32.0 + i * 0.033, camera);
  if (root.getObjectByName('lights').visible) throw Error('spots off must hide the lights');
  rig.setEngines(false);
  for (let i = 0; i < 80; i++) rig.update(36.0 + i * 0.033, camera);
  if (thrusters.visible) throw Error('engines off must hide the nozzle glow');
  rig.setLegs(1);
  for (let i = 0; i < 120; i++) rig.update(40.0 + i * 0.033, camera);
  if (!legs.every((l) => l.visible)) throw Error('setLegs(1) must put the legs down');
  console.log('manual cargo lids / turrets / spots / engines / legs: OK');

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
  if (meshes > 44) throw Error('too many draw calls: ' + meshes);
  if (tris > 32000) throw Error('too many triangles: ' + tris);

  console.log('state:', JSON.stringify(rig.getState()));
  rig.dispose();
  console.log('ALL OK');
}, (e) => { throw Error('GLB parse failed: ' + e); });
