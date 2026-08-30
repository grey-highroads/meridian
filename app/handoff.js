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
  draft: { summary: "", assumptions: "", findings: "", onBehalfOf: "" },
  message: "",
  messageTarget: "",
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

function nextArtboardVersion() {
  return view.artboards.length ? Math.max(...view.artboards.map((entry) => entry.artboard.artboardVersion)) + 1 : 1;
}

function message(target) {
  if (!view.message || view.messageTarget !== target) return "";
  return `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>`;
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
  const next = nextArtboardVersion();
  const context = revision ? `Production revision / Brief V${version(view.brief.briefVersion)}` : `Production brief / V${version(view.brief.briefVersion)}`;
  const copy = view.receipt
    ? `Artboard V${version(view.receipt.artboardVersion)} is back. Higher Roads reviews it next.`
    : revision
      ? `Make the requested changes and return Artboard V${version(next)} here.`
      : `Build from this brief, then return Artboard V${version(next)} here.`;
  const state = view.receipt
    ? `<span class="m-state m-state--approved">V${version(view.receipt.artboardVersion)} received</span>`
    : `<span class="m-state m-state--current">${view.handoff ? "Issued" : "Not sent yet"}</span>`;
  return `<header class="m-handoff-header">
      <div class="m-stack m-handoff-header__copy">
        <span class="m-label">${escape(context)}</span>
        <h1 class="m-heading">${escape(view.assignment.title)}</h1>
        <p class="m-copy m-copy--large">${escape(copy)}</p>
      </div>
      <div class="m-handoff-header__record">
        ${state}
        ${view.handoff ? `<span class="m-meta">${escape(formatDate(view.handoff.issuedAt).toUpperCase())}</span>` : ""}
      </div>
    </header>`;
}

function recordBlock() {
  const brief = view.brief;
  const issued = view.handoff
    ? `<div class="m-stack"><span class="m-label">Issued</span><p class="m-copy">${escape(formatDate(view.handoff.issuedAt))} by ${escape(view.handoff.issuedBy)}</p></div>`
    : `<div class="m-stack"><span class="m-label">Status</span><p class="m-copy">Not sent yet</p></div>`;
  return `<details class="m-disclosure m-handoff-disclosure">
      <summary><span class="m-label">Files and record</span><span class="m-meta">Brief V${version(brief.briefVersion)}</span></summary>
      <div class="m-disclosure__body m-stack">
        <div class="m-handoff-record">
          ${issued}
          <div class="m-stack"><span class="m-label">Production ID</span><span class="m-meta m-handoff-record__id">${escape(brief.jobId)}</span></div>
        </div>
        <div class="m-cluster">
          <button class="m-button m-button--small" type="button" data-download="sidecar">Download production data</button>
          ${view.handoff ? `<button class="m-button m-button--small" type="button" data-copy>Copy handoff link</button>` : ""}
        </div>
        ${message("record")}
      </div>
    </details>`;
}

function briefBlock() {
  const brief = view.brief;
  const required = brief.requiredElements || [];
  const target = brief.technicalTarget || {};
  const repeatsSceneTitle = String(brief.chosenConcept.title || "").trim().toLowerCase() === String(view.assignment.title || "").trim().toLowerCase();
  const heading = repeatsSceneTitle ? "Creative direction" : brief.chosenConcept.title;
  const requiredContent = required.length
    ? `<ul>${list(required)}</ul>`
    : `<p class="m-copy">No additional elements are required.</p>`;
  return `<section class="m-handoff-brief" aria-labelledby="brief-heading">
      <div class="m-handoff-brief__head">
        <div class="m-stack">
          <span class="m-label">The brief</span>
          <h2 id="brief-heading" class="m-section-heading">${escape(heading)}</h2>
        </div>
        <button class="m-button m-button--small" type="button" data-download="document">Download brief</button>
      </div>
      <p class="m-copy m-copy--large">${escape(brief.chosenConcept.idea)}</p>
      <div class="m-stack"><span class="m-label">Required elements</span>${requiredContent}</div>
      <div class="m-handoff-facts">
        <div class="m-handoff-fact"><span class="m-label">Playback</span><strong>${escape(target.playbackSystem || "Not recorded")}</strong></div>
        <div class="m-handoff-fact"><span class="m-label">Direction version</span><strong>V${version(brief.directionVersion)}</strong></div>
      </div>
      <details class="m-disclosure m-handoff-disclosure"><summary><span class="m-label">Full brief</span><span class="m-meta">Brief V${version(brief.briefVersion)}</span></summary><div class="m-disclosure__body"><pre>${escape(view.document)}</pre></div></details>
      ${recordBlock()}
    </section>`;
}

function revisionBlock() {
  if (!view.revision) return "";
  return `<section class="m-handoff-revision m-stack" aria-labelledby="revision-heading">
      <div class="m-stack"><span class="m-label">Requested changes</span><h2 id="revision-heading" class="m-section-heading">For Artboard V${version(view.revision.sourceArtboardVersion)}</h2></div>
      <ul>${list(view.revision.instructions)}</ul>
      <div class="m-stack"><span class="m-label">Preserve</span><ul>${list(view.revision.preserve, "Nothing was separately named to preserve.")}</ul></div>
      <span class="m-meta">${escape(String(view.revision.source || "Higher Roads review").toUpperCase())} / ${escape(formatDate(view.revision.sentAt).toUpperCase())}</span>
    </section>`;
}

