import { ACCOUNT_ID, TOUR_ID, scopedBody } from "./context.js";

const PARAMS = new URLSearchParams(window.location.search);
const SCENE_ID = PARAMS.get("scene") || "storm-and-lightning";
const BRIEF_VERSION = Number(PARAMS.get("brief")) || null;
const REVISION_ID = PARAMS.get("revision") || null;

const locationBar = document.getElementById("location");
const root = document.getElementById("handoff");

const view = {
  tour: null,
  assignment: null,
  brief: null,
  document: "",
  sidecar: null,
  handoff: null,
  revision: null,
  artboards: [],
  receipt: null,
  file: null,
  draft: { recipient: "", dueDate: "", contact: "", summary: "", assumptions: "", findings: "", onBehalfOf: "" },
  message: "",
  working: false,
};

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, assignmentId: SCENE_ID, ...extra })),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function lines(value) {
  return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function list(items, empty = "Nothing recorded.") {
  const rows = (items || []).map((entry) => `<li class="m-copy">${escape(typeof entry === "string" ? entry : entry.text)}</li>`).join("");
  return rows || `<li class="m-copy">${escape(empty)}</li>`;
}

function version(value) {
  return String(value || 0).padStart(2, "0");
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(date);
}

function download(kind) {
  const brief = view.brief;
  const name = `${brief.jobId}-v${brief.briefVersion}`;
  const body = kind === "sidecar" ? JSON.stringify(view.sidecar, null, 2) : view.document;
  const type = kind === "sidecar" ? "application/json" : "text/markdown";
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = kind === "sidecar" ? `${name}.json` : `${name}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function intro() {
  const revision = view.revision;
  const heading = revision ? `Revision from V${version(revision.sourceArtboardVersion)}` : `Brief V${version(view.brief.briefVersion)}`;
  const copy = revision
    ? "Make the named changes, preserve what is working, and return the next version here."
    : "Build against this frozen brief and return the first version here.";
  const state = view.receipt
    ? `<span class="m-state m-state--approved">V${version(view.receipt.artboardVersion)} received</span>`
    : `<span class="m-state m-state--current">${view.handoff ? "Issued" : "Ready to issue"}</span>`;
  return `<header class="m-form-page__intro">
      <span class="m-label">Production handoff</span>
      <h1 class="m-heading">${escape(heading)}</h1>
      <p class="m-copy m-copy--large">${escape(copy)}</p>
      ${state}
      <div class="m-stack">
        <span class="m-label">Scene</span>
        <p class="m-copy">${escape(view.assignment.title)}</p>
        <span class="m-meta">JOB ${escape(view.brief.jobId)}</span>
      </div>
    </header>`;
}

function briefBlock() {
  const brief = view.brief;
  const required = brief.requiredElements || [];
  const target = brief.technicalTarget || {};
  return `<section class="m-work m-stack" aria-labelledby="brief-heading">
      <div class="m-cluster">
        <div class="m-stack">
          <span class="m-label">Frozen production reference</span>
          <h2 id="brief-heading" class="m-section-heading">${escape(brief.chosenConcept.title)}</h2>
        </div>
        <span class="m-state m-state--approved">Brief V${version(brief.briefVersion)} frozen</span>
      </div>
      <p class="m-copy m-copy--large">${escape(brief.chosenConcept.idea)}</p>
      <div class="m-stack"><span class="m-label">Required</span><ul>${list(required, "No required elements were named.")}</ul></div>
      <div class="m-record-grid">
        <div class="m-record-grid__item"><span class="m-label">Playback</span><strong>${escape(target.playbackSystem || "Not recorded")}</strong></div>
        <div class="m-record-grid__item"><span class="m-label">Direction</span><strong>V${version(brief.directionVersion)}</strong></div>
      </div>
      <div class="m-cluster">
        <button class="m-button m-button--small" type="button" data-download="document">Download brief</button>
        <button class="m-button m-button--small" type="button" data-download="sidecar">Download machine readable file</button>
      </div>
      <details class="m-disclosure"><summary><span class="m-label">Read the full brief</span><span class="m-meta">V${version(brief.briefVersion)}</span></summary><div class="m-disclosure__body"><pre>${escape(view.document)}</pre></div></details>
    </section>`;
}

function revisionBlock() {
  if (!view.revision) return "";
  return `<section class="m-work m-stack" aria-labelledby="revision-heading">
      <div class="m-stack"><span class="m-label">Feedback against V${version(view.revision.sourceArtboardVersion)}</span><h2 id="revision-heading" class="m-section-heading">What changes now</h2></div>
      <ul>${list(view.revision.instructions)}</ul>
      <div class="m-stack"><span class="m-label">Preserve</span><ul>${list(view.revision.preserve, "Nothing was separately named to preserve.")}</ul></div>
      <span class="m-meta">${escape(String(view.revision.source || "Higher Roads review").toUpperCase())} / ${escape(formatDate(view.revision.sentAt).toUpperCase())}</span>
    </section>`;
}

function issueBlock() {
  if (view.handoff) {
    return `<section class="m-work m-stack" aria-labelledby="issued-heading">
        <div class="m-stack"><span class="m-label">Issued to</span><h2 id="issued-heading" class="m-section-heading">${escape(view.handoff.recipient)}</h2></div>
        <p class="m-copy">${view.handoff.dueDate ? `Due ${escape(formatDate(view.handoff.dueDate))}.` : "No due date was set."}${view.handoff.contact ? ` Contact ${escape(view.handoff.contact)}.` : ""}</p>
        <button class="m-button m-button--small" type="button" data-copy>Copy direct link</button>
        <span class="m-meta">ISSUED BY ${escape(String(view.handoff.issuedBy).toUpperCase())} / ${escape(formatDate(view.handoff.issuedAt).toUpperCase())}</span>
      </section>`;
  }
  if (view.revision) return "";
  return `<section class="m-work m-stack" aria-labelledby="issue-heading">
      <div class="m-stack"><span class="m-label">Before work starts</span><h2 id="issue-heading" class="m-section-heading">Name who receives this brief.</h2></div>
      <div class="m-field"><label class="m-label" for="recipient">Media artist or team</label><input class="m-input" id="recipient" data-draft="recipient" value="${escape(view.draft.recipient)}" placeholder="Name or team" /></div>
      <div class="m-field"><label class="m-label" for="due">Due date, optional</label><input class="m-input" id="due" type="date" data-draft="dueDate" value="${escape(view.draft.dueDate)}" /></div>
      <div class="m-field"><label class="m-label" for="contact">Contact, optional</label><input class="m-input" id="contact" data-draft="contact" value="${escape(view.draft.contact)}" placeholder="Email, phone, or account name" /></div>
      <button class="m-button m-button--primary" type="button" data-issue ${view.working ? "disabled" : ""}>Issue brief</button>
    </section>`;
}

function submitBlock() {
  if (!view.handoff) return "";
  if (view.receipt) {
    return `<section class="m-work m-stack" aria-labelledby="receipt-heading">
        <div class="m-callout m-callout--approved">
          <span class="m-state m-state--approved">Version received</span>
          <h2 id="receipt-heading" class="m-section-heading">Artboard V${version(view.receipt.artboardVersion)} is on the record.</h2>
          <p class="m-copy">Higher Roads reviews next. Feedback, if any, returns against this exact version.</p>
          <span class="m-meta">${escape(String(view.receipt.submittedBy).toUpperCase())} / ${escape(formatDate(view.receipt.receivedAt).toUpperCase())}</span>
        </div>
      </section>`;
  }
  const next = view.artboards.length ? Math.max(...view.artboards.map((entry) => entry.artboard.artboardVersion)) + 1 : 1;
  return `<section class="m-work m-stack" aria-labelledby="submit-heading">
      <div class="m-stack"><span class="m-label">Return the work</span><h2 id="submit-heading" class="m-section-heading">Submit artboard V${version(next)}</h2><p class="m-copy">One artifact and one sentence are enough.</p></div>
      <div class="m-field"><label class="m-label" for="artifact">Artboard image or PDF</label><input class="m-input" id="artifact" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf" data-file /><span class="m-help">Up to 20 MB. The file is stored privately.</span></div>
      <div class="m-field"><label class="m-label" for="summary">How you read the brief</label><textarea class="m-textarea" id="summary" data-draft="summary" placeholder="One clear sentence.">${escape(view.draft.summary)}</textarea></div>
      <details class="m-disclosure"><summary><span class="m-label">Technical notes, optional</span><span class="m-meta">Add only what matters</span></summary><div class="m-disclosure__body m-stack">
        <div class="m-field"><label class="m-label" for="assumptions">Assumptions</label><textarea class="m-textarea" id="assumptions" data-draft="assumptions" placeholder="One per line.">${escape(view.draft.assumptions)}</textarea></div>
        <div class="m-field"><label class="m-label" for="findings">Questions or technical findings</label><textarea class="m-textarea" id="findings" data-draft="findings" placeholder="One per line.">${escape(view.draft.findings)}</textarea></div>
        <div class="m-field"><label class="m-label" for="behalf">Submitting for someone else, optional</label><input class="m-input" id="behalf" data-draft="onBehalfOf" value="${escape(view.draft.onBehalfOf)}" placeholder="Name or team" /></div>
      </div></details>
      <button class="m-button m-button--primary" type="button" data-submit ${view.working ? "disabled" : ""}>${view.working ? "Submitting" : `Submit V${version(next)}`}</button>
    </section>`;
}

function render() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(SCENE_ID)}">${escape(view.assignment.title)}</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Production handoff</span></nav>`;
  root.className = "m-form-page";
  root.innerHTML = `${intro()}<div class="m-form-page__work">${view.message ? `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>` : ""}${revisionBlock()}${briefBlock()}${issueBlock()}${submitBlock()}</div>`;
}

function renderNoBrief() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(SCENE_ID)}">${escape(view.assignment.title)}</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Production handoff</span></nav>`;
  root.className = "m-page";
  root.innerHTML = `<section class="m-empty-state m-empty-state--waiting" aria-labelledby="handoff-not-ready-heading">
      <div class="m-empty-state__visual" aria-hidden="true">
        <svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor"><path d="M11 32h34"></path><path d="m37 24 8 8-8 8"></path><rect x="8" y="16" width="44" height="32" rx="2"></rect></svg>
        <span class="m-empty-state__calibration">Production handoff / Not ready</span>
      </div>
      <div class="m-empty-state__body">
        <span class="m-label">One step comes first</span>
        <h1 id="handoff-not-ready-heading" class="m-section-heading">Freeze the brief before handoff</h1>
        <p class="m-copy m-copy--large">Production needs one exact Scene direction, its required elements, and the Tour Direction version behind it. Finish that work in the Scene, then issue it here.</p>
        <div class="m-empty-state__actions"><a class="m-button m-button--primary" href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(SCENE_ID)}">Finish the Scene brief</a></div>
      </div>
    </section>`;
}

