/**
 * Who lives on each planet and what they ask for (IDEA-021, owner 18–19.11.2026:
 * "везде свои персонажи, на каждой планете"; "имена и роли меняются, и
 * системы квестов — больше разнообразия").
 *
 * The island keeps three resident spots (terrain.ts NPC: sera, orr, bulb) and
 * the same quest places (three shard spots, one find spot, two lamps). A planet
 * decides who stands on each spot and which kind of quest they give:
 *   collect — bring three things from the ridge (the three shard spots)
 *   fetch   — find one thing on the east shore (the find spot)
 *   light   — light two lamps (the two lamp spots)
 *   relay   — carry something to another resident and come back
 * Twinsun (the desert, planet "first") keeps its original residents and lines.
 *
 * Pure data: no DOM, no THREE.
 */
import { planetIdFrom, type PlanetId } from "./planet";

export type QuestKind = "collect" | "fetch" | "light" | "relay";
export type Slot = "sera" | "orr" | "bulb";

export type Resident = {
  name: string;
  role: string;
  kind: QuestKind;
  /** Quest title in the HUD. */
  title: string;
  /** What is collected, found, lit or carried (shown in lines and HUD). */
  item: string;
  /** relay only: the resident who receives the item. */
  to?: Slot;
  /** relay only: what the receiver says when taking it. */
  handover?: string[];
  offer: string[];
  go: string[];
  ready: string[];
  done: string[];
  /** HUD while waiting to be asked, and when ready to turn in. */
  wait: string;
  turnIn: string;
  /** HUD once done. */
  closed: string;
};

export type PlanetContent = {
  residents: Record<Slot, Resident>;
  /** Text when a collect thing is picked up (n of 3). */
  pickup: (n: number, giver: string) => string;
  /** Text when the fetch thing is found. */
  found: (giver: string) => string;
  /** Text when a lamp is lit (n of 2). */
  lit: (n: number, giver: string) => string;
  /** The chest that opens when the light quest is done. */
  chestLocked: (giver: string) => string;
  chestReward: string;
  /** The book in the house that the fetch quest opens. */
  journal: string[];
  journalLocked: (giver: string) => string;
  /** Short list for the island card. */
  people: string;
};

const TWINSUN: PlanetContent = {
  residents: {
    sera: {
      name: "Сера Венн",
      role: "хранительница оазиса",
      kind: "collect",
      title: "Свет оазиса",
      item: "кристаллы",
      offer: [
        "Ты с посадочной? Оранжевый байк ещё тёплый — значит, свой.",
        "Оазис гаснет без кристаллов с западной гряды. Принеси три. Не больше: остров считает.",
      ],
      go: ["Три кристалла на гряде к западу. Они светятся, мимо не пройдёшь."],
      ready: ["Все три. Оставлю их у колодца — оазис это почувствует."],
      done: ["Если поднимешься выше дюн, увидишь висячий остров. Трассы туда ещё не положили, место уже наше."],
      wait: "Сера ждёт у дома",
      turnIn: "можно сдать",
      closed: "сдано",
    },
    orr: {
      name: "Орр-1",
      role: "смотритель архива",
      kind: "fetch",
      title: "Ключ архива",
      item: "ключ",
      offer: [
        "Архив закрыт. Ключ унесло к разбитому ховеру на восточном пляже.",
        "Принесёшь — открою створку. Внутри журнал посадки и сундук не мой, рыночный.",
      ],
      go: ["Восток, у кромки воды. Корпус красный с синим, не перепутай с байком у входа."],
      ready: ["Ключ тёплый. Створка твоя. Журнал на столе, дом можно читать стоя."],
      done: ["Журнал на столе. Остальные двери посёлка и так без замка."],
      wait: "Орр у архива",
      turnIn: "отнести Орру",
      closed: "створка открыта",
    },
    bulb: {
      name: "Ламп",
      role: "смотритель огня",
      kind: "light",
      title: "Ночной рынок",
      item: "жаровни",
      offer: [
        "Рынок спит, пока жаровни холодные. Я Ламп, я слежу за огнём.",
        "Зажги две: одну у скамьи, вторую у моста. Тогда сундук отпустит крышку.",
      ],
      go: ["Две жаровни. Подойди и нажми E. Я не достаю до фитиля."],
      ready: ["Тепло пошло по площади. Сундук больше не держит."],
      done: ["Северное кольцо за оазисом — это уже гонка, не прогулка. Кольцо само просит E."],
      wait: "Ламп на площади",
      turnIn: "сказать Лампу",
      closed: "рынок открыт",
    },
  },
  pickup: (n) => (n >= 3 ? "Третий. Сера у своего дома — ей можно нести." : `В сумке ${n} из 3. Гряда ещё держит остальные.`),
  found: () => "Золото с синей головкой. Орр стоит у архива и делает вид, что не смотрит.",
  lit: (n) => (n >= 2 ? "Обе горят. Ламп на площади уже слышит треск." : "Одна горит. Вторая ещё холодная."),
  chestLocked: () => "Крышка не шевелится. Ламп говорит: сперва две жаровни.",
  chestReward: "Двенадцать монет посадочного сбора и кассета «Invaders 10». Лента добавлена в инвентарь — её можно выбрать у видеоящика.",
  journal: [
    "«Дюнный посад. Вход с юга, байк оставлять на плите. Дома жилые. Квесты не декорация — жители ждут.»",
    "Ниже другим почерком: «Северное кольцо выводит на берег цитадели. Трассы висячего острова — следующим рейсом.»",
  ],
  journalLocked: () => "Створка ещё держит. Снаружи это просто стена, изнутри — тоже, пока Орр не повернёт ключ.",
  people: "Сера, Орр, Ламп, Джаман",
};

