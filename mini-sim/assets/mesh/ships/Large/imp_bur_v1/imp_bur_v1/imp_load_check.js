// Прогон armstrong_imp.glb + imp_controls.js через НАСТОЯЩИЙ GLTFLoader r128
// (three и загрузчик берутся из imp_demo.html — те же, что видит браузер).
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
console.log('createImpControls', typeof createImpControls);

const buf = fs.readFileSync(__dirname + '/armstrong_imp.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new THREE.GLTFLoader().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  const need = ['hull_mid', 'hull_bow', 'hull_rear', 'dorsal', 'prow_plates', 'visor_ring',
    'crusher', 'jaws', 'hangar', 'gantry', 'engines', 'thrusters', 'greebles', 'lights',
    'fins_l', 'fins_r', 'pylon_0', 'pylon_1', 'pylon_2', 'pylon_3'];
  for (const tag of ['r', 'l']) for (let i = 0; i < 3; i++) need.push('arm_' + i + tag);
  const missing = need.filter((n) => !root.getObjectByName(n));
  if (missing.length) throw Error('nodes missing: ' + missing.join(','));
  console.log('nodes:', need.length);

  // ---------- 1) габариты по карточке NFT ----------
  // точные границы: преобразуем вершины, а не боксы (Box3.setFromObject
  // завышает габарит у повёрнутых узлов — рук)
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
  const bb = exactBounds(root);
  const size = bb.getSize(new THREE.Vector3());
  console.log('bounds m:', size.x.toFixed(1), size.y.toFixed(1), size.z.toFixed(1));
  if (size.x > 443 + 1 || size.x < 420) throw Error('length out of envelope: ' + size.x);
  if (size.z > 262 + 1 || size.z < 240) throw Error('width out of envelope: ' + size.z);
  if (size.y > 121 + 1 || size.y < 110) throw Error('height out of envelope: ' + size.y);
  if (Math.abs(bb.min.y) > 0.3) throw Error('pylons are not on Y=0: ' + bb.min.y);
  console.log('envelope OK | Y', bb.min.y.toFixed(2), '..', bb.max.y.toFixed(2));

  const camera = new THREE.PerspectiveCamera(40, 1.7, 2, 20000);
  camera.position.set(-560, 260, 420);
  camera.lookAt(0, 55, 0);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);

  const rig = createImpControls(root);
  const crusher = root.getObjectByName('crusher');
  const thrusters = root.getObjectByName('thrusters');
  const visor = root.getObjectByName('visor_ring');
  const arms = ['arm_0r', 'arm_1r', 'arm_2r', 'arm_0l', 'arm_1l', 'arm_2l']
    .map((n) => root.getObjectByName(n));
  const restZ = arms.map((a) => a.position.z);
  const pylon = root.getObjectByName('pylon_0');
  const pylonY0 = pylon.position.y;

  if (rig.getMode() !== 'docked') throw Error('default mode should be docked');
  if (!(pylon.visible)) throw Error('docked pylons must be down');
  if (Math.abs(arms[0].position.z - restZ[0]) > 1e-6) throw Error('docked arms stay out');

  // ---------- 2) добыча: барабан крутится, пилоны уходят ----------
  rig.setMode('mining');
  for (let i = 0; i < 120; i++) rig.update(i * 0.033, camera);
  const spin = Math.abs(crusher.rotation.x);
  if (!(spin > 1.5)) throw Error('mining did not spin the crusher: ' + spin);
  if (Math.abs(pylon.position.y - pylonY0) < 1.0 && pylon.visible)
    throw Error('mining must retract the pylons');
  if (!(visor.material.opacity > 0.9)) throw Error('visor must glow in mining: ' + visor.material.opacity);
  console.log('mining: crusher', spin.toFixed(2), 'rad | visor', visor.material.opacity.toFixed(2),
    '| pylons retracted');

  // ---------- 3) переход: руки задвинуты, тяга ----------
  rig.setMode('transit');
  for (let i = 0; i < 150; i++) rig.update(4.0 + i * 0.033, camera);
  const pulled = arms.map((a, k) => Math.abs(a.position.z) - Math.abs(restZ[k]));
  if (!pulled.every((d) => d < -8.0)) throw Error('transit must pull the arms in: ' + pulled.join(','));
  if (!(thrusters.material.opacity > 0.6)) throw Error('thrusters: ' + thrusters.material.opacity);
  if (!thrusters.visible) throw Error('thrusters must be visible in transit');
  console.log('transit: arms pulled in by', Math.abs(pulled[0]).toFixed(1), 'm | thrust',
    rig.getThrust().toFixed(2));

  // руки в убранном положении не выходят за габарит, а корабль не «худеет» ниже 200 м
  root.updateMatrixWorld(true);
  const bbT = exactBounds(root);
  const sT = bbT.getSize(new THREE.Vector3());
  if (sT.z > 262 + 1) throw Error('retracted ship wider than the spec: ' + sT.z);
  if (sT.z < 200) throw Error('retracted ship is suspiciously narrow: ' + sT.z);
  console.log('transit envelope m:', sT.x.toFixed(1), sT.y.toFixed(1), sT.z.toFixed(1));
  // ---------- 4) варп: тяга 100 %, барабан стоит ----------
  rig.setMode('warp');
  for (let i = 0; i < 120; i++) rig.update(10.0 + i * 0.033, camera);
  if (rig.getCrusherSpeed() !== 0) throw Error('warp must stop the crusher');
  const a1 = crusher.rotation.x;
  for (let i = 0; i < 40; i++) rig.update(14.0 + i * 0.033, camera);
  if (Math.abs(crusher.rotation.x - a1) > 1e-3) throw Error('crusher must stand still in warp');
  if (!(thrusters.material.opacity > 0.8)) throw Error('warp thrust: ' + thrusters.material.opacity);
  console.log('warp: crusher stopped, thrust', rig.getThrust().toFixed(2));

  // ---------- 5) ручные ручки ----------
  rig.setArms(0);
  for (let i = 0; i < 160; i++) rig.update(16.0 + i * 0.033, camera);
  if (Math.abs(arms[0].position.z - restZ[0]) > 1.0) throw Error('setArms(0) did not extend');
  rig.setFloods(0);
  for (let i = 0; i < 60; i++) rig.update(22.0 + i * 0.033, camera);
  if (root.getObjectByName('lights').visible) throw Error('floods off must hide the lights');
  rig.setEngines(false);
  for (let i = 0; i < 60; i++) rig.update(25.0 + i * 0.033, camera);
  if (thrusters.visible) throw Error('engines off must hide the thrust discs');
  console.log('manual arms / floods / engines: OK');

  // ---------- 6) пути отрисовки и draw calls ----------
  const mesh = root.getObjectByName('hull_mid');
  if (!mesh.material.isMeshBasicMaterial) throw Error('CPU path must be unlit MeshBasicMaterial');
  if (!mesh.material.vertexColors) throw Error('CPU path must use vertex colours');
  rig.setShaderMode(true);
  if (!mesh.material.isMeshPhongMaterial) throw Error('shader mode must be MeshPhongMaterial');
  rig.setShaderMode(false);
  if (!mesh.material.isMeshBasicMaterial) throw Error('shader mode must restore the CPU material');
  console.log('CPU / shader paths: OK');

  let meshes = 0;
  root.traverse((o) => { if (o.isMesh) meshes++; });
  console.log('meshes (draw calls):', meshes);
  if (meshes > 30) throw Error('too many draw calls: ' + meshes);

  console.log('state:', JSON.stringify(rig.getState()));
  rig.dispose();
  console.log('ALL OK');
}, (e) => { throw Error('GLB parse failed: ' + e); });
