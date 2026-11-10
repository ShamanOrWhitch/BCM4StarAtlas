// Прогон calico_evac.glb + calico_evac_controls.js через НАСТОЯЩИЙ GLTFLoader r128
// (three и загрузчик берутся из calico_evac_demo.html — те же, что видит браузер).
const fs = require('fs');
const demo = fs.readFileSync(__dirname + '/calico_evac_demo.html', 'utf8');
const blocks = [...demo.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const three = blocks[0], loader = blocks[1];

global.self = global;
global.window = global;
global.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {} }) };
global.location = { href: 'http://localhost/' };

new Function(three)();
console.log('THREE rev', THREE.REVISION);
new Function('THREE', loader)(THREE);
new Function(fs.readFileSync(__dirname + '/calico_evac_controls.js', 'utf8'))();
console.log('createCalicoEvacControls', typeof createCalicoEvacControls);

const buf = fs.readFileSync(__dirname + '/calico_evac.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new THREE.GLTFLoader().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  const need = ['hull_mid', 'hull_fwd', 'hull_rear', 'spine', 'tail', 'engines', 'thrusters',
    'bay', 'winch', 'greebles', 'decals', 'lights', 'beacon', 'wings_r', 'wings_l',
    'arms_r', 'arms_l', 'pods_r', 'pods_l',
    'drone_0r', 'drone_0l', 'drone_1r', 'drone_1l',
    'skid_0', 'skid_1', 'skid_2', 'skid_3'];
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
  if (size.x > 53 + 0.4 || size.x < 50) throw Error('length out of envelope: ' + size.x);
  if (size.z > 30 + 0.4 || size.z < 27) throw Error('width out of envelope: ' + size.z);
  if (size.y > 13 + 0.4 || size.y < 10) throw Error('height out of envelope: ' + size.y);
  if (Math.abs(bb.min.y) > 0.25) throw Error('skids are not on Y=0: ' + bb.min.y);
  console.log('envelope OK | Y', bb.min.y.toFixed(2), '..', bb.max.y.toFixed(2));

  const camera = new THREE.PerspectiveCamera(40, 1.7, 0.3, 4000);
  camera.position.set(-78, 30, 58);
  camera.lookAt(0, 6, 0);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);

  const rig = createCalicoEvacControls(root);
  const thrusters = root.getObjectByName('thrusters');
  const wings = [root.getObjectByName('wings_r'), root.getObjectByName('wings_l')];
  const arms = [root.getObjectByName('arms_r'), root.getObjectByName('arms_l')];
  const pods = [root.getObjectByName('pods_r'), root.getObjectByName('pods_l')];
  const drones = ['drone_0r', 'drone_0l', 'drone_1r', 'drone_1l'].map((n) => root.getObjectByName(n));
  const skids = [0, 1, 2, 3].map((i) => root.getObjectByName('skid_' + i));
  const winch = root.getObjectByName('winch');

  const podY0 = pods.map((p) => p.position.y);
  const podZ0 = pods.map((p) => p.position.z);
  const droneY0 = drones.map((d) => d.position.y);
  const skidY0 = skids.map((s) => s.position.y);
  const winchY0 = winch.position.y;
  const wingQ0 = wings.map((w) => w.quaternion.clone());

  // ---------- 2) палуба ----------
  if (rig.getMode() !== 'pad') throw Error('default mode should be pad');
  if (!skids.every((s) => s.visible)) throw Error('pad: skids must be down');
  if (!wings.every((w, k) => w.quaternion.angleTo(wingQ0[k]) < 1e-6))
    throw Error('pad: wings must stay folded as authored');
  if (Math.abs(pods[0].position.y - podY0[0]) > 1e-6) throw Error('pad: pods must stay in the bays');
  if (thrusters.visible) throw Error('pad: thrusters must be off');
  console.log('pad: skids down, wings folded, pods stowed, thrust off');

  // ---------- 3) вылет: лыжи убраны, крылья раскрываются, тяга ----------
  rig.setMode('launch');
  for (let i = 0; i < 150; i++) rig.update(i * 0.033, camera);
  if (skids.some((s) => Math.abs(s.position.y - skidY0[skids.indexOf(s)]) < 0.8))
    throw Error('launch must retract the skids');
  if (!wings.every((w, k) => w.quaternion.angleTo(wingQ0[k]) > 0.15))
    throw Error('launch must move the wings');
  if (!thrusters.visible || thrusters.material.opacity < 0.5)
    throw Error('launch thrusters: ' + thrusters.material.opacity);
  console.log('launch: skids up', Math.abs(skids[0].position.y - skidY0[0]).toFixed(2),
    'm | wing fold', (wingQ0[0].angleTo(wings[0].quaternion) * 180 / Math.PI).toFixed(1),
    'deg | thrust', rig.getThrust().toFixed(2));

  // ---------- 4) спасение: руки, капсулы, дроны, крюк ----------
  rig.setMode('rescue');
  for (let i = 0; i < 200; i++) rig.update(8.0 + i * 0.033, camera);
  const drop = podY0[0] - pods[0].position.y;
  const spread = Math.abs(pods[0].position.z) - Math.abs(podZ0[0]);
  if (!(drop > 5.0)) throw Error('rescue must lower the pods: ' + drop);
  if (!(spread > 1.5)) throw Error('rescue must spread the pods: ' + spread);
  if (!arms.every((a) => a.quaternion.angleTo(new THREE.Quaternion()) > 0.25))
    throw Error('rescue must swing the arms out');
  const ddrop = droneY0[0] - drones[0].position.y;
  if (!(ddrop > 1.0)) throw Error('rescue must drop the drones: ' + ddrop);
  if (!(winchY0 - winch.position.y > 1.0)) throw Error('rescue must lower the winch hook');
  if (!(root.getObjectByName('beacon').material.opacity > 0.1))
    throw Error('rescue strobes must be on');
  console.log('rescue: pods down', drop.toFixed(2), 'm | spread', spread.toFixed(2),
    'm | drones down', ddrop.toFixed(2), 'm | hook down', (winchY0 - winch.position.y).toFixed(2), 'm');

  // капсулы в спущенном виде по-прежнему в габарите по ширине
  root.updateMatrixWorld(true);
  const bbR = exactBounds(root);
  const sR = bbR.getSize(new THREE.Vector3());
  if (sR.z > 30 + 0.4) throw Error('rescue pose wider than the spec: ' + sR.z);
  console.log('rescue envelope m:', sR.x.toFixed(1), sR.y.toFixed(1), sR.z.toFixed(1));

  // ---------- 5) эвакуация: капсулы отделены, руки убраны ----------
  rig.setMode('evac');
  for (let i = 0; i < 200; i++) rig.update(16.0 + i * 0.033, camera);
  if (!(podY0[0] - pods[0].position.y > 5.0)) throw Error('evac must keep the pods released');
  if (!arms.every((a) => a.quaternion.angleTo(new THREE.Quaternion()) < 0.2))
    throw Error('evac must pull the arms back');
  if (!(thrusters.material.opacity > 0.6)) throw Error('evac thrust: ' + thrusters.material.opacity);
  console.log('evac: pods released, arms stowed, thrust', rig.getThrust().toFixed(2));

  // ---------- 6) ручные ручки ----------
  rig.setPods(0);
  for (let i = 0; i < 200; i++) rig.update(24.0 + i * 0.033, camera);
  if (Math.abs(pods[0].position.y - podY0[0]) > 0.6) throw Error('setPods(0) must stow the pods');
  rig.setSpots(0);
  for (let i = 0; i < 80; i++) rig.update(32.0 + i * 0.033, camera);
  if (root.getObjectByName('lights').visible) throw Error('spots off must hide the lights');
  rig.setEngines(false);
  for (let i = 0; i < 80; i++) rig.update(36.0 + i * 0.033, camera);
  if (thrusters.visible) throw Error('engines off must hide the thrust discs');
  rig.setSkids(1);
  for (let i = 0; i < 120; i++) rig.update(40.0 + i * 0.033, camera);
  if (!skids.every((s) => s.visible)) throw Error('setSkids(1) must put the skids down');
  console.log('manual pods / spots / engines / skids: OK');

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
