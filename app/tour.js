// The tour page. The direction as the director gave it, the assignments under
// it, and what the brain brings to one of them: the findings that apply and
// why, then two or three concept directions to react to.

const TOUR_ID = new URLSearchParams(window.location.search).get("tour") || "off-the-map-2026";

const root = document.getElementById("tour");
const view = { assignmentId: null, context: null, proposed: null, concept: null, brief: null, briefs: [], message: "", working: false };

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, tourId: TOUR_ID, ...extra }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphs(text) {
  return String(text).split(/\n{2,}/).map((block) => `<p>${escape(block.trim())}</p>`).join("");
}

function findingLine(entry) {
  const sources = entry.independentSourceCount
    ? `${entry.independentSourceCount} independent ${entry.independentSourceCount === 1 ? "source" : "sources"}${entry.tiers && entry.tiers.length ? `, from tier ${entry.tiers.join(", ")}` : ""}`
    : "Source count not recorded";
  return `<div class="artist-finding">
      <p>${escape(entry.text.replace(/\*\*/g, ""))}</p>
      <div class="artist-meta">
        <span class="artist-tag">${escape(entry.facetName)}</span>
        <span class="artist-tag">${escape(sources)}</span>
      </div>
      ${entry.why ? `<p class="artist-note">${escape(entry.why)}</p>` : ""}
    </div>`;
}

function proposalBlock(proposal, index) {
  return `<div class="artist-finding">
      <p><strong>${escape(proposal.title)}</strong></p>
      ${paragraphs(proposal.idea)}
      ${proposal.whyThisArtist ? `<p class="artist-note">Why this artist: ${escape(proposal.whyThisArtist)}</p>` : ""}
      ${proposal.asksOfProduction ? `<p class="artist-note">What it asks of production: ${escape(proposal.asksOfProduction)}</p>` : ""}
      ${proposal.whereItMightMiss ? `<p class="artist-note">Where it might miss: ${escape(proposal.whereItMightMiss)}</p>` : ""}
      <div class="artist-meta">
        ${(proposal.rhymesWith || []).map((id) => `<span class="artist-tag">${escape(id)}</span>`).join("")}
      </div>
      <div class="artist-controls"><button data-choose="${index}">Use this concept</button></div>
    </div>`;
}

function briefSection() {
  const frozen = view.briefs.length
    ? `<p class="artist-note">Frozen: ${view.briefs.map((entry) => `version ${escape(entry.briefVersion)} by ${escape(entry.frozenBy)}`).join(", ")}.</p>`
    : "";
  if (!view.concept) {
    return `<section class="artist-group">
        <h2>The brief</h2>
        <p class="artist-note">Choose a concept and the brief compiles from it.</p>
        ${frozen}
      </section>`;
  }
  const controls = view.brief && view.brief.brief.status === "frozen"
    ? ""
    : `<button data-compile>${view.brief ? "Compile again" : "Compile the brief"}</button>
       ${view.brief ? `<button data-freeze>Freeze version ${escape(view.brief.brief.briefVersion)} and send it out</button>` : ""}`;
  return `<section class="artist-group">
      <h2>The brief</h2>
      <p class="artist-note">Concept: ${escape(view.concept.title)}, shaped by ${escape(view.concept.shapedBy)}.</p>
      ${frozen}
      <div class="artist-controls">${controls}</div>
      ${view.brief ? `
        <div class="artist-meta">
          <span class="artist-tag">Job ${escape(view.brief.brief.jobId)}</span>
          <span class="artist-tag">Brief version ${escape(view.brief.brief.briefVersion)}</span>
          <span class="artist-tag">Direction version ${escape(view.brief.brief.directionVersion)}</span>
          <span class="artist-tag">${escape(view.brief.brief.status === "frozen" ? `Frozen by ${view.brief.brief.frozenBy}` : "Draft, not yet frozen")}</span>
        </div>
        <div class="artist-controls">
          <button data-download="document">Download the document</button>
          <button data-download="sidecar">Download the machine readable file</button>
        </div>
        <pre class="artist-brief">${escape(view.brief.document)}</pre>
      ` : ""}
    </section>`;
}

