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

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");


// Two people, the way the account holds them. The actor on every fact comes
// from here and never from a request body.
const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const REVIEWER = { id: "client", login: "dana", displayName: "Dana Whitlock", role: "client-reviewer", roleLabel: "Client reviewer" };

const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };
const INTENT_PATH = `brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/production-intent.json`;
const APPROVALS_PATH = `brand-world-system/clients/${TOUR}/tour/${ASSIGNMENT}/approvals.json`;

const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
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
  const options = { store, tourStore, artboardStore, sceneRecord, user: OPERATOR };
  return { tourBackend, options, asClient: { ...options, user: REVIEWER } };
}

// Up to version 2, which is where phase two starts.
async function atVersionTwo(options) {
  await tourAction({ action: "choose-concept", ...AT, person: "Grey", concept: CONCEPT }, options);
  await tourAction({ action: "freeze-brief", ...AT, person: "Grey" }, options);
  await tourAction({ action: "send-brief", ...AT }, options);
  await tourAction({
    action: "send-revision",
    ...AT,
    revisionId: "rev-1",
    sourceArtboardVersion: 1,
    instructions: [{ text: "Hold the break a beat longer.", regionAnchor: "Top right" }],
    preserve: [],
  }, options);
}

test("the client cannot approve a version that was never sent to them, and nothing is stored", async () => {
  const { tourBackend, options } = await ready();
  await atVersionTwo(options);

  await assert.rejects(
    () => tourAction({ action: "client-approve", ...AT, artboardVersion: 2 }, options),
    /That version has not been sent to the client yet/,
  );
  assert.equal(tourBackend.files.get(INTENT_PATH), undefined);
  assert.equal(tourBackend.files.get(APPROVALS_PATH), undefined);

  await assert.rejects(
    () => tourAction({ action: "client-comment", ...AT, artboardVersion: 2, text: "Nice." }, options),
    /That version has not been sent to the client yet/,
  );
  assert.equal(tourBackend.files.get(APPROVALS_PATH), undefined);
});

test("clearing version 2 then a client approval writes one intent carrying version 2 and the playback line", async () => {
  const { options, asClient } = await ready();
  await atVersionTwo(options);

  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2 }, options);
  await tourAction({ action: "client-approve", ...AT, artboardVersion: 2 }, asClient);

  const state = await tourAction({ action: "get-production-intent", ...AT }, options);
  assert.equal(state.intents.length, 1);
  const intent = state.intents[0];
  assert.equal(intent.artboardVersion, 2);
  assert.equal(intent.briefVersion, 1);
  assert.equal(intent.jobId, `${TOUR}--${ASSIGNMENT}`);
  assert.equal(intent.approvedBy, REVIEWER.displayName);
  assert.ok(intent.approvedAt);

  const tour = await tourAction({ action: "get-tour", ...AT }, options);
  assert.equal(intent.technicalProfileRef, tour.tour.playbackSystem);
  assert.ok(intent.technicalProfileRef, "the playback line did not reach the intent");

  // Two authorities, recorded apart.
  assert.equal(state.readyForClient[0].approvedBy, OPERATOR.displayName);
  assert.equal(state.clientApprovals[0].approvedBy, REVIEWER.displayName);
});

test("a second client approval on the same version is refused", async () => {
  const { tourBackend, options } = await ready();
  await atVersionTwo(options);
  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2 }, options);
  await tourAction({ action: "client-approve", ...AT, artboardVersion: 2 }, options);

  const before = tourBackend.files.get(INTENT_PATH);
  await assert.rejects(
    () => tourAction({ action: "client-approve", ...AT, artboardVersion: 2 }, options),
    /That version is already approved/,
  );
  assert.equal(tourBackend.files.get(INTENT_PATH), before, "the refused approval changed the intent");
});

test("clearing the same version for the client twice is refused", async () => {
  const { options } = await ready();
  await atVersionTwo(options);
  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2 }, options);
  await assert.rejects(
    () => tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2 }, options),
    /That version is already ready for the client/,
  );
});

test("a version 3 and a second approval write a second intent, and the first is byte identical", async () => {
  const { tourBackend, options } = await ready();
  await atVersionTwo(options);
  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2 }, options);
  await tourAction({ action: "client-approve", ...AT, artboardVersion: 2 }, options);

  const firstIntent = JSON.parse(tourBackend.files.get(INTENT_PATH)).intents[0];
  const firstText = JSON.stringify(firstIntent);

  await tourAction({
    action: "send-revision",
    ...AT,
    revisionId: "rev-2",
    sourceArtboardVersion: 2,
    instructions: [{ text: "Cool the last frame." }],
    preserve: [],
  }, options);
  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 3 }, options);
  await tourAction({ action: "client-approve", ...AT, artboardVersion: 3 }, options);

  const intents = JSON.parse(tourBackend.files.get(INTENT_PATH)).intents;
  assert.equal(intents.length, 2);
  assert.equal(JSON.stringify(intents[0]), firstText, "the first intent changed");
  assert.equal(intents[1].artboardVersion, 3);
});

