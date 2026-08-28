import { TOUR_ID, scopedBody } from "./context.js";

// Artist Intelligence. Four things a Higher Roads person can ask about the
// artist, and the research they draw on underneath.
//
// The old home for this was a panel on the Scene page that held the content and
// answered no question. So this page leads with the asks, in the words of the
// person making them, and recruits context beneath each one. A job that is not
// built yet says so in plain words rather than sitting behind a dead control.
//
// Higher Roads only. The rail link is built for this role and the route refuses
// a client on its own. Nothing here is the enforcement.

const locationBar = document.getElementById("location");
const root = document.getElementById("intelligence");

const view = {
  user: null,
  tour: null,
  scenes: [],
  sceneId: "",
  running: false,
  message: "",
  analyses: [],
  runId: "",
  loadingRuns: false,
};

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, ...extra })),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work. Try again.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pad(value) {
  return String(Number(value) || 0).padStart(2, "0");
}

function day(value) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return "not recorded";
  return parsed.toISOString().slice(0, 10);
}

// The intake file writes the lead sentence of an entry in bold. It reads as the
// headline; the rest is the supporting sentence.
function leadAndBody(text) {
  const value = String(text || "").trim();
  const marked = value.match(/^\*\*(.+?)\*\*\s*(.*)$/s);
  if (marked) return { lead: marked[1], body: marked[2] };
  const sentence = value.match(/^(.+?[.!?])(?:\s+|$)(.*)$/s);
  if (sentence) return { lead: sentence[1], body: sentence[2] };
  return { lead: value, body: "" };
}

function sourceLine(entry) {
  if (!entry || !entry.independentSourceCount) return "Source count not recorded";
  const plural = entry.independentSourceCount === 1 ? "source" : "sources";
  const tiers = (entry.tiers || []).join(", ");
  const count = `${entry.independentSourceCount} independent ${plural}`;
  return tiers ? `${count}, from tier ${tiers}` : count;
}

// A Scene can be asked about once it has been submitted. A draft request has
// nothing in it to work from, so it is not offered.
function submittedScenes(assignments) {
  return assignments.filter((scene) => scene.stage && scene.stage !== "Draft request");
}

function sceneOptions() {
  const rows = view.scenes.map((scene) =>
    `<option value="${escape(scene.id)}"${scene.id === view.sceneId ? " selected" : ""}>${escape(scene.title)}</option>`).join("");
  return `<select class="m-select" id="scene-choice" aria-label="Scene">${rows}</select>`;
}

function askRow(entry) {
  return `<div class="m-rule-row">
      <div class="m-stack">
        <span class="m-rule-row__title">${escape(entry.title)}</span>
        <span class="m-copy">${escape(entry.copy)}</span>
      </div>
      <div class="m-cluster">${entry.control}</div>
    </div>`;
}

function asks() {
  const ready = view.scenes.length > 0;
  const ideaControl = ready
    ? `${sceneOptions()}<button class="m-button m-button--primary" type="button" data-run ${view.running ? "disabled" : ""}>${view.running ? "Working" : "Ask for ideas"}</button>`
    : `<span class="m-state m-state--current">No Scene yet</span>`;
  const rows = [
    {
      title: "Ideas for a Scene",
      copy: ready
        ? "Starting points drawn from this artist's history, with the research behind each one."
        : "Submit a Scene request first. Ideas are drawn against what the Scene asks for.",
      control: ideaControl,
    },
    {
      title: "Read the direction against the artist",
      copy: "Whether the tour direction departs from who this artist has been, and which older themes it echoes.",
      control: `<span class="m-state">Coming</span>`,
    },
    {
      title: "Review a board before the client sees it",
      copy: "A second read on a version from the artist's side, before you present it.",
      control: `<span class="m-state">Coming</span>`,
    },
    {
      title: "Check the tour stops",
      copy: "Requires venue and screen specifications as fields rather than prose. Nothing to read against yet.",
      control: `<span class="m-state">Waiting on tour data</span>`,
    },
  ];
  return `<section class="m-work" aria-labelledby="asks-heading">
      <h2 id="asks-heading" class="m-visually-hidden">What you can ask</h2>
      <div class="m-rule-list">${rows.map(askRow).join("")}</div>
    </section>`;
}

