import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore, tourPathFor } from "../src/tour/store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { carriesOurWords, compileBrief, directionParagraphs, findingSentence, jobIdFor, renderBriefDocument } from "../src/tour/brief.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";

const DEMO_ACCOUNT = "dierks-bentley";


// Two people, the way the account holds them. The actor on every fact comes
// from here and never from a request body.
const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const REVIEWER = { id: "client", login: "dana", displayName: "Dana Whitlock", role: "client-reviewer", roleLabel: "Client reviewer" };

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
  const store = createArtistStore({ backend: artistBackend, accountId: DEMO_ACCOUNT });
  const tourStore = createTourStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  // Freezing writes one fact to the Scene record, so the record shares the
  // tour's backend here and every effect lands in one place the test can read.
  const sceneRecord = createSceneRecord({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  const options = { store, tourStore, sceneRecord, user: OPERATOR };
  return { artistBackend, tourBackend, options, asClient: { ...options, user: REVIEWER } };
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
  // The request body names Grey. The session names the operator, and the
  // session is what reaches storage.
  assert.equal(concept.shapedBy, OPERATOR.displayName);
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
  assert.ok(at("## The artist behind this") < at("## The tour's direction, the parts that bear on this Scene"));
  assert.ok(at("## The tour's direction, the parts that bear on this Scene") < at("## Latitude"));
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

test("the manager's words and the marked direction reach the brief as given", async () => {
  const { options } = await ready();
  await withConcept(options, { directionParagraphs: [1] });
  const { brief, document } = await tourAction({ action: "compile-brief", ...AT }, options);
  const { tour, assignment } = await tourAction({ action: "get-assignment", ...AT }, options);
  const marked = directionParagraphs(tour.direction)[1];
  assert.equal(brief.assignment.request, assignment.request);
  assert.ok(document.includes(assignment.request));
  // The marked paragraph travels word for word. Nothing paraphrases it.
  assert.deepEqual(brief.tourDirection.selectedParagraphs, [marked]);
  assert.ok(document.includes(marked));
});

test("the brief carries the marked paragraphs of the direction and none of the rest", async () => {
  const { options } = await ready();
  await withConcept(options, { directionParagraphs: [1, 4] });
  const { brief, document } = await tourAction({ action: "compile-brief", ...AT }, options);
  const { tour } = await tourAction({ action: "get-assignment", ...AT }, options);
  const all = directionParagraphs(tour.direction);
  assert.ok(all.length > 2, "the sample direction has several paragraphs");

  assert.deepEqual(brief.tourDirection.selectedParagraphs, [all[1], all[4]]);
  assert.equal(brief.tourDirection.version, 1);
  assert.ok(document.includes("Written against direction version: 1"));
  assert.ok(document.includes("Version 1."));
  for (const index of [1, 4]) assert.ok(document.includes(all[index]), `paragraph ${index} reaches the brief`);
  for (const index of [0, 2, 3, 5]) {
    assert.ok(!document.includes(all[index]), `paragraph ${index} was not marked and stays in Meridian`);
  }
  // The whole direction is never carried, in either artifact form.
  assert.equal(brief.tourDirection.words, undefined);
  assert.ok(!document.includes(tour.direction.words));
});

test("a brief with nothing marked carries the direction version and no direction text", async () => {
  const { options } = await ready();
  await withConcept(options);
  const { brief, document } = await tourAction({ action: "compile-brief", ...AT }, options);
  const { tour } = await tourAction({ action: "get-assignment", ...AT }, options);
  assert.deepEqual(brief.tourDirection.selectedParagraphs, []);
  assert.equal(brief.tourDirection.version, 1);
  assert.ok(document.includes("Version 1."));
  for (const paragraph of directionParagraphs(tour.direction)) {
    assert.ok(!document.includes(paragraph), "no part of the direction travels unmarked");
  }
});

test("an index that names no paragraph is dropped rather than guessed at", async () => {
  const { options } = await ready();
  await withConcept(options, { directionParagraphs: [4, 4, 99, -1, "two"] });
  const { brief } = await tourAction({ action: "compile-brief", ...AT }, options);
  const { tour } = await tourAction({ action: "get-assignment", ...AT }, options);
  assert.deepEqual(brief.tourDirection.selectedParagraphs, [directionParagraphs(tour.direction)[4]]);
});

test("the Scene direction records what was marked and who marked it", async () => {
  const { options } = await ready();
  const { concept } = await withConcept(options, { directionParagraphs: [0, 2] });
  assert.deepEqual(concept.directionParagraphs, [0, 2]);
  assert.equal(concept.directionSelectedBy, OPERATOR.displayName);
  assert.ok(concept.directionSelectedAt);
  const read = await tourAction({ action: "get-concept", ...AT }, options);
  assert.deepEqual(read.concept.directionParagraphs, [0, 2]);
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
  assert.equal(frozen.brief.frozenBy, OPERATOR.displayName);
  assert.ok(frozen.brief.frozenAt);

  const stored = new Map(tourBackend.files);
  const briefsPath = tourPathFor(TOUR, ASSIGNMENT, "briefs", DEMO_ACCOUNT);
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

// A second tour, written here rather than committed, so a Scene for the other
// identity can be read end to end. The artist is the same because the brain is
// the thing under test.
const HCK_TOUR = `# Knights Run

Artist: dierks-bentley
Tour id: hck-run-2026
Playback system: One machine, one spare.

## Direction, version 1

Set by: Nadia Rourke, Creative Director
Set on: 2026-02-02

Play it straight and never wink at the audience.
`;

const HCK_ASSIGNMENT = `# The entrance

Assignment id: entrance
Tour id: hck-run-2026
Identity: hot-country-knights
Written against direction version: 1

## What we are asking for

They arrive and the room has to believe them.
`;

// A tour is read from the store and from nothing else, so this one is seeded
// from the text above the same way the committed files are seeded.
async function withHckTour(options) {
  await seedTourFromFixture(options.tourStore, "hck-run-2026", {
    texts: { tour: HCK_TOUR, assignments: [HCK_ASSIGNMENT] },
  });
  return options;
}

test("a Scene direction saved without asking the brain still carries what the artist avoids", async () => {
  const { options } = await ready();
  // Nothing is passed in, which is what happens when a person writes their own
  // direction and never asks for suggestions.
  await tourAction({ action: "choose-concept", ...AT, person: "Grey", concept: { ...CONCEPT, avoid: [] } }, options);
  const { brief, document } = await tourAction({ action: "compile-brief", ...AT }, options);
  const { context } = await tourAction({ action: "assignment-context", ...AT }, options);

  const expected = context.avoids
    .map((entry) => findingSentence(entry.text))
    .filter((text) => !carriesOurWords(text));
  assert.ok(expected.length > 5, "the approved brain holds several of these");
  assert.deepEqual(brief.avoid, expected);
  for (const text of expected) assert.ok(document.includes(text), "every one of them reaches the document");
  assert.ok(!document.includes("None recorded.\n\n## What was asked for"));
});

test("a Scene for the other identity carries only that identity's prohibitions", async () => {
  const { options } = await ready();
  const at = { tourId: "hck-run-2026", assignmentId: "entrance" };
  const withHck = await withHckTour(options);
  await tourAction({ action: "choose-concept", ...at, person: "Grey", concept: CONCEPT }, withHck);
  const { brief, document } = await tourAction({ action: "compile-brief", ...at }, withHck);
  const { context } = await tourAction({ action: "assignment-context", ...at }, withHck);

  assert.equal(context.identity, "hot-country-knights");
  const mine = context.avoids.map((entry) => findingSentence(entry.text));
  assert.ok(mine.length > 0);
  for (const text of mine) assert.ok(document.includes(text));

  // The main stage prohibitions belong to the other identity and never travel
  // with this one.
  const mainStage = await tourAction({ action: "assignment-context", ...AT }, options);
  const theirs = mainStage.context.avoids.map((entry) => findingSentence(entry.text));
  const shared = theirs.filter((text) => mine.includes(text));
  assert.equal(shared.length, 0, "the two identities hold different prohibitions here");
  for (const text of theirs) assert.ok(!document.includes(text), "no main stage prohibition reaches this brief");
  // The brain's findings for this identity lead, and the one note the concept
  // carried follows.
  assert.deepEqual(brief.avoid, [...mine, CONCEPT.avoid[0]]);
});

test("a brain with nothing on record to avoid says so in plain words", () => {
  const brief = compileBrief({
    tour: { id: "t", direction: { version: 1, setBy: "X", setOn: "2026-01-01", words: "A line." } },
    assignment: { id: "a", title: "A", request: "Something.", requiredElements: [] },
    concept: { title: "C", idea: "An idea.", avoid: [] },
    artistId: "dierks-bentley",
    briefVersion: 1,
  });
  const document = renderBriefDocument(brief);
  assert.deepEqual(brief.avoid, []);
  assert.ok(document.includes("Nothing on record that this artist avoids."));
  assert.ok(!/## What to avoid\n\n- None recorded/.test(document));
});

test("an entry that is a record about the intake rather than the artist stays here", async () => {
  const { options } = await ready();
  const { context } = await tourAction({ action: "assignment-context", ...AT }, options);
  const held = context.avoids.map((entry) => findingSentence(entry.text));
  const kept = held.filter((text) => !carriesOurWords(text));
  assert.ok(kept.length < held.length, "the brain holds at least one entry that is bookkeeping");

  await tourAction({ action: "choose-concept", ...AT, person: "Grey", concept: CONCEPT }, options);
  const { document } = await tourAction({ action: "compile-brief", ...AT }, options);
  for (const word of ["bin", "facet", "governance", "candidate", "proposed", "finding-"]) {
    assert.ok(!new RegExp(`\\b${word}`, "i").test(document), `the document says "${word}"`);
  }
});
