import { sourceLine } from "../../src/intelligence/concept-packet.js";
import { findingStatement } from "../../src/artist/finding.js";

// How a run of ideas reads on the page.
//
// Browser rendering lives under app/. This module sits here rather than in the
// domain layer, and a test importing it does not change that: testability is
// not a reason to move an interface into src/. Ruled 2026-08-28.
//
// The rules the composition holds to:
//
//   One column at one measure. The ideas stack.
//   The largest text inside a run is an idea's title. The run and its lineage
//   are context and sit small above the first idea.
//   Emphasis comes from the order and the scale. No weight scattered through
//   running text.
//   The evidence cluster is recruited once, after the idea. A second
//   disclosure appears only when a trail carries actual sources.
//   Feedback appears beside the action that produced it.

export function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function pad(value) {
  return String(Number(value) || 0).padStart(2, "0");
}

export function day(value) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return "not recorded";
  return parsed.toISOString().slice(0, 10);
}

// Old stored runs may still carry the intake file's bold markers and its
// bookkeeping tail. The shared finding boundary removes both for readers.
export function findingText(text) {
  return findingStatement(text);
}

// Whether a stored finding carries anything a person could open. Counts and
// tiers are a summary of the trail, not the trail, so they never earn a
// disclosure. Claims with their sources are the trail.
export function hasSourceDetail(entry) {
  const claims = Array.isArray(entry && entry.claims) ? entry.claims : [];
  const sources = Array.isArray(entry && entry.sources) ? entry.sources : [];
  return claims.length > 0 || sources.length > 0;
}

function sourceItems(entry) {
  const sources = Array.isArray(entry.sources) ? entry.sources : [];
  const claims = Array.isArray(entry.claims) ? entry.claims : [];
  if (claims.length) {
    return claims.map((claim) => {
      const source = sources.find((row) => row.id === claim.sourceId);
      const named = source && source.url
        ? ` <a href="${escape(source.url)}" rel="noopener" target="_blank">${escape(source.title)}</a>`
        : ` ${escape((source && source.title) || claim.sourceRef || "Source not recorded")}`;
      return `<li class="m-copy">${escape(claim.text)}.${named}</li>`;
    }).join("");
  }
  return sources.map((source) => (source.url
    ? `<li class="m-copy"><a href="${escape(source.url)}" rel="noopener" target="_blank">${escape(source.title)}</a></li>`
    : `<li class="m-copy">${escape(source.title)}</li>`)).join("");
}

// One thing the artist's record says, under the idea it supports.
//
// Once the evidence cluster is recruited, the finding and why it belongs here
// are read in full. What degrades is the trail. With counts and tiers alone it
// is a quiet static line that does not invite another click. With real sources
// behind it, the same line becomes a disclosure that opens onto those sources.
export function evidenceEntry(entry) {
  const trail = sourceLine(entry);
  const detail = hasSourceDetail(entry);
  const body = `<p class="m-copy">${escape(findingText(entry.text))}</p>
      ${entry.why ? `<p class="m-copy">${escape(entry.why)}</p>` : ""}`;
  if (!detail) {
    return `<div class="m-stack">
      ${body}
      <span class="m-meta">${escape(trail).toUpperCase()}</span>
    </div>`;
  }
  return `<div class="m-stack">
      ${body}
      <details class="m-evidence-item">
        <summary><span class="m-meta">${escape(trail).toUpperCase()} / OPEN THE SOURCES</span></summary>
        <div class="m-evidence-item__body"><ul>${sourceItems(entry)}</ul></div>
      </details>
    </div>`;
}

export function evidenceGroup(cited) {
  const unique = [...new Map(cited.map((entry) => [entry.findingId, entry])).values()];
  if (!unique.length) return "";
  const count = `${unique.length} ${unique.length === 1 ? "finding" : "findings"}`;
  return `<details class="m-intelligence-evidence">
      <summary>
        <span class="m-intelligence-evidence__summary">
          <span class="m-label">What this rests on in the artist's history</span>
          <span class="m-meta">${escape(count).toUpperCase()}</span>
        </span>
      </summary>
      <div class="m-intelligence-evidence__body">${unique.map(evidenceEntry).join("")}</div>
    </details>`;
}

