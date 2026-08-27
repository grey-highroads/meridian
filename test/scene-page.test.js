import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";

const OPERATOR = { role: "higher-roads", displayName: "Ray Mercer" };
const CLIENT = { role: "client-reviewer", displayName: "Sarah Lyle" };

const SCENE_STATE = {
  id: ASSIGNMENT,
  title: "Storm and lightning",
  directionVersion: 1,
  stage: "Requested",
  waitingOn: "Higher Roads",
  nextAction: "Develop this Scene.",
  currentVersion: null,
  currentArtboardVersion: null,
  openQuestions: [],
};

const ASSIGNMENT_REPLY = {
  id: ASSIGNMENT,
  title: "Storm and lightning",
  request: "A storm builds across the song.",
  requiredElements: ["One long build cue"],
  requestedBy: "Sarah Lyle",
  requestedOn: "2026-08-01T14:00:00.000Z",
  directionVersion: 1,
};

const OPERATOR_CONTEXT = {
  directionVersion: 1,
  setupVersion: 1,
  directionParagraphs: ["The tour reads as weather."],
  productionSetup: { version: 1, words: "One main wall upstage behind the band." },
  venueExceptions: [{ date: "2026-07-04", venue: "The Gorge", text: "No upstage wall." }],
};

// A stand-in for a node, with the two things this page does to one that a bare
// object does not give for free: it keeps its own style values, and it can be
// taken out of the page.
function element() {
  return {
    innerHTML: "",
    textContent: "",
    dataset: {},
    style: {},
    open: false,
    present: true,
    handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
    remove() { this.present = false; },
  };
}

