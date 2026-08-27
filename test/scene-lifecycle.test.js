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
import { conceptPath, sceneLifecycle, SENT_TO_PRODUCTION, STAGES } from "../src/tour/lifecycle.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";

const DEMO_ACCOUNT = "dierks-bentley";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const REVIEWER = { id: "client", login: "dana", displayName: "Dana Whitlock", role: "client-reviewer", roleLabel: "Client reviewer" };

const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };

const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
  cameFrom: "written by Higher Roads",
};

async function ready() {
  const artistBackend = createMemoryBackend();
  const tourBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend, accountId: DEMO_ACCOUNT });
  const tourStore = createTourStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  const artboardStore = createArtboardStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  const sceneRecord = createSceneRecord({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  const options = { store, tourStore, artboardStore, sceneRecord, user: OPERATOR };
  return { tourBackend, sceneRecord, options, asClient: { ...options, user: REVIEWER } };
}

async function sceneState(options) {
  const { assignments } = await tourAction({ action: "get-tour", tourId: TOUR }, options);
  return assignments.find((entry) => entry.id === ASSIGNMENT);
}

// Durable shapes, written by hand, so every stage can be reached including the
// two the current loop cannot produce.
const REQUEST = { requestedBy: "Marcus Deel, Tour Manager", requestedOn: "2026-02-03" };
const FROZEN_BRIEF = { briefVersion: 1, status: "frozen" };
const SENT_FACT = { actor: "Ray Mercer", action: SENT_TO_PRODUCTION, version: "Brief V01" };
const ARTBOARD_ONE = { artboard: { artboardVersion: 1, briefVersion: 1 } };

const SNAPSHOTS = [
  ["draft request", {}, STAGES.draftRequest, null, "Higher Roads", "Finish the request and submit it."],
  ["requested", { request: REQUEST }, STAGES.requested, null, "Higher Roads", "Develop this Scene."],
  [
    "concept in development",
    { request: REQUEST, concept: CONCEPT },
    STAGES.conceptInDevelopment, null, "Higher Roads", "Prepare this Scene for production.",
  ],
  [
    "concept review",
    { request: REQUEST, concept: CONCEPT, briefs: [FROZEN_BRIEF] },
    STAGES.conceptReview, "Brief V01", "Higher Roads", "Send the brief to the media team.",
  ],
  [
    "approved for production",
    { request: REQUEST, concept: CONCEPT, briefs: [FROZEN_BRIEF], facts: [SENT_FACT] },
    STAGES.approvedForProduction, "Brief V01", "production", "The media team is working on the next version.",
  ],
  [
    "production review",
    { request: REQUEST, concept: CONCEPT, briefs: [FROZEN_BRIEF], facts: [SENT_FACT], artboards: [ARTBOARD_ONE] },
    STAGES.productionReview, "Artboard V01", "Higher Roads", "Review the latest version before it goes to the client.",
  ],
  [
    "final approved",
    {
      request: REQUEST,
      briefs: [FROZEN_BRIEF],
      artboards: [ARTBOARD_ONE],
      approvals: { readyForClient: [{ artboardVersion: 1 }], clientApprovals: [{ artboardVersion: 1 }] },
    },
    STAGES.finalApproved, "Artboard V01", "production", "Prepare the approved version for final delivery.",
  ],
  [
    "delivered",
    {
      request: REQUEST,
      briefs: [FROZEN_BRIEF],
      artboards: [ARTBOARD_ONE],
      approvals: { clientApprovals: [{ artboardVersion: 1 }] },
      deliveries: [{ artboardVersion: 1 }],
    },
    STAGES.delivered, "Artboard V01", "no one", "Final media has been delivered.",
  ],
];

test("durable snapshots produce all eight stages with their party, job, and version", () => {
  const seen = new Set();
  for (const [name, scene, stage, currentVersion, waitingOn, nextAction] of SNAPSHOTS) {
    const state = sceneLifecycle(scene);
    assert.equal(state.stage, stage, name);
    assert.equal(state.currentVersion, currentVersion, name);
    assert.equal(state.waitingOn, waitingOn, name);
    assert.equal(state.nextAction, nextAction, name);
    seen.add(state.stage);
  }
  assert.equal(seen.size, 8);
});

test("a cleared version moves the party to the client without moving the stage", () => {
  const scene = {
    request: REQUEST,
    briefs: [FROZEN_BRIEF],
    artboards: [ARTBOARD_ONE],
    approvals: { readyForClient: [{ artboardVersion: 1 }] },
  };
  const state = sceneLifecycle(scene);
  assert.equal(state.stage, STAGES.productionReview);
  assert.equal(state.waitingOn, "the client");
  assert.equal(state.nextAction, "Review the latest version.");
});

test("the current version is the most advanced Scene object and never the tour's direction version", () => {
  const briefsOnly = sceneLifecycle({ request: REQUEST, briefs: [{ briefVersion: 1, status: "frozen" }, { briefVersion: 2, status: "frozen" }] });
  assert.equal(briefsOnly.currentVersion, "Brief V02");
  const withArtboards = sceneLifecycle({
    request: REQUEST,
    briefs: [{ briefVersion: 2, status: "frozen" }],
    artboards: [ARTBOARD_ONE, { artboard: { artboardVersion: 2, briefVersion: 1 } }],
    directionVersion: 7,
  });
  assert.equal(withArtboards.currentVersion, "Artboard V02");
  assert.equal(sceneLifecycle({ request: REQUEST }).currentVersion, null);
});

test("real actions produce every state the current stand-in can show", async () => {
  const { options, asClient } = await ready();

  let scene = await sceneState(options);
  assert.equal(scene.stage, STAGES.requested);
  assert.equal(scene.currentVersion, null);
  assert.equal(scene.waitingOn, "Higher Roads");

  await tourAction({ action: "choose-concept", ...AT, concept: CONCEPT }, options);
  scene = await sceneState(options);
  assert.equal(scene.stage, STAGES.conceptInDevelopment);
  assert.equal(scene.currentVersion, null);

  await tourAction({ action: "freeze-brief", ...AT }, options);
  scene = await sceneState(options);
  assert.equal(scene.stage, STAGES.conceptReview);
  assert.equal(scene.currentVersion, "Brief V01");
  assert.equal(scene.nextAction, "Send the brief to the media team.");

  await tourAction({ action: "send-brief", ...AT }, options);
  scene = await sceneState(options);
  assert.equal(scene.stage, STAGES.productionReview);
  assert.equal(scene.currentVersion, "Artboard V01");
  assert.equal(scene.waitingOn, "Higher Roads");

  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 1 }, options);
  scene = await sceneState(options);
  assert.equal(scene.stage, STAGES.productionReview);
  assert.equal(scene.waitingOn, "the client");

  await tourAction({ action: "client-approve", ...AT, artboardVersion: 1 }, asClient);
  scene = await sceneState(options);
  assert.equal(scene.stage, STAGES.finalApproved);
  assert.equal(scene.currentVersion, "Artboard V01");
  assert.equal(scene.waitingOn, "production");
  assert.equal(scene.nextAction, "Prepare the approved version for final delivery.");
});

