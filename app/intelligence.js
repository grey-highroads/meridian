import { TOUR_ID, scopedBody } from "./context.js";
import { TOUR_LABEL } from "./label.js";
import { escape, pad, renderIdeas } from "./intelligence/ideas-view.js";
import { renderAsks } from "./intelligence/asks-view.js";
import { renderDirectionRead } from "./intelligence/direction-view.js";
import { renderBoardReview } from "./intelligence/board-view.js";

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

// Three jobs now answer on this page and one answer area holds them. Each
// instrument owns the way back to its latest answer. The answer head carries
// only history inside the job on screen, so two different axes never become
// one row of identical controls.
const SCENE_IDEAS = "scene-ideas";
const DIRECTION_READ = "direction-read";
const BOARD_REVIEW = "board-review";

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
  // Job three. The subject is one version of one Scene's work, so the choice
  // names both and runs are kept against the version they read.
  boards: [],
  boardKey: "",
  reviewing: false,
  boardAnalyses: [],
  boardRunId: "",
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

// A job with no subject. Two of the four instruments run on the job's own
// material and one needs a history to compare against, so that one says what it
// is missing in the same voice the tour stops instrument uses. Ruled 2026-09-05.
function hasSubject() {
  if (!view.tour) return false;
  const ids = Array.isArray(view.tour.subjectIds) ? view.tour.subjectIds : [];
  return Boolean(view.tour.artistId || ids.length);
}

function asks() {
  const ready = view.scenes.length > 0;
  const ideaControl = ready
    ? `<div class="m-intelligence-instrument__controls">
        <label class="m-field"><span class="m-label">Scene</span>${sceneOptions()}</label>
        <button class="${askTreatment(view.analyses)}" type="button" data-run ${view.running ? "disabled" : ""}>${view.running ? "Working" : "Ask for ideas"}</button>
      </div>`
    : `<span class="m-state m-state--current">No Scene yet</span>`;
  const rows = [
    {
      mark: "ideas",
      title: "Ideas for a Scene",
      copy: ready
        ? (hasSubject()
          ? "Starting points drawn from this artist's history, with the research behind each one."
          : "Starting points drawn from the direction and what the Scene asks for. This job has no subject, so no research sits behind them.")
        : "Submit a Scene request first. Ideas are drawn from what the Scene asks for.",
      control: ideaControl,
      answer: answerDoor(SCENE_IDEAS, view.analyses, view.runId, (entry) => `Ideas run ${pad(entry.run)}`),
    },
    {
      mark: "compare",
      title: "Compare the tour direction to this artist's history",
      copy: hasSubject()
        ? "Where the direction matches what this artist has done before, where it goes somewhere new, and which older work it echoes."
        : "Needs research about who the work is for. This job has no subject, so there is no history to compare the direction against.",
      control: directionControl(),
      answer: answerDoor(
        DIRECTION_READ,
        view.directionAnalyses,
        view.directionRunId,
        (entry) => `Direction V${pad(entry.directionVersion)}, run ${pad(entry.run)}`,
      ),
    },
    {
      mark: "artboard",
      title: "Check an Artboard before you present it",
      copy: view.boards.length
        ? (hasSubject()
          ? "How a finished Artboard compares to this artist's history and the direction it was made for. It does not decide anything."
          : "How a finished Artboard compares to the direction it was made for and the brief it was built from. It does not decide anything.")
        : "Meridian can check work submitted as a PNG or a JPEG. Nothing has come back yet.",
      control: boardControl(),
      answer: answerDoor(
        BOARD_REVIEW,
        view.boardAnalyses,
        view.boardRunId,
        (entry) => `Artboard V${pad((entry.subject || {}).artboardVersion)}, run ${pad(entry.run)}`,
      ),
    },
    {
      mark: "stops",
      title: "Check the tour stops",
      copy: "Needs venue and screen specifications as fields rather than prose. There is nothing to compare yet.",
      control: `<span class="m-state">Waiting on tour data</span>`,
    },
  ];
  return renderAsks(rows, { answered: anyAnswer() });
}

// One page-level fact drives two things: the four instruments reserve an answer
// row so they read as a set, and they give back the room they took while the
// page had nothing to show. On a first visit neither applies, because four
// empty rows would be dead space in the viewport the answer needs.
function anyAnswer() {
  return Boolean(view.analyses.length || view.directionAnalyses.length || view.boardAnalyses.length);
}

