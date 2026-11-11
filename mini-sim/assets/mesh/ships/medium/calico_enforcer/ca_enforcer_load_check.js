// Прогон calico_enforcer.glb + ca_enforcer_controls.js через НАСТОЯЩИЙ
// GLTFLoader r128 (three и загрузчик берутся из calico_enforcer_demo.html —
// те же, что видит браузер). Проверяются: узлы, габарит 92 × 69 × 19 м,
// посадка фонаря на корпус, режимы pad/flight/patrol/siege, наведение
// capital-пушки, выдвижение ракетных батарей, свечение сот, пути отрисовки
// и число draw calls.
const fs = require('fs');
const demo = fs.readFileSync(__dirname + '/calico_enforcer_demo.html', 'utf8');
const blocks = [...demo.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const three = blocks[0], loader = blocks[1];

global.self = global;
global.window = global;
global.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {} }) };
global.location = { href: 'http://localhost/' };

new Function(three)();
console.log('THREE rev', THREE.REVISION);
new Function('THREE', loader)(THREE);
new Function(fs.readFileSync(__dirname + '/ca_enforcer_controls.js', 'utf8'))();
console.log('createEnforcerControls', typeof createEnforcerControls);

const buf = fs.readFileSync(__dirname + '/calico_enforcer.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new THREE.GLTFLoader().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  const need = ['fuselage', 'canopy', 'spine_hump', 'nozzle_block', 'capital_cannon',
    'thrusters', 'greebles', 'decals', 'lights', 'beacon',
    'wing_r', 'wing_l', 'tail_fin_r', 'tail_fin_l', 'belly_fin_r', 'belly_fin_l',
    'missile_pod_r', 'missile_pod_l', 'missile_glow_r', 'missile_glow_l',
    'leg_0', 'leg_1', 'leg_2'];
  const missing = need.filter((n) => !root.getObjectByName(n));
  if (missing.length) throw Error('nodes missing: ' + missing.join(','));
  console.log('nodes:', need.length);

  // ---------- 1) габариты по карточке NFT: 92 × 69 × 19 м ----------
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
  if (s.x > 92.6 || s.x < 88.0) throw Error('length out of spec: ' + s.x.toFixed(2));
  if (s.z > 69.4 || s.z < 66.0) throw Error('width out of spec: ' + s.z.toFixed(2));
  if (s.y > 19.6 || s.y < 17.0) throw Error('height out of spec: ' + s.y.toFixed(2));
  if (Math.abs(bb.min.y) > 0.2) throw Error('legs must touch Y=0, got ' + bb.min.y.toFixed(2));
  console.log('envelope OK | Y ' + bb.min.y.toFixed(2) + ' .. ' + bb.max.y.toFixed(2));

  // ---------- 2) фонарь ПРИКЛЕЕН к корпусу ----------
  // Из каждой вершины стекла пускаем шесть лучей (по осям) и берём ближайшее
  // попадание в корпус. Вершина нижней кромки лежит на обшивке (≈0), вершина
  // купола отстоит на высоту капли. Если стекло «отвалилось», дистанция
  // вырастает до метров — тест это ловит.
  const hull = root.getObjectByName('fuselage');
  const supports = [hull].filter(Boolean);
  supports.forEach((o) => o.traverse((m) => {
    if (m.isMesh && m.material) m.material.side = THREE.DoubleSide;
  }));
  const ray = new THREE.Raycaster();
  (function () {
    const bbB = exactBounds(hull);
    const meshObj = root.getObjectByName('canopy');
    meshObj.updateMatrixWorld(true);
    const pos = meshObj.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
      .map((d) => new THREE.Vector3(d[0], d[1], d[2]));
    let worst = 0, lowest = 99, unsupported = 0, n = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(meshObj.matrixWorld);
      let d = 99;
      for (let k = 0; k < DIRS.length; k++) {
        ray.set(v, DIRS[k]);
        const h = ray.intersectObjects(supports, false);
        if (h.length) d = Math.min(d, h[0].distance);
      }
      n++;
      if (d > worst) worst = d;
      if (d < lowest) lowest = d;
      if (d > 3.2) unsupported++;
    }
    const bbG = exactBounds(meshObj);
    if (bbG.min.x < bbB.min.x - 0.12 || bbG.max.x > bbB.max.x + 0.12)
      throw Error('canopy sticks out of the hull along X');
    console.log('стекло canopy: вершин', n, '| до обшивки макс', worst.toFixed(2),
      'м, минимум', lowest.toFixed(2), 'м | отвалившихся', unsupported);
    if (unsupported > 0)
      throw Error('canopy detached from the hull: ' + unsupported + '/' + n);
    if (lowest > 0.35)
      throw Error('canopy never touches the hull: ' + lowest.toFixed(2));
  })();
  supports.forEach((o) => o.traverse((m) => {
    if (m.isMesh && m.material) m.material.side = THREE.FrontSide;
  }));

  const camera = new THREE.PerspectiveCamera(40, 1.7, 0.3, 4000);
  camera.position.set(-130, 52, 96);
  camera.lookAt(0, 8.0, 0);
  camera.updateMatrixWorld(true);

  const rig = createEnforcerControls(root);
  const thrusters = root.getObjectByName('thrusters');
  const cannon = root.getObjectByName('capital_cannon');
  const wingsN = [root.getObjectByName('wing_r'), root.getObjectByName('wing_l')];
  const bays = [root.getObjectByName('missile_pod_r'), root.getObjectByName('missile_pod_l')];
  const glows = [root.getObjectByName('missile_glow_r'), root.getObjectByName('missile_glow_l')];
  const legs = [0, 1, 2].map((i) => root.getObjectByName('leg_' + i));
  const legY0 = legs.map((l) => l.position.y);
  const nozzle = root.getObjectByName('nozzle_block');
  const nozBox = exactBounds(nozzle);

  // ---------- 3) палуба ----------
  if (rig.getMode() !== 'pad') throw Error('default mode should be pad');
  if (!legs.every((l) => l.visible)) throw Error('pad: legs must be down');
  if (Math.abs(cannon.rotation.z) > 1e-6) throw Error('pad: cannon stowed level');
  if (thrusters.visible) throw Error('pad: thrusters must be off');
  if (Math.abs(bays[0].position.z) > 1e-6) throw Error('pad: bays retracted');
  console.log('pad: legs down, cannon level, bays shut, thrust off');

  // ---------- 4) полёт ----------
  rig.setMode('flight');
  for (let i = 0; i < 150; i++) rig.update(i * 0.033, camera);
  if (legs.some((l, k) => Math.abs(l.position.y - legY0[k]) < 1.0))
    throw Error('flight must retract the legs');
  if (!thrusters.visible || thrusters.material.opacity < 0.5)
    throw Error('flight thrusters: ' + thrusters.material.opacity);
  const raised = Math.max(...legs.map((l, k) => l.position.y - legY0[k]));
  console.log('flight: legs up', raised.toFixed(2), 'm | thrust',
    rig.getThrust().toFixed(2));
  root.updateMatrixWorld(true);
  const sF = exactBounds(root).getSize(new THREE.Vector3());
  if (sF.x > 92.6 || sF.z > 69.4 || sF.y > 19.6) throw Error('flight out of spec: ' + sF.toArray());
  console.log('flight envelope m:', sF.x.toFixed(1), sF.y.toFixed(1), sF.z.toFixed(1));

  // ---------- 4б) свечение сопел СТОИТ В СВОИХ УСТЬЯХ ----------
  // Регресс PF4/PL: контроллер масштабировал узел свечения ВОКРУГ НАЧАЛА
  // координат — решётки съезжали с сопел. Ловим по числам.
  (function () {
    const mj = JSON.parse(fs.readFileSync(__dirname + '/modes.json', 'utf8'));
    const JETS = mj.jets;                      // [cy, cz, r, xcut]
    thrusters.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const pos = thrusters.geometry.getAttribute('position');
    let outside = 0, n = 0, worst = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(thrusters.matrixWorld);
      n++;
      let best = 99, cut = false;
      for (const [cy, cz, r, xcut] of JETS) {
        const d = Math.hypot(v.y - cy, v.z - cz);
        if (d <= best) { best = d; cut = v.x <= xcut + 1e-3; }
      }
      if (!cut) { outside++; continue; }
      worst = Math.max(worst, best);
      if (best > 2.3) outside++;
    }
    if (!n) throw Error('no nozzle glow verts');
    if (outside) throw Error('nozzle glow outside the bores: ' + outside + '/' + n);
    console.log('nozzle glow: ' + n + ' вершин, все внутри срезов (макс. радиус ' +
      worst.toFixed(2) + ' м)');
  })();

  // ---------- 5) патруль: крылья раскрыты, стробы горят ----------
  const wingRot0 = wingsN.map((w) => w.rotation.x);
  rig.setMode('patrol');
  for (let i = 0; i < 220; i++) rig.update(8.0 + i * 0.033, camera);
  if (!(Math.abs(wingsN[0].rotation.x) > 0.03))
    throw Error('patrol must raise the wing tips');
  if (!(Math.abs(wingsN[0].rotation.x + wingsN[1].rotation.x) < 1e-6))
    throw Error('patrol: wings must move symmetrically');
  if (!(root.getObjectByName('beacon').material.opacity > 0.1)) throw Error('patrol strobes on');
  if (legs.some((l) => l.visible)) throw Error('patrol: legs must be up');
  root.updateMatrixWorld(true);
  const sP = exactBounds(root).getSize(new THREE.Vector3());
  if (sP.y > 19.9 || sP.z > 69.6) throw Error('patrol pose out of spec: ' + sP.toArray());
  console.log('patrol: wings', (Math.abs(wingsN[0].rotation.x) * 57.3).toFixed(1),
    'deg | height', sP.y.toFixed(1), 'm | width', sP.z.toFixed(1), 'm');
  // крылья вернулись ровно в полёте
  rig.setMode('flight');
  for (let i = 0; i < 220; i++) rig.update(12.0 + i * 0.033, camera);
  if (!wingsN.every((w, k) => Math.abs(w.rotation.x - wingRot0[k]) < 1e-6))
    throw Error('flight must put the wings back');

  // ---------- 6) осада: стойки, пушка, ракетные соты ----------
  rig.setMode('siege');
  for (let i = 0; i < 240; i++) rig.update(16.0 + i * 0.033, camera);
  if (!legs.every((l) => l.visible)) throw Error('siege: legs must be down');
  if (!(cannon.rotation.z < -0.05)) throw Error('siege must depress the cannon');
  if (!(Math.abs(bays[0].position.z) < 1e-6))
    throw Error('booms must stay on the wing leading edge');
  if (!(glows[0].material.opacity > 0.7)) throw Error('siege must light the missile cells');
  root.updateMatrixWorld(true);
  const bbS = exactBounds(root);
  const sS = bbS.getSize(new THREE.Vector3());
  if (sS.y > 19.9 || sS.z > 69.8) throw Error('siege pose out of spec: ' + sS.toArray());
  if (bbS.min.y < -0.3) throw Error('siege legs sink below the deck: ' + bbS.min.y.toFixed(2));
  console.log('siege: cannon', (-cannon.rotation.z * 57.3).toFixed(1), 'deg | bays',
    bays[0].position.z.toFixed(2), 'm | соты opacity',
    glows[0].material.opacity.toFixed(2), '| height', sS.y.toFixed(1), 'm');

  // ---------- 7) ручные ручки ----------
  rig.setBay(0);
  for (let i = 0; i < 220; i++) rig.update(24.0 + i * 0.033, camera);
  if (glows[0].material.opacity > 0.3) throw Error('setBay(0) must close the tube doors');
  rig.setGuns(1);
  for (let i = 0; i < 220; i++) rig.update(28.0 + i * 0.033, camera);
  if (!(cannon.rotation.z < -0.05)) throw Error('setGuns(1) must depress the cannon');
  rig.setSpots(0);
  for (let i = 0; i < 90; i++) rig.update(32.0 + i * 0.033, camera);
  if (root.getObjectByName('lights').visible) throw Error('spots off must hide the lights');
  rig.setEngines(false);
  for (let i = 0; i < 90; i++) rig.update(36.0 + i * 0.033, camera);
  if (thrusters.visible) throw Error('engines off must hide the nozzle glow');
  rig.setEngines(true);
  rig.setThrust(0.8);
  for (let i = 0; i < 120; i++) rig.update(40.0 + i * 0.033, camera);
  if (!thrusters.visible) throw Error('engines on must show the nozzle glow');
  rig.setLegs(1);
  for (let i = 0; i < 130; i++) rig.update(44.0 + i * 0.033, camera);
  if (!legs.every((l) => l.visible)) throw Error('setLegs(1) must put the legs down');
  console.log('manual bays / cannon / spots / engines / legs: OK');

  // ---------- 8) пути отрисовки и draw calls ----------
  const mesh = root.getObjectByName('fuselage');
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
  if (meshes > 32) throw Error('too many draw calls: ' + meshes);
  if (tris > 26000) throw Error('too many triangles: ' + tris);

  console.log('state:', JSON.stringify(rig.getState()));
  rig.dispose();
  console.log('ALL OK');
}, (e) => { throw Error('GLB parse failed: ' + e); });
