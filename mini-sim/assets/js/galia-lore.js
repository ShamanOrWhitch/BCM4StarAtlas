/*
 * BCMGaliaLore — sectors of the Galia Expanse from the Star Atlas lore, on our Galia map
 * (owner 24.11.2026: "применить эти имена и названия секторов внутри реальной карты … в меню
 * Warp"; "нужно для нормальных квестов и диалогов"). BCM4StarAtlas is an add-on to the original
 * game: the names are the game's own. Coordinates come from the lore and match the stars and
 * stations of window.BCMSageMap exactly (tested). Descriptions are our short summaries of the
 * lore (sources in mini-sim/LORE_CORE.md), written for quests, dialogue and sector looks.
 *
 *   sectors: [{ id, x, y, code, name, place, faction, zone, race, about, look }]
 *   at(x, y) → the lore sector at a cell, or null
 */
(function (root) {
  "use strict";

  var sectors = [
    // ONI (west)
    { id: "neuno", x: -40, y: 30, code: "ONI CSS", name: "Neuno", place: null, faction: "ONI", zone: "SZ", race: "Mierese",
      about: "Живая разумная планета Mierese: жаркие джунгли, богатая кислородом атмосфера, рельеф быстро меняется, у планеты есть «иммунная система».",
      look: "living-jungle" },
    { id: "segal", x: -38, y: 25, code: "ONI-4", name: "Segal", place: null, faction: "ONI", zone: "SZ", race: "Sogmian",
      about: "Родина Sogmian — благородных воинов семи знатных домов, связанных клятвами Sogmian Vows: справедливость, обещания, сдержанность, гостеприимство.",
      look: "warrior-houses" },
    { id: "night-window", x: -47, y: 30, code: "ONI-5", name: "Night Window", place: null, faction: "ONI", zone: "SZ", race: "Photoli",
      about: "Звезда погасла раньше срока, на планетах вечная ночь; жизнь приспособилась к темноте, ресурсы почти не тронуты. Историческая точка высадки Photoli.",
      look: "eternal-night" },
    { id: "evernat", x: -30, y: 30, code: "ONI-3", name: "Evernat", place: "Akenat", faction: "ONI", zone: "SZ", race: "Punaab",
      about: "Akenat — колыбель Punaab: высокие плато держатся на гигантских раковинах.",
      look: "shell-plateaus" },
    // Ustur (east)
    { id: "eternity", x: 40, y: 30, code: "Ustur CSS", name: "Eternity", place: "Ioki", faction: "Ustur", zone: "SZ", race: "Ustur",
      about: "Ioki, где пробудились Ustur: жёлтая пустыня в кольце океана, древние храмы с иероглифами, подземные залы к центральному резервуару. Сектор будто кто-то спроектировал.",
      look: "desert-ocean-ring" },
    { id: "azum", x: 38, y: 25, code: "Azum", name: "Azum", place: "Francor", faction: "Ustur", zone: "SZ", race: "Ustur",
      about: "Francor — город на всю планету, освещённый миллиардами кристаллов Arco. Штаб-квартира корабелов Opal Industries; Ustur живут здесь, потому что Ioki слишком свят и опасен.",
      look: "ecumenopolis" },
    // MUD (south)
    { id: "exodus", x: 0, y: -39, code: "MUD CSS", name: "Exodus", place: null, faction: "MUD", zone: "SZ", race: "Human",
      about: "Сердце MUD и убежище людей после Земли. Для их веры Exodus — не конечная цель, а перевалочный пункт.",
      look: "human-haven" },
    { id: "verzan", x: -2, y: -44, code: "Verzan-III", name: "Verzan-III", place: null, faction: "MUD", zone: "SZ", race: "Human",
      about: "Суровый мир разросшихся мегаполисов паломников. На безресурсной луне — храм Order of Light, куда пускают только посвящённых.",
      look: "pilgrim-metropolis" },
    { id: "amora", x: -10, y: -37, code: "Amora-IV", name: "Amora-IV", place: null, faction: "MUD", zone: "SZ", race: "Human",
      about: "Суровые горы, оружейная промышленность, крепости и учебные лагеря MUD.",
      look: "rugged-military" },
    // Medium Risk Zone (middle)
    { id: "old-grove", x: 31, y: -19, code: "MRZ-11", name: "Old Grove", place: null, faction: null, zone: "MRZ", race: null,
      about: "Бывший заповедник ECOS: терраформирование провалилось, растения разрослись, фауна мутировала. Остались только укреплённые аванпосты.",
      look: "overgrown-mutant" },
    { id: "coral-nebula", x: -40, y: 3, code: "MRZ-18", name: "Coral Nebula", place: null, faction: null, zone: "MRZ", race: null,
      about: "Призматические кораллы покрывают целые миры — одни лечат, другие ядовиты.",
      look: "prismatic-coral" },
    { id: "glowhaven", x: -8, y: 35, code: "MRZ-31", name: "Glowhaven", place: null, faction: null, zone: "MRZ", race: null,
      about: "Минералы светятся рядом с живыми существами. Здесь работают шахтёры и охотники ONI.",
      look: "reactive-glow" },
    { id: "summer-sea", x: 25, y: 14, code: "MRZ-21", name: "Summer Sea", place: null, faction: null, zone: "MRZ", race: null,
      about: "Голубой гигант с постоянными вспышками; растения превращают газ в воду, жители живут под землёй.",
      look: "scorched" },
    { id: "free-harbors", x: -9, y: 24, code: "MRZ-26", name: "Free Harbors", place: null, faction: null, zone: "MRZ", race: null,
      about: "Нейтральное убежище времён войны, теперь политически нестабильное; здесь хозяйничает группировка Jorvik.",
      look: "station-cluster" },
    { id: "everstorm", x: -18, y: 23, code: "MRZ-25", name: "Everstorm", place: null, faction: null, zone: "MRZ", race: null,
      about: "Электрические бури. Инженеры Fimbul построили Nimbus Spheres — укрытия, которые собирают энергию бурь.",
      look: "storm-gas" }
  ];

  var byKey = new Map(sectors.map(function (s) { return [s.x + "," + s.y, s]; }));

  function at(x, y) {
    return byKey.get(Number(x) + "," + Number(y)) || null;
  }

  root.BCMGaliaLore = { sectors: sectors, at: at };
})(typeof window !== "undefined" ? window : globalThis);
