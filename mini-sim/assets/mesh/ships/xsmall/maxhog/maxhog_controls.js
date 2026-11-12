/* Shared Max Hog vehicle controller.
 * The same API is used by Mini-Sim space flight and First Planet ground/flight.
 * The model's four wheel pods contain their own tire meshes and exhaust flames.
 */
(function (scope) {
  "use strict";

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, Number(value) || 0));
  }

  scope.createMaxhogControls = function (root, options) {
    if (!root || !root.getObjectByName) throw new Error("Max Hog root missing");
    options = options || {};

    var Vector3 = root.position.constructor;
    var Quaternion = root.quaternion.constructor;
    var sides = ["front_left", "front_right", "rear_left", "rear_right"];
    var pods = [];
    var wheelRadius = 0.7;
    var mode = options.mode === "flight" ? "flight" : "pad";
    var groundSpeed = 0;
    var forward = 0;
    var vertical = 0;
    var targetThrust = 0;
    var currentThrust = 0;
    var wheelAngle = 0;
    var lastTime = 0;
    var disposed = false;

    function vector(x, y, z) {
      return new Vector3(x, y, z);
    }

    function worldQuaternion(object) {
      return object.getWorldQuaternion(new Quaternion());
    }

    function readExhaustAxis(pivot, flame) {
      root.updateMatrixWorld(true);
      var geometry = flame.geometry;
      if (geometry && !geometry.boundingBox && geometry.computeBoundingBox) geometry.computeBoundingBox();
      var centre = vector(0, 0, 0);
      if (geometry && geometry.boundingBox && geometry.boundingBox.getCenter) {
        geometry.boundingBox.getCenter(centre);
        flame.localToWorld(centre);
      } else {
        centre = flame.getWorldPosition(centre);
      }
      var origin = pivot.getWorldPosition(vector(0, 0, 0));
      var axisWorld = centre.sub(origin);
      if (axisWorld.lengthSq() < 1e-8) axisWorld.set(0, 0, 1);
      axisWorld.normalize();

      var parent = pivot.parent || root;
      var parentRotation = worldQuaternion(parent);
      axisWorld.applyQuaternion(parentRotation.invert()).normalize();
      return axisWorld;
    }

    sides.forEach(function (side) {
      var pivot = root.getObjectByName("wheel_" + side);
      var flame = root.getObjectByName("flame_" + side);
      if (!pivot || !flame) return;

      var wheels = [];
      pivot.traverse(function (node) {
        if (!node.isMesh || !/__(tires|wheel_hubs|wheel_centers|wheel_tread)_/i.test(node.name || "")) return;
        wheels.push({
          mesh: node,
          rest: node.quaternion.clone(),
        });
      });

      var flameMeshes = [];
      flame.traverse(function (node) {
        if (!node.isMesh) return;
        var materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(function (material) {
          if (!material) return;
          material.transparent = true;
          material.depthWrite = false;
        });
        flameMeshes.push(node);
      });

      pods.push({
        pivot: pivot,
        flame: flame,
        rest: pivot.quaternion.clone(),
        exhaustAxis: readExhaustAxis(pivot, flame),
        wheels: wheels,
        flameRestScale: flame.scale.clone(),
        flameMeshes: flameMeshes,
      });
      flame.visible = false;
    });

    if (pods.length !== 4) throw new Error("Max Hog requires four wheel/thruster pods");

    function applyPose(dt) {
      if (disposed) return;
      var flight = mode === "flight";
      var blend = Math.min(1, Math.max(0, dt) * 8.5);
      var desiredThrust = flight ? targetThrust : 0;
      currentThrust += (desiredThrust - currentThrust) * Math.min(1, Math.max(0, dt) * 5.5);
      var desiredExhaust = vector(forward * 0.55, vertical > 0.04 ? -1 : vertical < -0.04 ? 1 : -1, forward > 0.02 ? 1 : forward < -0.02 ? -1 : 0);
      if (desiredExhaust.lengthSq() < 1e-8) desiredExhaust.set(0, -1, 0);
      desiredExhaust.normalize();
      var rootRotation = worldQuaternion(root);

      pods.forEach(function (pod) {
        pod.flame.visible = flight && currentThrust > 0.015;
        pod.flame.scale.copy(pod.flameRestScale).multiplyScalar(0.72 + currentThrust * 0.48);

        if (flight) {
          var targetWorld = desiredExhaust.clone().applyQuaternion(rootRotation);
          var parent = pod.pivot.parent || root;
          var parentRotation = worldQuaternion(parent);
          targetWorld.applyQuaternion(parentRotation.invert()).normalize();
          var delta = new Quaternion().setFromUnitVectors(pod.exhaustAxis, targetWorld);
          var targetRotation = delta.multiply(pod.rest);
          pod.pivot.quaternion.slerp(targetRotation, blend);
        } else {
          pod.pivot.quaternion.slerp(pod.rest, blend);
        }

        pod.wheels.forEach(function (wheel) {
          if (flight || Math.abs(groundSpeed) < 0.015) {
            wheel.mesh.quaternion.slerp(wheel.rest, blend);
            return;
          }
          var roll = new Quaternion().setFromAxisAngle(vector(0, 0, 1), wheelAngle);
          var targetWheel = wheel.rest.clone().multiply(roll);
          wheel.mesh.quaternion.slerp(targetWheel, blend);
        });
      });
    }

    var api = {
      setMode: function (name) {
        var nextMode = name === "flight" || name === "load" ? name : "pad";
        if (mode === nextMode) return api;
        mode = nextMode;
        if (mode !== "flight") targetThrust = 0;
        applyPose(0.22);
        return api;
      },
      getMode: function () { return mode; },
      setThrust: function (value) {
        targetThrust = mode === "flight" ? clamp(value, 0, 1) : 0;
        return api;
      },
      getThrust: function () { return currentThrust; },
      setGroundSpeed: function (value) {
        groundSpeed = mode === "pad" ? clamp(value, -40, 40) : 0;
        return api;
      },
      setFlightMotion: function (forwardValue, verticalValue) {
        forward = clamp(forwardValue, -1, 1);
        vertical = clamp(verticalValue, -1, 1);
        return api;
      },
      update: function (time) {
        if (disposed) return api;
        var now = Number(time) || 0;
        var dt = lastTime ? Math.min(0.05, Math.max(0, now - lastTime)) : 1 / 60;
        lastTime = now;
        wheelAngle += (groundSpeed * dt) / wheelRadius;
        applyPose(dt);
        return api;
      },
      getState: function () {
        return { mode: mode, thrust: +currentThrust.toFixed(3), groundSpeed: +groundSpeed.toFixed(3), forward: forward, vertical: vertical };
      },
      dispose: function () {
        if (disposed) return;
        mode = "pad";
        targetThrust = 0;
        currentThrust = 0;
        groundSpeed = 0;
        pods.forEach(function (pod) {
          pod.flame.visible = false;
          pod.flame.scale.copy(pod.flameRestScale);
          pod.pivot.quaternion.copy(pod.rest);
          pod.wheels.forEach(function (wheel) { wheel.mesh.quaternion.copy(wheel.rest); });
        });
        disposed = true;
      },
    };

    applyPose(0.22);
    return api;
  };
})(typeof window !== "undefined" ? window : this);
