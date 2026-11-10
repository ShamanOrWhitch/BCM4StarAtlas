// Three.js r128; call once immediately after GLTFLoader loads the scene.
// +X is front, +Y up. Angle 0 = road, 1 = horizontal flight.
function createMaxhogControls(root) {
  var ids = ['front_left', 'front_right', 'rear_left', 'rear_right'];
  var wheels = {}, flames = {};
  ids.forEach(function (id) {
    wheels[id] = root.getObjectByName('wheel_' + id);
    flames[id] = root.getObjectByName('flame_' + id);
    if (!wheels[id] || !flames[id]) throw new Error('Missing Maxhog node: ' + id);
    flames[id].visible = false;
  });
  function wheel(id, amount, thrust) {
    if (!wheels[id]) throw new Error('Unknown wheel: ' + id);
    amount = Math.max(0, Math.min(1, amount));
    var direction = id.indexOf('_left') !== -1 ? -1 : 1;
    wheels[id].rotation.x = direction * amount * Math.PI / 2;
    flames[id].visible = Boolean(thrust);
  }
  function all(amount, thrust) { ids.forEach(function (id) { wheel(id, amount, thrust); }); }
  all(0, false);
  return { wheel: wheel, all: all, wheels: wheels, flames: flames };
}
// Usage: var controls = createMaxhogControls(gltf.scene);
// controls.all(0, false);  // road
// controls.all(1, false);  // wheels unfolded, thrust off
// controls.all(1, true);   // flight
// controls.wheel('front_left', 0.6, false); // individual setting
// Interpolate the amount in your own animation loop. Do not enable thrust on road.