async function load() {
  const [{ tour, assignment }, briefList, handoffList, reviewList, artboardList] = await Promise.all([
    call("get-assignment"),
    call("list-briefs"),
    call("get-handoffs"),
    call("get-reviews"),
    call("get-artboards"),
  ]);
  view.tour = tour;
  view.assignment = assignment;
  view.artboards = artboardList.artboards || [];
  view.revision = REVISION_ID ? (reviewList.revisions || []).find((entry) => entry.revisionId === REVISION_ID) || null : null;
  const briefVersion = BRIEF_VERSION || (view.revision && view.artboards.find((entry) => entry.artboard.artboardVersion === view.revision.sourceArtboardVersion)?.artboard.briefVersion) || briefList.briefs.at(-1)?.briefVersion;
  if (!briefVersion) {
    renderNoBrief();
    return;
  }
  const full = await call("get-brief", { briefVersion });
  view.brief = full.brief;
  view.document = full.document;
  view.sidecar = full.sidecar;
  view.handoff = (handoffList.handoffs || []).find((entry) => view.revision
    ? entry.kind === "revision" && entry.revisionId === view.revision.revisionId
    : entry.kind === "brief" && entry.briefVersion === briefVersion) || null;
  view.receipt = view.artboards.map((entry) => entry.receipt).find((entry) => view.revision
    ? entry.sourceArtboardVersion === view.revision.sourceArtboardVersion
    : entry.briefVersion === briefVersion && entry.sourceArtboardVersion === null) || null;
  render();
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error(`Could not read ${file.name}.`)));
    reader.readAsDataURL(file);
  });
}

