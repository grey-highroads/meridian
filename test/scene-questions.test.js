import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction, ANSWERED_A_QUESTION, ASKED_A_QUESTION } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore, tourPathFor } from "../src/tour/store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";

// Asking the client something. The question shows up where the client already
// looks, the answer lands back on the Scene, and the work has not moved,
// because nothing about the work changed. Ruled 2026-08-27.

const DEMO_ACCOUNT = "dierks-bentley";
const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };

const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads", accountId: DEMO_ACCOUNT };
const REVIEWER = { id: "client", login: "dana", displayName: "Dana Whitlock", role: "client-reviewer", roleLabel: "Client reviewer", accountId: DEMO_ACCOUNT };
const OTHER_CLIENT = { id: "client-b", displayName: "Sam Field", role: "client-reviewer", roleLabel: "Client reviewer", accountId: "stagecraft" };

async function ready() {
  const backend = createMemoryBackend();
  const store = createArtistStore({ backend, accountId: DEMO_ACCOUNT });
  const tourStore = createTourStore({ backend, accountId: DEMO_ACCOUNT });
  const sceneRecord = createSceneRecord({ backend, accountId: DEMO_ACCOUNT });
  const artboardStore = createArtboardStore({ backend, accountId: DEMO_ACCOUNT });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  await seedTourFromFixture(tourStore, TOUR);
  const options = { store, tourStore, sceneRecord, artboardStore, user: OPERATOR };
  return { backend, options, asClient: { ...options, user: REVIEWER } };
}

// Assert what is stored, not what the call handed back.
async function storedQuestions(backend) {
  const body = await backend.read(tourPathFor(TOUR, ASSIGNMENT, "questions", DEMO_ACCOUNT));
  return JSON.parse(body).questions;
}

test("a question is stored on the Scene with who asked and when", async () => {
  const { backend, options } = await ready();
  await tourAction({ action: "ask-question", ...AT, text: "Which four dates are indoors?" }, options);

  const stored = await storedQuestions(backend);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].text, "Which four dates are indoors?");
  assert.equal(stored[0].askedBy, "Ray Mercer");
  assert.ok(stored[0].askedAt);
  assert.equal(stored[0].answer, null);
});

test("an empty question is refused rather than stored blank", async () => {
  const { backend, options } = await ready();
  await assert.rejects(
    () => tourAction({ action: "ask-question", ...AT, text: "   " }, options),
    (error) => error.status === 400,
  );
  const body = await backend.read(tourPathFor(TOUR, ASSIGNMENT, "questions", DEMO_ACCOUNT));
  assert.equal(body === null || body === undefined, true, "a refused question still wrote a document");
});

test("the client answers and the answer lands on the Scene, attributed", async () => {
  const { backend, options, asClient } = await ready();
  const { question } = await tourAction({ action: "ask-question", ...AT, text: "Is the band on risers?" }, options);
  await tourAction({ action: "answer-question", ...AT, questionId: question.id, text: "Yes, all night." }, asClient);

  const stored = await storedQuestions(backend);
  assert.equal(stored.length, 1, "the answer made a second question");
  assert.equal(stored[0].answer, "Yes, all night.");
  assert.equal(stored[0].answeredBy, "Dana Whitlock");
  assert.ok(stored[0].answeredAt);
  assert.equal(stored[0].text, "Is the band on risers?", "the question was rewritten by the answer");
});

test("a question already answered is not answered again", async () => {
  const { options, asClient } = await ready();
  const { question } = await tourAction({ action: "ask-question", ...AT, text: "Is the band on risers?" }, options);
  await tourAction({ action: "answer-question", ...AT, questionId: question.id, text: "Yes." }, asClient);
  await assert.rejects(
    () => tourAction({ action: "answer-question", ...AT, questionId: question.id, text: "Actually no." }, asClient),
    (error) => error.status === 409,
  );
});

test("both the question and the answer append a fact, and the client can read them", async () => {
  const { options, asClient } = await ready();
  const { question } = await tourAction({ action: "ask-question", ...AT, text: "Is the band on risers?" }, options);
  await tourAction({ action: "answer-question", ...AT, questionId: question.id, text: "Yes, all night." }, asClient);

  const { facts } = await tourAction({ action: "get-scene-record", ...AT }, options);
  const asked = facts.filter((fact) => fact.action === ASKED_A_QUESTION);
  const answered = facts.filter((fact) => fact.action === ANSWERED_A_QUESTION);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].actor, "Ray Mercer");
  assert.equal(answered.length, 1);
  assert.equal(answered[0].actor, "Dana Whitlock");

  const clientView = await tourAction({ action: "get-scene-activity", ...AT }, asClient);
  assert.ok(clientView.facts.some((fact) => fact.action === ASKED_A_QUESTION), "the client cannot see the question in the record");
  assert.ok(clientView.facts.some((fact) => fact.action === ANSWERED_A_QUESTION), "the client cannot see their own answer in the record");
});

test("asking a question leaves the Scene where it was", async () => {
  const { options } = await ready();
  const before = await tourAction({ action: "get-tour", tourId: TOUR }, options);
  const scene = (list) => list.assignments.find((entry) => entry.id === ASSIGNMENT);
  await tourAction({ action: "ask-question", ...AT, text: "Which four dates are indoors?" }, options);
  const after = await tourAction({ action: "get-tour", tourId: TOUR }, options);

  assert.equal(scene(after).stage, scene(before).stage, "the question moved the Scene to another stage");
  assert.equal(scene(after).waitingOn, scene(before).waitingOn, "the question changed who the work waits on");
  assert.equal(scene(after).nextAction, scene(before).nextAction, "the question changed the next step");
  assert.equal(scene(after).currentVersion, scene(before).currentVersion);
});

test("an open question reaches the tour read so Home can put it where the client looks", async () => {
  const { options, asClient } = await ready();
  const { question } = await tourAction({ action: "ask-question", ...AT, text: "Which four dates are indoors?" }, options);

  const open = await tourAction({ action: "get-tour", tourId: TOUR }, asClient);
  const scene = open.assignments.find((entry) => entry.id === ASSIGNMENT);
  assert.equal(scene.openQuestions.length, 1);
  assert.equal(scene.openQuestions[0].text, "Which four dates are indoors?");
  assert.equal(scene.openQuestions[0].askedBy, "Ray Mercer");

  await tourAction({ action: "answer-question", ...AT, questionId: question.id, text: "Four of them." }, asClient);
  const closed = await tourAction({ action: "get-tour", tourId: TOUR }, asClient);
  assert.deepEqual(closed.assignments.find((entry) => entry.id === ASSIGNMENT).openQuestions, []);
});

test("a question asked on one account's Scene is nowhere for another account", async () => {
  const { backend, options } = await ready();
  await tourAction({ action: "ask-question", ...AT, text: "Which four dates are indoors?" }, options);

  const other = { tourStore: createTourStore({ backend, accountId: "stagecraft" }), user: OTHER_CLIENT };
  await assert.rejects(
    () => tourAction({ action: "get-questions", ...AT }, other),
    (error) => error.status === 404 && error.message === "We couldn't find this tour.",
  );
  const stray = await backend.read(tourPathFor(TOUR, ASSIGNMENT, "questions", "stagecraft"));
  assert.equal(stray === null || stray === undefined, true, "the question landed under another account's path");
});

test("a client cannot ask a question, because asking is a Higher Roads act", async () => {
  const { asClient } = await ready();
  await assert.rejects(
    () => tourAction({ action: "ask-question", ...AT, text: "Anything?" }, asClient),
    (error) => error.status === 403,
  );
});
