import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../mini-sim/assets/ring-bosses/", import.meta.url);
const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const modelIndex = await readFile(new URL("mesh/README_MODELS.md", root), "utf8");
const labReport = JSON.parse(await readFile(new URL("mesh/lab-report.json", root), "utf8"));
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
    for (const name of ["idle", "hit", "transform_out", "transform_in"]) {
      assert.ok(names.includes(name), `${relative} includes ${name}`);
    }
  }
});

test("Runtime loads the agreed six forms in order and plays imported GLB transitions", () => {
  let prior = -1;
  for (const path of expected.map((relative) => `ring-bosses/${relative}`)) {
    const at = warp.indexOf(`"${path}"`);
    assert.ok(at > prior, `${path} appears in stage order`);
    prior = at;
  }
  assert.match(warp, /function loadRingBossGltf\(relativePath\)/);
  assert.match(warp, /new window\.THREE\.AnimationMixer\(model\)/);
  assert.match(warp, /playRingBossAnimation\(boss, previousPhaseIndex - 1, "transform_out", true\)/);
  assert.match(warp, /playRingBossAnimation\(boss, boss\.phaseIndex - 1, "transform_in", true\)/);
  assert.match(warp, /const url = ringBossAssetUrl\(key\)/);
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
