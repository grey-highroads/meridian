import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";

// Sarah's first fifteen minutes. She creates the tour, records what she knows,
// and requests a Scene without any of it being filled in. Every check asserts
// what is stored and what a person would read, not that a call returned.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_ACCOUNT = "dierks-bentley";
const CLIENT = { id: "client", displayName: "Sarah Vance", role: "client-reviewer", roleLabel: "Artist management" };

function read(name) {
  return fs.readFileSync(path.join(rootPath, name), "utf8");
}

function ready() {
  const backend = createMemoryBackend();
  const tourStore = createTourStore({ backend, accountId: DEMO_ACCOUNT });
  const artboardStore = createArtboardStore({ backend, accountId: DEMO_ACCOUNT });
  const sceneRecord = createSceneRecord({ backend, accountId: DEMO_ACCOUNT });
  return { options: { tourStore, artboardStore, sceneRecord, user: CLIENT }, tourStore };
}

async function startedTour(options) {
  await tourAction({ action: "create-tour", name: "Highway Nights 2027", artistId: "dierks-bentley" }, options);
  return "highway-nights-2027";
}

test("a tour starts with nothing in it and a Scene can still be requested", async () => {
  const { options } = ready();
  const tourId = await startedTour(options);
  const opened = await tourAction({ action: "get-tour", tourId }, options);
  assert.equal(opened.tour.direction.words, "");
  assert.deepEqual(opened.tour.dates, []);
  assert.equal(opened.tour.productionSetup, null);
  assert.deepEqual(opened.assignments, []);

  const { assignment } = await tourAction({
    action: "create-scene-request",
    tourId,
    title: "Opening walk-on",
    request: "The room should feel like it is waiting for him.",
  }, options);
  assert.equal(assignment.title, "Opening walk-on");
  assert.equal(assignment.requestedBy, "Sarah Vance");
  const after = await tourAction({ action: "get-tour", tourId }, options);
  assert.equal(after.assignments.length, 1);
});

test("dates written through Tour details read back on the tour and record who wrote them", async () => {
  const { options, tourStore } = ready();
  const tourId = await startedTour(options);
  await tourAction({
    action: "save-tour-dates",
    tourId,
    dates: [
      { date: "2027-05-04", venue: "Riverbend", place: "Cincinnati" },
      { date: "2027-05-06", venue: "Ruoff", place: "Noblesville" },
      { date: "", venue: "", place: "" },
    ],
  }, options);

  const { tour } = await tourAction({ action: "get-tour", tourId }, options);
  assert.equal(tour.dates.length, 2, "the empty row was stored");
  assert.equal(tour.dates[0].venue, "Riverbend");
  assert.equal(tour.dates[1].place, "Noblesville");

  const stored = await tourStore.readDateVersions(tourId);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].version, 1);
  assert.equal(stored[0].setBy, "Sarah Vance");
  assert.ok(stored[0].setOn);

  const facts = await tourStore.readTourFacts(tourId);
  assert.equal(facts.at(-1).action, "Recorded 2 tour dates");
  assert.equal(facts.at(-1).actor, "Sarah Vance");
});

test("a later route is a new version and the earlier one stays stored", async () => {
  const { options, tourStore } = ready();
  const tourId = await startedTour(options);
  await tourAction({ action: "save-tour-dates", tourId, dates: [{ date: "2027-05-04", venue: "Riverbend", place: "Cincinnati" }] }, options);
  await tourAction({ action: "save-tour-dates", tourId, dates: [{ date: "2027-05-04", venue: "Riverbend", place: "Cincinnati" }, { date: "2027-05-09", venue: "Hollywood Casino", place: "Maryland Heights" }] }, options);

  const versions = await tourStore.readDateVersions(tourId);
  assert.equal(versions.length, 2);
  assert.equal(versions[0].dates.length, 1);
  const { tour } = await tourAction({ action: "get-tour", tourId }, options);
  assert.equal(tour.dates.length, 2);
});

test("a route with nothing in it is refused and writes nothing", async () => {
  const { options, tourStore } = ready();
  const tourId = await startedTour(options);
  await assert.rejects(
    () => tourAction({ action: "save-tour-dates", tourId, dates: [{ date: "", venue: "", place: "" }] }, options),
    (error) => error.status === 400 && /at least one date/.test(error.message),
  );
  assert.deepEqual(await tourStore.readDateVersions(tourId), []);
});

test("production setup written through Tour details reads back with its version", async () => {
  const { options, tourStore } = ready();
  const tourId = await startedTour(options);
  const words = "One wall upstage behind the band. Two side screens flank the stage.";
  await tourAction({ action: "save-production-setup", tourId, words, suppliedBy: "Marcus Vail" }, options);

  const { tour } = await tourAction({ action: "get-tour", tourId }, options);
  assert.equal(tour.productionSetup.version, 1);
  assert.equal(tour.productionSetup.words, words);
  assert.equal(tour.productionSetup.suppliedBy, "Marcus Vail");
  assert.deepEqual(tour.productionSetup.venueExceptions, []);

  const facts = await tourStore.readTourFacts(tourId);
  assert.equal(facts.at(-1).action, "Recorded the production setup");
  assert.equal(facts.at(-1).version, "Setup V01");
});