function download(kind) {
  const frozen = view.brief.brief.status === "frozen" ? "" : "-draft";
  const name = `${view.brief.brief.jobId}-v${view.brief.brief.briefVersion}${frozen}`;
  const body = kind === "sidecar" ? JSON.stringify(view.brief.sidecar, null, 2) : view.brief.document;
  const url = URL.createObjectURL(new Blob([body], { type: kind === "sidecar" ? "application/json" : "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = kind === "sidecar" ? `${name}.json` : `${name}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function proposalsSection() {
  if (!view.proposed) return "";
  const applied = view.proposed.appliedFindings || [];
  return `<section class="artist-group">
      <h2>What the brain brings to this assignment</h2>
      ${applied.length ? applied.map(findingLine).join("") : "<p class=\"artist-note\">The brain found nothing in this artist that bears on the request.</p>"}
    </section>
    <section class="artist-group">
      <h2>Concept directions to react to</h2>
      ${(view.proposed.proposals || []).map((proposal, index) => proposalBlock(proposal, index)).join("")}
    </section>
    ${(view.proposed.avoidNotes || []).length ? `<section class="artist-group">
      <h2>What this artist avoids, on this request</h2>
      ${view.proposed.avoidNotes.map((note) => `<p>${escape(note)}</p>`).join("")}
    </section>` : ""}
    ${(view.proposed.openQuestions || []).length ? `<section class="artist-group">
      <h2>Open questions</h2>
      <ul>${view.proposed.openQuestions.map((note) => `<li>${escape(note)}</li>`).join("")}</ul>
    </section>` : ""}`;
}

function contextSection() {
  if (!view.context) return "";
  const { assignment, context } = view.context;
  return `<section class="artist-group">
      <h2>${escape(assignment.title)}</h2>
      <p class="artist-note">${escape(assignment.moment || "")}${assignment.requestedBy ? `. Asked for by ${escape(assignment.requestedBy)}` : ""}. Written against direction version ${escape(assignment.directionVersion)}.</p>
      ${paragraphs(assignment.request)}
      <div class="artist-meta">
        <span class="artist-tag">${escape(context.counts.inScope)} of ${escape(context.counts.inBrain)} findings in scope for this identity</span>
        <span class="artist-tag">${escape(context.avoids.length)} on what the brand avoids</span>
      </div>
      <div class="artist-controls">
        <button data-propose ${view.working ? "disabled" : ""}>${view.working ? "Thinking" : "Ask the brain for concept directions"}</button>
      </div>
    </section>`;
}

function chrome(tour, assignments) {
  const options = assignments.map((entry) =>
    `<option value="${escape(entry.id)}"${entry.id === view.assignmentId ? " selected" : ""}>${escape(entry.title)}</option>`).join("");
  return `<header class="artist-head">
      <p class="artist-note"><a href="./index.html">Back to the workspace</a> &nbsp; <a href="./artist.html">Artist</a></p>
      <h1>${escape(tour.name)}</h1>
      <p class="artist-note">${escape(tour.cycle || "")}. Direction version ${escape(tour.direction.version)}, set by ${escape(tour.direction.setBy)} on ${escape(tour.direction.setOn)}.</p>
      ${tour.status ? `<p class="artist-note">${escape(tour.status)}</p>` : ""}
    </header>
    ${view.message ? `<div class="artist-toast">${escape(view.message)}</div>` : ""}
    <section class="artist-group">
      <h2>The direction, as it was given</h2>
      ${paragraphs(tour.direction.words)}
    </section>
    <div class="artist-bar">
      <select data-assignment>${options}</select>
    </div>`;
}

async function render() {
  const { tour, assignments } = await call("get-tour");
  if (!view.assignmentId && assignments.length) view.assignmentId = assignments[0].id;
  if (view.assignmentId && !view.context) {
    view.context = await call("assignment-context", { assignmentId: view.assignmentId });
    view.concept = (await call("get-concept", { assignmentId: view.assignmentId })).concept;
    view.briefs = (await call("list-briefs", { assignmentId: view.assignmentId })).briefs;
  }
  root.innerHTML = chrome(tour, assignments) + contextSection() + proposalsSection() + briefSection();
}

async function guard(work) {
  try {
    await work();
  } catch (error) {
    view.working = false;
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

  if (target.dataset.choose) {
    guard(async () => {
      const proposal = view.proposed.proposals[Number(target.dataset.choose)];
      const applied = view.proposed.appliedFindings || [];
      const cited = new Set(proposal.rhymesWith || []);
      view.concept = (await call("choose-concept", {
        assignmentId: view.assignmentId,
        concept: {
          ...proposal,
          cameFrom: `proposal: ${proposal.title}`,
          avoid: view.proposed.avoidNotes || [],
          openQuestions: view.proposed.openQuestions || [],
          artistContext: applied.filter((entry) => cited.has(entry.findingId)),
        },
      })).concept;
      view.brief = null;
      view.message = "";
      await render();
    });
    return;
  }
  if (target.hasAttribute("data-compile")) {
    guard(async () => {
      view.brief = await call("compile-brief", { assignmentId: view.assignmentId });
      view.message = "";
      await render();
    });
    return;
  }
  if (target.hasAttribute("data-freeze")) {
    guard(async () => {
      view.brief = await call("freeze-brief", { assignmentId: view.assignmentId });
      view.briefs = (await call("list-briefs", { assignmentId: view.assignmentId })).briefs;
      view.message = `Version ${view.brief.brief.briefVersion} is frozen. Download it and send it to Jim.`;
      await render();
    });
    return;
  }
  if (target.dataset.download) {
    download(target.dataset.download);
    return;
  }
  if (!target.hasAttribute("data-propose")) return;
  guard(async () => {
    view.working = true;
    view.message = "";
    await render();
    view.proposed = await call("propose-concepts", { assignmentId: view.assignmentId });
    view.working = false;
    const dropped = view.proposed.droppedFindings || [];
    if (dropped.length) view.message = `${dropped.length} citations named findings the brain does not hold and were left out.`;
    await render();
  });
});

root.addEventListener("change", (event) => {
  const select = event.target.closest("select");
  if (!select || !select.hasAttribute("data-assignment")) return;
  guard(async () => {
    view.assignmentId = select.value;
    view.context = null;
    view.proposed = null;
    view.concept = null;
    view.brief = null;
    view.message = "";
    await render();
  });
});

guard(render);