test("the client review page says nothing internal to the person reading it", () => {
  const markup = fs.readFileSync(path.join(rootPath, "app/client-review.html"), "utf8");
  const sheets = markup.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || [];
  assert.equal(sheets.length, 1);
  assert.match(sheets[0], /\.\/design\/index\.css/);

  const script = fs.readFileSync(path.join(rootPath, "app/client-review.js"), "utf8");
  const stripped = script.replace(/\/\/[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  const copy = [
    markup.replace(/<[^>]*>/g, " "),
    (stripped.match(/`[^`]*`|"[^"\n]*"|'[^'\n]*'/g) || [])
      .map((entry) => entry.replace(/\$\{[^{}]*\}/g, " ").replace(/<[^>]*>/g, " ").trim())
      .filter((text) => /\s/.test(text))
      .join(" | "),
  ].join(" | ");

  for (const word of ["finding", "warning", "score", "governance", "bin", "facet", "candidate", "technical"]) {
    assert.ok(!new RegExp(`\\b${word}`, "i").test(copy), `the client page says "${word}"`);
  }
  assert.ok(!/Higher Roads/i.test(copy), "the client page says Higher Roads");
  assert.ok(!copy.includes("\u2014"), "the client page carries an em dash");
});

test("a client session is refused everywhere but their own review, and stores nothing", async () => {
  const { tourBackend, options, asClient } = await ready();
  await atVersionTwo(options);
  const before = tourBackend.files.get(APPROVALS_PATH);

  for (const action of ["save-review", "send-revision", "approve-for-client", "send-brief", "freeze-brief", "choose-concept"]) {
    await assert.rejects(
      () => tourAction({ action, ...AT, artboardVersion: 2, sourceArtboardVersion: 2, revisionId: "r-1" }, asClient),
      (error) => error.status === 403,
      `a client session reached ${action}`,
    );
  }
  assert.equal(tourBackend.files.get(APPROVALS_PATH), before, "a refused client session changed storage");

  // No session at all is refused the same way, including on a read.
  for (const action of ["get-tour", "approve-for-client"]) {
    await assert.rejects(
      () => tourAction({ action, ...AT, artboardVersion: 2 }, { ...options, user: null }),
      (error) => error.status === 401,
      `an unsigned request reached ${action}`,
    );
  }
});

test("the actor on an approval comes from the session and never from the request", async () => {
  const { tourBackend, options, asClient } = await ready();
  await atVersionTwo(options);
  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2, person: "Someone else" }, options);
  const cleared = tourBackend.files.get(APPROVALS_PATH);
  await tourAction({ action: "client-approve", ...AT, artboardVersion: 2, person: "Someone else", actor: "Someone else" }, asClient);

  const state = await tourAction({ action: "get-production-intent", ...AT }, options);
  assert.equal(state.readyForClient[0].approvedBy, OPERATOR.displayName);
  assert.equal(state.clientApprovals[0].approvedBy, REVIEWER.displayName);
  assert.equal(state.intents[0].approvedBy, REVIEWER.displayName);
  assert.ok(cleared.includes(OPERATOR.displayName));
  assert.ok(!cleared.includes("Someone else"), "a name from the request reached storage");
});

test("each end of loop action appends exactly one fact", async () => {
  const { options, asClient } = await ready();
  await atVersionTwo(options);
  const start = (await tourAction({ action: "get-scene-record", ...AT }, options)).facts.length;

  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2 }, options);
  let facts = (await tourAction({ action: "get-scene-record", ...AT }, options)).facts;
  assert.equal(facts.length, start + 1);
  assert.equal(facts[facts.length - 1].action, "Approved for the client to see");
  assert.equal(facts[facts.length - 1].actor, OPERATOR.displayName);
  assert.equal(facts[facts.length - 1].role, "Higher Roads");

  await tourAction({ action: "client-comment", ...AT, artboardVersion: 2, text: "The break reads well." }, asClient);
  facts = (await tourAction({ action: "get-scene-record", ...AT }, options)).facts;
  assert.equal(facts.length, start + 2);
  assert.equal(facts[facts.length - 1].action, "Left a comment");
  assert.equal(facts[facts.length - 1].actor, REVIEWER.displayName);
  assert.equal(facts[facts.length - 1].role, "Client reviewer");

  await tourAction({ action: "client-approve", ...AT, artboardVersion: 2 }, asClient);
  facts = (await tourAction({ action: "get-scene-record", ...AT }, options)).facts;
  assert.equal(facts.length, start + 3);
  assert.equal(facts[facts.length - 1].action, "Approved the work");
  assert.equal(facts[facts.length - 1].actor, REVIEWER.displayName);
  assert.equal(facts[facts.length - 1].version, "Artboard V02");
  for (const fact of facts) assert.ok(fact.at);
});

test("the whole loop reads as facts in the order it happened", async () => {
  const { options } = await ready();
  await atVersionTwo(options);
  await tourAction({ action: "save-review", ...AT, artboardVersion: 2, departures: ["A note."] }, options);
  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2 }, options);
  await tourAction({ action: "client-approve", ...AT, artboardVersion: 2 }, options);

  const { facts } = await tourAction({ action: "get-scene-record", ...AT }, options);
  assert.deepEqual(facts.map((fact) => fact.action), [
    "Froze the brief",
    "Sent the brief to production",
    "Requested internal changes",
    "Wrote the review",
    "Approved for the client to see",
    "Approved the work",
  ]);
});

test("a second Scene sees none of this Scene's approvals or intent", async () => {
  const { options } = await ready();
  await atVersionTwo(options);
  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2 }, options);
  await tourAction({ action: "client-approve", ...AT, artboardVersion: 2 }, options);

  const store = options.artboardStore;
  const empty = await store.readApprovals(TOUR, "second-scene");
  assert.deepEqual(empty, { readyForClient: [], clientApprovals: [], comments: [] });
  assert.deepEqual(await store.readIntents(TOUR, "second-scene"), []);
  assert.equal((await store.readIntents(TOUR, ASSIGNMENT)).length, 1);
});
