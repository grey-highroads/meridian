import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore, tourPathFor } from "../src/tour/store.js";
import { findingSentence, jobIdFor, renderBriefDocument } from "../src/tour/brief.js";

const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };

const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
  whyThisArtist: "He plays outdoors and the team already builds around real sky.",
  asksOfProduction: "One long build cue and a single break.",
  whereItMightMiss: "A break that lands too hard reads as spectacle.",
  rhymesWith: ["finding-19"],
  avoid: ["Anything that reads as arena rock."],
  creativeLatitude: ["How the front is rendered is open."],
  cameFrom: "proposal: The front, not the flash",
};

async function ready() {
  const artistBackend = createMemoryBackend();
  const tourBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend });
  const tourStore = createTourStore({ backend: tourBackend });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  return { artistBackend, tourBackend, options: { store, tourStore } };
}

async function withConcept(options, extra = {}) {
  const context = await tourAction({ action: "assignment-context", ...AT }, options);
  const artistContext = context.context.findings
    .filter((entry) => entry.findingId === "finding-19")
    .map((entry) => ({ ...entry, why: "The show is built for sheds." }));
  return await tourAction({ action: "choose-concept", ...AT, person: "Grey", concept: { ...CONCEPT, artistContext, ...extra } }, options);
}

test("a concept needs a title and an idea", async () => {
  const { options } = await ready();
  await assert.rejects(
    () => tourAction({ action: "choose-concept", ...AT, concept: { title: "Only a title" } }, options),
    /A concept needs a title and an idea/,
  );
});

test("a chosen concept records who shaped it and what it came from", async () => {
  const { options } = await ready();
  const { concept } = await withConcept(options);
  assert.equal(concept.shapedBy, "Grey");
  assert.ok(concept.shapedAt);
  // Intent, interpretation, and decision stay separate: what the brain proposed
  // is kept next to what the person made of it.
  assert.equal(concept.cameFrom, "proposal: The front, not the flash");
  const read = await tourAction({ action: "get-concept", ...AT }, options);
  assert.deepEqual(read.concept, concept);
});

test("a brief cannot be compiled before a concept is chosen", async () => {
  const { options } = await ready();
  await assert.rejects(
    () => tourAction({ action: "compile-brief", ...AT }, options),
    /Choose or write a concept before compiling a brief/,
  );
});

test("compiling a draft stores nothing", async () => {
  const { tourBackend, options } = await ready();
  await withConcept(options);
  const before = new Map(tourBackend.files);
  const draft = await tourAction({ action: "compile-brief", ...AT }, options);
  assert.equal(draft.brief.status, "draft");
  assert.equal(draft.brief.briefVersion, 1);
  assert.deepEqual([...tourBackend.files.keys()].sort(), [...before.keys()].sort());
  for (const [pathname, body] of tourBackend.files) assert.equal(body, before.get(pathname), `${pathname} changed`);
});

test("the brief names its job, its version, and the direction version it was written against", async () => {
  const { options } = await ready();
  await withConcept(options);
  const { brief } = await tourAction({ action: "compile-brief", ...AT }, options);
  assert.equal(brief.jobId, jobIdFor(TOUR, ASSIGNMENT));
  assert.equal(brief.briefVersion, 1);
  assert.equal(brief.directionVersion, 1);
  assert.equal(brief.tourDirection.version, brief.directionVersion);
  assert.equal(brief.artistId, "dierks-bentley");
});

test("required elements and the technical target lead, meaning trails", async () => {
  const { options } = await ready();
  await withConcept(options);
  const { document } = await tourAction({ action: "compile-brief", ...AT }, options);
  const at = (heading) => document.indexOf(heading);
  assert.ok(at("## Required") > -1);
  assert.ok(at("## Required") < at("## Technical target"));
  assert.ok(at("## Technical target") < at("## The concept"));
  assert.ok(at("## The concept") < at("## The artist behind this"));
  assert.ok(at("## The artist behind this") < at("## The tour's direction, as the director gave it"));
  assert.ok(at("## The tour's direction, as the director gave it") < at("## Latitude"));
});

test("the brief carries the required elements and the playback system as written", async () => {
  const { options } = await ready();
  await withConcept(options);
  const { brief, document } = await tourAction({ action: "compile-brief", ...AT }, options);
  assert.equal(brief.requiredElements.length, 5);
  assert.ok(brief.requiredElements.some((line) => line.includes("acoustic circle")));
  assert.ok(brief.technicalTarget.playbackSystem.includes("disguise"));
  assert.equal(brief.technicalTarget.venueProfile, null);
  for (const element of brief.requiredElements) assert.ok(document.includes(element), "every required element reaches the document");
  assert.ok(document.includes(brief.technicalTarget.playbackSystem));
});

test("the director's words and the manager's words reach the brief as given", async () => {
  const { options } = await ready();
  await withConcept(options);
  const { brief, document } = await tourAction({ action: "compile-brief", ...AT }, options);
  const { tour, assignment } = await tourAction({ action: "get-assignment", ...AT }, options);
  assert.equal(brief.tourDirection.words, tour.direction.words);
  assert.equal(brief.assignment.request, assignment.request);
  assert.ok(document.includes(tour.direction.words));
  assert.ok(document.includes(assignment.request));
});

