/* BCM4SA Warp sector scene — CPU layout/collisions, Three.js r128 rendering only. */
(function (root) {
  "use strict";

  var Core = root && root.BCMWarpSectorCore;
  var SLOT_COUNT = 8;
  var DEFAULT_SECTOR_LENGTH = 180;
  var DEFAULT_CLUSTER_COUNT = 8;
  var ASSET_NAMES = [
    "cluster_01.glb",
    "cluster_02.glb",
    "cluster_03.glb",
    "cluster_04.glb",
    "cluster_05.glb",
    "cluster_06.glb"
  ];

  function num(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function selfTest() {
    var errors = [];
    if (SLOT_COUNT !== 8) errors.push("scene ring must contain exactly eight slots");
    if (ASSET_NAMES.length !== 6) errors.push("six local asteroid cluster templates must be configured");
    if (DEFAULT_CLUSTER_COUNT !== 8) errors.push("each sector must default to eight cluster instances");
    if (Core && Core.TRAILING_SECTORS + Core.LEADING_SECTORS + 1 !== SLOT_COUNT) {
      errors.push("3/4 window distribution must exactly fill the eight-slot ring");
    }
    return errors;
  }

  function create(options) {
    var c = options || {};
    var THREE = c.THREE || (root && root.THREE);
    var scene = c.scene || null;
    if (!THREE) throw new Error("Warp sector scene requires the existing THREE r128 runtime");
    if (!Core) throw new Error("Warp sector CPU core is not loaded");

    var assetBase = String(c.assetBase || "");
    var sectorLength = Math.max(1, num(c.sectorLength, DEFAULT_SECTOR_LENGTH));
    var clusterCount = clamp(Math.floor(num(c.clusterCount, DEFAULT_CLUSTER_COUNT)), 1, 16);
    var hysteresisRatio = clamp(num(c.hysteresisRatio, Core.DEFAULT_HYSTERESIS_RATIO), 0, 0.20);
    var runSeed = (Number(c.runSeed) >>> 0) || 1;

    var rootGroup = new THREE.Group();
    rootGroup.name = "bcm-warp-sector-window";
    rootGroup.userData.bcmWarpSectorManager = true;

    var slots = Array.from({ length: SLOT_COUNT }, function (_, slotId) {
      return {
        slotId: slotId,
        sectorIndex: null,
        generation: 0,
        seed: 0,
        status: "EMPTY",
        root: null,
        instances: [],
        transforms: [],
        matrices: [],
        collisionSpheres: [],
        template: null
      };
    });

    var windowState = Core.createWindowState();
    var odometer = null;
    var templatePromise = null;
    var templates = [];
    var active = false;
    var destroyed = false;
    var frameCount = 0;
    var rebuildCount = 0;
    var collisionCount = 0;
    var lastError = "";
    var lastContactKey = "";
    var lastContactAt = 0;
    var previousShipWorld = null;
    var shipRadius = Core.DEFAULT_SHIP_RADIUS;
    var tubeRadius = 32;

    var dummy = new THREE.Object3D();
    var worldOrigin = new THREE.Vector3();
    var worldAxis = new THREE.Vector3(0, 0, -1);
    var worldUp = new THREE.Vector3(0, 1, 0);
    var worldRight = new THREE.Vector3(1, 0, 0);
    var referenceUp = new THREE.Vector3(0, 1, 0);
    var basisMatrix = new THREE.Matrix4();
    var groupQuaternion = new THREE.Quaternion();
    var inverseGroupQuaternion = new THREE.Quaternion();
    var previousLocal = new THREE.Vector3();
    var currentLocal = new THREE.Vector3();
    var rockCenterLocal = new THREE.Vector3();
    var correctionLocal = new THREE.Vector3();
    var normalWorld = new THREE.Vector3();
    var correctedWorld = new THREE.Vector3();
    var relativeSegment = new THREE.Vector3();
    var closestPoint = new THREE.Vector3();

    function meshNodes(gltf) {
      var source = gltf && (gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null));
      if (!source || typeof source.traverse !== "function") {
        throw new Error("Asteroid GLB has no scene root");
      }
      source.updateMatrixWorld(true);
      var found = [];
      source.traverse(function (node) {
        if (node && node.isMesh && node.geometry && node.material) found.push(node);
      });
      if (found.length !== 1) {
        throw new Error("Asteroid sector cluster must contain exactly one instancing mesh");
      }
      return found;
    }

    function geometryCollisionSpheres(geometry) {
      var position = geometry && geometry.attributes && geometry.attributes.position;
      if (!position || !position.array) return [];
      var indices = geometry.index && geometry.index.array ? geometry.index.array : null;
      var spheres = Core.componentSpheresFromGeometry(position.array, indices, 1e-4);
      if (spheres.length) return spheres;

      if (typeof geometry.computeBoundingSphere === "function") geometry.computeBoundingSphere();
      var fallback = geometry.boundingSphere;
      if (!fallback) return [];
      return [{
        center: {
          x: fallback.center.x,
          y: fallback.center.y,
          z: fallback.center.z
        },
        radius: fallback.radius
      }];
    }

    function ensureTemplates() {
      if (templatePromise) return templatePromise;
      if (!root || !root.document) {
        return Promise.reject(new Error("GLTFLoader requires the browser document"));
      }

      templatePromise = new Promise(function (resolve, reject) {
        function begin(Loader) {
          if (!Loader) {
            reject(new Error("Local r128 GLTFLoader is unavailable"));
            return;
          }
          var loaded = [];
          var index = 0;

          function next() {
            if (destroyed) {
              reject(new Error("Warp sector manager was destroyed during asset loading"));
              return;
            }
            if (index >= ASSET_NAMES.length) {
              templates = loaded;
              resolve(templates);
              return;
            }

            var file = ASSET_NAMES[index++];
            var loader = new Loader();
            loader.load(fileUrl(file), function (gltf) {
              try {
                var node = meshNodes(gltf)[0];
                var geometry = node.geometry.clone();
                geometry.applyMatrix4(node.matrixWorld);
                if (typeof geometry.computeBoundingSphere === "function") {
                  geometry.computeBoundingSphere();
                }
                var collisionSpheres = geometryCollisionSpheres(geometry);
                if (!collisionSpheres.length) {
                  throw new Error("Asteroid cluster has no collision components: " + file);
                }
                loaded.push({
                  file: file,
                  geometry: geometry,
                  material: node.material,
                  collisionSpheres: collisionSpheres,
                  extent: Core.templateExtentFromSpheres(collisionSpheres)
                });
                next();
              } catch (error) {
                reject(error);
              }
            }, undefined, function (error) {
              reject(new Error(
                "Unable to load local asteroid cluster " + file + ": " +
                (error && error.message ? error.message : "GLB load failed")
              ));
            });
          }

          next();
        }

        if (THREE.GLTFLoader) {
          begin(THREE.GLTFLoader);
          return;
        }

        var loaderUrl = String(c.gltfLoaderUrl || "");
        if (!loaderUrl) {
          reject(new Error("Local r128 GLTFLoader URL is missing"));
          return;
        }
        var existing = root.document.querySelector(
          'script[data-bcm-r128-sector-loader="1"], script[data-bcm-r128-gltf-loader="1"]'
        );
        if (existing) {
          existing.addEventListener("load", function () { begin(THREE.GLTFLoader); }, { once: true });
          existing.addEventListener("error", function () {
            reject(new Error("Local r128 GLTFLoader request failed"));
          }, { once: true });
          return;
        }
        var script = root.document.createElement("script");
        script.src = loaderUrl;
        script.async = true;
        script.dataset.bcmR128SectorLoader = "1";
        script.onload = function () { begin(THREE.GLTFLoader); };
        script.onerror = function () { reject(new Error("Local r128 GLTFLoader request failed")); };
        root.document.head.appendChild(script);
      }).catch(function (error) {
        templatePromise = null;
        lastError = error && error.message ? error.message : String(error);
        throw error;
      });
      return templatePromise;
    }

    function fileUrl(file) {
      return assetBase + file;
    }

    function measureShipRadius(ship) {
      if (!ship || !ship.visual || !THREE.Box3 || !THREE.Sphere) {
        return Core.DEFAULT_SHIP_RADIUS;
      }
      try {
        ship.visual.updateMatrixWorld(true);
        var bounds = new THREE.Box3().setFromObject(ship.visual);
        var sphere = bounds.getBoundingSphere(new THREE.Sphere());
        return clamp(num(sphere.radius, Core.DEFAULT_SHIP_RADIUS), 1.0, 7.0);
      } catch (error) {
        return Core.DEFAULT_SHIP_RADIUS;
      }
    }

    function updateTubeBasis(ship) {
      if (ship && ship.quaternion) {
        referenceUp.set(0, 1, 0).applyQuaternion(ship.quaternion);
      } else {
        referenceUp.set(0, 1, 0);
      }

      referenceUp.addScaledVector(worldAxis, -referenceUp.dot(worldAxis));
      if (referenceUp.lengthSq() < 1e-8) {
        referenceUp.set(1, 0, 0);
        referenceUp.addScaledVector(worldAxis, -referenceUp.dot(worldAxis));
      }
      referenceUp.normalize();

      worldRight.crossVectors(referenceUp, worldAxis).normalize();
      referenceUp.crossVectors(worldAxis, worldRight).normalize();

      basisMatrix.makeBasis(worldRight, referenceUp, worldAxis);
      groupQuaternion.setFromRotationMatrix(basisMatrix);
      inverseGroupQuaternion.copy(groupQuaternion).invert();
      rootGroup.position.copy(worldOrigin);
      rootGroup.quaternion.copy(groupQuaternion);
      rootGroup.updateMatrixWorld(true);
    }

    function worldToTube(position, target) {
      return target.copy(position).sub(worldOrigin).applyQuaternion(inverseGroupQuaternion);
    }

    function tubeToWorld(position, target) {
      return target.copy(position).applyQuaternion(groupQuaternion).add(worldOrigin);
    }

    function removeSlot(slot) {
      if (!slot || !slot.root) {
        if (slot) {
          slot.sectorIndex = null;
          slot.seed = 0;
          slot.status = "EMPTY";
          slot.instances = [];
          slot.transforms = [];
          slot.matrices = [];
          slot.collisionSpheres = [];
          slot.template = null;
        }
        return;
      }
      if (slot.root.parent) slot.root.parent.remove(slot.root);
      slot.root.traverse(function (node) {
        if (!node || !node.userData || node.userData.slotOwned !== true) return;
        if (node.isInstancedMesh && typeof node.dispose === "function") node.dispose();
      });
      slot.sectorIndex = null;
      slot.seed = 0;
      slot.status = "EMPTY";
      slot.root = null;
      slot.instances = [];
      slot.transforms = [];
      slot.matrices = [];
      slot.collisionSpheres = [];
      slot.template = null;
    }

    function clearSlots() {
      slots.forEach(function (slot) {
        slot.generation += 1;
        removeSlot(slot);
      });
      windowState = Core.createWindowState();
    }

    function instantiateSlot(slot, change, generation) {
      if (destroyed || slot.generation !== generation) return false;
      var extents = templates.map(function (template) { return template.extent; });
      var layout = Core.layoutForSector(runSeed, change.sectorIndex, {
        sectorLength: sectorLength,
        clusterCount: clusterCount,
        shipRadius: shipRadius,
        tubeRadius: tubeRadius,
        templateExtents: extents
      });
      var template = templates[layout.templateIndex % templates.length];
      if (!template) throw new Error("Asteroid cluster template is missing");

      var group = new THREE.Group();
      group.name = "warp-sector-" + change.sectorIndex;
      group.userData.slotOwned = true;
      group.userData.slotId = slot.slotId;
      group.userData.sectorIndex = change.sectorIndex;
      group.userData.generation = generation;

      var instances = new THREE.InstancedMesh(
        template.geometry,
        template.material,
        layout.transforms.length
      );
      instances.name = "warp-sector-instances-" + change.sectorIndex;
      instances.userData.slotOwned = true;
      instances.userData.sharedTemplate = template.file;
      instances.frustumCulled = false;
      if (instances.instanceMatrix && typeof instances.instanceMatrix.setUsage === "function") {
        instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      }

      group.add(instances);
      var matrices = [];
      layout.transforms.forEach(function (transform, index) {
        dummy.position.set(
          transform.radius * Math.cos(transform.angle),
          transform.radius * Math.sin(transform.angle),
          change.sectorIndex * sectorLength + transform.axial
        );
        dummy.rotation.set(
          transform.rotationX,
          transform.rotationY,
          transform.rotationZ,
          "XYZ"
        );
        dummy.scale.setScalar(transform.scale);
        dummy.updateMatrix();
        instances.setMatrixAt(index, dummy.matrix);
        matrices.push(dummy.matrix.clone());
      });

      instances.count = layout.transforms.length;
      instances.instanceMatrix.needsUpdate = true;
      slot.root = group;
      slot.instances = [instances];
      slot.transforms = layout.transforms;
      slot.matrices = matrices;
      slot.collisionSpheres = template.collisionSpheres;
      slot.template = template;
      slot.sectorIndex = change.sectorIndex;
      slot.seed = layout.seed;
      slot.status = "READY";
      rootGroup.add(group);
      rebuildCount += 1;
      return true;
    }

    function assignChanges(plan) {
      if (!plan.changes.length) return Promise.resolve(plan);
      var reservations = plan.changes.map(function (change) {
        var slot = slots[change.slotIndex];
        var generation = slot.generation + 1;
        removeSlot(slot);
        slot.generation = generation;
        slot.sectorIndex = change.sectorIndex;
        slot.seed = change.seed;
        slot.status = "BUILDING";
        return { change: change, slot: slot, generation: generation };
      });

      Core.commitWindowPlan(windowState, plan);
      return ensureTemplates().then(function () {
        if (destroyed || !active) return plan;
        reservations.forEach(function (reservation) {
          var slot = reservation.slot;
          if (slot.generation !== reservation.generation ||
              slot.sectorIndex !== reservation.change.sectorIndex ||
              slot.status !== "BUILDING") return;
          instantiateSlot(slot, reservation.change, reservation.generation);
        });
        return plan;
      }).catch(function (error) {
        reservations.forEach(function (reservation) {
          if (reservation.slot.generation === reservation.generation &&
              reservation.slot.status === "BUILDING") {
            reservation.slot.status = "ERROR";
          }
        });
        lastError = error && error.message ? error.message : String(error);
        throw error;
      });
    }

    function resetOdometer(frame) {
      var ship = frame.ship;
      var originMesh = frame.originMesh;
      if (!ship || !ship.position || !originMesh ||
          typeof originMesh.getWorldPosition !== "function") {
        throw new Error("Warp sector origin requires the live ONICSS station mesh and ship position");
      }

      originMesh.getWorldPosition(worldOrigin);
      worldAxis.set(0, 0, -1);
      if (ship.quaternion) worldAxis.applyQuaternion(ship.quaternion);
      if (ship.velocity && typeof ship.velocity.lengthSq === "function" &&
          ship.velocity.lengthSq() > 0.25) {
        worldAxis.copy(ship.velocity).normalize();
      } else {
        worldAxis.normalize();
      }

      odometer = Core.createOdometer({
        origin: { x: worldOrigin.x, y: worldOrigin.y, z: worldOrigin.z },
        position: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
        axis: { x: worldAxis.x, y: worldAxis.y, z: worldAxis.z }
      });
      shipRadius = measureShipRadius(ship);
      tubeRadius = clamp(
        shipRadius * 10,
        Core.DEFAULT_TUBE_RADIUS_MIN,
        Core.DEFAULT_TUBE_RADIUS_MAX
      );
      updateTubeBasis(ship);
      windowState = Core.createWindowState();
      previousShipWorld = ship.position.clone();
    }

    function updateMatrices() {
      slots.forEach(function (slot) {
        if (slot.status !== "READY" || !slot.instances.length) return;
        var mesh = slot.instances[0];
        slot.transforms.forEach(function (transform, index) {
          dummy.position.set(
            transform.radius * Math.cos(transform.angle),
            transform.radius * Math.sin(transform.angle),
            slot.sectorIndex * sectorLength + transform.axial
          );
          dummy.rotation.set(
            transform.rotationX,
            transform.rotationY,
            transform.rotationZ,
            "XYZ"
          );
          dummy.scale.setScalar(transform.scale);
          dummy.updateMatrix();
          if (slot.matrices[index]) slot.matrices[index].copy(dummy.matrix);
          mesh.setMatrixAt(index, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      });
    }

    function maxCollisionReach() {
      var maxRock = 0;
      templates.forEach(function (template) {
        (template.collisionSpheres || []).forEach(function (sphere) {
          maxRock = Math.max(maxRock, sphere.radius * 1.28);
        });
      });
      return shipRadius + maxRock + 0.15;
    }

    function detectCollision(ship, previousPosition) {
      if (!ship || !ship.position || !ship.velocity || !previousPosition) return null;
      worldToTube(previousPosition, previousLocal);
      worldToTube(ship.position, currentLocal);

      var movement = currentLocal.distanceTo(previousLocal);
      if (movement > sectorLength * 2) previousLocal.copy(currentLocal);

      var reach = maxCollisionReach();
      var minSector = Math.floor((Math.min(previousLocal.z, currentLocal.z) - reach) / sectorLength);
      var maxSector = Math.floor((Math.max(previousLocal.z, currentLocal.z) + reach) / sectorLength);
      if (maxSector - minSector >= SLOT_COUNT) {
        minSector = Math.floor(currentLocal.z / sectorLength) - 1;
        maxSector = minSector + 2;
        previousLocal.copy(currentLocal);
      }

      var best = null;
      for (var sector = minSector; sector <= maxSector; sector += 1) {
        var slot = slots[Core.slotIndexFor(sector)];
        if (!slot || slot.sectorIndex !== sector || slot.status !== "READY") continue;
        var spheres = slot.collisionSpheres || [];
        var transforms = slot.transforms || [];
        var matrices = slot.matrices || [];

        for (var instanceIndex = 0; instanceIndex < matrices.length; instanceIndex += 1) {
          var matrix = matrices[instanceIndex];
          var transform = transforms[instanceIndex];
          if (!matrix || !transform) continue;

          for (var componentIndex = 0; componentIndex < spheres.length; componentIndex += 1) {
            var sphere = spheres[componentIndex];
            rockCenterLocal.set(
              sphere.center.x,
              sphere.center.y,
              sphere.center.z
            ).applyMatrix4(matrix);

            var combinedRadius = shipRadius + sphere.radius * transform.scale + 0.10;
            var depthGap = Core.axialDistanceToSegment(
              rockCenterLocal.z,
              previousLocal.z,
              currentLocal.z
            );
            if (depthGap > combinedRadius) continue;

            var result = Core.sweepSphere(
              previousLocal,
              currentLocal,
              { x: rockCenterLocal.x, y: rockCenterLocal.y, z: rockCenterLocal.z },
              combinedRadius
            );
            if (!result.hit) continue;
            if (best && result.t >= best.result.t) continue;

            best = {
              key: sector + ":" + instanceIndex + ":" + componentIndex,
              sectorIndex: sector,
              slotId: slot.slotId,
              instanceIndex: instanceIndex,
              componentIndex: componentIndex,
              center: { x: rockCenterLocal.x, y: rockCenterLocal.y, z: rockCenterLocal.z },
              radius: combinedRadius,
              result: result
            };
          }
        }
      }

      if (!best) return null;

      var now = root && root.performance && typeof root.performance.now === "function"
        ? root.performance.now()
        : Date.now();
      var sameContact = best.key === lastContactKey && now - lastContactAt < 260;

      correctionLocal.copy(best.result.normal).multiplyScalar(best.radius + 0.03);
      correctionLocal.add(rockCenterLocal.set(
        best.center.x,
        best.center.y,
        best.center.z
      ));

      tubeToWorld(correctionLocal, correctedWorld);
      ship.position.copy(correctedWorld);

      normalWorld.set(
        best.result.normal.x,
        best.result.normal.y,
        best.result.normal.z
      ).applyQuaternion(groupQuaternion).normalize();

      var normalSpeed = ship.velocity.dot(normalWorld);
      if (normalSpeed < 0) {
        ship.velocity.addScaledVector(normalWorld, -(1 + 0.22) * normalSpeed);
      }
      ship.velocity.multiplyScalar(0.88);

      if (!sameContact) {
        lastContactKey = best.key;
        lastContactAt = now;
        collisionCount += 1;
        best.force = clamp(
          Math.max(Math.abs(normalSpeed), ship.velocity.length() * 0.35) /
            Math.max(1, num(ship.maxSpeed, 18)),
          0.24,
          0.62
        );
      } else {
        best.force = 0;
      }
      return best;
    }

    function tick(frame) {
      if (destroyed) return null;
      var f = frame || {};
      var ship = f.ship;
      if (f.paused) return null;

      if (!f.active) {
        if (active) {
          active = false;
          clearSlots();
          odometer = null;
          previousShipWorld = null;
          lastContactKey = "";
          lastContactAt = 0;
        }
        return null;
      }

      if (!scene || !ship || !ship.position || !ship.velocity) return null;
      if (!active || !odometer) {
        active = true;
        runSeed = (Number(f.runSeed) >>> 0) || runSeed || 1;
        resetOdometer(f);
      }

      var previousForCollision = previousShipWorld
        ? previousShipWorld.clone()
        : ship.position.clone();

      updateTubeBasis(ship);
      Core.advanceOdometer(odometer, {
        dt: f.dt,
        position: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
        velocity: { x: ship.velocity.x, y: ship.velocity.y, z: ship.velocity.z }
      });

      var plan = Core.planWindow(windowState, odometer.traveled, {
        sectorLength: sectorLength,
        hysteresisRatio: hysteresisRatio,
        runSeed: runSeed
      });
      if (plan.changes.length) {
        assignChanges(plan).catch(function (error) {
          lastError = error && error.message ? error.message : String(error);
        });
      }

      if (!rootGroup.parent) scene.add(rootGroup);
      updateMatrices();

      var collision = detectCollision(ship, previousForCollision);
      if (collision) {
        Core.advanceOdometer(odometer, {
          position: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
          velocity: { x: ship.velocity.x, y: ship.velocity.y, z: ship.velocity.z }
        });
        if (ship.visual && typeof ship.visual.position.copy === "function") {
          ship.visual.position.copy(ship.position);
          ship.visual.quaternion.copy(ship.quaternion);
        }
        if (collision.force > 0 && typeof f.onCollision === "function") {
          try { f.onCollision(collision); } catch (error) {}
        }
      }

      previousShipWorld = ship.position.clone();
      frameCount += 1;
      return {
        origin: odometer.origin,
        drift: odometer.drift,
        traveled: odometer.traveled,
        sector: plan.currentSector,
        anchorSector: plan.anchorSector,
        residentSectors: plan.sectors.slice(),
        residentSlotCount: SLOT_COUNT,
        frameCount: frameCount,
        rebuildCount: rebuildCount,
        collisionCount: collisionCount,
        collision: collision
      };
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      active = false;
      clearSlots();
      if (rootGroup.parent) rootGroup.parent.remove(rootGroup);

      var seenMaterials = new Set();
      var seenTextures = new Set();
      templates.forEach(function (template) {
        if (template.geometry && typeof template.geometry.dispose === "function") {
          template.geometry.dispose();
        }
        var materials = Array.isArray(template.material) ? template.material : [template.material];
        materials.forEach(function (material) {
          if (!material || seenMaterials.has(material)) return;
          seenMaterials.add(material);
          Object.keys(material).forEach(function (key) {
            var texture = material[key];
            if (texture && texture.isTexture &&
                typeof texture.dispose === "function" && !seenTextures.has(texture)) {
              seenTextures.add(texture);
              texture.dispose();
            }
          });
          if (typeof material.dispose === "function") material.dispose();
        });
      });

      templates = [];
      templatePromise = null;
      odometer = null;
      previousShipWorld = null;
    }

    function snapshot() {
      return {
        active: active,
        odometer: odometer ? {
          origin: { x: odometer.origin.x, y: odometer.origin.y, z: odometer.origin.z },
          drift: { x: odometer.drift.x, y: odometer.drift.y, z: odometer.drift.z },
          traveled: odometer.traveled,
          axis: { x: odometer.axis.x, y: odometer.axis.y, z: odometer.axis.z }
        } : null,
        tubeRadius: tubeRadius,
        shipRadius: shipRadius,
        slots: slots.map(function (slot) {
          return {
            slotId: slot.slotId,
            sectorIndex: slot.sectorIndex,
            generation: slot.generation,
            seed: slot.seed,
            status: slot.status,
            instanceCount: slot.transforms.length,
            collisionSphereCount: slot.collisionSpheres.length
          };
        }),
        frameCount: frameCount,
        rebuildCount: rebuildCount,
        collisionCount: collisionCount,
        lastError: lastError
      };
    }

    if (scene) scene.add(rootGroup);
    return {
      tick: tick,
      destroy: destroy,
      snapshot: snapshot,
      getSlotCount: function () { return slots.length; },
      getTemplates: function () { return templates.slice(); }
    };
  }

  var api = {
    SLOT_COUNT: SLOT_COUNT,
    SECTOR_LENGTH: DEFAULT_SECTOR_LENGTH,
    ASSET_NAMES: ASSET_NAMES.slice(),
    create: create,
    selfTest: selfTest
  };

  if (root) {
    root.BCMWarpSectorScene = api;
    root.BCMWarpSectorSceneManager = root.BCMWarpSectorSceneManager || null;
    root.BCMWarpSectorSceneFrame = function (frame) {
      if (!root.BCMWarpSectorSceneManager) {
        if (!frame || !frame.active || frame.paused) return null;
        root.BCMWarpSectorSceneManager = create({
          THREE: frame.THREE,
          scene: frame.scene,
          assetBase: frame.assetBase ||
            (root.BCMMiniSimConfig && root.BCMMiniSimConfig.warpSectorAssetBase) || "",
          gltfLoaderUrl: frame.gltfLoaderUrl ||
            (root.BCMMiniSimConfig && root.BCMMiniSimConfig.gltfLoaderUrl) || "",
          runSeed: frame.runSeed
        });
      }
      return root.BCMWarpSectorSceneManager.tick(frame);
    };
    root.BCMWarpSectorSceneDestroy = function () {
      if (!root.BCMWarpSectorSceneManager) return;
      root.BCMWarpSectorSceneManager.destroy();
      root.BCMWarpSectorSceneManager = null;
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);