/*
 * Fable — the start at ONI CSS since the hundred-year swap. A night village at
 * the foot of the Dark Mountain; the aurora is their weather, their clock and
 * their post. Quest mix: light, relay, collect.
 */
const FABLE: PlanetContent = {
  residents: {
    sera: {
      name: "Вела Ноктис",
      role: "смотрительница сияния",
      kind: "light",
      title: "Сигнальные огни",
      item: "сигнальные огни",
      offer: [
        "Ты прилетел с ONI — значит, видел, как планеты поменялись местами. Мы тоже видели. Сияние с тех пор путает дорогу.",
        "Зажги два сигнальных огня: у скамьи и у моста. По ним корабли найдут посадочную под Тёмной горой.",
      ],
      go: ["Два огня. Скамья на площади и мост у пруда. Фитиль сухой, загорится с первого раза."],
      ready: ["Вижу оба. Сияние легло ровно — теперь гора снова указывает на нас."],
      done: ["Раз в сто лет планеты меняются местами. Огни — чтобы те, кто вернётся, узнали дом."],
      wait: "Вела у дома с сиянием",
      turnIn: "сказать Веле",
      closed: "огни горят",
    },
    orr: {
      name: "Кобальт-7",
      role: "робот-картограф",
      kind: "relay",
      to: "bulb",
      title: "Карта горы",
      item: "карту",
      handover: [
        "Карта от Кобальта? Наконец-то. Здесь проход через Тёмную гору — светящиеся реки отмечены честно.",
        "Скажи ему: споры растут ровно там, где он нарисовал. Пусть не перерисовывает.",
      ],
      offer: [
        "Я Кобальт-7. Рисую карту Тёмной горы по светящимся рекам. Реки меняют русло каждую смену сияния.",
        "Отнеси карту Мирре на площадь. Она ходит в горы за спорами и скажет, верна ли линия.",
      ],
      go: ["Мирра на площади, у рыночного прилавка. Карту не складывай — реки слипнутся."],
      ready: ["Мирра подтвердила линию. Значит, карта живёт ещё одну смену. Записываю тебя в легенду."],
      done: ["На полях карты теперь твой корабль. Мелко, но картограф всегда оставляет подпись проводника."],
      wait: "Кобальт у архива",
      turnIn: "вернуться к Кобальту",
      closed: "карта сверена",
    },
    bulb: {
      name: "Мирра Ольх",
      role: "собирательница светящихся спор",
      kind: "collect",
      title: "Споры мха",
      item: "споры",
      offer: [
        "Мох на гряде светится только ночью, а ночь здесь вечная. Собери три светящиеся споры.",
        "Из них выйдет фонарь, который не гаснет на ветру. Рынку нужен свет, а не сундук.",
      ],
      go: ["Три споры на западной гряде, там, где камень холодный. Они сами мигают."],
      ready: ["Три. Пахнут грозой. Сундук на площади я открыла — там фонарь и кое-что для тебя."],
      done: ["Фонарь горит. Если увидишь второй такой — значит, кто-то ещё помнит дорогу на Fable."],
      wait: "Мирра на площади",
      turnIn: "нести Мирре",
      closed: "фонарь горит",
    },
  },
  pickup: (n, giver) => (n >= 3 ? `Третья спора. ${giver} на площади ждёт.` : `Спор в сумке: ${n} из 3. Остальные мигают на гряде.`),
  found: (giver) => `Нашлось. ${giver} будет рад.`,
  lit: (n, giver) => (n >= 2 ? `Оба огня горят. ${giver} уже видит.` : "Один огонь горит. Второй ждёт у моста."),
  chestLocked: (giver) => `Крышка держит. ${giver} откроет, когда будет свет.`,
  chestReward: "Восемь монет и кассета «Invaders 10». Лента в инвентаре — её можно выбрать у видеоящика.",
  journal: [
    "«Посёлок под Тёмной горой. Ночь вечная, сияние вместо часов. Здесь ждут тех, кто вернётся после обмена.»",
    "Ниже, мелко: «Северное кольцо — гонка по светящемуся берегу.»",
  ],
  journalLocked: () => "Архив закрыт. Кобальт держит ключи у себя в памяти.",
  people: "Вела, Кобальт-7, Мирра, Джаман",
};

