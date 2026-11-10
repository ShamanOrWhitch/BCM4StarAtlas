/* Three.js r128. Load the eight GLBs with GLTFLoader first, then pass
   their gltf.scene objects to createFeistAsteroidField. No network calls. */
(function (global) {
  function createFeistAsteroidField(THREE, scenes, options) {
    options = options || {};
    if (!THREE || !scenes || !scenes.length) throw new Error('Supply THREE and loaded asteroid scenes');
    var seed = (options.seed == null ? 12345 : options.seed) >>> 0;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    var count = Math.max(0, Math.floor(options.count == null ? 48 : options.count));
    var width = options.width == null ? 100 : options.width;
    var height = options.height == null ? 35 : options.height;
    var depth = options.depth == null ? 100 : options.depth;
    var minScale = options.minScale == null ? 0.7 : options.minScale;
    var maxScale = options.maxScale == null ? 1.3 : options.maxScale;
    var buckets = scenes.map(function () { return []; });
    var tmp = new THREE.Object3D();
    for (var i = 0; i < count; i++) {
      var choice = Math.floor(rnd() * scenes.length);
      tmp.position.set((rnd() - 0.5) * width, (rnd() - 0.5) * height, (rnd() - 0.5) * depth);
      tmp.rotation.set(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2);
      var scale = minScale + rnd() * (maxScale - minScale);
      tmp.scale.setScalar(scale); tmp.updateMatrix(); buckets[choice].push(tmp.matrix.clone());
    }
    var group = new THREE.Group(); group.name = 'FeistAsteroidField';
    scenes.forEach(function (scene, index) {
      scene.updateMatrixWorld(true);
      scene.traverse(function (mesh) {
        if (!mesh.isMesh || !buckets[index].length) return;
        var instances = new THREE.InstancedMesh(mesh.geometry, mesh.material, buckets[index].length);
        var matrix = new THREE.Matrix4();
        buckets[index].forEach(function (placement, j) {
          matrix.multiplyMatrices(placement, mesh.matrixWorld); instances.setMatrixAt(j, matrix);
        });
        instances.instanceMatrix.needsUpdate = true;
        /* Instances are spread across the field; avoid culling against a single
           source-mesh bounding sphere in older Three.js versions. */
        instances.frustumCulled = false; group.add(instances);
      });
    });
    return group;
  }
  global.createFeistAsteroidField = createFeistAsteroidField;
})(typeof window !== 'undefined' ? window : globalThis);
