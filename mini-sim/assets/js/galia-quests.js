/*
 * BCMGaliaQuests — station contracts over the lore sectors (owner 24.11.2026: "добавить предметы и
 * квесты всех планет и звёздных станций и другие сектора"). Each Central Space Station gives one
 * contract drawn from the Star Atlas lore (mini-sim/LORE_CORE.md): fly to the star bases of a few lore
 * sectors (star-base.js, within VISIT_R metres), then come back to the station that gave it.
 *
 *   contractFor(station)        station: "oni" | "mud" | "ustur"
 *   arriveStation(station)      Warp arrival at a CSS: hand in a ready contract, or take this one
 *   visit(sectorId, distance)   the ship is `distance` m from the base of a lore sector
 *   tick({ sector, baseDistance }) per frame from mini-sim.js; draws the contract line
 *   active(), done(), hudLine(), loreSector(id), accept(station), returnTo(station)
 * State is kept in localStorage ("bcm-galia-contracts-v1"); a private window just forgets it.
 */
(function (root) {
  "use strict";

  var VISIT_R = 80;
  var SAVE = "bcm-galia-contracts-v1";

  var CONTRACTS = {
    oni: {
      id: "oni-grand-tale", station: "oni", stationName: "ONI CSS",
      title: "Великий Сказ",
      brief: "Хранители Сказа Mierese не пишут — они запоминают. Слетай к базам трёх секторов ONI и привези их голоса в Великий Сказ.",
      steps: [
        { sector: "night-window", note: "Night Window: здесь высадились Photoli" },
        { sector: "segal", note: "Segal: клятвы Sogmian" },
        { sector: "evernat", note: "Evernat: плато Punaab" }
      ],
      reward: "Хранители вплели твой полёт в Великий Сказ. +300 кредитов."
    },
    mud: {
      id: "mud-huricanno-trail", station: "mud", stationName: "MUD CSS",
      title: "След синдиката",
      brief: "Бывшие следователи MUD ищут, куда синдикат Huricanno возит краденые корабли. Проверь базы на границе.",
      steps: [
        { sector: "free-harbors", note: "Free Harbors: группировка Jorvik" },
        { sector: "old-grove", note: "Old Grove: аванпосты ECOS" },
        { sector: "amora", note: "Amora-IV: крепости MUD" }
      ],
      reward: "Отчёт ушёл в Особый следственный отдел. +350 кредитов."
    },
    ustur: {
      id: "ustur-one-consciousness", station: "ustur", stationName: "Ustur CSS",
      title: "Путь к Единому Сознанию",
      brief: "Шпиль Старейшин ищет осколки памяти тех, чьи оболочки закончились вдали от Ioki, — и следы отступника с Genesium. Облети базы, где их видели.",
      steps: [
        { sector: "azum", note: "Azum: Francor и Opal Industries" },
        { sector: "summer-sea", note: "Summer Sea: голубой гигант" },
        { sector: "everstorm", note: "Everstorm: Nimbus Spheres инженеров Fimbul" }
      ],
      reward: "Старейшины приняли осколки памяти. Ступень ближе. +320 кредитов."
    }
  };

  var state = load();

  function load() {
    try {
      var raw = root.localStorage ? root.localStorage.getItem(SAVE) : null;
      var data = raw ? JSON.parse(raw) : null;
      if (data && typeof data === "object") return { active: data.active || null, seen: data.seen || [], done: data.done || [] };
    } catch (e) { /* private mode */ }
    return { active: null, seen: [], done: [] };
  }

  function save() {
    try { if (root.localStorage) root.localStorage.setItem(SAVE, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  function contractFor(station) {
    return Object.prototype.hasOwnProperty.call(CONTRACTS, station) ? CONTRACTS[station] : null;
  }

  function loreSector(id) {
    var lore = root.BCMGaliaLore;
    return lore ? lore.sectors.find(function (s) { return s.id === id; }) || null : null;
  }

  function active() {
    if (!state.active) return null;
    var c = Object.keys(CONTRACTS).map(function (k) { return CONTRACTS[k]; }).find(function (x) { return x.id === state.active; });
    if (!c) return null;
    var ready = c.steps.every(function (s) { return state.seen.indexOf(s.sector) >= 0; });
    return { id: c.id, title: c.title, station: c.station, stationName: c.stationName, steps: c.steps, seen: state.seen.slice(), ready: ready, brief: c.brief };
  }

  function accept(station) {
    var c = contractFor(station);
    if (!c || state.active) return null;
    state.active = c.id;
    state.seen = [];
    save();
    say("КОНТРАКТ " + c.stationName + " · " + c.title + ": " + c.brief);
    return c;
  }

  function visit(sectorId, distance) {
    var a = active();
    if (!a || !(Number(distance) <= VISIT_R)) return false;
    if (!a.steps.some(function (s) { return s.sector === sectorId; }) || state.seen.indexOf(sectorId) >= 0) return false;
    state.seen.push(sectorId);
    save();
    var step = a.steps.find(function (s) { return s.sector === sectorId; });
    var after = active();
    say("БАЗА ОТМЕЧЕНА · " + step.note + " · " + hudLine() + (after.ready ? " · ВЕРНИСЬ НА " + after.stationName : ""));
    return true;
  }

  function returnTo(station) {
    var a = active();
    if (!a || !a.ready || a.station !== station) return false;
    var c = contractFor(station);
    state.done.push(a.id);
    state.active = null;
    state.seen = [];
    save();
    say("КОНТРАКТ ВЫПОЛНЕН · " + c.reward);
    return true;
  }

  /** Warp arrival in a station sector: hand in a ready contract here, or take this station's one. */
  function arriveStation(station) {
    if (returnTo(station)) return "done";
    if (!state.active && state.done.indexOf((contractFor(station) || {}).id) < 0 && accept(station)) return "accepted";
    return "";
  }

  function hudLine() {
    var a = active();
    if (!a) return "";
    var n = a.steps.filter(function (s) { return a.seen.indexOf(s.sector) >= 0; }).length;
    return a.title + " " + n + "/" + a.steps.length;
  }

  // A small line in the space HUD and a short toast for events. No-op without a page.
  var lineEl = null;
  var toastUntil = 0;
  function ensureLine() {
    if (lineEl || !root.document || !root.document.querySelector) return lineEl;
    var host = root.document.querySelector(".bcm-mini-sim");
    if (!host) return null;
    lineEl = root.document.createElement("div");
    lineEl.className = "bcm-contract-line";
    lineEl.setAttribute("data-galia-contract", "");
    lineEl.style.cssText = "position:absolute;left:12px;bottom:12px;z-index:40;max-width:min(560px,80vw);padding:6px 10px;border-radius:10px;background:rgba(8,14,22,.78);color:#e9f3f7;font:600 12px/1.35 system-ui,sans-serif;pointer-events:none;display:none";
    host.appendChild(lineEl);
    return lineEl;
  }
  var toast = "";
  function say(text) {
    toast = text;
    toastUntil = Date.now() + 6000;
    draw();
  }
  function draw() {
    var el = ensureLine();
    if (!el) return;
    var text = Date.now() < toastUntil ? toast : (active() ? "КОНТРАКТ · " + hudLine() : "");
    el.textContent = text;
    el.style.display = text ? "block" : "none";
  }

  function tick(ctx) {
    if (ctx && ctx.sector && Number.isFinite(ctx.baseDistance)) visit(ctx.sector, ctx.baseDistance);
    draw();
  }

  root.BCMGaliaQuests = {
    VISIT_R: VISIT_R,
    CONTRACTS: CONTRACTS,
    contractFor: contractFor,
    loreSector: loreSector,
    accept: accept,
    active: active,
    visit: visit,
    returnTo: returnTo,
    arriveStation: arriveStation,
    done: function () { return state.done.slice(); },
    hudLine: hudLine,
    tick: tick
  };
})(typeof window !== "undefined" ? window : globalThis);
