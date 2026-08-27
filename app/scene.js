import { ACCOUNT_ID, TOUR_ID, scopedBody } from "./context.js";

// A Scene, read two ways.
//
// A client opens a Scene for one reason: Higher Roads asked her something and
// Home sent her here. So she gets the question first, an answer box under it,
// one line telling her whether anything else needs her, and her own request as
// a quiet reference. Nothing else on this page is her job.
//
// A Higher Roads person opens a Scene to decide what to do with a request:
// read it, check it against what the venues can take, jot a reminder, then ask
// the client something or send it to production.
//
// Attaching a reference image happens where the asking happens, on the request
// screen. Both views show what is attached; neither takes an upload.

const PARAMS = new URLSearchParams(window.location.search);

const locationBar = document.getElementById("location");
const root = document.getElementById("scene");
const actions = document.getElementById("actions");

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
  // Which part of the page the message belongs beside. Empty means the top of
  // the page. A message about a question belongs next to the box that asked
  // it, where the person is looking.
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

// ---------------------------------------------------------------------------
// Questions. A question, an answer, and who said each.
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

// ---------------------------------------------------------------------------
// The client's Scene
// ---------------------------------------------------------------------------

// The question is the reason she is here, so it is the first thing on the page
// with the box already open under it. Answered ones stay below it so the
// exchange is still readable with both names on it.
function clientQuestions() {
  if (!view.questions.length) return "";
  const open = openQuestions().map(questionRow).join("");
  const done = answeredQuestions().map(questionRow).join("");
  const heading = open.length
    ? "Higher Roads asked you something"
    : "What Higher Roads asked you";
  return `<section class="m-scene-source" aria-labelledby="client-questions-heading">
      <div class="m-scene-source__head">
        <h2 id="client-questions-heading" class="m-scene-work-heading">${heading}</h2>
      </div>
      <div class="m-stack">${open}${questionMessage()}${done}</div>
    </section>`;
}

