import { TOUR_ID, scopedBody } from "./context.js";
import { escape, pad, renderIdeas } from "./intelligence/ideas-view.js";
import { renderAsks } from "./intelligence/asks-view.js";

// Intelligence. Four things a Higher Roads person can ask about the
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
  // Feedback from an idea's own actions, keyed by the idea it belongs to. The
  // page-level callout is for page-level failures, and an error from a button
  // low on the page rendered up there is an error nobody reads.
  ideaMessages: {},
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

function asks() {
  const ready = view.scenes.length > 0;
  const ideaControl = ready
    ? `<label class="m-field"><span class="m-label">Scene</span>${sceneOptions()}</label>
      <button class="m-button m-button--primary" type="button" data-run ${view.running ? "disabled" : ""}>${view.running ? "Working" : "Ask for ideas"}</button>`
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
  return renderAsks(rows);
}

function runPicker() {
  if (view.analyses.length < 2) return "";
  const rows = view.analyses.slice().reverse().map((entry) => {
    const here = entry.runId === view.runId;
    return `<button class="m-button m-button--small" type="button" data-run-id="${escape(entry.runId)}"${here ? ' aria-current="true"' : ""}>Run ${escape(pad(entry.run))}</button>`;
  }).join("");
  return `<div class="m-cluster">${rows}</div>`;
}

function currentAnalysis() {
  if (!view.analyses.length) return null;
  return view.analyses.find((entry) => entry.runId === view.runId) || view.analyses[view.analyses.length - 1];
}

function result() {
  if (view.loadingRuns) return "";
  const analysis = currentAnalysis();
  if (!analysis) {
    return `<section class="m-empty-state m-empty-state--action m-empty-state--compact">
        <div class="m-empty-state__body">
          <h2 class="m-section-heading">Nothing asked for this Scene yet</h2>
          <p class="m-copy">Pick a Scene above and ask. What comes back is kept, and asking again keeps the earlier answer too.</p>
        </div>
      </section>`;
  }
  return renderIdeas(analysis, runPicker(), view.ideaMessages);
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
        <h1 class="m-heading">Intelligence</h1>
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
    view.ideaMessages = {};
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
    view.ideaMessages = {};
    const { analyses } = await call("run-scene-ideas", { assignmentId: view.sceneId });
    view.analyses = Array.isArray(analyses) ? analyses : [];
    view.runId = view.analyses.length ? view.analyses[view.analyses.length - 1].runId : "";
  } catch (error) {
    view.message = error.message;
  }
  view.running = false;
  render();
}

// A person takes one idea away, so both actions ask the server for that one
// idea and get the same words either way. The stored run is untouched by
// either; this is what leaves, not what Meridian keeps.
async function packetFor(index) {
  const analysis = currentAnalysis();
  return await call("get-concept-packet", {
    assignmentId: view.sceneId,
    runId: analysis ? analysis.runId : "",
    directionIndex: Number(index),
  });
}

// The answer is written into the idea that asked, and only that idea repaints,
// so a person reading an idea at the bottom of the page stays where they are.
function sayInIdea(index, message) {
  view.ideaMessages = { ...view.ideaMessages, [index]: message };
  const slot = root.querySelector(`[data-idea="${index}"] [data-idea-feedback]`);
  if (slot) slot.textContent = message;
  else render();
}

async function downloadIdea(index) {
  try {
    const { filename, document: body } = await packetFor(index);
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    sayInIdea(index, "Downloaded.");
  } catch (error) {
    sayInIdea(index, error.message);
  }
}

async function copyIdea(index) {
  try {
    const { document: body } = await packetFor(index);
    await navigator.clipboard.writeText(body);
    sayInIdea(index, "Copied to your clipboard.");
  } catch (error) {
    sayInIdea(index, error.message);
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
  if (target.hasAttribute("data-idea-download")) void downloadIdea(Number(target.getAttribute("data-idea-download")));
  if (target.hasAttribute("data-idea-copy")) void copyIdea(Number(target.getAttribute("data-idea-copy")));
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
