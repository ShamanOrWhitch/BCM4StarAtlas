(() => {
  "use strict";

  function bootMiniSim() {
  const root = document.querySelector(".bcm-mini-sim");
  if (!root) return;

  const canvas = root.querySelector(".bcm-mini-sim-canvas");
  const startButton = root.querySelector(".bcm-mini-sim-start");
  const status = root.querySelector(".bcm-mini-sim-status");
  const assetStatus = root.querySelector(".bcm-mini-sim-asset-status");
  const interaction = root.querySelector(".bcm-mini-sim-interaction");
  const menuBackdrop = root.querySelector(".bcm-mini-sim-menu-backdrop");
  const musicButton = root.querySelector(".bcm-mini-sim-music");
  const musicAudio = root.querySelector(".bcm-mini-sim-music-audio");
  const tiltButton = root.querySelector('[data-control="tilt"]');
  const settingsRoot = root.querySelector(".bcm-mini-sim-settings");
  const videoCheckButton = settingsRoot ? settingsRoot.querySelector('[data-setting="checkVideos"]') : null;
  const videoCheckStatus = settingsRoot ? settingsRoot.querySelector('[data-setting="videoCheckStatus"]') : null;
  const transitionRoot = root.querySelector(".bcm-mini-sim-transition");
  const transitionVideo = root.querySelector(".bcm-mini-sim-transition-video");
  const transitionLabel = root.querySelector(".bcm-mini-sim-transition-label");
  const crewPreflight = root.querySelector(".bcm-mini-sim-crew-preflight");
  let crewSlotSelects = crewPreflight
    ? [...crewPreflight.querySelectorAll("[data-crew-slot]")]
    : [];
  const crewSlotContainer = crewPreflight
    ? crewPreflight.querySelector("[data-crew-slots]")
    : null;
  const crewConnectButton = crewPreflight
    ? crewPreflight.querySelector("[data-crew-connect]")
    : null;
  const crewScanButton = crewPreflight
    ? crewPreflight.querySelector("[data-crew-scan]")
    : null;
  const crewAddressInput = crewPreflight
    ? crewPreflight.querySelector("[data-crew-address]")
    : null;
  const crewDiag = crewPreflight
    ? crewPreflight.querySelector("[data-crew-diag]")
    : null;
  const crewStartButton = crewPreflight
    ? crewPreflight.querySelector("[data-crew-start]")
    : null;
  const crewPreflightStatus = crewPreflight
    ? crewPreflight.querySelector(".bcm-mini-sim-crew-preflight-status")
    : null;
  const config = window.BCMMiniSimConfig || {};
  if (musicAudio && config.musicUrl) {
    musicAudio.preload = "auto";
    try { musicAudio.fetchPriority = "high"; } catch (e) {}
    if (!musicAudio.getAttribute("src")) {
      musicAudio.src = config.musicUrl;
      musicAudio.load();
    }
  }
  let miniSimReleased = false;

  const towerPreload = {
    started: false,
    landingVideo: null,
    fallbackVideo: null,
    jsPromise: null,
    cssLoaded: false,
    distance: Infinity
  };

  if (!canvas || !startButton || !status) return;

  const uiText = {
    ru: {
      play: "ИГРАТЬ",
      title: "КОСМИЧЕСКИЙ ЛАБИРИНТ — 0.9.110",
      mission: "МИССИЯ: ДОБРАТЬСЯ ДО ONICSS",
      crewTitle: "ЭКИПАЖ ПЕРЕД ВЫЛЕТОМ",
      crewNote: "Без кошелька можно начать на двухместном корабле. Выбери Crew по изображению; скан адреса не обязателен.",
      address: "Публичный адрес",
      scan: "СКАН",
      connect: "PHANTOM",
      crewStart: "ВЫЛЕТ",
      language: "ЯЗЫК",
      languageHint: "Enter — сменить язык",
      volume: "Громкость",
      close: "Закрыть",
      welcome: "Корабль готов. Оператор будет подсказывать только важное.",
      controlsKeyboard: "ПК: клавиатура + мышь. WASD — полёт, Space/C — вверх/вниз, V — Warp, Enter — меню и язык.",
      controlsTouch: "Телефон: кнопки по краям — движение, свайп — обзор, TILT — управление наклоном.",
      controlsGamepad: "Gamepad: левый стик — движение, правый — обзор, Y — Warp, Start — меню.",
      operator: "ОПЕРАТОР"
    },
    en: {
      play: "PLAY",
      title: "SPACE LABYRINTH — 0.9.110",
      mission: "MISSION: REACH ONICSS",
      crewTitle: "CREW CHECK",
      crewNote: "You can launch with the two-seat starter ship without a wallet. Choose Crew by their portraits; wallet scan is optional.",
      address: "Public address",
      scan: "SCAN",
      connect: "PHANTOM",
      crewStart: "LAUNCH",
      language: "LANGUAGE",
      languageHint: "Enter — switch language",
      volume: "Volume",
      close: "Close",
      welcome: "Ship systems are ready. The operator will only interrupt with useful information.",
      controlsKeyboard: "PC: keyboard + mouse. WASD to fly, Space/C up/down, V for Warp, Enter for menu/language.",
      controlsTouch: "Phone: edge buttons move, swipe to look around, TILT enables motion controls.",
      controlsGamepad: "Gamepad: left stick moves, right stick looks, Y opens Warp, Start opens the menu.",
      operator: "OPERATOR"
    }
  };

  let interfaceLanguage = "ru";
  try {
    const savedLanguage = localStorage.getItem("bcm-mini-sim-language");
    if (savedLanguage === "ru" || savedLanguage === "en") interfaceLanguage = savedLanguage;
  } catch (e) {}

  const languageBox = document.createElement("div");
  languageBox.className = "bcm-mini-sim-language";
  languageBox.setAttribute("aria-label", "Language");
  languageBox.innerHTML =
    '<span data-language-label>ЯЗЫК</span>' +
    '<button type="button" data-language-option="ru" aria-label="Русский">RU</button>' +
    '<button type="button" data-language-option="en" aria-label="English">EN</button>' +
    '<span class="bcm-mini-sim-language-hint" data-language-hint>Enter — сменить язык</span>';
  root.appendChild(languageBox);

  let dialogueRoot = document.getElementById("bcm-comic-dialogs");
  if (dialogueRoot) dialogueRoot.remove();
  dialogueRoot = document.createElement("div");
  dialogueRoot.id = "bcm-comic-dialogs";
  dialogueRoot.className = "bcm-comic-dialogs";
  dialogueRoot.innerHTML =
    '<section class="bcm-comic-dialog bcm-comic-dialog-operator" data-dialog-box="operator" hidden aria-live="polite">' +
      '<div class="bcm-comic-dialog-avatar" aria-hidden="true">✦</div>' +
      '<div class="bcm-comic-dialog-copy"><strong data-dialog-speaker>ОПЕРАТОР</strong><p data-dialog-message></p><div class="bcm-comic-dialog-choices" data-dialog-choices></div></div>' +
      '<button type="button" class="bcm-comic-dialog-close" data-dialog-close="operator" aria-label="Close">×</button>' +
    '</section>' +
    '<section class="bcm-comic-dialog bcm-comic-dialog-controls" data-dialog-box="controls" hidden aria-live="polite">' +
      '<div class="bcm-comic-dialog-avatar" aria-hidden="true">⌘</div>' +
      '<div class="bcm-comic-dialog-copy"><strong data-dialog-controls-title>УПРАВЛЕНИЕ</strong><p data-dialog-controls-message></p></div>' +
      '<button type="button" class="bcm-comic-dialog-close" data-dialog-close="controls" aria-label="Close">×</button>' +
    '</section>';
  document.body.appendChild(dialogueRoot);

  const operatorDialog = dialogueRoot.querySelector('[data-dialog-box="operator"]');
  const operatorSpeaker = dialogueRoot.querySelector("[data-dialog-speaker]");
  const operatorMessage = dialogueRoot.querySelector("[data-dialog-message]");
  const operatorChoices = dialogueRoot.querySelector("[data-dialog-choices]");
  const controlsDialog = dialogueRoot.querySelector('[data-dialog-box="controls"]');
  const controlsMessage = dialogueRoot.querySelector("[data-dialog-controls-message]");
  let operatorDialogTimer = 0;
  let controlsDialogTimer = 0;

  function textForLanguage(key) {
    return uiText[interfaceLanguage]?.[key] || uiText.ru[key] || key;
  }

  function applyLanguage() {
    startButton.textContent = textForLanguage("play");
    const title = root.querySelector(".bcm-mini-sim-title");
    const mission = root.querySelector(".bcm-mini-sim-mission");
    if (title) title.textContent = textForLanguage("title");
    if (mission) mission.textContent = textForLanguage("mission");
    const crewTitle = root.querySelector(".bcm-mini-sim-crew-preflight-card h2");
    const crewNote = root.querySelector(".bcm-mini-sim-crew-preflight-note");
    if (crewTitle) crewTitle.textContent = textForLanguage("crewTitle");
    if (crewNote) crewNote.textContent = textForLanguage("crewNote");
    const address = root.querySelector(".bcm-mini-sim-crew-address");
    if (address && address.firstChild && address.firstChild.nodeType === Node.TEXT_NODE) {
      address.firstChild.nodeValue = textForLanguage("address") + " ";
    }
    const scanButton = root.querySelector("[data-crew-scan]");
    const connectButton = root.querySelector("[data-crew-connect]");
    const crewStart = root.querySelector("[data-crew-start]");
    if (scanButton) scanButton.textContent = textForLanguage("scan");
    if (connectButton) connectButton.textContent = textForLanguage("connect");
    if (crewStart) crewStart.textContent = textForLanguage("crewStart");
    const volumeLabel = root.querySelector('[data-setting="volume"]')?.parentElement;
    if (volumeLabel && volumeLabel.firstChild?.nodeType === Node.TEXT_NODE) {
      volumeLabel.firstChild.nodeValue = textForLanguage("volume") + " ";
    }
    const settingsTitle = settingsRoot?.querySelector("h2");
    if (settingsTitle) settingsTitle.textContent = interfaceLanguage === "ru" ? "НАСТРОЙКИ" : "SETTINGS";
    const settingsClose = settingsRoot?.querySelector('[data-setting="close"]');
    if (settingsClose) settingsClose.textContent = textForLanguage("close");
    languageBox.querySelector("[data-language-label]").textContent = textForLanguage("language");
    languageBox.querySelector("[data-language-hint]").textContent = textForLanguage("languageHint");
    languageBox.querySelectorAll("[data-language-option]").forEach((button) => {
      const selected = button.getAttribute("data-language-option") === interfaceLanguage;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.classList.toggle("is-selected", selected);
    });
    if (operatorDialog && !operatorDialog.hidden && operatorSpeaker.dataset.autoSpeaker === "1") {
      operatorSpeaker.textContent = textForLanguage("operator");
    }
  }

  function setInterfaceLanguage(language) {
    if (language !== "ru" && language !== "en") return interfaceLanguage;
    interfaceLanguage = language;
    try { localStorage.setItem("bcm-mini-sim-language", language); } catch (e) {}
    applyLanguage();
    if (operatorDialog && !operatorDialog.hidden) {
      const key = operatorMessage.dataset.textKey;
      if (key && textForLanguage(key)) operatorMessage.textContent = textForLanguage(key);
    }
    return interfaceLanguage;
  }

  function hideOperatorDialog() {
    if (operatorDialogTimer) window.clearTimeout(operatorDialogTimer);
    operatorDialogTimer = 0;
    if (operatorDialog) operatorDialog.hidden = true;
  }

  function hideControlsDialog() {
    if (controlsDialogTimer) window.clearTimeout(controlsDialogTimer);
    controlsDialogTimer = 0;
    if (controlsDialog) controlsDialog.hidden = true;
  }

  function showOperatorDialog(speaker, message, choices) {
    if (!operatorDialog) return;
    hideOperatorDialog();
    operatorSpeaker.textContent = String(speaker || textForLanguage("operator"));
    operatorSpeaker.dataset.autoSpeaker = speaker ? "0" : "1";
    operatorMessage.textContent = String(message || "");
    operatorMessage.dataset.textKey = typeof message === "string" && uiText[interfaceLanguage]?.[message] ? message : "";
    operatorChoices.replaceChildren();
    (Array.isArray(choices) ? choices : []).forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bcm-comic-dialog-choice";
      button.textContent = String(choice?.label || "");
      button.addEventListener("click", () => {
        try { if (typeof choice?.onSelect === "function") choice.onSelect(); }
        finally { if (choice?.keepOpen !== true) hideOperatorDialog(); }
      });
      operatorChoices.appendChild(button);
    });
    operatorDialog.hidden = false;
    if (!choices || !choices.length) operatorDialogTimer = window.setTimeout(hideOperatorDialog, 9500);
  }

  function showControlsDialog(level) {
    if (!controlsDialog) return;
    hideControlsDialog();
    let key = "controlsKeyboard";
    const touch = !!(("ontouchstart" in window) || navigator.maxTouchPoints > 0);
    let padConnected = false;
    try { padConnected = [...(navigator.getGamepads ? navigator.getGamepads() : [])].some((pad) => pad && pad.connected); } catch (e) {}
    if (touch) key = "controlsTouch";
    else if (padConnected) key = "controlsGamepad";
    const levelText = {
      warp: {
        ru: {controlsKeyboard:"Warp: мышь/стик — курс, Enter — меню.",controlsTouch:"Warp: наклон телефона или кнопки ◀ ▶; уклоняйся от колец.",controlsGamepad:"Warp: стик рулит по кольцу; A подтверждает, B отменяет."},
        en: {controlsKeyboard:"Warp: mouse/stick steers. Enter opens menu.",controlsTouch:"Warp: tilt or use ◀ ▶; dodge the rings.",controlsGamepad:"Warp: stick steers around the tunnel; A confirms, B cancels."}
      },
      ring: {
        ru: {controlsKeyboard:"Ring: ← → или A/D — бег; Space — прыжок; E — цель; Q — лазер.",controlsTouch:"Ring: ◀ ▶ — бег, ПРЫЖОК — прыжок, ЛАЗЕР — выстрел, действие — цель.",controlsGamepad:"Ring: стик — бег; A — прыжок; X — цель; Y — оружие."},
        en: {controlsKeyboard:"Ring: ← → or A/D move; Space jumps; E targets; Q fires.",controlsTouch:"Ring: ◀ ▶ move, JUMP jumps, FIRE shoots, action targets.",controlsGamepad:"Ring: stick moves; A jumps; X targets; Y fires."}
      },
      hull: {
        ru: {controlsKeyboard:"Кабина: мышь/палец — тащи Crew; удерживай воду для насоса, пробоину — для ремонта.",controlsTouch:"Кабина: тащи Crew; держи палец на воде для насоса и на шве для ремонта.",controlsGamepad:"Кабина: стик двигает Crew; A ремонт, B насос, LB/V — штурвал."},
        en: {controlsKeyboard:"Cabin: drag Crew; hold on water to pump or on a seam to repair.",controlsTouch:"Cabin: drag Crew; hold on water to pump and on the seam to repair.",controlsGamepad:"Cabin: stick moves Crew; A repairs, B pumps, LB/V toggles helm."}
      },
      tower: {
        ru: {controlsKeyboard:"Tower: двигайся клавишами или стиком. Esc — выйти.",controlsTouch:"Tower: касайся направлений и прыжка. Esc — выйти.",controlsGamepad:"Tower: левый стик двигает, A — прыжок. Esc — выйти."},
        en: {controlsKeyboard:"Tower: move with keys or stick. Esc exits.",controlsTouch:"Tower: use direction and jump buttons. Esc exits.",controlsGamepad:"Tower: left stick moves, A jumps. Esc exits."}
      }
    };
    const specific = levelText[String(level || "").toLowerCase()]?.[interfaceLanguage]?.[key];
    controlsMessage.textContent = specific || textForLanguage(key);
    controlsDialog.querySelector("[data-dialog-controls-title]").textContent = interfaceLanguage === "ru" ? "УПРАВЛЕНИЕ" : "CONTROLS";
    controlsDialog.hidden = false;
    controlsDialogTimer = window.setTimeout(hideControlsDialog, 14000);
  }

  dialogueRoot.querySelectorAll("[data-dialog-close]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.getAttribute("data-dialog-close") === "operator") hideOperatorDialog();
      else hideControlsDialog();
    });
  });
  languageBox.querySelectorAll("[data-language-option]").forEach((button) => {
    button.addEventListener("click", () => setInterfaceLanguage(button.getAttribute("data-language-option")));
  });

  window.BCMDialogue = {
    get language() { return interfaceLanguage; },
    setLanguage: setInterfaceLanguage,
    showOperator: showOperatorDialog,
    hideOperator: hideOperatorDialog,
    showControls: showControlsDialog,
    hideControls: hideControlsDialog
  };
  applyLanguage();

  const assets = Array.isArray(config.assets) ? config.assets : [];
  let crewRoster = [];
  let crewRosterPromise = null;
  let crewSelection = [null, null];
  let playerCapacity = 2;
  let fleetCapacityData = { capacity: 2, ships: [] };

  const PROFESSION_LABELS = {
    Command: "Командир",
    Flight: "Пилот",
    Operator: "Оператор",
    Engineering: "Инженер",
    Medical: "Медик",
    Science: "Учёный",
    Fitness: "Боец",
    Hospitality: "Обслуживание"
  };

  function professionList(value) {
    const out = [];
    const add = (name) => {
      const raw = String(name || "").trim();
      if (!raw) return;
      const canonical = Object.keys(PROFESSION_LABELS).find(
        (key) => key.toLowerCase() === raw.toLowerCase()
      );
      const label = canonical ? PROFESSION_LABELS[canonical] : raw;
      if (!out.includes(label)) out.push(label);
    };

    if (value && value.aptitudes && typeof value.aptitudes === "object") {
      Object.keys(value.aptitudes).forEach(add);
    }
    const aptitudeNames = Object.keys(PROFESSION_LABELS).map((key) => key.toLowerCase());
    if (Array.isArray(value?.traits)) {
      value.traits.forEach((trait) => {
        if (!trait || typeof trait !== "object") return;
        const raw = String(trait.trait || "").trim();
        if (aptitudeNames.includes(raw.toLowerCase())) add(raw);
      });
    }
    return out;
  }

  function crewPersonName(value) {
    const row = value && typeof value === "object" ? value : {};
    const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
    const validName = (candidate) => {
      const original = String(candidate || "").trim();
      if (!original) return "";
      const stripped = original.replace(/^crew(?:[\s_:#-]*(?:(?:#|no\.?|number)?[\s_:#-]*\d+))\s*(?:[-:|–—·]\s*)?/i, "").trim();
      if (stripped) return stripped;
      if (/^crew(?:[\s_:#-]*(?:(?:#|no\.?|number)?[\s_:#-]*\d+))?$/i.test(original)) return "";
      return original;
    };

    const traitSources = [
      row.traits, row.attributes, raw.traits, raw.attributes,
      row.metadata?.attributes, row.content?.metadata?.attributes,
      raw.metadata?.attributes, raw.content?.metadata?.attributes,
      row.metadata?.properties?.attributes, raw.metadata?.properties?.attributes,
      raw.content?.metadata?.properties?.attributes
    ];
    const traits = traitSources.filter(Array.isArray).flat().filter((item) => item && typeof item === "object");
    const normalizeKey = (item) => String(
      item?.trait || item?.trait_type || item?.traitType || item?.key || ""
    ).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const nameTrait = traits.find((item) =>
      ["name", "crewname", "displayname", "personname"].includes(normalizeKey(item))
    );
    const traitName = nameTrait?.value ?? nameTrait?.Value ?? nameTrait?.val ?? "";

    const given = String(
      row.given || row.givenName || row.firstName ||
      raw.given || raw.givenName || raw.firstName || ""
    ).trim();
    const family = String(
      row.family || row.familyName || row.lastName ||
      raw.family || raw.familyName || raw.lastName || ""
    ).trim();
    const ustur = String(row.ustur || raw.ustur || "").trim();
    const person = ustur
      ? [given, ustur].filter(Boolean).join(" ")
      : [given, family].filter(Boolean).join(" ");

    const direct = [
      row.displayName, row.crewName, row.personName,
      raw.displayName, raw.crewName, raw.personName,
      traitName, person, row.name, raw.name
    ].map(validName).find(Boolean);
    return direct || "Без имени";
  }
  function crewPortraitFallback(value) {
    const base = String(config.galiaAssetBase || "").replace(/\/+$/, "");
    if (!base) return "";
    const species = String(value?.species || value?.spec || "Human").trim().toLowerCase();
    const sex = String(value?.sex || "Male").trim().toLowerCase();
    const slug = species.replace(/\s+/g, "-");
    let suffix = sex === "female" ? "female" : sex === "body 1" ? "body1" : sex === "body 2" ? "body2" : "male";
    if (slug === "ustur") suffix = suffix === "body1" ? "body1" : suffix === "body2" ? "body2" : "body1";
    return base + "/portraits/" + slug + "-" + suffix + ".jpg";
  }

  function normalizeCrewRow(row, index) {
    const value = row && typeof row === "object" ? row : {};
    const name = crewPersonName(value, index);
    const species = String(value.species || value.spec || "").trim();
    const traits = Array.isArray(value.traits) ? value.traits : [];
    const image = String(value.image || "").trim() || crewPortraitFallback(value);
    return {
      id: String(value.id || value.mint || name || ("crew-" + index)),
      mint: String(value.mint || ""),
      name,
      species,
      sex: String(value.sex || ""),
      profession: professionList(value),
      image,
      seats: String(value.seats || ""),
      ocean: String(value.ocean || ""),
      mission: String(value.mission || ""),
      source: value.source || "default",
      traits,
      characteristics: value.characteristics && typeof value.characteristics === "object" ? value.characteristics : {},
      raw: value.raw && typeof value.raw === "object" ? value.raw : value
    };
  }

  function crewLabel(crew) {
    const professions = Array.isArray(crew.profession) && crew.profession.length
      ? crew.profession.join(", ")
      : "Профессия не указана";
    return [
      crew.name || "Без имени",
      crew.species || "Раса не указана",
      professions
    ].join(" · ");
  }

  function calculateFleetCapacity(scan) {
    const inventory = Array.isArray(scan?.inventory) ? scan.inventory : [];
    const ships = inventory.filter((item) =>
      item && item.kind === "ship" && item.spec !== "мой ордер"
    );
    let capacity = 0;
    const rows = [];

    ships.forEach((ship) => {
      const quantity = Math.max(1, Math.floor(Number(ship.amount || 1)));
      const crew = Math.max(0, Math.floor(Number(ship.crew || 0)));
      if (crew <= 0) return;
      capacity += quantity * crew;
      rows.push({
        mint: String(ship.mint || ""),
        name: String(ship.name || "Корабль"),
        quantity,
        crew,
        capacity: quantity * crew
      });
    });

    // Без кошелька и для старых/неполных данных игра остаётся двухместной.
    if (capacity <= 0) capacity = 2;
    return { capacity, ships: rows };
  }

  function renderCrewSlots() {
    if (!crewSlotContainer) {
      crewSlotSelects = crewPreflight
        ? [...crewPreflight.querySelectorAll("[data-crew-slot]")]
        : [];
      return;
    }

    const oldValues = crewSlotSelects.map((select) => String(select.value || ""));
    const count = Math.max(2, Math.floor(playerCapacity || 2));
    crewSlotContainer.innerHTML = Array.from({ length: count }, (_, index) => {
      const wanted = String(crewSelection[index] || oldValues[index] || "");
      const usedByOthers = crewSelection
        .filter((id, otherIndex) => otherIndex !== index && id)
        .map((id) => String(id));
      const options = ['<option value="">— без Crew —</option>'].concat(
        crewRoster
          .filter((crew) => !usedByOthers.includes(crew.id) || crew.id === wanted)
          .map((crew) => {
            const selected = wanted === crew.id ? " selected" : "";
            return '<option value="' + escapeHtml(crew.id) + '"' + selected + '>' +
              escapeHtml(crewLabel(crew)) +
              '</option>';
          })
      ).join("");
      const crew = crewRoster.find((item) => item.id === wanted) || crewRoster[index] || null;
      const rarity = String(crew?.rarity || "common").toLowerCase().replace(/[^a-z]/g, "");
      const image = crew?.image
        ? '<img class="bcm-mini-sim-crew-slot-image" src="' + escapeHtml(crew.image) + '" alt="">'
        : '<span class="bcm-mini-sim-crew-slot-image bcm-mini-sim-crew-slot-empty">CREW</span>';
      const meta = crew
        ? escapeHtml((crew.species || "Раса —") + " · " + (Array.isArray(crew.profession) && crew.profession.length ? crew.profession.join(", ") : "Профессия —"))
        : "Команда не назначена";
      return '<label class="bcm-mini-sim-crew-slot-card rarity-' + rarity + '">' +
        image +
        '<span class="bcm-mini-sim-crew-slot-main">' +
          '<strong>' + escapeHtml(crew?.name || "Без имени") + '</strong>' +
          '<span class="bcm-mini-sim-crew-slot-player">P' + (index + 1) + '</span>' +
          '<span>' + meta + '</span>' +
          '<select data-crew-slot="' + index + '">' + options + '</select>' +
        '</span>' +
      '</label>';
    }).join("");

    crewSlotSelects = [...crewSlotContainer.querySelectorAll("[data-crew-slot]")];
    crewSlotSelects.forEach((select, index) => {
      select.addEventListener("change", () => {
        crewSelection[index] = String(select.value || "");
        renderCrewSlots();
        const chosen = crewById(crewSelection[index]);
        crewSetStatus(chosen
          ? "P" + (index + 1) + " · " + chosen.name + " · " + (chosen.species || "Раса не указана")
          : "P" + (index + 1) + " · Crew не выбран"
        );
      });
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function crewById(id) {
    return crewRoster.find((crew) => crew.id === id) || null;
  }

  function crewSetStatus(message) {
    if (crewPreflightStatus) crewPreflightStatus.textContent = message;
  }

  function renderCrewPreflight() {
    renderCrewSlots();
    crewSlotSelects.forEach((select, index) => {
      const wanted = crewSelection[index];
      if (wanted && crewById(wanted)) {
        select.value = wanted;
      } else if (crewRoster[index]) {
        select.value = crewRoster[index].id;
        crewSelection[index] = crewRoster[index].id;
      }
    });
  }

  async function loadCrewRoster() {
    if (crewRoster.length) return crewRoster;
    if (crewRosterPromise) return crewRosterPromise;
    const url = String(config.crewRosterUrl || "");
    if (!url) {
      crewSetStatus("База Crew не настроена · можно подключить Phantom.");
      return [];
    }

    crewRosterPromise = fetch(url, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("Не удалось загрузить базу Crew");
        return response.json();
      })
      .then((rows) => {
        crewRoster = Array.isArray(rows) ? rows.map(normalizeCrewRow) : [];
        renderCrewPreflight();
        crewSetStatus(
          "Локальная база Crew: " +
          crewRoster.length +
          " · можно играть без кошелька."
        );
        return crewRoster;
      })
      .catch((error) => {
        crewRoster = [];
        crewSetStatus(error?.message || "Ошибка загрузки Crew");
        return crewRoster;
      });

    return crewRosterPromise;
  }

  function openCrewPreflight() {
    if (!crewPreflight) {
      beginFlight();
      return;
    }

    startButton.classList.add("hidden");
    crewPreflight.hidden = false;
    crewSetStatus("Загрузка Crew из встроенной базы…");

    loadCrewRoster().then(() => {
      if (!crewRoster.length) {
        crewSetStatus("Crew база не загрузилась · можно подключить Phantom.");
      }
    });
  }

  function applyWalletScan(scan) {
    const found = Array.isArray(scan?.crew) ? scan.crew : [];
    fleetCapacityData = calculateFleetCapacity(scan);
    playerCapacity = fleetCapacityData.capacity;

    if (crewDiag && window.BCMCrewWallet?.formatDiagnostic) {
      const base = window.BCMCrewWallet.formatDiagnostic(scan);
      const fleetLines = fleetCapacityData.ships.length
        ? fleetCapacityData.ships.map((ship) =>
          ship.name + " · ×" + ship.quantity + " · crew " + ship.crew
        )
        : ["Opal Jetjet · 2 места по умолчанию"];
      crewDiag.textContent =
        base +
        "\nFleet capacity: " + playerCapacity + " players" +
        "\n" + fleetLines.join("\n");
    }
    window.BCMiniCrewWallet = {
      provider: scan?.provider ? "Phantom" : "address",
      publicKey: scan?.owner || "",
      crewCount: found.length,
      demo: false
    };
    if (!found.length) {
      window.BCMiniCrewWallet = {
        provider: scan?.provider ? "Phantom" : "address",
        publicKey: "",
        scanned: scan?.owner || "",
        crewCount: 0,
        demo: true
      };
      crewSetStatus("No Crew found / Demo mode. Локальные 68 не считаются владельцами этого кошелька.");
      return;
    }
    crewRoster = found.map(normalizeCrewRow);
    crewSelection = Array.from({ length: playerCapacity }, (_, index) =>
      crewRoster[index]?.id || null
    );
    renderCrewPreflight();
    const fleetText = fleetCapacityData.ships.length
      ? fleetCapacityData.ships.map((ship) => ship.name + " ×" + ship.quantity + " / " + ship.crew + " мест").join(" · ")
      : "Opal Jetjet · 2 места";
    crewSetStatus(
      "Кошелёк " + String(scan.owner || "").slice(0, 6) + "… · Crew " + found.length +
      " · игроков по флоту " + playerCapacity + " · " + fleetText
    );
  }

  async function scanCrewAddress() {
    const owner = String(crewAddressInput?.value || "").trim();
    if (!window.BCMCrewWallet?.scanWallet) {
      crewSetStatus("Wallet-модуль не загружен.");
      return;
    }
    if (crewScanButton) crewScanButton.disabled = true;
    crewSetStatus("Разбудим Render… первый запуск может занять 1–3 минуты.");
    try {
      const scan = await window.BCMCrewWallet.scanWallet(owner);
      applyWalletScan(scan);
    } catch (error) {
      if (crewDiag) crewDiag.textContent = "";
      crewSetStatus("Render просыпается. Повторите через 1–3 минуты.");
    } finally {
      if (crewScanButton) crewScanButton.disabled = false;
    }
  }

  function handleGaliaPlayRequest(event) {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : null;
    if (!detail) return;

    const incomingCrew = Array.isArray(detail.crew) ? detail.crew.map(normalizeCrewRow) : [];
    if (incomingCrew.length) {
      crewRoster = incomingCrew;
    }

    const requestedCapacity = Math.max(2, Math.floor(Number(detail.maxPlayers || 2)));
    playerCapacity = requestedCapacity;

    fleetCapacityData = {
      capacity: requestedCapacity,
      ships: Array.isArray(detail.ships)
        ? detail.ships.map((ship) => ({
            mint: String(ship.mint || ""),
            name: String(ship.name || "Корабль"),
            quantity: Math.max(1, Math.floor(Number(ship.quantity || 1))),
            crew: Math.max(0, Math.floor(Number(ship.crew || 0))),
            capacity: Math.max(0, Math.floor(Number(ship.quantity || 1))) * Math.max(0, Math.floor(Number(ship.crew || 0)))
          }))
        : []
    };

    window.BCMiniCrewWallet = {
      provider: detail.source === "wallet" ? "galia" : "default",
      publicKey: String(detail.owner || ""),
      crewCount: crewRoster.length,
      demo: detail.source !== "wallet"
    };

    crewSelection = Array.from({ length: playerCapacity }, (_, index) =>
      crewRoster[index]?.id || null
    );

    renderCrewPreflight();
    crewSetStatus(
      (detail.source === "wallet" ? "Galia · " : "Играть · ") +
      "Crew " + crewRoster.length +
      " · игроков по флоту " + playerCapacity
    );

    // Galia is the launcher: the separate preflight is no longer required here.
    // beginFlight still enforces the minimum two active players.
    if (crewRoster.length >= 2) {
      if (crewPreflight) crewPreflight.hidden = true;
      startButton.classList.add("hidden");
      beginFlight();
    } else {
      if (crewPreflight) crewPreflight.hidden = false;
    }
  }

  async function connectCrewWallet() {
    if (!crewConnectButton) return;
    if (!window.BCMCrewWallet?.connectAndScan) {
      crewSetStatus("Wallet-модуль не загружен.");
      return;
    }

    crewConnectButton.disabled = true;
    crewSetStatus("Открываю Phantom…");

    try {
      const result = await window.BCMCrewWallet.connectAndScan();
      if (crewAddressInput && result.owner) crewAddressInput.value = result.owner;
      applyWalletScan({ ...result, provider: result.provider });
    } catch (error) {
      crewSetStatus(error?.message || "Phantom не подключился.");
    } finally {
      crewConnectButton.disabled = false;
    }
  }

  function commitCrewSelection() {
    crewSelection = crewSlotSelects.map((select, index) => {
      const value = String(select.value || "");
      return value || crewRoster[index]?.id || null;
    });

    const picked = crewSelection
      .map(crewById)
      .filter(Boolean);

    window.BCMMiniCrewSelection = {
      source: window.BCMiniCrewWallet?.publicKey ? "wallet" : "default",
      wallet: window.BCMiniCrewWallet?.publicKey || "",
      players: picked,
      maxPlayers: playerCapacity,
      fleet: fleetCapacityData
    };
    window.dispatchEvent(new CustomEvent("bcm:minicrew-selection-changed", {
      detail: window.BCMMiniCrewSelection
    }));

    return picked;
  }

  function beginFlight() {
    if (!renderer) return;
    const picked = commitCrewSelection();
    if (picked.length < 2) {
      crewSetStatus("Нужны два Crew для стартовой команды.");
      if (crewPreflight) crewPreflight.hidden = false;
      return;
    }

    if (crewPreflight) crewPreflight.hidden = true;
    running = true;
    musicAllowed = true;
    startMusic();

    if (window.matchMedia && window.matchMedia("(pointer: coarse) and (orientation: landscape)").matches && !isIOSDevice()) {
      enableTilt();
    }

    enterMobileFullscreen();

    const centerSim = () => {
      const rect = root.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
      const targetTop = window.scrollY + rect.top - Math.max(0, (viewportH - rect.height) * 0.5);
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    };
    if ("requestAnimationFrame" in window) {
      requestAnimationFrame(() => {
        centerSim();
        setTimeout(centerSim, 120);
      });
    } else {
      setTimeout(centerSim, 0);
    }

    let levelMediaArmed = false;
    const armLevelMedia = () => {
      if (levelMediaArmed) return;
      levelMediaArmed = true;

      // First issue the nearest Room 1 wall requests. Critical wall textures
      // use the highest queue/fetch priority; this never pauses flight or controls.
      startBackgroundTextureLoading();

      // Next request the live right-wall video, after local wall textures have
      // already been queued and dispatched.
      const room1RightWall = liveInterior.find((item) => item.mesh && item.mesh.name === "room1-right-wall-live");
      if (room1RightWall) {
        try {
          room1RightWall.el.preload = "auto";
          room1RightWall.el.fetchPriority = "high";
        } catch (e) {}
        warmInteriorVideo(room1RightWall);
      }

      // Queue the actual portal transition after the right-wall video request.
      // If the player reaches it earlier, the transition code still loads it on demand.
      window.setTimeout(() => primePortalVideo("FORWARD", "high"), 250);

      // Only after critical startup requests, warm the rear cap / Room 2 video
      // and the portal-return clip. Decorative and exterior PNGs stay low priority.
      window.setTimeout(() => {
        const capdoor = liveInterior.find((item) => item.mesh && item.mesh.name === "room1-rear-capdoor");
        const room2Corridor = liveInterior.find((item) => item.mesh && item.mesh.name === "room2-right-wall-live-bottom-right");
        if (capdoor) warmInteriorVideo(capdoor);
        if (room2Corridor) {
          try {
            room2Corridor.el.preload = "auto";
            room2Corridor.el.fetchPriority = "auto";
          } catch (e) {}
          warmInteriorVideo(room2Corridor);
        }
        const portalBackUrl = assetUrl("portal1.mp4");
        if (portalBackUrl && !transitionVideo.getAttribute("src")) {
          const prime = document.createElement("video");
          prime.muted = true;
          prime.preload = "auto";
          prime.playsInline = true;
          try { prime.fetchPriority = "low"; } catch (e) {}
          prime.src = portalBackUrl;
          prime.load();
        }
        if (liveWall.el && liveWall.ready) {
          const wallPlay = liveWall.el.play();
          if (wallPlay && wallPlay.catch) wallPlay.catch(() => {});
        }
      }, 650);
    };
    armLevelMedia();

    updateLiveWall();
    root.classList.add("game-active");
    startButton.classList.add("hidden");
    languageBox.hidden = true;
    canvas.focus();
    window.BCMDialogue?.showOperator("", textForLanguage("welcome"));
    window.BCMDialogue?.showControls("flight");

    if (canvas.requestPointerLock && !("ontouchstart" in window)) {
      canvas.requestPointerLock();
    }

    setStatus(
      "FLIGHT ACTIVE · CREW " +
      picked.map((crew) => crew.name).join(" / ")
    );
  }

  const byName = Object.create(null);
  assets.forEach((a) => {
    if (a && a.name && a.url) byName[String(a.name).toLowerCase()] = a.url;
  });

  function assetUrl(name) {
    const wanted = String(name || "").toLowerCase();
    if (byName[wanted]) return byName[wanted];
    const base = wanted.split("/").pop();
    if (byName[base]) return byName[base];
    const keys = Object.keys(byName);
    const hit = keys.find((k) => k.split("/").pop() === base);
    return hit ? byName[hit] : "";
  }
  function parseLabyrinthSeed(value) {
    const textValue = String(value ?? "").trim();
    if (!textValue) return 0;
    if (/^0x[0-9a-f]+$/i.test(textValue)) return parseInt(textValue, 16) >>> 0;
    if (/^\d+$/.test(textValue)) return Number(textValue) >>> 0;

    let hash = 2166136261 >>> 0;
    for (let i = 0; i < textValue.length; i++) {
      hash ^= textValue.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function makeLabyrinthSeed() {
    const query = new URLSearchParams(window.location.search || "");
    const fromUrl = parseLabyrinthSeed(query.get("seed"));
    if (fromUrl) return fromUrl;

    const fromConfig = parseLabyrinthSeed(config.labyrinthSeed);
    if (fromConfig) return fromConfig;

    const a = new Uint32Array(2);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(a);
      return (a[0] ^ a[1]) >>> 0;
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  const labyrinthSeed = makeLabyrinthSeed();

  function seedRandom(salt = 0) {
    let state = (labyrinthSeed ^ Number(salt || 0) ^ 0x9e3779b9) >>> 0;
    return function () {
      let t = state += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededVariant(names, salt, fallback) {
    const pool = Array.isArray(names) ? names.filter(Boolean) : [];
    if (!pool.length) return fallback || "";
    return pool[Math.floor(seedRandom(salt)() * pool.length)] || fallback || "";
  }

  function getVideoCheckEntries() {
    const seen = Object.create(null);
    const entries = [];
    const add = (label, url) => {
      if (!url || seen[url]) return;
      seen[url] = true;
      entries.push({ label, url });
    };
    add("Room 1 · capdoor.mp4", config.capdoorVideo);
    add("Room 1 · Wall.mp4", config.room1WallVideo);
    add("Room 2 · doorwallbotright.mp4", config.room2RightVideo);
    const zones = Array.isArray(config.spaceVideoZones) ? config.spaceVideoZones : [];
    zones.forEach((zone, index) => add("Space video " + (index + 1), zone && zone.url));
    add("Portal · portal1.mp4", assetUrl("portal1.mp4"));
    add("Portal · portal2.mp4", assetUrl("portal2.mp4"));
    add("Portal · portal3.mp4", assetUrl("portal3.mp4"));
    return entries;
  }

  let videoCheckToken = 0;

  function checkAllVideoSources() {
    const entries = getVideoCheckEntries();
    if (!entries.length) {
      if (videoCheckStatus) videoCheckStatus.textContent = "Видео: источники не найдены.";
      return;
    }
    const token = ++videoCheckToken;
    let ok = 0;
    let failed = 0;
    let index = 0;
    const render = (label) => {
      if (videoCheckStatus) videoCheckStatus.textContent = "Видео: " + index + "/" + entries.length + " · " + label;
    };
    const next = () => {
      if (token !== videoCheckToken) return;
      if (index >= entries.length) {
        if (videoCheckStatus) videoCheckStatus.textContent = "Видео: " + ok + "/" + entries.length + " работают" + (failed ? " · ошибок " + failed : " · без ошибок");
        return;
      }
      const entry = entries[index];
      render("проверка " + (index + 1) + " — " + entry.label);
      const video = document.createElement("video");
      let done = false;
      let timer = null;
      const finish = (success) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        video.pause();
        video.removeAttribute("src");
        video.load();
        if (success) ok++; else failed++;
        index++;
        setTimeout(next, 80);
      };
      timer = setTimeout(() => finish(false), 12000);
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.addEventListener("loadedmetadata", () => finish(!!video.videoWidth && !!video.videoHeight), { once: true });
      video.addEventListener("error", () => finish(false), { once: true });
      video.src = entry.url;
      video.load();
    };
    next();
  }


  const settings = {
    open: false,
    volume: 0.42,
    invertPitch: true,
    invertYaw: false
  };

  const keys = Object.create(null);
  const touch = Object.create(null);
  const stats = { total: 0, loaded: 0, failed: 0, last: "" };
  const backgroundTextureQueue = {
    jobs: [],
    active: 0,
    running: false,
    seen: Object.create(null),
    sequence: 0
  };

  function textureRequestPriority(name) {
    const base = String(name || "").split(/[\\/]/).pop().toLowerCase();
    if (/^wall[1-5]\.png$/.test(base)) return 1;
    if (/^roof[0-9]*\.png$/.test(base)) return 2;
    if (/^(door[0-9]*|portal[0-9]*)\.png$/.test(base)) return 4;
    if (/^roofa[0-9]*\.png$/.test(base)) return 4;
    if (/^back.*\.png$/.test(base)) return 9;
    return 3;
  }

  function queueLowPriorityImage(url, onload, onerror, priority) {
    if (!url) return;
    const existing = backgroundTextureQueue.seen[url];
    if (existing) {
      existing.listeners.push({ onload, onerror });
      if (existing.done) deliverTextureRecord(existing);
      return;
    }
    const record = {
      listeners: [{ onload, onerror }],
      done: false,
      ok: false,
      image: null
    };
    backgroundTextureQueue.seen[url] = record;
    const job = {
      url,
      record,
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 5,
      sequence: backgroundTextureQueue.sequence++
    };
    let index = backgroundTextureQueue.jobs.findIndex((row) =>
      row.priority > job.priority ||
      (row.priority === job.priority && row.sequence > job.sequence)
    );
    if (index < 0) index = backgroundTextureQueue.jobs.length;
    backgroundTextureQueue.jobs.splice(index, 0, job);
    if (backgroundTextureQueue.running) pumpBackgroundTextures();
  }

  function deliverTextureRecord(record) {
    const pending = record.listeners.splice(0);
    pending.forEach((listener) => {
      try {
        if (record.ok && listener.onload) listener.onload(record.image);
        else if (listener.onerror) listener.onerror();
      } catch (e) {}
    });
  }

  function pumpBackgroundTextures() {
    if (!backgroundTextureQueue.running) return;
    while (backgroundTextureQueue.active < 2 && backgroundTextureQueue.jobs.length) {
      const job = backgroundTextureQueue.jobs.shift();
      const record = job.record;
      backgroundTextureQueue.active++;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      try { img.fetchPriority = job.priority <= 1 ? "high" : (job.priority <= 4 ? "auto" : "low"); } catch (e) {}
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        backgroundTextureQueue.active--;
        if (miniSimReleased) return;
        record.done = true;
        record.ok = ok;
        record.image = ok ? img : null;
        deliverTextureRecord(record);
        setTimeout(pumpBackgroundTextures, 25);
      };
      const timer = setTimeout(() => finish(false), 20000);
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = job.url;
    }
  }

  function startBackgroundTextureLoading() {
    if (backgroundTextureQueue.running) {
      pumpBackgroundTextures();
      return;
    }
    backgroundTextureQueue.running = true;
    pumpBackgroundTextures();
  }

  // Speed matrix: mode 2 keeps the previous 0.9.0 flight values.
  // Mode 1 is the new default: slightly slower forward/back flight.
  // Gentle opening flight: each selectable mode keeps its relative step but
  // uses a lower thrust/top-speed pair so the ship is controllable from spawn.
  const speedMatrix = {
    1: { thrust: 8.5, maxSpeed: 18 },
    2: { thrust: 13.5, maxSpeed: 31 },
    3: { thrust: 18, maxSpeed: 45 }
  };
  let speedMode = 1;

  const ship = {
    position: null,
    velocity: null,
    angularVelocity: null,
    quaternion: null,
    visual: null,
    thrust: speedMatrix[speedMode].thrust,
    strafeThrust: 12,
    verticalThrust: 12,
    linearDrag: 0.1,
    angularDrag: 0.55,
    maxSpeed: speedMatrix[speedMode].maxSpeed
  };
  const door = {
    state: "CLOSED",
    progress: 0,
    speed: 1.7,
    mesh: null,
    left: null,
    right: null,
    leaf: null,
    away: 0,
    style: "slide"
  };
  const DEEP_SPACE_Z = -83;
  const portal = { mesh: null, backMesh: null, coverage: 0, z: -24.2, triggerFrontZ: -22.8, triggerBackZ: -25.8, direction: "FORWARD" };
  const returnDoor = {
    state: "CLOSED",
    progress: 0,
    speed: 1.7,
    mesh: null,
    left: null,
    right: null,
    leaf: null,
    away: 0,
    style: "slide"
  };
  const cinema = {
    zones: [],
    nearest: null,
    focus: null,
    mute: false,
    portalSafeRadius: 16
  };
  // One shared soundtrack registry prevents Starbase, Warp and Tower OSTs
  // from playing on top of one another and gives the note button one mute state.
  const gameOstTracks = new Map();
  if (musicAudio) {
    gameOstTracks.set("starbase", musicAudio);
    musicAudio.dataset.bcmGameOst = "starbase";
  }
  const liveWall = {
    el: null,
    texture: null,
    mesh: null,
    material: null,
    url: "",
    fallbackUrl: "",
    radius: 24,
    distance: 99,
    ready: false,
    primed: false,
    active: false,
    error: false
  };
  const liveInterior = [];
  const backside = {
    urls: Array.isArray(config.backsideTextures) ? config.backsideTextures.slice() : [],
    panels: [],
    materials: [],
    group: null,
    nextAt: 0
  };
  const spaceSatellite = {
    group: null,
    stationMesh: null,
    stars: null,
    visible: false
  };
  const spacePlanet = {
    mesh: null,
    visible: false
  };
  const race = {
    active: false,
    busy: false,
    laps: 0,
    needed: 2,
    nextGate: 1,
    segments: [],
    gates: [],
    group: null,
    prev: null,
    savedSpeedMode: null
  };
  const room0Labyrinth = {
    group: null,
    walls: [],
    active: false,
    // Keep the seeded labyrinth behind the original Room 1 start.
    // The former -1..-23 placement put invisible collision walls directly
    // in front of the player while moving forward.
    startZ: 7.0,
    endZ: 29.0
  };
  // Only the two visible starbase corridor shells are collision geometry.
  // Deep Space itself has no map boundary.
  const starbaseHull = [
    // Match the actual back*.png skin planes exactly: no extra invisible shell gap.
    { zMin: -25.5, zMax: 5.5, outerX: 16.0, outerY: 12.0 },
    { zMin: -84.5, zMax: -47.5, outerX: 16.0, outerY: 12.0 }
  ];
  let exteriorFlight = false;
  const impact = {
    overlay: null,
    light: null,
    strength: 0,
    cooldown: 0
  };
  const tilt = {
    enabled: false,
    available: false,
    bound: false,
    calibrating: false,
    samples: 0,
    sumB: 0,
    sumG: 0,
    filteredB: 0,
    filteredG: 0,
    filterReady: false,
    a: 0, b: 0, g: 0,
    na: 0, nb: 0, ng: 0,
    neutralB: 0, neutralG: 0
  };
  const pad = { index: -1, lx: 0, ly: 0, rx: 0, ry: 0, roll: 0, vert: 0, prev: [] };
  const gamepadMenuNav = { container: null, index: 0, previous: Object.create(null), lastMove: 0 };
  let keepLoadedMedia = false;

  let renderer, scene, camera, light;
  let running = false;
  let pointerLocked = false;
  let last = performance.now();
  let transitionBusy = false;
  let transitionLoading = false;
  let musicAllowed = false;
  // External Warp/tunnel overlay may pause 6DOF physics without destroying this renderer.
  let externalPause = false;
  let externalHud = null;

  function clearStoredInputState() {
    Object.keys(keys).forEach((code) => { keys[code] = false; });
    Object.keys(touch).forEach((control) => { touch[control] = false; });
    pad.lx = 0;
    pad.ly = 0;
    pad.rx = 0;
    pad.ry = 0;
    pad.roll = 0;
    pad.vert = 0;
  }

  function setSpeedMode(mode) {
    const next = speedMatrix[Number(mode)] ? Number(mode) : 1;
    speedMode = next;
    ship.thrust = speedMatrix[next].thrust;
    ship.maxSpeed = speedMatrix[next].maxSpeed;
    return speedMode;
  }

  const missionEl = root.querySelector(".bcm-mini-sim-mission");
  function showMission(text) {
    if (externalHud) return;
    if (missionEl) missionEl.textContent = text;
  }

  function setStatus(text) {
    if (externalHud) return;
    status.textContent = text;
  }

  function pollGamepadMenu() {
    if (!navigator.getGamepads) return false;
    let list; try { list = navigator.getGamepads(); } catch (e) { return false; }
    const gp = list && [...list].find((item) => item && item.connected);
    if (!gp) { gamepadMenuNav.container = null; return false; }
    const selectors = [
      ".bcm-warp-overlay:not([hidden]) .bcm-warp-map-view:not([hidden])",
      ".bcm-warp-overlay:not([hidden]) [data-tube-result]:not([hidden])",
      ".bcm-mini-sim-crew-preflight:not([hidden])",
      ".bcm-mini-sim-settings:not([hidden])",
      ".bcm-mini-sim-transition:not([hidden])"
    ];
    let menu = null;
    for (const selector of selectors) {
      const candidate = root.querySelector(selector);
      if (candidate && candidate.getBoundingClientRect().width > 0 && candidate.getBoundingClientRect().height > 0) { menu = candidate; break; }
    }
    if (!menu) {
      if (gamepadMenuNav.container) gamepadMenuNav.container.querySelectorAll(".bcm-gamepad-focused").forEach(n => n.classList.remove("bcm-gamepad-focused"));
      gamepadMenuNav.container = null; gamepadMenuNav.previous = Object.create(null); return false;
    }
    const choices = [...menu.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), [role='button']:not([aria-disabled='true'])")].filter(n => {
      if (n.closest("[hidden]")) return false;
      const r = n.getBoundingClientRect(), style = window.getComputedStyle(n);
      return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    if (!choices.length) return false;
    if (gamepadMenuNav.container !== menu) {
      if (gamepadMenuNav.container) gamepadMenuNav.container.querySelectorAll(".bcm-gamepad-focused").forEach(n => n.classList.remove("bcm-gamepad-focused"));
      gamepadMenuNav.container = menu; const active = choices.indexOf(document.activeElement);
      gamepadMenuNav.index = active >= 0 ? active : 0; gamepadMenuNav.previous = Object.create(null); focusGamepadMenuChoice(choices);
    }
    const button = n => !!(gp.buttons && gp.buttons[n] && gp.buttons[n].pressed), axes = gp.axes || [];
    const up = button(12) || (axes[1] || 0) < -.55, down = button(13) || (axes[1] || 0) > .55;
    const left = button(14) || (axes[0] || 0) < -.55, right = button(15) || (axes[0] || 0) > .55;
    const confirm = button(0), back = button(1) || button(8), now = performance.now();
    const move = d => { if (now - gamepadMenuNav.lastMove < 180) return; gamepadMenuNav.lastMove = now; gamepadMenuNav.index = (gamepadMenuNav.index + d + choices.length) % choices.length; focusGamepadMenuChoice(choices); };
    const isWarpMapMenu = menu.classList.contains("bcm-warp-map-view");
    if (up && !gamepadMenuNav.previous.up) move(-1);
    else if (down && !gamepadMenuNav.previous.down) move(1);
    else if (left && !gamepadMenuNav.previous.left) move(isWarpMapMenu ? 1 : -1);
    else if (right && !gamepadMenuNav.previous.right) move(isWarpMapMenu ? -1 : 1);
    if (confirm && !gamepadMenuNav.previous.confirm) { const c=choices[gamepadMenuNav.index]; if (c && typeof c.click==="function") c.click(); else if(c)c.focus(); }
    if (back && !gamepadMenuNav.previous.back) { const b=menu.querySelector("[data-warp-cancel], [data-warp-close], [data-setting='close'], .bcm-mini-sim-transition-close"); if(b&&!b.disabled)b.click(); }
    gamepadMenuNav.previous = { up, down, left, right, confirm, back }; return true;
  }
  function focusGamepadMenuChoice(choices) {
    choices.forEach((n,i)=>n.classList.toggle("bcm-gamepad-focused",i===gamepadMenuNav.index));
    const c=choices[gamepadMenuNav.index]; if(c&&typeof c.focus==="function"){try{c.focus({preventScroll:true});}catch(e){c.focus();}}
  }

  function hasConnectedGamepad() {
    if (!navigator.getGamepads) return false;
    try {
      const list = navigator.getGamepads();
      for (let i = 0; i < list.length; i++) {
        if (list[i]) return true;
      }
    } catch (e) {}
    return false;
  }

  function updateControlHelp() {
    if (!root) return;
    root.classList.toggle("gamepad-connected", hasConnectedGamepad());
  }

  function isIOSDevice() {
    const platform = String(navigator.platform || "");
    const ua = String(navigator.userAgent || "");
    return /iPhone|iPad|iPod/i.test(ua) ||
      (platform === "MacIntel" && Number(navigator.maxTouchPoints) > 1);
  }

  function mobileLandscape() {
    return !!(window.matchMedia &&
      window.matchMedia("(pointer: coarse) and (orientation: landscape)").matches);
  }

  function enterMobileFullscreen() {
    if (!mobileLandscape() || isIOSDevice()) return;

    try {
      if (root.requestFullscreen && !document.fullscreenElement) {
        const request = root.requestFullscreen({ navigationUI: "hide" });
        if (request && request.catch) request.catch(() => {});
      }
    } catch (e) {}

    try {
      if (screen.orientation && screen.orientation.lock) {
        const lock = screen.orientation.lock("landscape");
        if (lock && lock.catch) lock.catch(() => {});
      }
    } catch (e) {}
  }

  function hudAssets() {
    if (!assetStatus) return;
    assetStatus.textContent =
      "TEX " + stats.loaded + "/" + stats.total +
      (stats.failed ? " FAIL " + stats.failed + " " + stats.last : "") +
      (config.musicUrl ? " · OST" : " · NO OST");
    const bar = root.querySelector(".bcm-mini-sim-asset-bar > span");
    if (bar) {
      const pct = stats.total ? Math.round((stats.loaded / stats.total) * 100) : 0;
      bar.style.width = pct + "%";
    }
  }

  function applyTex(tex) {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if ("encoding" in tex && THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
  }
  function textureFromSource(source) {
    const tex = new THREE.Texture(source);
    // ImageBitmap already carries its image orientation; avoid Three.js flipping it again.
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      tex.flipY = false;
    }
    return tex;
  }

  function isMobileTextureMode() {
    return !!(window.matchMedia && window.matchMedia("(pointer: coarse) and (orientation: landscape)").matches);
  }

  function makeTextureSource(img, callback) {
    if (!img || !isMobileTextureMode() || !window.createImageBitmap) {
      callback(img);
      return;
    }

    const maxSize = 640;
    const width = Number(img.naturalWidth || img.width || 0);
    const height = Number(img.naturalHeight || img.height || 0);
    if (!width || !height || Math.max(width, height) <= maxSize) {
      callback(img);
      return;
    }

    const scale = maxSize / Math.max(width, height);
    const resizeWidth = Math.max(1, Math.round(width * scale));
    const resizeHeight = Math.max(1, Math.round(height * scale));

    window.createImageBitmap(img, {
      imageOrientation: "flipY",
      resizeWidth,
      resizeHeight,
      resizeQuality: "low"
    }).then((bitmap) => {
      callback(bitmap);
    }).catch(() => {
      callback(img);
    });
  }


  function textured(name, fallback, side) {
    const mat = new THREE.MeshBasicMaterial({
      color: fallback || 0x66707a,
      side: side || THREE.DoubleSide,
      fog: false
    });
    const url = assetUrl(name);
    stats.total++;
    hudAssets();
    if (!url) {
      stats.failed++;
      stats.loaded++;
      stats.last = name + " missing";
      hudAssets();
      return mat;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    // Audio keeps the sole high-priority slot. Initial room-surface images
    // start at normal priority; decorative/exterior assets use the later queue.
    try { img.fetchPriority = textureRequestPriority(name) <= 1 ? "auto" : "low"; } catch (e) {}
    img.onload = () => {
      if (miniSimReleased) return;
      try {
        makeTextureSource(img, (source) => {
          if (miniSimReleased) return;
          const tex = textureFromSource(source);
          applyTex(tex);
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
          stats.loaded++;
          hudAssets();
        });
      } catch (err) {
        stats.failed++;
        stats.loaded++;
        stats.last = name;
        hudAssets();
      }
    };
    img.onerror = () => {
      if (miniSimReleased) return;
      stats.failed++;
      stats.loaded++;
      stats.last = name + " 404";
      hudAssets();
    };
    img.src = url;
    return mat;
  }

  function deferredTextured(name, fallback, side) {
    const mat = new THREE.MeshBasicMaterial({
      color: fallback || 0x66707a,
      side: side || THREE.DoubleSide,
      fog: false
    });
    const url = assetUrl(name);
    stats.total++;
    hudAssets();
    if (!url) {
      stats.failed++;
      stats.loaded++;
      stats.last = name + " missing";
      hudAssets();
      return mat;
    }

    queueLowPriorityImage(url, (img) => {
      try {
        makeTextureSource(img, (source) => {
          const tex = textureFromSource(source);
          applyTex(tex);
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
          stats.loaded++;
          hudAssets();
        });
      } catch (err) {
        stats.failed++;
        stats.loaded++;
        stats.last = name;
        hudAssets();
      }
    }, () => {
      stats.failed++;
      stats.loaded++;
      stats.last = name + " 404";
      hudAssets();
    }, textureRequestPriority(name));

    return mat;
  }

  function plane(parent, x, y, z, w, h, rx, ry, rz, mat) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(mesh);
    return mesh;
  }

  function box(parent, x, y, z, sx, sy, sz, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function addRoofCorners(parent, z, width, height, variants) {
    // Corner trims are decorative rather than route-critical surfaces, so let
    // the priority queue fetch them after the OST, nearby walls, right video,
    // and the real portal transition request have already been issued.
    const corner = deferredTextured(
      seededVariant(variants || ["roofa.png", "roofa1.png", "roofa2.png"], z * 17 + width, "roofa.png"),
      0x8a9098
    );
    const corner2 = deferredTextured(
      seededVariant(["roofa.png", "roofa1.png", "roofa2.png"], z * 31 + height, "roofa1.png"),
      0x8a9098
    );
    const s = 1.6;
    plane(parent, -width / 2 + 0.8, height / 2 - 0.05, z, s, s, Math.PI / 2, 0, 0, corner);
    plane(parent, width / 2 - 0.8, height / 2 - 0.05, z, s, s, Math.PI / 2, 0, Math.PI / 2, corner2);
    plane(parent, -width / 2 + 0.8, height / 2 - 0.05, z - 8, s, s, Math.PI / 2, 0, -Math.PI / 2, deferredTextured("roofa2.png", 0x8a9098));
    plane(parent, width / 2 - 0.8, height / 2 - 0.05, z + 8, s, s, Math.PI / 2, 0, Math.PI, deferredTextured("roofa.png", 0x8a9098));
  }

  function buildShipVisual() {
    if (ship.visual) return ship.visual;

    const group = new THREE.Group();
    group.name = "player-ship-visual";

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x7d8794,
      metalness: 0.78,
      roughness: 0.28
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x202833,
      metalness: 0.55,
      roughness: 0.24
    });
    const trimMat = new THREE.MeshBasicMaterial({
      color: 0x9fdcff
    });
    const engineMat = new THREE.MeshBasicMaterial({
      color: 0x65b9ff
    });

    // Camera sits near the nose/cockpit; the body is mostly behind the camera,
    // so looking backwards reveals the actual rear of the craft.
    const fuselage = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.78, 3.8),
      hullMat
    );
    fuselage.position.set(0, -0.05, 1.45);
    group.add(fuselage);

    const rear = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.95, 0.85),
      darkMat
    );
    rear.position.set(0, 0, 3.1);
    group.add(rear);

    const wingL = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.12, 1.35),
      hullMat
    );
    wingL.position.set(-1.18, -0.08, 1.35);
    group.add(wingL);

    const wingR = wingL.clone();
    wingR.position.x = 1.18;
    group.add(wingR);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.95, 1.15),
      darkMat
    );
    tail.position.set(0, 0.52, 2.3);
    group.add(tail);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.12, 0.95),
      darkMat
    );
    canopy.position.set(0, 0.38, 0.42);
    group.add(canopy);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 2.1),
      trimMat
    );
    trim.position.set(0, 0.33, 1.55);
    group.add(trim);

    [-0.42, 0.42].forEach((x) => {
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.23, 0.35, 8),
        darkMat
      );
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x, -0.02, 3.48);
      group.add(nozzle);

      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.15, 0.12, 8),
        engineMat
      );
      glow.rotation.x = Math.PI / 2;
      glow.position.set(x, -0.02, 3.72);
      group.add(glow);
    });

    group.renderOrder = 3;
    scene.add(group);
    ship.visual = group;
    return group;
  }

  function buildRoom(parent, opt) {
    const tex = opt.deferTextures ? deferredTextured : textured;
    const floorName = seededVariant(opt.floorVariants || [opt.floor], opt.z * 101 + 1, opt.floor);
    const ceilingName = seededVariant(opt.ceilingVariants || [opt.ceiling], opt.z * 101 + 2, opt.ceiling);
    const leftName = seededVariant(opt.leftVariants || [opt.left], opt.z * 101 + 3, opt.left);
    const floor = tex(floorName, opt.floorColor);
    const ceil = tex(ceilingName, opt.ceilingColor);
    // The left wall is the main visual boundary when entering Room 2.
    // Keep it eager-loaded so the player never reaches the room before that
    // texture has a chance to leave the deferred queue.
    const left = opt.eagerLeftTexture
      ? textured(leftName, opt.leftColor)
      : tex(leftName, opt.leftColor);
    plane(parent, 0, -3.5, opt.z, opt.w, opt.len, -Math.PI / 2, 0, 0, floor);
    plane(parent, 0, 3.5, opt.z, opt.w, opt.len, Math.PI / 2, 0, 0, ceil);
    plane(parent, -opt.w / 2, 0, opt.z, opt.len, opt.h, 0, Math.PI / 2, 0, left);
    if (opt.right !== false) {
      const rightName = seededVariant(opt.rightVariants || [opt.right], opt.z * 101 + 4, opt.right);
      const right = tex(rightName, opt.rightColor);
      plane(parent, opt.w / 2, 0, opt.z, opt.len, opt.h, 0, -Math.PI / 2, 0, right);
    }


    addRoofCorners(parent, opt.z, opt.w, opt.h, opt.cornerVariants);
  }

  function buildStarbaseExterior(parent) {
    const allUrls = Array.isArray(backside.urls) ? backside.urls.filter(Boolean) : [];
    // Preserve the full texture cycle on desktop; keep a smaller pool on touch-landscape phones.
    const urls = isMobileTextureMode() ? allUrls.slice(0, 4) : allUrls;
    if (!urls.length) return;

    const group = new THREE.Group();
    group.name = "starbase-exterior-skeleton";

    // Exact outer envelope used by the back*.png shell.
    // The BLACK HOLE gap remains open between the two room shells.
    const width = 26.0;
    const height = 18.0;
    const outerX = width / 2 + 3.0;
    const outerY = height / 2 + 3.0;

    // Primary structural frame: keep the strong corridor ribs.
    const rail = 0.42;
    const panelGap = 0.0;
    const crossGap = 0.0;
    const panelFill = 0.0;
    const sideRows = 4;
    const roofCols = 4;
    const capRows = 4;
    const capCols = 4;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x242b33,
      metalness: 0.72,
      roughness: 0.34
    });

    function makeBackMaterial(url) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x303943,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: true,
        fog: false,
        toneMapped: false
      });

      const finish = (img) => {
        try {
          makeTextureSource(img, (source) => {
            const tex = textureFromSource(source);
            applyTex(tex);
            material.map = tex;
            material.color.set(0xffffff);
            material.needsUpdate = true;
          });
        } catch (err) {
          material.color.set(0x303943);
          material.needsUpdate = true;
        }
      };

      queueLowPriorityImage(url, finish, () => {
        material.color.set(0x303943);
        material.needsUpdate = true;
      }, 9);
      return material;
    }

    const materials = urls.map(makeBackMaterial);
    backside.materials = materials;
    const panels = [];

    function addPanel(material, x, y, z, w, h, rx, ry) {
      const mesh = plane(group, x, y, z, w, h, rx || 0, ry || 0, 0, material);
      mesh.name = "starbase-exterior-panel-" + panels.length;
      mesh.renderOrder = 1;
      panels.push({ mesh, material });
    }

    function addRing(z) {
      const ring = new THREE.Group();
      ring.position.z = z;

      // Main longitudinal/corner ribs stay strong and continuous.
      const left = new THREE.Mesh(
        new THREE.BoxGeometry(rail, height + rail, rail),
        frameMat
      );
      left.position.x = -outerX - 0.18;
      ring.add(left);

      const right = left.clone();
      right.position.x = outerX + 0.18;
      ring.add(right);

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(width + rail + 6.36, rail, rail),
        frameMat
      );
      top.position.y = outerY + 0.18;
      ring.add(top);

      const bottom = top.clone();
      bottom.position.y = -outerY - 0.18;
      ring.add(bottom);

      group.add(ring);
    }

    function addTube(z0, z1) {
      const length = Math.abs(z1 - z0);
      const section = 4.5;
      const count = Math.max(3, Math.ceil(length / section));
      const band = length / count;
      const panelHeight = height + 6.0 - panelFill;
      const panelWidth = width + 2.0 * 3.0 - panelFill;
      const sideCellH = (panelHeight - crossGap * (sideRows - 1)) / sideRows;
      const roofCellW = (panelWidth - crossGap * (roofCols - 1)) / roofCols;

      [
        [-outerX - 0.18, -outerY - 0.18],
        [-outerX - 0.18,  outerY + 0.18],
        [ outerX + 0.18, -outerY - 0.18],
        [ outerX + 0.18,  outerY + 0.18]
      ].forEach(([x, y]) => {
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(rail, rail, length),
          frameMat
        );
        beam.position.set(x, y, (z0 + z1) / 2);
        group.add(beam);
      });

      for (let i = 0; i <= count; i++) {
        const z = z0 - i * band;
        addRing(z);

        if (i >= count) continue;

        const center = z - band / 2;
        const segmentWidth = band - panelGap;

        // Side walls: split every back*.png band into rows as well as along Z.
        // This gives real horizontal panelization instead of only vertical strips.
        for (let row = 0; row < sideRows; row++) {
          const y = -panelHeight / 2 + sideCellH / 2 + row * (sideCellH + crossGap);
          const sideLeft = materials[(i * 7 + row * 2) % materials.length];
          const sideRight = materials[(i * 7 + row * 2 + 1) % materials.length];

          addPanel(sideLeft, -outerX, y, center, segmentWidth, sideCellH, 0, -Math.PI / 2);
          addPanel(sideRight, outerX, y, center, segmentWidth, sideCellH, 0, Math.PI / 2);
        }

        // Ceiling/floor: split every band across X too.
        for (let col = 0; col < roofCols; col++) {
          const x = -panelWidth / 2 + roofCellW / 2 + col * (roofCellW + crossGap);
          const top = materials[(i * 7 + 10 + col) % materials.length];
          const bottom = materials[(i * 7 + 14 + col) % materials.length];

          addPanel(top, x, outerY, center, roofCellW, segmentWidth, -Math.PI / 2, 0);
          addPanel(bottom, x, -outerY, center, roofCellW, segmentWidth, Math.PI / 2, 0);
        }

      }

      // Only the true outside-facing rear ends are capped with back*.png.
      // These caps are also 3x3, so the rear no longer looks like one giant image.
      function addCap(z, rotationY) {
        const capWidth = panelWidth;
        const capHeight = panelHeight;
        const cellW = (capWidth - crossGap * (capCols - 1)) / capCols;
        const cellH = (capHeight - crossGap * (capRows - 1)) / capRows;

        for (let row = 0; row < capRows; row++) {
          for (let col = 0; col < capCols; col++) {
            const x = -capWidth / 2 + cellW / 2 + col * (cellW + crossGap);
            const y = -capHeight / 2 + cellH / 2 + row * (cellH + crossGap);
            const material = materials[(row * capCols + col + (z > 0 ? 0 : 5)) % materials.length];
            addPanel(material, x, y, z, cellW, cellH, 0, rotationY);
          }
        }

      }

      if (z0 > 0) {
        addCap(z0 + 0.04, 0);
      }
      if (z1 < -80) {
        addCap(z1 - 0.04, Math.PI);
      }
    }

    // Only Room 1 and Room 2. BLACK HOLE remains open between them.
    addTube(5.5, -25.5);
    addTube(-47.5, -84.5);

    group.visible = false;
    parent.add(group);
    backside.group = group;
    backside.panels = panels;
    backside.nextAt = performance.now() + 1000;
    randomizeBackside(performance.now());
    startBackgroundTextureLoading();
  }

  function trackSurfaceName(kind, index) {
    const keys = Object.keys(byName);
    const match = keys.filter((key) => {
      const base = key.split("/").pop();
      return kind === "floor" ? /^floor.*\.png$/.test(base) : /^roof.*\.png$/.test(base);
    });
    if (!match.length) return "";
    return match[index % match.length];
  }

  function buildRoom0Labyrinth(parent, seed) {
    race.parent = parent || race.parent;
    if (race.group) {
      if (race.group.parent) race.group.parent.remove(race.group);
      race.group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
      });
      race.group = null;
    }
    const parentNode = race.parent;
    if (!parentNode) return;
    const group = new THREE.Group();
    group.name = "room3-slipstream";
    group.visible = !!race.active;
    const useSeed = (seed == null ? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) : seed) >>> 0;
    const rand = seedRandom(useSeed);
    const kind = Math.floor(rand() * 4);
    const z0 = 24;
    const point = (x, y, z) => new THREE.Vector3(x, y, z);
    const lift = () => 10 + rand() * 14;
    let corners;
    if (kind === 0) {
      const w = 48 + rand() * 24;
      const d = 56 + rand() * 28;
      const x = -18 + rand() * 12;
      corners = [point(x, 0, z0), point(x, lift(), z0 + d * 0.5), point(x, lift() + 8, z0 + d), point(x + w, lift(), z0 + d), point(x + w, 0, z0)];
    } else if (kind === 1) {
      const w = 36 + rand() * 20;
      const d = 44 + rand() * 24;
      const jog = 18 + rand() * 16;
      corners = [point(0, 0, z0), point(0, lift(), z0 + d), point(w, lift() + 10, z0 + d), point(w + jog, lift(), z0 + d * 0.45), point(w * 0.4, 0, z0)];
    } else if (kind === 2) {
      const w = 28 + rand() * 16;
      const d = 64 + rand() * 24;
      const x = 8 + rand() * 14;
      corners = [point(x, 0, z0), point(x, lift(), z0 + d * 0.35), point(x, lift() + 12, z0 + d), point(x + w * 2.2, lift(), z0 + d * 0.6), point(x + w, 4, z0)];
    } else {
      const w = 40 + rand() * 18;
      const d = 36 + rand() * 18;
      corners = [point(-16, 0, z0), point(-16, lift(), z0 + d * 0.4), point(10, lift() + 12, z0 + d), point(10 + w, lift(), z0 + d), point(10 + w, 6, z0 + d * 0.25), point(8, 0, z0)];
    }
    race.kindLabel = ["широкий овал", "собачья нога", "длинная петля", "зигзаг"][kind];
    const halfW = 11 + rand() * 3;
    const halfH = 2.5;
    race.segments = [];
    race.gates = [];
    const launch = corners[1].clone().sub(corners[0]);
    launch.normalize();
    race.spawn = {
      x: corners[0].x + launch.x * 4,
      y: corners[0].y,
      z: corners[0].z + launch.z * 4,
      yaw: Math.atan2(launch.x, -launch.z)
    };
    for (let i = 0; i < corners.length; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      const dir = b.clone().sub(a);
      const len = dir.length();
      dir.normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const yaw = Math.atan2(dir.x, dir.z);
      const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
      const floorName = trackSurfaceName("floor", i) || trackSurfaceName("roof", i) || "roof.png";
      const segment = new THREE.Group();
      segment.position.copy(mid);
      segment.lookAt(b);
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 2, 0.22, len),
        textured(floorName, 0x6d655c)
      );
      floor.position.y = -2.2;
      segment.add(floor);
      const ceiling = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 2, 0.18, len),
        textured(trackSurfaceName("roof", i + 1) || "roof.png", 0x8b9198)
      );
      ceiling.position.y = 6.2;
      segment.add(ceiling);
      const left = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 8.4, len),
        textured("wall3.png", 0x3b444f)
      );
      left.position.x = -halfW;
      segment.add(left);
      const right = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 8.4, len),
        textured("wall5.png", 0x343d47)
      );
      right.position.x = halfW;
      segment.add(right);
      group.add(segment);
      race.segments.push({ a, b, dir, side, len, halfW, halfH });
      race.gates.push({ point: mid.clone(), dir: dir.clone(), side: side.clone(), halfW: halfW - 0.3 });
    }
    parent.add(group);
    race.group = group;
    room0Labyrinth.group = group;
  }

  function updateRoom0Labyrinth() {
    if (race.group) race.group.visible = race.active;
    room0Labyrinth.active = race.active;
  }

  function constrainRace() {
    if (!race.active || !ship.position || !race.segments.length) return;
    let best = null;
    let bestDist = Infinity;
    race.segments.forEach((seg) => {
      const rel = ship.position.clone().sub(seg.a);
      const t = Math.max(0, Math.min(seg.len, rel.dot(seg.dir)));
      const point = seg.a.clone().add(seg.dir.clone().multiplyScalar(t));
      const dist = point.distanceTo(ship.position);
      if (dist < bestDist) {
        bestDist = dist;
        best = { seg, point, t };
      }
    });
    if (!best) return;
    if (bestDist > best.seg.halfW + 8) {
      ship.position.set(race.spawn.x, race.spawn.y || 0, race.spawn.z);
      ship.velocity.set(0, 0, 0);
      race.nextGate = 1;
      race.prev = null;
      setStatus("ВЫЛЕТ В КОСМОС · КРУГ СНОВА · 2 КРУГА БЕЗ ВЫЛЕТА");
      return;
    }
    const offset = ship.position.clone().sub(best.point);
    const sideAmt = offset.dot(best.seg.side);
    const y = ship.position.y;
    const limit = best.seg.halfW - 0.55;
    if (Math.abs(sideAmt) > limit) {
      ship.position.copy(best.point).add(best.seg.side.clone().multiplyScalar(Math.sign(sideAmt) * limit));
      ship.position.y = y;
      ship.velocity.multiplyScalar(0.4);
    }
    const roadY = best.point.y;
    if (ship.position.y > roadY + 4.2) ship.position.y = roadY + 4.2;
    if (ship.position.y < roadY - 1.4) ship.position.y = roadY - 1.4;

    const gate = race.gates[race.nextGate];
    if (gate && race.prev) {
      const along = ship.position.clone().sub(gate.point).dot(gate.dir);
      const prevAlong = race.prev.clone().sub(gate.point).dot(gate.dir);
      const lateral = Math.abs(ship.position.clone().sub(gate.point).dot(gate.side));
      if (prevAlong < 0.35 && along >= 0.35 && lateral < gate.halfW) {
        const hit = race.nextGate;
        race.nextGate = (race.nextGate + 1) % race.gates.length;
        if (hit === 0) {
          race.laps += 1;
          setStatus("SLIPSTREAM · КРУГ " + race.laps + "/2 · БЕЗ ВЫЛЕТА В КОСМОС");
          if (race.laps >= race.needed) finishRace();
        } else {
          setStatus("ОТСЕЧКА " + hit + " · КРУГ " + (race.laps + 1) + "/2 · НЕ ВЫЛЕТАТЬ В КОСМОС");
        }
      }
    }
    race.prev = ship.position.clone();
  }

  function beginRoom0Speed() {
    if (race.savedSpeedMode === null) race.savedSpeedMode = speedMode;
    setSpeedMode(3);
  }

  function restoreRoom0Speed() {
    if (race.savedSpeedMode !== null) setSpeedMode(race.savedSpeedMode);
    race.savedSpeedMode = null;
  }

  function placeOnSlipstream() {
    race.active = true;
    beginRoom0Speed();
    race.busy = false;
    race.laps = 0;
    race.nextGate = 1;
    race.prev = null;
    exteriorFlight = true;
    ship.position.set(race.spawn.x, race.spawn.y || 0, race.spawn.z);
    ship.velocity.set(0, 0, 0);
    ship.angularVelocity.set(0, 0, 0);
    ship.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), race.spawn.yaw || Math.PI);
    if (ship.visual) {
      ship.visual.position.copy(ship.position);
      ship.visual.quaternion.copy(ship.quaternion);
    }
    camera.position.copy(ship.position);
    camera.quaternion.copy(ship.quaternion);
    if (race.group) race.group.visible = true;
    showMission("МИССИЯ: 2 КРУГА ПО ТРАССЕ, НИ РАЗУ НЕ ВЫЛЕТАЯ В КОСМОС");
    setStatus("ROOM 0 · SPEED 3 · " + (race.kindLabel || "ТРАССА") + " · КРУГ 1/2");
  }

  function returnFromSlipstream() {
    race.active = false;
    restoreRoom0Speed();
    race.busy = false;
    race.laps = 0;
    race.nextGate = 1;
    if (race.group) race.group.visible = false;
    exteriorFlight = false;
    ship.position.set(0, 0, 2);
    ship.velocity.set(0, 0, 0);
    ship.angularVelocity.set(0, 0, 0);
    ship.quaternion.set(0, 0, 0, 1);
    if (ship.visual) {
      ship.visual.position.copy(ship.position);
      ship.visual.quaternion.copy(ship.quaternion);
    }
    camera.position.copy(ship.position);
    camera.quaternion.copy(ship.quaternion);
    showMission("МИССИЯ: ПРОВЕРИТЬ ЭКРАНЫ И ПРИЗЕМЛИТЬСЯ НА ONICSS");
    setStatus("ROOM 1 · ДВА КРУГА ЗАКРЫТЫ");
  }

  function playRaceCutscene(mode) {
    const url = mode === "enter"
      ? (config.capdoorVideo || assetUrl("capdoor.mp4") || assetUrl("portal2.mp4"))
      : (assetUrl("portal1.mp4") || assetUrl("portal2.mp4") || config.capdoorVideo);
    const finish = () => {
      transitionBusy = false;
      transitionLoading = false;
      if (transitionRoot) {
        transitionRoot.classList.remove("ready");
        transitionRoot.hidden = true;
      }
      if (transitionVideo) {
        transitionVideo.onended = null;
        transitionVideo.onerror = null;
        transitionVideo.pause();
        transitionVideo.removeAttribute("src");
        transitionVideo.load();
      }
      if (mode === "enter") placeOnSlipstream();
      else returnFromSlipstream();
    };
    if (!url || !transitionVideo || !transitionRoot) {
      finish();
      return;
    }
    transitionBusy = true;
    transitionLoading = true;
    race.busy = true;
    ship.velocity.set(0, 0, 0);
    ship.angularVelocity.set(0, 0, 0);
    transitionRoot.hidden = true;
    transitionVideo.style.opacity = "0";
    transitionVideo.muted = true;
    transitionVideo.playsInline = true;
    transitionVideo.onended = finish;
    transitionVideo.onerror = finish;
    transitionVideo.onloadeddata = () => {
      transitionLoading = false;
      transitionRoot.hidden = false;
      transitionRoot.classList.add("ready");
      transitionVideo.style.opacity = "1";
      const play = transitionVideo.play();
      if (play && play.catch) play.catch(() => finish());
    };
    if (transitionLabel) {
      transitionLabel.textContent = mode === "enter" ? "CAPDOOR · SLIPSTREAM" : "SLIPSTREAM · ROOM 1";
    }
    transitionVideo.src = url;
    transitionVideo.load();
  }

  function beginRaceCutscene() {
    if (race.active || race.busy || transitionBusy) return;
    if (race.parent) buildRoom0Labyrinth(race.parent);
    playRaceCutscene("enter");
  }

  function finishRace() {
    if (!race.active || race.busy) return;
    playRaceCutscene("return");
  }

  function collideRoom0Labyrinth() {
    if (race.active) constrainRace();
    return false;
  }

  function isInsideCorridor(position) {
    if (!position) return false;
    const inCorridorXY =
      Math.abs(position.x) <= 5.3 &&
      Math.abs(position.y) <= 3.2;
    if (!inCorridorXY) return false;

    const room1 = position.z > -24.5 && position.z <= 5.45;
    const room2 = position.z >= -84.5 && position.z < -47.46;
    return room1 || room2;
  }

  function updateBacksideVisibility() {
    // The photoli shell stays hidden only inside a corridor. Outside, in the
    // cavity between that corridor and the shell, and in open space, it shows.
    const exterior = !!(ship.position) && !isInsideCorridor(ship.position);

    if (backside.group) {
      const wasVisible = backside.group.visible;
      backside.group.visible = exterior;

      // The shell may stay hidden for minutes while the player is inside.
      // Re-stagger the timers on entry so every overdue panel does not change at once.
      if (exterior && !wasVisible) {
        const now = performance.now();
        backside.panels.forEach((item, index) => {
          item.nextAt = now + 800 + (index % 16) * 35 + Math.random() * 1600;
        });
      }
    }
  }

  function randomizeBackside(now) {
    const materials = backside.materials || [];
    if (!backside.panels.length || !materials.length) return;

    backside.panels.forEach((item) => {
      const material = materials[Math.floor(Math.random() * materials.length)];
      item.mesh.material = material;
      item.material = material;
      item.nextAt = now + 800 + Math.random() * 2200;
    });

    backside.nextAt = now + 250;
  }

  function updateBacksideCamouflage(now) {
    const materials = backside.materials || [];
    if (!backside.group || !backside.group.visible ||
        !backside.panels.length || !materials.length) return;

    backside.panels.forEach((item) => {
      if (!item.nextAt || now < item.nextAt) return;

      // Choose a different loaded-pool entry whenever possible so a timer tick
      // actually changes the panel instead of occasionally reselecting its texture.
      let material = materials[Math.floor(Math.random() * materials.length)];
      if (materials.length > 1 && material === item.material) {
        const current = materials.indexOf(item.material);
        let offset = 1 + Math.floor(Math.random() * (materials.length - 1));
        if (current < 0) offset = 1;
        material = materials[(Math.max(0, current) + offset) % materials.length];
      }
      if (item.mesh.material !== material) item.mesh.material = material;
      item.material = material;
      item.nextAt = now + 800 + Math.random() * 2200;
    });
  }

  function buildSpaceSatellite(parent) {
    const group = new THREE.Group();
    group.name = "space-satellite";
    group.position.set(0, 0, -155);
    group.visible = false;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x4b5662,
      metalness: 0.82,
      roughness: 0.3
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x18212b,
      metalness: 0.72,
      roughness: 0.26
    });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x9bd9ff });
    const beaconRed = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    const dockingMat = new THREE.MeshBasicMaterial({ color: 0xdbeeff });

    // Existing docking sphere: keep the geometry and station placement unchanged.
    // Only replace its material with the newly added OniStation.png texture.
    const stationMaterial = textured("OniStation.png", 0x18212b);
    const stationSphere = new THREE.Mesh(
      new THREE.SphereGeometry(4.4, 24, 16),
      stationMaterial
    );
    stationSphere.name = "oni-station-docking-sphere";
    stationSphere.userData.dockingRadius = 4.4;
    group.add(stationSphere);
    spaceSatellite.stationMesh = stationSphere;

    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(2.25, 2.7, 18, 12),
      frameMat
    );
    spine.rotation.x = Math.PI / 2;
    group.add(spine);

    group.add(new THREE.Mesh(
      new THREE.TorusGeometry(9.5, 0.55, 8, 36),
      frameMat
    ));
    group.add(new THREE.Mesh(
      new THREE.TorusGeometry(24, 0.8, 8, 56),
      frameMat
    ));

    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((angle, index) => {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 2.0, 12),
        frameMat
      );
      arm.position.set(Math.cos(angle) * 8.8, Math.sin(angle) * 8.8, 0);
      arm.rotation.z = angle + Math.PI / 2;
      group.add(arm);

      const bay = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 3.4, 4.5),
        darkMat
      );
      bay.position.set(Math.cos(angle) * 15.5, Math.sin(angle) * 15.5, 0);
      bay.rotation.z = angle;
      group.add(bay);

      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.22, 0.22),
        dockingMat
      );
      marker.position.set(Math.cos(angle) * 18.0, Math.sin(angle) * 18.0, 0);
      marker.rotation.z = angle;
      group.add(marker);

      const nav = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 8, 6),
        index % 2 ? beaconRed : lightMat
      );
      nav.position.set(Math.cos(angle) * 25.1, Math.sin(angle) * 25.1, 0);
      group.add(nav);
    });

    [-1, 1].forEach((side) => {
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 4.6, 8.5),
        darkMat
      );
      tower.position.set(0, 0, side * 11.5);
      group.add(tower);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 8, 6),
        beaconRed
      );
      beacon.position.set(0, 0, side * 16.2);
      group.add(beacon);
    });

    const namePlate = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.28, 0.22),
      lightMat
    );
    namePlate.position.set(0, -5.4, 0);
    group.add(namePlate);

    const planetMaterial = textured("OniStation.png", 0x496b8f);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(11, 24, 16),
      planetMaterial
    );
    planet.position.set(-26, 9, -190);
    planet.name = "deep-space-planet";
    parent.add(planet);
    spacePlanet.mesh = planet;

    parent.add(group);
    spaceSatellite.group = group;

    const starGeometry = new THREE.BufferGeometry();
    const starPoints = [];
    for (let i = 0; i < 420; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 55 + Math.random() * 150;
      const z = -70 - Math.random() * 220;
      starPoints.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    }
    starGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPoints, 3)
    );
    const starField = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xbcd8ff,
        size: 0.55,
        transparent: true,
        opacity: 0.7
      })
    );
    starField.name = "deep-space-starfield";
    starField.visible = false;
    parent.add(starField);
    spaceSatellite.stars = starField;
  }

  function updateSpaceSatelliteVisibility() {
    const zone = ship.position ? getSpaceZone(ship.position.z) : "ROOM1";
    const visible = zone === "ROOM2" || zone === "DEEP_SPACE";
    if (spaceSatellite.group) spaceSatellite.group.visible = visible;
    if (spaceSatellite.stars) spaceSatellite.stars.visible = visible;
    if (spacePlanet.mesh) spacePlanet.mesh.visible = visible;
    spaceSatellite.visible = visible;
    spacePlanet.visible = visible;
  }

  function buildWorld() {
    const world = new THREE.Group();
    world.userData.labyrinthSeed = labyrinthSeed;

    buildRoom(world, {
      z: -10, w: 12, len: 28, h: 8,
      floor: "wall1.png",
      floorVariants: ["wall1.png", "wall2.png"],
      ceiling: "roof.png",
      ceilingVariants: ["roof.png", "roof1.png", "roof3.png"],
      left: "wall3.png",
      leftVariants: ["wall3.png", "wall4.png", "wall5.png"],
      right: false,
      cornerVariants: ["roofa.png", "roofa1.png", "roofa2.png"],
      floorColor: 0x46505b, ceilingColor: 0x8b9198,
      leftColor: 0x3b444f, rightColor: 0x343d47
    });
    buildRoom(world, {
      z: -66, w: 12, len: 34, h: 8,
      floor: "wall2.png",
      ceiling: "roof1.png",
      left: "wall5.png",
      right: "wall1.png",
      cornerVariants: ["roofa.png", "roofa1.png", "roofa2.png"],
      deferTextures: true,
      eagerLeftTexture: true,
      floorColor: 0x343d48, ceilingColor: 0x7c838c,
      leftColor: 0x48535e, rightColor: 0x3a444f
    });

    // Room 1 stays unchanged. Room 0 is a separate seeded labyrinth that starts
    // behind the capdoor area at z=-1 and continues toward negative Z.
    buildRoom0Labyrinth(world);

    // BLACK HOLE and Deep Space are real open 3D volumes.
    // There is no finite black-hole box and no hidden visual boundary.
    buildStarbaseExterior(world);
    buildSpaceSatellite(world);

    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xf4f4f4 })
    );
    dock.position.set(0, 0, -36);
    dock.name = "dock-target";
    world.add(dock);
    portal.dock = dock;

    const frame = new THREE.MeshStandardMaterial({ color: 0x242a32, metalness: 0.7, roughness: 0.4 });

    const group = new THREE.Group();
    group.position.set(0, 0, -22);
    box(group, 0, 3.45, 0, 11.8, 0.45, 0.7, frame);
    box(group, 0, -3.45, 0, 11.8, 0.45, 0.7, frame);
    box(group, -5.9, 0, 0, 0.45, 6.8, 0.7, frame);
    box(group, 5.9, 0, 0, 0.45, 6.8, 0.7, frame);
    const dmat = textured("door2.png", 0xffffff);
    door.leaf = plane(group, 0, 0, -0.35, 11.6, 6.8, 0, 0, 0, dmat);
    door.left = door.leaf;
    door.right = null;
    scene.add(group);
    door.mesh = group;

    const returnGroup = new THREE.Group();
    returnGroup.position.set(0, 0, -27.2);
    box(returnGroup, 0, 3.45, 0, 11.8, 0.45, 0.7, frame);
    box(returnGroup, 0, -3.45, 0, 11.8, 0.45, 0.7, frame);
    box(returnGroup, -5.9, 0, 0, 0.45, 6.8, 0.7, frame);
    box(returnGroup, 5.9, 0, 0, 0.45, 6.8, 0.7, frame);
    const rmat = textured("door3.png", 0xffffff);
    returnDoor.leaf = plane(returnGroup, 0, 0, 0.35, 11.6, 6.8, 0, Math.PI, 0, rmat);
    returnDoor.left = returnDoor.leaf;
    returnDoor.right = null;
    scene.add(returnGroup);
    returnDoor.mesh = returnGroup;

    const pgroup = new THREE.Group();
    pgroup.position.set(0, 0, portal.z);
    const pmatFront = textured("portal.png", 0x88aacc, THREE.FrontSide);
    const pmatBack = textured("portal2.png", 0x88aacc, THREE.FrontSide);
    portal.mesh = plane(pgroup, 0, 0, 0.01, 11.8, 7.0, 0, 0, 0, pmatFront);
    portal.backMesh = plane(pgroup, 0, 0, -0.01, 11.8, 7.0, 0, Math.PI, 0, pmatBack);
    scene.add(pgroup);

    const videoZones = Array.isArray(config.spaceVideoZones) ? config.spaceVideoZones : [];
    videoZones.forEach((zone, index) => {
      if (!zone || !zone.url) return;
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      try { video.fetchPriority = "low"; } catch (e) {}
      video.volume = 0;

      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      if ("encoding" in texture && THREE.sRGBEncoding !== undefined) {
        texture.encoding = THREE.sRGBEncoding;
      }

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false
      });
      material.color.setRGB(1.14, 1.14, 1.14);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(zone.width || 5.8, zone.height || 3.4),
        material
      );
      mesh.position.set(zone.x || 0, zone.y || 0, zone.z || -36);
      mesh.name = "space-video-zone-" + index;
      mesh.renderOrder = 22;
      scene.add(mesh);

      // Space-screen videos stay lazy until the pilot is near them. In
      // particular, onicss.mp4 must not compete with the start-room textures.
      const item = {
        el: video,
        texture,
        mesh,
        url: zone.url,
        radius: Number(zone.radius) || 16,
        maxVolume: 1,
        active: false,
        visible: false,
        loaded: false,
        keepLoaded: !!zone.preloadWhenStarted,
        towerGate: !!zone.towerGate,
        distance: 99
      };

      video.addEventListener("loadedmetadata", () => {
        if (!item.mesh || !video.videoWidth || !video.videoHeight) return;
        const mobileSize = window.matchMedia && window.matchMedia("(pointer: coarse) and (orientation: landscape)").matches
          ? 1.80
          : 1;
        const maxW = (zone.maxWidth || 6.8) * mobileSize;
        const maxH = (zone.maxHeight || 4.4) * mobileSize;
        const aspect = video.videoWidth / video.videoHeight;
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        item.mesh.geometry.dispose();
        item.mesh.geometry = new THREE.PlaneGeometry(w, h);
      });

      video.addEventListener("error", () => {
        item.active = false;
        item.visible = false;
      });

      cinema.zones.push(item);
    });

    // Room 1 rear wall: personnel animation loads in the background while the player flies around.
    createInteriorVideoPanel({
      url: config.capdoorVideo,
      fallback: "wall1.png",
      x: 0,
      y: 0,
      z: 3.94,
      width: 11.8,
      height: 7.8,
      ry: 0,
      radius: 60,
      preloadRadius: 60,
      preloadWhenStarted: true,
      name: "room1-rear-capdoor"
    });

    // Room 1 right wall: restore the old Wall.mp4 placement.
    // wall1.png is used immediately as the closed-wall fallback while the video decodes.
    createInteriorVideoPanel({
      url: config.room1WallVideo,
      fallback: "wall1.png",
      x: 5.96,
      y: 0,
      z: -10,
      width: 28,
      height: 8,
      ry: -Math.PI / 2,
      radius: 32,
      preloadRadius: 38,
      name: "room1-right-wall-live"
    });

    // Room 2: the filename itself is the placement instruction — doorwallbotright.mp4 stays bottom-right.
    createInteriorVideoPanel({
      url: config.room2RightVideo,
      fallback: "wall1.png",
      x: 5.91,
      y: -2.02,
      z: -52.05,
      width: 5.6935,
      height: 2.94325,
      ry: -Math.PI / 2,
      radius: 24,
      preloadRadius: 420,
      preloadWhenStarted: true,
      name: "room2-right-wall-live-bottom-right"
    });

    scene.add(world);
    updateRoom0Labyrinth();
    if (status) {
      status.textContent = "LABYRINTH · SCREENS → LAND ON ONICSS · " + labyrinthSeed;
    }
  }

  function createInteriorVideoPanel(options) {
    if (!options || !options.url) return null;

    const material = textured(options.fallback || "wall1.png", options.color || 0x46505b, THREE.DoubleSide);
    material.depthTest = true;
    material.depthWrite = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.volume = 0;
    try { video.fetchPriority = "low"; } catch (e) {}

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    if ("encoding" in texture && THREE.sRGBEncoding !== undefined) {
      texture.encoding = THREE.sRGBEncoding;
    }

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(Number(options.width) || 6, Number(options.height) || 4),
      material
    );
    mesh.position.set(
      Number(options.x) || 0,
      Number(options.y) || 0,
      Number(options.z) || 0
    );
    mesh.rotation.set(
      Number(options.rx) || 0,
      Number(options.ry) || 0,
      Number(options.rz) || 0
    );
    mesh.name = options.name || "interior-video-panel";
    mesh.renderOrder = Number(options.renderOrder) || 20;
    scene.add(mesh);

    const item = {
      el: video,
      texture,
      material,
      mesh,
      url: options.url,
      radius: Number(options.radius) || 20,
      preloadRadius: Number(options.preloadRadius) || 99,
      preloadWhenStarted: !!options.preloadWhenStarted,
      loaded: false,
      ready: false,
      active: false,
      error: false,
      distance: 99
    };

    const reveal = () => {
      if (item.ready || item.error) return;
      item.ready = true;
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    };

    video.addEventListener("loadeddata", reveal);
    video.addEventListener("canplay", reveal);
    video.addEventListener("error", () => {
      item.error = true;
      item.active = false;
    });

    liveInterior.push(item);
    return item;
  }

  function preloadInteriorVideo(item) {
    if (!item || !item.el || item.loaded || !item.url) return;
    item.el.src = item.url;
    item.el.load();
    item.loaded = true;
  }

  function updateLiveInterior() {
    liveInterior.forEach((item) => {
      if (!item.el || !item.mesh) return;

      item.distance = item.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position);
      const visible = running &&
        !transitionBusy &&
        !settings.open &&
        item.distance <= item.radius;

      if (visible) {
        preloadInteriorVideo(item);
        if (item.el.paused) {
          const p = item.el.play();
          if (p && p.catch) p.catch(() => {});
        }
        item.active = true;
      } else {
        if (!item.el.paused) item.el.pause();
        item.active = false;

        if (!keepLoadedMedia && item.loaded && item.distance > Math.max(item.radius * 1.35, item.preloadRadius)) {
          item.el.pause();
          item.el.removeAttribute("src");
          item.el.load();
          item.loaded = false;
          item.ready = false;
        }
      }
    });
  }

  function warmInteriorVideo(item) {
    if (!item || !item.url) return;
    // Warm only the decoder/source. It stays paused until visible.
    preloadInteriorVideo(item);
  }

  function pauseInteriorVideos() {
    liveInterior.forEach((item) => {
      if (!item.el) return;
      item.el.pause();
      item.active = false;
    });
  }

  function createLiveWall() {
    if (liveWall.mesh) return;
    const cfg = config.liveWall || {};
    if (!cfg.url) return;

    const fallbackUrl = cfg.fallback || assetUrl("wall1.png");
    const fallbackMaterial = new THREE.MeshBasicMaterial({
      color: 0x46505b,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false
    });

    if (fallbackUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const tex = new THREE.Texture(img);
        applyTex(tex);
        fallbackMaterial.map = tex;
        fallbackMaterial.color.set(0xffffff);
        fallbackMaterial.needsUpdate = true;
      };
      img.src = fallbackUrl;
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.volume = 0;
    video.src = cfg.url;

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    if ("encoding" in texture && THREE.sRGBEncoding !== undefined) {
      texture.encoding = THREE.sRGBEncoding;
    }

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(Number(cfg.width) || 28, Number(cfg.height) || 8),
      fallbackMaterial
    );
    mesh.position.set(
      Number(cfg.x) || 6.01,
      Number(cfg.y) || 0,
      Number(cfg.z) || -10
    );
    mesh.rotation.y = Number(cfg.rotationY) || 0;
    mesh.name = "live-wall-video";
    mesh.renderOrder = 21;
    scene.add(mesh);

    liveWall.el = video;
    liveWall.texture = texture;
    liveWall.mesh = mesh;
    liveWall.material = fallbackMaterial;
    liveWall.url = cfg.url;
    liveWall.fallbackUrl = fallbackUrl || "";
    liveWall.radius = Number(cfg.radius) || 24;

    const revealFirstFrame = () => {
      if (liveWall.ready || liveWall.error) return;
      liveWall.ready = true;
      fallbackMaterial.map = texture;
      fallbackMaterial.color.set(0xffffff);
      fallbackMaterial.needsUpdate = true;
      liveWall.active = !video.paused;
      if (!running) {
        video.pause();
        liveWall.primed = true;
      }
    };

    video.addEventListener("loadeddata", revealFirstFrame);
    video.addEventListener("canplay", revealFirstFrame);
    video.addEventListener("error", () => {
      liveWall.error = true;
      liveWall.active = false;
    });

    // Prime decoding early; until the first decoded frame the fallback image remains visible.
    video.load();
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  }

  function liveWallOnScreen() {
    if (!liveWall.mesh || !camera) return false;

    const wallPos = liveWall.mesh.getWorldPosition(new THREE.Vector3());
    const toCamera = camera.position.clone().sub(wallPos).normalize();
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(liveWall.mesh.quaternion);
    const facingWall = normal.dot(toCamera);

    const viewDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const toWall = wallPos.clone().sub(camera.position).normalize();
    const lookAtWall = viewDir.dot(toWall);

    return facingWall > 0.12 && lookAtWall > 0.12 && zoneIsOnScreen({ mesh: liveWall.mesh });
  }

  function updateLiveWall() {
    if (!liveWall.el || !liveWall.mesh) return;

    liveWall.distance = liveWall.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position);
    const visible = running &&
      !transitionBusy &&
      !settings.open &&
      liveWall.distance <= liveWall.radius &&
      liveWallOnScreen();

    if (visible) {
      if (liveWall.ready && liveWall.el.paused) {
        const p = liveWall.el.play();
        if (p && p.catch) p.catch(() => {});
      }
      liveWall.active = true;
    } else {
      if (!liveWall.el.paused) liveWall.el.pause();
      liveWall.active = false;
    }

    if (interaction && liveWall.ready && visible) {
      interaction.textContent = "LIVE WALL · " + Math.round(Math.max(0, 100 - (liveWall.distance / liveWall.radius) * 100)) + "%";
    }
  }

  function applyDoorUnit(unit, p) {
    const leaf = unit.leaf || unit.left;
    if (!leaf) return;
    const t = Math.max(0, Math.min(1, p));
    const baseZ = unit === returnDoor ? 0.35 : -0.35;
    leaf.position.set(0, 0, baseZ);
    leaf.scale.set(1, 1, 1);

    // One full-width textured door leaf. It can slide, wipe upward, or disappear
    // toward the center, but it is never split into two visible doors.
    if (unit.style === "iris") {
      const sc = Math.max(0.02, 1 - t);
      leaf.scale.set(sc, sc, 1);
    } else if (unit.style === "wipe") {
      leaf.position.y = 6.8 * t;
    } else {
      leaf.position.x = -11.8 * t;
    }
  }

  function openDoor(reason) {
    if (door.state !== "CLOSED") return;
    door.style = ["slide", "wipe", "iris"][Math.floor(Math.random() * 3)];
    door.state = "OPENING";
    door.away = 0;
    setStatus((reason === "REMOTE" ? "DOOR REMOTE · " : "DOOR OPEN · ") + door.style);
  }

  function updateDoorUnit(unit, dt, label) {
    if (!unit.mesh) return;
    const dist = unit.mesh.position.distanceTo(ship.position);
    const to = unit.mesh.position.clone().sub(ship.position);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
    const facing = to.length() ? fwd.dot(to.normalize()) : -1;

    let shouldOpen = false;
    if (unit === returnDoor) {
      // Return gate opens only when approached from Room 2 / back side.
      shouldOpen = ship.position.z < unit.mesh.position.z + 0.5 && dist < 8;
    } else {
      // First gate keeps the original facing requirement.
      shouldOpen = dist < 8 && facing > 0.7;
    }

    if (unit.state === "CLOSED" && shouldOpen) {
      unit.style = ["slide", "wipe", "iris"][Math.floor(Math.random() * 3)];
      unit.state = "OPENING";
      unit.progress = 0;
      unit.away = 0;
      setStatus(label + " · " + unit.style);
    }

    if (unit.state === "OPENING") {
      unit.progress = Math.min(1, unit.progress + dt * unit.speed);
      applyDoorUnit(unit, unit.progress);
      if (unit.progress >= 1) unit.state = "OPEN";
    }

    if (unit.state === "OPEN") {
      if (dist > 5) {
        unit.away += dt;
        if (unit.away >= 4) unit.state = "CLOSING";
      } else {
        unit.away = 0;
      }
    }

    if (unit.state === "CLOSING") {
      unit.progress = Math.max(0, unit.progress - dt * unit.speed);
      applyDoorUnit(unit, unit.progress);
      if (unit.progress <= 0) {
        unit.state = "CLOSED";
        unit.away = 0;
      }
    }
  }

  function updateDoor(dt) {
    updateDoorUnit(door, dt, "DOOR OPEN");
    updateDoorUnit(returnDoor, dt, "RETURN GATE");
  }

  function ensureTowerCssLoaded() {
    if (towerPreload.cssLoaded || !config.towerCssUrl) return;
    if (document.querySelector('link[data-bcm-tower-preload-css="1"]')) {
      towerPreload.cssLoaded = true;
      return;
    }
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "style";
    link.href = config.towerCssUrl;
    link.dataset.bcmTowerPreloadCss = "1";
    document.head.appendChild(link);
    towerPreload.cssLoaded = true;
  }

  function ensureTowerJsLoaded() {
    if (window.BCMTowerAPI && typeof window.BCMTowerAPI.beginLanding === "function") return Promise.resolve(true);
    if (towerPreload.jsPromise) return towerPreload.jsPromise;
    if (!config.towerJsUrl) return Promise.resolve(false);

    // WordPress may already have inserted Tower.js but its async request may
    // not have executed yet. Do not mistake the presence of a script element
    // for a usable Tower API; leave the Mini-Sim live while it finishes.
    const wanted = new URL(config.towerJsUrl, document.baseURI);
    const existing = [...document.scripts].find((script) => {
      try { return new URL(script.src, document.baseURI).pathname === wanted.pathname; }
      catch (e) { return false; }
    });

    towerPreload.jsPromise = new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        resolve(!!ok);
      };
      const pollApi = () => {
        if (window.BCMTowerAPI && typeof window.BCMTowerAPI.beginLanding === "function") {
          finish(true);
          return;
        }
        if (performance.now() >= deadline) {
          finish(false);
          return;
        }
        window.setTimeout(pollApi, 100);
      };
      const deadline = performance.now() + 7000;

      if (existing) {
        existing.addEventListener("load", pollApi, { once: true });
        existing.addEventListener("error", () => finish(false), { once: true });
        pollApi();
        return;
      }

      const script = document.createElement("script");
      script.src = config.towerJsUrl;
      script.async = true;
      script.onload = pollApi;
      script.onerror = () => finish(false);
      document.head.appendChild(script);
      pollApi();
    });
    return towerPreload.jsPromise;
  }

  function preloadTowerApproach() {
    if (towerPreload.started) return;
    towerPreload.started = true;
    ensureTowerCssLoaded();

    // ONICSS is intentionally loaded only as the player approaches it, not
    // while building Room 1. Reuse the actual video zone element.
    const gate = getTowerGateZone();
    if (gate && gate.el && !gate.loaded && gate.url) {
      try {
        gate.el.preload = "auto";
        gate.el.fetchPriority = "auto";
      } catch (e) {}
      gate.el.src = gate.url;
      gate.el.load();
      gate.loaded = true;
    }

    const scriptReady = ensureTowerJsLoaded();
    if (window.BCMTowerAPI && typeof window.BCMTowerAPI.preloadLanding === "function") {
      window.BCMTowerAPI.preloadLanding();
    } else {
      Promise.resolve(scriptReady).then((ready) => {
        if (ready && window.BCMTowerAPI && typeof window.BCMTowerAPI.preloadLanding === "function") {
          window.BCMTowerAPI.preloadLanding();
        }
      });
    }
    if (status) setStatus("DEEP SPACE · TOWER PRELOAD");
  }

  function updateTowerApproachPreload() {
    if (!ship.position || !config.towerApproach) return;
    const target = config.towerApproach;
    const dx = ship.position.x - Number(target.x || 0);
    const dy = ship.position.y - Number(target.y || 0);
    const dz = ship.position.z - Number(target.z || 0);
    towerPreload.distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const radius = Number(target.preloadRadius) || 120;
    if (towerPreload.distance <= radius) {
      preloadTowerApproach();
    }
  }

  function getTowerGateZone() {
    return cinema.zones.find((zone) => zone && zone.towerGate) || null;
  }

  function meshCoverage(mesh) {
    if (!mesh || !camera) return 0;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    center.project(camera);
    if (center.z > 1) return 0;

    const min = new THREE.Vector2(Infinity, Infinity);
    const max = new THREE.Vector2(-Infinity, -Infinity);

    for (let xi = 0; xi <= 1; xi++) {
      for (let yi = 0; yi <= 1; yi++) {
        for (let zi = 0; zi <= 1; zi++) {
          const p = new THREE.Vector3(
            xi ? box.max.x : box.min.x,
            yi ? box.max.y : box.min.y,
            zi ? box.max.z : box.min.z
          );
          p.project(camera);
          min.x = Math.min(min.x, p.x);
          min.y = Math.min(min.y, p.y);
          max.x = Math.max(max.x, p.x);
          max.y = Math.max(max.y, p.y);
        }
      }
    }

    if (!Number.isFinite(min.x) || !Number.isFinite(min.y)) return 0;
    const width = Math.max(0, Math.min(2, max.x) - Math.max(-2, min.x));
    const height = Math.max(0, Math.min(2, max.y) - Math.max(-2, min.y));
    return Math.max(0, Math.min(1, (width * height) / 4));
  }

  function towerGateCoverage() {
    const gate = getTowerGateZone();
    if (!gate || !gate.mesh) return 0;
    return meshCoverage(gate.mesh);
  }

  function towerGateDistance() {
    const gate = getTowerGateZone();
    if (!gate || !gate.mesh || !ship.position) return Infinity;
    return gate.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position);
  }

  let towerGateTriggered = false;

  function resetPendingTowerHandoff(message) {
    towerGateTriggered = false;
    transitionLoading = false;
    transitionBusy = false;
    if (status && message) setStatus(message);
  }

  function handoffToTower() {
    const root = document.querySelector(".bcm-tower-embedded");
    if (!root) {
      resetPendingTowerHandoff("TOWER OVERLAY MISSING · SCENE CONTINUES");
      return;
    }

    // Keep the live scene, controls, onicss video and renderer untouched while
    // Tower.js initializes and tower.mp4 gets its first playable frame.
    preloadTowerApproach();
    Promise.resolve(ensureTowerJsLoaded()).then((ready) => {
      const api = window.BCMTowerAPI;
      if (!ready || !api || typeof api.beginLanding !== "function") {
        resetPendingTowerHandoff("TOWER ENGINE NOT READY · FLIGHT CONTINUES");
        return;
      }
      root.hidden = false;
      const started = api.beginLanding((success) => {
        if (miniSimReleased) return;
        if (!success) {
          resetPendingTowerHandoff("TOWER VIDEO NOT READY · FLIGHT CONTINUES");
          root.hidden = true;
          return;
        }
        // Take over only once tower.mp4 is really playing, never at the H1
        // trigger or when the async Tower script/video merely starts loading.
        transitionLoading = false;
        transitionBusy = true;
        ship.velocity.set(0, 0, 0);
        ship.angularVelocity.set(0, 0, 0);
        pauseAllCinemaVideos();
        disposeMiniSimResources();
      });
      if (started === false) {
        resetPendingTowerHandoff("TOWER LANDING START FAILED · FLIGHT CONTINUES");
        root.hidden = true;
      }
    }).catch(() => {
      resetPendingTowerHandoff("TOWER PRELOAD FAILED · FLIGHT CONTINUES");
      if (root) root.hidden = true;
    });
  }

  function beginTowerLanding() {
    if (towerGateTriggered || transitionBusy) return;
    towerGateTriggered = true;
    // Do not pause screens or dispose Mini-Sim while the transition is only
    // buffering. handoffToTower owns the first-frame takeover callback.
    handoffToTower();
  }

  function enterTowerFromGate() {
    if (towerGateTriggered || transitionBusy) return;
    if (!document.querySelector(".bcm-tower-embedded")) {
      setStatus("TOWER OVERLAY MISSING");
      return;
    }
    beginTowerLanding();
  }

  function portalCoverage() {
    if (!portal.mesh || !camera || !renderer) return 0;
    const box = new THREE.Box3().setFromObject(portal.mesh);
    const c = box.getCenter(new THREE.Vector3());
    c.project(camera);
    if (c.z > 1) return 0;
    const size = box.getSize(new THREE.Vector3());
    const dist = camera.position.distanceTo(portal.mesh.getWorldPosition(new THREE.Vector3()));
    if (dist < 0.2) return 1;
    const approx = (6 / dist) * (6 / dist);
    return Math.max(0, Math.min(1, approx));
  }

  function portalSide() {
    if (!portal.mesh) return "UNKNOWN";
    const z = ship.position.z;
    const frontDistance = Math.abs(z - portal.triggerFrontZ);
    const backDistance = Math.abs(z - portal.triggerBackZ);
    if (z > portal.z + 0.45) return "FRONT";
    if (z < portal.z - 0.45) return "BACK";
    return backDistance < frontDistance ? "BACK" : "FRONT";
  }

  function portalTriggerDistance(side) {
    const targetZ = side === "BACK" ? portal.triggerBackZ : portal.triggerFrontZ;
    return Math.sqrt(
      ship.position.x * ship.position.x +
      ship.position.y * ship.position.y +
      (ship.position.z - targetZ) * (ship.position.z - targetZ)
    );
  }

  function returnToStart() {
    if (!running || transitionBusy || !ship.position) return;
    pauseAllCinemaVideos();
    stopMiniSimAudio();
    try { window.BCMTowerAPI?.stopAudio?.(); } catch (e) {}

    // Home is Room 1 at ONI CSS, never the active Room 0 race spawn.
    // Disable Room 0 constraints before moving the ship so the next physics
    // frame cannot pull it back into the labyrinth.
    race.active = false;
    restoreRoom0Speed();
    race.busy = false;
    race.laps = 0;
    race.nextGate = 1;
    race.prev = null;
    if (race.group) race.group.visible = false;
    updateRoom0Labyrinth();

    exteriorFlight = false;
    ship.position.set(0, 0, 2);
    ship.velocity.set(0, 0, 0);
    ship.angularVelocity.set(0, 0, 0);
    ship.quaternion.set(0, 0, 0, 1);
    door.state = "CLOSED"; door.progress = 0; door.away = 0; applyDoorUnit(door, 0);
    returnDoor.state = "CLOSED"; returnDoor.progress = 0; returnDoor.away = 0; applyDoorUnit(returnDoor, 0);
    updateBacksideVisibility();
    updateCinemaZones();
    updateLiveWall();
    if (ship.visual) {
      ship.visual.position.copy(ship.position);
      ship.visual.quaternion.copy(ship.quaternion);
    }
    camera.position.copy(ship.position);
    camera.quaternion.copy(ship.quaternion);

    // Restart the correct Starbase soundtrack from the Home state. The shared
    // mute setting remains authoritative and other OSTs are stopped by the mixer.
    startMusic();
    setStatus("ROOM 1 · HOME · ONI CSS");
  }

  // Back/Backspace restarts only the current area; loaded media and OST are preserved.
  function resetCurrentRoom() {
    if (!running || transitionBusy || !ship.position) return;
    keepLoadedMedia = true;
    const zone = getSpaceZone(ship.position.z);
    if (race.active && race.spawn) {
      race.laps = 0; race.nextGate = 1; race.prev = null;
      ship.position.set(race.spawn.x, race.spawn.y || 0, race.spawn.z);
      ship.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), race.spawn.yaw || Math.PI);
      if (race.group) race.group.visible = true;
      updateRoom0Labyrinth();
      showMission("ROOM 0 · ПЕРЕЗАПУСК ТЕКУЩЕЙ ТРАССЫ");
      setStatus("ROOM 0 · RESTARTED · LOADED ASSETS RETAINED");
    } else {
      const anchorZ = zone === "ROOM1" ? 2.0 : zone === "BLACK_HOLE" ? -26.0 : zone === "ROOM2" ? -50.0 : -88.0;
      ship.position.set(0, 0, anchorZ);
      ship.quaternion.set(0, 0, 0, 1);
      showMission("МИССИЯ: ТЕКУЩАЯ ЗОНА ПЕРЕЗАПУЩЕНА · РЕСУРСЫ СОХРАНЕНЫ");
      setStatus(zone + " · RESTARTED · LOADED ASSETS RETAINED");
    }
    ship.velocity.set(0, 0, 0);
    ship.angularVelocity.set(0, 0, 0);
    if (ship.visual) { ship.visual.position.copy(ship.position); ship.visual.quaternion.copy(ship.quaternion); }
    camera.position.copy(ship.position);
    camera.quaternion.copy(ship.quaternion);
    updateCinemaZones();
    updateLiveWall();
    updateLiveInterior();
    updateBacksideVisibility();
  }

  function finishTeleport() {
    const direction = portal.direction;
    transitionBusy = false;
    transitionLoading = false;
    if (transitionRoot) {
      transitionRoot.classList.remove("ready");
      transitionRoot.hidden = true;
    }
    if (transitionVideo) {
      transitionVideo.style.opacity = "0";
      transitionVideo.pause();
      transitionVideo.removeAttribute("src");
      transitionVideo.load();
    }

    if (direction === "BACK") {
      exteriorFlight = false;
      ship.position.set(0, 0, 2);
      ship.velocity.set(0, 0, 0);
      ship.angularVelocity.set(0, 0, 0);
      ship.quaternion.set(0, 0, 0, 1);
      updateCinemaZones();
      setStatus("ROOM 1 · RETURN COMPLETE");
    } else {
      exteriorFlight = false;
      ship.position.set(0, 0, -52);
      ship.velocity.set(0, 0, 0);
      ship.angularVelocity.set(0, 0, 0);
      ship.quaternion.set(0, 0, 0, 1);
      updateCinemaZones();
      setStatus("ROOM 2 · TELEPORT COMPLETE");
    }
  }

  function portalVideoUrl(direction) {
    return direction === "BACK"
      ? (assetUrl("portal1.mp4") || assetUrl("portal3.mp4") || assetUrl("portal2.mp4"))
      : (assetUrl("portal2.mp4") || assetUrl("portal3.mp4") || assetUrl("portal1.mp4"));
  }

  function primePortalVideo(direction, priority) {
    if (!transitionVideo) return false;
    const url = portalVideoUrl(direction);
    if (!url) return false;
    const absolute = (value) => {
      try { return new URL(value, document.baseURI).href; }
      catch (e) { return String(value || ""); }
    };
    const current = transitionVideo.getAttribute("src");
    if (current && absolute(current) === absolute(url)) {
      return transitionVideo.readyState >= 2;
    }
    transitionVideo.muted = true;
    transitionVideo.defaultMuted = true;
    transitionVideo.playsInline = true;
    transitionVideo.setAttribute("muted", "");
    transitionVideo.setAttribute("playsinline", "");
    transitionVideo.setAttribute("webkit-playsinline", "");
    transitionVideo.preload = "auto";
    try { transitionVideo.fetchPriority = priority || "high"; } catch (e) {}
    transitionVideo.src = url;
    transitionVideo.load();
    return transitionVideo.readyState >= 2;
  }

  function playPortalVideo(direction) {
    if (transitionBusy || transitionLoading) return;

    portal.direction = direction === "BACK" ? "BACK" : "FORWARD";
    const url = portalVideoUrl(portal.direction);
    if (!url || !transitionVideo || !transitionRoot) {
      setStatus("PORTAL VIDEO MISSING · CONTROLS RESTORED");
      return;
    }

    // Buffer in the background without stopping the ship, simulation, camera,
    // or input. The lock begins only from the video element's onplaying event.
    transitionLoading = true;
    if (transitionRoot) {
      transitionRoot.classList.remove("ready");
      transitionRoot.hidden = true;
    }
    transitionVideo.style.opacity = "0";
    transitionVideo.muted = true;
    transitionVideo.defaultMuted = true;
    transitionVideo.setAttribute("muted", "");
    transitionVideo.setAttribute("playsinline", "");
    transitionVideo.setAttribute("webkit-playsinline", "");
    transitionVideo.playsInline = true;
    transitionVideo.preload = "auto";
    try { transitionVideo.fetchPriority = "high"; } catch (e) {}

    let playRequested = false;
    let activated = false;
    const activateTransition = () => {
      if (activated || !transitionLoading || transitionVideo.readyState < 2) return;
      activated = true;
      transitionLoading = false;
      transitionBusy = true;
      ship.velocity.set(0, 0, 0);
      ship.angularVelocity.set(0, 0, 0);
      pauseAllCinemaVideos();
      if (transitionRoot) {
        transitionRoot.hidden = false;
        transitionRoot.classList.add("ready");
      }
      transitionVideo.style.opacity = "1";
    };
    const requestPlayback = () => {
      if (playRequested || !transitionLoading || transitionVideo.readyState < 2) return;
      playRequested = true;
      const result = transitionVideo.play();
      if (result && result.catch) {
        result.catch(() => {
          // Do not freeze or teleport on an autoplay rejection; controls remain live.
          playRequested = false;
          transitionLoading = false;
          transitionBusy = false;
          if (transitionRoot) {
            transitionRoot.classList.remove("ready");
            transitionRoot.hidden = true;
          }
          setStatus("PORTAL VIDEO READY · PRESS G / Y AGAIN");
        });
      }
    };

    transitionVideo.onloadedmetadata = () => {
      try { transitionVideo.currentTime = 0; } catch (e) {}
    };
    transitionVideo.onloadeddata = requestPlayback;
    transitionVideo.oncanplay = requestPlayback;
    transitionVideo.onplaying = activateTransition;
    transitionVideo.onended = finishTeleport;
    transitionVideo.onerror = () => {
      transitionLoading = false;
      transitionBusy = false;
      if (transitionRoot) {
        transitionRoot.classList.remove("ready");
        transitionRoot.hidden = true;
      }
      setStatus("PORTAL MP4 ERROR · CONTROLS RESTORED");
    };

    if (transitionLabel) {
      transitionLabel.textContent = portal.direction === "BACK"
        ? "CUTSCENE · ROOM 2 → ROOM 1"
        : "CUTSCENE · ROOM 1 → ROOM 2";
    }

    const current = transitionVideo.getAttribute("src");
    const absolute = (value) => {
      try { return new URL(value, document.baseURI).href; }
      catch (e) { return String(value || ""); }
    };
    if (!current || absolute(current) !== absolute(url)) {
      transitionVideo.src = url;
      transitionVideo.load();
    }
    if (transitionVideo.readyState >= 2) requestPlayback();
  }

  function tryPortal() {
    if (!running || transitionBusy || transitionLoading) return;

    const side = portalSide();
    const triggerDistance = portalTriggerDistance(side);
    const isBack = side === "BACK";

    if (isBack) {
      const backTrigger = Number(config.towerApproach?.backPortalDistance) || 8.5;
      if (triggerDistance > backTrigger) {
        setStatus("PORTAL RETURN · APPROACH");
        return;
      }
      playPortalVideo("BACK");
      return;
    }

    const dist = portal.mesh
      ? portal.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position)
      : 99;

    const portalCoverageThreshold = Number(config.towerApproach?.portalCoverageThreshold) || 0.60;
    if (portal.coverage < portalCoverageThreshold) {
      setStatus("PORTAL · " + Math.round(portal.coverage * 100) + "% / NEED " + Math.round(portalCoverageThreshold * 100) + "%");
      return;
    }
    playPortalVideo("FORWARD");
  }

  function dz(v, d) {
    if (Math.abs(v) <= d) return 0;
    const s = v < 0 ? -1 : 1;
    return s * Math.min(1, (Math.abs(v) - d) / (1 - d));
  }

  function readPad() {
    if (!navigator.getGamepads) return;
    let list;
    try { list = navigator.getGamepads(); } catch (e) { return; }
    let gp = pad.index >= 0 ? list[pad.index] : null;
    if (!gp) {
      pad.index = -1;
      for (let i = 0; i < list.length; i++) if (list[i]) { pad.index = i; gp = list[i]; break; }
    }
    if (!gp) {
      pad.lx = pad.ly = pad.rx = pad.ry = pad.roll = pad.vert = 0;
      return;
    }
    const ax = gp.axes || [];
    pad.lx = dz(ax[0] || 0, 0.16);
    pad.ly = dz(ax[1] || 0, 0.16);
    pad.rx = dz(ax[2] || 0, 0.14);
    pad.ry = dz(ax[3] || 0, 0.14);
    const btn = (n) => !!(gp.buttons && gp.buttons[n] && (gp.buttons[n].pressed || gp.buttons[n].value > 0.5));
    pad.roll = (btn(5) ? 1 : 0) - (btn(4) ? 1 : 0);
    pad.vert = (btn(7) ? 1 : 0) - (btn(6) ? 1 : 0);
    const edge = (n, fn) => {
      const on = btn(n);
      if (on && !pad.prev[n] && running) fn();
      pad.prev[n] = on;
    };
    // B remains full-home; the separate Back/Select button restarts the current area.
    edge(0, () => openDoor("REMOTE"));
    edge(1, returnToStart);
    edge(2, toggleCinemaFocus);
    edge(3, () => { if (typeof window.BCMDeepSpaceWarpToggle === "function") window.BCMDeepSpaceWarpToggle(); else tryPortal(); });
    edge(10, tryPortal);
    edge(9, toggleSettings);
    edge(8, resetCurrentRoom);
  }

  function tiltLook() {
    if (!tilt.enabled || !tilt.available) return { pitch: 0, yaw: 0 };

    const beta = tilt.filteredB - tilt.neutralB;
    const gamma = tilt.filteredG - tilt.neutralG;
    const angleRaw = screen.orientation && typeof screen.orientation.angle === "number"
      ? screen.orientation.angle
      : (typeof window.orientation === "number" ? window.orientation : 90);
    const angle = ((angleRaw % 360) + 360) % 360;

    // Landscape rotates the deviceorientation axes relative to the screen.
    // 90°: screen vertical comes from gamma; screen horizontal comes from beta.
    // 270°: both axes reverse.
    let screenVertical = beta;
    let screenHorizontal = gamma;
    if (angle === 90) {
      screenVertical = -gamma;
      screenHorizontal = -beta;
    } else if (angle === 270) {
      screenVertical = gamma;
      screenHorizontal = beta;
    } else if (angle === 180) {
      screenVertical = -beta;
      screenHorizontal = -gamma;
    }

    const pitchOffset = Math.max(-35, Math.min(35, screenVertical));
    const yawOffset = Math.max(-35, Math.min(35, screenHorizontal));
    const dead = 4.0;
    const response = 30.0;
    const gain = 0.40;

    const shape = (offset) => {
      if (Math.abs(offset) <= dead) return 0;
      const t = Math.max(0, Math.min(1, (Math.abs(offset) - dead) / (response - dead)));
      return Math.sign(offset) * t;
    };

    return {
      pitch: (settings.invertPitch ? 1 : -1) * shape(pitchOffset) * gain,
      yaw: (settings.invertYaw ? 1 : -1) * shape(yawOffset) * gain
    };
  }

  function pauseAllCinemaVideos() {
    cinema.zones.forEach((zone) => {
      if (zone.el) {
        zone.el.pause();
        zone.el.volume = 0;
      }
      zone.active = false;
      zone.visible = false;
    });
    if (liveWall.el) {
      liveWall.el.pause();
      liveWall.active = false;
    }
    pauseInteriorVideos();
    cinema.nearest = null;
  }

  function disposeMiniSimResources() {
    if (miniSimReleased) return;
    miniSimReleased = true;

    running = false;
    transitionBusy = true;
    transitionLoading = false;

    if (document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (e) {}
    }

    // Stop every HTML video/audio source owned by the first game.
    try { pauseAllCinemaVideos(); } catch (e) {}
    if (transitionVideo) {
      try {
        transitionVideo.pause();
        transitionVideo.removeAttribute("src");
        transitionVideo.load();
      } catch (e) {}
    }
    if (musicAudio) {
      try {
        musicAudio.pause();
        musicAudio.removeAttribute("src");
        musicAudio.load();
      } catch (e) {}
    }

    // Do not let the low-priority image queue continue after handoff.
    backgroundTextureQueue.jobs.length = 0;
    backgroundTextureQueue.running = false;
    backgroundTextureQueue.seen = Object.create(null);

    // Release video elements and VideoTextures held by the cinema/interior systems.
    cinema.zones.forEach((zone) => {
      if (!zone) return;
      if (zone.el) {
        try {
          zone.el.pause();
          zone.el.removeAttribute("src");
          zone.el.load();
        } catch (e) {}
      }
      if (zone.texture?.dispose) {
        try { zone.texture.dispose(); } catch (e) {}
      }
    });
    liveInterior.forEach((item) => {
      if (!item) return;
      if (item.el) {
        try {
          item.el.pause();
          item.el.removeAttribute("src");
          item.el.load();
        } catch (e) {}
      }
      if (item.texture?.dispose) {
        try { item.texture.dispose(); } catch (e) {}
      }
    });
    if (liveWall.el) {
      try {
        liveWall.el.pause();
        liveWall.el.removeAttribute("src");
        liveWall.el.load();
      } catch (e) {}
    }
    if (liveWall.texture?.dispose) {
      try { liveWall.texture.dispose(); } catch (e) {}
    }

    const seenTextures = new Set();
    const seenMaterials = new Set();
    const seenGeometries = new Set();

    const disposeTexture = (texture) => {
      if (!texture || !texture.dispose || seenTextures.has(texture)) return;
      seenTextures.add(texture);
      try { texture.dispose(); } catch (e) {}
    };

    const disposeMaterial = (material) => {
      if (!material || seenMaterials.has(material)) return;
      seenMaterials.add(material);

      const maps = [
        "map", "alphaMap", "aoMap", "bumpMap", "displacementMap",
        "emissiveMap", "envMap", "lightMap", "metalnessMap",
        "normalMap", "roughnessMap"
      ];
      maps.forEach((key) => disposeTexture(material[key]));
      try { material.dispose(); } catch (e) {}
    };

    const disposeObject = (object) => {
      if (!object) return;
      if (object.geometry && !seenGeometries.has(object.geometry)) {
        seenGeometries.add(object.geometry);
        try { object.geometry.dispose(); } catch (e) {}
      }

      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(object.material);
        }
      }

      if (object.children) {
        object.children.forEach(disposeObject);
      }
    };

    if (scene) {
      try { scene.traverse(disposeObject); } catch (e) {}
      try { scene.clear(); } catch (e) {
        while (scene.children.length) scene.remove(scene.children[scene.children.length - 1]);
      }
    }

    if (renderer) {
      try {
        if (renderer.renderLists?.dispose) renderer.renderLists.dispose();
      } catch (e) {}
      try { renderer.dispose(); } catch (e) {}
      // renderer.dispose() releases the first simulation's GL resources.
      // Do not force a context loss here: Tower already owns a separate WebGL
      // renderer, and a forced GPU context reset can leave its canvas blank.
    }

    ship.visual = null;
    cinema.zones.length = 0;
    liveInterior.length = 0;
    backside.panels.length = 0;
    backside.materials.length = 0;
    backside.group = null;
    spaceSatellite.group = null;
    spaceSatellite.stationMesh = null;
    spaceSatellite.stars = null;
    towerPreload.landingVideo = null;
    towerPreload.fallbackVideo = null;

    // The Tower overlay is now the active application; remove the first game's
    // DOM/render surface from layout as well.
    root.style.display = "none";
    root.classList.remove("game-active");
  }

  function registerGameOst(audio, channel) {
    if (!audio) return null;
    const key = String(channel || "other");
    gameOstTracks.set(key, audio);
    audio.dataset.bcmGameOst = key;
    audio.muted = cinema.mute;
    return audio;
  }

  function playExclusiveGameOst(audio, channel) {
    registerGameOst(audio, channel);
    if (!audio) return null;
    gameOstTracks.forEach((other) => {
      if (other && other !== audio) {
        try { other.pause(); } catch (e) {}
      }
    });
    if (String(channel) === "starbase") audio.volume = settings.volume;
    audio.muted = cinema.mute;
    try {
      return audio.play();
    } catch (e) {
      return null;
    }
  }

  function syncMusicButton() {
    if (!musicButton) return;
    musicButton.classList.toggle("is-muted", cinema.mute);
    musicButton.setAttribute("aria-pressed", cinema.mute ? "true" : "false");
    musicButton.setAttribute("aria-label", cinema.mute ? "Включить музыку" : "Выключить музыку");
    musicButton.title = cinema.mute ? "Музыка выключена · нажмите, чтобы включить" : "Музыка включена · нажмите, чтобы выключить";
  }

  function setAudioMute(value) {
    cinema.mute = !!value;
    gameOstTracks.forEach((audio) => {
      if (audio) audio.muted = cinema.mute;
    });
    cinema.zones.forEach((zone) => {
      if (zone.el) zone.el.muted = cinema.mute;
    });
    syncMusicButton();
    window.dispatchEvent(new CustomEvent("bcm:game-music-mute", {
      detail: { muted: cinema.mute }
    }));
  }

  window.BCMGameAudio = Object.assign(window.BCMGameAudio || {}, {
    register: registerGameOst,
    playExclusive: playExclusiveGameOst,
    setMuted: setAudioMute,
    isMuted: () => cinema.mute,
    stop: (audio, reset) => {
      if (!audio) return;
      try {
        audio.pause();
        if (reset) audio.currentTime = 0;
      } catch (e) {}
    }
  });
  setAudioMute(cinema.mute);

  function zoneIsOnScreen(zone) {
    if (!camera || !zone.mesh) return false;

    const sphere = new THREE.Sphere(
      zone.mesh.getWorldPosition(new THREE.Vector3()),
      Math.max(zone.mesh.geometry.parameters.width || 6, zone.mesh.geometry.parameters.height || 3) * 0.8
    );
    const frustum = new THREE.Frustum();
    camera.updateMatrixWorld(true);
    const projection = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projection);
    return frustum.intersectsSphere(sphere);
  }

  function updateCinemaZones() {
    if (!cinema.zones.length) {
      if (musicAudio && !cinema.mute) musicAudio.volume = settings.volume;
      cinema.nearest = null;
      cinema.focus = null;
      return;
    }

    const candidates = [];

    cinema.zones.forEach((zone) => {
      zone.distance = zone.mesh.position.distanceTo(ship.position);
      const portalDistance = zone.mesh.position.distanceTo(
        portal.mesh ? portal.mesh.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0, portal.z)
      );
      const portalSafe = portalDistance >= cinema.portalSafeRadius;

      zone.visible = portalSafe &&
        zone.distance <= zone.radius &&
        zoneIsOnScreen(zone) &&
        running &&
        !transitionBusy &&
        !settings.open;

      if (zone.visible) candidates.push(zone);
    });

    candidates.sort((a, b) => a.distance - b.distance);
    const nearest = candidates.length ? candidates[0] : null;
    cinema.nearest = nearest;

    // Only the nearest visible zone is allowed to decode/play.
    cinema.zones.forEach((zone) => {
      if (!zone.el) return;

      if (zone === nearest) {
        if (!zone.loaded && zone.url) {
          zone.el.preload = mobileLandscape() ? "auto" : "metadata";
          try { zone.el.fetchPriority = mobileLandscape() ? "high" : "auto"; } catch (e) {}
          zone.el.src = zone.url;
          zone.el.load();
          zone.loaded = true;
        }

        if (!zone.active) {
          zone.active = true;
          zone.el.loop = zone.towerGate ? false : true;
          zone.el.muted = zone.towerGate ? true : cinema.mute;
          const p = zone.el.play();
          if (p && p.catch) {
            p.catch(() => {
              zone.el.muted = true;
            });
          }
        }
      } else {
        if (zone.active) zone.el.pause();
        zone.el.volume = 0;
        zone.active = false;

        // Release the decoder/source when the screen is far outside its useful radius.
        if (zone.loaded && !zone.keepLoaded && zone.distance > zone.radius * 1.35) {
          zone.el.pause();
          zone.el.removeAttribute("src");
          zone.el.preload = "none";
          try { zone.el.fetchPriority = "low"; } catch (e) {}
          zone.el.load();
          zone.loaded = false;
        }
      }
    });

    if (!nearest) {
      if (musicAudio && !cinema.mute) musicAudio.volume = settings.volume;
      if (cinema.focus) cinema.focus = null;
      return;
    }

    const radius = nearest.radius;
    const near = 2.5;
    const d = Math.max(near, Math.min(radius, nearest.distance));
    const t = (d - near) / (radius - near);
    const filmGain = Math.pow(1 - t, 0.5);
    const ostGain = Math.pow(t, 2.6);

    // The planet and the onicss approach stay silent. Other space clips
    // still take the soundtrack as the ship gets close.
    if (nearest.towerGate) {
      nearest.el.muted = true;
      nearest.el.volume = 0;
      if (musicAudio && !cinema.mute) musicAudio.volume = settings.volume;
    } else {
      if (!cinema.mute) nearest.el.volume = Math.max(0, Math.min(1, settings.volume * filmGain));
      if (musicAudio && !cinema.mute) musicAudio.volume = settings.volume * ostGain;
    }

    // Keep an explicitly selected focus target until it leaves its own active radius.
    if (interaction) {
      interaction.textContent = nearest.distance <= near
        ? "CINEMA · 100% · PLACE AUDIO"
        : "CINEMA · " + Math.round(filmGain * 100) + "% · PLACE AUDIO";
    }
  }

  function getNearestVideoTarget() {
    const targets = [];
    if (cinema.nearest) targets.push(cinema.nearest);
    liveInterior.forEach((item) => {
      if (item && item.mesh && item.active && item.distance <= item.radius) targets.push(item);
    });
    if (liveWall && liveWall.mesh && liveWall.active && liveWall.distance <= liveWall.radius) {
      targets.push(liveWall);
    }
    targets.sort((a, b) => (Number(a.distance) || 99) - (Number(b.distance) || 99));
    return targets.length ? targets[0] : null;
  }

  function focusVideoTarget(target) {
    if (!target || !target.mesh || !target.active) {
      setStatus("MISSION · CHECK SCREENS → LAND ON ONICSS");
      return;
    }
    if (cinema.focus === target) {
      cinema.focus = null;
      setStatus("MISSION · SCREENS → LAND ON ONICSS");
      return;
    }
    cinema.focus = target;
    setStatus("MISSION · SCREENS → LAND ON ONICSS · F / X RELEASE");
  }

  function toggleCinemaFocus() {
    if (cinema.focus) {
      cinema.focus = null;
      setStatus("CINEMA FOCUS OFF");
      return;
    }
    focusVideoTarget(getNearestVideoTarget());
  }

  function orbitFocusedScreenByDrag(dx, dy) {
    if (!mobileLandscape() || !cinema.focus || !cinema.focus.mesh) return false;
    const target = cinema.focus.mesh.getWorldPosition(new THREE.Vector3());
    const offset = ship.position.clone().sub(target);
    const distance = offset.length();
    if (distance < 2.5) return false;

    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -dx * 0.006);
    const currentPitch = Math.asin(Math.max(-1, Math.min(1, offset.y / distance)));
    const nextPitch = Math.max(-0.9, Math.min(0.9, currentPitch + dy * 0.004));
    const horizontal = Math.hypot(offset.x, offset.z);
    const nextHorizontal = Math.cos(nextPitch) * distance;
    if (horizontal > 1e-6) {
      offset.x = offset.x / horizontal * nextHorizontal;
      offset.z = offset.z / horizontal * nextHorizontal;
    }
    offset.y = Math.sin(nextPitch) * distance;

    ship.position.copy(target).add(offset);
    ship.velocity.set(0, 0, 0);
    ship.angularVelocity.set(0, 0, 0);
    collide();
    return true;
  }

  function orbitFocusedScreen(dt) {
    if (!mobileLandscape() || !cinema.focus || !cinema.focus.mesh) return false;
    const orbitDir = touch.yawLeft ? -1 : (touch.yawRight ? 1 : 0);
    if (!orbitDir) return false;
    const target = cinema.focus.mesh.getWorldPosition(new THREE.Vector3());
    const offset = ship.position.clone().sub(target);
    const distance = offset.length();
    if (distance < 2.5) return false;
    const step = orbitDir * 1.65 * Math.min(dt, 0.033);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), step);
    ship.position.copy(target).add(offset);
    ship.velocity.set(0, 0, 0);
    collide();
    return true;
  }

  function findVideoTargetAtPoint(clientX, clientY) {
    if (!camera || !scene) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const candidates = [];
    cinema.zones.forEach((item) => {
      if (item && item.mesh && item.active && item.visible && item.mesh.visible !== false) candidates.push(item);
    });
    liveInterior.forEach((item) => {
      if (item && item.mesh && item.active && item.ready && item.mesh.visible !== false) candidates.push(item);
    });
    if (liveWall && liveWall.mesh && liveWall.active && liveWall.ready && liveWall.mesh.visible !== false) candidates.push(liveWall);
    if (!candidates.length) return null;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const meshes = candidates.map((item) => item.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    const mesh = hits[0].object;
    return candidates.find((item) => item.mesh === mesh) || null;
  }

  function updateCinemaFocus() {
    if (!cinema.focus || !cinema.focus.mesh || !cinema.focus.active) return;
    if (cinema.focus.distance > cinema.focus.radius) {
      cinema.focus = null;
      return;
    }

    const target = cinema.focus.mesh.getWorldPosition(new THREE.Vector3());
    const matrix = new THREE.Matrix4().lookAt(
      ship.position,
      target,
      new THREE.Vector3(0, 1, 0)
    );
    ship.quaternion.setFromRotationMatrix(matrix);
    ship.angularVelocity.multiplyScalar(0.15);
    camera.quaternion.copy(ship.quaternion);
  }

  function input() {
    readPad();
    const look = tiltLook();
    return {
      thrust: (keys.KeyW || touch.thrust ? 1 : 0) - (keys.KeyS || touch.brake ? 1 : 0) - pad.ly,
      strafe: (keys.KeyD || touch.right ? 1 : 0) - (keys.KeyA || touch.left ? 1 : 0) + pad.lx,
      vertical: (keys.Space || touch.up ? 1 : 0) - (keys.KeyC || touch.down ? 1 : 0) + pad.vert,
      roll: (keys.KeyE || touch.rollRight ? 1 : 0) - (keys.KeyQ || touch.rollLeft ? 1 : 0) + pad.roll,
      yaw: (mobileLandscape() && cinema.focus ? 0 : ((touch.yawLeft ? 1 : 0) - (touch.yawRight ? 1 : 0) + look.yaw + pad.rx * (settings.invertYaw ? 1 : -1))),
      lookYaw: look.yaw,
      pitch: look.pitch
    };
  }

  function triggerCollisionImpact(force) {
    const now = performance.now();
    if (now < impact.cooldown) return;
    impact.cooldown = now + 260;
    impact.strength = Math.max(impact.strength, Math.max(0.24, Math.min(0.62, force)));
  }

  function updateCollisionImpact(dt) {
    if (impact.strength <= 0) return;
    impact.strength = Math.max(0, impact.strength - dt / 1.5);
    if (impact.overlay) {
      const pulse = impact.strength * (0.78 + 0.22 * Math.sin(impact.strength * 24));
      impact.overlay.material.opacity = Math.max(0, pulse);
    }
    if (impact.light) {
      impact.light.intensity = impact.strength * 3.5;
      impact.light.position.copy(camera.position);
    }
  }

  function getSpaceZone(z) {
    if (z > -24.5) return "ROOM1";
    if (z >= -48.5) return "BLACK_HOLE";
    if (z >= -84.5) return "ROOM2";
    return "DEEP_SPACE";
  }

  function shellCrossed(before, after, edge) {
    return (before >= edge && after < edge) || (before <= edge && after > edge);
  }

  function collideStarbaseShell(before, allowInteriorOpenings) {
    let blocked = false;
    const shellPadding = 1.2;

    starbaseHull.forEach((hull, index) => {
      // Collision is only for the physical starbase shell itself.
      // A small proximity envelope avoids treating the base collider as a
      // global Deep Space navigation wall.
      const nearX = Math.abs(ship.position.x) <= hull.outerX + shellPadding ||
        Math.abs(before.x) <= hull.outerX + shellPadding;
      const nearY = Math.abs(ship.position.y) <= hull.outerY + shellPadding ||
        Math.abs(before.y) <= hull.outerY + shellPadding;
      const nearZ = (
        Math.min(before.z, ship.position.z) <= hull.zMax + shellPadding &&
        Math.max(before.z, ship.position.z) >= hull.zMin - shellPadding
      );
      if (!(nearX && nearY && nearZ)) return;

      const zMin = hull.zMin;
      const zMax = hull.zMax;

      const zRelevant =
        (before.z >= zMin && before.z <= zMax) ||
        (ship.position.z >= zMin && ship.position.z <= zMax) ||
        (before.z < zMin && ship.position.z > zMax) ||
        (before.z > zMax && ship.position.z < zMin);

      if (!zRelevant) return;

      const room1 = index === 0;
      const frontOpeningZ = room1 ? -25.5 : -47.5;
      const rearCapZ = room1 ? 5.5 : -84.5;

      // The corridor mouth stays solid after a portal teleport. The ring between
      // that mouth and the photoli shell is the flyable cavity, so it may cross
      // the open front. Ships outside the shell are not grabbed by this Z plane.
      const inCorridorMouth =
        (Math.abs(before.x) <= 6.2 && Math.abs(before.y) <= 3.7) ||
        (Math.abs(ship.position.x) <= 6.2 && Math.abs(ship.position.y) <= 3.7);
      const crossedFront = shellCrossed(before.z, ship.position.z, frontOpeningZ);
      if (crossedFront && inCorridorMouth) {
        ship.position.z = before.z < frontOpeningZ
          ? frontOpeningZ - 0.06
          : frontOpeningZ + 0.06;
        ship.velocity.z = 0;
        blocked = true;
      }

      // Block crossing the visible outer shell in BOTH directions.
      // The old check only stopped outside -> inside, which made the hull noclip
      // when the ship tried to leave the room through a side wall.
      if (before.x < hull.outerX && ship.position.x >= hull.outerX) {
        ship.position.x = hull.outerX - 0.06;
        blocked = true;
      } else if (before.x > hull.outerX && ship.position.x <= hull.outerX) {
        ship.position.x = hull.outerX + 0.06;
        blocked = true;
      } else if (before.x > -hull.outerX && ship.position.x <= -hull.outerX) {
        ship.position.x = -hull.outerX + 0.06;
        blocked = true;
      } else if (before.x < -hull.outerX && ship.position.x >= -hull.outerX) {
        ship.position.x = -hull.outerX - 0.06;
        blocked = true;
      }

      if (before.y < hull.outerY && ship.position.y >= hull.outerY) {
        ship.position.y = hull.outerY - 0.06;
        blocked = true;
      } else if (before.y > hull.outerY && ship.position.y <= hull.outerY) {
        ship.position.y = hull.outerY + 0.06;
        blocked = true;
      } else if (before.y > -hull.outerY && ship.position.y <= -hull.outerY) {
        ship.position.y = -hull.outerY + 0.06;
        blocked = true;
      } else if (before.y < -hull.outerY && ship.position.y >= -hull.outerY) {
        ship.position.y = -hull.outerY - 0.06;
        blocked = true;
      }

      // Room 2's rear cap is solid except the corridor-sized exit. The old
      // check let the whole rear face, including the cavity, noclip outward.
      if (shellCrossed(before.z, ship.position.z, rearCapZ)) {
        const leavingThroughCorridor = !room1 && inCorridorMouth &&
          before.z > rearCapZ && ship.position.z < rearCapZ;
        if (leavingThroughCorridor) {
          exteriorFlight = true;
        } else {
          ship.position.z = before.z < rearCapZ ? rearCapZ - 0.06 : rearCapZ + 0.06;
          ship.velocity.z = 0;
          blocked = true;
        }
      }
    });

    return blocked;
  }

  function collideCorridorShell(before) {
    if (!before || !ship.position) return false;

    let blocked = false;

    const rooms = [
      {
        zMin: -24.5,
        zMax: 5.45,
        xEdge: 6.0,
        yEdge: 3.5,
        frontZ: -25.5,
        rearZ: 5.5,
        room1: true
      },
      {
        zMin: -84.5,
        zMax: -47.46,
        xEdge: 6.0,
        yEdge: 3.5,
        frontZ: -47.5,
        rearZ: -84.5,
        room1: false
      }
    ];

    for (const room of rooms) {
      const inZBand =
        (before.z >= room.zMin && before.z <= room.zMax) ||
        (ship.position.z >= room.zMin && ship.position.z <= room.zMax);

      if (!inZBand) continue;

      const hitXPos =
        (before.x < room.xEdge && ship.position.x >= room.xEdge) ||
        (before.x > room.xEdge && ship.position.x <= room.xEdge);
      const hitXNeg =
        (before.x > -room.xEdge && ship.position.x <= -room.xEdge) ||
        (before.x < -room.xEdge && ship.position.x >= -room.xEdge);

      if (hitXPos) {
        ship.position.x = before.x < room.xEdge
          ? room.xEdge - 0.06
          : room.xEdge + 0.06;
        ship.velocity.x = 0;
        blocked = true;
      } else if (hitXNeg) {
        ship.position.x = before.x > -room.xEdge
          ? -room.xEdge + 0.06
          : -room.xEdge - 0.06;
        ship.velocity.x = 0;
        blocked = true;
      }

      const hitYPos =
        (before.y < room.yEdge && ship.position.y >= room.yEdge) ||
        (before.y > room.yEdge && ship.position.y <= room.yEdge);
      const hitYNeg =
        (before.y > -room.yEdge && ship.position.y <= -room.yEdge) ||
        (before.y < -room.yEdge && ship.position.y >= -room.yEdge);

      if (hitYPos) {
        ship.position.y = before.y < room.yEdge
          ? room.yEdge - 0.06
          : room.yEdge + 0.06;
        ship.velocity.y = 0;
        blocked = true;
      } else if (hitYNeg) {
        ship.position.y = before.y > -room.yEdge
          ? -room.yEdge + 0.06
          : -room.yEdge - 0.06;
        ship.velocity.y = 0;
        blocked = true;
      }

      // Room 1 and the front of Room 2 stay physically sealed.
      // The transition to Room 2 happens through the portal cutscene,
      // not by flying through an open hull.
      const crossedFront = shellCrossed(before.z, ship.position.z, room.frontZ);
      if (crossedFront) {
        ship.position.z = before.z < room.frontZ
          ? room.frontZ - 0.06
          : room.frontZ + 0.06;
        ship.velocity.z = 0;
        blocked = true;
      }

      // Room 1 rear cap is closed. Room 2 rear cap remains the intended
      // inside -> Deep Space exit and is allowed only from its corridor.
      const crossedRear = shellCrossed(before.z, ship.position.z, room.rearZ);
      if (crossedRear) {
        if (room.room1) {
          ship.position.z = before.z <= room.rearZ
            ? room.rearZ - 0.06
            : room.rearZ + 0.06;
          ship.velocity.z = 0;
          blocked = true;
        } else if (before.z < room.rearZ && ship.position.z >= room.rearZ) {
          ship.position.z = room.rearZ - 0.06;
          ship.velocity.z = 0;
          blocked = true;
        } else if (before.z > room.rearZ && ship.position.z < room.rearZ) {
          exteriorFlight = true;
        }
      }
    }

    // Room 1 must remain hermetically closed until the normal Room 2 route is
    // reached. The old inside-only clamps could leave the ship outside the hull
    // after a fast/diagonal frame and then treat that position as open space.
    // While exteriorFlight is still false, recover any such penetration back
    // inside the actual Room 1 shell.
    if (!exteriorFlight) {
      const room1Span =
        (before.z >= -25.5 && before.z <= 5.5) ||
        (ship.position.z >= -25.5 && ship.position.z <= 5.5);

      if (room1Span) {
        const room1X = 5.94;
        const room1Y = 3.44;
        const room1ZMin = -25.44;
        const room1ZMax = 5.44;

        if (ship.position.x > room1X) {
          ship.position.x = room1X;
          ship.velocity.x = 0;
          blocked = true;
        } else if (ship.position.x < -room1X) {
          ship.position.x = -room1X;
          ship.velocity.x = 0;
          blocked = true;
        }

        if (ship.position.y > room1Y) {
          ship.position.y = room1Y;
          ship.velocity.y = 0;
          blocked = true;
        } else if (ship.position.y < -room1Y) {
          ship.position.y = -room1Y;
          ship.velocity.y = 0;
          blocked = true;
        }

        if (ship.position.z > room1ZMax) {
          ship.position.z = room1ZMax;
          ship.velocity.z = 0;
          blocked = true;
        } else if (ship.position.z < room1ZMin) {
          ship.position.z = room1ZMin;
          ship.velocity.z = 0;
          blocked = true;
        }
      }
    }

    return blocked;
  }

  function collide() {
    if (race.active) {
      constrainRace();
      return;
    }
    const before = ship.position.clone();

    // A room exists in 3D, not just on the Z axis.
    // Being outside the corridor envelope means free space, even when the
    // ship's Z happens to overlap the room's longitudinal range.
    const room1Interior =
      before.z > -24.5 && before.z <= 5.45 &&
      Math.abs(before.x) <= 5.3 &&
      Math.abs(before.y) <= 3.2;

    const room2Interior =
      before.z >= -84.5 && before.z < -47.46 &&
      Math.abs(before.x) <= 5.3 &&
      Math.abs(before.y) <= 3.2;

    if (room1Interior) {
      exteriorFlight = false;

      // Hard labyrinth walls while actually inside Room 1.
      ship.position.x = Math.max(-5.3, Math.min(5.3, ship.position.x));
      ship.position.y = Math.max(-3.2, Math.min(3.2, ship.position.y));

      // Rear cap stays closed except the capdoor opening, which starts the track.
      if (ship.position.z > 5.2 && Math.abs(ship.position.x) < 2.15 && Math.abs(ship.position.y) < 1.7) {
        ship.position.z = 5.2;
        ship.velocity.z = 0;
        beginRaceCutscene();
      } else if (ship.position.z > 5.45) {
        ship.position.z = 5.45;
      }

      // Front opens only through the central corridor-sized opening.
      if (before.z < -24.5 && ship.position.z >= -24.5 &&
          (Math.abs(before.x) > 5.85 || Math.abs(before.y) > 3.45)) {
        ship.position.z = -24.46;
      }
    } else if (room2Interior) {
      exteriorFlight = false;

      // Hard labyrinth walls while actually inside Room 2.
      ship.position.x = Math.max(-5.3, Math.min(5.3, ship.position.x));
      ship.position.y = Math.max(-3.2, Math.min(3.2, ship.position.y));

      // Rear end is the deliberate exit to the exterior.
      if (ship.position.z < -84.5) {
        exteriorFlight = true;
      }

      // Front opens only through the central return opening.
      if (!exteriorFlight && ship.position.z > -47.46) {
        ship.position.z = -47.46;
      }
    } else {
      // Outside both corridor footprints: free flight.
      // BLACK HOLE and DEEP SPACE do not impose room-style X/Y clamps.
      if (getSpaceZone(before.z) === "BLACK_HOLE" &&
          (Math.abs(before.x) > 6.0 || Math.abs(before.y) > 4.0)) {
        exteriorFlight = true;
      }

      // The ONLY remaining solid object here is the physical starbase shell.
      collideStarbaseShell(before, true);
    }

    // Enforce the visible corridor shell even when the previous frame
    // started just outside the old inner clamp. This closes the small "ghost"
    // penetration through Room 1/2 side walls.
    collideCorridorShell(before);

    const blockedX = before.x !== ship.position.x;
    const blockedY = before.y !== ship.position.y;
    const blockedZ = before.z !== ship.position.z;

    if (room0Labyrinth.active) {
      collideRoom0Labyrinth(before);
    }

    if (blockedX || blockedY || blockedZ) {
      const speed = ship.velocity.length();
      if (speed > 1.0) {
        triggerCollisionImpact(Math.min(0.62, speed / Math.max(1, ship.maxSpeed)));
      }
      if (blockedX) ship.velocity.x = 0;
      if (blockedY) ship.velocity.y = 0;
      if (blockedZ) ship.velocity.z = 0;
    }
  }

  function updatePhysics(dt) {
    if (transitionBusy || externalPause) return;
    updateDoor(dt);
    const inn = input();
    const localAcc = new THREE.Vector3(
      inn.strafe * ship.strafeThrust,
      inn.vertical * ship.verticalThrust,
      -inn.thrust * ship.thrust
    ).applyQuaternion(ship.quaternion);
    ship.velocity.addScaledVector(localAcc, dt);
    ship.velocity.multiplyScalar(Math.max(0, 1 - ship.linearDrag * dt));
    if (ship.velocity.length() > ship.maxSpeed) ship.velocity.setLength(ship.maxSpeed);
    ship.position.addScaledVector(ship.velocity, dt);
    updateRoom0Labyrinth();
    collide();
    updateSpaceSatelliteVisibility();
    updateCollisionImpact(dt);

    const focusedOrbit = orbitFocusedScreen(dt);
    const mobileTiltMode = mobileLandscape() && tilt.enabled;
    if (mobileTiltMode) {
      const manualPitch = pad.ry * (settings.invertPitch ? 1 : -1);
      ship.angularVelocity.x = manualPitch * 0.85 + inn.pitch * 0.85;
      ship.angularVelocity.y = focusedOrbit ? 0 : inn.yaw * 0.85;
      ship.angularVelocity.z = inn.roll * 2.6;
    } else {
      const psign = settings.invertPitch ? 1 : -1;
      ship.angularVelocity.x += pad.ry * psign * 4.2 * dt + inn.pitch * 2.4 * dt;
      ship.angularVelocity.y += pad.rx * (settings.invertYaw ? 1 : -1) * 4.4 * dt +
        ((mobileLandscape() && cinema.focus) ? 0 : ((touch.yawLeft ? 1 : 0) - (touch.yawRight ? 1 : 0) + inn.lookYaw)) * 2.2 * dt;
      ship.angularVelocity.z += inn.roll * 2.6 * dt;
      ship.angularVelocity.multiplyScalar(Math.max(0, 1 - ship.angularDrag * dt));
    }
    if (ship.angularVelocity.lengthSq() > 1e-8) {
      const ang = ship.angularVelocity.length() * dt;
      const q = new THREE.Quaternion().setFromAxisAngle(ship.angularVelocity.clone().normalize(), ang);
      ship.quaternion.multiply(q).normalize();
    }
    camera.position.copy(ship.position);
    camera.quaternion.copy(ship.quaternion);
    light.position.copy(ship.position);
    if (ship.position.z < -48) startBackgroundTextureLoading();
    updateTowerApproachPreload();
    updateCinemaZones();
    updateLiveWall();
    updateLiveInterior();
    updateCinemaFocus();
    if (ship.visual) {
      ship.visual.position.copy(ship.position);
      ship.visual.quaternion.copy(ship.quaternion);
    }

    portal.coverage = portalCoverage();
    const gate = getTowerGateZone();
    const gateDistance = towerGateDistance();
    const gateCoverage = towerGateCoverage();
    const gateUiRadius = config.towerApproach && Number(config.towerApproach.uiRadius)
      ? Number(config.towerApproach.uiRadius)
      : 200;

    // The already-built Oni station sphere is also an immediate landing trigger.
    // This does not create a new object and does not change its geometry/placement.
    const stationSphereDistance = spaceSatellite.stationMesh && ship.position
      ? spaceSatellite.stationMesh.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position)
      : Infinity;
    const stationSphereEntryRadius = 5.6;

    if (interaction) {
      if (gate && gateDistance <= gateUiRadius) {
        interaction.textContent = "ONICSS · " +
          Math.max(0, Math.round(100 - (gateDistance / Math.max(1, gate.radius)) * 100)) + "%";
      } else {
        const portalUiThreshold = Number(config.towerApproach?.portalCoverageThreshold) || 0.60;
        interaction.textContent = portal.coverage >= portalUiThreshold
          ? "PORTAL LOCK · CUTSCENE"
          : "PORTAL " + Math.round(portal.coverage * 100) + "%";
      }
    }

    if (gate && gateDistance <= 14) beginTowerLanding();

    if (!cinema.focus) {
      const portalCoverageThreshold = Number(config.towerApproach?.portalCoverageThreshold) || 0.60;
      const backTrigger = Number(config.towerApproach?.backPortalDistance) || 8.5;
      if (portalSide() === "FRONT" && portal.coverage >= portalCoverageThreshold) tryPortal();
      if (portalSide() === "BACK" && portalTriggerDistance("BACK") <= backTrigger) tryPortal();
    }

    if (mobileLandscape() && interaction && !transitionBusy && !towerGateTriggered && gateDistance > gateUiRadius) {
      if (cinema.focus) interaction.textContent = "SCREEN LOCK · TAP VIDEO OFF · ◀ ▶ ORBIT";
      else if (getNearestVideoTarget()) interaction.textContent = "TAP VIDEO · FOCUS · ◀ ▶";
    }

    const zoneNow = getSpaceZone(ship.position.z);
    let room;
    if (zoneNow === "DEEP_SPACE") {
      const satelliteDistance = spaceSatellite.group
        ? spaceSatellite.group.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position)
        : 999;
      room = satelliteDistance < 34
        ? "DEEP SPACE · SATELLITE REACHED"
        : "DEEP SPACE · STARBASE EXTERIOR";
    } else if (zoneNow === "BLACK_HOLE") {
      room = "BLACK HOLE · OPEN VOLUME";
    } else if (zoneNow === "ROOM2") {
      room = "ROOM 2";
    } else {
      room = "ROOM 1";
    }
    if (race.active) {
      showMission("МИССИЯ: 2 КРУГА ПО ТРАССЕ, НИ РАЗУ НЕ ВЫЛЕТАЯ В КОСМОС");
      setStatus("ТРАССА · КРУГ " + Math.min(race.needed, race.laps + 1) + "/2 · НЕ ВЫЛЕТАТЬ В КОСМОС · SPD " + ship.velocity.length().toFixed(1));
    } else {
      showMission("МИССИЯ: ПРОВЕРИТЬ ЭКРАНЫ И ПРИЗЕМЛИТЬСЯ НА ONICSS");
      setStatus(room + " · SPD " + ship.velocity.length().toFixed(1));
    }
  }

  function render(now) {
    if (miniSimReleased) return;

    updateBacksideVisibility();
    updateBacksideCamouflage(now);
    pollGamepadMenu();
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    if (running && !settings.open) {
      try { updatePhysics(dt); } catch (err) {
        setStatus("LOOP ERR " + (err && err.message ? err.message : "pad"));
      }
    }
    // A separate lightweight module can add a Warp tunnel or asteroid maze to this same scene.
    // It receives the existing r128 runtime; no second WebGL context is created.
    if (typeof window.BCMDeepSpaceWarpFrame === "function") {
      try {
        window.BCMDeepSpaceWarpFrame({ dt, running, paused: externalPause, scene, camera, ship, THREE: window.THREE, root, renderer });
      } catch (err) {
        window.BCMDeepSpaceWarpFrame = null;
        if (!externalHud) setStatus("WARP MODULE ERROR · " + (err && err.message ? err.message : "frame"));
      }
    }
    if (typeof window.BCMDeepSpaceWarpPoll === "function") {
      try { window.BCMDeepSpaceWarpPoll({ dt, running, paused: externalPause, root }); }
      catch (err) { window.BCMDeepSpaceWarpPoll = null; }
    }
    // Ring's room view reuses the existing WebGL context (as Tower does), including
    // optional two-viewport split-screen. If it handled this frame, don't draw the
    // ordinary ship camera over its result.
    let deepSpaceCustomRendered = false;
    if (typeof window.BCMDeepSpaceWarpRender === "function") {
      try {
        deepSpaceCustomRendered = window.BCMDeepSpaceWarpRender({
          dt, running, paused: externalPause, scene, camera, ship,
          THREE: window.THREE, root, renderer
        }) === true;
      } catch (err) {
        window.BCMDeepSpaceWarpRender = null;
        if (!externalHud) setStatus("RING RENDER ERROR · " + (err && err.message ? err.message : "frame"));
      }
    }
    // The Warp map/Tube overlays hide the scene. Ring handles its own views through
    // the same renderer; all other states keep the ordinary single-camera render.
    const showUnderlyingScene = !externalPause || root.classList.contains("bcm-warp-maze-active");
    if (!deepSpaceCustomRendered && renderer && scene && camera && showUnderlyingScene) {
      renderer.render(scene, camera);
    }
    requestAnimationFrame(render);
  }

  function toggleSettings() {
    settings.open = !settings.open;
    if (settingsRoot) settingsRoot.hidden = !settings.open;
    root.classList.toggle("menu-open", settings.open);
    if (settings.open) {
      if (document.exitPointerLock) document.exitPointerLock();
      if (liveWall.el) {
        liveWall.el.pause();
        liveWall.active = false;
      }
      pauseInteriorVideos();
    } else {
      updateLiveWall();
      updateLiveInterior();
    }
  }

  function stopMiniSimAudio() {
    if (!musicAudio) return;
    try {
      musicAudio.pause();
      musicAudio.currentTime = 0;
      // Do not set volume to zero: a later return to Starbase must be audible
      // unless the user explicitly muted all OSTs with the note button.
    } catch (e) {}
  }

  function startMusic() {
    if (!musicAllowed || !musicAudio || !config.musicUrl) return;
    if (!musicAudio.src) {
      musicAudio.preload = "auto";
      try { musicAudio.fetchPriority = "high"; } catch (e) {}
      musicAudio.src = config.musicUrl;
    }
    musicAudio.loop = true;
    musicAudio.volume = settings.volume;
    musicAudio.muted = cinema.mute;
    if (window.BCMGameAudio?.playExclusive) {
      const playing = window.BCMGameAudio.playExclusive(musicAudio, "starbase");
      if (playing && typeof playing.catch === "function") playing.catch(() => {});
    } else {
      musicAudio.play().catch(() => {});
    }
    if (musicButton) musicButton.hidden = false;
    syncMusicButton();
  }

  function enableTilt() {
    const beginCalibration = () => {
      tilt.calibrating = true;
      tilt.samples = 0;
      tilt.sumB = 0;
      tilt.sumG = 0;
      tilt.enabled = false;

      setTimeout(() => {
        tilt.calibrating = false;
        if (tilt.samples >= 8) {
          tilt.neutralB = tilt.sumB / tilt.samples;
          tilt.neutralG = tilt.sumG / tilt.samples;
          tilt.enabled = true;
          if (tiltButton) tiltButton.classList.add("active");
          setStatus("TILT CALIBRATED · HOLD STILL");
        } else if (tilt.available) {
          tilt.neutralB = tilt.filteredB;
          tilt.neutralG = tilt.filteredG;
          tilt.enabled = true;
          if (tiltButton) tiltButton.classList.add("active");
          setStatus("TILT CALIBRATED");
        } else {
          setStatus("TILT · NO SENSOR");
        }
      }, 1000);
    };

    const on = (ev) => {
      if (typeof ev.beta !== "number") return;
      tilt.available = true;
      tilt.a = ev.alpha || 0;
      tilt.b = ev.beta;
      tilt.g = ev.gamma || 0;

      if (!tilt.filterReady) {
        tilt.filteredB = tilt.b;
        tilt.filteredG = tilt.g;
        tilt.filterReady = true;
      } else {
        tilt.filteredB += (tilt.b - tilt.filteredB) * 0.14;
        tilt.filteredG += (tilt.g - tilt.filteredG) * 0.14;
      }

      if (tilt.calibrating) {
        tilt.sumB += tilt.filteredB;
        tilt.sumG += tilt.filteredG;
        tilt.samples++;
      }
    };

    const boot = () => {
      if (!tilt.bound) {
        window.addEventListener("deviceorientation", on, true);
        tilt.bound = true;
      }
      beginCalibration();
    };

    if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().then((p) => {
        if (p === "granted") boot();
        else setStatus("TILT DENIED");
      }).catch(() => setStatus("TILT ERROR"));
    } else {
      boot();
    }
  }

  function resize() {
    if (!renderer || !camera) return;
    const w = root.clientWidth || 800;
    const h = root.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function bind() {
    window.addEventListener("keydown", (e) => {
      // Hull Dive owns keyboard input while its overlay is open. Do not let
      // this earlier global handler reinterpret V as Warp or retain ship input.
      if (document.getElementById("bcm-hull-dive")) {
        if (e.code !== "Escape") e.preventDefault();
        return;
      }
      if (e.code === "Escape") {
        if (document.exitPointerLock) document.exitPointerLock();
        return;
      }
      if (e.code === "Backspace") {
        e.preventDefault();
        if (settings.open) toggleSettings();
        else resetCurrentRoom();
        return;
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        if (typeof window.BCMDeepSpaceWarpToggle === "function") window.BCMDeepSpaceWarpToggle();
        return;
      }
      if (e.code === "Enter") {
        e.preventDefault();
        if (!running) {
          setInterfaceLanguage(interfaceLanguage === "ru" ? "en" : "ru");
          showOperatorDialog("", interfaceLanguage === "ru" ? "Язык: русский." : "Language: English.");
        } else {
          toggleSettings();
        }
        return;
      }
      if (settings.open) return;
      keys[e.code] = true;
      if (e.code === "KeyG") { e.preventDefault(); tryPortal(); }
      if (e.code === "KeyF") { e.preventDefault(); toggleCinemaFocus(); }
      if (e.code === "KeyH") { e.preventDefault(); returnToStart(); }
      if (e.code === "KeyR") { e.preventDefault(); openDoor("REMOTE"); }

    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });
    window.addEventListener("resize", resize);
    window.addEventListener("gamepadconnected", (e) => {
      if (pad.index < 0) pad.index = e.gamepad.index;
      updateControlHelp();
      setStatus("GAMEPAD CONNECTED");
    });
    window.addEventListener("gamepaddisconnected", (e) => {
      if (pad.index === e.gamepad.index) pad.index = -1;
      updateControlHelp();
    });
    updateControlHelp();
    canvas.addEventListener("click", () => {
      if (running && canvas.requestPointerLock && !("ontouchstart" in window)) canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!pointerLocked || settings.open) return;
      ship.angularVelocity.y -= e.movementX * 0.0032;
      ship.angularVelocity.x -= e.movementY * 0.0036;
    });
    root.querySelectorAll(".bcm-mini-sim-mobile button").forEach((btn) => {
      const id = btn.dataset.control;
      const down = (ev) => {
        ev.preventDefault();
        if (id === "tilt") { enableTilt(); return; }
        if (id === "focus") { toggleCinemaFocus(); return; }
        if (id === "portal") { tryPortal(); return; }
        if (id === "home") { returnToStart(); return; }
        if (running) touch[id] = true;
      };
      const up = (ev) => { ev.preventDefault(); touch[id] = false; };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("contextmenu", (ev) => ev.preventDefault());
      btn.addEventListener("selectstart", (ev) => ev.preventDefault());
    });

    // Edge zones are intentionally passive on mobile: movement is handled by the visible buttons,
    // while swipe/drag on the canvas remains the screen-look control.

    let dragPointerId = null;
    let dragX = 0, dragY = 0;
    let dragStartX = 0, dragStartY = 0;
    let dragMoved = false;
    canvas.addEventListener("pointerdown", (ev) => {
      if (!running || ev.pointerType === "mouse") return;
      dragPointerId = ev.pointerId;
      dragX = ev.clientX; dragY = ev.clientY;
      dragStartX = ev.clientX; dragStartY = ev.clientY;
      dragMoved = false;
      canvas.setPointerCapture?.(ev.pointerId);
    });
    canvas.addEventListener("pointermove", (ev) => {
      if (!running || dragPointerId !== ev.pointerId || ev.pointerType === "mouse" || settings.open) return;
      const prevX = dragX, prevY = dragY;
      const dx = ev.clientX - prevX, dy = ev.clientY - prevY;
      if (Math.hypot(ev.clientX - dragStartX, ev.clientY - dragStartY) > 9) dragMoved = true;
      dragX = ev.clientX; dragY = ev.clientY;
      if (cinema.focus && mobileLandscape()) {
        orbitFocusedScreenByDrag(dx, dy);
      } else {
        ship.angularVelocity.y -= dx * 0.0011;
        ship.angularVelocity.x -= dy * 0.0010;
      }
    });
    const endDrag = (ev) => {
      if (dragPointerId !== ev.pointerId) return;
      if (!dragMoved && ev.pointerType !== "mouse" && !settings.open) {
        const target = findVideoTargetAtPoint(ev.clientX, ev.clientY);
        if (target) focusVideoTarget(target);
      }
      dragPointerId = null;
      dragMoved = false;
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    const crystal = root.querySelector(".bcm-mini-sim-crystal-main");
    if (crystal) crystal.addEventListener("click", () => openDoor("REMOTE"));
    if (musicButton) musicButton.addEventListener("click", () => {
      setAudioMute(!cinema.mute);
    });
    if (transitionRoot) {
      const close = transitionRoot.querySelector(".bcm-mini-sim-transition-close");
      if (close) close.addEventListener("click", finishTeleport);
    }
    if (settingsRoot) {
      const vol = settingsRoot.querySelector('[data-setting="volume"]');
      const ip = settingsRoot.querySelector('[data-setting="invertPitch"]');
      const iy = settingsRoot.querySelector('[data-setting="invertYaw"]');
      const cl = settingsRoot.querySelector('[data-setting="close"]');
      if (vol) vol.addEventListener("input", () => {
        settings.volume = Number(vol.value) / 100;
        if (musicAudio) musicAudio.volume = settings.volume;
      });
      if (ip) ip.addEventListener("change", () => { settings.invertPitch = ip.checked; });
      if (iy) iy.addEventListener("change", () => { settings.invertYaw = iy.checked; });
      if (videoCheckButton) videoCheckButton.addEventListener("click", checkAllVideoSources);
      if (cl) cl.addEventListener("click", toggleSettings);
    }
    window.BCMiniSimAPI = window.BCMiniSimAPI || {};
    window.BCMiniSimAPI.stopAudio = stopMiniSimAudio;
    window.BCMiniSimAPI.getSpeedMode = () => speedMode;
    window.BCMiniSimAPI.setSpeedMode = (mode) => setSpeedMode(mode);
    window.BCMiniSimAPI.pauseForWarp = (value) => {
      externalPause = !!value;
      if (externalPause) clearStoredInputState();
      if (externalPause && ship.velocity && ship.angularVelocity) {
        ship.velocity.set(0, 0, 0);
        ship.angularVelocity.set(0, 0, 0);
      }
    };
    window.BCMiniSimAPI.getRuntime = () => ({ renderer, scene, camera, ship, THREE: window.THREE, root, running });
    window.BCMiniSimAPI.teleport = (position, quaternion) => {
      if (!position || !ship.position || !ship.quaternion) return false;
      clearStoredInputState();
      ship.position.set(Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0);
      ship.velocity.set(0, 0, 0);
      ship.angularVelocity.set(0, 0, 0);
      if (quaternion && quaternion.isQuaternion) ship.quaternion.copy(quaternion);
      else ship.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Number(position.yaw) || 0);
      if (camera) {
        camera.position.copy(ship.position);
        camera.quaternion.copy(ship.quaternion);
      }
      if (ship.visual) {
        ship.visual.position.copy(ship.position);
        ship.visual.quaternion.copy(ship.quaternion);
      }
      return true;
    };
    window.BCMiniSimAPI.setExternalHUD = (mission, message) => {
      externalHud = { mission: String(mission || "DEEP SPACE"), status: String(message || "WARP SYSTEM") };
      if (missionEl) missionEl.textContent = externalHud.mission;
      if (status) status.textContent = externalHud.status;
    };
    window.BCMiniSimAPI.clearExternalHUD = () => { externalHud = null; };

    window.addEventListener("galia-play-request", handleGaliaPlayRequest);

    if (window.GALIA_PLAY_STATE) {
      handleGaliaPlayRequest({ detail: window.GALIA_PLAY_STATE });
    }

    if (crewConnectButton) {
      crewConnectButton.addEventListener("click", () => {
        void connectCrewWallet();
      });
    }
    if (crewScanButton) {
      crewScanButton.addEventListener("click", () => {
        void scanCrewAddress();
      });
    }

    if (crewStartButton) {
      crewStartButton.addEventListener("click", () => {
        beginFlight();
      });
    }

    startButton.addEventListener("click", () => {
      openCrewPreflight();
    });
    // The on-screen language choices are part of the menu; Enter cycles RU/EN
    // before flight and continues to open Settings once flight has started.
    languageBox.hidden = false;
    if (menuBackdrop && config.menuBackgroundUrl) {
      menuBackdrop.style.backgroundImage = 'url("' + config.menuBackgroundUrl.replace(/"/g, "") + '")';
    }
  }

  function startSim() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileTextureMode() ? 1.0 : 1.5));
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x020308);
      camera = new THREE.PerspectiveCamera(70, 1, 0.08, 400);

      const impactOverlayMaterial = new THREE.MeshBasicMaterial({
        color: 0xff1528,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      impact.overlay = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), impactOverlayMaterial);
      impact.overlay.position.set(0, 0, -1.2);
      impact.overlay.renderOrder = 100;
      camera.add(impact.overlay);

      impact.light = new THREE.PointLight(0xff1428, 0, 24);
      scene.add(impact.light);

      light = new THREE.PointLight(0xffffff, 1.1, 80);
      scene.add(light);
      scene.add(new THREE.AmbientLight(0x8899aa, 0.35));
      ship.position = new THREE.Vector3(0, 0, 2);
      ship.velocity = new THREE.Vector3();
      ship.angularVelocity = new THREE.Vector3();
      ship.quaternion = new THREE.Quaternion();
      buildShipVisual();
      const stars = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i < 700; i++) pts.push((Math.random() - 0.5) * 500, (Math.random() - 0.5) * 320, (Math.random() - 0.5) * 520);
      stars.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6 })));
      buildWorld();
      bind();
      resize();
      setSpeedMode(1);
      setStatus("ENGINE READY · LOCAL r128 · " + (config.version || "0.9.49") + " · SPEED 1");
      hudAssets();
      requestAnimationFrame(render);
    } catch (err) {
      setStatus("ERROR: " + (err && err.message ? err.message : "start"));
    }
  }

  if (window.THREE) startSim();
  else {
    setStatus("ENGINE LOADING LOCAL r128...");
    const s = document.createElement("script");
    s.src = config.threeUrl || "";
    s.onload = () => { if (window.THREE) startSim(); else setStatus("ERROR: THREE missing"); };
    s.onerror = () => setStatus("ERROR: three.min.js");
    document.head.appendChild(s);
  }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootMiniSim, { once: true });
  } else {
    bootMiniSim();
  }
})();
