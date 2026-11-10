// Three.js r128. Use ONLY with x5_*_rig.glb; call before adding scene to renderer.
// Local coordinates: +X forward, +Y up. Angles in radians.
function createX5Controls(root) {
  var ids = ['front_left','front_right','rear_left','rear_right'];
  var arms = {}, pods = {}, flames = {};
  ids.forEach(function(id) {
    arms[id] = root.getObjectByName('arm_' + id);
    pods[id] = root.getObjectByName('pod_' + id);
    if (!arms[id] || !pods[id]) throw new Error('Missing X5 joint: ' + id);
    arms[id].rotation.order = 'ZYX';
    pods[id].rotation.order = 'ZYX';
    flames[id] = [];
    pods[id].traverse(function(node) {
      if (node.name.indexOf('__engine_flame_') !== -1) {
        node.visible = false; flames[id].push(node);
      }
    });
  });
  function setJoint(id, part, angles) {
    var obj = part === 'arm' ? arms[id] : part === 'pod' ? pods[id] : null;
    if (!obj) throw new Error('Unknown joint: ' + id + '/' + part);
    obj.rotation.set(angles.x || 0, angles.y || 0, angles.z || 0, 'ZYX');
  }
  function setFlame(id, visible) {
    if (!flames[id]) throw new Error('Unknown platform: ' + id);
    flames[id].forEach(function(node) { node.visible = !!visible; });
  }
  function ground() {
    ids.forEach(function(id) {
      setJoint(id, 'arm', {}); setJoint(id, 'pod', {}); setFlame(id, false);
    });
  }
  function attack() {
    ids.forEach(function(id) {
      var side = id.indexOf('_left') >= 0 ? -1 : 1;
      var front = id.indexOf('front_') === 0;
      setJoint(id, 'arm', {x: -side * (front ? 1.02 : -0.52)});
      setJoint(id, 'pod', {y: front ? 0 : Math.PI, z: front ? 0.52 : -0.12});
      setFlame(id, false);
    });
  }
  ground();
  return {setJoint:setJoint, setFlame:setFlame, ground:ground, attack:attack, arms:arms, pods:pods};
}
// var x5 = createX5Controls(gltf.scene); scene.add(gltf.scene);
// x5.attack();  // approximate attack end pose
// x5.ground();  // ground end pose
// x5.setJoint('front_left', 'pod', {x:0, y:Math.PI/2, z:0});
// Interpolate angles yourself for transitions. No collision/safety checks.
