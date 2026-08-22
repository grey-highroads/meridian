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

const view = { mode: "brain", identity: "", part: "", open: {}, message: "" };

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
    body: JSON.stringify({ action, artistId: ARTIST_ID, ...extra }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// The intake file writes the lead sentence of a finding in bold. Keep that
// emphasis and let nothing else through as markup.
function findingText(text) {
  return escape(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
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

function findingBlock(finding) {
  const open = view.open[finding.id] ? " open" : "";
  const controls = view.mode === "brain"
    ? ""
    : `<div class="m-cluster">${finding.inBrain
        ? `<button class="m-button m-button--small" type="button" data-remove="${escape(finding.id)}">Not this one</button>`
        : `<button class="m-button m-button--small" type="button" data-restore="${escape(finding.id)}">Put it back</button>`}</div>`;
  const takenOut = finding.inBrain
    ? ""
    : `<span class="m-state m-state--change">Taken out${finding.removedBy ? ` by ${escape(finding.removedBy)}` : ""}</span>`;
  return `<article class="m-contribution">
      <span class="m-contribution__source">${escape(sourceLine(finding))}</span>
      <p class="m-copy">${findingText(finding.text)}</p>
      ${takenOut}
      <details class="m-disclosure" data-evidence="${escape(finding.id)}"${open}>
        <summary>
          <span class="m-label">Evidence</span>
          <span class="m-meta">WHAT THIS RESTS ON</span>
        </summary>
        <div class="m-disclosure__body">${open ? evidenceBody(finding) : ""}</div>
      </details>
      ${controls}
    </article>`;
}

function groupBlock(group) {
  const count = group.findings.length;
  return `<section class="m-work m-stack">
      <div class="m-cluster">
        <h2 class="m-section-heading">${escape(group.facetName)}, ${escape(group.identityName.toLowerCase())}</h2>
        <span class="m-meta">${escape(count)} ${count === 1 ? "ENTRY" : "ENTRIES"}</span>
      </div>
      ${group.findings.map(findingBlock).join("")}
    </section>`;
}

function options(labels, current) {
  return labels.map((entry) =>
    `<option value="${escape(entry.id)}"${entry.id === current ? " selected" : ""}>${escape(entry.name)}</option>`).join("");
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
  const stateText = brain.approved ? "Approved" : "Not approved yet";
  locationBar.innerHTML = `<span class="m-meta">${escape(name.toUpperCase())} / ARTIST BRAIN</span>
    <span class="${state}">${escape(stateText)}</span>`;

  const switches = brain.approved
    ? `<div class="m-segmented">
        <button class="m-segmented__item" type="button" data-mode="brain" aria-pressed="${view.mode === "brain"}">In the brain</button>
        <button class="m-segmented__item" type="button" data-mode="review" aria-pressed="${view.mode === "review"}">Everything imported</button>
      </div>`
    : "";

  return `<header class="m-job-header">
      <div class="m-job-header__copy">
        <span class="m-label">What Meridian knows</span>
        <h1 class="m-heading">${escape(name)}</h1>
        <p class="m-copy m-copy--large">${escape(summaryLine(brain))}</p>
        ${brain.approved && brain.approvedBy ? `<p class="m-meta">APPROVED BY ${escape(brain.approvedBy.toUpperCase())}</p>` : ""}
      </div>
    </header>
    ${view.message ? `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
    <div class="m-cluster">
      ${switches}
      <select class="m-select" data-filter="identity" aria-label="Which identity">${options(IDENTITY_LABELS, view.identity)}</select>
      <select class="m-select" data-filter="part" aria-label="Which part of the artist">${options(PART_LABELS, view.part)}</select>
    </div>`;
}

function actionBar(brain) {
  const approve = brain.artist && !brain.approved
    ? `<button class="m-button m-button--primary" type="button" data-approve-brain>Approve this brain</button>`
    : "";
  const context = brain.approved
    ? "Higher Roads maintains the brain here. New sources are integrated; the approved brain is never rebuilt."
    : "Import the intake files, read what came in, then approve the whole brain and take out what should not be in it.";
  operator.innerHTML = `<p class="m-action-bar__context">${escape(context)}</p>
    <div class="m-cluster">
      <button class="m-button" type="button" data-import>Import intake files</button>
      ${approve}
    </div>`;
}

async function render() {
  const brain = await call("get-artist");
  if (!brain.approved) view.mode = "review";
  let groups;
  if (view.mode === "brain") {
    groups = brain.groups.filter((group) =>
      (!view.identity || group.identity === view.identity) && (!view.part || group.facet === view.part));
  } else {
    const listed = await call("list-findings", { identity: view.identity || null, facet: view.part || null });
    groups = listed.groups;
  }
  const empty = view.mode === "brain"
    ? `<section class="m-work"><p class="m-copy">Nothing is in the brain yet.</p></section>`
    : `<section class="m-work"><p class="m-copy">Nothing here yet.</p></section>`;
  root.innerHTML = head(brain) + (groups.length ? groups.map(groupBlock).join("") : empty);
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
      view.message = "";
      await render();
    });
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
    if (select.dataset.filter === "part") view.part = select.value;
    await render();
  });
});

guard(render);
