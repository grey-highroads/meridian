import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";

const OPERATOR = { id: "operator", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const CLIENT = { id: "client", displayName: "Nadia Cole", role: "client-reviewer", roleLabel: "Creative director" };
const TOUR = "off-the-map-2026";

async function ready() {
  const artistBackend = createMemoryBackend();
  const tourBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend });
  const tourStore = createTourStore({ backend: tourBackend });
  const artboardStore = createArtboardStore({ backend: tourBackend });
  const sceneRecord = createSceneRecord({ backend: tourBackend });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley" }, { store });
  const options = { store, tourStore, artboardStore, sceneRecord, user: OPERATOR, now: () => 1770000000000 };
  return { options, asClient: { ...options, user: CLIENT } };
}

test("Tour Direction stores the director's words as a new version and names affected Scenes", async () => {
  const { options } = await ready();
  const words = "The show begins in restraint and earns its scale. Keep the artist human inside the architecture.";
  const result = await tourAction({ action: "add-tour-direction", tourId: TOUR, words, onBehalfOf: "Nadia Cole" }, options);
  assert.equal(result.direction.version, 2);
  assert.equal(result.direction.words, words);
  assert.equal(result.direction.setBy, "Nadia Cole");
  assert.equal(result.direction.recordedBy, "Ray Mercer");
  assert.ok(result.affectedScenes.some((entry) => entry.id === "storm-and-lightning"));

  const { tour } = await tourAction({ action: "get-tour", tourId: TOUR }, options);
  assert.equal(tour.direction.version, 2);
  assert.equal(tour.direction.words, words);
});

test("an engaged client can request a thin Scene against the current direction", async () => {
  const { options, asClient } = await ready();
  await tourAction({ action: "add-tour-direction", tourId: TOUR, words: "Stay close to the people on stage, even when the image becomes monumental." }, asClient);
  const { assignment } = await tourAction({
    action: "create-scene-request",
    tourId: TOUR,
    title: "Final chorus",
    moment: "Final chorus",
    request: "Let the whole room feel like it is breathing with the last chorus.",
    references: ["https://example.com/reference"],
  }, asClient);

  assert.equal(assignment.title, "Final chorus");
  assert.equal(assignment.directionVersion, 2);
  assert.equal(assignment.requestedBy, "Nadia Cole");
  assert.deepEqual(assignment.references, ["https://example.com/reference"]);

  const { assignments } = await tourAction({ action: "get-tour", tourId: TOUR }, options);
  const stored = assignments.find((entry) => entry.id === assignment.id);
  assert.equal(stored.stage, "Requested");
  assert.equal(stored.nextAction, "Develop a concept for this Scene.");

  const scene = await tourAction({ action: "get-assignment", tourId: TOUR, assignmentId: assignment.id }, options);
  assert.equal(scene.assignment.request, assignment.request);
  const facts = (await tourAction({ action: "get-scene-record", tourId: TOUR, assignmentId: assignment.id }, options)).facts;
  assert.equal(facts[0].action, "Requested the Scene");
  assert.equal(facts[0].actor, "Nadia Cole");
});

test("a Scene request needs a name and the request, and never requires references", async () => {
  const { asClient } = await ready();
  const { assignment } = await tourAction({ action: "create-scene-request", tourId: TOUR, title: "First light", request: "A quiet field of light behind the first verse." }, asClient);
  assert.equal(assignment.title, "First light");
  assert.deepEqual(assignment.references, []);
  await assert.rejects(
    () => tourAction({ action: "create-scene-request", tourId: TOUR, title: "First light", request: "" }, asClient),
    /Write the Scene request/,
  );
  await assert.rejects(
    () => tourAction({ action: "create-scene-request", tourId: TOUR, request: "A quiet field of light." }, asClient),
    /Name the Scene/,
  );
});

test("the client Scene workspace keeps Artist Brain evidence on the Higher Roads side", async () => {
  const { options, asClient } = await ready();
  const before = await tourAction({ action: "get-scene-workspace", tourId: TOUR, assignmentId: "storm-and-lightning" }, asClient);
  assert.equal(before.concept, null);
  assert.equal(Object.prototype.hasOwnProperty.call(before.context, "findings"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(before.context, "avoids"), false);

  await tourAction({
    action: "save-scene-direction",
    tourId: TOUR,
    assignmentId: "storm-and-lightning",
    concept: { title: "Weather held back", idea: "Keep the sky quiet until the final line.", directionParagraphs: [0] },
  }, asClient);
  const after = await tourAction({ action: "get-scene-workspace", tourId: TOUR, assignmentId: "storm-and-lightning" }, options);
  assert.equal(after.concept.title, "Weather held back");
  assert.equal(Object.prototype.hasOwnProperty.call(after.concept, "artistContext"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(after.concept, "avoid"), false);
});

test("client Home activity keeps internal review on the Higher Roads side", async () => {
  const { options, asClient } = await ready();
  for (const action of ["Requested the Scene", "Wrote the review", "Requested internal changes", "Approved for the client to see"]) {
    await options.sceneRecord.appendFact(TOUR, "storm-and-lightning", {
      actor: "Ray Mercer",
      role: "Higher Roads",
      action,
      version: "Artboard V01",
    });
  }

  const internal = await tourAction({ action: "get-scene-activity", tourId: TOUR, assignmentId: "storm-and-lightning" }, options);
  assert.deepEqual(internal.facts.map((fact) => fact.action), ["Requested the Scene", "Wrote the review", "Requested internal changes", "Approved for the client to see"]);

  const client = await tourAction({ action: "get-scene-activity", tourId: TOUR, assignmentId: "storm-and-lightning" }, asClient);
  assert.deepEqual(client.facts.map((fact) => fact.action), ["Requested the Scene", "Approved for the client to see"]);
});