// A completed instrument is the door back to its own answer, and an answer that
// exists outranks asking for it again. So the way back takes the primary
// treatment and leads the row, and the run it names is metadata behind it. The
// run label never shares a type treatment with the control, which is what the
// first build got wrong: quiet muted text beside two other pieces of small
// muted text, none of them looking like the only control on the card.
//
// When the answer below is already this run, there is nothing to press to
// arrive where you are, so it reads as a state. That is the same grammar the
// run history uses: the place you are is a state, the place you can reach is a
// control.
function answerDoor(job, analyses, currentId, label) {
  if (!analyses.length) return "";
  const latest = analyses[analyses.length - 1];
  const showing = view.activeJob === job && currentId === latest.runId;
  const door = showing
    ? `<span class="m-state m-state--current">Showing below</span>`
    : `<button class="m-button m-button--primary" type="button" data-open-job="${job}">Read answer</button>`;
  return `${door}<span class="m-meta">${escape(label(latest).toUpperCase())}</span>`;
}

// Asking again steps down once the job holds an answer. The cobalt edge is the
// loudest thing on a card and it belongs to whichever of the two a person is
// more likely to want.
function askTreatment(analyses) {
  return analyses.length ? "m-button" : "m-button m-button--primary";
}

// The direction read's action names what it will read and which version of it,
// so the version is attached to the control and not only to the answer.
function directionControl() {
  if (!hasSubject()) return `<span class="m-state">Waiting on subject research</span>`;
  if (!view.directionVersion) return `<span class="m-state">No direction yet</span>`;
  const version = `V${pad(view.directionVersion)}`;
  return `<button class="${askTreatment(view.directionAnalyses)}" type="button" data-read ${view.reading ? "disabled" : ""}>${view.reading ? "Comparing" : `Compare direction ${escape(version)}`}</button>`;
}

// One version of one Scene's work is what a read is about, so the choice names
// both and the action reads whichever one is chosen. Newest work first.
export function boardKeyFor(sceneId, artboardVersion) {
  return `${sceneId}::${artboardVersion}`;
}

function boardOptions() {
  const rows = view.boards.map((board) => {
    const key = boardKeyFor(board.sceneId, board.artboardVersion);
    const name = `${board.sceneTitle}, V${pad(board.artboardVersion)}`;
    return `<option value="${escape(key)}"${key === view.boardKey ? " selected" : ""}>${escape(name)}</option>`;
  }).join("");
  return `<select class="m-select" id="board-choice" aria-label="Artboard version">${rows}</select>`;
}

