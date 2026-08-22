// Artboard review. What came back from production, against the brief it was
// built from, with the review Higher Roads writes and the feedback that goes
// back as a revision.
//
// Everything on this page carries the stand-in label, because the artboard is
// ours until step 7 and nobody should read it as Jim's work.
//
// The technical assumptions and technical items are shown as production wrote
// them. Nothing here compares them to anything, scores them, or draws a
// conclusion. A person reads them and decides.

const PARAMS = new URLSearchParams(window.location.search);
const TOUR_ID = PARAMS.get("tour") || "off-the-map-2026";

const locationBar = document.getElementById("location");
const page = document.getElementById("page");
const reviewPane = document.getElementById("review");
const detail = document.getElementById("detail");
const actions = document.getElementById("actions");

const view = {
  sceneId: PARAMS.get("scene") || null,
  tour: null,
  assignment: null,
  artboards: [],
  reviews: [],
  revisions: [],
  facts: [],
  artifacts: {},
  compareTo: null,
  draft: { departure: "", technical: "", feedback: "", anchor: "", preserve: "" },
  message: "",
};

// The nine places a person can point at. This control is provisional and uses
// the nearest pattern the design system has, because the register carries a
// request for a real region anchor and no pattern exists yet. The list matches
// REGIONS in api/tour/index.js.
const REGIONS = [
  "Top left", "Top centre", "Top right",
  "Middle left", "Centre", "Middle right",
  "Bottom left", "Bottom centre", "Bottom right",
];

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, tourId: TOUR_ID, ...extra }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function own(map, key) {
  if (!map || key === null || key === undefined) return null;
  return Object.prototype.hasOwnProperty.call(map, String(key)) ? map[String(key)] : null;
}

function latest() {
  return view.artboards.length ? view.artboards[view.artboards.length - 1] : null;
}

function reviewFor(artboardVersion) {
  return view.reviews.find((entry) => entry.artboardVersion === artboardVersion) || null;
}

// The artboard file comes back as text and is shown through a data address, so
// nothing from production is executed by this page.
function frame(artboardVersion) {
  const svg = own(view.artifacts, artboardVersion);
  if (!svg) return `<span class="m-artboard__shape"></span>`;
  const address = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  return `<img src="${escape(address)}" width="640" alt="Artboard version ${escape(artboardVersion)}" />`;
}

// ---------------------------------------------------------------------------
// The artboard and its versions
// ---------------------------------------------------------------------------

function stage() {
  const current = latest();
  if (!current) return "";
  const prior = view.compareTo
    ? view.artboards.find((entry) => entry.artboard.artboardVersion === view.compareTo)
    : null;
  const priorHalf = prior
    ? `<div class="m-artboard__prior">
        <span class="m-meta">COMPARED / V0${escape(prior.artboard.artboardVersion)}</span>
        ${frame(prior.artboard.artboardVersion)}
      </div>`
    : "";
  return `<div class="m-review__stage">
      <div class="m-artboard" aria-label="Artboard version ${escape(current.artboard.artboardVersion)}">
        ${priorHalf}
        <div class="m-artboard__current">
          <span>CURRENT / V0${escape(current.artboard.artboardVersion)}</span>
          ${frame(current.artboard.artboardVersion)}
        </div>
      </div>
      <div class="m-callout">
        <span class="m-label">Where this came from</span>
        <p class="m-copy">${escape(String(current.artboard.label).toUpperCase())}</p>
      </div>
    </div>`;
}

function rail() {
  const current = latest();
  const rows = view.artboards.slice().reverse().map((entry) => {
    const version = entry.artboard.artboardVersion;
    const isCurrent = current && version === current.artboard.artboardVersion;
    const state = isCurrent
      ? `<span class="m-state m-state--current">V0${escape(version)} Current</span>`
      : `<span class="m-state">V0${escape(version)} Earlier</span>`;
    const compare = isCurrent || view.artboards.length < 2
      ? ""
      : `<button class="m-button m-button--small" type="button" data-compare="${escape(version)}">${view.compareTo === version ? "Stop comparing" : "Compare"}</button>`;
    return `<div class="m-version"${isCurrent ? ' aria-current="true"' : ""}>
        ${state}
        <strong>ARTBOARD V0${escape(version)}</strong>
        <span class="m-meta">AGAINST BRIEF V0${escape(entry.artboard.briefVersion)}</span>
        <span class="m-meta">${escape(entry.receipt.receivedAt)}</span>
        ${compare}
      </div>`;
  }).join("");
  return `<aside class="m-review__rail" aria-label="Versions">
      <div class="m-version">
        <span class="m-label">Versions</span>
        <span class="m-meta">${escape(view.artboards.length)} RECEIVED</span>
      </div>
      ${rows}
    </aside>`;
}

// ---------------------------------------------------------------------------
// What production said, and what Higher Roads says back
// ---------------------------------------------------------------------------

