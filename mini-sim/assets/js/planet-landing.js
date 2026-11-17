/*
 * BCMPlanetLanding — which planet the ship lands on, and which clip the
 * Tower → planet bridge plays (owner 16.11.2026: landing clips per planet,
 * "по примеру посадки на OniCSS").
 *
 * Same order and the same names as First Planet (first-planet/src/game/island/
 * planet.ts resolvePlanetId): URL test switch ?bcm_planet=, session planet,
 * then the SAGE sector the Warp left the ship in. A test keeps the two in
 * step for every sector. Tower passes the result to First Planet, so the clip
 * and the island always show the same planet.
 *
 *   planetId(inputs?)          → "first" | "pearce" | "ioki" | "fable" | "opus"
 *   clipFor(towerConfig, id)   → planetTransitions[id] || planetTransition
 */
(function (root) {
  "use strict";

  var ALIASES = {
    first: "first", desert: "first", akenat: "first", oni: "first",
    pearce: "pearce", mud: "pearce", earth: "pearce",
    ioki: "ioki", ustur: "ioki", mars: "ioki",
    fable: "fable",
    opus: "opus", focus: "opus"
  };

  function idFrom(value) {
    var key = String(value == null ? "" : value).trim().toLowerCase();
    return key && Object.prototype.hasOwnProperty.call(ALIASES, key) ? ALIASES[key] : null;
  }

  function pageInputs() {
    var sector = null;
    try {
      var snap = typeof root.BCMDeepSpaceWarpGetReturnSnapshot === "function" ? root.BCMDeepSpaceWarpGetReturnSnapshot() : null;
      sector = snap && snap.current ? snap.current : null;
    } catch (e) {
      sector = null;
    }
    return {
      search: root.location && typeof root.location.search === "string" ? root.location.search : "",
      sessionPlanet: root.BCMMiniSimSession ? root.BCMMiniSimSession.planetId : null,
      sector: sector,
      core: root.BCMSageMapCore || null
    };
  }

  function planetId(inputs) {
    var i = inputs || pageInputs();
    if (i.search) {
      try {
        var fromUrl = idFrom(new URLSearchParams(i.search).get("bcm_planet"));
        if (fromUrl) return fromUrl;
      } catch (e) { /* malformed query */ }
    }
    var fromSession = idFrom(i.sessionPlanet);
    if (fromSession) return fromSession;
    var s = i.sector;
    var core = i.core;
    var lookup = core && typeof core.planetForSector === "function" ? core.planetForSector
      : core && typeof core.systemForSector === "function" ? core.systemForSector : null;
    if (s && s.x != null && s.y != null && isFinite(Number(s.x)) && isFinite(Number(s.y)) && lookup) {
      var hit = lookup.call(core, Number(s.x), Number(s.y));
      var fromSector = idFrom(hit && hit.id);
      if (fromSector) return fromSector;
    }
    return "first";
  }

  function clipFor(config, id) {
    var c = config || {};
    var own = c.planetTransitions && id ? c.planetTransitions[id] : "";
    return String(own || c.planetTransition || "");
  }

  root.BCMPlanetLanding = { planetId: planetId, clipFor: clipFor, idFrom: idFrom };
})(typeof window !== "undefined" ? window : globalThis);