// One line saying whether anything needs her, in words she would use. No
// version numbers and no system words.
function clientStatus() {
  const state = view.state || {};
  const stage = state.stage;
  if (openQuestions().length) {
    return { line: "Answer the question above when you can. Nothing else is needed from you.", link: null };
  }
  if (stage === "Production review" && state.waitingOn === "the client") {
    return {
      line: "New work is ready for you to look at.",
      link: reviewHref((view.state || {}).currentArtboardVersion),
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

function clientStatusSection() {
  const status = clientStatus();
  return `<section class="m-scene-source" aria-labelledby="scene-status-heading">
      <h2 id="scene-status-heading" class="m-scene-work-heading">Where this Scene stands</h2>
      <p class="m-copy m-copy--large">${escape(status.line)}</p>
      ${status.link ? `<a class="m-button m-button--primary" href="${status.link}">Look at the work</a>` : ""}
    </section>`;
}

function attachedReferences() {
  const items = view.references || [];
  if (!items.length) return "";
  const rows = items.map((entry) => (
    `<li class="m-copy">${escape(entry.filename || "Reference")}</li>`
  )).join("");
  return `<div class="m-stack"><span class="m-label">Attached</span><ul>${rows}</ul></div>`;
}

// Her own words, quietly, so she can see what she asked for without going
// looking for it. The page is talking to her, so it says "you".
function clientRequest() {
  const assignment = view.assignment;
  const who = assignment.requestedBy ? escape(assignment.requestedBy) : "You";
  const when = readableDate(assignment.requestedOn);
  const required = (assignment.requiredElements || [])
    .map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
  return `<section class="m-scene-source" aria-labelledby="what-you-asked-heading">
      <div class="m-scene-source__head">
        <h2 id="what-you-asked-heading" class="m-scene-work-heading">What you asked for</h2>
        <span class="m-meta">${who}${when ? `, ${escape(when)}` : ""}</span>
      </div>
      <div class="m-scene-source__copy">${paragraphs(assignment.request)}</div>
      ${required ? `<div class="m-scene-required"><span class="m-label">Must include</span><ul>${required}</ul></div>` : ""}
      ${attachedReferences()}
    </section>`;
}

function clientPage() {
  return `<section class="m-direction-editor" aria-label="Scene">
      <div class="m-direction-editor__body">
        ${clientQuestions()}
        ${clientStatusSection()}
        ${clientRequest()}
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// The Higher Roads Scene
// ---------------------------------------------------------------------------

// The request at full weight, with what the client attached and anything
// already asked and answered about it. All of that is part of what was asked
// for, so it reads as one block.
function requestWork() {
  const assignment = view.assignment;
  const required = (assignment.requiredElements || [])
    .map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
  const when = readableDate(assignment.requestedOn);
  const exchange = view.questions.length
    ? `<div class="m-stack"><span class="m-label">Asked about this request</span>${view.questions.map(questionRow).join("")}</div>`
    : "";
  return `<section class="m-scene-source" aria-labelledby="client-request-heading">
      <div class="m-scene-source__head">
        <h2 id="client-request-heading" class="m-scene-work-heading">Client request</h2>
        <span class="m-meta">FROM ${escape(String(assignment.requestedBy || "CLIENT TEAM").toUpperCase())}${when ? `, ${escape(when)}` : ""}</span>
      </div>
      <div class="m-scene-source__copy">${paragraphs(assignment.request)}</div>
      ${required ? `<div class="m-scene-required"><span class="m-label">Required</span><ul>${required}</ul></div>` : ""}
      ${attachedReferences()}
      ${exchange}
    </section>`;
}

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
        ${questionMessage()}
      </div>
    </section>`;
}

function operatorPage() {
  return `<section class="m-direction-editor" aria-labelledby="scene-heading">
      <div class="m-direction-editor__header">
        <span class="m-label m-direction-editor__label">Scene${view.assignment.moment ? ` / ${escape(view.assignment.moment)}` : ""}</span>
        <h1 id="scene-heading" class="m-direction-editor__title">${escape(view.assignment.title)}</h1>
      </div>
      <div class="m-direction-editor__body">
        ${view.message && !view.messageAt ? `<div class="m-callout m-callout--current m-direction-editor__notice"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
        ${requestWork()}
        ${venuesWork()}
        <div class="m-field">
          <label class="m-label" for="scene-direction">Note for production, optional</label>
          <textarea class="m-textarea m-textarea--note" id="scene-direction" data-draft="direction" placeholder="Anything worth remembering before this goes to production.">${escape(view.draft.direction)}</textarea>
        </div>
        <div class="m-direction-editor__meta">
          <span>Written by Higher Roads</span>
          <span>Against Tour Direction V0${escape(view.assignment.directionVersion)}</span>
        </div>
        ${briefSection()}
        ${receiptSection()}
        ${askWork()}
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// The brief
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// The receipt. What came back and the record of what happened live on review.
// ---------------------------------------------------------------------------

function receiptSection() {
  if (!view.receipt) return "";
  return `<div class="m-callout m-callout--current">
      <span class="m-label">Received by production</span>
      <p class="m-copy">Job ${escape(view.receipt.jobId)}, brief V0${escape(view.receipt.briefVersion)}, at ${escape(view.receipt.receivedAt)}.</p>
      <p class="m-meta">${escape(String(view.receipt.label || "").toUpperCase())}</p>
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

// One judgement is made here: this is right, send it. The client has no action
// bar on this page, because answering is the only thing she came to do and the
// box for it is at the top.
function actionBar() {
  if (!isOperator() || view.artboards.length > 0) {
    actions.innerHTML = "";
    return;
  }
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
  actions.innerHTML = `<p class="m-action-bar__context">${escape(context)}</p>
    <div class="m-action-bar__actions">${controls}</div>`;
}

function reviewNotice() {
  if (!isOperator() || !view.artboards.length) return "";
  const current = view.artboards.at(-1);
  const value = current && current.artboard ? current.artboard.artboardVersion : null;
  if (!value) return "";
  return `<section class="m-workstation-notice" aria-labelledby="artboard-ready-heading">
      <div class="m-stack">
        <h2 id="artboard-ready-heading" class="m-scene-work-heading">Artboard V0${escape(value)} is ready for review</h2>
        <p class="m-copy">Compare it with the production brief and decide whether it is ready for the client.</p>
      </div>
      <a class="m-button m-button--primary" href="${reviewHref(value)}">Review Artboard V0${escape(value)}</a>
    </section>`;
}

function render() {
  const assignment = view.assignment;
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <a href="./scenes.html?tour=${escape(TOUR_ID)}">Scenes</a>
      <span aria-hidden="true">/</span>
      <span class="m-breadcrumb__current">${escape(assignment.title)}</span>
    </nav>`;
  root.innerHTML = `${reviewNotice()}<section class="m-workstation__stage" aria-label="Scene workspace">
      <div class="m-workstation__canvas">
        ${isOperator() ? operatorPage() : clientPage()}
      </div>
    </section>`;
  actionBar();
}

// The brief on the page is a read, not a decision. Compiling is free, and
// reading the compiled brief is how a person decides whether to send it. Once a
// version is frozen, the frozen one is what shows.
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

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-ask")) {
    guard(async () => {
      view.working = true;
      view.message = "";
      view.messageAt = "questions";
      render();
      await call("ask-question", { assignmentId: view.sceneId, text: view.draft.question });
      await reloadQuestions();
      view.working = false;
      view.draft.question = "";
      view.message = "The client will see this on their home page.";
      view.messageAt = "questions";
      render();
    }, "questions");
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
