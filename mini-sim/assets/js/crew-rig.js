/* Shared Crew walking rig for every view that draws a Crew body.
   One pose generator feeds the 2D cut-out rig in Tower and the Ring, and the
   3D mesh used on the planet, so the two never disagree about how a race walks.
   Pure math: no DOM, no THREE, no performance.now(). Pass dt and phase in. */
(function (root) {
  "use strict";

  const TAU = Math.PI * 2;

  // Hard joint limits. A knee may only fold backwards; that is the single most
  // common way a hand-built walk cycle ends up looking broken.
  const LIMITS = {
    hip: 0.75,
    knee: 1.55,
    foot: 0.50,
    spine: 0.18,
    head: 0.14,
    arm: 0.60
  };

  function clamp(value, low, high) {
    const n = Number(value);
    if (!Number.isFinite(n)) return low;
    return n < low ? low : n > high ? high : n;
  }

  // Wrap to 0..1 keeping negatives positive, so phase never drifts.
  function frac(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const w = n - Math.floor(n);
    return w < 0 ? w + 1 : w;
  }

  // cut.* are fractions measured from the top of the cut-out, so the same
  // numbers work whatever size the matting produced.
  const PROFILES = {
    human: {
      family: "human",
      cycleRate: 1.05,   // full cycles per second at full walk speed
      idleRate: 0.22,    // slow breathing when standing still
      leg: 1.00,         // stride amplitude multiplier
      arm: 1.00,
      lean: 0.015,       // steady forward lean of the spine
      bob: 1.00,         // vertical bounce of the whole body
      sway: 1.00,        // shoulder roll
      stance: 0.26,      // distance between the feet, fraction of body height
      cut: { headBottom: 0.15, hip: 0.48, knee: 0.73 }
    },
    punaab: {
      family: "punaab",
      cycleRate: 0.86,
      idleRate: 0.18,
      leg: 1.20,
      arm: 0.72,
      lean: 0.030,
      bob: 1.15,
      sway: 0.80,
      stance: 0.30,
      cut: { headBottom: 0.28, hip: 0.55, knee: 0.78 }
    },
    sogmian: {
      family: "sogmian",
      cycleRate: 1.05,
      idleRate: 0.22,
      leg: 0.95,
      arm: 1.00,
      lean: 0.015,
      bob: 0.90,
      sway: 1.10,
      stance: 0.25,
      cut: { headBottom: 0.15, hip: 0.48, knee: 0.73 }
    },
    ustur: {
      family: "ustur",
      cycleRate: 0.95,
      idleRate: 0.16,
      leg: 0.85,
      arm: 0.90,
      lean: 0.020,
      bob: 0.70,
      sway: 1.25,
      stance: 0.28,
      cut: { headBottom: 0.18, hip: 0.50, knee: 0.75 }
    },
    mierese: {
      family: "mierese",
      cycleRate: 0.98,
      idleRate: 0.22,
      leg: 1.00,
      arm: 1.00,
      lean: 0.012,
      bob: 1.00,
      sway: 1.05,
      stance: 0.24,
      cut: { headBottom: 0.14, hip: 0.47, knee: 0.72 }
    }
  };

  function profileFor(species) {
    const key = String(species || "").toLowerCase();
    if (key.includes("profound") || key.includes("high punaab") || key.includes("punaab")) return "punaab";
    if (key.includes("sogmian")) return "sogmian";
    if (key.includes("ustur")) return "ustur";
    if (key.includes("mierese")) return "mierese";
    return "human";
  }

  function rigProfile(species, sex) {
    const id = profileFor(species);
    const base = PROFILES[id];
    const profile = {
      id: id,
      family: base.family,
      cycleRate: base.cycleRate,
      idleRate: base.idleRate,
      leg: base.leg,
      arm: base.arm,
      lean: base.lean,
      bob: base.bob,
      sway: base.sway,
      stance: base.stance,
      cut: { headBottom: base.cut.headBottom, hip: base.cut.hip, knee: base.cut.knee }
    };
    // Only Mierese has a measured sex difference in the art: the female body is
    // built slighter and reads as a faster, shorter step. Every other race is
    // left alone until there is something to measure, so the argument is
    // accepted and then deliberately unused.
    if (/female/i.test(String(sex || "")) && id === "mierese") {
      profile.cycleRate = base.cycleRate * 1.12;
      profile.stance = base.stance * 0.94;
      profile.lean = base.lean * 1.20;
    }
    return profile;
  }

  /* Advance the walk phase by elapsed time. `moving` may be a boolean or a
     speed multiplier, so a run cycle and a limp use the same call.
     Standing still does not freeze the phase: it drops to idleRate, which keeps
     the breathing motion alive without faking a step. */
  function stepPhase(phase, dt, profile, moving) {
    const p = profile && profile.cut ? profile : rigProfile("");
    const speed = clamp(typeof moving === "number" ? moving : (moving ? 1 : 0), 0, 2);
    const rate = speed > 0 ? p.cycleRate * speed : p.idleRate;
    const seconds = Math.max(0, Number(dt) || 0);
    return frac((Number(phase) || 0) + seconds * rate);
  }

  /* One pose for every renderer.
     Angles are radians for the 3D skeleton; the spread/lift/scale values are
     normalised to cut-out height for the 2D cut-out rig. */
  function walkPose(phase, profile) {
    const p = profile && profile.cut ? profile : rigProfile("");
    const ph = frac(phase);
    const t = ph * TAU;
    const swing = Math.sin(t);

    const legAmp = 0.50 * p.leg;

    // Hip: forward through the stance, backward through the push-off.
    const hipL = clamp(swing * legAmp, -LIMITS.hip, LIMITS.hip);
    const hipR = clamp(-swing * legAmp, -LIMITS.hip, LIMITS.hip);

    // Knee: folds hardest as that leg finishes its backswing and lifts off.
    // The sign is forced negative so the joint can never bend forwards.
    const kneeL = -Math.max(0, -swing) * 0.90 * p.leg;
    const kneeR = -Math.max(0, swing) * 0.90 * p.leg;

    const footL = clamp(Math.max(0, -swing) * 0.35, 0, LIMITS.foot);
    const footR = clamp(Math.max(0, swing) * 0.35, 0, LIMITS.foot);

    // Arms counter-swing against the legs.
    const armL = clamp(-swing * 0.38 * p.arm, -LIMITS.arm, LIMITS.arm);
    const armR = clamp(swing * 0.38 * p.arm, -LIMITS.arm, LIMITS.arm);

    // Two beats per cycle: the body rises at each mid-stance.
    const spine = clamp(Math.sin(t * 2) * 0.03 * p.sway + p.lean, -LIMITS.spine, LIMITS.spine);
    const head = clamp(-Math.sin(t * 2) * 0.02, -LIMITS.head, LIMITS.head);

    const bob = Math.abs(Math.cos(t)) * 0.045 * p.bob;
    const sway = Math.sin(t) * p.sway * 0.02;

    // 2D cut-out values, as fractions of body height.
    // The lifted foot swings through the air when cos(t) is positive.
    const liftL = Math.max(0, Math.cos(t)) * 0.050 * p.leg;
    const liftR = Math.max(0, -Math.cos(t)) * 0.050 * p.leg;

    // Feet never cross: the base separation is constant and each side opens a
    // little when that leg is the active one.
    const spreadL = p.stance * (0.5 + Math.max(0, swing) * 0.12);
    const spreadR = -p.stance * (0.5 + Math.max(0, -swing) * 0.12);

    // A bent leg is visually shorter, which sells the step without extra art.
    const scaleL = 1 - (Math.max(0, -kneeL) / LIMITS.knee) * 0.18;
    const scaleR = 1 - (Math.max(0, -kneeR) / LIMITS.knee) * 0.18;

    return {
      phase: ph,
      family: p.family,
      hipL: hipL, hipR: hipR,
      kneeL: kneeL, kneeR: kneeR,
      footL: footL, footR: footR,
      armL: armL, armR: armR,
      spine: spine, head: head,
      bob: bob, sway: sway,
      spreadL: spreadL, spreadR: spreadR,
      liftL: liftL, liftR: liftR,
      scaleL: scaleL, scaleR: scaleR
    };
  }

  /* Bands for cutting a transparent cut-out into riggable parts.
     Front-facing art rarely separates the two legs, so legSplit is a hint that
     must be measured against real alpha, not an assumption baked into art. */
  function rigParts(profile) {
    const p = profile && profile.cut ? profile : rigProfile("");
    const cut = p.cut;
    return {
      family: p.family,
      head: { y0: 0, y1: cut.headBottom },
      torso: { y0: cut.headBottom, y1: cut.hip },
      legs: { y0: cut.hip, y1: 1 },
      hipY: cut.hip,
      kneeY: cut.knee,
      stance: p.stance,
      legSplit: 0.5,
      splitQuality: "estimate" // real alpha measurement happens at runtime
    };
  }

  /* Bounding box of the visible pixels inside a horizontal band.
     Works on raw RGBA, so it needs no canvas and is testable in Node. */
  function measureBand(pixels, width, height, y0, y1) {
    const w = Math.max(1, Math.floor(Number(width) || 0));
    const h = Math.max(1, Math.floor(Number(height) || 0));
    if (!pixels || pixels.length < w * h * 4) return null;

    const top = Math.max(0, Math.min(h - 1, Math.round(clamp(y0, 0, 1) * (h - 1))));
    const bottom = Math.max(top, Math.min(h - 1, Math.round(clamp(y1, 0, 1) * (h - 1))));

    let minX = w, maxX = -1, minY = h, maxY = -1;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (pixels[(y * w + x) * 4 + 3] < 8) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return null;

    return {
      x0: minX / w,
      x1: (maxX + 1) / w,
      y0: minY / h,
      y1: (maxY + 1) / h,
      width: (maxX - minX + 1) / w,
      height: (maxY - minY + 1) / h,
      centerX: (minX + maxX + 1) / 2 / w
    };
  }

  function averageColor(pixels, width, height, y0, y1) {
    const w = Math.max(1, Math.floor(Number(width) || 0));
    const h = Math.max(1, Math.floor(Number(height) || 0));
    if (!pixels || pixels.length < w * h * 4) return null;

    const top = Math.max(0, Math.min(h - 1, Math.round(clamp(y0, 0, 1) * (h - 1))));
    const bottom = Math.max(top, Math.min(h - 1, Math.round(clamp(y1, 0, 1) * (h - 1))));

    let r = 0, g = 0, b = 0, count = 0;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        // Skip fully transparent pixels and near-white matte leftovers.
        if (pixels[i + 3] < 24) continue;
        if (pixels[i] > 244 && pixels[i + 1] > 244 && pixels[i + 2] > 244) continue;
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];
        count += 1;
      }
    }
    if (!count) return null;

    const hex = (v) => Math.round(v / count).toString(16).padStart(2, "0");
    return "#" + hex(r) + hex(g) + hex(b);
  }

  /* Three colours taken from the same cut-out, so the 3D body on the planet
     starts from the palette the 2D sprite already uses. */
  function samplePalette(pixels, width, height, profile) {
    const p = profile && profile.cut ? profile : rigProfile("");
    const cut = p.cut;
    return {
      head: averageColor(pixels, width, height, 0, cut.headBottom),
      torso: averageColor(pixels, width, height, cut.headBottom, cut.hip),
      legs: averageColor(pixels, width, height, cut.hip, 1)
    };
  }

  function paletteToInts(palette) {
    const toInt = (hex) => {
      const clean = String(hex || "").replace("#", "");
      if (clean.length !== 6) return 0xffffff;
      return parseInt(clean, 16);
    };
    return {
      head: toInt(palette && palette.head),
      torso: toInt(palette && palette.torso),
      legs: toInt(palette && palette.legs)
    };
  }

  /* Numeric guard against a broken cycle. Runs without a browser, so a plain
     node --test can assert that this returns an empty array. */
  function poseViolations(pose) {
    const out = [];
    if (!pose) return ["pose is missing"];
    if (pose.kneeL > 0) out.push("left knee bends forwards");
    if (pose.kneeR > 0) out.push("right knee bends forwards");
    if (Math.abs(pose.hipL) > LIMITS.hip + 1e-9) out.push("left hip out of range");
    if (Math.abs(pose.hipR) > LIMITS.hip + 1e-9) out.push("right hip out of range");
    if (Math.abs(pose.armL) > LIMITS.arm + 1e-9) out.push("left arm out of range");
    if (Math.abs(pose.armR) > LIMITS.arm + 1e-9) out.push("right arm out of range");
    if (Math.abs(pose.spine) > LIMITS.spine + 1e-9) out.push("spine out of range");
    if (Math.abs(pose.head) > LIMITS.head + 1e-9) out.push("head out of range");
    if (pose.spreadL <= pose.spreadR) out.push("feet crossed over each other");
    if (!Number.isFinite(pose.bob) || pose.bob < 0) out.push("bob is invalid");
    return out;
  }

  function selfTest() {
    const failures = [];
    const species = ["High Punaab", "Profound Punaab", "Punaab", "Sogmian", "Ustur", "Mierese", "Human", ""];
    const sexes = ["Male", "Female", ""];
    const samples = 64;

    for (const s of species) {
      for (const sex of sexes) {
        const profile = rigProfile(s, sex);
        let phase = 0;
        for (let i = 0; i < samples; i += 1) {
          const pose = walkPose(phase, profile);
          for (const problem of poseViolations(pose)) {
            failures.push(s + "/" + sex + " @ " + phase.toFixed(3) + ": " + problem);
          }
          phase = stepPhase(phase, 1 / 30, profile, true);
          if (!(phase >= 0 && phase < 1)) failures.push(s + "/" + sex + ": phase left 0..1");
        }
      }
    }

    // Determinism: the same phase and profile must always give the same pose.
    const a = walkPose(0.37, rigProfile("Ustur", "Male"));
    const b = walkPose(0.37, rigProfile("Ustur", "Male"));
    if (JSON.stringify(a) !== JSON.stringify(b)) failures.push("pose is not deterministic");

    // A full cycle must return to its starting pose.
    const start = walkPose(0, rigProfile("Human", ""));
    const loop = walkPose(frac(stepPhase(0, 60 / rigProfile("Human", "").cycleRate, rigProfile("Human", ""), true)), rigProfile("Human", ""));
    if (Math.abs(start.hipL - loop.hipL) > 1e-6) failures.push("cycle does not loop");

    // Idle must not advance at walking rate.
    const idleStep = stepPhase(0, 1, rigProfile("Ustur", ""), false);
    const walkStep = stepPhase(0, 1, rigProfile("Ustur", ""), true);
    if (!(idleStep < walkStep)) failures.push("idle advances as fast as walking");

    return failures;
  }

  const api = {
    LIMITS: LIMITS,
    PROFILES: PROFILES,
    rigProfile: rigProfile,
    stepPhase: stepPhase,
    walkPose: walkPose,
    rigParts: rigParts,
    measureBand: measureBand,
    samplePalette: samplePalette,
    paletteToInts: paletteToInts,
    poseViolations: poseViolations,
    selfTest: selfTest
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.BCMCrewRig = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
