import { day, escape, evidenceGroup, pad } from "./ideas-view.js";

// How a board review reads.
//
// Browser rendering lives under app/, the ruling that put the ideas view and
// the direction view here. The composition follows the direction view, because
// the shape of the answer is the same: three groups of observations, each entry
// carrying the findings under it, evidence recruited after the entry it
// supports.
//
// There is no verdict line, no meter, no risk level, and no sentence about
// whether to present. Reading the groups is the read, and this module has
// nowhere to put a conclusion even if a model wrote one.
//
// Two doors show the same stored record. The full read renders on Intelligence.
// The compact read renders inside the Reviews drawer, under Present to client,
// where the decision it informs is made. The groups and the evidence are
// identical in both; only the chrome around them differs.

export const GROUPS = [
  {
    key: "alignment",
    heading: "Where the board sits with the record",
    copy: "What it holds of the artist's history and the direction it was briefed against.",
  },
  {
    key: "departure",
    heading: "Where it leaves the record",
    copy: "What it does instead, and what that costs or opens up.",
  },
  {
    key: "prohibition",
    heading: "What it touches that this artist stays away from",
    copy: "What is in the board, and which part of the record it runs into.",
  },
];

export function entryBlock(entry, evidence) {
  const byId = new Map(evidence.map((row) => [row.findingId, row]));
  const cited = (entry.restsOn || []).map((id) => byId.get(id)).filter(Boolean);
  return `<article class="m-intelligence-principle">
      <h4 class="m-copy m-copy--large">${escape(entry.title)}</h4>
      ${entry.note ? `<p class="m-copy">${escape(entry.note)}</p>` : ""}
      ${evidenceGroup(cited)}
    </article>`;
}

// A group with nothing in it writes no heading over a void.
export function groupBlock(group, entries, evidence, prefix = "board") {
  if (!entries.length) return "";
  const count = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  const id = `${prefix}-${group.key}`;
  return `<section aria-labelledby="${escape(id)}">
      <div class="m-section-lead">
        <div class="m-section-lead__copy">
          <h3 class="m-section-heading" id="${escape(id)}">${escape(group.heading)}</h3>
          <p class="m-copy">${escape(group.copy)}</p>
        </div>
        <span class="m-meta">${escape(count).toUpperCase()}</span>
      </div>
      <div class="m-intelligence-principles">${entries.map((entry) => entryBlock(entry, evidence)).join("")}</div>
    </section>`;
}

export function groupsOf(analysis, prefix) {
  const evidence = Array.isArray(analysis.evidence) ? analysis.evidence : [];
  const result = analysis.result || {};
  return GROUPS
    .map((group) => groupBlock(group, Array.isArray(result[group.key]) ? result[group.key] : [], evidence, prefix))
    .join("");
}

export function listBlock(heading, items) {
  if (!items || !items.length) return "";
  return `<section class="m-intelligence-principle">
      <span class="m-meta">${escape(String(heading).toUpperCase())}</span>
      <ul>${items.map((entry) => `<li class="m-copy">${escape(entry)}</li>`).join("")}</ul>
    </section>`;
}

export function entryCount(analysis) {
  const result = analysis.result || {};
  return GROUPS.reduce((total, group) =>
    total + (Array.isArray(result[group.key]) ? result[group.key].length : 0), 0);
}

function lineageOf(analysis) {
  return [
    `RUN ${pad(analysis.run)}`,
    day(analysis.ranAt).toUpperCase(),
    `TOUR DIRECTION V${pad(analysis.directionVersion)}`,
    `ARTIST KNOWLEDGE APPROVED ${day(analysis.brainApprovedAt).toUpperCase()}`,
  ].join(" / ");
}

export function renderBoardReview(analysis, picker = "") {
  const subject = analysis.subject || {};
  const entries = entryCount(analysis);
  const count = `${entries} ${entries === 1 ? "entry" : "entries"}`;
  return `<section class="m-intelligence-results" aria-labelledby="result-heading">
      <div class="m-intelligence-results__handoff">
        <span class="m-label">Board read</span>
        <span class="m-meta">${escape(count).toUpperCase()}</span>
      </div>
      <header class="m-intelligence-reader__head">
        <div class="m-stack">
          <span class="m-meta" id="result-heading">${escape(String(subject.sceneTitle || "THIS SCENE").toUpperCase())} / ARTBOARD V${pad(subject.artboardVersion)}</span>
          <span class="m-meta">${escape(lineageOf(analysis))}</span>
          <p class="m-copy">A second read of this version from the artist's side. It decides nothing, and presenting to the client is the same one click either way.</p>
        </div>
        ${picker}
      </header>
      <div class="m-stack">
        ${groupsOf(analysis, "board")}
        ${listBlock("Open questions", (analysis.result || {}).openQuestions)}
      </div>
    </section>`;
}

// The same record, read where the decision is made. It sits under Present to
// client as recruited context, closed until asked for, and the action above it
// never waits on it.
export function renderBoardReviewInDrawer(analysis) {
  if (!analysis) {
    return `<p class="m-copy">No read has been run on this version.</p>
      <div class="m-drawer__actions"><button class="m-button m-button--small" type="button" data-read-board>Read this board</button></div>`;
  }
  const entries = entryCount(analysis);
  const count = `${entries} ${entries === 1 ? "entry" : "entries"}`;
  return `<div class="m-stack">
      <span class="m-meta">${escape(`RUN ${pad(analysis.run)} / ${day(analysis.ranAt).toUpperCase()} / ${count.toUpperCase()}`)}</span>
      ${groupsOf(analysis, "drawer-board")}
      ${listBlock("Open questions", (analysis.result || {}).openQuestions)}
      <div class="m-drawer__actions"><button class="m-button m-button--small" type="button" data-read-board>Read this board again</button></div>
    </div>`;
}
