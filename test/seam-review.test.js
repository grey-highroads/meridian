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


// Two people, the way the account holds them. The actor on every fact comes
// from here and never from a request body.
const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const REVIEWER = { id: "client", login: "dana", displayName: "Dana Whitlock", role: "client-reviewer", roleLabel: "Client reviewer" };

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
  cameFrom: "written by Higher Roads",
};

const REVISION = {
  revisionId: "rev-1",
  sourceArtboardVersion: 1,
  instructions: [{ text: "Hold the break a beat longer.", regionAnchor: "Top right" }],
  preserve: ["The uninterrupted trace across the back wall."],
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
  const options = { store, tourStore, artboardStore, sceneRecord, user: OPERATOR };
  return { tourBackend, options, asClient: { ...options, user: REVIEWER } };
}

async function sent(options) {
  await tourAction({ action: "choose-concept", ...AT, person: "Grey", concept: CONCEPT }, options);
  await tourAction({ action: "freeze-brief", ...AT, person: "Grey" }, options);
  return await tourAction({ action: "send-brief", ...AT }, options);
}

test("a review of version 1 is stored, and a second review of the same version is refused", async () => {
  const { options } = await ready();
  await sent(options);

  const saved = await tourAction({
    action: "save-review",
    ...AT,
    artboardVersion: 1,
    departures: ["The break lands harder than the brief asked for."],
    technicalItems: ["Confirm the trace stays inside the safe area."],
  }, options);

  assert.equal(saved.review.artboardVersion, 1);
  assert.equal(saved.review.briefVersion, 1);
  assert.equal(saved.review.writtenBy, OPERATOR.displayName);
  assert.equal(saved.review.departures.length, 1);
  assert.equal(saved.review.technicalItems.length, 1);

  const read = await tourAction({ action: "get-reviews", ...AT }, options);
  assert.equal(read.reviews.length, 1);

  await assert.rejects(
    () => tourAction({ action: "save-review", ...AT, artboardVersion: 1, departures: ["Something else."] }, options),
    /A review of that version is already written/,
  );
  assert.equal((await tourAction({ action: "get-reviews", ...AT }, options)).reviews.length, 1);
});

test("a review needs at least one note", async () => {
  const { options } = await ready();
  await sent(options);
  await assert.rejects(
    () => tourAction({ action: "save-review", ...AT, artboardVersion: 1, departures: [], technicalItems: [] }, options),
    /A review needs at least one note/,
  );
});

test("a revision against version 1 stores version 2, a receipt, and a second file, and leaves version 1 alone", async () => {
  const { tourBackend, options } = await ready();
  await sent(options);

  const firstPath = artifactPathFor(TOUR, ASSIGNMENT, 1);
  const before = tourBackend.files.get(firstPath);
  assert.ok(before);

  const result = await tourAction({ action: "send-revision", ...AT, ...REVISION }, options);

  assert.equal(result.artboard.artboardVersion, 2);
  assert.equal(result.receipt.revisionId, "rev-1");
  assert.equal(result.receipt.sourceArtboardVersion, 1);
  assert.equal(result.artboard.label, STAND_IN_LABEL);

  const secondPath = artifactPathFor(TOUR, ASSIGNMENT, 2);
  const second = tourBackend.files.get(secondPath);
  assert.ok(second, "the second artboard file is not in storage");
  assert.ok(second.includes("BRIEF V01 / ARTBOARD V02"));
  assert.notEqual(second, before, "the two versions are the same file");

  assert.equal(tourBackend.files.get(firstPath), before, "version 1's file changed");

  const stored = await tourAction({ action: "get-artboards", ...AT }, options);
  assert.equal(stored.artboards.length, 2);
  assert.deepEqual(stored.artboards[0].artboard, JSON.parse(JSON.stringify(stored.artboards[0].artboard)));
  assert.equal(stored.artboards[0].artboard.artboardVersion, 1);
});

test("the region anchor and the preserve list round trip into the stored revision unchanged", async () => {
  const { options } = await ready();
  await sent(options);
  await tourAction({ action: "send-revision", ...AT, ...REVISION }, options);

  const { revisions } = await tourAction({ action: "get-reviews", ...AT }, options);
  assert.equal(revisions.length, 1);
  assert.deepEqual(revisions[0].instructions, [
    { text: "Hold the break a beat longer.", regionAnchor: "Top right" },
  ]);
  assert.deepEqual(revisions[0].preserve, ["The uninterrupted trace across the back wall."]);
  assert.equal(revisions[0].sourceArtboardVersion, 1);
  assert.equal(revisions[0].producedArtboardVersion, 2);
  assert.equal(revisions[0].sentBy, OPERATOR.displayName);
});

test("an anchor that is not one of ours is dropped rather than passed on", async () => {
  const { options } = await ready();
  await sent(options);
  await tourAction({
    action: "send-revision",
    ...AT,
    revisionId: "rev-1",
    sourceArtboardVersion: 1,
    instructions: [{ text: "Warm the sky.", regionAnchor: "__proto__" }],
    preserve: [],
  }, options);
  const { revisions } = await tourAction({ action: "get-reviews", ...AT }, options);
  assert.equal(revisions[0].instructions[0].regionAnchor, null);
});