test("every artist claim in the brief carries what it rests on", async () => {
  const { options } = await ready();
  await withConcept(options);
  const { brief, document } = await tourAction({ action: "compile-brief", ...AT }, options);
  assert.ok(brief.artistContext.length > 0);
  for (const entry of brief.artistContext) {
    assert.ok(entry.findingId);
    assert.equal(typeof entry.independentSourceCount, "number");
    assert.ok(entry.tiers.length > 0);
  }
  assert.ok(/\d+ independent sources?, tier/.test(document));
});

test("the brief carries no architecture words out to Jim", async () => {
  const { options } = await ready();
  await withConcept(options);
  const { document } = await tourAction({ action: "compile-brief", ...AT }, options);
  for (const word of ["bin", "facet", "governance", "candidate", "proposed", "finding-"]) {
    assert.ok(!new RegExp(`\\b${word}`, "i").test(document), `the document says "${word}"`);
  }
  assert.ok(!document.includes("\u2014"), "no em dashes reach Jim");
});

test("the intake bookkeeping tail is stripped from a finding before it reaches Jim", () => {
  assert.equal(
    findingSentence("**The show reaches into the room.** A thrust and a B stage. 4 sources, tiers 3, 4. New."),
    "The show reaches into the room. A thrust and a B stage.",
  );
  assert.equal(findingSentence("No tail here."), "No tail here.");
});

test("freezing stores the version, and a frozen version is never rewritten", async () => {
  const { tourBackend, options } = await ready();
  await withConcept(options);
  const frozen = await tourAction({ action: "freeze-brief", ...AT, person: "Grey" }, options);
  assert.equal(frozen.brief.status, "frozen");
  assert.equal(frozen.brief.frozenBy, "Grey");
  assert.ok(frozen.brief.frozenAt);

  const stored = new Map(tourBackend.files);
  const briefsPath = tourPathFor(TOUR, ASSIGNMENT, "briefs");
  assert.ok(stored.has(briefsPath));

  // Changing the concept after a freeze is refused rather than silently
  // rewriting what someone was handed.
  await assert.rejects(
    () => withConcept(options, { title: "A different idea" }),
    /A brief is already frozen for this assignment/,
  );
  assert.equal(tourBackend.files.get(briefsPath), stored.get(briefsPath));

  const again = await tourAction({ action: "get-brief", ...AT, briefVersion: 1 }, options);
  assert.deepEqual(again.brief, frozen.brief);
});

test("the next brief after a freeze is a new version, not an edit", async () => {
  const { options } = await ready();
  await withConcept(options);
  await tourAction({ action: "freeze-brief", ...AT, person: "Grey" }, options);
  const next = await tourAction({ action: "compile-brief", ...AT }, options);
  assert.equal(next.brief.briefVersion, 2);
  assert.equal(next.brief.status, "draft");

  const second = await tourAction({ action: "freeze-brief", ...AT, person: "Grey" }, options);
  assert.equal(second.brief.briefVersion, 2);
  const list = await tourAction({ action: "list-briefs", ...AT }, options);
  assert.deepEqual(list.briefs.map((entry) => entry.briefVersion), [1, 2]);
  assert.ok(list.briefs.every((entry) => entry.status === "frozen"));
  assert.ok(list.briefs.every((entry) => entry.jobId === jobIdFor(TOUR, ASSIGNMENT)));
});

test("both artifact forms carry the same content, the same version, and the same freeze", async () => {
  const { options } = await ready();
  await withConcept(options);
  const frozen = await tourAction({ action: "freeze-brief", ...AT, person: "Grey" }, options);
  assert.equal(frozen.sidecar.briefVersion, frozen.brief.briefVersion);
  assert.equal(frozen.sidecar.jobId, frozen.brief.jobId);
  assert.equal(frozen.sidecar.status, "frozen");
  assert.equal(frozen.sidecar.frozenAt, frozen.brief.frozenAt);
  assert.equal(frozen.document, renderBriefDocument(frozen.brief));
  assert.ok(frozen.document.includes(`Brief version: ${frozen.brief.briefVersion}`));
  // The sidecar shape is Higher Roads' guess and says so in itself.
  assert.equal(frozen.sidecar.contract, "meridian.brief");
  assert.match(frozen.sidecar.contractStatus, /provisional/);
});

test("a brief version that does not exist fails plainly", async () => {
  const { options } = await ready();
  await withConcept(options);
  await assert.rejects(
    () => tourAction({ action: "get-brief", ...AT, briefVersion: 9 }, options),
    /That brief version was not found/,
  );
});

test("nothing in the brief path writes to the artist layer", async () => {
  const { artistBackend, options } = await ready();
  const before = new Map(artistBackend.files);
  await withConcept(options);
  await tourAction({ action: "compile-brief", ...AT }, options);
  await tourAction({ action: "freeze-brief", ...AT, person: "Grey" }, options);
  assert.deepEqual([...artistBackend.files.keys()].sort(), [...before.keys()].sort());
  for (const [pathname, body] of artistBackend.files) assert.equal(body, before.get(pathname), `${pathname} changed`);
});