function boardControl() {
  if (!view.boards.length) return `<span class="m-state">No Artboard yet</span>`;
  return `<div class="m-intelligence-instrument__controls">
      <label class="m-field"><span class="m-label">Version</span>${boardOptions()}</label>
      <button class="${askTreatment(view.boardAnalyses)}" type="button" data-review ${view.reviewing ? "disabled" : ""}>${view.reviewing ? "Checking" : "Check this Artboard"}</button>
    </div>`;
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

function runHistory(rows) {
  if (!rows) return "";
  return `<div class="m-intelligence-run-history">
      <span class="m-label">Run history</span>
      <div class="m-cluster">${rows}</div>
    </div>`;
}

function currentAnalysis() {
  if (!view.analyses.length) return null;
  return view.analyses.find((entry) => entry.runId === view.runId) || view.analyses[view.analyses.length - 1];
}

function currentBoardAnalysis() {
  if (!view.boardAnalyses.length) return null;
  return view.boardAnalyses.find((entry) => entry.runId === view.boardRunId)
    || view.boardAnalyses[view.boardAnalyses.length - 1];
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
function emptyResult() {
  return `<section class="m-intelligence-results" aria-labelledby="result-heading">
      <div class="m-intelligence-results__handoff">
        <span class="m-label" id="result-heading">No answer yet</span>
      </div>
      <div class="m-stack">
        <p class="m-copy">Ask one of the questions above. What comes back is kept here, and asking again keeps the earlier answer too.</p>
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
    return renderDirectionRead(analysis, runHistory(rows));
  }
  if (view.activeJob === BOARD_REVIEW) {
    const analysis = currentBoardAnalysis();
    if (!analysis) return emptyResult();
    const rows = picker(
      view.boardAnalyses,
      analysis.runId,
      "data-board-run-id",
      (entry) => `V${pad((entry.subject || {}).artboardVersion)} run ${pad(entry.run)}`,
    );
    return renderBoardReview(analysis, runHistory(rows));
  }
  const analysis = currentAnalysis();
  if (!analysis) return emptyResult();
  const rows = picker(view.analyses, analysis.runId, "data-run-id", (entry) => `Run ${pad(entry.run)}`);
  return renderIdeas(analysis, runHistory(rows), view.ideaMessages);
}

function reference() {
  // A job with no subject has no research underneath it, so the block that
  // points at the research says that rather than pointing at an empty page.
  if (!hasSubject()) {
    return `<section class="m-work" aria-labelledby="reference-heading">
      <div class="m-section-lead">
        <div class="m-stack">
          <span class="m-label">Underneath</span>
          <h2 id="reference-heading" class="m-section-heading">This job has no subject</h2>
          <p class="m-copy">Answers here are read from the direction, the request, and the work that comes back. Adding a subject gives them a history to draw on.</p>
        </div>
      </div>
    </section>`;
  }
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
        <p class="m-copy">${hasSubject()
          ? "Four things you can ask about this artist. Every answer carries the research it came from."
          : "Four things you can ask about this job. Each one says what it needs and runs when it has it, and every answer says what it was read from."}</p>
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

// A version can be read once its work is an image. A stand-in writes SVG, and
// the model cannot look at one, so those versions are not offered rather than
// offered and refused.
export function readableBoard(artboard) {
  const artifact = (artboard && artboard.artifact) || {};
  if (artifact.dataUrl) return /^data:image\/(?:png|jpeg);base64,/i.test(artifact.dataUrl);
  if (artifact.blobPathname) return /^image\/(?:png|jpeg)$/i.test(String(artifact.contentType || ""));
  return false;
}

async function loadBoards() {
  const rows = await Promise.all(view.scenes.map(async (scene) => {
    try {
      const { artboards } = await call("get-artboards", { assignmentId: scene.id });
      return (artboards || [])
        .filter((entry) => readableBoard(entry.artboard))
        .map((entry) => ({
          sceneId: scene.id,
          sceneTitle: scene.title,
          artboardVersion: entry.artboard.artboardVersion,
        }));
    } catch {
      return [];
    }
  }));
  // Newest work first, because the version somebody is deciding about is
  // almost always the latest one.
  view.boards = rows.flat().sort((left, right) => right.artboardVersion - left.artboardVersion);
  view.boardKey = view.boards.length ? boardKeyFor(view.boards[0].sceneId, view.boards[0].artboardVersion) : "";
}

function chosenBoard() {
  if (!view.boardKey) return null;
  const [sceneId, version] = view.boardKey.split("::");
  return { sceneId, artboardVersion: Number(version) };
}

async function loadBoardRuns() {
  const board = chosenBoard();
  if (!board) {
    view.boardAnalyses = [];
    view.boardRunId = "";
    return;
  }
  try {
    const { analyses } = await call("get-board-review", {
      assignmentId: board.sceneId,
      artboardVersion: board.artboardVersion,
    });
    view.boardAnalyses = Array.isArray(analyses) ? analyses : [];
    view.boardRunId = view.boardAnalyses.length ? view.boardAnalyses[view.boardAnalyses.length - 1].runId : "";
  } catch (error) {
    view.boardAnalyses = [];
    view.boardRunId = "";
    view.message = error.message;
  }
}

async function reviewTheBoard() {
  const board = chosenBoard();
  if (view.reviewing || !board) return;
  view.reviewing = true;
  view.message = "";
  render();
  try {
    const { analyses } = await call("run-board-review", {
      assignmentId: board.sceneId,
      artboardVersion: board.artboardVersion,
    });
    view.boardAnalyses = Array.isArray(analyses) ? analyses : [];
    view.boardRunId = view.boardAnalyses.length ? view.boardAnalyses[view.boardAnalyses.length - 1].runId : "";
    view.activeJob = BOARD_REVIEW;
  } catch (error) {
    view.message = error.message;
  }
  view.reviewing = false;
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

function exportScope(value) {
  if (value === "whole") return {};
  const [groupKey, index] = String(value || "").split(":");
  return { groupKey, entryIndex: Number(index) };
}

async function storedReadExport(kind, value) {
  const scope = exportScope(value);
  if (kind === "direction") {
    const analysis = currentDirectionAnalysis();
    return await call("get-direction-read-export", {
      directionVersion: analysis ? analysis.directionVersion : null,
      runId: analysis ? analysis.runId : "",
      ...scope,
    });
  }
  const analysis = currentBoardAnalysis();
  const subject = (analysis && analysis.subject) || {};
  return await call("get-board-review-export", {
    assignmentId: subject.sceneId || "",
    artboardVersion: subject.artboardVersion || null,
    runId: analysis ? analysis.runId : "",
    ...scope,
  });
}

function sayByExport(target, message) {
  const actions = target.closest(".m-reading-actions");
  const slot = actions && actions.querySelector("[data-export-feedback]");
  if (slot) slot.textContent = message;
}

function downloadDocument(filename, body) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadRead(kind, value, target) {
  try {
    const { filename, document: body } = await storedReadExport(kind, value);
    downloadDocument(filename, body);
    sayByExport(target, "Downloaded.");
  } catch (error) {
    sayByExport(target, error.message);
  }
}

async function copyRead(kind, value, target) {
  try {
    const { document: body } = await storedReadExport(kind, value);
    await navigator.clipboard.writeText(body);
    sayByExport(target, "Copied to your clipboard.");
  } catch (error) {
    sayByExport(target, error.message);
  }
}

document.addEventListener("change", (event) => {
  if (event.target && event.target.id === "scene-choice") {
    view.sceneId = event.target.value;
    view.activeJob = SCENE_IDEAS;
    void loadRuns();
  }
  if (event.target && event.target.id === "board-choice") {
    view.boardKey = event.target.value;
    void loadBoardRuns().then(render);
  }
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-run")) void run();
  if (target.hasAttribute("data-read")) void readTheDirection();
  if (target.hasAttribute("data-review")) void reviewTheBoard();
  if (target.hasAttribute("data-open-job")) {
    const job = target.getAttribute("data-open-job");
    view.activeJob = job;
    if (job === SCENE_IDEAS && view.analyses.length) view.runId = view.analyses[view.analyses.length - 1].runId;
    if (job === DIRECTION_READ && view.directionAnalyses.length) {
      view.directionRunId = view.directionAnalyses[view.directionAnalyses.length - 1].runId;
    }
    if (job === BOARD_REVIEW && view.boardAnalyses.length) {
      view.boardRunId = view.boardAnalyses[view.boardAnalyses.length - 1].runId;
    }
    render();
  }
  if (target.hasAttribute("data-direction-run-id")) {
    view.directionRunId = target.getAttribute("data-direction-run-id");
    render();
  }
  if (target.hasAttribute("data-board-run-id")) {
    view.boardRunId = target.getAttribute("data-board-run-id");
    render();
  }
  if (target.hasAttribute("data-idea-download")) void downloadIdea(Number(target.getAttribute("data-idea-download")));
  if (target.hasAttribute("data-idea-copy")) void copyIdea(Number(target.getAttribute("data-idea-copy")));
  if (target.hasAttribute("data-direction-download")) {
    void downloadRead("direction", target.getAttribute("data-direction-download"), target);
  }
  if (target.hasAttribute("data-direction-copy")) {
    void copyRead("direction", target.getAttribute("data-direction-copy"), target);
  }
  if (target.hasAttribute("data-board-download")) {
    void downloadRead("board", target.getAttribute("data-board-download"), target);
  }
  if (target.hasAttribute("data-board-copy")) {
    void copyRead("board", target.getAttribute("data-board-copy"), target);
  }
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
    // No tour is in scope here, so this reads the default word.
    view.message = `Start a tour in ${TOUR_LABEL} details before asking about a Scene.`;
    render();
    return;
  }
  const { tour, assignments } = await call("get-tour");
  view.tour = tour;
  view.scenes = submittedScenes(assignments || []);
  view.sceneId = view.scenes.length ? view.scenes[0].id : "";
  render();
  await Promise.all([loadRuns(), loadDirectionRuns(), loadBoards().then(loadBoardRuns)]);
  // Arrive on the answer that came back most recently. A person returning to
  // this page is usually carrying on with what they were last doing, and this
  // needs no mode for them to learn.
  const latest = [
    { job: SCENE_IDEAS, analysis: currentAnalysis() },
    { job: DIRECTION_READ, analysis: currentDirectionAnalysis() },
    { job: BOARD_REVIEW, analysis: currentBoardAnalysis() },
  ]
    .filter((entry) => entry.analysis)
    .sort((left, right) => Date.parse(right.analysis.ranAt) - Date.parse(left.analysis.ranAt))[0];
  if (latest) view.activeJob = latest.job;
  render();
}

load().catch((error) => {
  locationBar.innerHTML = "";
  root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
});
