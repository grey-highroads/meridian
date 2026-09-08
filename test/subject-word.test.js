import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";
import { subjectWord } from "../src/label.js";
import { subjectWord as browserSubjectWord } from "../app/label.js";

// What a reader calls the thing a project is about. The stored word wins, then
// the kind, then Artist. get-tour hands the page one subject, and a client
// session is handed none.

const DEMO_ACCOUNT = "dierks-bentley";
const TOUR = "off-the-map-2026";
const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const CLIENT = { id: "client", login: "dana", displayName: "Dana Reyes", role: "client-reviewer", roleLabel: "Client" };

function directory(rows) {
  return { async findArtist(id) { return rows.find((entry) => entry.id === id) || null; } };
}

async function ready(rows = []) {
  const backend = createMemoryBackend();
  const tourStore = createTourStore({ backend, accountId: DEMO_ACCOUNT });
  const sceneRecord = createSceneRecord({ backend, accountId: DEMO_ACCOUNT });
  const artboardStore = createArtboardStore({ backend, accountId: DEMO_ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  return { tourStore, options: { tourStore, sceneRecord, artboardStore, artists: directory(rows), user: OPERATOR } };
}

test("the word is the stored label, then the kind, then Artist", () => {
  for (const resolve of [subjectWord, browserSubjectWord]) {
    assert.equal(resolve({ label: "Composer", kind: "artist" }), "Composer", "a stored label lost to the kind");
    assert.equal(resolve({ label: "", kind: "venue" }), "venue", "a venue with no label did not read venue");
    assert.equal(resolve({ kind: "organization" }), "organization", "an organization did not read its kind");
    assert.equal(resolve({ kind: "artist" }), "artist", "an artist did not read its kind");
    assert.equal(resolve({}), "Artist", "a record with nothing stored did not fall back to Artist");
    assert.equal(resolve(null), "Artist", "no record at all did not fall back to Artist");
    assert.equal(resolve({ kind: "trebuchet" }), "Artist", "a kind nothing recognizes did not fall back to Artist");
  }
});

// A project whose only subject is a venue. The stored artistId always leads the
// derived order, so a venue-led project is one that never had an artistId.
async function venueProject(tourStore, options, rows) {
  const seeded = await tourStore.readTour(TOUR);
  const document = { ...seeded, tour: { ...seeded.tour, id: "tent-mapping", artistId: null, subjectIds: ["the-ryman"] } };
  await tourStore.createTour("tent-mapping", document);
  return tourAction({ action: "get-tour", tourId: "tent-mapping" }, options);
}

test("get-tour hands a Higher Roads session the first subject with its word", async () => {
  const rows = [{ id: "the-ryman", name: "Ryman Auditorium", label: null, kind: "venue" }];
  const { tourStore, options } = await ready(rows);
  const { subject } = await venueProject(tourStore, options, rows);
  assert.equal(subject.id, "the-ryman", "get-tour did not hand back the subject");
  assert.equal(subject.kind, "venue", "the subject came back without its kind");
  assert.equal(subjectWord(subject), "venue", "the word for a venue subject did not read venue");
});

test("the first subject in the order get-tour derives is the one that travels", async () => {
  const rows = [
    { id: "dierks-bentley", name: "Dierks Bentley", label: null, kind: "artist" },
    { id: "the-ryman", name: "Ryman Auditorium", label: null, kind: "venue" },
  ];
  const { tourStore, options } = await ready(rows);
  await tourStore.setSubjects(TOUR, ["the-ryman"]);
  const { tour, subject } = await tourAction({ action: "get-tour", tourId: TOUR }, options);
  assert.equal(tour.subjectIds[0], "dierks-bentley", "the derived order changed under this test");
  assert.equal(subject.id, "dierks-bentley", "the subject block did not follow the derived order");
});

test("a stored label beats the kind on the way to the page", async () => {
  const rows = [{ id: "the-ryman", name: "Ryman Auditorium", label: "Room", kind: "venue" }];
  const { tourStore, options } = await ready(rows);
  const { subject } = await venueProject(tourStore, options, rows);
  assert.equal(subject.label, "Room", "the stored label did not reach the page");
  assert.equal(subjectWord(subject), "Room", "the kind won over a stored label");
});

test("a project with no subject gets no subject block", async () => {
  const { tourStore, options } = await ready([]);
  const seeded = await tourStore.readTour(TOUR);
  await tourStore.createTour("tent-mapping", { ...seeded, tour: { ...seeded.tour, id: "tent-mapping", artistId: null, subjectIds: [] } });
  const { tour, subject } = await tourAction({ action: "get-tour", tourId: "tent-mapping" }, options);
  assert.deepEqual(tour.subjectIds, [], "the project under test still holds a subject");
  assert.equal(subject, null, "a project with no subject came back with one");
});

test("a client session is handed no subject block at all", async () => {
  const rows = [{ id: "dierks-bentley", name: "Dierks Bentley", label: null, kind: "artist" }];
  const { tourStore, options } = await ready(rows);
  await tourStore.setSubjects(TOUR, ["dierks-bentley"]);
  const asClient = { ...options, user: CLIENT };
  const reply = await tourAction({ action: "get-tour", tourId: TOUR }, asClient);
  assert.ok(reply.tour, "the client got no project back");
  assert.equal(Object.prototype.hasOwnProperty.call(reply, "subject"), false, "a client session was handed a subject block");
});