// The stand-in stores the first artboard inside the same send action. Approved
// for production is a real derived state and it is not observable between two
// requests in this implementation. The snapshot above covers it; this test
// records why the loop test cannot.
test("the stand-in's send stores the artboard in the same action, so approved for production never appears", async () => {
  const { options } = await ready();
  await tourAction({ action: "choose-concept", ...AT, concept: CONCEPT }, options);
  await tourAction({ action: "freeze-brief", ...AT }, options);
  const sent = await tourAction({ action: "send-brief", ...AT }, options);
  assert.equal(sent.artboard.artboardVersion, 1);

  const scene = await sceneState(options);
  assert.notEqual(scene.stage, STAGES.approvedForProduction);
  assert.equal(scene.stage, STAGES.productionReview);

  // The same durable evidence without the artboard reports the stage the loop
  // passes through.
  const midway = sceneLifecycle({ request: REQUEST, concept: CONCEPT, briefs: [FROZEN_BRIEF], facts: [SENT_FACT] });
  assert.equal(midway.stage, STAGES.approvedForProduction);
});

test("a frozen brief that has not gone out reports concept review without claiming anyone approved a concept", () => {
  const state = sceneLifecycle({ request: REQUEST, concept: CONCEPT, briefs: [FROZEN_BRIEF] });
  assert.equal(state.stage, STAGES.conceptReview);
  assert.equal(state.waitingOn, "Higher Roads");
  assert.doesNotMatch(state.nextAction, /client/i);
  const source = fs.readFileSync(path.join(rootPath, "src/tour/lifecycle.js"), "utf8");
  assert.match(source, /concept-approval record/);
});

