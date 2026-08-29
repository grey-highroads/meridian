import { TOUR_ID, scopedBody } from "./context.js";
import { escape, pad, renderIdeas } from "./intelligence/ideas-view.js";
import { renderAsks } from "./intelligence/asks-view.js";
import { renderDirectionRead } from "./intelligence/direction-view.js";

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

// Two jobs now answer on this page and one answer area holds them. The page
// reads whichever job answered most recently, and the other job's answers are
// one named control away in the head of the answer that is showing. A person
// who never asked the second question never sees a control for it.
const SCENE_IDEAS = "scene-ideas";
const DIRECTION_READ = "direction-read";

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
  // Which answer the reader is looking at.
  activeJob: SCENE_IDEAS,
  // Job two. Runs are kept against the direction version they read, so a run
  // label names its version as well as its number.
  reading: false,
  directionVersion: null,
  directionAnalyses: [],
  directionRunId: "",
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
    ? `<div class="m-intelligence-instrument__controls">
        <label class="m-field"><span class="m-label">Scene</span>${sceneOptions()}</label>
        <button class="m-button m-button--primary" type="button" data-run ${view.running ? "disabled" : ""}>${view.running ? "Working" : "Ask for ideas"}</button>
      </div>`
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
      control: directionControl(),
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

// The direction read's action names what it will read and which version of it,
// so the version is attached to the control and not only to the answer.
function directionControl() {
  if (!view.directionVersion) return `<span class="m-state">No direction yet</span>`;
  const version = `V${pad(view.directionVersion)}`;
  return `<button class="m-button m-button--primary" type="button" data-read ${view.reading ? "disabled" : ""}>${view.reading ? "Reading" : `Read direction ${escape(version)}`}</button>`;
}

// The run a person is reading is named and is not a control, because there is
// nothing to press to arrive where you already are. Earlier runs are the
// buttons. That is the difference in words and in available actions rather than
// in color alone.
function picker(analyses, currentId, attribute, label) {
  if (analyses.length < 2) return "";
  const rows = analyses.slice().reverse().map((entry) => {
    const name = label(entry);
    if (entry.runId === currentId) return `<span class="m-state m-state--current" aria-current="true">${escape(name)}</span>`;
    return `<button class="m-button m-button--small" type="button" ${attribute}="${escape(entry.runId)}">${escape(name)}</button>`;
  }).join("");
  return rows;
}

// The way to the other job's answer, offered only when that job has one.
function otherAnswer() {
  if (view.activeJob === SCENE_IDEAS) {
    if (!view.directionAnalyses.length) return "";
    return `<button class="m-button m-button--small" type="button" data-open-job="${DIRECTION_READ}">Open the direction read</button>`;
  }
  if (!view.analyses.length) return "";
  return `<button class="m-button m-button--small" type="button" data-open-job="${SCENE_IDEAS}">Open the Scene ideas</button>`;
}

function headControls(rows) {
  const other = otherAnswer();
  if (!rows && !other) return "";
  return `<div class="m-cluster">${rows}${other}</div>`;
}

function currentAnalysis() {
  if (!view.analyses.length) return null;
  return view.analyses.find((entry) => entry.runId === view.runId) || view.analyses[view.analyses.length - 1];
}

function currentDirectionAnalysis() {
  if (!view.directionAnalyses.length) return null;
  return view.directionAnalyses.find((entry) => entry.runId === view.directionRunId)
    || view.directionAnalyses[view.directionAnalyses.length - 1];
}

// Nothing has been asked yet. This is the answer region before it holds an
// answer, so it reads like the answer region and not like a card announcing an
// empty database. The instruments above already say what can be asked, so the
// line here says what happens to an answer once one exists.
//
// The card this replaced used m-empty-state--compact with no m-empty-state__visual,
// and that pattern is a two-column grid of a visual and a body. The body landed
// in the 7rem visual column, so the heading broke across three lines and the
// sentence ran about ten characters wide.
//
// With nothing stored for the job being read, the way to the other job's answer
// still has to be here. Otherwise a person whose Scene has no ideas cannot
// reach a direction read they already ran.
function emptyResult() {
  const other = otherAnswer();
  return `<section class="m-intelligence-results" aria-labelledby="result-heading">
      <div class="m-intelligence-results__handoff">
        <span class="m-label" id="result-heading">No answer yet</span>
      </div>
      <div class="m-stack">
        <p class="m-copy">Ask one of the questions above. What comes back is kept here, and asking again keeps the earlier answer too.</p>
        ${other ? `<div class="m-cluster">${other}</div>` : ""}
      </div>
    </section>`;
}

function result() {
  if (view.loadingRuns) return "";
  if (view.activeJob === DIRECTION_READ) {
    const analysis = currentDirectionAnalysis();
    if (!analysis) return emptyResult();
    const rows = picker(
      view.directionAnalyses,
      analysis.runId,
      "data-direction-run-id",
      (entry) => `V${pad(entry.directionVersion)} run ${pad(entry.run)}`,
    );
    return renderDirectionRead(analysis, headControls(rows));
  }
  const analysis = currentAnalysis();
  if (!analysis) return emptyResult();
  const rows = picker(view.analyses, analysis.runId, "data-run-id", (entry) => `Run ${pad(entry.run)}`);
  return renderIdeas(analysis, headControls(rows), view.ideaMessages);
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

async function readTheDirection() {
  if (view.reading || !view.directionVersion) return;
  view.reading = true;
  view.message = "";
  render();
  try {
    const { analyses } = await call("run-direction-read");
    view.directionAnalyses = Array.isArray(analyses) ? analyses : [];
    view.directionRunId = view.directionAnalyses.length
      ? view.directionAnalyses[view.directionAnalyses.length - 1].runId
      : "";
    view.activeJob = DIRECTION_READ;
  } catch (error) {
    view.message = error.message;
  }
  view.reading = false;
  render();
}

async function loadDirectionRuns() {
  try {
    const body = await call("get-direction-read");
    view.directionVersion = body.directionVersion || null;
    view.directionAnalyses = Array.isArray(body.analyses) ? body.analyses : [];
    view.directionRunId = view.directionAnalyses.length
      ? view.directionAnalyses[view.directionAnalyses.length - 1].runId
      : "";
  } catch (error) {
    view.directionAnalyses = [];
    view.directionRunId = "";
    view.message = error.message;
  }
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
    view.activeJob = SCENE_IDEAS;
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
    view.activeJob = SCENE_IDEAS;
    void loadRuns();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-run")) void run();
  if (target.hasAttribute("data-read")) void readTheDirection();
  if (target.hasAttribute("data-open-job")) {
    view.activeJob = target.getAttribute("data-open-job");
    render();
  }
  if (target.hasAttribute("data-direction-run-id")) {
    view.directionRunId = target.getAttribute("data-direction-run-id");
    render();
  }
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
  await Promise.all([loadRuns(), loadDirectionRuns()]);
  // Arrive on the answer that came back most recently. A person returning to
  // this page is usually carrying on with what they were last doing, and this
  // needs no mode for them to learn.
  const ideas = currentAnalysis();
  const direction = currentDirectionAnalysis();
  if (direction && (!ideas || Date.parse(direction.ranAt) > Date.parse(ideas.ranAt))) {
    view.activeJob = DIRECTION_READ;
  }
  render();
}

load().catch((error) => {
  locationBar.innerHTML = "";
  root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
});