/*
 * Opus — Claude Code's planet (owner 18.11.2026: "в твоё полное распоряжение"; 26.11.2026:
 * "Opus для того чтобы Opus придумало ему свой дизайн"). Redesigned by Opus (layout.ts):
 * an observatory monastery on limestone terraces under karst pillars. Its people watch the sky
 * and grind lenses; the pilot's carpet ship hauls sparks to the base, and the castle on the base
 * grows with every upgrade. The quests cross the whole planet:
 *   orr  — Ниа Сколь, keeper of the observatory on the western ridge: collect three lens shards
 *          at the feet of the northern pillars (by carpet it is a short run);
 *   sera — Ильма Вет, lens grinder on the eastern plateau: fetch her cutter from the dry canyon;
 *   bulb — Брен Арк, steward of the castle by the pad: light the two beacons that bring the
 *          carpet home; the castle chest is his.
 */
const OPUS: PlanetContent = {
  residents: {
    sera: {
      name: "Ильма Вет",
      role: "мастер линз",
      kind: "fetch",
      title: "Резец для линз",
      item: "резец",
      offer: [
        "Я Ильма. Здесь, под столпом, шлифуют линзы для обсерватории — по одной в сезон.",
        "Резец сорвался с уступа и укатился на дно сухого каньона. Без него стекло только мутнеет.",
      ],
      go: ["Каньон — к западу от плато, под мостиком тропы. Резец блестит на светлом дне."],
      ready: ["Он. Кромка цела. Теперь Ниа получит линзу, а ты — место в очереди на следующую."],
      done: ["Хочешь видеть, как растёт замок, — смотри на базу с ковра. Сверху лучше всего."],
      wait: "Ильма у мастерской на плато",
      turnIn: "отнести Ильме",
      closed: "резец у мастера",
    },
    orr: {
      name: "Ниа Сколь",
      role: "смотрительница обсерватории",
      kind: "collect",
      title: "Осколки линзы",
      item: "осколки линзы",
      offer: [
        "Обсерватория на гряде видит весь сектор, когда линза цела. Сейчас она видит трещину.",
        "Три осколка улетели к северным столпам — по одному к подножию каждого. На ковре это один круг.",
      ],
      go: ["Северные столпы. У подножия каждого — осколок, он ловит свет. Ковёр стоит у площадки."],
      ready: ["Все три. Линза снова цельная. Отсюда видно, где теперь Fable, где Twinsun, где ты."],
      done: ["Журнал обсерватории открыт. Записывай, что видишь с ковра: я сверю с небом."],
      wait: "Ниа у обсерватории на гряде",
      turnIn: "нести Ние",
      closed: "линза цела",
    },
    bulb: {
      name: "Брен Арк",
      role: "смотритель замка",
      kind: "light",
      title: "Маяки для ковра",
      item: "маяки",
      offer: [
        "Я Брен, держу замок у базы ковра. Каждое улучшение, что ты купишь на базе, достраивает его: стены, башню, донжон.",
        "Но ковёр ночью идёт домой по маякам. Зажги два: на тропе к гряде и на восточном плато.",
      ],
      go: ["Два маяка: один на тропе к обсерватории, второй на плато у мастерской. Подойди и нажми E."],
      ready: ["Оба горят — ковёр найдёт замок из любого края. Сундук замка твой."],
      done: ["Носи искры на базу и покупай улучшения: замок вырастет. Я буду на стене."],
      wait: "Брен у замка",
      turnIn: "сказать Брену",
      closed: "маяки горят",
    },
  },
  pickup: (n, giver) => (n >= 3 ? `Третий осколок. ${giver} ждёт у обсерватории на гряде.` : `Осколков: ${n} из 3. Остальные — у других северных столпов.`),
  found: (giver) => `Резец мастера линз: тяжёлый, с алмазной кромкой. ${giver} ждёт на плато.`,
  lit: (n) => (n >= 2 ? "Оба маяка горят. Брен у замка уже видит их со стены." : "Один маяк горит. Второй ещё тёмный."),
  chestLocked: (giver) => `Сундук замка заперт. ${giver} откроет его, когда загорятся оба маяка.`,
  chestReward: "Двенадцать монет замковой казны и кассета «Invaders 10». Лента в инвентаре — её можно выбрать у видеоящика.",
  journal: [
    "«Обсерватория Opus. Над террасами — столпы, над столпами — сектор. Ковёр видит больше, чем ноги.»",
    "Ниже: «Замок у базы растёт с каждым улучшением. Маяки — на тропе и на плато. Резец — у Ильмы.»",
  ],
  journalLocked: (giver) => `Журнал закрыт. ${giver} откроет его, когда линза снова будет цельной.`,
  people: "Ниа Сколь, Ильма Вет, Брен Арк, Джаман",
};


