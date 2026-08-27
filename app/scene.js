import { ACCOUNT_ID, TOUR_ID, scopedBody } from "./context.js";

// A Scene. What the client asked for, the references they attached, what the
// tour holds that bears on the work, an optional note, and two ways out: ask
// the client a question, or send the work to production.
//
// Nobody chooses which parts of the tour direction travel. Meridian decides,
// and all of it travels, because the direction is the governing document and
// the brief already names the version it was written against. The same rule
// covers the dates where the rig differs. Ruled 2026-08-27.

const PARAMS = new URLSearchParams(window.location.search);

const locationBar = document.getElementById("location");
const root = document.getElementById("scene");
const actions = document.getElementById("actions");

const view = {
  sceneId: PARAMS.get("scene") || null,
  user: null,
  tour: null,
  assignment: null,
  context: null,
  references: [],
  referenceMessage: "",
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

// ---------------------------------------------------------------------------
// The request, as it arrived, with whatever the client attached to it
// ---------------------------------------------------------------------------

function requestWork() {
  const assignment = view.assignment;
  const required = (assignment.requiredElements || [])
    .map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
  const when = assignment.requestedOn ? `, ${escape(assignment.requestedOn)}` : "";
  return `<section class="m-scene-source" aria-labelledby="client-request-heading">
      <div class="m-scene-source__head">
        <h2 id="client-request-heading" class="m-scene-work-heading">Client request</h2>
        <span class="m-meta">FROM ${escape(String(assignment.requestedBy || "CLIENT TEAM").toUpperCase())}${when}</span>
      </div>
      <div class="m-scene-source__copy">${paragraphs(assignment.request)}</div>
      ${required ? `<div class="m-scene-required"><span class="m-label">Required</span><ul>${required}</ul></div>` : ""}
      ${referencesSection()}
    </section>`;
}

// ---------------------------------------------------------------------------
// What the tour holds that bears on this work
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

function tourWork() {
  const version = view.context.directionVersion;
  const setupVersion = view.context.setupVersion ? ` V0${escape(view.context.setupVersion)}` : "";
  return `<section class="m-scene-source" aria-labelledby="tour-context-heading">
      <div class="m-scene-source__head">
        <div class="m-stack">
          <h2 id="tour-context-heading" class="m-scene-work-heading">What the tour holds</h2>
          <p class="m-copy">The whole tour direction travels with the brief. Nobody picks parts of it.</p>
        </div>
        <span class="m-meta">DIRECTION V0${escape(version)}</span>
      </div>
      <div class="m-stack">
        <span class="m-label">Venues and screens${setupVersion}</span>
        ${dateRows()}
        ${rigRows()}
        <p class="m-meta">A date row carries a venue and a place. Screen and rig detail is free text on the production setup, not fields.</p>
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Questions to the client. A question, an answer, and who said each.
// ---------------------------------------------------------------------------

function questionRow(entry) {
  const answer = entry.answer
    ? `<div class="m-contribution">
        <span class="m-contribution__source">${escape(entry.answeredBy)}, ${escape(entry.answeredAt)}</span>
        <p class="m-copy">${escape(entry.answer)}</p>
      </div>`
    : isOperator()
      ? `<p class="m-meta">WAITING ON THE CLIENT</p>`
      : `<div class="m-field">
          <label class="m-label" for="answer-${escape(entry.id)}">Your answer</label>
          <textarea class="m-textarea" id="answer-${escape(entry.id)}" data-answer="${escape(entry.id)}">${escape(view.draft.answers[entry.id] || "")}</textarea>
          <button class="m-button m-button--small" type="button" data-send-answer="${escape(entry.id)}">Send answer</button>
        </div>`;
  return `<article class="m-contribution">
      <span class="m-contribution__source">${escape(entry.askedBy)}, ${escape(entry.askedAt)}</span>
      <p class="m-copy">${escape(entry.text)}</p>
      ${answer}
    </article>`;
}

function questionsWork() {
  const rows = view.questions.map(questionRow).join("");
  const composer = isOperator()
    ? `<div class="m-field">
        <label class="m-label" for="scene-question">Ask the client a question</label>
        <textarea class="m-textarea" id="scene-question" data-draft="question" placeholder="What do you need from them before this goes to production?">${escape(view.draft.question)}</textarea>
        <button class="m-button m-button--small" type="button" data-ask ${view.working ? "disabled" : ""}>${view.working ? "Sending" : "Ask the client"}</button>
      </div>`
    : "";
  const message = view.messageAt === "questions" && view.message
    ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>`
    : "";
  const empty = rows
    ? ""
    : `<div class="m-empty-inline"><p class="m-copy">Nothing has been asked on this Scene.</p></div>`;
  return `<section class="m-scene-source" aria-labelledby="scene-questions-heading">
      <div class="m-scene-source__head">
        <h2 id="scene-questions-heading" class="m-scene-work-heading">Questions</h2>
        <span class="m-meta">${escape(view.questions.length)} ASKED</span>
      </div>
      <div class="m-stack">${rows || empty}${message}${composer}</div>
    </section>`;
}

// ---------------------------------------------------------------------------
// The Scene page
// ---------------------------------------------------------------------------

function sceneWork() {
  return `<section class="m-direction-editor" aria-labelledby="scene-heading">
      <div class="m-direction-editor__header">
        <span class="m-label m-direction-editor__label">Scene${view.assignment.moment ? ` / ${escape(view.assignment.moment)}` : ""}</span>
        <h1 id="scene-heading" class="m-direction-editor__title">${escape(view.assignment.title)}</h1>
      </div>
      <div class="m-direction-editor__body">
        ${view.message && !view.messageAt ? `<div class="m-callout m-callout--current m-direction-editor__notice"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
        ${requestWork()}
        ${tourWork()}
        <div class="m-field">
          <label class="m-label" for="scene-direction">Note for production, optional</label>
          <textarea class="m-textarea m-textarea--note" id="scene-direction" data-draft="direction" placeholder="Anything worth remembering before this goes to production.">${escape(view.draft.direction)}</textarea>
        </div>
        <div class="m-direction-editor__meta">
          <span>Written by Higher Roads</span>
          <span>Against Tour Direction V0${escape(view.assignment.directionVersion)}</span>
        </div>
        ${questionsWork()}
        ${briefSection()}
        ${receiptSection()}
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

// One judgement is made here: this is right, send it. Freezing the brief and
// issuing the handoff happen together, on the newest brief, so the bar carries
// saving and sending and nothing else.
function actionBar() {
  if (view.artboards.length > 0) {
    actions.innerHTML = "";
    return;
  }
  const operator = view.user && view.user.role === "higher-roads";
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
  } else if (!operator) {
    context = view.concept
      ? "The Scene direction is saved. Higher Roads sends it to production next."
      : "Save the Scene direction. Higher Roads sends it to production next.";
    controls = `<button class="m-button m-button--primary" type="button" data-save>Save direction</button>`;
  } else if (view.concept) {
    context = "Read the compiled brief, then send it to production.";
    controls = `<button class="m-button" type="button" data-save>Save direction</button>
      <button class="m-button m-button--primary" type="button" data-send>Send to production</button>`;
  } else {
    context = "Save the Scene direction before sending it to production.";
    controls = `<button class="m-button m-button--primary" type="button" data-save>Save direction</button>`;
  }
  actions.innerHTML = `<p class="m-action-bar__context">${escape(context)}</p>
    <div class="m-action-bar__actions">${controls}</div>`;
}

function reviewNotice() {
  if (!view.user || view.user.role !== "higher-roads" || !view.artboards.length) return "";
  const current = view.artboards.at(-1);
  const value = current && current.artboard ? current.artboard.artboardVersion : null;
  if (!value) return "";
  return `<section class="m-workstation-notice" aria-labelledby="artboard-ready-heading">
      <div class="m-stack">
        <h2 id="artboard-ready-heading" class="m-scene-work-heading">Artboard V0${escape(value)} is ready for review</h2>
        <p class="m-copy">Compare it with the production brief and decide whether it is ready for the client.</p>
      </div>
      <a class="m-button m-button--primary" href="./review.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}">Review Artboard V0${escape(value)}</a>
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
        ${sceneWork()}
      </div>
    </section>`;
  actionBar();
}

// The brief on the page is a read, not a decision. Compiling is free, and
// reading the compiled brief is how a person decides whether to send it. Once a
// version is frozen, the frozen one is what shows.
async function readBrief() {
  if (!view.user || view.user.role !== "higher-roads") return null;
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
  const context = isOperator()
    ? await call("assignment-context", { assignmentId: view.sceneId })
    : await call("get-scene-workspace", { assignmentId: view.sceneId });
  view.assignment = context.assignment;
  refreshReferences().then(() => { try { render(); } catch (_) {} });
  view.context = context.context;
  view.concept = isOperator()
    ? (await call("get-concept", { assignmentId: view.sceneId })).concept
    : context.concept;
  view.briefs = (await call("list-briefs", { assignmentId: view.sceneId })).briefs;
  try {
    view.questions = (await call("get-questions", { assignmentId: view.sceneId })).questions;
  } catch {
    view.questions = [];
  }
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
  const action = isOperator() ? "choose-concept" : "save-scene-direction";
  view.concept = (await call(action, { assignmentId: view.sceneId, concept })).concept;
  view.brief = await readBrief();
  view.message = "Saved.";
  view.messageAt = "";
  render();
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
      view.questions = (await call("get-questions", { assignmentId: view.sceneId })).questions;
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
      view.questions = (await call("get-questions", { assignmentId: view.sceneId })).questions;
      delete view.draft.answers[questionId];
      view.message = "Your answer is on the Scene.";
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

// ---------------------------------------------------------------------------
// Reference images. They belong with the request, because a client attaching a
// photo is part of what they asked for.
// ---------------------------------------------------------------------------

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

async function uploadReference(file) {
  view.referenceMessage = "Uploading " + file.name + "...";
  render();
  const authorization = await fetch("/api/tour-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: ACCOUNT_ID, tourId: TOUR_ID, assignmentId: view.sceneId, filename: file.name, contentType: file.type, size: file.size }) });
  const authorized = await authorization.json();
  if (!authorization.ok) { view.referenceMessage = authorized.error || "The reference could not be authorized."; render(); return; }
  const put = await fetch(authorized.presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) { view.referenceMessage = "The reference could not be uploaded."; render(); return; }
  const recorded = await fetch("/api/tour-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: ACCOUNT_ID, tourId: TOUR_ID, assignmentId: view.sceneId, mode: "reference-record", pathname: authorized.pathname, filename: file.name, contentType: file.type }) });
  if (!recorded.ok) { view.referenceMessage = "The reference uploaded but could not be recorded."; render(); return; }
  view.referenceMessage = "";
  await refreshReferences();
  render();
}

document.addEventListener("change", (event) => {
  const field = event.target;
  if (field && field.dataset && field.dataset.reference === "input") {
    const file = field.files && field.files[0];
    if (file) uploadReference(file);
  }
});

function referencesSection() {
  const items = view.references || [];
  const rows = items.map((entry) => {
    const alt = entry.filename || "Reference";
    const when = entry.addedOn ? new Date(entry.addedOn).toLocaleDateString() : "";
    return `<li class="m-stack"><span class="m-copy">${escape(alt)}</span><span class="m-meta">Added by ${escape(entry.addedBy)} ${when ? "on " + escape(when) : ""}</span></li>`;
  }).join("");
  const list = rows
    ? `<ul class="m-stack">${rows}</ul>`
    : `<p class="m-copy">Optional. A photo, a mood image, or a still from another show.</p>`;
  const message = view.referenceMessage ? `<p class="m-copy">${escape(view.referenceMessage)}</p>` : "";
  return `<section class="m-stack" aria-label="Reference images"><span class="m-label">Reference images (optional)</span>${list}${message}<label class="m-button m-button--secondary"><input type="file" accept="image/*" data-reference="input" hidden>Add a reference image</label></section>`;
}

guard(load);
