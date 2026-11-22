import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../mini-sim/assets/ring-bosses/", import.meta.url);
const ring = await readFile(new URL("../mini-sim/assets/js/ring-platformer.js", import.meta.url), "utf8");
const modelIndex = await readFile(new URL("mesh/README_MODELS.md", root), "utf8");
const labReport = JSON.parse(await readFile(new URL("mesh/lab-report.json", root), "utf8"));
const meshReport = JSON.parse(await readFile(new URL("mesh/mesh-report.json", root), "utf8"));
const phaseMeshReport = JSON.parse(await readFile(new URL("mesh/phase-forms/phase-mesh-report.json", root), "utf8"));
const expected = [
  "mesh/boss-1-roller.glb",
  "mesh/phase-forms/phase-2-walker.glb",
  "mesh/phase-forms/phase-3-orbiter.glb",
  "mesh/phase-forms/phase-4-brawler.glb",
  "mesh/phase-forms/phase-5-runner.glb",
  "mesh/phase-forms/phase-6-stalker.glb"
];

function parseGlbJson(buffer, file) {
  assert.equal(buffer.toString("ascii", 0, 4), "glTF", `${file} has GLB magic`);
  assert.equal(buffer.readUInt32LE(4), 2, `${file} is glTF 2.0`);
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4e4f534a) return JSON.parse(buffer.toString("utf8", offset, offset + length).replace(/[\u0000\u0020]+$/g, ""));
    offset += length;
  }
  assert.fail(`${file} has no JSON chunk`);
}

test("Ring phase GLBs exist, parse, and carry idle/hit/transform animation clips", async () => {
  for (const relative of expected) {
    const fileUrl = new URL(relative, root);
    assert.ok((await stat(fileUrl)).size > 10_000, `${relative} is not empty`);
    const gltf = parseGlbJson(await readFile(fileUrl), relative);
    const names = (gltf.animations || []).map((clip) => clip.name);
    assert.ok(gltf.materials.some((material) => material.name === "boss-rear-reference"), `${relative} embeds rear art`);
    assert.equal(gltf.images.length, 2, `${relative} has front and rear textures`);
    const dimensions = meshReport.forms.find((form) => relative.endsWith(form.file)) ||
      phaseMeshReport.forms.find((form) => relative.endsWith(form.file));
    assert.ok(dimensions, `${relative} has a bounds report`);
    const height = dimensions.bounds[1][1] - dimensions.bounds[1][0];
    const depth = dimensions.bounds[2][1] - dimensions.bounds[2][0];
    assert.ok(depth / height > 0.5, `${relative} has solid volume depth, not a shallow relief`);
    for (const name of ["idle", "hit", "transform_out", "transform_in"]) {
      assert.ok(names.includes(name), `${relative} includes ${name}`);
    }
  }
});

test("Runtime loads the agreed six forms in order and plays imported GLB transitions", () => {
  let prior = -1;
  for (const path of expected.map((relative) => `ring-bosses/${relative}`)) {
    const at = ring.indexOf(`"${path}"`);
    assert.ok(at > prior, `${path} appears in stage order`);
    prior = at;
  }
  assert.match(ring, /function loadRingBossGltf\(relativePath\)/);
  assert.match(ring, /new window\.THREE\.AnimationMixer\(model\)/);
  assert.match(ring, /playRingBossAnimation\(boss, previousPhaseIndex - 1, "transform_out", true\)/);
  assert.match(ring, /playRingBossAnimation\(boss, boss\.phaseIndex - 1, "transform_in", true\)/);
  assert.match(ring, /function setRingBossGroupOpacity\(group, opacity\)/);
  assert.match(ring, /function beginRingBossTransitionVfx\(boss\)/);
  assert.match(ring, /boss\.phaseUntil = now \+ 2400/);
  assert.match(ring, /clearRingBossTransitionVfx\(boss\)/);
  assert.match(ring, /if \(boss\.ring\) boss\.ring\.visible = false/);
  assert.match(ring, /if \(boss\.ring\) boss\.ring\.visible = true/);
  assert.match(ring, /bcm_qa_ring_boss/);
  assert.match(ring, /const url = ringBossAssetUrl\(key\)/);
});

test("Owner model index and provided asset lab report identify real model/transition validation", () => {
  for (const form of ["Roller", "Walker", "Orbiter", "Brawler", "Runner", "Stalker"]) {
    assert.match(modelIndex, new RegExp(form, "i"));
  }
  assert.equal(labReport.status, "PASS");
  assert.equal(labReport.errors.length, 0);
  assert.equal(labReport.consoleErrors.length, 0);
  assert.ok(labReport.shots.includes("04-transform-out.png"));
  assert.ok(labReport.shots.includes("05-transform-in.png"));
});