/*
 * Pearce stands at MUD CSS (owner 24.11.2026: quests from the Star Atlas Core lore, LORE_CORE.md).
 * MUD: humanity's faction. In Core, two former commanders of an Elite Special Investigator Unit were
 * banished to station police on Mondra 7; Valiant's rich ore hid a sickness that killed colonists;
 * MUD's faith holds that Exodus is a waypoint, not the end of the road. Pearce has lakes you can swim.
 */
const PEARCE: PlanetContent = {
  residents: {
    sera: {
      name: "Айра Клин",
      role: "геолог MUD",
      kind: "collect",
      title: "Образцы с гряды",
      item: "образцы руды",
      offer: [
        "Геолог Айра Клин, экспедиция MUD. На Valiant руда была богатая — и с болезнью внутри. Колонисты узнали поздно.",
        "Здесь я проверяю раньше. Принеси три образца с западной гряды. Голыми руками не бери — перчатки в сумке.",
      ],
      go: ["Три образца на гряде к западу. Блестят, как всё опасное."],
      ready: ["Три. Сканер чистый — эта руда не убивает. Значит, Pearce можно заселять."],
      done: ["Озёра холодные, но плыть можно. Дыхание кончится — течение само вынесет. Проверено на мне."],
      wait: "Айра ждёт у дома",
      turnIn: "отнести Айре",
      closed: "руда чистая",
    },
    orr: {
      name: "Командор Стинн",
      role: "полиция станции MUD",
      kind: "fetch",
      title: "Жетон следователя",
      item: "жетон",
      offer: [
        "Командор Стинн. Был в Особом следственном отделе MUD — теперь полиция станции. За то, что полез в дела синдиката Huricanno.",
        "Мой жетон утонул вместе с ховером на восточном пляже. Без него я просто старик с пушкой. Найди.",
      ],
      go: ["Восток, у кромки воды. Красно-синий корпус. Жетон тяжёлый — на дне не уплывёт."],
      ready: ["Жетон. Значит, отдел ещё жив, пока я его ношу. Архив открыт — там отчёты о Mondra 7."],
      done: ["Huricanno держит каждый уровень Mondra 7. Когда-нибудь я вернусь туда не полицейским."],
      wait: "Стинн у архива",
      turnIn: "вернуть Стинну",
      closed: "отдел жив",
    },
    bulb: {
      name: "Пастор Эзра",
      role: "проповедник Exodus",
      kind: "light",
      title: "Огни пути",
      item: "огни пути",
      offer: [
        "Мы ушли с Земли, потом с Exodus. Exodus — не конец, это перевалочный пункт. Так учит наша вера.",
        "Зажги два огня пути: у скамьи и у моста. Пусть те, кто летит дальше, видят, что здесь их ждут.",
      ],
      go: ["Два огня. Скамья на площади и мост у пруда."],
      ready: ["Огни горят. Сундук открыт — в нём то, что паломники оставляют следующим."],
      done: ["Каждая колония — только остановка. Не держись за неё крепче, чем за дорогу."],
      wait: "Эзра на площади",
      turnIn: "сказать Эзре",
      closed: "путь освещён",
    },
  },
  pickup: (n) => (n >= 3 ? "Третий образец. Айра у своего дома." : `Образцов: ${n} из 3.`),
  found: (giver) => `Жетон Особого следственного отдела MUD, потёртый. ${giver} ждёт у архива.`,
  lit: (n) => (n >= 2 ? "Оба огня пути горят." : "Один огонь горит."),
  chestLocked: (giver) => `Сундук закрыт. ${giver} говорит: сперва огни пути.`,
  chestReward: "Двенадцать монет и фляга паломника. Exodus — только остановка.",
  journal: [
    "«Отчёт: Mondra 7 — автономная станция на краю Galia. Плавильный котёл торговли, жуликов и тех, кто прячется.»",
    "«Каждый уровень станции держат Punaab. Синдикат Huricanno. Переговоры с Punaab бывают смертельно опасны.»",
  ],
  journalLocked: (giver) => `Архив под замком. ${giver} откроет, когда вернёт жетон.`,
  people: "Айра Клин, Командор Стинн, Пастор Эзра, Джаман",
};

