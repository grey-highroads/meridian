import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as tourAction } from "../api/tour/index.js";
import { readTourFixture } from "../src/tour/read-fixture.js";
import { createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";

const DEMO_ACCOUNT = "dierks-bentley";

const OPERATOR = { id: "operator", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };

function ready() {
  const tourBackend = createMemoryBackend();
  const tourStore = createTourStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  const artboardStore = createArtboardStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  const sceneRecord = createSceneRecord({ backend: tourBackend, accountId: DEMO_ACCOUNT });
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

// The seeded demo tour is a stored tour like any other, so a second create
// under its name is refused by the store rather than by a guard of its own.
test("creating a tour under a name already stored is refused", async () => {
  const { options, tourStore } = ready();
  await seedTourFromFixture(tourStore, "off-the-map-2026");
  await assert.rejects(
    () => tourAction({ action: "create-tour", name: "Off The Map 2026", artistId: "dierks-bentley" }, options),
    (error) => error.status === 409,
  );
});

test("the seeded demo tour reads back with its direction and its assignments", async () => {
  const { options, tourStore } = ready();
  await seedTourFromFixture(tourStore, "off-the-map-2026");
  const result = await tourAction({ action: "get-tour", tourId: "off-the-map-2026" }, options);
  assert.equal(result.tour.id, "off-the-map-2026");
  assert.equal(result.tour.direction.version, 1);
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0].id, "storm-and-lightning");
  const found = await tourAction(
    { action: "get-assignment", tourId: "off-the-map-2026", assignmentId: "storm-and-lightning" },
    options,
  );
  assert.equal(found.assignment.directionVersion, 1);
  assert.ok(found.tour.direction.words.length > 0);
});

// The committed files under tours/ are a seed and nothing more. An id with
// nothing stored under it is absent for the demo account exactly as it is for
// any other.
test("the demo id with nothing stored is absent, and so is any other unknown id", async () => {
  const { options } = ready();
  for (const tourId of ["off-the-map-2026", "no-such-tour"]) {
    await assert.rejects(
      () => tourAction({ action: "get-tour", tourId }, options),
      (error) => error.status === 404 && error.message === "We couldn't find this tour.",
    );
  }
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
