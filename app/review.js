const PARAMS = new URLSearchParams(window.location.search);
const TOUR_ID = PARAMS.get("tour") || "off-the-map-2026";

const locationBar = document.getElementById("location");
const workspace = document.getElementById("workspace");

const view = {
  sceneId: PARAMS.get("scene") || null,
  tour: null,
  assignment: null,
  artboards: [],
  artifacts: {},
  reviews: [],
  revisions: [],
  handoffs: [],
  facts: [],
  readyForClient: [],
  clientApprovals: [],
  clientComments: [],
  intents: [],
  brief: null,
  inspector: "brief",
  compareTo: null,
  draft: { feedback: "", preserve: "", technical: "", anchor: "" },
  message: "",
  working: false,
};

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

function lines(value) {
  return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function version(value) {
  return String(value || 0).padStart(2, "0");
}

function latest() {
  return view.artboards.at(-1) || null;
}

function reviewFor(value) {
  return view.reviews.find((entry) => entry.artboardVersion === value) || null;
}

function readyFor(value) {
  return view.readyForClient.find((entry) => entry.artboardVersion === value) || null;
}

function approvedFor(value) {
  return view.clientApprovals.find((entry) => entry.artboardVersion === value) || null;
}

function list(items, empty = "Nothing recorded.") {
  const rows = (items || []).map((entry) => `<li class="m-copy">${escape(typeof entry === "string" ? entry : entry.text)}</li>`).join("");
  return rows || `<li class="m-copy">${escape(empty)}</li>`;
}

function artifact(versionNumber, label) {
  const entry = view.artifacts[String(versionNumber)];
  if (!entry || !entry.src) return `<span class="m-artboard__shape"></span>`;
  if (entry.contentType === "application/pdf") {
    return `<a class="m-button" href="${escape(entry.src)}" target="_blank" rel="noopener">Open ${escape(entry.name || "submitted PDF")}</a>`;
  }
  return `<img src="${escape(entry.src)}" width="1280" alt="${escape(label)}" />`;
}

function workFrame(entry, label) {
  const artboardVersion = entry.artboard.artboardVersion;
  return `<div class="m-stack">
      <div class="m-work-frame">${artifact(artboardVersion, label)}<span class="m-work-frame__label">${escape(label)}</span></div>
      <span class="m-meta">AGAINST BRIEF V${version(entry.artboard.briefVersion)} / ${escape(String(entry.artboard.label || "SUBMITTED WORK").toUpperCase())}</span>
    </div>`;
}

function workSurface() {
  const current = latest();
  if (!current) return `<div class="m-callout"><p class="m-copy">Nothing has come back from production yet.</p></div>`;
  const prior = view.compareTo ? view.artboards.find((entry) => entry.artboard.artboardVersion === view.compareTo) : null;
  const frames = prior
    ? `<div class="m-reference-pair">${workFrame(prior, `Earlier V${version(prior.artboard.artboardVersion)}`)}${workFrame(current, `Current V${version(current.artboard.artboardVersion)}`)}</div>`
    : workFrame(current, `Current V${version(current.artboard.artboardVersion)}`);
  const decision = decisionComposer(current);
  return `<div class="m-stack">${frames}${decision}</div>`;
}

function decisionComposer(current) {
  const artboardVersion = current.artboard.artboardVersion;
  const written = reviewFor(artboardVersion);
  const pending = view.handoffs.find((entry) => entry.kind === "revision" && entry.sourceArtboardVersion === artboardVersion);
  if (approvedFor(artboardVersion) || pending || readyFor(artboardVersion)) return "";
  if (written) {
    return `<details class="m-disclosure"><summary><span class="m-label">Internal review saved</span><span class="m-meta">V${version(artboardVersion)}</span></summary><div class="m-disclosure__body m-stack"><div><span class="m-label">Changes</span><ul>${list(written.departures)}</ul></div><div><span class="m-label">Technical notes</span><ul>${list(written.technicalItems)}</ul></div></div></details>`;
  }
  const options = REGIONS.map((name) => `<option value="${escape(name)}" ${view.draft.anchor === name ? "selected" : ""}>${escape(name)}</option>`).join("");
  return `<section class="m-stack m-review-feedback" id="review-feedback" aria-labelledby="decision-heading">
      <div class="m-stack"><span class="m-label">Feedback on Artboard V${version(artboardVersion)}</span><h2 id="decision-heading" class="m-section-heading">What needs to change?</h2></div>
      <div class="m-field"><label class="m-label" for="anchor">Where, optional</label><select class="m-select" id="anchor" data-draft="anchor"><option value="">The whole picture</option>${options}</select></div>
      <div class="m-field"><label class="m-label" for="feedback">Change</label><textarea class="m-textarea" id="feedback" data-draft="feedback" placeholder="Say what should change. One note per line.">${escape(view.draft.feedback)}</textarea></div>
      <details class="m-disclosure"><summary><span class="m-label">Preserve or add a technical note</span><span class="m-meta">Optional</span></summary><div class="m-disclosure__body m-stack"><div class="m-field"><label class="m-label" for="preserve">Preserve</label><textarea class="m-textarea" id="preserve" data-draft="preserve" placeholder="What should stay as it is.">${escape(view.draft.preserve)}</textarea></div><div class="m-field"><label class="m-label" for="technical">Technical note</label><textarea class="m-textarea" id="technical" data-draft="technical" placeholder="One note per line.">${escape(view.draft.technical)}</textarea></div></div></details>
      <button class="m-button m-button--change" type="button" data-revise>Issue changes against V${version(artboardVersion)}</button>
    </section>`;
}

function briefPanel() {
  if (!view.brief) return `<p class="m-copy">The governing brief could not be found.</p>`;
  const brief = view.brief.brief;
  return `<section class="m-workstation__panel" role="tabpanel">
      <div class="m-inspector-group"><span class="m-label">Brief V${version(brief.briefVersion)}</span><h2 class="m-inspector-heading">${escape(brief.chosenConcept.title)}</h2><p class="m-copy">${escape(brief.chosenConcept.idea)}</p></div>
      <div class="m-inspector-group"><span class="m-label">Required</span><ul>${list(brief.requiredElements, "No required elements were named.")}</ul></div>
      <details class="m-disclosure"><summary><span class="m-label">Full brief</span><span class="m-meta">Frozen</span></summary><div class="m-disclosure__body"><pre>${escape(view.brief.document)}</pre></div></details>
    </section>`;
}

function versionsPanel() {
  const current = latest();
  const rows = view.artboards.slice().reverse().map((entry) => {
    const value = entry.artboard.artboardVersion;
    const isCurrent = current && value === current.artboard.artboardVersion;
    return `<div class="m-version" ${isCurrent ? 'aria-current="true"' : ""}><span class="${isCurrent ? "m-state m-state--current" : "m-state"}">V${version(value)} ${isCurrent ? "Current" : "Earlier"}</span><span class="m-meta">BRIEF V${version(entry.artboard.briefVersion)}</span>${isCurrent ? "" : `<button class="m-button m-button--small" type="button" data-compare="${escape(value)}">${view.compareTo === value ? "Stop comparing" : "Compare"}</button>`}</div>`;
  }).join("");
  return `<section class="m-workstation__panel" role="tabpanel"><div class="m-inspector-group"><span class="m-label">Versions</span><h2 class="m-inspector-heading">${view.artboards.length} received</h2></div>${rows}</section>`;
}

function productionPanel() {
  const current = latest();
  if (!current) return `<section class="m-workstation__panel"><p class="m-copy">Nothing has come back yet.</p></section>`;
  const value = current.artboard.artboardVersion;
  const state = approvedFor(value) ? "Approved by the client" : readyFor(value) ? "With the client" : "Internal review";
  return `<section class="m-workstation__panel" role="tabpanel"><div class="m-inspector-group"><span class="m-label">Current state</span><h2 class="m-inspector-heading">${escape(state)}</h2><p class="m-copy">${escape(current.artboard.conceptSummary)}</p></div><div class="m-inspector-group"><span class="m-label">Production assumed</span><ul>${list(current.artboard.technicalAssumptions)}</ul></div><div class="m-inspector-group"><span class="m-label">Technical items</span><ul>${list(current.artboard.technicalFindings)}</ul></div></section>`;
}

function recordPanel() {
  const rows = view.facts.slice().reverse().map((fact) => `<div class="m-activity-row"><span class="m-activity-row__marker"></span><div><p class="m-activity-row__copy">${escape(fact.action)} ${escape(fact.version || "")}</p><span class="m-meta">${escape(String(fact.actor).toUpperCase())} / ${escape(fact.at)}</span></div></div>`).join("");
  return `<section class="m-workstation__panel" role="tabpanel"><div class="m-inspector-group"><span class="m-label">Scene record</span><h2 class="m-inspector-heading">What happened</h2></div><div class="m-activity-list">${rows || `<p class="m-copy">No recorded actions yet.</p>`}</div></section>`;
}

function inspectorPanel() {
  if (view.inspector === "versions") return versionsPanel();
  if (view.inspector === "production") return productionPanel();
  if (view.inspector === "record") return recordPanel();
  return briefPanel();
}

function tab(name, label) {
  return `<button class="m-workstation__tab" type="button" role="tab" aria-selected="${view.inspector === name}" data-inspector="${escape(name)}">${escape(label)}</button>`;
}

function decisionToolbar() {
  const current = latest();
  if (!current) {
    return `<section class="m-workstation-notice"><div class="m-stack"><h1 class="m-scene-work-heading">Waiting for the first Artboard</h1><p class="m-copy">Production has not submitted work for this Scene yet.</p></div></section>`;
  }
  const value = current.artboard.artboardVersion;
  const pending = view.handoffs.find((entry) => entry.kind === "revision" && entry.sourceArtboardVersion === value);
  const ready = readyFor(value);
  const approved = approvedFor(value);
  let title = `Decide on Artboard V${version(value)}`;
  let context = "Compare this version with the production brief, then send it to the client or request changes.";
  let controls = `<a class="m-button" href="#review-feedback">Request changes</a><button class="m-button m-button--primary" type="button" data-send-client>Send V${version(value)} to client</button>`;
  if (approved) {
    title = `Artboard V${version(value)} was approved by the client`;
    context = "This exact version and its decision are read only.";
    controls = `<a class="m-button" href="./client-review.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}">Open client view</a>`;
  } else if (pending) {
    title = `Changes were issued against Artboard V${version(value)}`;
    context = "Production is working from the recorded feedback.";
    controls = `<a class="m-button m-button--primary" href="${escape(pending.directPath)}">Open revision handoff</a>`;
  } else if (ready) {
    title = `Artboard V${version(value)} is with the client`;
    context = "This exact version is waiting for the client's decision.";
    controls = `<a class="m-button m-button--primary" href="./client-review.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}">Open client view</a>`;
  }
  return `<section class="m-workstation-notice m-review-decision"><div class="m-stack"><h1 class="m-scene-work-heading">${escape(title)}</h1><p class="m-copy">${escape(context)}</p></div><div class="m-action-bar__actions">${controls}</div></section>`;
}

function currentState(current) {
  if (!current) return { label: "Waiting on production", className: "m-state m-state--current" };
  const value = current.artboard.artboardVersion;
  if (approvedFor(value)) return { label: "Client approved", className: "m-state m-state--approved" };
  if (readyFor(value)) return { label: "With the client", className: "m-state m-state--current" };
  if (view.handoffs.some((entry) => entry.kind === "revision" && entry.sourceArtboardVersion === value)) return { label: "Changes issued", className: "m-state m-state--change" };
  return { label: "Needs a decision", className: "m-state m-state--current" };
}

function render() {
  const current = latest();
  const state = currentState(current);
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./scenes.html?tour=${escape(TOUR_ID)}">Scenes</a><span aria-hidden="true">/</span><a href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}">${escape(view.assignment.title)}</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Review V${version(current?.artboard.artboardVersion)}</span></nav><span class="${escape(state.className)}">${escape(state.label)}</span>`;
  workspace.innerHTML = `${decisionToolbar()}${view.message ? `<div class="m-workstation-message"><div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div></div>` : ""}<div class="m-workstation"><section class="m-workstation__stage" aria-label="Work under review"><div class="m-workstation__canvas"><section class="m-direction-editor m-review-surface"><div class="m-direction-editor__body m-stack">${workSurface()}</div></section></div></section><aside class="m-workstation__inspector" aria-label="Review context"><div class="m-workstation__inspector-head"><span class="m-label">Inspector</span></div><div class="m-workstation__tabs" role="tablist">${tab("brief", "Brief")}${tab("versions", "Versions")}${tab("production", "Production")}${tab("record", "Record")}</div><div class="m-workstation__panels">${inspectorPanel()}</div></aside></div>`;
}

async function loadArtifacts() {
  const artifacts = {};
  for (const entry of view.artboards) {
    const value = entry.artboard.artboardVersion;
    try {
      const item = await call("get-artboard-artifact", { assignmentId: view.sceneId, artboardVersion: value });
      let src = item.dataUrl || null;
      if (!src && item.blobPathname) {
        const response = await fetch("/api/tour-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "read", tourId: TOUR_ID, assignmentId: view.sceneId, pathname: item.blobPathname }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "That work file could not be opened.");
        src = body.presignedUrl;
      }
      if (!src && item.svg) src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(item.svg);
      artifacts[String(value)] = { src, contentType: item.contentType, name: item.name };
    } catch {
      artifacts[String(value)] = null;
    }
  }
  view.artifacts = artifacts;
}

async function refresh() {
  const [artboards, written, facts, end, handoffs] = await Promise.all([
    call("get-artboards", { assignmentId: view.sceneId }),
    call("get-reviews", { assignmentId: view.sceneId }),
    call("get-scene-record", { assignmentId: view.sceneId }),
    call("get-production-intent", { assignmentId: view.sceneId }),
    call("get-handoffs", { assignmentId: view.sceneId }),
  ]);
  view.artboards = artboards.artboards || [];
  view.reviews = written.reviews || [];
  view.revisions = written.revisions || [];
  view.facts = facts.facts || [];
  view.readyForClient = end.readyForClient || [];
  view.clientApprovals = end.clientApprovals || [];
  view.clientComments = end.comments || [];
  view.intents = end.intents || [];
  view.handoffs = handoffs.handoffs || [];
  await loadArtifacts();
  const current = latest();
  if (current) view.brief = await call("get-brief", { assignmentId: view.sceneId, briefVersion: current.artboard.briefVersion });
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
    view.working = true;
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
  const field = event.target;
  if (field.dataset && field.dataset.draft) view.draft[field.dataset.draft] = field.value;
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.inspector) {
    view.inspector = target.dataset.inspector;
    render();
    return;
  }
  if (target.dataset.compare) {
    const value = Number(target.dataset.compare);
    view.compareTo = view.compareTo === value ? null : value;
    render();
    return;
  }
  if (target.hasAttribute("data-send-client")) {
    guard(async () => {
      const current = latest();
      await call("approve-for-client", { assignmentId: view.sceneId, artboardVersion: current.artboard.artboardVersion });
      view.message = `V${version(current.artboard.artboardVersion)} is with the client.`;
      await refresh();
      view.working = false;
      render();
    });
  }
  if (target.hasAttribute("data-revise")) {
    guard(async () => {
      const feedback = lines(view.draft.feedback);
      if (!feedback.length) throw new Error("Say what should change before issuing a revision.");
      const current = latest();
      const value = current.artboard.artboardVersion;
      if (!reviewFor(value)) {
        await call("save-review", { assignmentId: view.sceneId, artboardVersion: value, departures: feedback, technicalItems: lines(view.draft.technical) });
      }
      await call("issue-revision", {
        assignmentId: view.sceneId,
        sourceArtboardVersion: value,
        revisionId: `rev-${value}-${Date.now()}`,
        instructions: feedback.map((text) => ({ text, regionAnchor: view.draft.anchor || null })),
        preserve: lines(view.draft.preserve),
      });
      view.draft = { feedback: "", preserve: "", technical: "", anchor: "" };
      view.message = `Revision issued against V${version(value)}.`;
      await refresh();
      view.working = false;
      render();
    });
  }
});

guard(load);