function evidenceEntry(entry) {
  const parts = leadAndBody(entry.text);
  return `<div class="m-stack">
      <p class="m-copy"><strong>${escape(parts.lead)}</strong></p>
      ${entry.why ? `<p class="m-copy">${escape(entry.why)}</p>` : ""}
      <details class="m-evidence-item">
        <summary><span class="m-meta">WHAT THIS RESTS ON</span></summary>
        <div class="m-evidence-item__body">
          <p class="m-copy">${escape(sourceLine(entry))}.</p>
          ${parts.body ? `<p class="m-copy">${escape(parts.body)}</p>` : ""}
        </div>
      </details>
    </div>`;
}

function directionBlock(direction, index, evidence) {
  const byId = new Map(evidence.map((entry) => [entry.findingId, entry]));
  const cited = (direction.rhymesWith || []).map((id) => byId.get(id)).filter(Boolean);
  const detail = [
    direction.whyThisArtist ? `<p class="m-copy">Why this artist: ${escape(direction.whyThisArtist)}</p>` : "",
    direction.asksOfProduction ? `<p class="m-copy">What it asks of production: ${escape(direction.asksOfProduction)}</p>` : "",
    direction.whereItMightMiss ? `<p class="m-copy">Where it might miss: ${escape(direction.whereItMightMiss)}</p>` : "",
  ].join("");
  return `<article class="m-orientation__section">
      <span class="m-meta">DIRECTION ${escape(pad(index + 1))}</span>
      <h3 class="m-section-heading">${escape(direction.title)}</h3>
      <p class="m-copy m-copy--large">${escape(direction.idea)}</p>
      ${detail}
      ${cited.length ? `<div class="m-stack">${cited.map(evidenceEntry).join("")}</div>` : ""}
    </article>`;
}

function listBlock(heading, items) {
  if (!items || !items.length) return "";
  return `<section class="m-orientation__section">
      <h3 class="m-section-heading">${escape(heading)}</h3>
      <ul>${items.map((entry) => `<li class="m-copy">${escape(entry)}</li>`).join("")}</ul>
    </section>`;
}

function runPicker() {
  if (view.analyses.length < 2) return "";
  const rows = view.analyses.slice().reverse().map((entry) => {
    const here = entry.runId === view.runId;
    return `<button class="m-button m-button--small" type="button" data-run-id="${escape(entry.runId)}"${here ? ' aria-current="true"' : ""}>Run ${escape(pad(entry.run))}</button>`;
  }).join("");
  return `<div class="m-cluster">${rows}</div>`;
}

function result() {
  if (view.loadingRuns) return "";
  if (!view.analyses.length) {
    return `<section class="m-empty-state m-empty-state--action m-empty-state--compact">
        <div class="m-empty-state__body">
          <h2 class="m-section-heading">Nothing asked for this Scene yet</h2>
          <p class="m-copy">Pick a Scene above and ask. What comes back is kept, and asking again keeps the earlier answer too.</p>
        </div>
      </section>`;
  }
  const analysis = view.analyses.find((entry) => entry.runId === view.runId) || view.analyses[view.analyses.length - 1];
  const evidence = Array.isArray(analysis.evidence) ? analysis.evidence : [];
  const directions = Array.isArray(analysis.result && analysis.result.directions) ? analysis.result.directions : [];
  const subject = analysis.subject || {};
  return `<section class="m-orientation" aria-labelledby="result-heading">
      <div class="m-section-lead">
        <div class="m-stack">
          <span class="m-label">Ideas for ${escape(subject.sceneTitle || "this Scene")}</span>
          <h2 id="result-heading" class="m-section-heading">Run ${escape(pad(analysis.run))}, ${escape(day(analysis.ranAt))}</h2>
          <span class="m-meta">TOUR DIRECTION V${escape(pad(analysis.directionVersion))} / ARTIST KNOWLEDGE APPROVED ${escape(day(analysis.brainApprovedAt).toUpperCase())}</span>
        </div>
        <div class="m-cluster">
          ${runPicker()}
          <button class="m-button" type="button" data-packet="${escape(analysis.runId)}">Download the concept packet</button>
        </div>
      </div>
      <p class="m-copy">These are starting points. Nothing here has been decided or approved.</p>
      ${directions.map((direction, index) => directionBlock(direction, index, evidence)).join("")}
      ${listBlock("What this artist stays away from", analysis.result && analysis.result.avoidNotes)}
      ${listBlock("Open questions", analysis.result && analysis.result.openQuestions)}
    </section>`;
}

