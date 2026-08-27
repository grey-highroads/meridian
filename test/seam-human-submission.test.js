import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";

const DEMO_ACCOUNT = "dierks-bentley";

const OPERATOR = { id: "operator", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const ARTIST = { id: "artist", displayName: "Jess Harper", role: "higher-roads", roleLabel: "Higher Roads" };
const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };
const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
  cameFrom: "written by Higher Roads",
};
const ARTIFACT = {
  name: "storm-v1.svg",
  contentType: "image/svg+xml",
  size: 88,
  dataUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
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
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley" }, { store });
  const options = { store, tourStore, artboardStore, sceneRecord, user: OPERATOR };
  await tourAction({ action: "choose-concept", ...AT, concept: CONCEPT }, options);
  await tourAction({ action: "freeze-brief", ...AT }, options);
  return { options, asArtist: { ...options, user: ARTIST } };
}

test("issuing a frozen brief records the handoff without pretending work came back", async () => {
  const { options } = await ready();
  const { handoff } = await tourAction({
    action: "issue-brief",
    ...AT,
    briefVersion: 1,
    recipient: "Jess Harper",
    dueDate: "2026-03-01",
    contact: "jess@example.com",
  }, options);

  assert.equal(handoff.kind, "brief");
  assert.equal(handoff.briefVersion, 1);
  assert.equal(handoff.recipient, "Jess Harper");
  assert.match(handoff.directPath, /handoff\.html/);
  assert.deepEqual((await tourAction({ action: "get-artboards", ...AT }, options)).artboards, []);

  const scene = (await tourAction({ action: "get-tour", tourId: TOUR }, options)).assignments[0];
  assert.equal(scene.stage, "Approved for production");
  assert.equal(scene.waitingOn, "production");
});

test("a Higher Roads media artist submits the same artboard shape and receives an attributed receipt", async () => {
  const { options, asArtist } = await ready();
  await tourAction({ action: "issue-brief", ...AT, briefVersion: 1, recipient: "Jess Harper" }, options);
  const result = await tourAction({
    action: "submit-artboard",
    ...AT,
    briefVersion: 1,
    artifact: ARTIFACT,
    conceptSummary: "The weather remains quiet until the last break.",
    technicalAssumptions: ["One continuous canvas."],
  }, asArtist);

  assert.equal(result.artboard.artboardVersion, 1);
  assert.equal(result.artboard.briefVersion, 1);
  assert.equal(result.artboard.standIn, false);
  assert.equal(result.artboard.artifact.dataUrl, ARTIFACT.dataUrl);
  assert.equal(result.receipt.submittedBy, "Jess Harper");
  assert.equal(result.receipt.receivedBy, "Meridian");

  const stored = (await tourAction({ action: "get-artboards", ...AT }, options)).artboards;
  assert.equal(stored.length, 1);
  assert.equal(stored[0].receipt.submittedBy, "Jess Harper");
  const artifact = await tourAction({ action: "get-artboard-artifact", ...AT, artboardVersion: 1 }, asArtist);
  assert.equal(artifact.dataUrl, ARTIFACT.dataUrl);

  const facts = (await tourAction({ action: "get-scene-record", ...AT }, options)).facts;
  assert.equal(facts.at(-1).action, "Submitted work");
  assert.equal(facts.at(-1).actor, "Jess Harper");
  assert.equal(facts.at(-1).version, "Artboard V01");
});

test("a governed revision waits for the next human submission", async () => {
  const { options, asArtist } = await ready();
  await tourAction({ action: "issue-brief", ...AT, briefVersion: 1 }, options);
  await tourAction({ action: "submit-artboard", ...AT, briefVersion: 1, artifact: ARTIFACT, conceptSummary: "First reading." }, asArtist);

  const issued = await tourAction({
    action: "issue-revision",
    ...AT,
    sourceArtboardVersion: 1,
    revisionId: "rev-human-1",
    instructions: [{ text: "Hold the final frame longer.", regionAnchor: "Centre" }],
    preserve: ["Keep the quiet opening."],
    recipient: "Jess Harper",
  }, options);
  assert.equal(issued.revision.producedArtboardVersion, null);
  assert.equal((await tourAction({ action: "get-artboards", ...AT }, options)).artboards.length, 1);

  const second = await tourAction({
    action: "submit-artboard",
    ...AT,
    briefVersion: 1,
    sourceArtboardVersion: 1,
    artifact: { ...ARTIFACT, name: "storm-v2.svg" },
    conceptSummary: "The final frame now holds through the cue.",
  }, asArtist);
  assert.equal(second.artboard.artboardVersion, 2);
  assert.equal(second.receipt.sourceArtboardVersion, 1);
  assert.equal((await tourAction({ action: "get-artboards", ...AT }, options)).artboards.length, 2);
});

test("a submission needs an issued handoff, an artifact, and a sentence", async () => {
  const { asArtist } = await ready();
  await assert.rejects(
    () => tourAction({ action: "submit-artboard", ...AT, briefVersion: 1, artifact: ARTIFACT, conceptSummary: "A reading." }, asArtist),
    /Issue this brief/,
  );
});

test("a human handoff and the stand-in cannot both answer the same send", async () => {
  const { options, asArtist } = await ready();
  await tourAction({ action: "issue-brief", ...AT, briefVersion: 1 }, options);
  await assert.rejects(
    () => tourAction({ action: "send-brief", ...AT, briefVersion: 1 }, options),
    /issued to a person/,
  );
  await tourAction({ action: "submit-artboard", ...AT, briefVersion: 1, artifact: ARTIFACT, conceptSummary: "First reading." }, asArtist);
  await tourAction({
    action: "issue-revision",
    ...AT,
    sourceArtboardVersion: 1,
    revisionId: "rev-human-guard",
    instructions: [{ text: "Hold the ending." }],
  }, options);
  await assert.rejects(
    () => tourAction({ action: "send-revision", ...AT, sourceArtboardVersion: 1, revisionId: "stand-in-after-human", instructions: [{ text: "Hold the ending." }] }, options),
    /issued to a person/,
  );
  assert.equal((await tourAction({ action: "get-artboards", ...AT }, options)).artboards.length, 1);
});