test("a draft brief is not evidence, so an unfrozen version leaves the Scene in development", () => {
  const state = sceneLifecycle({ request: REQUEST, concept: CONCEPT, briefs: [{ briefVersion: 1, status: "draft" }] });
  assert.equal(state.stage, STAGES.conceptInDevelopment);
  assert.equal(state.currentVersion, null);
});

test("both attribution fields round trip and a missing one stays missing", async () => {
  const { sceneRecord } = await ready();
  await sceneRecord.appendFact(TOUR, ASSIGNMENT, {
    actor: "Ray Mercer",
    action: "Froze the brief",
    onBehalfOf: "Marcus Deel, Tour Manager",
    path: "brain-assisted",
  });
  await sceneRecord.appendFact(TOUR, ASSIGNMENT, { actor: "Ray Mercer", action: "Left a comment" });
  const facts = await sceneRecord.readFacts(TOUR, ASSIGNMENT);
  assert.equal(facts[0].onBehalfOf, "Marcus Deel, Tour Manager");
  assert.equal(facts[0].path, "brain-assisted");
  assert.equal(facts[1].onBehalfOf, null);
  assert.equal(facts[1].path, null);
});

test("the path on a frozen brief comes from what the concept came from, and nobody's role", async () => {
  const { options } = await ready();
  await tourAction({ action: "choose-concept", ...AT, concept: CONCEPT }, options);
  await tourAction({ action: "freeze-brief", ...AT }, options);
  const { facts } = await tourAction({ action: "get-scene-record", ...AT }, options);
  const frozen = facts.find((entry) => entry.action === "Froze the brief");
  assert.equal(frozen.path, "direct");
  assert.equal(frozen.onBehalfOf, null);

  assert.equal(conceptPath({ cameFrom: "suggestion: The front, not the flash" }), "brain-assisted");
  assert.equal(conceptPath({ cameFrom: "proposal: The front, not the flash" }), "brain-assisted");
  assert.equal(conceptPath({ cameFrom: "written by Higher Roads" }), "direct");
  assert.equal(conceptPath({ cameFrom: "" }), null);
  assert.equal(conceptPath(null), null);
});

test("the directory says nothing in architecture words", () => {
  const strings = [];
  for (const [, scene] of SNAPSHOTS) {
    const state = sceneLifecycle(scene);
    strings.push(state.stage, state.waitingOn, state.nextAction, String(state.currentVersion || ""));
  }
  strings.push(fs.readFileSync(path.join(rootPath, "app/scenes.js"), "utf8"));
  for (const text of strings) {
    for (const word of ["bin", "facet", "governance", "candidate", "proposed", "finding-"]) {
      assert.ok(!new RegExp(`\\b${word}`, "i").test(text), `"${word}" reaches a person`);
    }
    assert.ok(!text.includes("\u2014"), "an em dash reaches a person");
  }
});
