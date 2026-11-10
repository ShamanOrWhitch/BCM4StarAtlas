// Прогон rainbow_arc.glb + arc_controls.js через НАСТОЯЩИЙ GLTFLoader r128 (из arc_demo.html)
const fs = require('fs');
const demo = fs.readFileSync(__dirname + '/arc_demo.html', 'utf8');
const blocks = [...demo.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const three = blocks[0], loader = blocks[1];

global.self = global; global.window = global;
global.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {} }) };
global.location = { href: 'http://localhost/' };

new Function(three)();
console.log('THREE rev', THREE.REVISION);
new Function('THREE', loader)(THREE);
new Function(fs.readFileSync(__dirname + '/arc_controls.js', 'utf8'))();
console.log('createArcControls', typeof createArcControls);

const buf = fs.readFileSync(__dirname + '/rainbow_arc.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new THREE.GLTFLoader().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  const need = ['hull_core', 'bridge', 'cargo_bay', 'light_seams', 'levitation', 'engines'];
  for (let i = 0; i < 10; i++) need.push('panel_' + i);
  const missing = need.filter((n) => !root.getObjectByName(n));
  if (missing.length) throw Error('nodes missing: ' + missing.join(','));
  console.log('nodes:', need.length);

  const bb = new THREE.Box3().setFromObject(root);
  const size = bb.getSize(new THREE.Vector3());
  console.log('bounds m:', size.x.toFixed(1), size.y.toFixed(1), size.z.toFixed(1));
  if (Math.abs(size.x - 130) > 6) throw Error('length is not ~130 m: ' + size.x);
  if (Math.abs(size.z - 38) > 6) throw Error('width is not ~38 m: ' + size.z);
  if (size.y < 28 || size.y > 40) throw Error('height out of range: ' + size.y);

  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.5, 2000);
  camera.position.set(176, 96, 206);
  camera.lookAt(0, 14, 0);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);

  const rig = createArcControls(root);
  const p0 = root.getObjectByName('panel_3');
  const mat = root.getObjectByName('panel_0').material;

  // ---------- 1) режимы двигают секции ----------
  rig.setMode('lift');
  if (rig.getMode() !== 'lift') throw Error('getMode broken');
  for (let i = 0; i < 60; i++) rig.update(1.0 + i * 0.05, camera);
  const liftY = p0.position.y;
  if (!(liftY > 1.5)) throw Error('lift mode did not raise the panels: ' + liftY);
  console.log('lift offset y:', liftY.toFixed(2), 'm');
  rig.setMode('flight');
  for (let i = 0; i < 80; i++) rig.update(5.0 + i * 0.05, camera);
  if (Math.abs(p0.position.y) > 0.05) throw Error('flight did not settle back: ' + p0.position.y);
  console.log('flight settled: OK');

  // ---------- 2) CPU-путь красит вершины ----------
  rig.setChameleon(0.7);
  rig.update(9.0, camera);
  const body = root.getObjectByName('hull_core');
  const cols = Array.from(body.geometry.attributes.color.array.slice(0, 9)).map((v) => +v.toFixed(3));
  console.log('unlit colours:', cols.join(','));
  if (cols.every((v) => v === 0)) throw Error('CPU paint produced nothing');

  // ---------- 3) маскировка + потолок альфы ----------
  rig.setEnvironment(0x101925);
  rig.setCamouflage(0.9);
  if (rig.getCamouflage() !== 0.9) throw Error('getCamouflage broken');
  rig.update(9.5, camera);
  if (!mat.transparent || mat.depthWrite) throw Error('cloak flags wrong');
  if (!(mat.opacity > 0.20 && mat.opacity < 0.28)) throw Error('cloak op@0.9: ' + mat.opacity);
  console.log('cloak op@0.9:', mat.opacity.toFixed(3));
  rig.setCamouflage(1);
  if (!(mat.opacity > 0.10 && mat.opacity < 0.15)) throw Error('cloak must not reach 0: ' + mat.opacity);
  console.log('cloak op@1.0:', mat.opacity.toFixed(3), '(never 0)');
  // световые швы, поле левитации и двигатели остаются непрозрачными
  ['light_seams', 'levitation', 'engines'].forEach((n) => {
    const m = root.getObjectByName(n).material;
    if (m.transparent || m.opacity !== 1) throw Error(n + ' must stay opaque');
  });
  console.log('seams / levitation / engines opaque: OK');

  // ---------- 4) шейдерный режим ----------
  rig.setShaderMode(true);
  if (!rig.getShaderMode()) throw Error('getShaderMode broken');
  const ph = root.getObjectByName('panel_0').material;
  if (!ph.isMeshPhongMaterial) throw Error('shader mode should use MeshPhongMaterial');
  let sh = null;
  ph.onBeforeCompile({
    uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <project_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>'
  });
  // перехватываем реальный вызов
  const fake = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <project_vertex>',
                 fragmentShader: '#include <common>\n#include <color_fragment>' };
  ph.onBeforeCompile(fake);
  sh = fake;
  const needF = ['uAhCamo', 'uAhEnvH', 'uAhUpV', 'reflect(', '0.62 + 0.38 * ahF', 'min(0.9, uAhCamo'];
  needF.forEach((k) => { if (!sh.fragmentShader.includes(k)) throw Error('fragment missing: ' + k); });
  if (!sh.vertexShader.includes('transformed.y += ahW1 * uAhAmp')) throw Error('vertex hover missing');
  ['uAhCamo', 'uAhEnvZ', 'uAhEnvH', 'uAhEnvG', 'uAhUpV', 'uAhTime', 'uAhChm'].forEach((u) => {
    if (!sh.uniforms[u]) throw Error('uniform missing: ' + u);
  });
  rig.update(10.0, camera);
  if (sh.uniforms.uAhCamo.value !== 1) throw Error('uAhCamo not synced: ' + sh.uniforms.uAhCamo.value);
  if (sh.uniforms.uAhUpV.value.lengthSq() < 0.9) throw Error('uAhUpV not synced');
  if (!sh.fragmentShader.includes('diffuseColor.rgb = mix(diffuseColor.rgb, ahEnv, ahW)'))
    throw Error('camouflage mix missing');
  console.log('shader mode OK | uAhCamo', sh.uniforms.uAhCamo.value, '| cloak op', ph.opacity.toFixed(3));
  rig.setShaderMode(false);
  if (root.getObjectByName('panel_0').material === ph) throw Error('shader mode did not restore material');
  console.log('shader mode off: material restored');

  // ---------- 5) возврат в 0 и dispose ----------
  rig.setCamouflage(0);
  if (mat.transparent || mat.opacity !== 1 || !mat.depthWrite) throw Error('cloak not restored');
  const origMat = root.getObjectByName('hull_core').material;
  rig.dispose();
  if (root.getObjectByName('hull_core').material === origMat && origMat === mat)
    console.log('dispose: unlit material released');
  console.log('ALL OK');
}, (e) => { throw Error('GLB parse failed: ' + e); });
