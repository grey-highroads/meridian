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
  tour: null,
  assignment: null,
  context: null,
  concept: null,
  suggestions: null,
  usedSuggestion: null,
  brief: null,
  briefs: [],
  receipt: null,
  draft: { title: "", direction: "", marked: [], markedVenues: [] },
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

function requestSection() {
  const assignment = view.assignment;
  const required = (assignment.requiredElements || [])
    .map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
  return `<details class="m-disclosure" open>
      <summary>
        <span class="m-label">What was asked for</span>
        <span class="m-meta">${escape(String(assignment.requestedBy || "").toUpperCase())}</span>
      </summary>
      <div class="m-disclosure__body m-stack">
        <h2 class="m-section-heading">${escape(assignment.title)}</h2>
        ${assignment.moment ? `<p class="m-meta">${escape(assignment.moment.toUpperCase())}</p>` : ""}
        ${paragraphs(assignment.request)}
        ${required ? `<div class="m-stack"><span class="m-label">Required</span><ul>${required}</ul></div>` : ""}
      </div>
    </details>`;
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
  return `<section class="m-authoring__support" aria-labelledby="brain-heading">
      <div class="m-cluster">
        <div class="m-stack">
          <span class="m-label">Asked for, never automatic</span>
          <h2 id="brain-heading" class="m-section-heading">Artist Brain</h2>
        </div>
        <button class="m-button m-button--small" type="button" data-ask ${view.working ? "disabled" : ""}>${view.working ? "Thinking" : "Ask Artist Brain"}</button>
      </div>
      ${view.messageAt === "brain" && view.message
        ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>`
        : ""}
      <p class="m-copy">Suggestions reach the brief only when you use one and leave it in. Ignoring them changes nothing.</p>
      ${list ? `<div class="m-suggestion-list">${list}</div>` : ""}
      ${notes}
      ${context}
    </section>`;
}

function directionSection() {
  const version = view.assignment.directionVersion;
  return `<section class="m-authoring__primary" aria-labelledby="scene-direction-heading">
      <div class="m-cluster">
        <h2 id="scene-direction-heading" class="m-section-heading">Scene direction</h2>
        <span class="m-meta">WRITTEN AGAINST TOUR DIRECTION V0${escape(version)}</span>
      </div>
      <div class="m-field">
        <label class="m-label" for="scene-title">Name it</label>
        <input class="m-input" id="scene-title" data-draft="title" value="${escape(view.draft.title)}" placeholder="A short name for this direction" />
      </div>
      <textarea class="m-textarea m-authoring__field" data-draft="direction" aria-label="Scene direction" placeholder="Describe the direction production should build to.">${escape(view.draft.direction)}</textarea>
      <span class="m-help">This is the production facing direction. It is your words, not the director's and not the brain's.</span>
    </section>`;
}

// ---------------------------------------------------------------------------
// Which parts of the tour direction bear on this Scene
// ---------------------------------------------------------------------------

function marksSection() {
  const all = view.context.directionParagraphs || [];
  const rows = all.map((text, index) => `<label class="m-cluster">
      <input type="checkbox" data-paragraph="${escape(index)}" ${view.draft.marked.includes(index) ? "checked" : ""} />
      <span class="m-copy">${escape(text)}</span>
    </label>`).join("");
  return `<section class="m-work m-stack" aria-labelledby="marks-heading">
      <div class="m-cluster">
        <h2 id="marks-heading" class="m-section-heading">The parts of the tour direction that bear on this Scene</h2>
        <span class="m-meta">DIRECTION V0${escape(view.context.directionVersion)}</span>
      </div>
      <p class="m-copy">The whole direction stays in Meridian and the brain reads all of it. The brief to production carries what you mark here, and the version.</p>
      <div class="m-stack">${rows}</div>
    </section>`;
}

// The dates where the rig differs. The brief carries the ones marked here and
// leaves the rest on the tour home.
function venueSection() {
  const all = view.context.venueExceptions || [];
  if (!all.length) return "";
  const rows = all.map((entry, index) => `<label class="m-cluster">
      <input type="checkbox" data-venue="${escape(index)}" ${view.draft.markedVenues.includes(index) ? "checked" : ""} />
      <span class="m-copy"><strong>${escape(entry.venue)}</strong>, ${escape(entry.date)}. ${escape(entry.text)}</span>
    </label>`).join("");
  return `<section class="m-work m-stack" aria-labelledby="venues-heading">
      <div class="m-cluster">
        <h2 id="venues-heading" class="m-section-heading">Dates where the rig differs</h2>
        <span class="m-meta">SETUP V0${escape(view.context.setupVersion)}</span>
      </div>
      <p class="m-copy">The brief always carries the standard setup. Mark a date here when this Scene has to work on it.</p>
      <div class="m-stack">${rows}</div>
    </section>`;
}

// ---------------------------------------------------------------------------
// The brief
// ---------------------------------------------------------------------------

function briefSection() {
  const frozen = view.briefs.length
    ? `<p class="m-meta">FROZEN: ${escape(view.briefs.map((entry) => `V0${entry.briefVersion} BY ${String(entry.frozenBy).toUpperCase()}`).join(" / "))}</p>`
    : "";
  if (!view.concept) {
    return `<section class="m-work m-stack" aria-labelledby="brief-heading">
        <h2 id="brief-heading" class="m-section-heading">The brief</h2>
        <p class="m-copy">Save the Scene direction and the brief compiles from it.</p>
        ${frozen}
      </section>`;
  }
  if (!view.brief) {
    return `<section class="m-work m-stack" aria-labelledby="brief-heading">
        <h2 id="brief-heading" class="m-section-heading">The brief</h2>
        <p class="m-copy">Saved: ${escape(view.concept.title)}, by ${escape(view.concept.shapedBy)}.</p>
        ${frozen}
      </section>`;
  }
  const brief = view.brief.brief;
  const state = brief.status === "frozen" ? "m-state m-state--approved" : "m-state m-state--current";
  const stateText = brief.status === "frozen" ? `Frozen by ${brief.frozenBy}` : "Draft, not yet frozen";
  return `<section class="m-work m-stack" aria-labelledby="brief-heading">
      <div class="m-cluster">
        <h2 id="brief-heading" class="m-section-heading">The brief</h2>
        <span class="${state}">${escape(stateText)}</span>
      </div>
      ${frozen}
      <div class="m-record-grid">
        <div class="m-record-grid__item">
          <span class="m-label">Job</span>
          <strong>${escape(brief.jobId)}</strong>
        </div>
        <div class="m-record-grid__item">
          <span class="m-label">Brief version</span>
          <strong>V0${escape(brief.briefVersion)}</strong>
        </div>
        <div class="m-record-grid__item">
          <span class="m-label">Written against direction</span>
          <strong>V0${escape(brief.directionVersion)}</strong>
        </div>
      </div>
      <div class="m-cluster">
        <button class="m-button m-button--small" type="button" data-download="document">Download the document</button>
        <button class="m-button m-button--small" type="button" data-download="sidecar">Download the machine readable file</button>
      </div>
      <pre>${escape(view.brief.document)}</pre>
    </section>`;
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
  const compile = view.concept
    ? `<button class="m-button" type="button" data-compile>${view.brief ? "Compile again" : "Compile the brief"}</button>`
    : "";
  const freeze = view.brief && !frozen
    ? `<button class="m-button m-button--primary" type="button" data-freeze>Freeze V0${escape(view.brief.brief.briefVersion)} and send it out</button>`
    : "";
  const context = frozen
    ? "That version is frozen. Feedback makes a new version rather than an edit."
    : "Saving records the Scene direction and what you marked. Freezing is what production builds against.";
  const review = view.briefs.length
    ? `<a class="m-button" href="./review.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}">Open review</a>`
    : "";
  actions.innerHTML = `<p class="m-action-bar__context">${escape(context)}</p>
    <div class="m-cluster">
      <button class="m-button" type="button" data-save>Save the Scene direction</button>
      ${compile}
      ${freeze}
      ${review}
    </div>`;
}

function render() {
  const assignment = view.assignment;
  locationBar.innerHTML = `<span class="m-meta">${escape(String(view.tour.name).toUpperCase())} / SCENE</span>
    <span class="m-state m-state--current">${escape(view.briefs.length ? "Brief issued" : "Brief in preparation")}</span>`;
  root.innerHTML = `<header class="m-job-header">
      <div class="m-job-header__copy">
        <span class="m-label">${escape(assignment.title)}</span>
        <h1 class="m-heading">Develop scene concept</h1>
        <p class="m-copy m-copy--large">Turn the request into direction production can build to.</p>
      </div>
    </header>
    ${view.message && !view.messageAt ? `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
    ${requestSection()}
    <div class="m-work m-authoring">
      ${directionSection()}
      ${brainSection()}
    </div>
    ${marksSection()}
    ${venueSection()}
    ${briefSection()}
    ${receiptSection()}`;
  actionBar();
}