test("editing the seeded tour's setup makes a second version and keeps the dates where the rig differs", async () => {
  const { options, tourStore } = ready();
  await seedTourFromFixture(tourStore, "off-the-map-2026");
  const before = await tourAction({ action: "get-tour", tourId: "off-the-map-2026" }, options);
  assert.equal(before.tour.productionSetup.version, 1);
  assert.ok(before.tour.productionSetup.venueExceptions.length > 0);

  await tourAction({ action: "save-production-setup", tourId: "off-the-map-2026", words: "The wall is now three panels with a gap the band walks through." }, options);
  const after = await tourAction({ action: "get-tour", tourId: "off-the-map-2026" }, options);
  assert.equal(after.tour.productionSetup.version, 2);
  assert.match(after.tour.productionSetup.words, /three panels/);
  assert.deepEqual(after.tour.productionSetup.venueExceptions, before.tour.productionSetup.venueExceptions);
  assert.equal(after.tour.direction.version, before.tour.direction.version, "editing the setup moved the direction");
});

test("setup with no words is refused, and the same words twice are refused", async () => {
  const { options } = ready();
  const tourId = await startedTour(options);
  await assert.rejects(
    () => tourAction({ action: "save-production-setup", tourId, words: "   " }, options),
    (error) => error.status === 400,
  );
  await tourAction({ action: "save-production-setup", tourId, words: "One wall upstage." }, options);
  await assert.rejects(
    () => tourAction({ action: "save-production-setup", tourId, words: "One wall upstage." }, options),
    (error) => error.status === 409,
  );
});

test("saving the route leaves the tour's direction and Scenes alone", async () => {
  const { options: live, tourStore } = ready();
  await seedTourFromFixture(tourStore, "off-the-map-2026");
  const before = await tourAction({ action: "get-tour", tourId: "off-the-map-2026" }, live);
  await tourAction({ action: "save-tour-dates", tourId: "off-the-map-2026", dates: [{ date: "2026-06-01", venue: "Somewhere", place: "Anywhere" }] }, live);
  const after = await tourAction({ action: "get-tour", tourId: "off-the-map-2026" }, live);
  assert.equal(after.tour.direction.words, before.tour.direction.words);
  assert.equal(after.assignments.length, before.assignments.length);
  assert.equal(after.tour.dates.length, 1);
});

test("Home has three shapes and the third one is untouched", () => {
  const home = read("app/home.js");
  assert.match(home, /new-tour\.html/, "Home with no tour does not offer to start one");
  assert.doesNotMatch(home, /no-tour\.js/, "Home still shows the shared block instead of its own shape");

  for (const line of ["No creative direction yet", "No dates yet", "No production details yet", "No Scenes yet"]) {
    assert.match(home, new RegExp(line), `the setup lines are missing "${line}"`);
  }
  assert.match(home, /A good next step/, "no line is marked as the most useful next thing");
  assert.doesNotMatch(home, /direction\.html/, "the direction line drills into the editor instead of Tour details");
  assert.match(home, /tour\.html\?tour=\$\{encodeURIComponent\(TOUR_ID\)\}#direction-heading/, "the direction line does not open where the direction sits");
  assert.match(home, /lines\.find\(\(line\) => !line\.filled\)/, "the suggestion is not the first unfilled line");

  for (const kept of ["You are clear for now", "Give the tour its first Scene", "Welcome,", "m-home__layout"]) {
    assert.match(home, new RegExp(kept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `the operational Home lost "${kept}"`);
  }
});

test("starting the tour is a client job on its own page and no longer an Admin act", () => {
  const page = read("app/new-tour.js");
  assert.match(page, /action: "create-tour"/, "the tour page does not create the tour");
  assert.match(page, /Add what you know now, the rest can wait/, "the tour page does not say the rest can wait");
  assert.match(page, /view\.primaryContact = me\.user\.displayName/, "the signed-in person is not filled in as the contact");
  assert.match(page, /view\.artists\.length === 1/, "the artist is a picker when the account holds one");
  assert.match(page, /view\.message = error\.message;\s*\n\s*render\(\);/, "a refused create loses what was typed");

  const admin = read("app/admin.js");
  assert.doesNotMatch(admin, /create-tour/, "Admin still creates tours");
  assert.doesNotMatch(admin, /Create a tour/, "Admin still offers to create a tour");
});

test("Tour details can write the dates and the setup, each without the other", () => {
  const source = read("app/tour.js");
  assert.match(source, /action: "save-tour-dates"|"save-tour-dates"/, "the dates cannot be saved");
  assert.match(source, /"save-production-setup"/, "the production setup cannot be saved");
  assert.match(source, /data-edit-dates/, "there is no way into the dates");
  assert.match(source, /data-edit-setup/, "there is no way into the production setup");
  assert.match(source, /view\.editing === "dates" \? datesEditor\(\) : reading/, "opening the dates hides the rest of the section");
  assert.match(source, /Add another date/, "a second date cannot be added");
  const shell = read("app/no-tour.js");
  assert.doesNotMatch(shell, /Admin page/, "the shared empty state still sends people to Admin");
});
