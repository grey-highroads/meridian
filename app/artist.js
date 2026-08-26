import { scopedBody } from "./context.js";

// The Artist Brain. The approved findings, grouped by part of the artist, with
// the evidence one disclosure away. It is a quiet destination: a person comes
// here to read what the system knows and to maintain it, not to do Scene work.
//
// Approval is wholesale. The operator already read and sorted every finding
// during intake, so one person approves the whole brain and then takes out the
// ones that should not be in it.

const ARTIST_ID = new URLSearchParams(window.location.search).get("artist") || "dierks-bentley";

const locationBar = document.getElementById("location");
const root = document.getElementById("artist");
const operator = document.getElementById("operator");

const view = { mode: "brain", identity: "", part: "", open: {}, provenance: false, message: "" };

const IDENTITY_LABELS = [
  { id: "", name: "Both identities" },
  { id: "main-stage", name: "Main stage" },
  { id: "hot-country-knights", name: "Hot Country Knights" },
  { id: "shared", name: "Shared" },
];

const PART_LABELS = [
  { id: "", name: "Every part of the artist" },
  { id: "CE", name: "Catalog and eras" },
  { id: "LH", name: "Live history" },
  { id: "VL", name: "Visual language" },
  { id: "BS", name: "Brand and story" },
  { id: "PB", name: "People and business" },
  { id: "AV", name: "What the brand avoids" },
];

