// A Scene. The request as it arrived, the Scene direction Higher Roads writes
// against a named version of the tour direction, what the brain offers when
// someone asks for it, and the brief that goes to production.
//
// The brain suggests. A person writes. A suggestion reaches the brief only
// because someone used it and left it in.

const PARAMS = new URLSearchParams(window.location.search);
const TOUR_ID = PARAMS.get("tour") || "off-the-map-2026";

const locationBar = document.getElementById("location");
const root = document.getElementById("scene");
const actions = document.getElementById("actions");

const view = {
  sceneId: PARAMS.get("scene") || null,
  user: null,
  tour: null,
  assignment: null,
  context: null,
  concept: null,
  suggestions: null,
  usedSuggestion: null,
  brief: null,
  briefs: [],
  handoffs: [],
  artboards: [],
  receipt: null,
  draft: { direction: "", marked: [], markedVenues: [] },
  inspector: "brain",
  message: "",
  // Which part of the page the message belongs beside. Empty means the top of
  // the page. A message about the brain belongs next to the button that asked
  // it, where the person is looking.
  messageAt: "",
  working: false,
};

async function call(action, extra = {}) {
  let response;
  try {
    response = await fetch("/api/tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, tourId: TOUR_ID, ...extra }),
    });
  } catch (error) {
    // The browser reports a cut connection as a TypeError with no detail. The
    // long call is the one that reaches the limit and drops, so this is what a
    // person sees when the brain was still thinking.
    if (error instanceof TypeError) {
      throw new Error("The connection dropped while Artist Brain was thinking. Ask again.");
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

function plain(text) {
  return String(text || "").replace(/\*\*/g, "");
}

function sourceLine(entry) {
  if (!entry.independentSourceCount) return "Source count not recorded";
  const plural = entry.independentSourceCount === 1 ? "source" : "sources";
  const tiers = (entry.tiers || []).join(", ");
  const count = entry.independentSourceCount + " independent " + plural;
  return tiers ? count + ", tier " + tiers : count;
}

// ---------------------------------------------------------------------------
// The request, as it arrived
// ---------------------------------------------------------------------------

function requestWork() {
  const assignment = view.assignment;
  const required = (assignment.requiredElements || [])
    .map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
  return `<section class="m-scene-source" aria-labelledby="client-request-heading">
      <div class="m-scene-source__head">
        <h2 id="client-request-heading" class="m-scene-work-heading">Client request</h2>
        <span class="m-meta">FROM ${escape(String(assignment.requestedBy || "CLIENT TEAM").toUpperCase())}</span>
      </div>
      <div class="m-scene-source__copy">${paragraphs(assignment.request)}</div>
      ${required ? `<div class="m-scene-required"><span class="m-label">Required</span><ul>${required}</ul></div>` : ""}
    </section>`;
}

// ---------------------------------------------------------------------------
// The Scene direction and what the brain offers
// ---------------------------------------------------------------------------

function suggestionBlock(entry, index) {
  return `<article class="m-suggestion">
      <div class="m-contribution">
        <span class="m-contribution__source">${escape(entry.title)}</span>
        ${paragraphs(entry.idea)}
        ${entry.whyThisArtist ? `<p class="m-meta">WHY THIS ARTIST</p><p class="m-copy">${escape(entry.whyThisArtist)}</p>` : ""}
        ${entry.whereItMightMiss ? `<p class="m-meta">WHERE IT MIGHT MISS</p><p class="m-copy">${escape(entry.whereItMightMiss)}</p>` : ""}
      </div>
      <button class="m-button m-button--small" type="button" data-use="${escape(index)}">Use this</button>
    </article>`;
}

function brainSection() {
  const applied = view.suggestions ? view.suggestions.appliedFindings || [] : [];
  const list = view.suggestions
    ? (view.suggestions.proposals || []).map(suggestionBlock).join("")
    : "";
  const notes = view.suggestions && (view.suggestions.avoidNotes || []).length
    ? `<div class="m-contribution">
        <span class="m-contribution__source">What this artist avoids, on this request</span>
        ${view.suggestions.avoidNotes.map((note) => `<p class="m-copy">${escape(note)}</p>`).join("")}
      </div>`
    : "";
  const context = applied.length
    ? `<details class="m-disclosure">
        <summary>
          <span class="m-label">What the brain brought</span>
          <span class="m-meta">${escape(applied.length)} ENTRIES</span>
        </summary>
        <div class="m-disclosure__body m-stack">
          ${applied.map((entry) => `<div class="m-contribution">
            <span class="m-contribution__source">${escape(entry.facetName)} / ${escape(sourceLine(entry))}</span>
            <p class="m-copy">${escape(plain(entry.text))}</p>
            ${entry.why ? `<p class="m-meta">${escape(entry.why.toUpperCase())}</p>` : ""}
          </div>`).join("")}
        </div>
      </details>`
    : "";
  return `<section class="m-workstation__panel" id="brain-panel" role="tabpanel" aria-labelledby="brain-heading" ${view.inspector === "brain" ? "" : "hidden"}>
      <div class="m-inspector-group">
        <span class="m-label">Asked for, never automatic</span>
        <h2 id="brain-heading" class="m-inspector-heading">Artist Brain</h2>
        <p class="m-copy">Suggestions enter the direction only when you choose and edit one.</p>
      </div>
      <button class="m-button m-button--instrument m-button--small" type="button" data-ask ${view.working ? "disabled" : ""}>${view.working ? "Thinking" : "Ask Artist Brain"}</button>
      ${view.messageAt === "brain" && view.message
        ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>`
        : ""}
      ${list ? `<div class="m-suggestion-list">${list}</div>` : ""}
      ${notes}
      ${context}
    </section>`;
}

function directionSection() {
  const version = view.assignment.directionVersion;
  return `<section class="m-direction-editor" aria-labelledby="scene-direction-heading">
      <div class="m-direction-editor__header">
        <span class="m-label m-direction-editor__label">Scene${view.assignment.moment ? ` / ${escape(view.assignment.moment)}` : ""}</span>
        <h1 id="scene-direction-heading" class="m-direction-editor__title">${escape(view.assignment.title)}</h1>
      </div>
      <div class="m-direction-editor__body">
        ${view.message && !view.messageAt ? `<div class="m-callout m-callout--current m-direction-editor__notice"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
        ${requestWork()}
        ${tourDirectionWork()}
        <section class="m-scene-direction-work" aria-labelledby="production-direction-heading">
          <div class="m-stack">
            <h2 id="production-direction-heading" class="m-scene-work-heading">Scene direction for production</h2>
            <p class="m-copy">Turn the request and selected Tour Direction into the direction production should build.</p>
          </div>
          <textarea class="m-direction-editor__textarea" id="scene-direction" data-draft="direction" aria-label="Scene direction for production" placeholder="Describe the direction production should build to.">${escape(view.draft.direction)}</textarea>
        </section>
        <div class="m-direction-editor__meta">
          <span>Written by Higher Roads</span>
          <span>Against Tour Direction V0${escape(version)}</span>
        </div>
        ${briefSection()}
        ${receiptSection()}
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Which parts of the tour direction bear on this Scene
// ---------------------------------------------------------------------------

function tourDirectionWork() {
  const all = view.context.directionParagraphs || [];
  const rows = all.map((text, index) => `<label class="m-inspector-choice">
      <input type="checkbox" data-paragraph="${escape(index)}" ${view.draft.marked.includes(index) ? "checked" : ""} />
      <span class="m-copy">${escape(text)}</span>
    </label>`).join("");
  return `<section class="m-scene-source" aria-labelledby="tour-direction-heading">
      <div class="m-scene-source__head">
        <div class="m-stack">
          <h2 id="tour-direction-heading" class="m-scene-work-heading">Tour Direction for this Scene</h2>
          <p class="m-copy">Select the parts production needs with this Scene.</p>
        </div>
        <span class="m-meta">DIRECTION V0${escape(view.context.directionVersion)}</span>
      </div>
      ${rows ? `<div class="m-scene-direction-options">${rows}</div>` : `<div class="m-empty-inline m-empty-inline--waiting"><span class="m-label">Tour Direction not added</span><p class="m-copy">You can shape this Scene from the request. Add the tour's direction before the brief goes to production.</p></div>`}
    </section>`;
}

// The dates where the rig differs. The brief carries the ones marked here and
// leaves the rest on the tour home.
function venueSection() {
  const all = view.context.venueExceptions || [];
  const setup = view.context.productionSetup;
  const rows = all.map((entry, index) => `<label class="m-inspector-choice">
      <input type="checkbox" data-venue="${escape(index)}" ${view.draft.markedVenues.includes(index) ? "checked" : ""} />
      <span class="m-copy"><strong>${escape(entry.venue)}</strong>, ${escape(entry.date)}. ${escape(entry.text)}</span>
    </label>`).join("");
  const setupCopy = setup && setup.words
    ? paragraphs(setup.words)
    : `<div class="m-empty-inline"><span class="m-label">No tour setup yet</span><p class="m-copy">You can keep writing the Scene. Add confirmed playback and screen details before production receives the brief.</p></div>`;
  const exceptionCopy = rows
    ? `<div>${rows}</div>`
    : setup && setup.words
      ? `<div class="m-empty-inline m-empty-inline--clear"><span class="m-label">Standard setup</span><p class="m-copy">This Scene uses the tour setup on every date.</p></div>`
      : "";
  return `<section class="m-workstation__panel" id="setup-panel" role="tabpanel" aria-labelledby="setup-tab" ${view.inspector === "setup" ? "" : "hidden"}>
      <div class="m-inspector-group">
        <span class="m-label">Production setup${view.context.setupVersion ? ` V0${escape(view.context.setupVersion)}` : ""}</span>
        <h2 id="venues-heading" class="m-inspector-heading">Dates where the rig differs</h2>
        ${setupCopy}
      </div>
      ${exceptionCopy}
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

function actionBar() {
  const frozen = view.brief && view.brief.brief.status === "frozen";
  const hasIssuedBrief = view.briefs.length > 0;
  let context = "Save the direction before compiling the brief production will receive.";
  let controls = `<button class="m-button m-button--primary" type="button" data-save>Save direction</button>`;
  if (view.concept && !view.brief && !hasIssuedBrief) {
    if (view.user && view.user.role !== "higher-roads") {
      context = "The Scene direction is saved. Higher Roads prepares the production brief next.";
      controls = `<button class="m-button m-button--primary" type="button" data-save>Save direction</button>`;
    } else {
      context = "Compile the saved direction and accepted context into a production brief.";
      controls = `<button class="m-button" type="button" data-save>Save direction</button>
        <button class="m-button m-button--primary" type="button" data-compile>Compile brief</button>`;
    }
  }
  if (view.brief && !frozen) {
    context = "Freeze the exact brief production will build against.";
    controls = `<button class="m-button" type="button" data-save>Save direction</button>
      <button class="m-button m-button--primary" type="button" data-freeze>Freeze V0${escape(view.brief.brief.briefVersion)} and send</button>`;
  }
  if (frozen || hasIssuedBrief) {
    const latestBrief = view.briefs.at(-1);
    const handoff = latestBrief && view.handoffs.find((entry) => entry.kind === "brief" && entry.briefVersion === latestBrief.briefVersion);
    const work = view.artboards.length > 0;
    if (work) {
      actions.innerHTML = "";
      return;
    } else {
      context = handoff
        ? `Brief V0${escape(latestBrief.briefVersion)} is issued. Production returns the work through the same handoff.`
        : `Brief V0${escape(latestBrief.briefVersion)} is frozen. Name who receives it and issue the handoff.`;
      controls = `<a class="m-button m-button--primary" href="./handoff.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}&amp;brief=${escape(latestBrief.briefVersion)}">${handoff ? "Open handoff" : "Issue to production"}</a>`;
    }
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
  const tab = (name, label) => `<button class="m-workstation__tab" id="${escape(name)}-tab" type="button" role="tab" aria-selected="${view.inspector === name}" aria-controls="${escape(name)}-panel" data-inspector="${escape(name)}">${escape(label)}</button>`;
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <a href="./scenes.html?tour=${escape(TOUR_ID)}">Scenes</a>
      <span aria-hidden="true">/</span>
      <span class="m-breadcrumb__current">${escape(assignment.title)}</span>
    </nav>`;
  root.innerHTML = `${reviewNotice()}<div class="m-workstation">
      <section class="m-workstation__stage" aria-label="Scene direction workspace">
        <div class="m-workstation__canvas">
          ${directionSection()}
        </div>
      </section>
      <aside class="m-workstation__inspector" aria-label="Scene context">
        <div class="m-workstation__inspector-head">
          <span class="m-label">Inspector</span>
        </div>
        <div class="m-workstation__tabs" role="tablist" aria-label="Scene context">
          ${view.user && view.user.role === "higher-roads" ? tab("brain", "Brain") : ""}
          ${tab("setup", "Setup")}
        </div>
        <div class="m-workstation__panels">
          ${view.user && view.user.role === "higher-roads" ? brainSection() : ""}
          ${venueSection()}
        </div>
      </aside>
    </div>`;
  actionBar();
}

async function load() {
  try {
    view.user = (await call("get-me")).user;
  } catch {
    view.user = { role: "higher-roads", displayName: "Higher Roads" };
  }
  view.inspector = view.user.role === "higher-roads" ? "brain" : "setup";
  const { tour, assignments } = await call("get-tour");
  view.tour = tour;
  if (!view.sceneId && assignments.length) view.sceneId = assignments[0].id;
  const context = view.user.role === "higher-roads"
    ? await call("assignment-context", { assignmentId: view.sceneId })
    : await call("get-scene-workspace", { assignmentId: view.sceneId });
  view.assignment = context.assignment;
  view.context = context.context;
  view.concept = view.user.role === "higher-roads"
    ? (await call("get-concept", { assignmentId: view.sceneId })).concept
    : context.concept;
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
  if (view.concept) {
    view.draft.direction = view.concept.idea;
    view.draft.marked = (view.concept.directionParagraphs || []).slice();
    view.draft.markedVenues = (view.concept.venueExceptions || []).slice();
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
  if (!view.draft.direction.trim()) {
    throw new Error("Write the Scene direction before saving it.");
  }
  const used = view.usedSuggestion;
  const applied = view.suggestions ? view.suggestions.appliedFindings || [] : [];
  const cited = new Set(used ? used.rhymesWith || [] : []);
  const concept = {
    title: view.assignment.title,
    idea: view.draft.direction.trim(),
    whyThisArtist: used ? used.whyThisArtist : "",
    asksOfProduction: used ? used.asksOfProduction : "",
    whereItMightMiss: used ? used.whereItMightMiss : "",
    rhymesWith: used ? used.rhymesWith || [] : [],
    avoid: view.suggestions ? view.suggestions.avoidNotes || [] : [],
    openQuestions: view.suggestions ? view.suggestions.openQuestions || [] : [],
    artistContext: applied.filter((entry) => cited.has(entry.findingId)),
    directionParagraphs: view.draft.marked.slice().sort((first, second) => first - second),
    venueExceptions: view.draft.markedVenues.slice().sort((first, second) => first - second),
    cameFrom: used ? `suggestion: ${used.title}` : "written by Higher Roads",
  };
  const action = view.user && view.user.role === "higher-roads" ? "choose-concept" : "save-scene-direction";
  view.concept = (await call(action, { assignmentId: view.sceneId, concept })).concept;
  view.brief = null;
  view.message = "Saved.";
  view.messageAt = "";
  render();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.inspector) {
    view.inspector = target.dataset.inspector;
    render();
    return;
  }
  if (target.hasAttribute("data-ask")) {
    guard(async () => {
      view.working = true;
      view.message = "";
      view.messageAt = "brain";
      render();
      view.suggestions = await call("propose-concepts", { assignmentId: view.sceneId });
      view.working = false;
      const dropped = view.suggestions.droppedFindings || [];
      if (dropped.length) view.message = `${dropped.length} citations named entries the brain does not hold and were left out.`;
      render();
    }, "brain");
    return;
  }
  if (target.dataset.use !== undefined) {
    guard(async () => {
      const used = view.suggestions.proposals[Number(target.dataset.use)];
      view.usedSuggestion = used;
      view.draft.direction = [view.draft.direction.trim(), used.idea.trim()].filter(Boolean).join("\n\n");
      view.message = "Added to the Scene direction. Edit it into your words before you save.";
      view.messageAt = "";
      render();
    });
    return;
  }
  if (target.hasAttribute("data-save")) {
    guard(save);
    return;
  }
  if (target.hasAttribute("data-compile")) {
    guard(async () => {
      view.brief = await call("compile-brief", { assignmentId: view.sceneId });
      view.message = "";
      view.messageAt = "";
      render();
    });
    return;
  }
  if (target.hasAttribute("data-freeze")) {
    guard(async () => {
      view.brief = await call("freeze-brief", { assignmentId: view.sceneId });
      view.briefs = (await call("list-briefs", { assignmentId: view.sceneId })).briefs;
      view.message = `V0${view.brief.brief.briefVersion} is frozen. Issue it to the media artist when the recipient is named.`;
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
  if (!field.dataset || !field.dataset.draft) return;
  if (field.dataset.draft === "direction") view.draft.direction = field.value;
});

function toggle(list, index, on) {
  const kept = list.filter((entry) => entry !== index);
  if (on) kept.push(index);
  return kept;
}

document.addEventListener("change", (event) => {
  const box = event.target;
  if (!box.dataset) return;
  if (box.dataset.paragraph !== undefined) {
    view.draft.marked = toggle(view.draft.marked, Number(box.dataset.paragraph), box.checked);
  }
  if (box.dataset.venue !== undefined) {
    view.draft.markedVenues = toggle(view.draft.markedVenues, Number(box.dataset.venue), box.checked);
  }
});

guard(load);