async function load() {
  const { tour, assignments } = await call("get-tour");
  view.tour = tour;
  if (!view.sceneId && assignments.length) view.sceneId = assignments[0].id;
  const context = await call("assignment-context", { assignmentId: view.sceneId });
  view.assignment = context.assignment;
  view.context = context.context;
  view.concept = (await call("get-concept", { assignmentId: view.sceneId })).concept;
  view.briefs = (await call("list-briefs", { assignmentId: view.sceneId })).briefs;
  if (view.concept) {
    view.draft.title = view.concept.title;
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
  if (!view.draft.title.trim() || !view.draft.direction.trim()) {
    throw new Error("A Scene direction needs a name and some direction.");
  }
  const used = view.usedSuggestion;
  const applied = view.suggestions ? view.suggestions.appliedFindings || [] : [];
  const cited = new Set(used ? used.rhymesWith || [] : []);
  const concept = {
    title: view.draft.title.trim(),
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
  view.concept = (await call("choose-concept", { assignmentId: view.sceneId, concept })).concept;
  view.brief = null;
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
  if (target.dataset.use) {
    guard(async () => {
      const used = view.suggestions.proposals[Number(target.dataset.use)];
      view.usedSuggestion = used;
      view.draft.title = used.title;
      view.draft.direction = used.idea;
      view.message = "Used. Edit it into your words before you save.";
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
      // Freezing and sending are one action for the person and two facts on the
      // record, because the record has to show that the version that went out
      // is the version that was frozen.
      const sent = await call("send-brief", { assignmentId: view.sceneId, briefVersion: view.brief.brief.briefVersion });
      view.receipt = sent.receipt;
      view.message = `V0${view.brief.brief.briefVersion} is frozen and production has it.`;
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
  if (field.dataset.draft === "title") view.draft.title = field.value;
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
