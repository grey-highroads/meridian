import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { buildProposalRequest } from "../src/tour/propose.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";

// The surfaces the media plays on reach concept development. The proposal
// instructions already forbid describing an effect the listed surfaces cannot
// produce, so the list has to be in front of the model. Every check reads the
// assembled prompt, which is what the model would receive.

const DEMO_ACCOUNT = "dierks-bentley";
const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };
const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };

const SURFACES = [
  { name: "Side tent walls", description: "Both long walls of the tent, left and right of the stage." },
  { name: "Ceiling above the stage", description: "The canvas directly over the band." },
];

async function ready() {
  const artistBackend = createMemoryBackend();
  const tourBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend, accountId: DEMO_ACCOUNT });
  const tourStore = createTourStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  const sceneRecord = createSceneRecord({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  const artboardStore = createArtboardStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  return { options: { store, tourStore, artboardStore, sceneRecord, user: OPERATOR } };
}

async function prompt(options) {
  const { context } = await tourAction({ action: "assignment-context", ...AT }, options);
  const request = buildProposalRequest(context);
  return { context, text: request.messages.map((entry) => entry.content).join("\n") };
}

test("a project with surfaces puts them in front of the model, ahead of the findings", async () => {
  const { options } = await ready();
  await tourAction({ action: "save-tour-surfaces", tourId: TOUR, surfaces: SURFACES }, options);
  const { context, text } = await prompt(options);

  assert.deepEqual(context.surfaces.map((entry) => entry.name), ["Side tent walls", "Ceiling above the stage"], "the context did not carry the surfaces");
  assert.ok(text.includes("Side tent walls. Both long walls of the tent, left and right of the stage."), "the first surface did not reach the prompt with its description");
  assert.ok(text.includes("Ceiling above the stage. The canvas directly over the band."), "the second surface did not reach the prompt with its description");
  assert.ok(text.includes("Never describe an effect the listed surfaces cannot produce."), "the instruction the list exists to serve is missing");

  const findings = text.indexOf("Every finding the brain holds");
  assert.ok(findings > -1, "the prompt carries no findings block");
  assert.ok(text.indexOf("Side tent walls") < findings, "the surfaces do not lead the findings");
});

test("a project with no surfaces still builds a context and keeps the open question in place", async () => {
  const { options } = await ready();
  const { context, text } = await prompt(options);

  assert.deepEqual(context.surfaces, [], "a project with no surfaces reads something other than an empty list");
  assert.ok(text.includes("Never describe an effect the listed surfaces cannot produce."), "the instruction went missing when nothing was recorded");
  assert.ok(text.includes("What was asked for:") || text.includes("What the tour manager is asking for:"), "the request did not reach the prompt");
  assert.doesNotMatch(text, /The surfaces this work plays on/, "an empty list still wrote a surfaces block");
});

test("a job with no subject carries its surfaces and keeps the open question instruction", async () => {
  const { options } = await ready();
  await tourAction({ action: "save-tour-surfaces", tourId: TOUR, surfaces: SURFACES }, options);
  const { context } = await prompt(options);
  const subjectless = buildProposalRequest({ ...context, hasSubject: false, findings: [] });
  const text = subjectless.messages.map((entry) => entry.content).join("\n");

  assert.ok(text.includes("Side tent walls. Both long walls of the tent, left and right of the stage."), "the surfaces did not reach the subjectless prompt");
  assert.ok(text.includes("If the surfaces were not described to you"), "the open question instruction is missing from the subjectless prompt");
});
