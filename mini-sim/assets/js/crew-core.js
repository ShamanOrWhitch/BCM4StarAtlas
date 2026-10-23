/* Shared crew motion for every side-view that uses cut-out sprites.
   Tower, the hold and the ring all ask this core how a race faces, walks and falls.
   Levels do not keep their own copies of that table. */
(function () {
  function speciesMotion(species, sex) {
    const key = String(species || "").toLowerCase();
    const female = /female/i.test(String(sex || ""));
    if (key.includes("profound") || key.includes("high punaab") || key.includes("punaab")) {
      return { bob: 0.055, speed: 0.011, sway: 0.035, squash: 0.045 };
    }
    if (key.includes("sogmian")) return { bob: 0.04, speed: 0.01, sway: 0.02, squash: 0.03 };
    if (key.includes("ustur")) return { bob: 0.012, speed: 0.009, sway: 0.055, squash: 0.015 };
    if (key.includes("mierese")) {
      return female
        ? { bob: 0.048, speed: 0.021, sway: 0.07, squash: 0.05 }
        : { bob: 0.034, speed: 0.015, sway: 0.025, squash: 0.035 };
    }
    return { bob: 0.036, speed: 0.018, sway: 0.018, squash: 0.04 };
  }

  // Mierese art already looks along the walk direction. The other races are drawn the other way.
  function facingFactor(species) {
    return String(species || "").toLowerCase().includes("mierese") ? 1 : -1;
  }

  function readCrewProfile(crew) {
    const traitSpecies = Array.isArray(crew && crew.traits)
      ? (crew.traits.find((item) => /^(species|race)$/i.test(String(item && (item.trait || item.trait_type) || ""))) || {}).value
      : "";
    const species = String((crew && (crew.species || crew.spec)) || traitSpecies || "");
    const sex = String((crew && (crew.sex || crew.gender)) || "");
    return { species, sex, motion: speciesMotion(species, sex), facingFactor: facingFactor(species) };
  }

  function applyPlatformSprite(sprite, actor) {
    if (!sprite || !actor) return 0;
    const profile = actor.profile || readCrewProfile(actor.crew || actor);
    const motion = profile.motion || speciesMotion("", "");
    // Match Tower: its visual-facing calculation reverses the horizontal input before applying the species factor.
    const face = -(Number(actor.facing) < 0 ? -1 : 1) * (profile.facingFactor || -1);
    const map = sprite.material && sprite.material.map;
    if (map) {
      map.wrapS = 1000;
      map.repeat.x = face < 0 ? -1 : 1;
      map.offset.x = face < 0 ? 1 : 0;
    }
    const data = sprite.userData || (sprite.userData = {});
    if (!data.bcmBaseScale) {
      data.bcmBaseScale = {
        x: Math.abs(sprite.scale.x) || 1,
        y: Math.abs(sprite.scale.y) || 1
      };
    }
    const moving = !!actor.moving;
    const falling = actor.grounded === false && Number(actor.vy) < -0.35;
    const wave = Math.sin(performance.now() * motion.speed + (Number(actor.index) || 0));
    const amp = moving ? 1 : 0.35;
    const bob = wave * motion.bob * amp;
    const squash = moving ? 1 + wave * motion.squash : 1;
    const baseX = data.bcmBaseScale.x;
    const baseY = data.bcmBaseScale.y;
    sprite.scale.x = baseX * (falling ? 0.92 : squash);
    sprite.scale.y = falling ? baseY * 1.12 : baseY / Math.max(0.82, squash);
    if (sprite.material) sprite.material.rotation = wave * motion.sway * amp;
    if (Number.isFinite(actor.y)) sprite.position.y = actor.y + bob + (falling ? -0.06 : 0);
    return bob;
  }

  window.BCMCrewCore = {
    speciesMotion: speciesMotion,
    facingFactor: facingFactor,
    readCrewProfile: readCrewProfile,
    applyPlatformSprite: applyPlatformSprite
  };
})();