// The page's own script, run rather than read, so what the test reads is the
// markup a person would be looking at and the calls the page actually makes.
function scenePage({ user = OPERATOR, questions = [], references = [], state = SCENE_STATE, concept = null, artboards = [] } = {}) {
  const source = fs.readFileSync(path.join(rootPath, "app", "scene.js"), "utf8")
    .replace(/^import .*?;\n\n/, "");
  const elements = {
    location: element(),
    scene: element(),
    "scene-drawer": element(),
    "scene-drawer-body": element(),
  };
  const handlers = {};
  const uploadCalls = [];

  const context = {
    URLSearchParams, JSON, Number, String, Array, Set, Boolean, Object, Date, console,
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
  const okReply = (body) => ({ ok: true, status: 200, json: async () => body });
  const operator = user.role === "higher-roads";
  const asked = [];
  context.fetch = async (url, init) => {
    const sent = JSON.parse(init.body);
    if (url === "/api/tour-upload") {
      uploadCalls.push(sent);
      return okReply({ references });
    }
    asked.push(sent.action);
    if (sent.action === "get-me") return okReply({ user });
    if (sent.action === "get-tour") {
      return okReply({ tour: { id: TOUR, name: "Off The Map 2026", dates: [{ date: "2026-06-12", venue: "Ruoff Music Center", place: "Noblesville, Indiana" }] }, assignments: [state] });
    }
    if (sent.action === "assignment-context") {
      if (!operator) throw new Error("a client asked for the Higher Roads context");
      return okReply({ assignment: ASSIGNMENT_REPLY, context: OPERATOR_CONTEXT });
    }
    if (sent.action === "get-scene-workspace") {
      // What the route actually returns to a client now: no direction, no rig.
      return okReply({ tour: { id: TOUR, name: "Off The Map 2026" }, assignment: ASSIGNMENT_REPLY, concept: null, context: {} });
    }
    if (sent.action === "get-concept") return okReply({ concept });
    if (sent.action === "list-briefs") return okReply({ briefs: [] });
    if (sent.action === "compile-brief") return okReply({ brief: { jobId: "j", briefVersion: 1, status: "draft" }, document: "", sidecar: {} });
    if (sent.action === "get-questions") return okReply({ questions });
    if (sent.action === "get-handoffs") return okReply({ handoffs: [] });
    if (sent.action === "get-artboards") return okReply({ artboards });
    throw new Error(`the page asked for ${sent.action}, which this test does not answer`);
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  const strip = (value) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return {
    elements, handlers, uploadCalls, asked,
    async settle() {
      for (let pass = 0; pass < 20; pass += 1) await new Promise((resolve) => setImmediate(resolve));
    },
    markup: () => elements.scene.innerHTML,
    drawer: () => elements["scene-drawer"],
    drawerMarkup: () => elements["scene-drawer-body"].innerHTML,
    // Words a person reads, with the markup taken out. A class name is not
    // copy, so a rule about what a reader sees is checked against that.
    text: () => strip(elements.scene.innerHTML),
    drawerText: () => strip(elements["scene-drawer-body"].innerHTML),
  };
}

const OPEN_QUESTION = { id: "question-a", text: "Which four dates are indoors?", askedBy: "Ray Mercer", askedAt: "2026-08-27T10:00:00.000Z", answer: null };
const ANSWERED_QUESTION = { id: "question-b", text: "Is the band on risers?", askedBy: "Ray Mercer", askedAt: "2026-08-26T10:00:00.000Z", answer: "Yes, all night.", answeredBy: "Sarah Lyle", answeredAt: "2026-08-27T09:00:00.000Z" };

// ---------------------------------------------------------------------------
// The page. One shape, read by everyone who can open it.
// ---------------------------------------------------------------------------

test("the question is the first thing on the page, with the box already open", async () => {
  const page = scenePage({ user: CLIENT, questions: [OPEN_QUESTION] });
  await page.settle();
  const markup = page.markup();

  const question = markup.indexOf("Which four dates are indoors?");
  const box = markup.indexOf('data-answer="question-a"');
  const status = markup.indexOf('id="scene-status-heading"');
  const request = markup.indexOf('id="what-you-asked-heading"');

  assert.ok(question > -1, "the question is not on the page");
  assert.ok(box > question, "the answer box is not open under the question");
  // Nothing above it. On a phone this is what puts the box in the first screen.
  assert.ok(status > box, "the status line sits above the answer box");
  assert.ok(request > status, "her request sits above the status line");
  const section = markup.indexOf('id="client-questions-heading"');
  assert.ok(section > -1 && section < question, "the question section is not where the question is");
  assert.equal(markup.slice(0, section).split('class="m-scene-source"').length - 1, 1, "another section renders above the question");
  assert.doesNotMatch(markup, /m-direction-editor__title/, "a page title renders above the question");
});

test("an admin and a client are given the same three sections in the same order", async () => {
  const order = [];
  for (const user of [OPERATOR, CLIENT]) {
    const page = scenePage({ user, questions: [OPEN_QUESTION] });
    await page.settle();
    const markup = page.markup();
    order.push([
      markup.indexOf('id="client-questions-heading"'),
      markup.indexOf('id="scene-status-heading"'),
      markup.indexOf('id="what-you-asked-heading"'),
    ]);
    const [questions, status, request] = order.at(-1);
    assert.ok(questions > -1 && status > questions && request > status, `${user.role} is given a different page shape`);
    // Everything Higher Roads does about the Scene is behind the drawer.
    assert.doesNotMatch(markup, /id="venues-heading"|for="scene-direction"|id="ask-heading"|id="send-heading"/, `${user.role} is shown an operator action on the page`);
  }
});

test("the client's page never shows direction, rig, an uploader, or a version number", async () => {
  const page = scenePage({ user: CLIENT, questions: [OPEN_QUESTION] });
  await page.settle();
  const markup = page.markup();
  const text = page.text();

  assert.doesNotMatch(text, /[Dd]irection/, "the client is shown the tour direction or a mention of it");
  assert.doesNotMatch(text, /Venues and screens|upstage|The Gorge|Ruoff/, "the client is shown venue or rig detail");
  assert.doesNotMatch(markup, /data-reference="input"/, "the client is offered an uploader");
  assert.doesNotMatch(text, /Add a reference image/, "the client is offered an uploader");
  assert.doesNotMatch(text, /Note for production/, "the client is shown a note Higher Roads wrote to itself");
  assert.doesNotMatch(text, /brief|Brief|compiled|payload|travels/, "the client is told how briefs are assembled");
  assert.doesNotMatch(text, /V0\d/, "a version number reached client copy");
  assert.doesNotMatch(text, /Client request/, "the page talks about her instead of to her");
  assert.match(text, /What you asked for/, "the page does not name her request in her words");
});

test("with no open question the client sees the status line and her request and nothing else", async () => {
  const page = scenePage({ user: CLIENT, questions: [] });
  await page.settle();
  const markup = page.markup();

  assert.match(markup, /Higher Roads is developing this Scene\. Nothing is needed from you\./);
  assert.match(markup, /A storm builds across the song\./);
  assert.doesNotMatch(markup, /Higher Roads asked you something|What Higher Roads asked you/, "an empty question section still renders");
  assert.doesNotMatch(markup, /data-answer=/, "an answer box renders with nothing to answer");
});

test("the status line says what needs her before it says anything else", async () => {
  const waiting = { ...SCENE_STATE, stage: "Production review", waitingOn: "the client", nextAction: "Review the latest version.", currentArtboardVersion: 2 };
  const page = scenePage({ user: CLIENT, questions: [], state: waiting });
  await page.settle();
  const markup = page.markup();

  assert.match(markup, /New work is ready for you to look at\./);
  assert.match(markup, /Look at the work/, "she is not given the way to do it");
  assert.doesNotMatch(markup, /Review the latest version\./, "the internal next step reached the client");
});

test("an answered exchange stays readable with both names on it", async () => {
  for (const user of [OPERATOR, CLIENT]) {
    const page = scenePage({ user, questions: [ANSWERED_QUESTION] });
    await page.settle();
    const markup = page.markup();

    assert.match(markup, /Is the band on risers\?/);
    assert.match(markup, /Yes, all night\./);
    assert.match(markup, /Ray Mercer/, `${user.role} is not told who asked`);
    assert.match(markup, /Sarah Lyle/, `${user.role} is not told who answered`);
    assert.doesNotMatch(markup, /2026-08-26T10:00:00/, "a stored timestamp reached the reader");
  }
});

test("an admin sees an open question waiting rather than a box to answer it in", async () => {
  const page = scenePage({ questions: [OPEN_QUESTION] });
  await page.settle();
  const markup = page.markup();

  assert.match(markup, /Which four dates are indoors\?/, "the admin cannot see what was asked");
  assert.match(markup, /WAITING ON THE CLIENT/, "an unanswered question does not say who it waits on");
  assert.doesNotMatch(markup, /data-answer=/, "the admin is offered a box to answer their own question");
});

// ---------------------------------------------------------------------------
// The drawer. Higher Roads only, over the page rather than beside it.
// ---------------------------------------------------------------------------

test("the drawer holds the facts, the note, the question, and the send, in that order", async () => {
  const page = scenePage({ questions: [OPEN_QUESTION], concept: { title: "Storm and lightning", idea: "Hold the break." } });
  await page.settle();
  const drawer = page.drawerMarkup();

  const venues = drawer.indexOf('id="venues-heading"');
  const note = drawer.indexOf('for="scene-direction"');
  const ask = drawer.indexOf('id="ask-heading"');
  const send = drawer.indexOf('id="send-heading"');
  assert.ok(venues > -1, "the venue facts are not in the drawer");
  assert.ok(note > venues, "the note does not follow the facts");
  assert.ok(ask > note, "the way to ask a question does not follow the note");
  assert.ok(send > ask, "the send does not come last");
  assert.match(drawer, /Send to production/, "the send is not offered");

  assert.match(drawer, /Ruoff Music Center/);
  assert.match(drawer, /One main wall upstage behind the band/);
  assert.match(drawer, /The Gorge/);
});

test("the drawer trigger reads in plain words", async () => {
  const source = fs.readFileSync(path.join(rootPath, "app", "scene.html"), "utf8");
  const summary = source.match(/<summary>([\s\S]*?)<\/summary>/);
  assert.ok(summary, "the drawer has no trigger");
  const words = summary[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  assert.equal(words, "Work on this Scene");
  assert.doesNotMatch(source, /[Ii]nspector|>\s*Tools\s*</, "the trigger uses a system word");
});

test("a client is given no drawer and no trigger, and is never sent what is in it", async () => {
  const page = scenePage({ user: CLIENT, questions: [OPEN_QUESTION] });
  await page.settle();

  assert.equal(page.drawer().present, false, "the client keeps the drawer element");
  assert.equal(page.drawerMarkup(), "", "the drawer was filled before it was taken away");
  // The server decides what a client receives. The page is not hiding it.
  assert.ok(!page.asked.includes("assignment-context"), "the client asked for the Higher Roads context");
  assert.ok(page.asked.includes("get-scene-workspace"), "the client did not use the client route");
  assert.ok(!page.asked.includes("get-artboards"), "the client asked for operator-only records");
});

test("the drawer sits over the page, open or closed, so the page beneath cannot move", async () => {
  const page = scenePage({ concept: { title: "Storm and lightning", idea: "Hold the break." } });
  await page.settle();
  const drawer = page.drawer();

  // The harness has no layout engine, so this asserts the two things that make
  // reflow impossible rather than measuring a width: the drawer is taken out of
  // flow in both states, and opening it does not touch the page beneath.
  assert.equal(drawer.style.position, "fixed", "the drawer is in the flow of the page while closed");
  const before = page.markup();
  drawer.open = true;
  drawer.handlers.toggle();
  assert.equal(drawer.style.position, "fixed", "the drawer joins the flow of the page when it opens");
  assert.equal(page.markup(), before, "opening the drawer rewrote the page beneath it");
  drawer.open = false;
  drawer.handlers.toggle();
  assert.equal(drawer.style.position, "fixed", "the drawer joins the flow of the page when it closes");
  assert.equal(page.markup(), before, "closing the drawer rewrote the page beneath it");
});

test("the drawer carries no direction paragraphs and no sentence about plumbing", async () => {
  const page = scenePage();
  await page.settle();
  const everything = `${page.markup()} ${page.drawerMarkup()}`;

  assert.doesNotMatch(everything, /The tour reads as weather/, "the direction text is reprinted");
  assert.doesNotMatch(everything, /travels with the brief|Nobody picks parts of it|What the tour holds/, "the page explains what travels where");
  assert.doesNotMatch(everything, /free text on the production setup/, "the page explains its own data model");
  assert.doesNotMatch(everything, /data-paragraph|data-venue=/, "the direction or the dates are still checkboxes");
  assert.doesNotMatch(everything, /m-workstation__inspector|role="tablist"/, "the inspector is back");
});

// ---------------------------------------------------------------------------
// Reference images: shown on the page for both, uploaded by neither
// ---------------------------------------------------------------------------

const REFERENCE = { filename: "sky-reference.jpg", contentType: "image/jpeg", addedBy: "Sarah Lyle", addedOn: "2026-08-01T14:05:00.000Z", pathname: "brand-world-system/clients/dierks-bentley/tours/off-the-map-2026/storm-and-lightning/uploads/abc-sky-reference.jpg" };

// The reference list call named an identifier the page never declared before
// 670393e6. This keeps that fixed wherever the call lives.
test("both readers ask for the attached references and name the Scene they are for", async () => {
  for (const user of [OPERATOR, CLIENT]) {
    const page = scenePage({ user, references: [REFERENCE] });
    await page.settle();
    const listed = page.uploadCalls.filter((entry) => entry.mode === "reference-list");
    assert.equal(listed.length, 1, `${user.role} did not ask for the attached references`);
    assert.equal(listed[0].assignmentId, ASSIGNMENT);
    assert.equal(listed[0].tourId, TOUR);
  }
});

test("an attached reference shows on the page for both and neither uploads", async () => {
  for (const user of [OPERATOR, CLIENT]) {
    const page = scenePage({ user, references: [REFERENCE], questions: [OPEN_QUESTION] });
    await page.settle();
    const markup = page.markup();
    assert.match(markup, /sky-reference\.jpg/, `${user.role} does not see what was attached`);
    assert.doesNotMatch(markup, /data-reference="input"/, `${user.role} is offered an uploader on the Scene`);
    assert.equal(page.uploadCalls.filter((entry) => entry.mode === "reference-record").length, 0);
  }
});

// ---------------------------------------------------------------------------
// Every road to the work goes to the Reviews gallery. The two pages that used
// to serve it were removed on 2026-08-27.
// ---------------------------------------------------------------------------

const ARTBOARDS = [
  { artboard: { artboardVersion: 1, briefVersion: 1 } },
  { artboard: { artboardVersion: 2, briefVersion: 1 } },
];

test("an admin clicking through from a Scene lands on the newest version in the gallery", async () => {
  const state = { ...SCENE_STATE, stage: "Production review", waitingOn: "Higher Roads", currentArtboardVersion: 2 };
  const page = scenePage({ artboards: ARTBOARDS, state });
  await page.settle();
  const markup = page.markup();

  assert.match(markup, /Artboard V02 is ready for review/, "the Scene does not announce the version that came back");
  const href = markup.match(/href="([^"]*reviews\.html[^"]*)"/);
  assert.ok(href, "the Scene has no way through to the gallery");
  assert.match(href[1], /scene=storm-and-lightning/);
  assert.match(href[1], /version=2/, "the Scene does not open the newest version");
  assert.doesNotMatch(markup, /review\.html\?|client-review\.html/, "the Scene still links a removed page");
});

test("a client's status line opens the presented version in the gallery", async () => {
  const state = { ...SCENE_STATE, stage: "Production review", waitingOn: "the client", currentArtboardVersion: 2 };
  const page = scenePage({ user: CLIENT, state, questions: [] });
  await page.settle();
  const markup = page.markup();

  const href = markup.match(/href="([^"]*reviews\.html[^"]*)"/);
  assert.ok(href, "the client has no way through to the work");
  assert.match(href[1], /version=2/, "the client is not sent to the presented version");
  assert.doesNotMatch(markup, /client-review\.html/, "the client is still sent to the removed page");
});
