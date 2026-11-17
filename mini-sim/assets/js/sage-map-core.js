/* SAGE map helpers for Mini-Sim over window.BCMSageMap (generated from Galia).
   Pure lookups: which star or station sits at [x, y], what to call a sector,
   and which Galia system a station opens. IDEA-014. */
(function () {
  "use strict";
  const data = window.BCMSageMap || { stars: [], css: [], systems: [], kindColor: [], factionTone: {} };

  const stars = (data.stars || []).map((row) => ({ x: row[0], y: row[1], kind: row[2], size: row[3], name: row[4] }));
  const starByKey = new Map(stars.map((star) => [star.x + "," + star.y, star]));
  const cssByKey = new Map((data.css || []).map((css) => [css.x + "," + css.y, css]));
  const systemById = new Map((data.systems || []).map((system) => [system.id, system]));

  // Mini-Sim landmarks: places the game adds on top of the Galia map. They are
  // not SAGE systems and never go into Galia data. Planet Fable is the owner's
  // test planet, one jump north-east of ONI CSS (IDEA-002, 16.11.2026).
  const landmarks = [
    // Owner 17.11.2026: Fable moves next to us — straight north of ONI CSS.
    { id: "fable", x: -40, y: 31, name: "Fable · тестовая планета", planet: "fable", color: "#b48cff" },
    // Planet Opus (Claude Opus 5.5 at the owner's invitation): straight west of ONI CSS.
    { id: "opus", x: -41, y: 30, name: "Opus · планета фокуса", planet: "opus", color: "#ffb347" }
  ];
  const landmarkByKey = new Map(landmarks.map((mark) => [mark.x + "," + mark.y, mark]));

  function landmarkAt(x, y) {
    return landmarkByKey.get(Number(x) + "," + Number(y)) || null;
  }

  function starAt(x, y) {
    return starByKey.get(Number(x) + "," + Number(y)) || null;
  }

  function cssAt(x, y) {
    return cssByKey.get(Number(x) + "," + Number(y)) || null;
  }

  function starColor(star) {
    return (star && data.kindColor && data.kindColor[star.kind]) || "#e6c15a";
  }

  // Star dot radius in map pixels, from the star's size (5 000 … 19 000).
  function starRadius(star, zoom) {
    const size = Math.max(4000, Math.min(20000, Number(star && star.size) || 9000));
    return (1.3 + (size - 4000) / 16000 * 1.6) * (zoom >= 4 ? 1.35 : 1);
  }

  function sectorTitle(x, y) {
    const css = cssAt(x, y);
    if (css) return css.name;
    const star = starAt(x, y);
    if (star) return star.name + " [" + x + ", " + y + "]";
    const mark = landmarkAt(x, y);
    if (mark) return mark.name + " [" + x + ", " + y + "]";
    return "[" + x + ", " + y + "] · пустой сектор";
  }

  // The Galia system a station sector opens (ONI CSS → Akenat), or null.
  function systemForSector(x, y) {
    const css = cssAt(x, y);
    return css && css.system ? systemById.get(css.system) || null : null;
  }

  // Which planet a landing in this sector stands on: a landmark planet, or the
  // Galia system of a station sector. null = no planet of its own.
  function planetForSector(x, y) {
    const mark = landmarkAt(x, y);
    if (mark && mark.planet) return { id: mark.planet, name: mark.name, landmark: true };
    const system = systemForSector(x, y);
    return system ? { id: system.id, name: system.name, landmark: false } : null;
  }

  window.BCMSageMapCore = {
    data: data,
    stars: stars,
    css: data.css || [],
    starAt: starAt,
    cssAt: cssAt,
    starColor: starColor,
    starRadius: starRadius,
    sectorTitle: sectorTitle,
    systemForSector: systemForSector,
    landmarks: landmarks,
    landmarkAt: landmarkAt,
    planetForSector: planetForSector,
    factionTone: function (faction) { return (data.factionTone || {})[faction] || "#9fb6c7"; }
  };
})();
