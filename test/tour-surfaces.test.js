import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";

// The things in the room the media plays on. Every check reads the list back
// through get-tour, which is what a page and the concept context both see.

const DEMO_ACCOUNT = "dierks-bentley";
const TOUR = "off-the-map-2026";
const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };

async function ready() {
  const backend = createMemoryBackend();
  const tourStore = createTourStore({ backend, accountId: DEMO_ACCOUNT });
  const sceneRecord = createSceneRecord({ backend, accountId: DEMO_ACCOUNT });
  const artboardStore = createArtboardStore({ backend, accountId: DEMO_ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  return { backend, options: { tourStore, sceneRecord, artboardStore, user: OPERATOR } };
}

async function readSurfaces(options) {
  const { tour } = await tourAction({ action: "get-tour", tourId: TOUR }, options);
  return tour.surfaces;
}

test("a project with no surfaces reads an empty list", async () => {
  const { options } = await ready();
  assert.deepEqual(await readSurfaces(options), [], "a project without surfaces reads something other than an empty list");
});

test("adding two surfaces stores both in the order they were given", async () => {
  const { options } = await ready();
  await tourAction({
    action: "save-tour-surfaces",
    tourId: TOUR,
    surfaces: [
      { name: "Side tent walls", description: "Both long walls of the tent, left and right of the stage." },
      { name: "Ceiling above the stage", description: "The canvas directly over the band." },
    ],
  }, options);
  const surfaces = await readSurfaces(options);
  assert.deepEqual(surfaces.map((entry) => entry.name), ["Side tent walls", "Ceiling above the stage"], "the surfaces did not come back in the order they were given");
  assert.equal(surfaces[1].description, "The canvas directly over the band.", "the second surface lost its description");
});

test("editing one surface leaves the other exactly as it was", async () => {
  const { options } = await ready();
  const first = [
    { name: "Side tent walls", description: "Both long walls of the tent." },
    { name: "Ceiling above the stage", description: "The canvas directly over the band." },
  ];
  await tourAction({ action: "save-tour-surfaces", tourId: TOUR, surfaces: first }, options);
  await tourAction({
    action: "save-tour-surfaces",
    tourId: TOUR,
    surfaces: [first[0], { name: "Ceiling above the stage", description: "The canvas over the band, upstage of the truss." }],
  }, options);
  const surfaces = await readSurfaces(options);
  assert.equal(surfaces.length, 2, "the edit changed how many surfaces the project holds");
  assert.deepEqual(surfaces[0], first[0], "editing the second surface changed the first");
  assert.equal(surfaces[1].description, "The canvas over the band, upstage of the truss.", "the edited surface kept its old description");
});

test("a project written before the field parses unchanged", async () => {
  const { backend, options } = await ready();
  const path = `brand-world-system/clients/${DEMO_ACCOUNT}/tours/${TOUR}/tour.json`;
  const stored = JSON.parse(await backend.read(path));
  assert.equal(stored.tour.surfaces, undefined, "the seeded project already carries a surfaces field, so this proves nothing");
  const { tour } = await tourAction({ action: "get-tour", tourId: TOUR }, options);
  assert.equal(tour.name, stored.tour.name, "the project stopped reading its own name");
  assert.equal(tour.productionSetup.words, stored.tour.productionSetup.words, "the production setup did not survive the read");
  assert.deepEqual(tour.surfaces, [], "a project from before the field reads something other than an empty list");
});
