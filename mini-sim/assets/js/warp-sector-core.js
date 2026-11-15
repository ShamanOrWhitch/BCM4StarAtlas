/* BCM4SA Warp sector math — CPU-only, browser/THREE independent. */
(function (root) {
  "use strict";

  var SLOT_COUNT = 8;
  var TRAILING_SECTORS = 3;
  var LEADING_SECTORS = 4;
  var DEFAULT_SECTOR_LENGTH = 180;
  var DEFAULT_HYSTERESIS_RATIO = 0.05;
  var DEFAULT_CLUSTER_COUNT = 8;
  var DEFAULT_SHIP_RADIUS = 2.5;
  var DEFAULT_TUBE_RADIUS_MIN = 30;
  var DEFAULT_TUBE_RADIUS_MAX = 48;
  var MIN_WALL_CLEARANCE = 0.5;
  var MIN_SCALE = 0.80;
  var MAX_SCALE = 1.28;
  var TAU = Math.PI * 2;

  function finiteNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function vector(value, fallback) {
    var s = value || fallback || {};
    return {
      x: finiteNumber(s.x, 0),
      y: finiteNumber(s.y, 0),
      z: finiteNumber(s.z, 0)
    };
  }

  function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  function subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  function scale(a, n) {
    return { x: a.x * n, y: a.y * n, z: a.z * n };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function length(a) {
    return Math.sqrt(dot(a, a));
  }

  function normalize(a) {
    var n = length(a);
    return !Number.isFinite(n) || n < 1e-9
      ? { x: 0, y: 0, z: -1 }
      : scale(a, 1 / n);
  }

  function positiveModulo(value, modulo) {
    var size = Math.max(1, Math.floor(finiteNumber(modulo, SLOT_COUNT)));
    var integer = Math.floor(finiteNumber(value, 0));
    return ((integer % size) + size) % size;
  }

  function sectorIndexFor(traveled, sectorLength) {
    var l = finiteNumber(sectorLength, DEFAULT_SECTOR_LENGTH);
    if (l <= 0) l = DEFAULT_SECTOR_LENGTH;
    return Math.floor(finiteNumber(traveled, 0) / l);
  }

  function slotIndexFor(sectorIndex) {
    return positiveModulo(sectorIndex, SLOT_COUNT);
  }

  /* 32-bit avalanche mixer. Negative sector numbers intentionally wrap as uint32. */
  function mix32(value) {
    var x = Number(value) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return x >>> 0;
  }

  function hashSeed(value) {
    var text = String(value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return mix32(hash) || 1;
  }

  function seedForSector(runSeed, sectorIndex) {
    var base = Number(runSeed) >>> 0;
    var sector = Math.trunc(finiteNumber(sectorIndex, 0));
    return mix32(base ^ Math.imul(sector, 0x9e3779b1) ^ 0x57415250) || 1;
  }

  function randomFrom(seed) {
    var state = (Number(seed) >>> 0) || 1;
    return function () {
      state += 0x6D2B79F5;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createOdometer(options) {
    var c = options || {};
    var origin = vector(c.origin);
    var position = vector(c.position, origin);
    var drift = subtract(position, origin);
    var axis = normalize(vector(c.axis, { x: 0, y: 0, z: -1 }));
    var traveled = Number.isFinite(Number(c.traveled))
      ? Number(c.traveled)
      : dot(drift, axis);
    return { origin: origin, drift: drift, traveled: traveled, axis: axis };
  }

  function advanceOdometer(odometer, telemetry) {
    if (!odometer || !odometer.origin || !odometer.axis) return odometer;
    var f = telemetry || {};
    var fallback = add(
      odometer.drift,
      scale(vector(f.velocity), Math.max(0, finiteNumber(f.dt, 0)))
    );
    var position = f.position != null
      ? vector(f.position)
      : add(odometer.origin, fallback);
    var drift = subtract(position, odometer.origin);
    odometer.drift = drift;
    odometer.traveled = dot(drift, odometer.axis);
    return odometer;
  }

  function createWindowState() {
    return {
      anchorSector: null,
      slots: Array.from({ length: SLOT_COUNT }, function () { return null; })
    };
  }

  function resolveAnchorSector(previousAnchor, traveled, sectorLength, hysteresisRatio) {
    var current = sectorIndexFor(traveled, sectorLength);
    if (previousAnchor == null || !Number.isFinite(Number(previousAnchor))) return current;
    var previous = Math.trunc(Number(previousAnchor));
    var ratio = clamp(finiteNumber(hysteresisRatio, DEFAULT_HYSTERESIS_RATIO), 0, 0.20);
    var h = sectorLength * ratio;

    if (current > previous) {
      var forward = Math.floor((traveled - h) / sectorLength);
      return Math.max(previous, Math.min(current, forward));
    }
    if (current < previous) {
      var backward = Math.floor((traveled + h) / sectorLength);
      return Math.min(previous, Math.max(current, backward));
    }
    return previous;
  }

  function planWindow(state, traveled, options) {
    var c = options || {};
    var l = Math.max(1, finiteNumber(c.sectorLength, DEFAULT_SECTOR_LENGTH));
    var current = sectorIndexFor(traveled, l);
    var anchor = resolveAnchorSector(
      state && state.anchorSector,
      finiteNumber(traveled, 0),
      l,
      c.hysteresisRatio
    );
    var existing = state && Array.isArray(state.slots) ? state.slots : [];
    var sectors = [];
    var changes = [];
    var retained = [];

    for (var offset = -TRAILING_SECTORS; offset <= LEADING_SECTORS; offset += 1) {
      var sector = anchor + offset;
      var slot = slotIndexFor(sector);
      var previous = existing[slot] == null ? null : Number(existing[slot]);
      sectors.push(sector);
      if (previous !== sector) {
        changes.push({
          slotIndex: slot,
          previousSector: previous,
          sectorIndex: sector,
          seed: seedForSector(c.runSeed || 1, sector)
        });
      } else {
        retained.push(sector);
      }
    }

    return {
      currentSector: current,
      anchorSector: anchor,
      sectors: sectors,
      changes: changes,
      retained: retained,
      slotCount: SLOT_COUNT
    };
  }

  function commitWindowPlan(state, plan) {
    if (!state || !plan) return state;
    state.anchorSector = plan.anchorSector;
    plan.changes.forEach(function (change) {
      state.slots[change.slotIndex] = change.sectorIndex;
    });
    return state;
  }

  function componentSpheresFromGeometry(positions, indices, epsilon) {
    var source = positions && positions.array ? positions.array : positions;
    if (!source || typeof source.length !== "number") return [];
    var vertexCount = Math.floor(source.length / 3);
    if (vertexCount < 3) return [];

    var eps = Math.max(1e-7, finiteNumber(epsilon, 1e-4));
    var canonical = new Int32Array(vertexCount);
    var canonicalPositions = [];
    var keyToCanonical = new Map();

    for (var vertex = 0; vertex < vertexCount; vertex += 1) {
      var x = finiteNumber(source[vertex * 3], 0);
      var y = finiteNumber(source[vertex * 3 + 1], 0);
      var z = finiteNumber(source[vertex * 3 + 2], 0);
      var key = Math.round(x / eps) + "," + Math.round(y / eps) + "," + Math.round(z / eps);
      var id = keyToCanonical.get(key);
      if (id == null) {
        id = canonicalPositions.length;
        keyToCanonical.set(key, id);
        canonicalPositions.push({ x: x, y: y, z: z });
      }
      canonical[vertex] = id;
    }

    var uniqueCount = canonicalPositions.length;
    if (uniqueCount < 3) return [];
    var parent = new Int32Array(uniqueCount);
    var rank = new Uint8Array(uniqueCount);
    for (var init = 0; init < uniqueCount; init += 1) parent[init] = init;

    function find(a) {
      var node = a;
      while (parent[node] !== node) {
        parent[node] = parent[parent[node]];
        node = parent[node];
      }
      return node;
    }

    function union(a, b) {
      var ra = find(a);
      var rb = find(b);
      if (ra === rb) return;
      if (rank[ra] < rank[rb]) parent[ra] = rb;
      else if (rank[ra] > rank[rb]) parent[rb] = ra;
      else {
        parent[rb] = ra;
        rank[ra] += 1;
      }
    }

    var indexSource = indices && indices.array ? indices.array : indices;
    var triangleCount = indexSource && typeof indexSource.length === "number"
      ? Math.floor(indexSource.length / 3)
      : Math.floor(vertexCount / 3);

    for (var tri = 0; tri < triangleCount; tri += 1) {
      var ia = indexSource ? Math.floor(indexSource[tri * 3]) : tri * 3;
      var ib = indexSource ? Math.floor(indexSource[tri * 3 + 1]) : tri * 3 + 1;
      var ic = indexSource ? Math.floor(indexSource[tri * 3 + 2]) : tri * 3 + 2;
      if (ia < 0 || ib < 0 || ic < 0 ||
          ia >= vertexCount || ib >= vertexCount || ic >= vertexCount) continue;
      var a = canonical[ia];
      var b = canonical[ib];
      var c = canonical[ic];
      union(a, b);
      union(b, c);
    }

    var groups = new Map();
    for (var p = 0; p < uniqueCount; p += 1) {
      var componentRoot = find(p);
      var group = groups.get(componentRoot);
      if (!group) {
        group = [];
        groups.set(componentRoot, group);
      }
      group.push(canonicalPositions[p]);
    }

    var spheres = [];
    groups.forEach(function (points) {
      if (points.length < 3) return;
      var center = { x: 0, y: 0, z: 0 };
      points.forEach(function (point) {
        center.x += point.x;
        center.y += point.y;
        center.z += point.z;
      });
      center.x /= points.length;
      center.y /= points.length;
      center.z /= points.length;

      var radiusSq = 0;
      points.forEach(function (point) {
        var dx = point.x - center.x;
        var dy = point.y - center.y;
        var dz = point.z - center.z;
        radiusSq = Math.max(radiusSq, dx * dx + dy * dy + dz * dz);
      });
      spheres.push({
        center: center,
        radius: Math.sqrt(radiusSq) + eps,
        vertexCount: points.length
      });
    });

    spheres.sort(function (a, b) {
      if (a.center.x !== b.center.x) return a.center.x - b.center.x;
      if (a.center.y !== b.center.y) return a.center.y - b.center.y;
      return a.center.z - b.center.z;
    });
    return spheres;
  }

  function templateExtentFromSpheres(spheres) {
    var extent = 0;
    (spheres || []).forEach(function (sphere) {
      var center = vector(sphere && sphere.center);
      var radius = Math.max(0, finiteNumber(sphere && sphere.radius, 0));
      extent = Math.max(extent, length(center) + radius);
    });
    return extent;
  }

  function layoutForSector(runSeed, sectorIndex, options) {
    var c = options || {};
    var sectorLength = Math.max(1, finiteNumber(c.sectorLength, DEFAULT_SECTOR_LENGTH));
    var count = clamp(Math.floor(finiteNumber(c.clusterCount, DEFAULT_CLUSTER_COUNT)), 1, 16);
    var shipRadius = Math.max(0.25, finiteNumber(c.shipRadius, DEFAULT_SHIP_RADIUS));
    var tubeRadius = clamp(
      finiteNumber(c.tubeRadius, clamp(shipRadius * 10, DEFAULT_TUBE_RADIUS_MIN, DEFAULT_TUBE_RADIUS_MAX)),
      DEFAULT_TUBE_RADIUS_MIN,
      DEFAULT_TUBE_RADIUS_MAX
    );
    var wallClearance = shipRadius + MIN_WALL_CLEARANCE;
    var minScale = Math.max(0.25, finiteNumber(c.minScale, MIN_SCALE));
    var maxScale = Math.max(minScale, finiteNumber(c.maxScale, MAX_SCALE));
    var extents = Array.isArray(c.templateExtents) ? c.templateExtents : [];
    var seed = seedForSector(runSeed, sectorIndex);
    var templateRandom = randomFrom(mix32(seed ^ 0x54454d50));
    var templateIndex = Math.floor(templateRandom() * 6);
    var templateExtent = Math.max(0, finiteNumber(extents[templateIndex], finiteNumber(c.defaultTemplateExtent, 4)));
    var random = randomFrom(mix32(seed ^ 0x4c41594f));
    var rMin = shipRadius * 0.15;
    var rMax = tubeRadius - wallClearance - templateExtent * maxScale;
    if (rMax <= rMin) {
      rMax = rMin + Math.max(0.5, (tubeRadius - wallClearance - rMin) * 0.25);
    }

    var transforms = [];
    for (var i = 0; i < count; i += 1) {
      var angleJitter = 0.12 + random() * 0.76;
      var angle = TAU * ((i + angleJitter) / count);
      var band = i % 3;
      var lowRatio = band === 0 ? 0 : band === 1 ? 0.34 : 0.68;
      var highRatio = band === 0 ? 0.32 : band === 1 ? 0.66 : 1;
      var bandMin = rMin + (rMax - rMin) * lowRatio;
      var bandMax = rMin + (rMax - rMin) * highRatio;
      var radius = Math.sqrt(
        bandMin * bandMin + random() * Math.max(0, bandMax * bandMax - bandMin * bandMin)
      );
      var scaleValue = minScale + random() * (maxScale - minScale);
      var axial = ((i + 0.12 + random() * 0.76) / count) * sectorLength;

      transforms.push({
        angle: angle,
        radius: radius,
        axial: axial,
        rotationX: random() * TAU,
        rotationY: random() * TAU,
        rotationZ: random() * TAU,
        scale: scaleValue,
        templateIndex: templateIndex,
        clusterExtent: templateExtent
      });
    }

    return {
      sectorIndex: Math.trunc(Number(sectorIndex) || 0),
      seed: seed,
      templateIndex: templateIndex,
      clusterExtent: templateExtent,
      shipRadius: shipRadius,
      tubeRadius: tubeRadius,
      wallClearance: wallClearance,
      rMin: rMin,
      rMax: rMax,
      transforms: transforms
    };
  }

  function closestPointOnSegment(point, start, end) {
    var p = vector(point);
    var a = vector(start);
    var b = vector(end);
    var ab = subtract(b, a);
    var denominator = dot(ab, ab);
    var t = denominator > 1e-12 ? clamp(dot(subtract(p, a), ab) / denominator, 0, 1) : 0;
    return {
      t: t,
      point: add(a, scale(ab, t))
    };
  }

  function axialDistanceToSegment(axial, startAxial, endAxial) {
    var min = Math.min(startAxial, endAxial);
    var max = Math.max(startAxial, endAxial);
    if (axial < min) return min - axial;
    if (axial > max) return axial - max;
    return 0;
  }

  function sweepSphere(start, end, sphereCenter, combinedRadius) {
    var radius = Math.max(0, finiteNumber(combinedRadius, 0));
    var center = vector(sphereCenter);
    var a = vector(start);
    var b = vector(end);
    var depthGap = axialDistanceToSegment(center.z, a.z, b.z);
    if (depthGap > radius) {
      return { hit: false, broadphase: false, depthGap: depthGap };
    }

    var closest = closestPointOnSegment(center, a, b);
    var delta = subtract(closest.point, center);
    var distanceSq = dot(delta, delta);
    var hit = distanceSq <= radius * radius;
    var distance = Math.sqrt(distanceSq);
    var normal = distance > 1e-9 ? scale(delta, 1 / distance) : { x: 1, y: 0, z: 0 };
    return {
      hit: hit,
      broadphase: true,
      t: closest.t,
      point: closest.point,
      normal: normal,
      distance: distance,
      penetration: Math.max(0, radius - distance),
      depthGap: depthGap,
      radius: radius
    };
  }

  function selfTest() {
    var errors = [];
    function check(ok, message) {
      if (!ok) errors.push(message);
    }

    var l = DEFAULT_SECTOR_LENGTH;
    var ring = createWindowState();
    var initial = planWindow(ring, l * 0.50, { sectorLength: l, runSeed: 77 });
    check(initial.sectors.length === 8, "window must contain exactly eight sectors");
    check(
      initial.sectors[0] === initial.anchorSector - 3 &&
      initial.sectors[7] === initial.anchorSector + 4,
      "window must retain three sectors behind and four ahead"
    );
    commitWindowPlan(ring, initial);

    var forward = planWindow(ring, l * 1.06, { sectorLength: l, runSeed: 77 });
    check(forward.changes.length <= 1, "one-sector forward move must rebuild at most one slot");
    commitWindowPlan(ring, forward);
    var backward = planWindow(ring, l * 0.94, { sectorLength: l, runSeed: 77 });
    check(backward.changes.length <= 1, "one-sector reverse move must rebuild at most one slot");

    var jumpFive = createWindowState();
    commitWindowPlan(jumpFive, planWindow(jumpFive, l * 0.5, { sectorLength: l }));
    check(
      planWindow(jumpFive, l * 5.06, { sectorLength: l }).changes.length <= 5,
      "five-sector jump must rebuild no more than five slots"
    );
    var jumpLarge = createWindowState();
    commitWindowPlan(jumpLarge, planWindow(jumpLarge, l * 0.5, { sectorLength: l }));
    var largePlan = planWindow(jumpLarge, l * 10.06, { sectorLength: l });
    check(
      largePlan.changes.length <= 8 && largePlan.slotCount === 8,
      "large jump must stay within eight physical slots"
    );

    var boundary = createWindowState();
    commitWindowPlan(boundary, planWindow(boundary, l * 0.98, { sectorLength: l }));
    var rebuilds = 0;
    for (var toggle = 0; toggle < 40; toggle += 1) {
      var value = l * (toggle % 2 === 0 ? 1.02 : 0.98);
      var plan = planWindow(boundary, value, { sectorLength: l });
      rebuilds += plan.changes.length;
      commitWindowPlan(boundary, plan);
    }
    check(rebuilds <= 1, "40 boundary oscillations must add at most one slot rebuild");

    check(sectorIndexFor(-0.01, l) === -1, "negative traveled must floor to a negative sector");
    check(
      slotIndexFor(-1) === 7 && slotIndexFor(-8) === 0 && slotIndexFor(-9) === 7,
      "negative sector indices must map through positive modulo"
    );

    var idleState = createWindowState();
    commitWindowPlan(idleState, planWindow(idleState, l * 0.94, { sectorLength: l, runSeed: 77 }));
    check(
      planWindow(idleState, l * 0.94, { sectorLength: l, runSeed: 77 }).changes.length === 0,
      "an unchanged window must not rebuild while stationary"
    );

    var options = {
      sectorLength: l,
      shipRadius: 2.5,
      tubeRadius: 32,
      templateExtents: [4, 5, 6, 4.5, 5.5, 6.5],
      runSeed: 1234
    };
    var layoutA = layoutForSector(1234, -9, options);
    var layoutB = layoutForSector(1234, -9, options);
    var layoutC = layoutForSector(1234, -8, options);
    check(
      JSON.stringify(layoutA) === JSON.stringify(layoutB),
      "layoutForSector must be deterministic for the same sector"
    );
    check(
      JSON.stringify(layoutA) !== JSON.stringify(layoutC),
      "different sectors must have different layouts"
    );
    check(
      layoutA.transforms.length === DEFAULT_CLUSTER_COUNT,
      "default density must contain eight cluster instances"
    );
    layoutA.transforms.forEach(function (item, index) {
      check(item.angle >= 0 && item.angle < TAU, "angle must be in [0, 2π) at instance " + index);
      check(item.radius >= layoutA.rMin && item.radius <= layoutA.rMax,
        "radius must stay in the tube's radial range at instance " + index);
      check(item.axial >= 0 && item.axial < l,
        "axial must be in [0, SECTOR_LENGTH) at instance " + index);
      check(
        item.radius + layoutA.clusterExtent * item.scale + layoutA.wallClearance <=
          layoutA.tubeRadius + 1e-8,
        "cluster geometry must not cross the tube wall at instance " + index
      );
    });

    var layouts = new Set();
    for (var sector = -100; sector < 100; sector += 1) {
      var itemLayout = layoutForSector(1234, sector, options);
      layouts.add(JSON.stringify(itemLayout));
    }
    check(layouts.size === 200, "200 consecutive sectors must not contain duplicate layouts");

    var rebuildAgain = layoutForSector(1234, -9, options);
    check(
      JSON.stringify(rebuildAgain) === JSON.stringify(layoutA),
      "eviction and rebuilding the same sector must reproduce its layout"
    );

    var longWindow = createWindowState();
    var longPlan = planWindow(longWindow, l * 12000.5, { sectorLength: l });
    check(longPlan.changes.length === 8 && longPlan.sectors.length === 8,
      "long trips must still use exactly eight sectors");
    commitWindowPlan(longWindow, longPlan);
    check(longWindow.slots.length === 8, "long-trip slot storage must remain fixed at eight");

    var odo = createOdometer({
      origin: { x: 0, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 },
      axis: { x: 0, y: 0, z: -1 }
    });
    advanceOdometer(odo, {
      position: { x: 0, y: 0, z: -10 },
      velocity: { x: 0, y: 0, z: -10 },
      dt: 1
    });
    check(Math.abs(odo.traveled - 10) < 1e-6, "odometer must retain signed route projection");
    advanceOdometer(odo, {
      position: { x: 0, y: 0, z: -5 },
      velocity: { x: 0, y: 0, z: 5 },
      dt: 1
    });
    check(Math.abs(odo.traveled - 5) < 1e-6, "reverse movement must reduce traveled distance");

    var syntheticPositions = [
      0, 0, 0,  1, 0, 0,  0, 1, 0,
      0, 0, 0,  0, 1, 0,  0, 0, 1,
      10, 0, 0,  11, 0, 0,  10, 1, 0,
      10, 0, 0,  10, 1, 0,  10, 0, 1
    ];
    var components = componentSpheresFromGeometry(syntheticPositions, null, 1e-5);
    check(components.length === 2, "disconnected GLB triangle islands must produce two collision spheres");
    check(components.every(function (sphere) { return sphere.radius > 0; }),
      "each disconnected component must have a positive bounding radius");

    var sideHit = sweepSphere(
      { x: 0, y: 0, z: -2 },
      { x: 0, y: 0, z: 2 },
      { x: 3, y: 0, z: 0 },
      3.5
    );
    check(sideHit.hit, "a side asteroid must collide using radial plus axial distance");
    var depthMiss = sweepSphere(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 8 },
      2
    );
    check(!depthMiss.hit && !depthMiss.broadphase,
      "axial depth broadphase must reject distant rocks before radial narrowphase");
    var diagonalMiss = sweepSphere(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 2.5, y: 2.5, z: 0 },
      3
    );
    check(!diagonalMiss.hit, "radial plane distance must prevent false side collisions");
    var sweptHit = sweepSphere(
      { x: 0, y: 0, z: -4 },
      { x: 0, y: 0, z: 4 },
      { x: 0, y: 0, z: 0 },
      1
    );
    check(sweptHit.hit && sweptHit.t > 0 && sweptHit.t < 1,
      "swept collision must detect a rock crossed between frames");

    return errors;
  }

  var api = {
    SLOT_COUNT: SLOT_COUNT,
    TRAILING_SECTORS: TRAILING_SECTORS,
    LEADING_SECTORS: LEADING_SECTORS,
    DEFAULT_SECTOR_LENGTH: DEFAULT_SECTOR_LENGTH,
    DEFAULT_HYSTERESIS_RATIO: DEFAULT_HYSTERESIS_RATIO,
    DEFAULT_CLUSTER_COUNT: DEFAULT_CLUSTER_COUNT,
    DEFAULT_SHIP_RADIUS: DEFAULT_SHIP_RADIUS,
    DEFAULT_TUBE_RADIUS_MIN: DEFAULT_TUBE_RADIUS_MIN,
    DEFAULT_TUBE_RADIUS_MAX: DEFAULT_TUBE_RADIUS_MAX,
    MIN_WALL_CLEARANCE: MIN_WALL_CLEARANCE,
    positiveModulo: positiveModulo,
    sectorIndexFor: sectorIndexFor,
    slotIndexFor: slotIndexFor,
    hashSeed: hashSeed,
    seedForSector: seedForSector,
    createOdometer: createOdometer,
    advanceOdometer: advanceOdometer,
    createWindowState: createWindowState,
    planWindow: planWindow,
    commitWindowPlan: commitWindowPlan,
    componentSpheresFromGeometry: componentSpheresFromGeometry,
    templateExtentFromSpheres: templateExtentFromSpheres,
    layoutForSector: layoutForSector,
    closestPointOnSegment: closestPointOnSegment,
    axialDistanceToSegment: axialDistanceToSegment,
    sweepSphere: sweepSphere,
    selfTest: selfTest
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.BCMWarpSectorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);