// Прогон calico_hero.glb + calico_hero_controls.js через НАСТОЯЩИЙ GLTFLoader r128
// (three и загрузчик берутся из calico_hero_demo.html — те же, что видит браузер).
const fs = require('fs');
const demo = fs.readFileSync(__dirname + '/calico_hero_demo.html', 'utf8');
const blocks = [...demo.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const three = blocks[0], loader = blocks[1];

global.self = global;
global.window = global;
global.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {} }) };
global.location = { href: 'http://localhost/' };

new Function(three)();
console.log('THREE rev', THREE.REVISION);
new Function('THREE', loader)(THREE);
new Function(fs.readFileSync(__dirname + '/calico_hero_controls.js', 'utf8'))();
console.log('createCalicoHeroControls', typeof createCalicoHeroControls);

const buf = fs.readFileSync(__dirname + '/calico_hero.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new THREE.GLTFLoader().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  const need = ['hull_fwd', 'hull_mid', 'hull_rear', 'canopy', 'turret', 'turret_guns',
    'bay_wells', 'mbay_r', 'mbay_l', 'drone_port', 'engines', 'thrusters', 'ramp',
    'cms', 'greebles', 'decals', 'lights', 'beacon', 'fins_r', 'fins_l',
    'winglets_r', 'winglets_l', 'vtol_r', 'vtol_l', 'leg_0', 'leg_1', 'leg_2', 'leg_3'];
  const missing = need.filter((n) => !root.getObjectByName(n));
  if (missing.length) throw Error('nodes missing: ' + missing.join(','));
  console.log('nodes:', need.length);

  // ---------- 1) габариты по карточке NFT: 53 × 30 × 13 м ----------
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
  if (size.x > 46.6 + 0.4 || size.x < 43) throw Error('length out of envelope: ' + size.x);
  if (size.z > 30.1 + 0.4 || size.z < 27) throw Error('width out of envelope: ' + size.z);
  if (size.y > 11.5 + 0.4 || size.y < 9) throw Error('height out of envelope: ' + size.y);
  if (Math.abs(bb.min.y) > 0.25) throw Error('legs are not on Y=0: ' + bb.min.y);
  console.log('envelope OK | Y', bb.min.y.toFixed(2), '..', bb.max.y.toFixed(2));

  const camera = new THREE.PerspectiveCamera(40, 1.7, 0.3, 4000);
  camera.position.set(-78, 30, 58);
  camera.lookAt(0, 6, 0);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);

  const rig = createCalicoHeroControls(root);
  const thrusters = root.getObjectByName('thrusters');
  const turret = root.getObjectByName('turret');
  const guns = root.getObjectByName('turret_guns');
  const ramp = root.getObjectByName('ramp');
  const dport = root.getObjectByName('drone_port');
  const fins = [root.getObjectByName('fins_r'), root.getObjectByName('fins_l')];
  const mbays = [root.getObjectByName('mbay_r'), root.getObjectByName('mbay_l')];
  const vtols = [root.getObjectByName('vtol_r'), root.getObjectByName('vtol_l')];
  const legs = [0, 1, 2, 3].map((i) => root.getObjectByName('leg_' + i));
  const legY0 = legs.map((l) => l.position.y);
  const dportX0 = dport.position.x;
  const rampX0 = ramp.rotation.z;

  // ---------- 2) палуба: стойки выпущены, плоскости вертикально ----------
  if (rig.getMode() !== 'pad') throw Error('default mode should be pad');
  if (!legs.every((l) => l.visible)) throw Error('pad: legs must be down');
  if (!(Math.abs(fins[0].rotation.z) < 1e-6)) throw Error('pad: fins must stay vertical (A)');
  if (!mbays.every((m) => Math.abs(m.rotation.x) < 1e-6)) throw Error('pad: bays must stay shut');
  if (!(Math.abs(ramp.rotation.z - rampX0) < 1e-6)) throw Error('pad: ramp must stay stowed');
  if (thrusters.visible) throw Error('pad: thrusters must be off');
  console.log('pad: legs down, fins vertical, bays shut, thrust off');

  // ---------- 3) полёт: стойки убраны, плоскости отклонены назад ----------
  rig.setMode('flight');
  for (let i = 0; i < 150; i++) rig.update(i * 0.033, camera);
  if (legs.some((l, k) => Math.abs(l.position.y - legY0[k]) < 1.0))
    throw Error('flight must retract the legs');
  const sweep = Math.abs(fins[0].rotation.z) * 180 / Math.PI;
  if (!(sweep > 45)) throw Error('flight must sweep the fins back: ' + sweep.toFixed(1));
  if (!thrusters.visible || thrusters.material.opacity < 0.5)
    throw Error('flight thrusters: ' + thrusters.material.opacity);
  console.log('flight: legs up', Math.abs(legs[0].position.y - legY0[0]).toFixed(2),
    'm | fin sweep', sweep.toFixed(1), 'deg | thrust', rig.getThrust().toFixed(2));

  // плоскости в отклонённом виде не выходят за габарит
  root.updateMatrixWorld(true);
  const bbF = exactBounds(root);
  const sF = bbF.getSize(new THREE.Vector3());
  if (sF.x > 46.6 + 0.4 || sF.z > 30.1 + 0.4) throw Error('flight pose out of the spec: ' + sF.toArray());
  console.log('flight envelope m:', sF.x.toFixed(1), sF.y.toFixed(1), sF.z.toFixed(1));

  // ---------- 4) бой: отсеки, турель, стволы, контрмеры ----------
  rig.setMode('combat');
  for (let i = 0; i < 200; i++) rig.update(8.0 + i * 0.033, camera);
  if (!mbays.every((m) => Math.abs(m.rotation.x) > 0.6)) throw Error('combat must open the missile bays');
  if (!(Math.abs(turret.rotation.y) > 1.2)) throw Error('combat must traverse the turret');
  if (!(guns.rotation.z < -0.25)) throw Error('combat must elevate the guns');
  if (!(root.getObjectByName('beacon').material.opacity > 0.1)) throw Error('combat strobes must be on');
  console.log('combat: bays open', (Math.abs(mbays[0].rotation.x) * 57.3).toFixed(0),
    'deg | turret', (Math.abs(turret.rotation.y) * 57.3).toFixed(0),
    'deg | guns', (-guns.rotation.z * 57.3).toFixed(0), 'deg');

  // ---------- 5) погрузка: трап, люк дрона, VTOL ----------
  rig.setMode('cargo');
  for (let i = 0; i < 200; i++) rig.update(16.0 + i * 0.033, camera);
  if (!(Math.abs(ramp.rotation.z - rampX0) > 1.0)) throw Error('cargo must lower the ramp (Z axis)');
  if (Math.abs(ramp.rotation.x) > 1e-6)
    throw Error('ramp must not rotate around X — it swings into the engines');
  if (!(Math.abs(dport.position.x - dportX0) > 1.5)) throw Error('cargo must slide the drone hatch');
  if (!vtols.every((v) => v.visible)) throw Error('cargo must light the VTOL discs');
  // трап в открытом положении уходит вниз, а не в двигательный отсек
  root.updateMatrixWorld(true);
  const rampBox = new THREE.Box3().setFromObject(ramp);
  const engBox = new THREE.Box3().setFromObject(root.getObjectByName('engines'));
  if (rampBox.max.y > engBox.min.y + 0.2)
    throw Error('open ramp reaches the engines: ramp top ' + rampBox.max.y.toFixed(2) +
      ' vs engine bottom ' + engBox.min.y.toFixed(2));
  console.log('cargo ramp: top', rampBox.max.y.toFixed(2), 'm | engines start at',
    engBox.min.y.toFixed(2), 'm | tip y', rampBox.min.y.toFixed(2));
  console.log('cargo: ramp down', ((ramp.rotation.z - rampX0) * 57.3).toFixed(0),
    'deg | hatch', Math.abs(dport.position.x - dportX0).toFixed(2),
    'm | vtol', rig.getVtol().toFixed(2));

  // ---------- 6) ручные ручки ----------
  rig.setDronePort(0);
  rig.setVtol(0);
  for (let i = 0; i < 200; i++) rig.update(24.0 + i * 0.033, camera);
  if (Math.abs(dport.position.x - dportX0) > 0.6) throw Error('setDronePort(0) must close the hatch');
  rig.setSpots(0);
  for (let i = 0; i < 80; i++) rig.update(32.0 + i * 0.033, camera);
  if (root.getObjectByName('lights').visible) throw Error('spots off must hide the lights');
  rig.setEngines(false);
  for (let i = 0; i < 80; i++) rig.update(36.0 + i * 0.033, camera);
  if (thrusters.visible) throw Error('engines off must hide the thrust discs');
  rig.setLegs(1);
  for (let i = 0; i < 120; i++) rig.update(40.0 + i * 0.033, camera);
  if (!legs.every((l) => l.visible)) throw Error('setLegs(1) must put the legs down');
  console.log('manual hatch / spots / engines / legs: OK');

  // ---------- 7) пути отрисовки и draw calls ----------
  const mesh = root.getObjectByName('hull_mid');
  if (!mesh.material.isMeshBasicMaterial) throw Error('CPU path must be unlit MeshBasicMaterial');
  if (!mesh.material.vertexColors) throw Error('CPU path must use vertex colours');
  rig.setShaderMode(true);
  if (!mesh.material.isMeshPhongMaterial) throw Error('shader mode must be MeshPhongMaterial');
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
  if (tris > 20000) throw Error('too many triangles: ' + tris);

  console.log('state:', JSON.stringify(rig.getState()));
  rig.dispose();
  console.log('ALL OK');
}, (e) => { throw Error('GLB parse failed: ' + e); });
