import { sourceLine } from "./concept-packet.js";

// How a run of ideas reads on the page.
//
// It lives here rather than inside the page script so a test can assert the
// markup a person actually receives. The first version of this view was checked
// by matching strings in the source file, which is how a two-column layout with
// unequal measures and a label printed over nothing both shipped. A test that
// cannot see the rendered output cannot see a composition fault.
//
// The rules the composition holds to:
//
//   One column at one measure. The ideas stack.
//   The largest text is an idea's title. The run and its lineage are context
//   and sit small above the first idea.
//   Emphasis comes from the order and the scale. No weight scattered through
//   running text.
//   A disclosure opens onto something. Where a finding has nothing behind it
//   but its counts and tiers, those are one quiet line and no label is written
//   over a void.

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

// The intake file writes the lead sentence of an entry in bold. It reads as the
// headline here; the rest is the supporting sentence. The asterisks never reach
// the page and neither does the weight.
export function leadAndBody(text) {
  const value = String(text || "").trim();
  const marked = value.match(/^\*\*(.+?)\*\*\s*(.*)$/s);
  if (marked) return { lead: marked[1], body: marked[2].trim() };
  const sentence = value.match(/^(.+?[.!?])(?:\s+|$)(.*)$/s);
  if (sentence) return { lead: sentence[1], body: sentence[2].trim() };
  return { lead: value, body: "" };
}

export function evidenceEntry(entry) {
  const parts = leadAndBody(entry.text);
  const trail = escape(sourceLine(entry)).toUpperCase();
  return `<div class="m-stack">
      <p class="m-copy">${escape(parts.lead)}</p>
      ${entry.why ? `<p class="m-copy">${escape(entry.why)}</p>` : ""}
      ${parts.body
        ? `<details class="m-evidence-item">
            <summary><span class="m-meta">${trail}</span></summary>
            <div class="m-evidence-item__body"><p class="m-copy">${escape(parts.body)}</p></div>
          </details>`
        : `<span class="m-meta">${trail}</span>`}
    </div>`;
}

// One idea, read top to bottom: what it is called, what it is, the three notes
// that qualify it, what it rests on, and the two things a person does with it.
export function ideaBlock(direction, index, evidence) {
  const byId = new Map(evidence.map((entry) => [entry.findingId, entry]));
  const cited = (direction.rhymesWith || []).map((id) => byId.get(id)).filter(Boolean);
  const notes = [
    direction.whyThisArtist ? `Why this artist: ${direction.whyThisArtist}` : "",
    direction.asksOfProduction ? `What it asks of production: ${direction.asksOfProduction}` : "",
    direction.whereItMightMiss ? `Where it might miss: ${direction.whereItMightMiss}` : "",
  ].filter(Boolean);
  return `<article class="m-intelligence-principle">
      <span class="m-meta">IDEA ${escape(pad(index + 1))}</span>
      <h3 class="m-intelligence-principle__heading">${escape(direction.title)}</h3>
      <p class="m-intelligence-principle__copy">${escape(direction.idea)}</p>
      ${notes.length ? `<div class="m-stack">${notes.map((note) => `<p class="m-copy">${escape(note)}</p>`).join("")}</div>` : ""}
      ${cited.length ? `<div class="m-stack">${cited.map(evidenceEntry).join("")}</div>` : ""}
      <div class="m-cluster">
        <button class="m-button m-button--small" type="button" data-idea-download="${escape(String(index))}">Download idea</button>
        <button class="m-button m-button--small" type="button" data-idea-copy="${escape(String(index))}">Copy idea</button>
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

export function renderIdeas(analysis, picker = "") {
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
  return `<section aria-labelledby="result-heading">
      <header class="m-intelligence-reader__head">
        <div class="m-stack">
          <span class="m-meta" id="result-heading">IDEAS FOR ${escape(String(subject.sceneTitle || "this Scene").toUpperCase())}</span>
          <span class="m-meta">${escape(lineage)}</span>
          <p class="m-copy">Starting points. Nothing here has been decided or approved.</p>
        </div>
        ${picker}
      </header>
      <div class="m-intelligence-principles">
        ${directions.map((direction, index) => ideaBlock(direction, index, evidence)).join("")}
        ${listBlock("What this artist stays away from", result.avoidNotes)}
        ${listBlock("Open questions", result.openQuestions)}
      </div>
    </section>`;
}
