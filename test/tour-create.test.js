import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as tourAction, readTourFixture } from "../api/tour/index.js";
import { createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";

const OPERATOR = { id: "operator", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };

function ready() {
  const tourBackend = createMemoryBackend();
  const tourStore = createTourStore({ backend: tourBackend });
  const artboardStore = createArtboardStore({ backend: tourBackend });
  const sceneRecord = createSceneRecord({ backend: tourBackend });
  return { options: { tourStore, artboardStore, sceneRecord, user: OPERATOR }, tourBackend, tourStore };
}

test("create-tour then get-tour round-trips with no fixture on disk", async () => {
  const { options } = ready();
  await assert.rejects(() => readTourFixture("highway-nights-2027"), (error) => error.code === "ENOENT");
  const created = await tourAction({ action: "create-tour", name: "Highway Nights 2027", artistId: "dierks-bentley", approximateDates: "May to September 2027", primaryContact: "Someone Real" }, options);
  assert.equal(created.tour.id, "highway-nights-2027");
  const result = await tourAction({ action: "get-tour", tourId: "highway-nights-2027" }, options);
  assert.equal(result.tour.name, "Highway Nights 2027");
  assert.equal(result.tour.direction.version, 0);
  assert.equal(result.tour.direction.words, "");
  assert.deepEqual(result.assignments, []);
  assert.equal(result.tour.approximateDates, "May to September 2027");
  assert.equal(result.tour.primaryContact, "Someone Real");
  assert.equal(result.tour.playbackSystem, null);
});

test("a second create under the same name is refused and writes nothing", async () => {
  const { options, tourBackend } = ready();
  await tourAction({ action: "create-tour", name: "Highway Nights 2027", artistId: "dierks-bentley" }, options);
  const before = JSON.stringify([...tourBackend.files.entries()].sort());
  await assert.rejects(
    () => tourAction({ action: "create-tour", name: "Highway Nights 2027", artistId: "dierks-bentley" }, options),
    (error) => error.status === 409 && /already exists/.test(error.message),
  );
  const after = JSON.stringify([...tourBackend.files.entries()].sort());
  assert.equal(after, before);
});

test("a name that derives to the default namespace is refused", async () => {
  const { options } = ready();
  await assert.rejects(
    () => tourAction({ action: "create-tour", name: "!!!", artistId: "dierks-bentley" }, options),
    (error) => error.status === 400 && /usable tour id/.test(error.message),
  );
});

test("the demo id is refused so a stored document cannot shadow the fixture by accident", async () => {
  const { options } = ready();
  await assert.rejects(
    () => tourAction({ action: "create-tour", name: "Off The Map 2026", artistId: "dierks-bentley" }, options),
    (error) => error.status === 409,
  );
});

test("the demo tour with nothing stored still parses the fixture unchanged", async () => {
  const { options } = ready();
  const result = await tourAction({ action: "get-tour", tourId: "off-the-map-2026" }, options);
  assert.equal(result.tour.id, "off-the-map-2026");
  assert.ok(result.tour.direction.version >= 1);
  assert.ok(result.assignments.length >= 1);
});

test("a stored document wins over the fixture when both exist", async () => {
  const { options, tourStore } = ready();
  const document = { tour: { id: "off-the-map-2026", name: "Stored Wins", artistId: "dierks-bentley", playbackSystem: null, productionSetup: null, dates: [], themes: [], direction: { version: 1, words: "Stored words.", setBy: "Test", setOn: "2026-08-25", role: null } }, assignments: [] };
  await tourStore.createTour("off-the-map-2026", document);
  const result = await tourAction({ action: "get-tour", tourId: "off-the-map-2026" }, options);
  assert.equal(result.tour.name, "Stored Wins");
});

test("an unknown non-demo id returns the existing 404 sentence", async () => {
  const { options } = ready();
  await assert.rejects(
    () => tourAction({ action: "get-tour", tourId: "no-such-tour" }, options),
    (error) => error.status === 404 && error.message === "No tour is stored under that name.",
  );
});

test("creating a tour appends one attributed fact to the tour record", async () => {
  const { options, tourStore } = ready();
  await tourAction({ action: "create-tour", name: "Highway Nights 2027", artistId: "dierks-bentley", onBehalfOf: "Nadia Cole" }, options);
  const facts = await tourStore.readTourFacts("highway-nights-2027");
  assert.equal(facts.length, 1);
  assert.equal(facts[0].action, "Created the tour");
  assert.equal(facts[0].actor, "Ray Mercer");
  assert.equal(facts[0].onBehalfOf, "Nadia Cole");
});
