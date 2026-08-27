import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { parseTour, parseAssignment, parseTourFixture } from "../src/tour/parse-fixture.js";
import { readTourFixture } from "../src/tour/read-fixture.js";
import { buildProposalRequest, checkProposals } from "../src/tour/propose.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";

const DEMO_ACCOUNT = "dierks-bentley";

const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };

const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";

async function brainReady() {
  const backend = createMemoryBackend();
  const store = createArtistStore({ backend, accountId: DEMO_ACCOUNT });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  return { backend, store, tourStore: await seededTour() };
}

// A tour is read from the store and from nothing else, so a test that works
// against one puts it there first, the same way the Admin action does.
async function seededTour() {
  const tourStore = createTourStore({ backend: createMemoryBackend(), accountId: DEMO_ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  return tourStore;
}

test("the tour fixture parses into a tour, a versioned direction, and an assignment", async () => {
  const fixture = parseTourFixture(await readTourFixture(TOUR));
  assert.equal(fixture.tour.id, TOUR);
  assert.equal(fixture.tour.artistId, "dierks-bentley");
  assert.equal(fixture.tour.direction.version, 1);
  assert.ok(fixture.tour.direction.setBy);
  assert.ok(fixture.tour.direction.setOn);
  assert.equal(fixture.assignments.length, 1);
  assert.equal(fixture.assignments[0].id, ASSIGNMENT);
  assert.equal(fixture.assignments[0].directionVersion, 1);
});

test("the direction is stored as given, with none of the file's own header inside it", async () => {
  const fixture = parseTourFixture(await readTourFixture(TOUR));
  const words = fixture.tour.direction.words;
  assert.ok(!/^Set by:/im.test(words));
  assert.ok(!/^Set on:/im.test(words));
  assert.ok(!/Stored as given/i.test(words));
  // The director's sentences arrive whole rather than summarized.
  assert.ok(words.includes("Off The Map"));
  assert.ok(words.includes("bluegrass thread is not a segment"));
  assert.ok(words.length > 800);
});

test("an assignment that names a different direction version is refused", () => {
  const tour = `# T\n\nArtist: a\nTour id: t\n\n## Direction, version 2\n\nSet by: X\n\nWords.\n`;
  const assignment = `# A\n\nAssignment id: a1\nTour id: t\nWritten against direction version: 1\n\n## What we are asking for\n\nSomething.\n`;
  assert.throws(
    () => parseTourFixture({ tour, assignments: [assignment] }),
    /written against direction version 1 and this tour is at version 2/,
  );
});

test("an assignment that names no direction version is refused", () => {
  const assignment = `# A\n\nAssignment id: a1\nTour id: t\n\n## What we are asking for\n\nSomething.\n`;
  assert.throws(() => parseAssignment(assignment), /does not name the direction version/);
});

test("a tour with no direction is refused", () => {
  assert.throws(() => parseTour(`# T\n\nArtist: a\nTour id: t\n`), /needs a direction with a version/);
});

test("the assignment context carries the identity's findings and never the other identity's", async () => {
  const { store, tourStore } = await brainReady();
  const result = await tourAction({ action: "assignment-context", tourId: TOUR, assignmentId: ASSIGNMENT }, { store, tourStore, user: OPERATOR });
  const context = result.context;
  assert.equal(context.identity, "main-stage");
  assert.equal(context.counts.inBrain, 80);
  assert.ok(context.counts.inScope < context.counts.inBrain, "scoping actually removes findings");
  assert.ok(context.findings.every((entry) => entry.identity === "main-stage" || entry.identity === "shared"));
  assert.equal(context.findings.filter((entry) => entry.identity === "hot-country-knights").length, 0);
  // Every finding carries what it rests on, so a person can check any of them.
  assert.ok(context.findings.every((entry) => Object.prototype.hasOwnProperty.call(entry, "independentSourceCount")));
  // What the brand avoids travels whole.
  assert.ok(context.avoids.length > 0);
  assert.ok(context.avoids.every((entry) => entry.facet === "AV"));
});

test("the context names the direction version it was assembled against", async () => {
  const { store, tourStore } = await brainReady();
  const result = await tourAction({ action: "assignment-context", tourId: TOUR, assignmentId: ASSIGNMENT }, { store, tourStore, user: OPERATOR });
  assert.equal(result.context.directionVersion, result.tour.direction.version);
  assert.equal(result.assignment.directionVersion, result.tour.direction.version);
});

test("the tour refuses to work against a brain nobody has approved", async () => {
  const store = createArtistStore({ backend: createMemoryBackend(), accountId: DEMO_ACCOUNT });
  const tourStore = await seededTour();
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await assert.rejects(
    () => tourAction({ action: "assignment-context", tourId: TOUR, assignmentId: ASSIGNMENT }, { store, tourStore, user: OPERATOR }),
    /Approve this artist's brain before asking it to work on an assignment/,
  );
});

test("a tour that does not exist and an assignment that does not exist both fail plainly", async () => {
  const { store, tourStore } = await brainReady();
  await assert.rejects(
    () => tourAction({ action: "get-tour", tourId: "no-such-tour" }, { store, tourStore, user: OPERATOR }),
    /We couldn't find this tour/,
  );
  await assert.rejects(
    () => tourAction({ action: "get-assignment", tourId: TOUR, assignmentId: "no-such-assignment" }, { store, tourStore, user: OPERATOR }),
    /We couldn't find that Scene on this tour/,
  );
});

test("the model is asked for the direction as given, the request as given, and the findings with their ids", async () => {
  const { store, tourStore } = await brainReady();
  const { context } = await tourAction({ action: "assignment-context", tourId: TOUR, assignmentId: ASSIGNMENT }, { store, tourStore, user: OPERATOR });
  const request = buildProposalRequest(context);
  const sent = request.messages.map((message) => message.content).join("\n");
  assert.ok(sent.includes(context.direction.words), "the director's words go as given");
  assert.ok(sent.includes(context.request), "the tour manager's words go as given");
  assert.ok(sent.includes("finding-1"), "findings carry ids the model can cite");
  assert.equal(request.response_format.type, "json_object");
  // The brain proposes and never writes execution instructions.
  assert.ok(!/\bprompt\b/i.test(sent));
});

test("a proposal citing a finding the brain does not hold has that citation dropped", async () => {
  const { store, tourStore } = await brainReady();
  const { context } = await tourAction({ action: "assignment-context", tourId: TOUR, assignmentId: ASSIGNMENT }, { store, tourStore, user: OPERATOR });
  const checked = checkProposals({
    appliedFindings: [{ id: "finding-1", why: "It bears on the request." }, { id: "finding-9999", why: "Invented." }],
    proposals: [{
      title: "A front that arrives",
      idea: "The weather comes in over the lawn.",
      whyThisArtist: "He plays sheds.",
      rhymesWith: ["finding-1", "finding-9999"],
      asksOfProduction: "Time in rehearsal.",
      whereItMightMiss: "It could read as spectacle.",
    }],
    avoidNotes: ["No arena rock."],
    openQuestions: ["Which four dates are indoors?"],
  }, context);

  assert.deepEqual(checked.proposals[0].rhymesWith, ["finding-1"]);
  assert.deepEqual(checked.proposals[0].droppedCitations, ["finding-9999"]);
  assert.deepEqual(checked.appliedFindings.map((entry) => entry.findingId), ["finding-1"]);
  assert.deepEqual(checked.droppedFindings, ["finding-9999"]);
  // An applied finding arrives with its evidence attached, not just its id.
  assert.equal(typeof checked.appliedFindings[0].independentSourceCount, "number");
});

test("a reply with no proposals is refused rather than shown", async () => {
  const { store, tourStore } = await brainReady();
  const { context } = await tourAction({ action: "assignment-context", tourId: TOUR, assignmentId: ASSIGNMENT }, { store, tourStore, user: OPERATOR });
  assert.throws(() => checkProposals({ proposals: [] }, context), /returned no concept directions/);
});

test("proposing concepts with no key configured says so instead of failing obscurely", async () => {
  const { store, tourStore } = await brainReady();
  const key = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => tourAction({ action: "propose-concepts", tourId: TOUR, assignmentId: ASSIGNMENT }, { store, tourStore, user: OPERATOR }),
      /OPENAI_API_KEY is set on this deployment/,
    );
  } finally {
    if (key !== undefined) process.env.OPENAI_API_KEY = key;
  }
});

test("nothing the tour does writes to the artist layer", async () => {
  const { backend, store } = await brainReady();
  const before = new Map(backend.files);
  // The Scenes directory reads tour storage. It gets its own place to read so
  // this test can watch the artist layer and nothing else.
  const tourBackend = createMemoryBackend();
  const tourStore = createTourStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  const artboardStore = createArtboardStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  const sceneRecord = createSceneRecord({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  await tourAction(
    { action: "get-tour", tourId: TOUR },
    { store, tourStore, artboardStore, sceneRecord, user: OPERATOR },
  );
  await tourAction({ action: "get-assignment", tourId: TOUR, assignmentId: ASSIGNMENT }, { store, tourStore, user: OPERATOR });
  await tourAction({ action: "assignment-context", tourId: TOUR, assignmentId: ASSIGNMENT }, { store, tourStore, user: OPERATOR });
  assert.deepEqual([...backend.files.keys()].sort(), [...before.keys()].sort());
  for (const [pathname, body] of backend.files) assert.equal(body, before.get(pathname), `${pathname} changed`);
});
