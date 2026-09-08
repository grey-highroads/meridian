import { day, escape, evidenceGroup, pad, readActions, readFromBlock, researchLineage, SUBJECT_FALLBACK } from "./ideas-view.js";

// How an Artboard check reads.
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

// The three groups, in the word the reader uses for what this project is
// about. The keys never move; only the sentences do.
export function groups(word = SUBJECT_FALLBACK) {
  return [
    {
      key: "alignment",
      heading: `Where it matches this ${word}'s history`,
      copy: `What the Artboard holds of this ${word}'s past work and of the direction it was made for.`,
    },
    {
      key: "departure",
      heading: "Where it goes somewhere new",
      copy: "What it does instead, and what that costs or opens up.",
    },
    {
      key: "prohibition",
      heading: `What this ${word} stays away from`,
      copy: `What is in the Artboard, and which part of this ${word}'s history it runs into.`,
    },
  ];
}

export function entryBlock(entry, evidence, action = null, word = SUBJECT_FALLBACK) {
  const byId = new Map(evidence.map((row) => [row.findingId, row]));
  const cited = (entry.restsOn || []).map((id) => byId.get(id)).filter(Boolean);
  return `<article class="m-intelligence-principle">
      <h4 class="m-copy m-copy--large">${escape(entry.title)}</h4>
      ${entry.note ? `<p class="m-copy">${escape(entry.note)}</p>` : ""}
      ${evidenceGroup(cited, word)}
      ${action ? readActions("board", action.scope, "Observation") : ""}
    </article>`;
}

// A group with nothing in it writes no heading over a void.
export function groupBlock(group, entries, evidence, prefix = "board", reading = true, word = SUBJECT_FALLBACK) {
  if (!entries.length) return "";
  const count = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  const id = `${prefix}-${group.key}`;
  if (!reading) {
    return `<section aria-labelledby="${escape(id)}">
      <div class="m-section-lead">
        <div class="m-section-lead__copy">
          <h3 class="m-section-heading" id="${escape(id)}">${escape(group.heading)}</h3>
          <p class="m-copy">${escape(group.copy)}</p>
        </div>
        <span class="m-meta">${escape(count).toUpperCase()}</span>
      </div>
      <div class="m-intelligence-principles">${entries.map((entry) => entryBlock(entry, evidence, null, word)).join("")}</div>
    </section>`;
  }
  return `<section class="m-intelligence-read-group" aria-labelledby="${escape(id)}">
      <div class="m-intelligence-read-group__head">
        <div class="m-intelligence-read-group__intro">
          <h3 class="m-intelligence-read-group__heading" id="${escape(id)}">${escape(group.heading)}</h3>
          <p class="m-copy">${escape(group.copy)}</p>
        </div>
        <span class="m-meta">${escape(count).toUpperCase()}</span>
      </div>
      <div class="m-intelligence-principles">${entries.map((entry, index) => entryBlock(entry, evidence, { scope: `${group.key}:${index}` }, word)).join("")}</div>
    </section>`;
}

export function groupsOf(analysis, prefix, reading = true, word = SUBJECT_FALLBACK) {
  const evidence = Array.isArray(analysis.evidence) ? analysis.evidence : [];
  const result = analysis.result || {};
  return groups(word)
    .map((group) => groupBlock(group, Array.isArray(result[group.key]) ? result[group.key] : [], evidence, prefix, reading, word))
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
  return groups().reduce((total, group) =>
    total + (Array.isArray(result[group.key]) ? result[group.key].length : 0), 0);
}

function lineageOf(analysis) {
  return [
    `RUN ${pad(analysis.run)}`,
    day(analysis.ranAt).toUpperCase(),
    `TOUR DIRECTION V${pad(analysis.directionVersion)}`,
    researchLineage(analysis),
  ].join(" / ");
}

export function renderBoardReview(analysis, picker = "", word = SUBJECT_FALLBACK) {
  const subject = analysis.subject || {};
  const entries = entryCount(analysis);
  const count = `${entries} ${entries === 1 ? "entry" : "entries"}`;
  return `<section class="m-intelligence-results" aria-labelledby="result-heading">
      <div class="m-intelligence-results__handoff">
        <span class="m-label">Artboard check</span>
        <span class="m-meta">${escape(count).toUpperCase()}</span>
      </div>
      <header class="m-intelligence-reader__head m-intelligence-read__head">
        <div class="m-stack">
          <span class="m-meta" id="result-heading">${escape(String(subject.sceneTitle || "THIS SCENE").toUpperCase())} / ARTBOARD V${pad(subject.artboardVersion)}</span>
          <span class="m-meta m-intelligence-read__lineage">${escape(lineageOf(analysis))}</span>
          <p class="m-copy">${analysis.brainApprovedAt
            ? `How this Artboard compares to this ${escape(word)}'s history and the direction it was made for.`
            : "How this Artboard compares to the direction it was made for and the brief it was built from."} Nothing here decides anything, and presenting to the client is the same one click either way.</p>
          ${readFromBlock(analysis)}
        </div>
        ${picker}
      </header>
      <div class="m-intelligence-read">
        ${groupsOf(analysis, "board", true, word)}
        ${listBlock("Open questions", (analysis.result || {}).openQuestions)}
        ${readActions("board", "whole", "Whole read")}
      </div>
    </section>`;
}

// The same record, read where the decision is made. It sits under Present to
// client as recruited context, closed until asked for, and the action above it
// never waits on it.
export function renderBoardReviewInDrawer(analysis, word = SUBJECT_FALLBACK) {
  if (!analysis) {
    return `<p class="m-copy">This Artboard has not been checked yet.</p>
      <div class="m-drawer__actions"><button class="m-button m-button--small" type="button" data-read-board>Check this Artboard</button></div>`;
  }
  const entries = entryCount(analysis);
  const count = `${entries} ${entries === 1 ? "entry" : "entries"}`;
  return `<div class="m-stack">
      <span class="m-meta">${escape(`RUN ${pad(analysis.run)} / ${day(analysis.ranAt).toUpperCase()} / ${count.toUpperCase()}`)}</span>
      ${groupsOf(analysis, "drawer-board", false, word)}
      ${listBlock("Open questions", (analysis.result || {}).openQuestions)}
      <div class="m-drawer__actions"><button class="m-button m-button--small" type="button" data-read-board>Check it again</button></div>
    </div>`;
}