function fromProduction() {
  const current = latest();
  if (!current) return "";
  const list = (items, empty) => (items.length
    ? items.map((line) => `<li class="m-copy">${escape(line)}</li>`).join("")
    : `<li class="m-copy">${escape(empty)}</li>`);
  return `<section class="m-work m-stack" aria-labelledby="built-heading">
      <h2 id="built-heading" class="m-section-heading">The concept as built</h2>
      <p class="m-copy">${escape(current.artboard.conceptSummary)}</p>
      <div class="m-stack">
        <span class="m-label">What production assumed</span>
        <ul>${list(current.artboard.technicalAssumptions || [], "Nothing recorded.")}</ul>
      </div>
      <div class="m-stack">
        <span class="m-label">Technical items production raised</span>
        <ul>${list(current.artboard.technicalFindings || [], "Nothing raised.")}</ul>
      </div>
      <span class="m-help">Shown as production wrote it. Meridian checks none of it against anything.</span>
    </section>`;
}

function reviewSection() {
  const current = latest();
  if (!current) return "";
  const version = current.artboard.artboardVersion;
  const written = reviewFor(version);
  if (written) {
    const lines = (items) => items.map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
    return `<section class="m-work m-stack" aria-labelledby="review-heading">
        <div class="m-cluster">
          <h2 id="review-heading" class="m-section-heading">The review of V0${escape(version)}</h2>
          <span class="m-state m-state--approved">Written by ${escape(written.writtenBy)}</span>
        </div>
        ${written.departures.length ? `<div class="m-stack"><span class="m-label">Where it departs from the brief</span><ul>${lines(written.departures)}</ul></div>` : ""}
        ${written.technicalItems.length ? `<div class="m-stack"><span class="m-label">Technical items needing a decision</span><ul>${lines(written.technicalItems)}</ul></div>` : ""}
        <span class="m-help">A review is written once. Anything further makes a new version.</span>
      </section>`;
  }
  return `<section class="m-work m-stack" aria-labelledby="review-heading">
      <h2 id="review-heading" class="m-section-heading">Review V0${escape(version)}</h2>
      <div class="m-field">
        <label class="m-label" for="departure">Where it departs from the brief</label>
        <textarea class="m-textarea" id="departure" data-draft="departure" placeholder="One note per line.">${escape(view.draft.departure)}</textarea>
      </div>
      <div class="m-field">
        <label class="m-label" for="technical">Technical items needing a decision</label>
        <textarea class="m-textarea" id="technical" data-draft="technical" placeholder="One item per line.">${escape(view.draft.technical)}</textarea>
      </div>
      <span class="m-help">This is Higher Roads' record. The client never reads it.</span>
    </section>`;
}

function feedbackSection() {
  const current = latest();
  if (!current) return "";
  const options = REGIONS
    .map((name) => `<option value="${escape(name)}" ${view.draft.anchor === name ? "selected" : ""}>${escape(name)}</option>`)
    .join("");
  return `<section class="m-work m-stack" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading" class="m-section-heading">Send it back for changes</h2>
      <div class="m-field">
        <label class="m-label" for="anchor">Which part of the picture</label>
        <select class="m-select" id="anchor" data-draft="anchor">
          <option value="">The whole picture</option>
          ${options}
        </select>
      </div>
      <div class="m-field">
        <label class="m-label" for="feedback">What should change</label>
        <textarea class="m-textarea" id="feedback" data-draft="feedback" placeholder="One instruction per line.">${escape(view.draft.feedback)}</textarea>
      </div>
      <div class="m-field">
        <label class="m-label" for="preserve">What should stay as it is</label>
        <textarea class="m-textarea" id="preserve" data-draft="preserve" placeholder="One note per line.">${escape(view.draft.preserve)}</textarea>
      </div>
    </section>`;
}

function sentSection() {
  if (!view.revisions.length) return "";
  const rows = view.revisions.slice().reverse().map((entry) => {
    const items = entry.instructions
      .map((line) => `<li class="m-copy">${line.regionAnchor ? `${escape(line.regionAnchor)}. ` : ""}${escape(line.text)}</li>`)
      .join("");
    const kept = entry.preserve.length
      ? `<div class="m-stack"><span class="m-label">Kept</span><ul>${entry.preserve.map((line) => `<li class="m-copy">${escape(line)}</li>`).join("")}</ul></div>`
      : "";
    return `<div class="m-contribution">
        <span class="m-contribution__source">${escape(entry.revisionId)} / AGAINST V0${escape(entry.sourceArtboardVersion)} / CAME BACK AS V0${escape(entry.producedArtboardVersion)}</span>
        <ul>${items}</ul>
        ${kept}
        <span class="m-meta">${escape(String(entry.sentBy).toUpperCase())} / ${escape(entry.sentAt)}</span>
      </div>`;
  }).join("");
  return `<section class="m-work m-stack" aria-labelledby="sent-heading">
      <h2 id="sent-heading" class="m-section-heading">What went back</h2>
      ${rows}
    </section>`;
}

