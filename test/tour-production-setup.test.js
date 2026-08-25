import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { buildProposalRequest } from "../src/tour/propose.js";

// What the show plays on, carried from the tour file through the prompt and
// into the brief. Every check here asserts the effect: the text a person or
// Jim's side would actually read, not that a field is present.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };

const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };

const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
};

async function ready() {
  const artistBackend = createMemoryBackend();
  const tourBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend });
  const tourStore = createTourStore({ backend: tourBackend });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  const sceneRecord = createSceneRecord({ backend: tourBackend });
  const artboardStore = createArtboardStore({ backend: tourBackend });
  return { options: { store, tourStore, artboardStore, sceneRecord, user: OPERATOR } };
}

test("the tour carries its production setup with a version and who supplied it", async () => {
  const { options } = await ready();
  const { tour } = await tourAction({ action: "get-tour", ...AT }, options);
  const setup = tour.productionSetup;
  assert.equal(setup.version, 1);
  // The four rooms with no sky are the ones the request already named, and
  // every exception points at a date the tour actually plays.
  const routed = new Set(tour.dates.map((entry) => entry.venue));
  assert.ok(setup.venueExceptions.every((entry) => routed.has(entry.venue)), "every exception names a routed venue");
  assert.equal(setup.suppliedBy, "Marcus Vail, Production Designer");
  assert.ok(setup.suppliedOn);
  // The rig reads as production wrote it.
  assert.match(setup.words, /One main wall upstage behind the band/);
  assert.match(setup.words, /Two side screens flank the stage/);
  // The playback line moved into the setup and is still read off the tour.
  assert.match(tour.playbackSystem, /disguise/);
  assert.equal(setup.venueExceptions.length, 4);
  for (const entry of setup.venueExceptions) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.venue);
    assert.ok(entry.text);
  }
});

test("the surfaces and the wording that ties a concept to them sit ahead of the findings", async () => {
  const { options } = await ready();
  const { context } = await tourAction({ action: "assignment-context", ...AT }, options);
  const request = buildProposalRequest(context);
  const prompt = request.messages.map((entry) => entry.content).join("\n");

  const binding = "A concept describes what appears on the tour's surfaces and how it develops across the song.";
  assert.ok(prompt.includes(binding), "the prompt binds a concept to the surfaces");
  assert.ok(prompt.includes("Write concepts a video content team could brief from."));
  assert.ok(prompt.includes("Never describe an effect the listed surfaces cannot produce."));
  assert.ok(prompt.includes("One main wall upstage behind the band"), "the surfaces reach the prompt");
  assert.ok(prompt.includes("Two side screens flank the stage"));
  assert.ok(prompt.includes("Northgate Arena"), "the dates that differ reach the prompt");

  const findings = prompt.indexOf("Every finding the brain holds");
  assert.ok(findings > -1);
  assert.ok(prompt.indexOf(binding) < findings, "the wording leads the findings");
  assert.ok(prompt.indexOf("One main wall upstage behind the band") < findings, "the surfaces lead the findings");
});

test("a brief carries the setup version, the rig, and only the dates that were marked", async () => {
  const { options } = await ready();
  const { context } = await tourAction({ action: "assignment-context", ...AT }, options);
  const all = context.venueExceptions;
  assert.equal(all.length, 4);

  await tourAction({ action: "choose-concept", ...AT, concept: { ...CONCEPT, venueExceptions: [1] } }, options);
  const { brief, document } = await tourAction({ action: "compile-brief", ...AT }, options);

  assert.equal(brief.technicalTarget.setupVersion, 1);
  assert.equal(brief.directionVersion, 1);
  assert.ok(document.includes("Production setup version: 1"), "the setup version sits beside the direction version");
  assert.ok(document.includes("Written against direction version: 1"));

  // The standard rig always travels.
  assert.ok(document.includes("One main wall upstage behind the band"), "the rig reaches the document");
  assert.ok(document.includes(brief.technicalTarget.playbackSystem));

  // The marked date travels by its text and the rest stay in Meridian.
  assert.deepEqual(brief.technicalTarget.venueExceptions, [all[1]]);
  assert.ok(document.includes(all[1].text), "the marked date reaches the document");
  for (const index of [0, 2, 3]) {
    assert.ok(!document.includes(all[index].text), `date ${index} was not marked and stays here`);
  }
});

