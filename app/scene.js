import { ACCOUNT_ID, TOUR_ID, scopedBody } from "./context.js";

// One Scene page, read by everyone who can open it.
//
// The page answers the question a person came with. Sarah arrives from Home
// because Higher Roads asked her something, or she taps the Scene to check on
// it. So the page is the open question with its answer box, one line saying
// where the Scene stands, and the request in the words it was asked in.
// Answering is something both sides do, so it sits on the page.
//
// Everything Higher Roads does about the Scene rather than in it lives in a
// drawer that slides over the page. Clients never get the drawer, and the
// server never sends them what is in it.
//
// Attaching a reference image happens where the asking happens, on the request
// screen. The page shows what is attached; it takes no upload.

const PARAMS = new URLSearchParams(window.location.search);

const locationBar = document.getElementById("location");
const root = document.getElementById("scene");
let drawer = document.getElementById("scene-drawer");
let drawerBody = document.getElementById("scene-drawer-body");

const view = {
  sceneId: PARAMS.get("scene") || null,
  user: null,
  tour: null,
  assignment: null,
  state: null,
  context: null,
  references: [],
  concept: null,
  questions: [],
  brief: null,
  briefs: [],
  handoffs: [],
  artboards: [],
  receipt: null,
  draft: { direction: "", question: "", answers: {} },
  message: "",
  // Which part of the page the message belongs beside. A message about
  // answering belongs next to the exchange. A message about asking belongs in
  // the drawer next to the box that asked. Empty is the operator's general
  // slot at the top of the drawer.
  messageAt: "",
  working: false,
};

function isOperator() {
  return Boolean(view.user && view.user.role === "higher-roads");
}

async function call(action, extra = {}) {
  let response;
  try {
    response = await fetch("/api/tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, ...extra })),
    });
  } catch (error) {
    // The browser reports a cut connection as a TypeError with no detail.
    if (error instanceof TypeError) {
      throw new Error("The connection dropped. Try that again.");
    }
    throw error;
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphs(text) {
  return String(text || "").split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p class="m-copy">${escape(block)}</p>`)
    .join("");
}

// A date a person would say out loud. A value that does not read as a date is
// shown exactly as it was stored, because a guessed date is worse than the
// text somebody typed.
function readableDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// The Reviews gallery, opened on one version of one Scene. Everything the old
// review pages carried lives in the gallery's drawer.
function reviewHref(artboardVersion) {
  return `./reviews.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}&amp;version=${escape(artboardVersion)}`;
}

function openQuestions() {
  return view.questions.filter((entry) => !entry.answer);
}

function answeredQuestions() {
  return view.questions.filter((entry) => entry.answer);
}

function latestArtboardVersion() {
  const current = view.artboards.at(-1);
  if (current && current.artboard && current.artboard.artboardVersion) return current.artboard.artboardVersion;
  return (view.state || {}).currentArtboardVersion || null;
}

// ---------------------------------------------------------------------------
// Questions. A question, an answer, and who said each. Answering is shared, so
// it sits on the page for whoever can do it.
// ---------------------------------------------------------------------------

function answerBox(entry) {
  return `<div class="m-field">
      <label class="m-label" for="answer-${escape(entry.id)}">Your answer</label>
      <textarea class="m-textarea" id="answer-${escape(entry.id)}" data-answer="${escape(entry.id)}">${escape(view.draft.answers[entry.id] || "")}</textarea>
      <button class="m-button m-button--primary" type="button" data-send-answer="${escape(entry.id)}">Send answer</button>
    </div>`;
}

function questionRow(entry) {
  const asked = readableDate(entry.askedAt);
  const answered = entry.answer
    ? `<div class="m-contribution">
        <span class="m-contribution__source">${escape(entry.answeredBy)}, ${escape(readableDate(entry.answeredAt))}</span>
        <p class="m-copy">${escape(entry.answer)}</p>
      </div>`
    : isOperator()
      ? `<p class="m-meta">WAITING ON THE CLIENT</p>`
      : answerBox(entry);
  return `<article class="m-contribution">
      <span class="m-contribution__source">${escape(entry.askedBy)}${asked ? `, ${escape(asked)}` : ""}</span>
      <p class="m-copy">${escape(entry.text)}</p>
      ${answered}
    </article>`;
}

function questionMessage() {
  return view.messageAt === "questions" && view.message
    ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>`
    : "";
}