/*
 * Ioki stands at Ustur CSS: where the Ustur awoke. Seven Steps of Enlightenment, shown by the name
 * suffix (.bod → .eldr). In Core, Osia (Ustur) dies and asks Gyun to take her data cube to the Summit
 * of the Elders on the Ustur homeworld, to join the One Consciousness. Low gravity on Ioki.
 */
const IOKI: PlanetContent = {
  residents: {
    sera: {
      name: "Рин.lrnr",
      role: "ученица Ustur",
      kind: "collect",
      title: "Глифовые камни",
      item: "глифовые камни",
      offer: [
        "Рин.lrnr. Третья ступень — ученица. Старейшины велят собрать глифы с древних храмов Ioki.",
        "Три камня на западной гряде. Гравитация тут слабая — прыгай смелее, падать долго.",
      ],
      go: ["Три глифа на гряде. Узоры светятся, если смотреть сбоку."],
      ready: ["Три глифа. Узор сложился — шаг к .doer стал на камень ближе."],
      done: ["Сектор Eternity будто кто-то спроектировал. Глифы — его подпись."],
      wait: "Рин у дома",
      turnIn: "отдать Рин",
      closed: "глифы собраны",
    },
    orr: {
      name: "Осса.tchr",
      role: "учитель Ustur",
      kind: "relay",
      to: "bulb",
      title: "Куб данных",
      item: "куб данных",
      handover: [
        "Куб данных. Тот, чья оболочка закончилась, просил донести его до Вершины Старейшин. Ты донёс.",
        "Теперь её сознание войдёт в Единое Сознание и продолжит путь. Обещание выполнено.",
      ],
      offer: [
        "Осса.tchr, пятая ступень, учитель. Кто-то оставил у моста куб данных Ustur. Его хозяйка ушла из оболочки.",
        "Последняя воля Ustur — чтобы куб донесли до Вершины Старейшин. Отнеси его Ваэлю.eldr на площадь.",
      ],
      go: ["Ваэль.eldr на площади. Куб держи двумя руками — он тёплый, это нормально."],
      ready: ["Ваэль принял куб. Ещё одно сознание дома. Записываю тебя в нашу память."],
      done: ["Оболочка кончается, путь — нет. Так учат Seven Steps."],
      wait: "Осса у архива",
      turnIn: "вернуться к Оссе",
      closed: "куб у старейшин",
    },
    bulb: {
      name: "Ваэль.eldr",
      role: "старейшина Ustur",
      kind: "light",
      title: "Резонаторы Вершины",
      item: "резонаторы",
      offer: [
        "Ваэль.eldr, седьмая ступень. Вершина Старейшин слушает Ioki через резонаторы. Два погасли.",
        "Разбуди их: у скамьи и у моста. Тогда Вершина снова услышит тех, кто приходит.",
      ],
      go: ["Два резонатора. Подойди и нажми E — они узнают руку."],
      ready: ["Вершина слышит. Сундук открыт: в нём то, что Ustur дарят пришедшим."],
      done: ["Подземные залы Ioki ведут к резонатору-сердцу. Говорят, там хранят тех, кто вернётся."],
      wait: "Ваэль на площади",
      turnIn: "сказать Ваэлю",
      closed: "Вершина слышит",
    },
  },
  pickup: (n) => (n >= 3 ? "Третий глиф. Рин у своего дома." : `Глифов: ${n} из 3.`),
  found: (giver) => `Куб данных Ustur, тёплый. ${giver} знает, куда его нести.`,
  lit: (n) => (n >= 2 ? "Оба резонатора гудят." : "Один резонатор гудит."),
  chestLocked: (giver) => `Сундук молчит. ${giver} говорит: сперва резонаторы.`,
  chestReward: "Десять монет и звёздная подвеска Ustur.",
  journal: [
    "«Ioki: жёлтая пустыня в кольце океана, храмы с глифами, подземные залы к центральному резервуару.»",
    "«Seven Steps: .bod, .iddt, .lrnr, .doer, .tchr, .soul, .eldr. Суффикс в имени говорит, как далеко Ustur прошёл.»",
    "«Шпиль Старейшин не терпит отклонений. High Ustur Stati.Tchr охотится на роботов-отступников, что играют с Genesium и светом Photoli.»",
  ],
  journalLocked: (giver) => `Архив закрыт. ${giver} откроет, когда куб будет у старейшин.`,
  people: "Рин.lrnr, Осса.tchr, Ваэль.eldr, Джаман",
};

const CONTENT: Partial<Record<PlanetId, PlanetContent>> = { first: TWINSUN, fable: FABLE, opus: OPUS, pearce: PEARCE, ioki: IOKI };

/** Content of a planet; planets without their own pack use Twinsun's. */
export function planetContent(id: unknown): PlanetContent {
  return CONTENT[planetIdFrom(id) ?? "first"] ?? TWINSUN;
}