async function storeFile(file) {
  if (!file) throw new Error("Add the work before submitting this version.");
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    if (file.size > 3 * 1024 * 1024) throw new Error("Local preview accepts files up to 3 MB. The deployed app accepts 20 MB.");
    return { name: file.name, contentType: file.type, size: file.size, dataUrl: await readAsDataUrl(file) };
  }
  const authorization = await fetch("/api/tour-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: ACCOUNT_ID, tourId: TOUR_ID, assignmentId: SCENE_ID, filename: file.name, contentType: file.type, size: file.size }),
  });
  const authorized = await authorization.json();
  if (!authorization.ok) throw new Error(authorized.error || "The work upload could not be authorized.");
  const upload = await fetch(authorized.presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!upload.ok) throw new Error("The work could not be uploaded.");
  return { name: file.name, contentType: file.type, size: file.size, blobPathname: authorized.pathname };
}

async function guard(work) {
  try {
    view.working = true;
    view.message = "";
    render();
    await work();
  } catch (error) {
    view.working = false;
    view.message = error.message;
    render();
  }
}

document.addEventListener("input", (event) => {
  const field = event.target;
  if (field.dataset && field.dataset.draft) view.draft[field.dataset.draft] = field.value;
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-file]")) view.file = event.target.files[0] || null;
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.download) download(target.dataset.download);
  if (target.hasAttribute("data-copy")) {
    navigator.clipboard.writeText(window.location.href).then(() => {
      view.message = "Direct link copied.";
      render();
    });
  }
  if (target.hasAttribute("data-issue")) {
    guard(async () => {
      const issued = await call("issue-brief", { briefVersion: view.brief.briefVersion, recipient: view.draft.recipient, dueDate: view.draft.dueDate, contact: view.draft.contact });
      view.handoff = issued.handoff;
      view.working = false;
      view.message = "Brief issued. Copy the direct link when you are ready to notify production.";
      render();
    });
  }
  if (target.hasAttribute("data-submit")) {
    guard(async () => {
      const artifact = await storeFile(view.file);
      const submitted = await call("submit-artboard", {
        briefVersion: view.brief.briefVersion,
        sourceArtboardVersion: view.revision ? view.revision.sourceArtboardVersion : null,
        artifact,
        conceptSummary: view.draft.summary,
        technicalAssumptions: lines(view.draft.assumptions),
        technicalFindings: lines(view.draft.findings),
        onBehalfOf: view.draft.onBehalfOf,
      });
      view.receipt = submitted.receipt;
      view.artboards.push({ receipt: submitted.receipt, artboard: submitted.artboard });
      view.working = false;
      view.message = "";
      render();
    });
  }
});

load().catch((error) => {
  locationBar.innerHTML = "";
  root.className = "m-page";
  root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
});
