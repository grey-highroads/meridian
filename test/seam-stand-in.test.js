import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { artifactPathFor, STAND_IN_LABEL } from "../src/seam/stand-in.js";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };

const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
  whyThisArtist: "He plays outdoors and the team already builds around real sky.",
  asksOfProduction: "One long build cue and a single break.",
  whereItMightMiss: "A break that lands too hard reads as spectacle.",
  rhymesWith: ["finding-19"],
  avoid: ["Anything that reads as arena rock."],
  cameFrom: "written by Higher Roads",
};

async function ready() {
  const artistBackend = createMemoryBackend();
  const tourBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend });
  const tourStore = createTourStore({ backend: tourBackend });
  const artboardStore = createArtboardStore({ backend: tourBackend });
  const sceneRecord = createSceneRecord({ backend: tourBackend });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  return { tourBackend, options: { store, tourStore, artboardStore, sceneRecord } };
}

async function frozenBrief(options, at = AT) {
  await tourAction({ action: "choose-concept", ...at, person: "Grey", concept: CONCEPT }, options);
  return await tourAction({ action: "freeze-brief", ...at, person: "Grey" }, options);
}

test("sending a frozen brief stores artboard version 1, a receipt, and the artifact", async () => {
  const { tourBackend, options } = await ready();
  await frozenBrief(options);
  const sent = await tourAction({ action: "send-brief", ...AT }, options);

  assert.equal(sent.artboard.artboardVersion, 1);
  assert.equal(sent.artboard.briefVersion, 1);
  assert.equal(sent.receipt.briefVersion, 1);
  assert.ok(sent.receipt.receivedAt);

  const stored = await tourAction({ action: "get-artboards", ...AT }, options);
  assert.equal(stored.artboards.length, 1);
  assert.equal(stored.artboards[0].artboard.artboardVersion, 1);
  assert.ok(stored.artboards[0].receipt.receivedAt);

  const artifactPath = artifactPathFor(TOUR, ASSIGNMENT, 1);
  const svg = tourBackend.files.get(artifactPath);
  assert.ok(svg, "the artboard artifact is not in storage");
  assert.match(svg, /^<svg /);
  assert.ok(svg.includes(STAND_IN_LABEL), "the artifact does not carry the stand-in label");
  assert.ok(svg.includes("BRIEF V01 / ARTBOARD V01"));
});

test("the label travels on the payload as well as the file", async () => {
  const { options } = await ready();
  await frozenBrief(options);
  const sent = await tourAction({ action: "send-brief", ...AT }, options);
  assert.equal(sent.label, STAND_IN_LABEL);
  assert.equal(sent.artboard.label, STAND_IN_LABEL);
  assert.equal(sent.receipt.label, STAND_IN_LABEL);
  assert.equal(sent.artboard.artifact.label, STAND_IN_LABEL);
});

test("sending the same brief version twice is refused in plain words and stores nothing", async () => {
  const { tourBackend, options } = await ready();
  await frozenBrief(options);
  await tourAction({ action: "send-brief", ...AT }, options);
  const before = tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/artboards.json`);
  const recordBefore = tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/scene-record.json`);

  await assert.rejects(
    () => tourAction({ action: "send-brief", ...AT }, options),
    /That brief version has already gone out/,
  );

  const after = tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/artboards.json`);
  assert.equal(after, before, "the refused send changed what was stored");
  assert.equal(
    tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/scene-record.json`),
    recordBefore,
    "the refused send wrote a fact",
  );
  const stored = await tourAction({ action: "get-artboards", ...AT }, options);
  assert.equal(stored.artboards.length, 1);
});

test("a brief that is not frozen cannot be sent", async () => {
  const { options } = await ready();
  await tourAction({ action: "choose-concept", ...AT, person: "Grey", concept: CONCEPT }, options);
  await assert.rejects(
    () => tourAction({ action: "send-brief", ...AT }, options),
    /Freeze the brief before sending it out/,
  );
});

test("a second Scene on the same tour sees none of the first Scene's artboards", async () => {
  const { options } = await ready();
  await frozenBrief(options);
  await tourAction({ action: "send-brief", ...AT }, options);

  const other = { tourId: TOUR, assignmentId: "storm-and-lightning" };
  // The fixture tour carries one assignment, so the second Scene is read
  // through the store directly at a name the tour does not hold. What matters
  // is that the scope is the Scene and not the tour.
  const store = options.artboardStore;
  assert.deepEqual(await store.readArtboards(TOUR, "second-scene"), []);
  assert.equal((await store.readArtboards(TOUR, other.assignmentId)).length, 1);

  const record = options.sceneRecord;
  assert.deepEqual(await record.readFacts(TOUR, "second-scene"), []);
});

test("freezing and sending append exactly two facts to the Scene record, in order", async () => {
  const { options } = await ready();
  await frozenBrief(options);
  const afterFreeze = await tourAction({ action: "get-scene-record", ...AT }, options);
  assert.equal(afterFreeze.facts.length, 1);

  await tourAction({ action: "send-brief", ...AT }, options);
  const { facts } = await tourAction({ action: "get-scene-record", ...AT }, options);

  assert.equal(facts.length, 2);
  assert.equal(facts[0].action, "Froze the brief");
  assert.equal(facts[1].action, "Sent the brief to production");
  assert.equal(facts[0].version, "Brief V01");
  assert.equal(facts[1].version, "Brief V01");
  for (const fact of facts) {
    assert.equal(fact.actor, "Higher Roads");
    assert.ok(fact.at, "a fact has no time on it");
  }
});

test("the Scene record never rewrites a fact that is already written", async () => {
  const { options } = await ready();
  const record = options.sceneRecord;
  const first = await record.appendFact(TOUR, ASSIGNMENT, { action: "Froze the brief", version: "Brief V01" });
  await record.appendFact(TOUR, ASSIGNMENT, { action: "Sent the brief to production", version: "Brief V01" });
  const facts = await record.readFacts(TOUR, ASSIGNMENT);
  assert.deepEqual(facts[0], first);
});

test("the Scene page loads only the design system and says nothing in architecture words", () => {
  const markup = fs.readFileSync(path.join(rootPath, "app/scene.html"), "utf8");
  const sheets = markup.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || [];
  assert.equal(sheets.length, 1);
  assert.match(sheets[0], /\.\/design\/index\.css/);

  const script = fs.readFileSync(path.join(rootPath, "app/scene.js"), "utf8");
  const stripped = script.replace(/\/\/[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  const literals = (stripped.match(/`[^`]*`|"[^"\n]*"|'[^'\n]*'/g) || [])
    .map((entry) => entry.replace(/\$\{[^{}]*\}/g, " ").replace(/<[^>]*>/g, " ").trim())
    .filter((text) => /\s/.test(text))
    .join(" | ");
  for (const word of ["bin", "facet", "governance", "candidate", "proposed", "finding-"]) {
    assert.ok(!new RegExp(`\\b${word}`, "i").test(literals), `the Scene page says "${word}" to a person`);
  }
  assert.ok(!literals.includes("\u2014"), "the Scene page carries an em dash");
});