test("a Scene saved before the setup existed compiles against version 1 with nothing marked", async () => {
  const { options } = await ready();
  // A concept with no venueExceptions field is what an older save looks like.
  const { concept } = await tourAction({ action: "choose-concept", ...AT, concept: CONCEPT }, options);
  assert.deepEqual(concept.venueExceptions, []);
  const { brief, document } = await tourAction({ action: "compile-brief", ...AT }, options);
  assert.equal(brief.technicalTarget.setupVersion, 1);
  assert.deepEqual(brief.technicalTarget.venueExceptions, []);
  assert.ok(document.includes("No date on this tour was marked as differing from the rig above."));
  assert.ok(document.includes("One main wall upstage behind the band"));
});

test("a frozen brief reads back unchanged after the setup is in play", async () => {
  const { options } = await ready();
  await tourAction({ action: "choose-concept", ...AT, concept: { ...CONCEPT, venueExceptions: [0] } }, options);
  const frozen = await tourAction({ action: "freeze-brief", ...AT }, options);
  const again = await tourAction({ action: "get-brief", ...AT, briefVersion: 1 }, options);
  assert.deepEqual(again.brief, frozen.brief);
  assert.equal(again.document, frozen.document);
  assert.equal(again.brief.technicalTarget.setupVersion, 1);
});

test("a tour with no production setup still compiles a brief", async () => {
  const { options } = await ready();
  const TOUR_FILE = `# Knights Run\n\nArtist: dierks-bentley\nTour id: hck-run-2026\nPlayback system: One machine, one spare.\n\n## Direction, version 1\n\nSet by: Nadia Rourke, Creative Director\nSet on: 2026-02-02\n\nPlay it straight and never wink at the audience.\n`;
  const ASSIGNMENT_FILE = `# The entrance\n\nAssignment id: entrance\nTour id: hck-run-2026\nIdentity: hot-country-knights\nWritten against direction version: 1\n\n## What we are asking for\n\nThey arrive and the room has to believe them.\n`;
  const withOldTour = {
    ...options,
    reader: async (pathname) => (String(pathname).endsWith("tour.md") ? TOUR_FILE : ASSIGNMENT_FILE),
    lister: async () => ["entrance.md"],
  };
  const at = { tourId: "hck-run-2026", assignmentId: "entrance" };
  const { tour } = await tourAction({ action: "get-tour", ...at }, withOldTour);
  assert.equal(tour.productionSetup, null);
  await tourAction({ action: "choose-concept", ...at, concept: CONCEPT }, withOldTour);
  const { brief, document } = await tourAction({ action: "compile-brief", ...at }, withOldTour);
  assert.equal(brief.technicalTarget.setupVersion, null);
  assert.ok(!document.includes("Production setup version:"));
  assert.ok(document.includes("One machine, one spare."));
});

test("the tour home shows the setup and says nothing in system vocabulary", () => {
  const script = fs.readFileSync(path.join(rootPath, "app/tour.js"), "utf8");
  const markup = fs.readFileSync(path.join(rootPath, "app/tour.html"), "utf8");
  assert.ok(script.includes("Production setup"), "the section is on the page");
  assert.ok(script.includes("Supplied by"));
  assert.ok(script.includes("Dates where the rig differs"));
  const sheets = markup.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || [];
  assert.equal(sheets.length, 1);
  assert.match(sheets[0], /\.\/design\/index\.css/);
  const copy = (script.match(/`[^`]*`|"[^"\n]*"/g) || [])
    .map((literal) => literal.replace(/\$\{[^{}]*\}/g, " ").replace(/<[^>]*>/g, " "))
    .join(" | ");
  for (const word of ["bin", "facet", "governance", "candidate", "proposed", "finding-"]) {
    assert.ok(!new RegExp(`\\b${word}`, "i").test(copy), `the tour home says "${word}"`);
  }
  assert.ok(!copy.includes("\u2014"), "the tour home carries an em dash");
});
