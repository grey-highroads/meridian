import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";
import { PROPOSAL_TOKEN_CAP, proposeConcepts } from "../src/tour/propose.js";

const DEMO_ACCOUNT = "dierks-bentley";

const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";

async function brainReady() {
  const backend = createMemoryBackend();
  const store = createArtistStore({ backend, accountId: DEMO_ACCOUNT });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  return { backend, store };
}

async function sceneContext() {
  const { store } = await brainReady();
  // A tour is read from the store and from nothing else, so a test that works
  // against one puts it there first, the same way the Admin action does.
  const tourStore = createTourStore({ backend: createMemoryBackend(), accountId: DEMO_ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  const reply = await tourAction(
    { action: "assignment-context", tourId: TOUR, assignmentId: ASSIGNMENT },
    { store, tourStore, user: OPERATOR },
  );
  return reply.context;
}

// A model that answers with whatever the test hands it, and records the body
// that was sent so the request can be read back.
function stubModel(reply) {
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => reply };
  };
  return { fetchImpl, sent };
}

test("the propose request carries a ceiling on what the model may write back", async () => {
  const context = await sceneContext();
  const model = stubModel({
    choices: [{
      finish_reason: "stop",
      message: { content: JSON.stringify({ appliedFindings: [], proposals: [{ title: "A", idea: "B" }] }) },
    }],
  });

  await proposeConcepts(context, { apiKey: "test-key", fetchImpl: model.fetchImpl, logger() {} });

  assert.equal(model.sent.length, 1);
  assert.equal(model.sent[0].max_completion_tokens, PROPOSAL_TOKEN_CAP);
  assert.ok(PROPOSAL_TOKEN_CAP > 0, "the ceiling has to be a real number to bound anything");
});

test("a reply the model cut off at the ceiling says so and never reaches the JSON parser", async () => {
  const context = await sceneContext();
  // Half a document. If this got to the parser the person would read
  // "Unexpected token" and have nothing to act on.
  const model = stubModel({
    choices: [{ finish_reason: "length", message: { content: '{"proposals":[{"title":"A","idea":"B' } }],
  });

  await assert.rejects(
    () => proposeConcepts(context, { apiKey: "test-key", fetchImpl: model.fetchImpl, logger() {} }),
    (error) => {
      assert.match(error.message, /ran too long/);
      assert.doesNotMatch(error.message, /Unexpected token/, "the truncated document reached the parser");
      assert.doesNotMatch(error.message, /JSON/i, "the person is being shown a parser failure");
      return true;
    },
  );
});

test("every completed model call leaves one line with its duration and token count", async () => {
  const context = await sceneContext();
  const lines = [];
  const model = stubModel({
    usage: { completion_tokens: 1234 },
    choices: [{
      finish_reason: "stop",
      message: { content: JSON.stringify({ appliedFindings: [], proposals: [{ title: "A", idea: "B" }] }) },
    }],
  });

  await proposeConcepts(context, {
    apiKey: "test-key",
    fetchImpl: model.fetchImpl,
    logger: (line) => lines.push(line),
  });

  assert.equal(lines.length, 1);
  assert.match(lines[0], /\d+ms/);
  assert.match(lines[0], /1234 completion tokens/);
  assert.match(lines[0], /finish stop/);
});

test("a call cut off at the ceiling is measured too, so the numbers explain the failure", async () => {
  const context = await sceneContext();
  const lines = [];
  const model = stubModel({
    usage: { completion_tokens: PROPOSAL_TOKEN_CAP },
    choices: [{ finish_reason: "length", message: { content: "{" } }],
  });

  await assert.rejects(() => proposeConcepts(context, {
    apiKey: "test-key",
    fetchImpl: model.fetchImpl,
    logger: (line) => lines.push(line),
  }));

  assert.equal(lines.length, 1);
  assert.match(lines[0], /finish length/);
});
