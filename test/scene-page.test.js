import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";

const TOUR_REPLY = {
  tour: {
    id: TOUR,
    name: "Off The Map 2026",
    dates: [{ date: "2026-06-12", venue: "Ruoff Music Center", place: "Noblesville, Indiana" }],
  },
  assignments: [{ id: ASSIGNMENT, title: "Storm and lightning", directionVersion: 1 }],
};

const CONTEXT_REPLY = {
  tour: TOUR_REPLY.tour,
  assignment: {
    id: ASSIGNMENT,
    title: "Storm and lightning",
    request: "A storm builds across the song.",
    requiredElements: ["One long build cue"],
    requestedBy: "Tour manager",
    requestedOn: "2026-08-01",
    directionVersion: 1,
  },
  context: {
    directionVersion: 1,
    setupVersion: 1,
    directionParagraphs: ["The tour reads as weather."],
    productionSetup: { version: 1, words: "One main wall upstage behind the band." },
    venueExceptions: [{ date: "2026-07-04", venue: "The Gorge", text: "No upstage wall." }],
  },
};

function element() {
  return { innerHTML: "", textContent: "", dataset: {}, addEventListener() {} };
}

// The page's own script, loaded into a context with stand-in elements, so what
// the test reads is the markup a person would be looking at and the calls the
// page actually makes.
function scenePage(questions = []) {
  const source = fs.readFileSync(path.join(rootPath, "app", "scene.js"), "utf8")
    .replace(/^import .*?;\n\n/, "");
  const elements = { location: element(), scene: element(), actions: element() };
  const handlers = {};
  const uploadCalls = [];

  const context = {
    URLSearchParams,
    JSON,
    Number,
    String,
    Array,
    Set,
    Boolean,
    Object,
    Date,
    console,
    ACCOUNT_ID: null,
    TOUR_ID: TOUR,
    scopedBody: (body) => ({ accountId: null, ...body }),
    window: { location: { search: `?tour=${TOUR}&scene=${ASSIGNMENT}` } },
    document: {
      getElementById: (id) => elements[id] || element(),
      addEventListener: (type, handler) => { handlers[type] = handler; },
      createElement: () => ({ click() {} }),
    },
  };
  function okReply(body) {
    return { ok: true, status: 200, json: async () => body };
  }
  context.fetch = async (url, init) => {
    const sent = JSON.parse(init.body);
    if (url === "/api/tour-upload") {
      uploadCalls.push(sent);
      return okReply({ references: [] });
    }
    const action = sent.action;
    if (action === "get-me") return okReply({ user: { role: "higher-roads", displayName: "Ray Mercer" } });
    if (action === "get-tour") return okReply(TOUR_REPLY);
    if (action === "assignment-context") return okReply(CONTEXT_REPLY);
    if (action === "get-concept") return okReply({ concept: null });
    if (action === "list-briefs") return okReply({ briefs: [] });
    if (action === "get-questions") return okReply({ questions });
    if (action === "get-handoffs") return okReply({ handoffs: [] });
    if (action === "get-artboards") return okReply({ artboards: [] });
    throw new Error(`the page asked for ${action}, which this test does not answer`);
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    elements,
    handlers,
    uploadCalls,
    async settle() {
      for (let pass = 0; pass < 20; pass += 1) await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

// The reference list call named an identifier the page never declared, so it
// threw on every load into a catch that swallowed it and no reference ever
// appeared. This asserts the call reaches the route carrying the Scene it is
// for. It fails against any version that reaches for an undeclared name.
test("the reference list call carries the Scene the page is open on", async () => {
  const page = scenePage();
  await page.settle();

  const listed = page.uploadCalls.filter((entry) => entry.mode === "reference-list");
  assert.equal(listed.length, 1, "the page did not ask for its reference images");
  assert.equal(listed[0].assignmentId, ASSIGNMENT);
  assert.equal(listed[0].tourId, TOUR);
});

test("reference images sit with the request rather than in a side panel", async () => {
  const page = scenePage();
  await page.settle();
  const markup = page.elements.scene.innerHTML;

  const request = markup.indexOf('id="client-request-heading"');
  const references = markup.indexOf('aria-label="Reference images"');
  const tour = markup.indexOf('id="tour-context-heading"');
  assert.ok(request > -1, "the request is not on the page");
  assert.ok(references > request, "reference images do not sit under the request");
  assert.ok(tour > references, "the tour facts do not follow the request and its references");
});

test("the page renders with no direction checkboxes and no inspector", async () => {
  const page = scenePage();
  await page.settle();
  const markup = page.elements.scene.innerHTML;

  assert.doesNotMatch(markup, /data-paragraph/, "the direction is still a set of checkboxes");
  assert.doesNotMatch(markup, /data-venue=/, "the dates where the rig differs are still checkboxes");
  assert.doesNotMatch(markup, /m-workstation__inspector/, "the inspector is still on the page");
  assert.doesNotMatch(markup, /role="tablist"/, "the inspector tabs are still on the page");
  assert.doesNotMatch(markup, /Artist Brain/, "the brain still offers ideas from the Scene page");
});

test("the tour facts show the dates and the rig as the thin free text they are", async () => {
  const page = scenePage();
  await page.settle();
  const markup = page.elements.scene.innerHTML;

  assert.match(markup, /Ruoff Music Center/, "the venue is not shown");
  assert.match(markup, /Noblesville, Indiana/, "the place is not shown");
  assert.match(markup, /One main wall upstage behind the band/, "the production setup words are not shown");
  assert.match(markup, /The Gorge/, "the date where the rig differs is not shown");
  assert.match(markup, /DIRECTION V01/, "the direction version is not named");
  assert.doesNotMatch(markup, /The tour reads as weather/, "the direction text is reprinted on the page");
});

test("an unanswered question and its answer both read with who said each", async () => {
  const page = scenePage([
    { id: "question-a", text: "Which four dates are indoors?", askedBy: "Ray Mercer", askedAt: "2026-08-27", answer: null },
    { id: "question-b", text: "Is the band on risers?", askedBy: "Ray Mercer", askedAt: "2026-08-26", answer: "Yes, all night.", answeredBy: "Dana Whitlock", answeredAt: "2026-08-27" },
  ]);
  await page.settle();
  const markup = page.elements.scene.innerHTML;

  assert.match(markup, /Which four dates are indoors\?/);
  assert.match(markup, /WAITING ON THE CLIENT/, "an unanswered question does not say who it waits on");
  assert.match(markup, /Yes, all night\./);
  assert.match(markup, /Dana Whitlock/, "the answer does not name who wrote it");
  assert.match(markup, /data-ask/, "Higher Roads cannot ask a question");
});
