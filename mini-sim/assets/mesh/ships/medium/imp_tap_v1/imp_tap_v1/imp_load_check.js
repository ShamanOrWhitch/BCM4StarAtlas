// Прогон imp_tap.glb + imp_controls.js через НАСТОЯЩИЙ GLTFLoader r128
// (three и загрузчик берутся из imp_demo.html — тех же, что видит браузер).
const fs = require('fs');
const demo = fs.readFileSync(__dirname + '/imp_demo.html', 'utf8');
const blocks = [...demo.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const three = blocks[0], loader = blocks[1];

global.self = global;
global.window = global;
global.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {} }) };
global.location = { href: 'http://localhost/' };

new Function(three)();
console.log('THREE rev', THREE.REVISION);
new Function('THREE', loader)(THREE);
new Function(fs.readFileSync(__dirname + '/imp_controls.js', 'utf8'))();
console.log('createImpTapControls', typeof createImpTapControls);

const buf = fs.readFileSync(__dirname + '/imp_tap.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new THREE.GLTFLoader().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  const need = ['hull', 'shell', 'armor', 'machinery', 'drill_mount', 'drills',
    'engines', 'thrusters', 'lights'];
  for (let i = 0; i < 6; i++) need.push('leg_' + i);
  const missing = need.filter((n) => !root.getObjectByName(n));
  if (missing.length) throw Error('nodes missing: ' + missing.join(','));
  console.log('nodes:', need.length);

  // ---------- 1) габариты по официальной карточке ----------
  const bb = new THREE.Box3().setFromObject(root);
  const size = bb.getSize(new THREE.Vector3());
  console.log('bounds m:', size.x.toFixed(1), size.y.toFixed(1), size.z.toFixed(1));
  if (Math.abs(size.x - 47.8) > 1.2) throw Error('length is not ~47.8 m: ' + size.x);
  if (Math.abs(size.z - 48.5) > 1.2) throw Error('width is not ~48.5 m: ' + size.z);
  if (Math.abs(size.y - 19.0) > 0.8) throw Error('height is not ~19 m: ' + size.y);
  if (Math.abs(bb.min.y) > 0.05) throw Error('feet are not on Y=0: ' + bb.min.y);
  console.log('envelope OK | Y', bb.min.y.toFixed(2), '..', bb.max.y.toFixed(2));

  // ---------- 2) контроллер: складка лап, барабаны, тяга ----------
  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.5, 4000);
  camera.position.set(-90, 40, 70);
  camera.lookAt(0, 9, 0);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);

  const rig = createImpTapControls(root);
  const legA = root.getObjectByName('leg_0');
  const legB = root.getObjectByName('leg_3');
  const drills = root.getObjectByName('drills');
  const thrusters = root.getObjectByName('thrusters');
  if (rig.getMode() !== 'landed') throw Error('default mode should be landed');
  if (Math.abs(legA.rotation.x) > 1e-6) throw Error('landed legs must be straight');

  rig.setMode('mining');
  for (let i = 0; i < 90; i++) rig.update(i * 0.033, camera);
  const spin = Math.abs(drills.rotation.x);
  if (!(spin > 1.0)) throw Error('mining did not spin the drums: ' + spin);
  if (Math.abs(legA.rotation.x) > 1e-6) throw Error('mining must stand on legs');
  console.log('mining: drum angle', spin.toFixed(2), 'rad, legs straight');

  rig.setMode('flight');
  for (let i = 0; i < 120; i++) rig.update(3.0 + i * 0.033, camera);
  const foldA = legA.rotation.x * 57.3;
  const foldB = legB.rotation.x * 57.3;
  if (!(Math.abs(foldA) > 80 && Math.abs(foldA) < 100))
    throw Error('flight fold out of range: ' + foldA);
  if (Math.sign(foldA) === Math.sign(foldB)) throw Error('legs must fold to their own side');
  if (thrusters.visible !== true) throw Error('thrusters must fire in flight');
  if (!(thrusters.material.opacity > 0.8)) throw Error('thruster opacity: ' + thrusters.material.opacity);
  console.log('flight: fold', foldA.toFixed(1), '/', foldB.toFixed(1), 'deg | thrust',
    rig.getThrust().toFixed(2));

  // складка не выводит лапы за габарит корабля
  root.updateMatrixWorld(true);
  const bbF = new THREE.Box3().setFromObject(root);
  const sF = bbF.getSize(new THREE.Vector3());
  if (sF.z > 48.5 + 0.6) throw Error('folded legs stick out sideways: ' + sF.z);
  console.log('flight envelope m:', sF.x.toFixed(1), sF.y.toFixed(1), sF.z.toFixed(1));

  // ---------- 3) ручные ручки ----------
  rig.setDrillSpeed(0);
  for (let i = 0; i < 60; i++) rig.update(10.0 + i * 0.033, camera);
  const a1 = drills.rotation.x;
  for (let i = 0; i < 30; i++) rig.update(12.0 + i * 0.033, camera);
  if (Math.abs(drills.rotation.x - a1) > 1e-3) throw Error('drums must stop at speed 0');
  console.log('drums stop at 0: OK');

  rig.setLegs(0);
  for (let i = 0; i < 120; i++) rig.update(13.0 + i * 0.033, camera);
  if (Math.abs(legA.rotation.x) > 1e-3) throw Error('setLegs(0) did not unfold: ' + legA.rotation.x);
  console.log('manual legs: OK');

  rig.setEngines(false);
  for (let i = 0; i < 40; i++) rig.update(18.0 + i * 0.033, camera);
  if (thrusters.visible) throw Error('engines off must hide the thrust discs');
  console.log('engines off: thrusters hidden');

  // ---------- 4) пути отрисовки ----------
  const mesh = root.getObjectByName('hull');
  if (!mesh.material.isMeshBasicMaterial) throw Error('CPU path must be unlit MeshBasicMaterial');
  if (!mesh.material.vertexColors) throw Error('CPU path must use vertex colours');
  rig.setShaderMode(true);
  if (!mesh.material.isMeshPhongMaterial) throw Error('shader mode must be MeshPhongMaterial');
  rig.setShaderMode(false);
  if (!mesh.material.isMeshBasicMaterial) throw Error('shader mode must restore the CPU material');
  console.log('CPU / shader paths: OK');

  // ---------- 5) draw calls ----------
  let meshes = 0;
  root.traverse((o) => { if (o.isMesh) meshes++; });
  console.log('meshes (draw calls):', meshes);
  if (meshes > 24) throw Error('too many draw calls: ' + meshes);

  const st = rig.getState();
  console.log('state:', JSON.stringify(st));
  rig.dispose();
  console.log('ALL OK');
}, (e) => { throw Error('GLB parse failed: ' + e); });