async function call(action, extra = {}) {
  const response = await fetch("/api/artist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody({ action, artistId: ARTIST_ID, ...extra })),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// The intake file writes the lead sentence of an entry in bold. Use it as the
// principle heading and keep the supporting sentence visually secondary.
function principleParts(text) {
  const value = String(text || "").trim();
  const marked = value.match(/^\*\*(.+?)\*\*\s*(.*)$/s);
  if (marked) return { heading: marked[1], body: marked[2] };
  const sentence = value.match(/^(.+?[.!?])(?:\s+|$)(.*)$/s);
  if (sentence) return { heading: sentence[1], body: sentence[2] };
  return { heading: value, body: "" };
}

function sourceLine(finding) {
  if (!finding.independentSourceCount) return "Source count not recorded";
  const tiers = (finding.tiers || []).join(", ");
  const plural = finding.independentSourceCount === 1 ? "source" : "sources";
  const count = finding.independentSourceCount + " independent " + plural;
  return tiers ? count + ", from tier " + tiers : count;
}

function evidenceBody(finding) {
  const evidence = view.open[finding.id];
  if (!evidence) return `<p class="m-copy">Opening the sources.</p>`;
  if (!evidence.evidenceLinked) {
    return `<p class="m-copy">This rests on ${escape(sourceLine(finding).toLowerCase())}.
      The individual claims behind it were not recorded against it in this intake run, so there is nothing further to open here yet.</p>`;
  }
  const items = evidence.claims.map((claim) => {
    const source = evidence.sources.find((entry) => entry.id === claim.sourceId);
    const link = source
      ? ` <a href="${escape(source.url)}" rel="noopener" target="_blank">${escape(source.title)}</a>`
      : ` ${escape(claim.sourceRef)}`;
    return `<li class="m-copy">${escape(claim.text)}.${link}</li>`;
  }).join("");
  return `<ul>${items}</ul>`;
}

function principleBlock(entry, index) {
  const parts = principleParts(entry.text);
  return `<article class="m-intelligence-principle">
      <span class="m-meta">APPROVED PRINCIPLE ${escape(String(index + 1).padStart(2, "0"))} / ${escape(entry.identityName.toUpperCase())}</span>
      <h3 class="m-intelligence-principle__heading">${escape(parts.heading)}</h3>
      ${parts.body ? `<p class="m-intelligence-principle__copy">${escape(parts.body)}</p>` : ""}
    </article>`;
}

function evidenceItem(entry) {
  const open = view.open[entry.id] ? " open" : "";
  const parts = principleParts(entry.text);
  const controls = view.mode === "brain"
    ? ""
    : `<div class="m-cluster">${entry.inBrain
        ? `<button class="m-button m-button--small" type="button" data-remove="${escape(entry.id)}">Take out</button>`
        : `<button class="m-button m-button--small" type="button" data-restore="${escape(entry.id)}">Put back</button>`}</div>`;
  const state = entry.inBrain
    ? ""
    : `<span class="m-state m-state--change">Taken out${entry.removedBy ? ` by ${escape(entry.removedBy)}` : ""}</span>`;
  return `<details class="m-evidence-item" data-evidence="${escape(entry.id)}"${open}>
      <summary>
        <span class="m-meta">${escape(sourceLine(entry).toUpperCase())}</span>
        <span>${escape(parts.heading)}</span>
      </summary>
      <div class="m-evidence-item__body">
        ${state}
        ${open ? evidenceBody(entry) : ""}
        ${controls}
      </div>
    </details>`;
}

function options(labels, current) {
  return labels.map((entry) =>
    `<option value="${escape(entry.id)}"${entry.id === current ? " selected" : ""}>${escape(entry.name)}</option>`).join("");
}

function entriesFrom(groups) {
  return groups.flatMap((group) => group.findings.map((entry) => ({ ...entry, identityName: group.identityName })));
}

function categoryCount(groups, part) {
  return groups.filter((group) => group.facet === part)
    .reduce((count, group) => count + group.findings.length, 0);
}

function choosePart(groups) {
  const available = PART_LABELS.slice(1).filter((part) => categoryCount(groups, part.id));
  if (!available.length) {
    view.part = "";
    return;
  }
  if (available.some((part) => part.id === view.part)) return;
  view.part = available.some((part) => part.id === "VL") ? "VL" : available[0].id;
}

function categoryIndex(groups) {
  const rows = PART_LABELS.slice(1).map((part) => {
    const count = categoryCount(groups, part.id);
    return `<button class="m-intelligence-category" type="button" data-category="${escape(part.id)}" aria-pressed="${view.part === part.id}" ${count ? "" : "disabled"}>
        <span>${escape(part.name)}</span>
      </button>`;
  }).join("");
  return `<div class="m-intelligence-browser__categories">
      <span class="m-label">Categories</span>
      ${rows}
    </div>`;
}

function adminPanel(brain) {
  if (!brain.approved) return "";
  return `<details class="m-intelligence-admin">
      <summary>Administrative mode</summary>
      <div class="m-intelligence-admin__body">
        <div class="m-segmented">
          <button class="m-segmented__item" type="button" data-mode="brain" aria-pressed="${view.mode === "brain"}">In the brain</button>
          <button class="m-segmented__item" type="button" data-mode="review" aria-pressed="${view.mode === "review"}">Everything imported</button>
        </div>
        <button class="m-button m-button--small" type="button" data-import>Import intake files</button>
      </div>
    </details>`;
}

function reader(groups) {
  const selected = groups.filter((group) => group.facet === view.part);
  const entries = entriesFrom(selected);
  const category = PART_LABELS.find((part) => part.id === view.part);
  const identity = IDENTITY_LABELS.find((entry) => entry.id === view.identity);
  const title = category ? category.name : "Approved intelligence";
  const scope = view.identity ? identity.name : "Across both identities";
  const initialLimit = 4;
  const visible = entries.slice(0, initialLimit);
  const remaining = entries.slice(initialLimit);
  const remainder = remaining.length ? `<details class="m-intelligence-remainder">
      <summary>${escape(remaining.length)} more approved ${remaining.length === 1 ? "principle" : "principles"}</summary>
      <div class="m-intelligence-principles">${remaining.map((entry, index) => principleBlock(entry, index + initialLimit)).join("")}</div>
    </details>` : "";
  const principles = entries.length
    ? `<div class="m-intelligence-principles">${visible.map(principleBlock).join("")}</div>${remainder}`
    : `<div class="m-empty-inline"><span class="m-label">No approved guidance here</span><p class="m-copy">This Brain has no ${escape(title.toLowerCase())} guidance for ${escape(scope.toLowerCase())}. Try another category or identity.</p></div>`;
  const provenance = entries.length ? `<details class="m-intelligence-provenance" data-provenance${view.provenance ? " open" : ""}>
      <summary>
        <span class="m-label">Evidence and provenance</span>
        <span class="m-meta">WHAT THIS RESTS ON</span>
      </summary>
      <div class="m-intelligence-provenance__body">${entries.map(evidenceItem).join("")}</div>
    </details>` : "";
  return `<section class="m-intelligence-browser__reader" aria-labelledby="selected-intelligence-heading">
      <div class="m-intelligence-reader">
        <header class="m-intelligence-reader__head">
          <span class="m-label">Selected intelligence</span>
          <h2 id="selected-intelligence-heading" class="m-heading">${escape(title)}</h2>
          <span class="m-meta">${escape(scope.toUpperCase())}</span>
        </header>
        ${principles}
        ${provenance}
      </div>
    </section>`;
}

function browser(brain, groups) {
  choosePart(groups);
  return `<div class="m-intelligence-browser">
      <aside class="m-intelligence-browser__index" aria-label="Brain categories">
        <div class="m-intelligence-browser__filter">
          <label class="m-label" for="identity-filter">Identity</label>
          <select class="m-select" id="identity-filter" data-filter="identity">${options(IDENTITY_LABELS, view.identity)}</select>
        </div>
        ${categoryIndex(groups)}
        ${adminPanel(brain)}
      </aside>
      ${reader(groups)}
    </div>`;
}

function summaryLine(brain) {
  if (!brain.artist) return "Nothing has been imported for this artist yet.";
  if (!brain.approved) {
    return `${brain.counts.findings} ready to approve, from ${brain.counts.claims} claims across ${brain.counts.sources} sources. Nothing is in the brain until you approve it.`;
  }
  const removed = brain.counts.removed ? `, ${brain.counts.removed} taken out` : "";
  return `${brain.counts.inBrain} in the brain${removed}, from ${brain.counts.claims} claims across ${brain.counts.sources} sources.`;
}

function head(brain) {
  const name = brain.artist ? brain.artist.name : ARTIST_ID;
  const state = brain.approved ? "m-state m-state--approved" : "m-state m-state--current";
  const stateText = brain.approved ? "Approved intelligence" : "Not approved yet";
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <span class="m-breadcrumb__current">Artist Brain</span>
    </nav>
    <span class="${state}">${escape(stateText)}</span>`;

  return `<header class="m-job-header m-intelligence-header">
      <div class="m-job-header__copy">
        <span class="m-label">What Meridian knows</span>
        <h1 class="m-heading">${escape(name)}</h1>
        ${brain.approved ? "" : `<p class="m-copy m-copy--large">${escape(summaryLine(brain))}</p>`}
      </div>
      ${brain.approved && brain.approvedBy ? `<p class="m-meta">APPROVED BY ${escape(brain.approvedBy.toUpperCase())}</p>` : ""}
    </header>`;
}

function actionBar(brain) {
  if (brain.approved) {
    operator.innerHTML = "";
    return;
  }
  const approve = brain.artist
    ? `<button class="m-button m-button--primary" type="button" data-approve-brain>Approve this brain</button>`
    : "";
  const context = brain.artist
    ? "Read what came in, then approve the whole brain and take out what should not be in it."
    : "Import the intake files to begin review.";
  operator.innerHTML = `<p class="m-action-bar__context">${escape(context)}</p>
    <div class="m-action-bar__actions">
      <button class="m-button" type="button" data-import>Import intake files</button>
      ${approve}
    </div>`;
}

function firstBrain() {
  return `<section class="m-empty-state m-empty-state--waiting" aria-labelledby="first-brain-heading">
      <div class="m-empty-state__visual" aria-hidden="true">
        <svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor"><path d="M20 49h24M24 55h16"></path><path d="M18 28a14 14 0 1 1 28 0c0 7-5 9-7 15H25c-2-6-7-8-7-15Z"></path><path d="M25 28h14M32 21v14"></path></svg>
        <span class="m-empty-state__calibration">Artist research / Not approved</span>
      </div>
      <div class="m-empty-state__body">
        <span class="m-label">Higher Roads research</span>
        <h2 id="first-brain-heading" class="m-section-heading">Build the Brain from real research</h2>
        <p class="m-copy m-copy--large">Start with the intake files the team already trusts. Higher Roads reviews and approves the research before it can contribute to a Scene.</p>
        <div class="m-empty-state__actions"><button class="m-button m-button--primary" type="button" data-import>Import intake files</button><span class="m-meta">NOTHING ENTERS AUTOMATICALLY</span></div>
      </div>
    </section>`;
}

async function render() {
  const brain = await call("get-artist");
  if (!brain.artist) {
    locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><span class="m-breadcrumb__current">Artist Brain</span></nav><span class="m-state m-state--current">Research not started</span>`;
    root.innerHTML = `<header class="m-job-header m-intelligence-header"><div class="m-job-header__copy"><span class="m-label">What Meridian knows</span><h1 class="m-heading">Artist Brain</h1></div></header>${view.message ? `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>` : ""}${firstBrain()}`;
    operator.innerHTML = "";
    return;
  }
  if (!brain.approved) view.mode = "review";
  let groups = [];
  if (view.mode === "brain") {
    groups = brain.groups.filter((group) =>
      !view.identity || group.identity === view.identity);
  } else {
    const listed = await call("list-findings", { identity: view.identity || null, facet: null });
    groups = listed.groups;
  }
  const message = view.message ? `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>` : "";
  root.innerHTML = head(brain) + message + browser(brain, groups);
  actionBar(brain);
}

async function guard(work) {
  try {
    await work();
  } catch (error) {
    view.message = error.message;
    try {
      await render();
    } catch {
      root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
    }
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-import")) {
    guard(async () => {
      target.disabled = true;
      const result = await call("import-intake");
      view.message = `Imported ${result.counts.findings} entries, ${result.counts.claims} claims and ${result.counts.sources} sources.`;
      await render();
    });
    return;
  }
  if (target.dataset.mode) {
    guard(async () => {
      view.mode = target.dataset.mode;
      view.open = {};
      view.provenance = false;
      view.message = "";
      await render();
    });
    return;
  }
  if (target.dataset.category) {
    view.part = target.dataset.category;
    view.open = {};
    view.provenance = false;
    view.message = "";
    guard(render);
    return;
  }
  if (target.hasAttribute("data-approve-brain")) {
    guard(async () => {
      target.disabled = true;
      const result = await call("approve-brain");
      view.mode = "brain";
      view.message = `${result.counts.inBrain} entries are in the brain.`;
      await render();
    });
    return;
  }
  if (target.dataset.remove) {
    guard(async () => {
      await call("remove-finding", { findingId: target.dataset.remove });
      view.message = "";
      await render();
    });
    return;
  }
  if (target.dataset.restore) {
    guard(async () => {
      await call("restore-finding", { findingId: target.dataset.restore });
      view.message = "";
      await render();
    });
  }
});

// Evidence is fetched when its disclosure opens and dropped when it closes, so
// nothing loads sources a person did not ask to see.
document.addEventListener("toggle", (event) => {
  const details = event.target;
  if (details.dataset && Object.prototype.hasOwnProperty.call(details.dataset, "provenance")) {
    view.provenance = details.open;
    return;
  }
  if (!details.dataset || !details.dataset.evidence) return;
  const id = details.dataset.evidence;
  if (!details.open) {
    if (!view.open[id]) return;
    delete view.open[id];
    guard(render);
    return;
  }
  if (view.open[id]) return;
  guard(async () => {
    view.open[id] = await call("get-evidence", { findingId: id });
    await render();
  });
}, true);

document.addEventListener("change", (event) => {
  const select = event.target.closest("select");
  if (!select || !select.dataset.filter) return;
  guard(async () => {
    if (select.dataset.filter === "identity") view.identity = select.value;
    view.open = {};
    view.provenance = false;
    await render();
  });
});

guard(render);
