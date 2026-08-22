// What the client sees. The work, which version it is, a short line saying what
// it is going for, and two controls.
//
// Nothing else belongs here. No notes, no checks, no items to decide, no
// record, no internal language. The client approves the work, not the process
// that produced it, and a page that shows them the process invites them to
// review the wrong thing.

const PARAMS = new URLSearchParams(window.location.search);
const TOUR_ID = PARAMS.get("tour") || "off-the-map-2026";

const utility = document.getElementById("utility");
const locationBar = document.getElementById("location");
const page = document.getElementById("page");
const actions = document.getElementById("actions");

const view = {
  sceneId: PARAMS.get("scene") || null,
  tour: null,
  assignment: null,
  version: null,
  rationale: "",
  label: "",
  artifact: null,
  approved: null,
  comments: [],
  draft: "",
  message: "",
};

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

function frame() {
  if (!view.artifact) return `<span class="m-artboard__shape"></span>`;
  const address = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(view.artifact);
  return `<img src="${escape(address)}" width="880" alt="The work, version ${escape(view.version)}" />`;
}

function render() {
  utility.innerHTML = `<a class="m-shell__nav-link" href="./review.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}">
      <span class="m-shell__nav-label">Leave this view</span>
    </a>`;
  locationBar.innerHTML = `<span class="m-meta">${escape(String(view.tour.name).toUpperCase())}</span>
    <span class="m-state ${view.approved ? "m-state--approved" : "m-state--current"}">${escape(view.approved ? "Approved" : "Waiting on you")}</span>`;

  if (!view.version) {
    page.innerHTML = `<header class="m-job-header">
        <div class="m-job-header__copy">
          <h1 class="m-heading">Nothing to look at yet</h1>
          <p class="m-copy m-copy--large">There is nothing waiting for you on this one.</p>
        </div>
      </header>`;
    actions.innerHTML = "";
    return;
  }

  const said = view.comments.length
    ? `<section class="m-work m-stack" aria-labelledby="said-heading">
        <h2 id="said-heading" class="m-section-heading">What you said</h2>
        ${view.comments.map((entry) => `<div class="m-contribution">
          <p class="m-copy">${escape(entry.text)}</p>
          <span class="m-meta">${escape(entry.writtenAt)}</span>
        </div>`).join("")}
      </section>`
    : "";

  page.innerHTML = `<header class="m-job-header">
      <div class="m-job-header__copy">
        <span class="m-label">${escape(view.assignment.title)}</span>
        <h1 class="m-heading">Your work</h1>
      </div>
      <span class="m-state m-state--current">Version ${escape(view.version)}</span>
    </header>
    ${view.message ? `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
    <section class="m-work m-stack" aria-labelledby="work-heading">
      <h2 id="work-heading" class="m-section-heading">${escape(view.assignment.title)}</h2>
      <div class="m-artboard" aria-label="The work, version ${escape(view.version)}">
        <div class="m-artboard__current">
          ${frame()}
        </div>
      </div>
      <p class="m-copy m-copy--large">${escape(view.rationale)}</p>
      <span class="m-meta">${escape(String(view.label).toUpperCase())}</span>
    </section>
    <section class="m-work m-stack" aria-labelledby="say-heading">
      <h2 id="say-heading" class="m-section-heading">Say something about it</h2>
      <textarea class="m-textarea" id="comment" aria-label="Say something about it" placeholder="Anything you want us to know.">${escape(view.draft)}</textarea>
    </section>
    ${said}`;

  const approve = view.approved
    ? `<span class="m-state m-state--approved">Approved by you on ${escape(view.approved.approvedAt)}</span>`
    : `<button class="m-button m-button--primary" type="button" data-approve>Approve this</button>`;
  actions.innerHTML = `<p class="m-action-bar__context">${escape(view.approved ? "This is the version being made." : "Approve it, or tell us what you think.")}</p>
    <div class="m-cluster">
      <button class="m-button" type="button" data-comment>Send your comment</button>
      ${approve}
    </div>`;
}

async function refresh() {
  const state = await call("get-production-intent", { assignmentId: view.sceneId });
  const ready = state.readyForClient;
  const newest = ready.length ? ready[ready.length - 1] : null;
  view.version = newest ? newest.artboardVersion : null;
  view.approved = newest
    ? state.clientApprovals.find((entry) => entry.artboardVersion === newest.artboardVersion) || null
    : null;
  view.comments = newest ? state.comments.filter((entry) => entry.artboardVersion === newest.artboardVersion) : [];
  if (!view.version) return;

  const artboards = (await call("get-artboards", { assignmentId: view.sceneId })).artboards;
  const entry = artboards.find((stored) => stored.artboard.artboardVersion === view.version);
  view.label = entry ? entry.artboard.label : "";
  const brief = await call("get-brief", { assignmentId: view.sceneId, briefVersion: entry.artboard.briefVersion });
  view.rationale = brief.brief.chosenConcept.idea || brief.brief.chosenConcept.title;
  try {
    view.artifact = (await call("get-artboard-artifact", { assignmentId: view.sceneId, artboardVersion: view.version })).svg;
  } catch {
    view.artifact = null;
  }
}

async function load() {
  const { tour, assignments } = await call("get-tour");
  view.tour = tour;
  if (!view.sceneId && assignments.length) view.sceneId = assignments[0].id;
  view.assignment = (await call("get-assignment", { assignmentId: view.sceneId })).assignment;
  await refresh();
  render();
}

async function guard(work) {
  try {
    await work();
  } catch (error) {
    view.message = error.message;
    try {
      render();
    } catch {
      page.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
    }
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-approve")) {
    guard(async () => {
      await call("client-approve", { assignmentId: view.sceneId, artboardVersion: view.version });
      view.message = "Approved. We are making this one.";
      await refresh();
      render();
    });
    return;
  }
  if (target.hasAttribute("data-comment")) {
    guard(async () => {
      await call("client-comment", { assignmentId: view.sceneId, artboardVersion: view.version, text: view.draft });
      view.draft = "";
      view.message = "Sent.";
      await refresh();
      render();
    });
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "comment") return;
  view.draft = event.target.value;
});

guard(load);
