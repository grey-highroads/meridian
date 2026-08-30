import { day, escape, evidenceGroup, pad } from "./ideas-view.js";

// How a direction read reads on the page.
//
// Browser rendering lives under app/, the same ruling that put the ideas view
// here. The composition follows that view: one column at one measure, the
// entry's own words whole, evidence recruited after the entry it supports,
// controls where the reader is.
//
// The hierarchy is one step deeper than the ideas view, because an idea is a
// thing a person takes away whole and an entry here is one observation inside a
// group. So the group heading carries section scale and the entry title sits
// under it at object scale. Nothing about the ideas view changes; an idea is
// still the largest thing on its own answer.
//
// The three clusters are named in the reader's words rather than the job's. A
// cluster with nothing in it does not render its heading.
//
// There is no verdict line, no meter, and no count of how aligned the direction
// is. Reading the three groups is the read.

export const CLUSTERS = [
  {
    key: "continuity",
    heading: "What the direction keeps",
    copy: "Where it stays with who this artist has been.",
  },
  {
    key: "departure",
    heading: "Where it leaves the record",
    copy: "Where it goes somewhere the artist's record has not been.",
  },
  {
    key: "echo",
    heading: "What it echoes",
    copy: "Older themes and imagery it rhymes with, including the ones only a fan who knows the catalog would catch.",
  },
];

// One observation: what it is called, what it says, and the findings under it.
// The evidence cluster is the one the ideas view recruits, so a finding reads
// the same way whichever job cited it.
export function entryBlock(entry, evidence) {
  const byId = new Map(evidence.map((row) => [row.findingId, row]));
  const cited = (entry.restsOn || []).map((id) => byId.get(id)).filter(Boolean);
  return `<article class="m-intelligence-principle">
      <h4 class="m-copy m-copy--large">${escape(entry.title)}</h4>
      ${entry.note ? `<p class="m-copy">${escape(entry.note)}</p>` : ""}
      ${evidenceGroup(cited)}
    </article>`;
}

export function clusterBlock(cluster, entries, evidence) {
  if (!entries.length) return "";
  const count = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  return `<section aria-labelledby="cluster-${escape(cluster.key)}">
      <div class="m-section-lead">
        <div class="m-section-lead__copy">
          <h3 class="m-section-heading" id="cluster-${escape(cluster.key)}">${escape(cluster.heading)}</h3>
          <p class="m-copy">${escape(cluster.copy)}</p>
        </div>
        <span class="m-meta">${escape(count).toUpperCase()}</span>
      </div>
      <div class="m-intelligence-principles">${entries.map((entry) => entryBlock(entry, evidence)).join("")}</div>
    </section>`;
}

export function listBlock(heading, items) {
  if (!items || !items.length) return "";
  return `<section class="m-intelligence-principle">
      <span class="m-meta">${escape(String(heading).toUpperCase())}</span>
      <ul>${items.map((entry) => `<li class="m-copy">${escape(entry)}</li>`).join("")}</ul>
    </section>`;
}

export function renderDirectionRead(analysis, picker = "") {
  const evidence = Array.isArray(analysis.evidence) ? analysis.evidence : [];
  const result = analysis.result || {};
  const subject = analysis.subject || {};
  const lineage = [
    `RUN ${pad(analysis.run)}`,
    day(analysis.ranAt).toUpperCase(),
    `TOUR DIRECTION V${pad(analysis.directionVersion)}`,
    `ARTIST KNOWLEDGE APPROVED ${day(analysis.brainApprovedAt).toUpperCase()}`,
  ].join(" / ");
  const entries = CLUSTERS.reduce((total, cluster) =>
    total + (Array.isArray(result[cluster.key]) ? result[cluster.key].length : 0), 0);
  const count = `${entries} ${entries === 1 ? "entry" : "entries"}`;
  const clusters = CLUSTERS
    .map((cluster) => clusterBlock(cluster, Array.isArray(result[cluster.key]) ? result[cluster.key] : [], evidence))
    .join("");
  return `<section class="m-intelligence-results" aria-labelledby="result-heading">
      <div class="m-intelligence-results__handoff">
        <span class="m-label">Direction read</span>
        <span class="m-meta">${escape(count).toUpperCase()}</span>
      </div>
      <header class="m-intelligence-reader__head">
        <div class="m-stack">
          <span class="m-meta" id="result-heading">THE DIRECTION AGAINST THE ARTIST'S RECORD</span>
          <span class="m-meta">${escape(lineage)}</span>
          <p class="m-copy">How the director's words${subject.directionSetBy ? `, set by ${escape(subject.directionSetBy)}` : ""}, compare to everything Meridian knows about this artist. Nothing here decides anything.</p>
        </div>
        ${picker}
      </header>
      <div class="m-stack">
        ${clusters}
        ${listBlock("Open questions", result.openQuestions)}
      </div>
    </section>`;
}