// The question is the reason anybody is here, so it is the first thing on the
// page with the box already open under it. Answered ones stay below so the
// exchange is still readable with both names on it.
function questionsSection() {
  if (!view.questions.length) return "";
  const open = openQuestions().map(questionRow).join("");
  const done = answeredQuestions().map(questionRow).join("");
  const heading = isOperator()
    ? (open.length ? "You asked the client something" : "What you asked the client")
    : (open.length ? "Higher Roads asked you something" : "What Higher Roads asked you");
  return `<section class="m-scene-source" aria-labelledby="client-questions-heading">
      <div class="m-scene-source__head">
        <h2 id="client-questions-heading" class="m-scene-work-heading">${heading}</h2>
      </div>
      <div class="m-stack">${open}${questionMessage()}${done}</div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Where the Scene stands. One line answering "do I need to do anything",
// written to whoever is reading it.
// ---------------------------------------------------------------------------

function clientStatus() {
  const state = view.state || {};
  const stage = state.stage;
  if (openQuestions().length) {
    return { line: "Answer the question above when you can. Nothing else is needed from you.", link: null };
  }
  if (stage === "Production review" && state.waitingOn === "the client") {
    return {
      line: "New work is ready for you to look at.",
      link: reviewHref(state.currentArtboardVersion),
      linkLabel: "Look at the work",
    };
  }
  if (stage === "Delivered") return { line: "This Scene has been delivered. Nothing is needed from you.", link: null };
  if (stage === "Final approved") return { line: "You approved this Scene. The media team is finishing it. Nothing is needed from you.", link: null };
  if (stage === "Production review") return { line: "Higher Roads is looking at the work that came back. Nothing is needed from you.", link: null };
  if (stage === "Approved for production") return { line: "The media team is building this Scene. Nothing is needed from you.", link: null };
  if (stage === "Concept review") return { line: "Higher Roads is getting this Scene ready for the media team. Nothing is needed from you.", link: null };
  if (stage === "Draft request") return { line: "This request has not been sent yet.", link: null };
  return { line: "Higher Roads is developing this Scene. Nothing is needed from you.", link: null };
}

// Work that came back is the thing an operator has to act on, so it takes the
// line. Otherwise the next step is the one Home already reads from the tour, so
// the line here and the line there agree.
function operatorStatus() {
  const state = view.state || {};
  const artboardVersion = latestArtboardVersion();
  if (view.artboards.length && artboardVersion) {
    return {
      line: `Artboard V0${artboardVersion} is ready for review.`,
      link: reviewHref(artboardVersion),
      linkLabel: `Review Artboard V0${artboardVersion}`,
    };
  }
  if (state.nextAction) return { line: state.nextAction, link: null };
  return { line: "Higher Roads is developing this Scene.", link: null };
}

function statusSection() {
  const status = isOperator() ? operatorStatus() : clientStatus();
  return `<section class="m-scene-source" aria-labelledby="scene-status-heading">
      <h2 id="scene-status-heading" class="m-scene-work-heading">Where this Scene stands</h2>
      <p class="m-copy m-copy--large">${escape(status.line)}</p>
      ${status.link ? `<a class="m-button m-button--primary" href="${status.link}">${escape(status.linkLabel)}</a>` : ""}
    </section>`;
}

// ---------------------------------------------------------------------------
// What was asked for, in the words it was asked in.
// ---------------------------------------------------------------------------

function attachedReferences() {
  const items = view.references || [];
  if (!items.length) return "";
  const rows = items.map((entry) => (
    `<li class="m-copy">${escape(entry.filename || "Reference")}</li>`
  )).join("");
  return `<div class="m-stack"><span class="m-label">Attached</span><ul>${rows}</ul></div>`;
}

function requestSection() {
  const assignment = view.assignment;
  const who = assignment.requestedBy ? escape(assignment.requestedBy) : "You";
  const when = readableDate(assignment.requestedOn);
  const heading = isOperator() ? "What the client asked for" : "What you asked for";
  const required = (assignment.requiredElements || [])
    .map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
  return `<section class="m-scene-source" aria-labelledby="what-you-asked-heading">
      <div class="m-scene-source__head">
        <h2 id="what-you-asked-heading" class="m-scene-work-heading">${heading}</h2>
        <span class="m-meta">${who}${when ? `, ${escape(when)}` : ""}</span>
      </div>
      <div class="m-scene-source__copy">${paragraphs(assignment.request)}</div>
      ${required ? `<div class="m-scene-required"><span class="m-label">Must include</span><ul>${required}</ul></div>` : ""}
      ${attachedReferences()}
    </section>`;
}

function page() {
  // The operator's general messages live at the top of the drawer. A client has
  // no drawer, so anything that reaches them shows above the work.
  const notice = !isOperator() && view.message && !view.messageAt
    ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>`
    : "";
  // No page title. The breadcrumb already names the Scene, and anything above
  // the question pushes the answer box off the first screen on a phone.
  return `<section class="m-direction-editor" aria-label="Scene">
      <div class="m-direction-editor__body">
        ${notice}
        ${questionsSection()}
        ${statusSection()}
        ${requestSection()}
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// The drawer. Higher Roads only, in the order of the decision: the facts, the
// note, the question, the send.
// ---------------------------------------------------------------------------

function dateRows() {
  const dates = (view.tour && view.tour.dates) || [];
  if (!dates.length) {
    return `<div class="m-empty-inline m-empty-inline--waiting"><span class="m-label">No dates yet</span><p class="m-copy">Dates and venues are added on the tour page.</p></div>`;
  }
  const rows = dates.map((entry) => {
    const place = entry.place ? `, ${escape(entry.place)}` : "";
    return `<li class="m-copy"><strong>${escape(entry.venue || "Venue not named")}</strong>${place}<span class="m-meta"> ${escape(entry.date || "Date not named")}</span></li>`;
  }).join("");
  return `<ul>${rows}</ul>`;
}

function rigRows() {
  const setup = view.context.productionSetup;
  const exceptions = view.context.venueExceptions || [];
  const setupCopy = setup && setup.words
    ? paragraphs(setup.words)
    : `<div class="m-empty-inline"><span class="m-label">No production setup yet</span><p class="m-copy">Confirmed playback and screen details are added on the tour page.</p></div>`;
  const rows = exceptions.map((entry) => (
    `<li class="m-copy"><strong>${escape(entry.venue)}</strong>, ${escape(entry.date)}. ${escape(entry.text)}</li>`
  )).join("");
  const differing = rows
    ? `<div class="m-stack"><span class="m-label">Dates where the rig differs</span><ul>${rows}</ul></div>`
    : setup && setup.words
      ? `<div class="m-empty-inline m-empty-inline--clear"><span class="m-label">Standard setup</span><p class="m-copy">No date on this tour was recorded as differing from the setup above.</p></div>`
      : "";
  return `${setupCopy}${differing}`;
}

function venuesWork() {
  const setupVersion = view.context.setupVersion ? ` V0${escape(view.context.setupVersion)}` : "";
  return `<section class="m-scene-source" aria-labelledby="venues-heading">
      <div class="m-scene-source__head">
        <h2 id="venues-heading" class="m-scene-work-heading">Venues and screens</h2>
        <span class="m-meta">SETUP${setupVersion}</span>
      </div>
      <div class="m-stack">
        ${dateRows()}
        ${rigRows()}
      </div>
    </section>`;
}

function noteWork() {
  return `<div class="m-stack">
      <div class="m-field">
        <label class="m-label" for="scene-direction">Note for production, optional</label>
        <textarea class="m-textarea m-textarea--note" id="scene-direction" data-draft="direction" placeholder="Anything worth remembering before this goes to production.">${escape(view.draft.direction)}</textarea>
      </div>
      <div class="m-direction-editor__meta">
        <span>Written by Higher Roads</span>
        <span>Against Tour Direction V0${escape(view.assignment.directionVersion)}</span>
      </div>
    </div>`;
}

function askWork() {
  return `<section class="m-scene-source" aria-labelledby="ask-heading">
      <div class="m-scene-source__head">
        <h2 id="ask-heading" class="m-scene-work-heading">Ask the client a question</h2>
      </div>
      <div class="m-stack">
        <div class="m-field">
          <label class="m-label" for="scene-question">Your question</label>
          <textarea class="m-textarea" id="scene-question" data-draft="question" placeholder="What do you need from them before this goes to production?">${escape(view.draft.question)}</textarea>
          <button class="m-button" type="button" data-ask ${view.working ? "disabled" : ""}>${view.working ? "Sending" : "Ask the client"}</button>
        </div>
        ${view.messageAt === "ask" && view.message ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
      </div>
    </section>`;
}

// The brief here is a read, not a decision. Compiling is free, and reading the
// compiled brief is how a person decides whether to send it. Once a version is
// frozen, the frozen one is what shows.
function briefSection() {
  if (!view.brief) return "";
  const brief = view.brief.brief;
  const state = brief.status === "frozen" ? "m-state m-state--approved" : "m-state m-state--current";
  const stateText = brief.status === "frozen" ? `Brief V0${brief.briefVersion} frozen` : `Brief V0${brief.briefVersion} draft`;
  return `<details class="m-disclosure m-brief-disclosure">
      <summary>
        <span class="m-label">View compiled brief</span>
        <span class="${state}">${escape(stateText)}</span>
      </summary>
      <div class="m-disclosure__body m-stack">
        <div class="m-cluster">
          <button class="m-button m-button--small" type="button" data-download="document">Download document</button>
          <button class="m-button m-button--small" type="button" data-download="sidecar">Download machine readable file</button>
        </div>
        <pre>${escape(view.brief.document)}</pre>
      </div>
    </details>`;
}

function receiptSection() {
  if (!view.receipt) return "";
  return `<div class="m-callout m-callout--current">
      <span class="m-label">Received by production</span>
      <p class="m-copy">Job ${escape(view.receipt.jobId)}, brief V0${escape(view.receipt.briefVersion)}, at ${escape(view.receipt.receivedAt)}.</p>
      <p class="m-meta">${escape(String(view.receipt.label || "").toUpperCase())}</p>
    </div>`;
}

// One judgement is made here: this is right, send it.
function sendWork() {
  if (view.artboards.length > 0) return "";
  const latestBrief = view.briefs.at(-1);
  const handoff = latestBrief && view.handoffs.find((entry) => entry.kind === "brief" && entry.briefVersion === latestBrief.briefVersion);
  let context;
  let controls;
  if (handoff) {
    context = `Brief V0${latestBrief.briefVersion} is with production. The work comes back through the same handoff.`;
    controls = `<a class="m-button m-button--primary" href="./handoff.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}&amp;brief=${escape(latestBrief.briefVersion)}">Open handoff</a>`;
  } else if (latestBrief) {
    context = `Brief V0${latestBrief.briefVersion} is frozen. Send it to production.`;
    controls = `<button class="m-button m-button--primary" type="button" data-send>Send to production</button>`;
  } else if (view.concept) {
    context = "Read the compiled brief, then send it to production.";
    controls = `<button class="m-button" type="button" data-save>Save note</button>
      <button class="m-button m-button--primary" type="button" data-send>Send to production</button>`;
  } else {
    context = "Save the Scene before sending it to production.";
    controls = `<button class="m-button m-button--primary" type="button" data-save>Save note</button>`;
  }
  return `<section class="m-stack" aria-labelledby="send-heading">
      <h2 id="send-heading" class="m-scene-work-heading">Send to production</h2>
      ${briefSection()}
      ${receiptSection()}
      <p class="m-action-bar__context">${escape(context)}</p>
      <div class="m-action-bar__actions">${controls}</div>
    </section>`;
}

// The drawer is fixed to the viewport whether it is open or closed, so the page
// underneath keeps its full width and never reflows when the drawer moves.
// There is no overlay drawer in app/design/ and builders do not edit that
// folder, so the frame is set here from tokens, the way the Reviews viewer sets
// its own.
const DRAWER_FRAME = {
  position: "fixed",
  right: "0",
  zIndex: "40",
  background: "var(--m-gradient-sidecar)",
  borderLeft: "var(--m-rule-width) solid var(--m-border-strong)",
  boxShadow: "0 0 var(--m-space-7) var(--m-shadow-floating)",
};

const DRAWER_OPEN = { top: "0", bottom: "0", width: "min(26rem, 100vw)", overflowY: "auto", padding: "0 var(--m-space-5) var(--m-space-6)" };
const DRAWER_SHUT = { top: "auto", bottom: "0", width: "auto", overflowY: "visible", padding: "0 var(--m-space-5)" };

function frameDrawer() {
  if (!drawer || !drawer.style) return;
  Object.assign(drawer.style, DRAWER_FRAME, drawer.open ? DRAWER_OPEN : DRAWER_SHUT);
}

function renderDrawer() {
  if (!drawer) return;
  if (!isOperator()) {
    // A client is never handed the trigger, and the server never sends them
    // what is behind it.
    if (drawer.remove) drawer.remove();
    drawer = null;
    drawerBody = null;
    return;
  }
  frameDrawer();
  if (!drawerBody) return;
  const notice = view.message && !view.messageAt
    ? `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>`
    : "";
  drawerBody.innerHTML = `<div class="m-stack">
      ${notice}
      ${venuesWork()}
      ${noteWork()}
      ${askWork()}
      ${sendWork()}
    </div>`;
}

function download(kind) {
  const brief = view.brief.brief;
  const tail = brief.status === "frozen" ? "" : "-draft";
  const name = `${brief.jobId}-v${brief.briefVersion}${tail}`;
  const body = kind === "sidecar" ? JSON.stringify(view.brief.sidecar, null, 2) : view.brief.document;
  const type = kind === "sidecar" ? "application/json" : "text/markdown";
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = kind === "sidecar" ? `${name}.json` : `${name}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render() {
  const assignment = view.assignment;
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <a href="./scenes.html?tour=${escape(TOUR_ID)}">Scenes</a>
      <span aria-hidden="true">/</span>
      <span class="m-breadcrumb__current">${escape(assignment.title)}</span>
    </nav>`;
  root.innerHTML = `<section class="m-workstation__stage" aria-label="Scene workspace">
      <div class="m-workstation__canvas">
        ${page()}
      </div>
    </section>`;
  renderDrawer();
}

async function readBrief() {
  if (!isOperator()) return null;
  const frozen = view.briefs.filter((entry) => entry.status === "frozen").at(-1);
  try {
    return frozen
      ? await call("get-brief", { assignmentId: view.sceneId, briefVersion: frozen.briefVersion })
      : (view.concept ? await call("compile-brief", { assignmentId: view.sceneId }) : null);
  } catch {
    return null;
  }
}

async function load() {
  try {
    view.user = (await call("get-me")).user;
  } catch {
    view.user = { role: "higher-roads", displayName: "Higher Roads" };
  }
  const { tour, assignments } = await call("get-tour");
  view.tour = tour;
  if (!view.sceneId && assignments.length) view.sceneId = assignments[0].id;
  // Where the Scene has got to, read from the same place Home reads it, so the
  // line a person sees here and the line they saw on Home agree.
  view.state = assignments.find((entry) => entry.id === view.sceneId) || null;
  const context = isOperator()
    ? await call("assignment-context", { assignmentId: view.sceneId })
    : await call("get-scene-workspace", { assignmentId: view.sceneId });
  view.assignment = context.assignment;
  refreshReferences().then(() => { try { render(); } catch (_) {} });
  view.context = context.context;
  view.concept = isOperator()
    ? (await call("get-concept", { assignmentId: view.sceneId })).concept
    : context.concept;
  try {
    view.questions = (await call("get-questions", { assignmentId: view.sceneId })).questions;
  } catch {
    view.questions = [];
  }
  render();
  if (!isOperator()) return;
  view.briefs = (await call("list-briefs", { assignmentId: view.sceneId })).briefs;
  try {
    view.handoffs = (await call("get-handoffs", { assignmentId: view.sceneId })).handoffs;
  } catch {
    view.handoffs = [];
  }
  try {
    view.artboards = (await call("get-artboards", { assignmentId: view.sceneId })).artboards;
  } catch {
    view.artboards = [];
  }
  view.brief = await readBrief();
  if (view.concept) {
    // A Scene saved with no note carries the request in its place. The note box
    // stays empty in that case, because nobody wrote a note.
    const request = String(view.assignment.request || "").trim();
    view.draft.direction = view.concept.idea === request ? "" : view.concept.idea;
  }
  render();
}

async function guard(work, where = "") {
  try {
    await work();
  } catch (error) {
    view.working = false;
    view.message = error.message;
    view.messageAt = where;
    try {
      render();
    } catch {
      root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
    }
  }
}

async function save() {
  const concept = {
    title: view.assignment.title,
    idea: view.draft.direction.trim(),
    cameFrom: "written by Higher Roads",
  };
  view.concept = (await call("choose-concept", { assignmentId: view.sceneId, concept })).concept;
  view.brief = await readBrief();
  view.message = "Saved.";
  view.messageAt = "";
  render();
}

async function reloadQuestions() {
  view.questions = (await call("get-questions", { assignmentId: view.sceneId })).questions;
}

// Only the drawer's own frame changes when it opens. The page underneath is not
// re-rendered and not re-measured, so it cannot move.
if (drawer && drawer.addEventListener) drawer.addEventListener("toggle", frameDrawer);

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-ask")) {
    guard(async () => {
      view.working = true;
      view.message = "";
      view.messageAt = "ask";
      render();
      await call("ask-question", { assignmentId: view.sceneId, text: view.draft.question });
      await reloadQuestions();
      view.working = false;
      view.draft.question = "";
      view.message = "The client will see this on their home page.";
      view.messageAt = "ask";
      render();
    }, "ask");
    return;
  }
  if (target.dataset.sendAnswer !== undefined) {
    const questionId = target.dataset.sendAnswer;
    guard(async () => {
      await call("answer-question", {
        assignmentId: view.sceneId,
        questionId,
        text: view.draft.answers[questionId] || "",
      });
      await reloadQuestions();
      delete view.draft.answers[questionId];
      view.message = "Thanks. Higher Roads has your answer.";
      view.messageAt = "questions";
      render();
    }, "questions");
    return;
  }
  if (target.hasAttribute("data-save")) {
    guard(save);
    return;
  }
  if (target.hasAttribute("data-send")) {
    guard(async () => {
      const sent = await call("send-to-production", { assignmentId: view.sceneId });
      view.brief = { brief: sent.brief, document: sent.document, sidecar: sent.sidecar };
      view.briefs = (await call("list-briefs", { assignmentId: view.sceneId })).briefs;
      view.handoffs = (await call("get-handoffs", { assignmentId: view.sceneId })).handoffs;
      view.message = `Brief V0${sent.brief.briefVersion} is with production.`;
      view.messageAt = "";
      render();
    });
    return;
  }
  if (target.dataset.download) download(target.dataset.download);
});

// The draft lives in the page until someone saves it, so a redraw never loses
// what a person typed.
document.addEventListener("input", (event) => {
  const field = event.target;
  if (!field.dataset) return;
  if (field.dataset.draft === "direction") view.draft.direction = field.value;
  if (field.dataset.draft === "question") view.draft.question = field.value;
  if (field.dataset.answer !== undefined) view.draft.answers[field.dataset.answer] = field.value;
});

// What the client attached when they asked. Read only on this page; attaching
// happens on the request screen, where the asking happens.
async function refreshReferences() {
  try {
    const response = await fetch("/api/tour-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: ACCOUNT_ID, tourId: TOUR_ID, assignmentId: view.sceneId, mode: "reference-list" }) });
    if (!response.ok) return;
    const data = await response.json();
    view.references = data.references || [];
  } catch (_error) {
    // A page in a test harness or a failing network never blocks load.
  }
}

guard(load);
