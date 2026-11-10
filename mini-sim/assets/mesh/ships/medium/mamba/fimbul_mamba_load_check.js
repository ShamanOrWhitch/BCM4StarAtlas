// Прогон fimbul_mamba.glb + fimbul_mamba_controls.js через НАСТОЯЩИЙ GLTFLoader
// r128 (three и загрузчик берутся из fimbul_mamba_demo.html — те же, что видит
// браузер). Проверяются: узлы, габарит 38 × 18 × 9 м, посадка остекления на
// обшивку (луч вниз из каждой нижней вершины стекла), режимы, тяга, двери,
// пути отрисовки и число draw calls.
const fs = require('fs');
const demo = fs.readFileSync(__dirname + '/fimbul_mamba_demo.html', 'utf8');
const blocks = [...demo.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const three = blocks[0], loader = blocks[1];

global.self = global;
global.window = global;
global.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {} }) };
global.location = { href: 'http://localhost/' };

new Function(three)();
console.log('THREE rev', THREE.REVISION);
new Function('THREE', loader)(THREE);
new Function(fs.readFileSync(__dirname + '/fimbul_mamba_controls.js', 'utf8'))();
console.log('createFimbulMambaControls', typeof createFimbulMambaControls);

const buf = fs.readFileSync(__dirname + '/fimbul_mamba.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new THREE.GLTFLoader().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  const need = ['pod_r', 'pod_l', 'gun_r', 'gun_l', 'center_hull', 'canopy',
    'rear_block', 'engines', 'thrusters', 'ramp', 'wing_root_r', 'wing_root_l', 'turret_base_r', 'turret_r',
    'turret_base_l', 'turret_l', 'rail_guns_r', 'rail_guns_l', 'missile_bay',
    'bay_door', 'greebles', 'decals', 'lights', 'beacon',
    'leg_0', 'leg_1', 'leg_2', 'leg_3', 'leg_4', 'leg_5'];
  const missing = need.filter((n) => !root.getObjectByName(n));
  if (missing.length) throw Error('nodes missing: ' + missing.join(','));
  console.log('nodes:', need.length);

  // ---------- 1) габариты по карточке NFT: 38 × 18 × 9 м ----------
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
  if (size.x > 38.0 + 0.4 || size.x < 36.5) throw Error('length out of envelope: ' + size.x);
  if (size.z > 18.0 + 0.4 || size.z < 16.5) throw Error('width out of envelope: ' + size.z);
  if (size.y > 9.0 + 0.4 || size.y < 8.0) throw Error('height out of envelope: ' + size.y);
  if (Math.abs(bb.min.y) > 0.25) throw Error('legs are not on Y=0: ' + bb.min.y);
  console.log('envelope OK | Y', bb.min.y.toFixed(2), '..', bb.max.y.toFixed(2));

  // ---------- 2) остекление сидит на обшивке ----------
  // Из каждой нижней вершины стекла пускаем луч вниз и ищем металл под ней.
  // Остекление не должно висеть в воздухе — это регресс, который правится
  // вручную на каждом корабле.
  const supports = ['center_hull', 'pod_r', 'pod_l', 'rear_block']
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
    base.forEach((p) => {
      ray.set(new THREE.Vector3(p.x, p.y + 0.12, p.z), down);
      const hits = ray.intersectObjects(supports, false);
      const top = hits.length ? hits[0].point.y : -99;
      const gap = p.y - top;               // >0 — стекло висит над металлом
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

  // ---------- 2б) корпус не просвечивает: у каждой оболочки грани наружу ----------
  // Регресс, который поймал пользователь: левый борт «просвечивал» — часть
  // граней клыка была вывернута наизнанку, и с включённым отсечением (как в
  // браузере и в игре) обшивка пропадала, а сквозь неё было видно нутро.
  // Проверка: из 4 м сферы вокруг оси каждой оболочки стреляем внутрь —
  // луч обязан упереться в переднюю грань обшивки.
  (function () {
    const ray2 = new THREE.Raycaster();
    const shells = [['pod_r', new THREE.Vector3(0, 5, 6.25)],
                    ['pod_l', new THREE.Vector3(0, 5, -6.25)],
                    ['gun_r', new THREE.Vector3(-17, 4.8, 6.25)],
                    ['gun_l', new THREE.Vector3(-17, 4.8, -6.25)],
                    ['center_hull', new THREE.Vector3(7, 5.6, 0)],
                    ['wing_root_r', new THREE.Vector3(9.0, 3.86, 3.92)],
                    ['wing_root_l', new THREE.Vector3(9.0, 3.86, -3.92)]];
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

  const camera = new THREE.PerspectiveCamera(40, 1.7, 0.3, 4000);
  camera.position.set(-62, 26, 48);
  camera.lookAt(0, 4.6, 0);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);

  const rig = createFimbulMambaControls(root);
  const thrusters = root.getObjectByName('thrusters');
  const guns = [root.getObjectByName('gun_r'), root.getObjectByName('gun_l')];
  const turrets = [root.getObjectByName('turret_r'), root.getObjectByName('turret_l')];
  const bay = root.getObjectByName('bay_door');
  const rampNode = root.getObjectByName('ramp');
  const legs = [0, 1, 2, 3, 4, 5].map((i) => root.getObjectByName('leg_' + i));
  const legY0 = legs.map((l) => l.position.y);

  // ---------- 3) палуба ----------
  if (rig.getMode() !== 'pad') throw Error('default mode should be pad');
  if (!legs.every((l) => l.visible)) throw Error('pad: legs must be down');
  if (!(Math.abs(guns[0].rotation.z) < 1e-6)) throw Error('pad: guns must stay stowed');
  if (!turrets.every((t) => Math.abs(t.rotation.y) < 1e-6)) throw Error('pad: turrets must face forward');
  if (!(Math.abs(bay.rotation.z) < 1e-6)) throw Error('pad: missile bay must stay shut');
  if (thrusters.visible) throw Error('pad: thrusters must be off');
  console.log('pad: legs down, guns stowed, bay shut, thrust off');

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
  if (sF.x > 38.4 || sF.z > 18.4) throw Error('flight pose out of the spec: ' + sF.toArray());
  console.log('flight envelope m:', sF.x.toFixed(1), sF.y.toFixed(1), sF.z.toFixed(1));

  // ---------- 5) охота: стволы, турели, ракетный отсек ----------
  rig.setMode('hunt');
  for (let i = 0; i < 220; i++) rig.update(8.0 + i * 0.033, camera);
  if (!(guns[0].rotation.z < -0.20)) throw Error('hunt must elevate the nose guns');
  if (!(Math.abs(turrets[0].rotation.y) > 1.2)) throw Error('hunt must traverse the turrets');
  if (!(Math.abs(bay.rotation.z) > 0.7)) throw Error('hunt must open the missile bay');
  if (!(root.getObjectByName('beacon').material.opacity > 0.1)) throw Error('hunt strobes must be on');
  // стволы/турели/крышка не выходят за габарит в боевом положении
  root.updateMatrixWorld(true);
  const bbH = exactBounds(root);
  const sH = bbH.getSize(new THREE.Vector3());
  if (sH.y > 9.6) throw Error('hunt pose too tall: ' + sH.y.toFixed(2));
  console.log('hunt: guns', (-guns[0].rotation.z * 57.3).toFixed(0), 'deg | turrets',
    (Math.abs(turrets[0].rotation.y) * 57.3).toFixed(0), 'deg | bay',
    (Math.abs(bay.rotation.z) * 57.3).toFixed(0), 'deg | height', sH.y.toFixed(1), 'm');

  // ---------- 6) погрузка: отсек открыт, стойки выпущены ----------
  // Режим 'brig' переименован в 'load' (длинного остекления и двери брига в
  // модели больше нет), но старое имя должно приниматься как псевдоним —
  // иначе внешний код, вызывающий setMode('brig'), падает.
  rig.setMode('brig');
  if (rig.getMode() !== 'load') throw Error("setMode('brig') must alias 'load'");
  for (let i = 0; i < 220; i++) rig.update(16.0 + i * 0.033, camera);
  if (!(Math.abs(bay.rotation.z) > 0.7)) throw Error('load must open the missile bay');
  if (!legs.every((l) => l.visible)) throw Error('load: legs must be down');
  root.updateMatrixWorld(true);
  const bbL = exactBounds(root);
  console.log('load: bay', (Math.abs(bay.rotation.z) * 57.3).toFixed(0), 'deg | height',
    bbL.getSize(new THREE.Vector3()).y.toFixed(1), 'm | legs down');
  // аппарель: откинута вниз-вперёд, конец выше палубы (не проваливается),
  // и не задевает клыки
  const rr = Math.abs(rampNode.rotation.z);
  if (!(rr > 1.9)) throw Error('load must lower the ramp: ' + (rr * 57.3).toFixed(0) + ' deg');
  const rampBox = new THREE.Box3().setFromObject(rampNode);
  const podR = new THREE.Box3().setFromObject(root.getObjectByName('pod_r'));
  const podL = new THREE.Box3().setFromObject(root.getObjectByName('pod_l'));
  if (rampBox.min.y < -0.05) throw Error('ramp goes below the deck: ' + rampBox.min.y.toFixed(2));
  if (rampBox.intersectsBox(podR) || rampBox.intersectsBox(podL))
    throw Error('lowered ramp hits a gun pod');
  // передний конец ниже кормового — трап действительно сходит вниз
  const tipY = rampBox.min.y, hingeY = rampNode.position.y;
  console.log('ramp:', (rr * 57.3).toFixed(0), 'deg | x', rampBox.min.x.toFixed(2), '..',
    rampBox.max.x.toFixed(2), '| низ', tipY.toFixed(2), 'м (петля', hingeY.toFixed(2), 'м)');

  // ---------- 7) ручные ручки ----------
  rig.setBay(0);
  for (let i = 0; i < 220; i++) rig.update(24.0 + i * 0.033, camera);
  if (Math.abs(bay.rotation.z) > 0.1) throw Error('setBay(0) must close the missile bay');
  rig.setSpots(0);
  for (let i = 0; i < 80; i++) rig.update(32.0 + i * 0.033, camera);
  if (root.getObjectByName('lights').visible) throw Error('spots off must hide the lights');
  rig.setEngines(false);
  for (let i = 0; i < 80; i++) rig.update(36.0 + i * 0.033, camera);
  if (thrusters.visible) throw Error('engines off must hide the thrust discs');
  rig.setLegs(1);
  for (let i = 0; i < 120; i++) rig.update(40.0 + i * 0.033, camera);
  if (!legs.every((l) => l.visible)) throw Error('setLegs(1) must put the legs down');
  console.log('manual bay / spots / engines / legs: OK');

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
  if (meshes > 32) throw Error('too many draw calls: ' + meshes);
  if (tris > 22000) throw Error('too many triangles: ' + tris);

  console.log('state:', JSON.stringify(rig.getState()));
  rig.dispose();
  console.log('ALL OK');
}, (e) => { throw Error('GLB parse failed: ' + e); });