function issueBlock() {
  if (view.handoff) return "";
  if (view.revision) return "";
  return `<section class="m-handoff-return m-stack" aria-labelledby="issue-heading">
      <div class="m-stack"><span class="m-label">Send the brief</span><h2 id="issue-heading" class="m-section-heading">Ready for production</h2><p class="m-copy">This freezes Brief V${version(view.brief.briefVersion)} and opens Artboard V01 for return.</p></div>
      ${message("record")}
      <button class="m-button m-button--primary" type="button" data-issue ${view.working ? "disabled" : ""}>Send to production</button>
    </section>`;
}

function submitBlock() {
  if (!view.handoff) return "";
  if (view.receipt) {
    return `<section class="m-handoff-return m-stack" aria-labelledby="receipt-heading">
        <span class="m-state m-state--approved">Artboard received</span>
        <h2 id="receipt-heading" class="m-section-heading">Higher Roads reviews V${version(view.receipt.artboardVersion)} next.</h2>
        <p class="m-copy">Any requested changes will come back against this exact version.</p>
        <span class="m-meta">${escape(String(view.receipt.submittedBy).toUpperCase())} / ${escape(formatDate(view.receipt.receivedAt).toUpperCase())}</span>
      </section>`;
  }
  const next = nextArtboardVersion();
  return `<section class="m-handoff-return m-stack" aria-labelledby="submit-heading">
      <div class="m-stack"><span class="m-label">Return the work</span><h2 id="submit-heading" class="m-section-heading">Artboard V${version(next)}</h2><p class="m-copy">Send one image and one sentence.</p></div>
      <div class="m-field"><label class="m-label" for="artifact">Artboard</label><input class="m-input" id="artifact" type="file" accept="image/png,image/jpeg" data-file /><span class="m-help">PNG or JPEG, up to 20 MB. Stored privately.</span></div>
      <div class="m-field"><label class="m-label" for="summary">What you made</label><textarea class="m-textarea m-textarea--note" id="summary" data-draft="summary" placeholder="Describe the idea in one sentence.">${escape(view.draft.summary)}</textarea></div>
      <details class="m-disclosure"><summary><span class="m-label">Technical notes, optional</span><span class="m-meta">Add only what matters</span></summary><div class="m-disclosure__body m-stack">
        <div class="m-field"><label class="m-label" for="assumptions">What you assumed</label><textarea class="m-textarea" id="assumptions" data-draft="assumptions" placeholder="One per line.">${escape(view.draft.assumptions)}</textarea></div>
        <div class="m-field"><label class="m-label" for="findings">Questions or technical notes</label><textarea class="m-textarea" id="findings" data-draft="findings" placeholder="One per line.">${escape(view.draft.findings)}</textarea></div>
        <div class="m-field"><label class="m-label" for="behalf">Submitting for someone else, optional</label><input class="m-input" id="behalf" data-draft="onBehalfOf" value="${escape(view.draft.onBehalfOf)}" placeholder="Name or team" /></div>
      </div></details>
      ${message("return")}
      <button class="m-button m-button--primary" type="button" data-submit ${view.working ? "disabled" : ""}>${view.working ? "Submitting" : `Submit Artboard V${version(next)}`}</button>
    </section>`;
}

function render() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(SCENE_ID)}">${escape(view.assignment.title)}</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Production brief</span></nav>`;
  root.className = "m-handoff-page";
  root.innerHTML = `${intro()}<div class="m-handoff-layout"><div class="m-handoff-document">${revisionBlock()}${briefBlock()}</div><aside class="m-handoff-response" aria-label="Return the work">${issueBlock()}${submitBlock()}</aside></div>`;
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
        <h1 id="handoff-not-ready-heading" class="m-section-heading">Send the brief from the Scene</h1>
        <p class="m-copy m-copy--large">Production needs one exact Scene direction, its required elements, and the Tour Direction version behind it. Finish that work in the Scene and send it to production from there.</p>
        <div class="m-empty-state__actions"><a class="m-button m-button--primary" href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(SCENE_ID)}">Open the Scene</a></div>
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

async function guard(work, target) {
  try {
    view.working = true;
    view.message = "";
    view.messageTarget = target;
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
      view.message = "Handoff link copied.";
      view.messageTarget = "record";
      render();
    });
  }
  if (target.hasAttribute("data-issue")) {
    guard(async () => {
      const issued = await call("issue-brief", { briefVersion: view.brief.briefVersion });
      view.handoff = issued.handoff;
      view.working = false;
      view.message = `Brief V${version(view.brief.briefVersion)} sent. Artboard V01 can be returned here.`;
      view.messageTarget = "record";
      render();
    }, "record");
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
    }, "return");
  }
});

load().catch((error) => {
  locationBar.innerHTML = "";
  root.className = "m-page";
  root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
});