function recordSection() {
  if (!view.facts.length) return "";
  const rows = view.facts.map((fact) => `<div class="m-record-grid__item">
      <span class="m-label">${escape(fact.action)}</span>
      <strong>${escape(fact.version || "")}</strong>
      <span class="m-meta">${escape(String(fact.actor).toUpperCase())} / ${escape(fact.at)}</span>
    </div>`).join("");
  return `<section class="m-work m-stack" aria-labelledby="record-heading">
      <h2 id="record-heading" class="m-section-heading">What happened on this Scene</h2>
      <p class="m-copy">Every line is written once and stays as written.</p>
      <div class="m-record-grid">${rows}</div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function lines(text) {
  return String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function actionBar() {
  const current = latest();
  if (!current) {
    actions.innerHTML = `<p class="m-action-bar__context">Nothing has come back yet.</p>`;
    return;
  }
  const version = current.artboard.artboardVersion;
  const written = reviewFor(version);
  const save = written
    ? ""
    : `<button class="m-button" type="button" data-save>Save the review</button>`;
  actions.innerHTML = `<p class="m-action-bar__context">Feedback makes a new version rather than an edit.</p>
    <div class="m-cluster">
      <a class="m-button" href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}">Back to the Scene</a>
      ${save}
      <button class="m-button m-button--change" type="button" data-revise>Request internal changes</button>
    </div>`;
}

function render() {
  locationBar.innerHTML = `<span class="m-meta">${escape(String(view.tour.name).toUpperCase())} / SCENE / REVIEW</span>
    <span class="m-state m-state--current">${escape(view.artboards.length ? "Internal review" : "Waiting on production")}</span>`;
  page.innerHTML = `<header class="m-job-header">
      <div class="m-job-header__copy">
        <span class="m-label">${escape(view.assignment.title)}</span>
        <h1 class="m-heading">Artboard review</h1>
        <p class="m-copy m-copy--large">Review the work against the brief it was built from.</p>
      </div>
    </header>
    ${view.message ? `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>` : ""}`;
  reviewPane.innerHTML = view.artboards.length ? `${stage()}${rail()}` : "";
  detail.innerHTML = `${fromProduction()}${reviewSection()}${feedbackSection()}${sentSection()}${recordSection()}`;
  actionBar();
}

async function loadArtifacts() {
  const artifacts = {};
  for (const entry of view.artboards) {
    const version = entry.artboard.artboardVersion;
    try {
      artifacts[version] = (await call("get-artboard-artifact", { assignmentId: view.sceneId, artboardVersion: version })).svg;
    } catch {
      artifacts[version] = null;
    }
  }
  view.artifacts = artifacts;
}

async function refresh() {
  view.artboards = (await call("get-artboards", { assignmentId: view.sceneId })).artboards;
  const written = await call("get-reviews", { assignmentId: view.sceneId });
  view.reviews = written.reviews;
  view.revisions = written.revisions;
  view.facts = (await call("get-scene-record", { assignmentId: view.sceneId })).facts;
  await loadArtifacts();
}

async function load() {
  const { tour, assignments } = await call("get-tour");
  view.tour = tour;
  if (!view.sceneId && assignments.length) view.sceneId = assignments[0].id;
  view.assignment = (await call("get-assignment", { assignmentId: view.sceneId })).assignment;
  await refresh();
  render();
}

async function guard(work) {
  try {
    await work();
  } catch (error) {
    view.message = error.message;
    try {
      render();
    } catch {
      page.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
    }
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.compare) {
    const version = Number(target.dataset.compare);
    view.compareTo = view.compareTo === version ? null : version;
    render();
    return;
  }
  if (target.hasAttribute("data-save")) {
    guard(async () => {
      const current = latest();
      await call("save-review", {
        assignmentId: view.sceneId,
        artboardVersion: current.artboard.artboardVersion,
        departures: lines(view.draft.departure),
        technicalItems: lines(view.draft.technical),
      });
      view.draft.departure = "";
      view.draft.technical = "";
      view.message = "The review is saved.";
      await refresh();
      render();
    });
    return;
  }
  if (target.hasAttribute("data-revise")) {
    guard(async () => {
      const current = latest();
      const source = current.artboard.artboardVersion;
      const instructions = lines(view.draft.feedback)
        .map((text) => ({ text, regionAnchor: view.draft.anchor || null }));
      const sent = await call("send-revision", {
        assignmentId: view.sceneId,
        sourceArtboardVersion: source,
        revisionId: `rev-${source}-${Date.now()}`,
        instructions,
        preserve: lines(view.draft.preserve),
      });
      view.draft.feedback = "";
      view.draft.preserve = "";
      view.draft.anchor = "";
      view.compareTo = source;
      view.message = `V0${sent.artboard.artboardVersion} came back. Job ${sent.receipt.jobId}, received ${sent.receipt.receivedAt}.`;
      await refresh();
      render();
    });
  }
});

// The draft lives in the page until someone sends it, so a redraw never loses
// what a person typed.
document.addEventListener("input", (event) => {
  const field = event.target;
  if (!field.dataset || !field.dataset.draft) return;
  view.draft[field.dataset.draft] = field.value;
});

document.addEventListener("change", (event) => {
  const field = event.target;
  if (!field.dataset || field.dataset.draft !== "anchor") return;
  view.draft.anchor = field.value;
});

guard(load);
