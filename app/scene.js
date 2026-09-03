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
  // Whether production answered. Sending is ours and delivery is theirs, and
  // the send section says which of the two has happened.
  acknowledged: false,
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

// The sentence itself comes from the server, written to whoever is signed in.
// The page adds the two things only the page knows: an open question outranks
// the stage, because the answer box above is already the thing to do, and work
// that is ready for her carries the way through to it.
function clientStatus() {
  const state = view.state || {};
  if (openQuestions().length) {
    return { line: "Answer the question above when you can. Nothing else is needed from you.", link: null };
  }
  const line = state.nextAction || "Higher Roads is developing this Scene. Nothing is needed from you.";
  if (state.stage === "Production review" && state.waitingOn === "the client") {
    return { line, link: reviewHref(state.currentArtboardVersion), linkLabel: "Look at the work" };
  }
  return { line, link: null };
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
// The drawer. Higher Roads only. Each job carries its field, action, result,
// and the context that informs it.
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
  return `<section class="m-drawer__reference" aria-labelledby="venues-heading">
      <h3 id="venues-heading" class="m-label">Venues and screens</h3>
      <div class="m-stack">
        ${dateRows()}
        ${rigRows()}
      </div>
    </section>`;
}

function noteWork() {
  return `<div class="m-field">
      <label class="m-label" for="scene-direction">Note for production, optional</label>
      <textarea class="m-textarea m-textarea--note" id="scene-direction" data-draft="direction" placeholder="Anything production should know.">${escape(view.draft.direction)}</textarea>
    </div>`;
}

function askWork() {
  return `<section class="m-drawer__action" aria-labelledby="ask-heading">
      <h2 id="ask-heading" class="m-drawer__title">Ask the client</h2>
      <div class="m-field">
        <label class="m-label" for="scene-question">Your question</label>
        <textarea class="m-textarea" id="scene-question" data-draft="question" placeholder="What do you need from them?">${escape(view.draft.question)}</textarea>
      </div>
      <div class="m-drawer__actions"><button class="m-button" type="button" data-ask ${view.working ? "disabled" : ""}>${view.working ? "Sending" : "Ask the client"}</button></div>
      ${view.messageAt === "ask" && view.message ? `<div class="m-drawer__result"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
    </section>`;
}

// The brief is supporting context for the send, not a separate drawer job.
function briefSection() {
  if (!view.brief) return "";
  return `<section class="m-drawer__reference" aria-labelledby="brief-heading">
      <h3 id="brief-heading" class="m-label">Brief</h3>
      <div class="m-stack">
        <div class="m-cluster">
          <button class="m-button m-button--small" type="button" data-download="document">Download document</button>
          <button class="m-button m-button--small" type="button" data-download="sidecar">Download machine readable file</button>
        </div>
        <pre>${escape(view.brief.document)}</pre>
      </div>
    </section>`;
}

function receiptSection() {
  if (!view.receipt) return "";
  return `<div class="m-drawer__result">
      <span class="m-label">Received by production</span>
      <p class="m-copy">Received ${escape(view.receipt.receivedAt)}.</p>
    </div>`;
}

// One judgement is made here: this is right, send it. After it goes, the
// section says which of two things has happened. The brief left Meridian, which
// is ours and certain. Production confirmed it has the brief, which is theirs
// and only true when they have answered. Pressing send again is the whole
// retry: production answers a repeat against the same job as a duplicate, so it
// costs nothing to press.
function sendWork() {
  if (view.artboards.length > 0) return "";
  const latestBrief = view.briefs.at(-1);
  const handoff = latestBrief && view.handoffs.find((entry) => entry.kind === "brief" && entry.briefVersion === latestBrief.briefVersion);
  const openHandoff = latestBrief
    ? `<a class="m-button" href="./handoff.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}&amp;brief=${escape(latestBrief.briefVersion)}">Open handoff</a>`
    : "";
  let standing = "";
  let controls;
  if (handoff && view.acknowledged) {
    standing = `<div class="m-drawer__result"><p class="m-copy">Production has the Scene.</p></div>`;
    controls = `<a class="m-button m-button--primary" href="./handoff.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}&amp;brief=${escape(latestBrief.briefVersion)}">Open handoff</a>`;
  } else if (handoff) {
    standing = `<div class="m-drawer__result"><p class="m-copy">The brief went out. Production has not confirmed it.</p></div>`;
    controls = `<button class="m-button m-button--primary" type="button" data-send ${view.working ? "disabled" : ""}>${view.working ? "Sending" : "Send again"}</button>${openHandoff}`;
  } else {
    controls = `<button class="m-button m-button--primary" type="button" data-send ${view.working ? "disabled" : ""}>${view.working ? "Sending" : "Send to production"}</button>`;
  }
  return `<section class="m-drawer__action" aria-labelledby="send-heading">
      <h2 id="send-heading" class="m-drawer__title">Send to production</h2>
      ${handoff ? "" : noteWork()}
      ${receiptSection()}
      ${standing}
      ${view.messageAt === "send" && view.message ? `<div class="m-drawer__result"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
      <div class="m-drawer__actions">${controls}</div>
      <details class="m-drawer__context">
        <summary>Review before sending</summary>
        <div class="m-drawer__context-body">
          ${briefSection()}
          ${venuesWork()}
        </div>
      </details>
    </section>`;
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
  drawer.hidden = false;
  if (!drawerBody) return;
  drawerBody.innerHTML = `<div class="m-drawer__stack">
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
  // Who is reading decides what this page draws, so the page never guesses.
  // A failure here reaches the reader as a message rather than as an operator
  // page drawn for somebody who might be a client.
  view.user = (await call("get-me")).user;
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
    const issued = await call("get-handoffs", { assignmentId: view.sceneId });
    view.handoffs = issued.handoffs;
    view.acknowledged = Boolean(issued.acknowledged);
  } catch {
    view.handoffs = [];
    view.acknowledged = false;
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

async function reloadQuestions() {
  view.questions = (await call("get-questions", { assignmentId: view.sceneId })).questions;
}

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
  if (target.hasAttribute("data-send")) {
    guard(async () => {
      view.working = true;
      view.message = "";
      view.messageAt = "send";
      render();
      if (!view.concept || view.concept.idea !== view.draft.direction.trim()) {
        const concept = {
          title: view.assignment.title,
          idea: view.draft.direction.trim(),
          cameFrom: "written by Higher Roads",
        };
        view.concept = (await call("choose-concept", { assignmentId: view.sceneId, concept })).concept;
      }
      const sent = await call("send-to-production", { assignmentId: view.sceneId });
      view.brief = { brief: sent.brief, document: sent.document, sidecar: sent.sidecar };
      view.briefs = (await call("list-briefs", { assignmentId: view.sceneId })).briefs;
      const issued = await call("get-handoffs", { assignmentId: view.sceneId });
      view.handoffs = issued.handoffs;
      view.acknowledged = Boolean(issued.acknowledged);
      view.working = false;
      // The section now says which of the two happened, so a message here would
      // say it a second time.
      view.message = "";
      view.messageAt = "send";
      render();
    }, "send");
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
