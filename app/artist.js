// The artist page. It shows what Meridian knows about one artist, lets a
// person approve each finding or turn it down, and shows the evidence behind
// one when they ask for it. The Brain view is the approved findings only.

const ARTIST_ID = new URLSearchParams(window.location.search).get("artist") || "dierks-bentley";

const root = document.getElementById("artist");
const view = { mode: "review", identity: "", facet: "", open: {}, message: "" };

const IDENTITY_LABELS = [
  { id: "", name: "Both identities" },
  { id: "main-stage", name: "Main stage" },
  { id: "hot-country-knights", name: "Hot Country Knights" },
  { id: "shared", name: "Shared" },
];

const FACET_LABELS = [
  { id: "", name: "Every part of the artist" },
  { id: "CE", name: "Catalog and eras" },
  { id: "LH", name: "Live history" },
  { id: "VL", name: "Visual language" },
  { id: "BS", name: "Brand and story" },
  { id: "PB", name: "People and business" },
  { id: "AV", name: "What the brand avoids" },
];

const RULING_LABELS = { approved: "Approved", declined: "Not this one", proposed: "Needs your approval" };

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

// The findings file writes its lead sentence in bold. Keep that emphasis and
// let nothing else through as markup.
function findingText(text) {
  return escape(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function sourceLine(finding) {
  if (!finding.independentSourceCount) return "Source count not recorded";
  const tiers = (finding.tiers || []).join(", ");
  const plural = finding.independentSourceCount === 1 ? "source" : "sources";
  return tiers
    ? `${finding.independentSourceCount} independent ${plural}, from tier ${tiers}`
    : `${finding.independentSourceCount} independent ${plural}`;
}

function evidenceBlock(finding) {
  const evidence = view.open[finding.id];
  if (!evidence) return "";
  if (!evidence.evidenceLinked) {
    return `<div class="artist-evidence">This finding rests on ${escape(sourceLine(finding).toLowerCase())}.
      The individual claims behind it were not recorded against it in this intake run, so there is nothing further to open here yet.</div>`;
  }
  const items = evidence.claims.map((claim) => {
    const source = evidence.sources.find((entry) => entry.id === claim.sourceId);
    const link = source ? ` <a href="${escape(source.url)}" rel="noopener" target="_blank">${escape(source.title)}</a>` : ` ${escape(claim.sourceRef)}`;
    return `<li>${escape(claim.text)}.${link}</li>`;
  }).join("");
  return `<div class="artist-evidence">Evidence<ul>${items}</ul></div>`;
}

function findingBlock(finding) {
  const ruling = RULING_LABELS[finding.status] || RULING_LABELS.proposed;
  const controls = view.mode === "brain"
    ? ""
    : `<div class="artist-controls">
        <button data-approve="${escape(finding.id)}">Approve</button>
        <button data-decline="${escape(finding.id)}">Not this one</button>
        <button data-evidence="${escape(finding.id)}">${view.open[finding.id] ? "Hide evidence" : "Show evidence"}</button>
      </div>`;
  return `<div class="artist-finding">
      <p>${findingText(finding.text)}</p>
      <div class="artist-meta">
        <span class="artist-tag">${escape(finding.bin === "new" ? "New" : finding.bin === "corrected" ? "Corrected" : "Confirmed")}</span>
        <span class="artist-tag">${escape(sourceLine(finding))}</span>
        <span class="artist-tag" data-mark="${escape(finding.status || "proposed")}">${escape(ruling)}</span>
      </div>
      ${controls}
      ${evidenceBlock(finding)}
    </div>`;
}

function groupBlock(group) {
  return `<section class="artist-group">
      <h2>${escape(group.facetName)}, ${escape(group.identityName.toLowerCase())}</h2>
      ${group.findings.map(findingBlock).join("")}
    </section>`;
}

function chrome(name, counts) {
  const identityOptions = IDENTITY_LABELS.map((entry) =>
    `<option value="${escape(entry.id)}"${entry.id === view.identity ? " selected" : ""}>${escape(entry.name)}</option>`).join("");
  const facetOptions = FACET_LABELS.map((entry) =>
    `<option value="${escape(entry.id)}"${entry.id === view.facet ? " selected" : ""}>${escape(entry.name)}</option>`).join("");
  const summary = counts
    ? `${counts.findings} findings, ${counts.approved} approved, from ${counts.claims} claims across ${counts.sources} sources.`
    : "Nothing has been imported for this artist yet.";
  return `<header class="artist-head">
      <h1>${escape(name)}</h1>
      <p class="artist-note">${escape(summary)}</p>
    </header>
    ${view.message ? `<div class="artist-toast">${escape(view.message)}</div>` : ""}
    <div class="artist-bar">
      <button data-mode="review" aria-pressed="${view.mode === "review"}">Review</button>
      <button data-mode="brain" aria-pressed="${view.mode === "brain"}">Brain</button>
      <select data-filter="identity">${identityOptions}</select>
      <select data-filter="facet">${facetOptions}</select>
      <button data-import>Import intake files</button>
    </div>`;
}

async function render() {
  const brain = await call("get-artist");
  const name = brain.artist ? brain.artist.name : ARTIST_ID;
  let groups;
  if (view.mode === "brain") {
    groups = brain.groups.filter((group) =>
      (!view.identity || group.identity === view.identity) && (!view.facet || group.facet === view.facet));
  } else {
    const listed = await call("list-findings", { identity: view.identity || null, facet: view.facet || null });
    groups = listed.groups;
  }
  const empty = view.mode === "brain"
    ? "<p class=\"artist-note\">No findings have been approved yet.</p>"
    : "<p class=\"artist-note\">Nothing to review here yet.</p>";
  root.innerHTML = chrome(name, brain.artist ? brain.counts : null) + (groups.length ? groups.map(groupBlock).join("") : empty);
}

async function guard(work) {
  try {
    await work();
  } catch (error) {
    view.message = error.message;
    try {
      await render();
    } catch {
      root.innerHTML = `<div class="artist-toast">${escape(error.message)}</div>`;
    }
  }
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  guard(async () => {
    if (target.hasAttribute("data-import")) {
      target.disabled = true;
      const result = await call("import-intake");
      view.message = `Imported ${result.counts.findings} findings, ${result.counts.claims} claims and ${result.counts.sources} sources.`;
      await render();
      return;
    }
    if (target.dataset.mode) {
      view.mode = target.dataset.mode;
      view.message = "";
      await render();
      return;
    }
    if (target.dataset.approve) {
      await call("approve-finding", { findingId: target.dataset.approve });
      view.message = "";
      await render();
      return;
    }
    if (target.dataset.decline) {
      await call("decline-finding", { findingId: target.dataset.decline });
      view.message = "";
      await render();
      return;
    }
    if (target.dataset.evidence) {
      const id = target.dataset.evidence;
      if (view.open[id]) delete view.open[id];
      else view.open[id] = await call("get-evidence", { findingId: id });
      await render();
    }
  });
});

root.addEventListener("change", (event) => {
  const select = event.target.closest("select");
  if (!select) return;
  guard(async () => {
    if (select.dataset.filter === "identity") view.identity = select.value;
    if (select.dataset.filter === "facet") view.facet = select.value;
    await render();
  });
});

guard(render);
