import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { PROPOSAL_TOKEN_CAP, proposeConcepts } from "../src/tour/propose.js";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";

async function brainReady() {
  const backend = createMemoryBackend();
  const store = createArtistStore({ backend });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  return { backend, store };
}

async function sceneContext() {
  const { store } = await brainReady();
  const reply = await tourAction(
    { action: "assignment-context", tourId: TOUR, assignmentId: ASSIGNMENT },
    { store, user: OPERATOR },
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

// ---------------------------------------------------------------------------
// The Scene page, run rather than read. The page's own script is loaded into a
// context with stand-in elements, so what the test reads is the markup a
// person would be looking at.
// ---------------------------------------------------------------------------

const TOUR_REPLY = {
  tour: { id: TOUR, name: "Off The Map 2026" },
  assignments: [{ id: ASSIGNMENT, title: "Storm and lightning", directionVersion: 1 }],
};

const CONTEXT_REPLY = {
  tour: TOUR_REPLY.tour,
  assignment: {
    id: ASSIGNMENT,
    title: "Storm and lightning",
    request: "A storm builds across the song.",
    requiredElements: [],
    requestedBy: "Tour manager",
    directionVersion: 1,
  },
  context: {
    directionVersion: 1,
    setupVersion: 1,
    directionParagraphs: ["The tour reads as weather."],
    venueExceptions: [],
  },
};

function element() {
  return { innerHTML: "", textContent: "", dataset: {}, addEventListener() {} };
}

// Drive the page with a reply for each action it asks for. `propose` may be a
// value to return or a function that throws.
function scenePage(propose) {
  const source = fs.readFileSync(path.join(rootPath, "app", "scene.js"), "utf8");
  const elements = { location: element(), scene: element(), actions: element() };
  const handlers = {};

  const context = {
    URLSearchParams,
    JSON,
    Number,
    String,
    Array,
    Set,
    Boolean,
    Object,
    console,
    window: { location: { search: `?tour=${TOUR}&scene=${ASSIGNMENT}` } },
    document: {
      getElementById: (id) => elements[id] || element(),
      addEventListener: (type, handler) => { handlers[type] = handler; },
      createElement: () => ({ click() {} }),
    },
  };
  context.fetch = async (url, init) => {
    const action = JSON.parse(init.body).action;
    if (action === "get-tour") return okReply(TOUR_REPLY);
    if (action === "assignment-context") return okReply(CONTEXT_REPLY);
    if (action === "get-concept") return okReply({ concept: null });
    if (action === "list-briefs") return okReply({ briefs: [] });
    if (action === "propose-concepts") return propose(context);
    throw new Error(`the page asked for ${action}, which this test does not answer`);
  };
  function okReply(body) {
    return { ok: true, status: 200, json: async () => body };
  }

  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    context,
    elements,
    async settle() {
      for (let pass = 0; pass < 20; pass += 1) await new Promise((resolve) => setImmediate(resolve));
    },
    ask() {
      handlers.click({ target: { closest: () => ({ hasAttribute: (name) => name === "data-ask", dataset: {} }) } });
    },
  };
}

// The markup between the Artist Brain heading and the next inspector panel. A
// sentence in here sits beside the button that was pressed.
function suggestionsSection(markup) {
  const start = markup.indexOf('aria-labelledby="brain-heading"');
  const end = markup.indexOf('id="setup-panel"');
  assert.ok(start > -1, "the Scene page no longer has an Artist Brain section");
  assert.ok(end > start, "the Artist Brain section is no longer followed by another inspector panel");
  return markup.slice(start, end);
}

test("a dropped connection puts the connection sentence beside the Ask Artist Brain button", async () => {
  const page = scenePage((context) => {
    const VmTypeError = vm.runInContext("TypeError", context);
    throw new VmTypeError("Failed to fetch");
  });
  await page.settle();
  page.ask();
  await page.settle();

  const beside = suggestionsSection(page.elements.scene.innerHTML);
  assert.match(beside, /The connection dropped while Artist Brain was thinking\. Ask again\./);
  assert.doesNotMatch(beside, /Failed to fetch/, "the browser's own words reached the person");

  // And it is not sitting at the top of the page where nobody looks.
  const above = page.elements.scene.innerHTML.slice(0, page.elements.scene.innerHTML.indexOf('aria-labelledby="brain-heading"'));
  assert.doesNotMatch(above, /The connection dropped/);
});

test("an error from the server renders beside the button that asked for it", async () => {
  const page = scenePage(() => ({
    ok: false,
    status: 502,
    json: async () => ({ error: "The answer ran too long and stopped before it finished. Ask again, or narrow what you are asking for." }),
  }));
  await page.settle();
  page.ask();
  await page.settle();

  const beside = suggestionsSection(page.elements.scene.innerHTML);
  assert.match(beside, /ran too long/);

  const above = page.elements.scene.innerHTML.slice(0, page.elements.scene.innerHTML.indexOf('aria-labelledby="brain-heading"'));
  assert.doesNotMatch(above, /ran too long/, "the sentence is still only at the top of the page");
});