function reference() {
  return `<section class="m-work" aria-labelledby="reference-heading">
      <div class="m-section-lead">
        <div class="m-stack">
          <span class="m-label">Underneath</span>
          <h2 id="reference-heading" class="m-section-heading">What Meridian knows about this artist</h2>
          <p class="m-copy">The research these answers are drawn from, by part of the artist, with the sources behind each entry.</p>
        </div>
        <a class="m-button" href="./artist.html">Open the research</a>
      </div>
    </section>`;
}

function render() {
  locationBar.innerHTML = view.tour
    ? `<span class="m-meta">ACTIVE TOUR</span><span class="m-state m-state--current">${escape(view.tour.name)}</span>`
    : "";
  root.innerHTML = `<header class="m-job-header">
      <div class="m-job-header__copy">
        <span class="m-label">Higher Roads only</span>
        <h1 class="m-heading">Artist Intelligence</h1>
        <p class="m-copy">Four things you can ask about this artist. Every answer carries the research it came from.</p>
      </div>
    </header>
    ${view.message ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
    ${asks()}
    ${result()}
    ${reference()}`;
}

async function loadRuns() {
  if (!view.sceneId) {
    view.analyses = [];
    view.runId = "";
    return;
  }
  view.loadingRuns = true;
  render();
  try {
    const { analyses } = await call("get-scene-ideas", { assignmentId: view.sceneId });
    view.analyses = Array.isArray(analyses) ? analyses : [];
    view.runId = view.analyses.length ? view.analyses[view.analyses.length - 1].runId : "";
  } catch (error) {
    view.analyses = [];
    view.runId = "";
    view.message = error.message;
  }
  view.loadingRuns = false;
  render();
}

async function run() {
  if (!view.sceneId || view.running) return;
  view.running = true;
  view.message = "";
  render();
  try {
    const { analyses } = await call("run-scene-ideas", { assignmentId: view.sceneId });
    view.analyses = Array.isArray(analyses) ? analyses : [];
    view.runId = view.analyses.length ? view.analyses[view.analyses.length - 1].runId : "";
  } catch (error) {
    view.message = error.message;
  }
  view.running = false;
  render();
}

async function download(runId) {
  try {
    const { filename, document: body } = await call("get-concept-packet", { assignmentId: view.sceneId, runId });
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    view.message = error.message;
    render();
  }
}

document.addEventListener("change", (event) => {
  if (event.target && event.target.id === "scene-choice") {
    view.sceneId = event.target.value;
    void loadRuns();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-run")) void run();
  if (target.hasAttribute("data-packet")) void download(target.getAttribute("data-packet"));
  if (target.hasAttribute("data-run-id")) {
    view.runId = target.getAttribute("data-run-id");
    render();
  }
});

async function load() {
  const { user } = await call("get-me");
  view.user = user;
  if (user.role !== "higher-roads") {
    root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">This part of Meridian is for the Higher Roads team.</p></div>`;
    return;
  }
  if (!TOUR_ID) {
    view.message = "Start a tour in Tour details before asking about a Scene.";
    render();
    return;
  }
  const { tour, assignments } = await call("get-tour");
  view.tour = tour;
  view.scenes = submittedScenes(assignments || []);
  view.sceneId = view.scenes.length ? view.scenes[0].id : "";
  render();
  await loadRuns();
}

load().catch((error) => {
  locationBar.innerHTML = "";
  root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
});