test("a revision against version 1 once version 2 exists is refused and stores nothing", async () => {
  const { tourBackend, options } = await ready();
  await sent(options);
  await tourAction({ action: "send-revision", ...AT, ...REVISION }, options);

  const artboardsBefore = tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/artboards.json`);
  const revisionsBefore = tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/revisions.json`);
  const recordBefore = tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/scene-record.json`);

  await assert.rejects(
    () => tourAction({ action: "send-revision", ...AT, ...REVISION, revisionId: "rev-2" }, options),
    /A newer version of this artboard already came back/,
  );

  assert.equal(tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/artboards.json`), artboardsBefore);
  assert.equal(tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/revisions.json`), revisionsBefore);
  assert.equal(tourBackend.files.get(`brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/scene-record.json`), recordBefore);
  assert.equal(tourBackend.files.get(artifactPathFor(TOUR, ASSIGNMENT, 3)), undefined);
});

test("a revision needs an identifier and something to change", async () => {
  const { options } = await ready();
  await sent(options);
  await assert.rejects(
    () => tourAction({ action: "send-revision", ...AT, sourceArtboardVersion: 1, instructions: [{ text: "Warmer." }] }, options),
    /A revision needs an identifier/,
  );
  await assert.rejects(
    () => tourAction({ action: "send-revision", ...AT, sourceArtboardVersion: 1, revisionId: "rev-1", instructions: [] }, options),
    /Say what should change before you send it back/,
  );
});

test("a second Scene sees none of this Scene's reviews or revisions", async () => {
  const { options } = await ready();
  await sent(options);
  await tourAction({ action: "save-review", ...AT, artboardVersion: 1, departures: ["A note."] }, options);
  await tourAction({ action: "send-revision", ...AT, ...REVISION }, options);

  const store = options.artboardStore;
  assert.deepEqual(await store.readReviews(TOUR, "second-scene"), []);
  assert.deepEqual(await store.readRevisions(TOUR, "second-scene"), []);
  assert.equal((await store.readReviews(TOUR, ASSIGNMENT)).length, 1);
  assert.equal((await store.readRevisions(TOUR, ASSIGNMENT)).length, 1);
});

test("the review and the revision each append exactly one fact", async () => {
  const { options } = await ready();
  await sent(options);
  const start = (await tourAction({ action: "get-scene-record", ...AT }, options)).facts.length;

  await tourAction({ action: "save-review", ...AT, artboardVersion: 1, departures: ["A note."] }, options);
  const afterReview = (await tourAction({ action: "get-scene-record", ...AT }, options)).facts;
  assert.equal(afterReview.length, start + 1);
  assert.equal(afterReview[afterReview.length - 1].action, "Wrote the review");
  assert.equal(afterReview[afterReview.length - 1].version, "Artboard V01");

  await tourAction({ action: "send-revision", ...AT, ...REVISION }, options);
  const afterRevision = (await tourAction({ action: "get-scene-record", ...AT }, options)).facts;
  assert.equal(afterRevision.length, start + 2);
  assert.equal(afterRevision[afterRevision.length - 1].action, "Requested internal changes");
  assert.equal(afterRevision[afterRevision.length - 1].version, "Artboard V01");
  for (const fact of afterRevision) {
    assert.equal(fact.actor, OPERATOR.displayName);
    assert.equal(fact.role, "Higher Roads");
    assert.ok(fact.at);
  }
});

test("the artboard file is served back for the version that asks for it", async () => {
  const { options } = await ready();
  await sent(options);
  const served = await tourAction({ action: "get-artboard-artifact", ...AT, artboardVersion: 1 }, options);
  assert.match(served.svg, /^<svg /);
  assert.ok(served.svg.includes(STAND_IN_LABEL));
  await assert.rejects(
    () => tourAction({ action: "get-artboard-artifact", ...AT, artboardVersion: 9 }, options),
    /That artboard version was not found/,
  );
});

test("the review page loads only the design system and says nothing in architecture words", () => {
  const markup = fs.readFileSync(path.join(rootPath, "app/review.html"), "utf8");
  const sheets = markup.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || [];
  assert.equal(sheets.length, 1);
  assert.match(sheets[0], /\.\/design\/index\.css/);

  const script = fs.readFileSync(path.join(rootPath, "app/review.js"), "utf8");
  const stripped = script.replace(/\/\/[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  const literals = (stripped.match(/`[^`]*`|"[^"\n]*"|'[^'\n]*'/g) || [])
    .map((entry) => entry.replace(/\$\{[^{}]*\}/g, " ").replace(/<[^>]*>/g, " ").trim())
    .filter((text) => /\s/.test(text))
    .join(" | ");
  for (const word of ["bin", "facet", "governance", "candidate", "proposed", "finding-"]) {
    assert.ok(!new RegExp(`\\b${word}`, "i").test(literals), `the review page says "${word}" to a person`);
  }
  assert.ok(!literals.includes("\u2014"), "the review page carries an em dash");
});

test("the Scene page keeps the receipt and hands the rest to review", () => {
  const script = fs.readFileSync(path.join(rootPath, "app/scene.js"), "utf8");
  assert.ok(script.includes("receiptSection"), "the Scene page lost the receipt");
  assert.ok(!script.includes("artboardSection"), "the Scene page still lists what came back");
  assert.ok(!script.includes("recordSection"), "the Scene page still shows the record");
  assert.ok(script.includes("./review.html"), "the Scene page has no way through to review");
});