// Feedback from an action sits with the action, so a person who pressed a
// button low on the page reads the answer where they are looking. It is a live
// region, so it is not silent to a screen reader either.
export function actionFeedback(message) {
  return `<span class="m-meta" role="status" aria-live="polite" data-idea-feedback>${escape(message || "")}</span>`;
}

// One idea, read top to bottom: what it is called, what it is, the three notes
// that qualify it, what it rests on, and the two things a person does with it.
export function ideaBlock(direction, index, evidence, message = "") {
  const byId = new Map(evidence.map((entry) => [entry.findingId, entry]));
  const cited = (direction.rhymesWith || []).map((id) => byId.get(id)).filter(Boolean);
  const notes = [
    direction.whyThisArtist ? `Why this artist: ${direction.whyThisArtist}` : "",
    direction.asksOfProduction ? `What it asks of production: ${direction.asksOfProduction}` : "",
    direction.whereItMightMiss ? `Where it might miss: ${direction.whereItMightMiss}` : "",
  ].filter(Boolean);
  return `<article class="m-intelligence-principle" data-idea="${escape(String(index))}">
      <span class="m-meta">IDEA ${escape(pad(index + 1))}</span>
      <h3 class="m-intelligence-principle__heading">${escape(direction.title)}</h3>
      <p class="m-intelligence-principle__copy">${escape(direction.idea)}</p>
      ${notes.length ? `<div class="m-stack">${notes.map((note) => `<p class="m-copy">${escape(note)}</p>`).join("")}</div>` : ""}
      ${evidenceGroup(cited)}
      <div class="m-cluster">
        <button class="m-button m-button--small" type="button" data-idea-download="${escape(String(index))}">Download idea</button>
        <button class="m-button m-button--small" type="button" data-idea-copy="${escape(String(index))}">Copy idea</button>
        ${actionFeedback(message)}
      </div>
    </article>`;
}

export function listBlock(heading, items) {
  if (!items || !items.length) return "";
  return `<section class="m-intelligence-principle">
      <span class="m-meta">${escape(String(heading).toUpperCase())}</span>
      <ul>${items.map((entry) => `<li class="m-copy">${escape(entry)}</li>`).join("")}</ul>
    </section>`;
}

export function renderIdeas(analysis, picker = "", messages = {}) {
  const evidence = Array.isArray(analysis.evidence) ? analysis.evidence : [];
  const result = analysis.result || {};
  const directions = Array.isArray(result.directions) ? result.directions : [];
  const subject = analysis.subject || {};
  const lineage = [
    `RUN ${pad(analysis.run)}`,
    day(analysis.ranAt).toUpperCase(),
    `TOUR DIRECTION V${pad(analysis.directionVersion)}`,
    `ARTIST KNOWLEDGE APPROVED ${day(analysis.brainApprovedAt).toUpperCase()}`,
  ].join(" / ");
  const count = `${directions.length} ${directions.length === 1 ? "idea" : "ideas"}`;
  return `<section class="m-intelligence-results" aria-labelledby="result-heading">
      <div class="m-intelligence-results__handoff">
        <span class="m-label">Generated ideas</span>
        <span class="m-meta">${escape(count).toUpperCase()}</span>
      </div>
      <header class="m-intelligence-reader__head">
        <div class="m-stack">
          <span class="m-meta" id="result-heading">IDEAS FOR ${escape(String(subject.sceneTitle || "this Scene").toUpperCase())}</span>
          <span class="m-meta">${escape(lineage)}</span>
          <p class="m-copy">Starting points. Nothing here has been decided or approved.</p>
        </div>
        ${picker}
      </header>
      <div class="m-intelligence-principles">
        ${directions.map((direction, index) => ideaBlock(direction, index, evidence, messages[index])).join("")}
        ${listBlock("What this artist stays away from", result.avoidNotes)}
        ${listBlock("Open questions", result.openQuestions)}
      </div>
    </section>`;
}
