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
  utility.innerHTML = `<a class="m-shell__nav-link" href="/api/auth/login?signout=1">
      <span class="m-shell__nav-label">Sign out</span>
    </a>`;
  const locationState = view.version
    ? (view.approved ? `Artboard V${view.version} approved` : `Artboard V${view.version} waiting on you`)
    : "No Artboard waiting";
  locationBar.innerHTML = `<span class="m-meta">${escape(String(view.tour.name).toUpperCase())}</span>
    <span class="m-state ${view.approved || !view.version ? "m-state--approved" : "m-state--current"}">${escape(locationState)}</span>`;

  if (!view.version) {
    page.innerHTML = `<section class="m-empty-state" aria-labelledby="client-waiting-heading">
        <div class="m-empty-state__visual" aria-hidden="true">
          <svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor"><rect x="12" y="15" width="40" height="34" rx="2"></rect><path d="M20 24h24M20 32h16M20 40h10"></path></svg>
          <span class="m-empty-state__calibration">Client review / Standing by</span>
        </div>
        <div class="m-empty-state__body">
          <span class="m-label">Nothing for you to review</span>
          <h1 id="client-waiting-heading" class="m-section-heading">No Artboard has been sent yet</h1>
          <p class="m-copy m-copy--large">The exact version will appear here when it is ready. You do not need to do anything yet.</p>
          <div class="m-empty-state__actions"><a class="m-button" href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.sceneId)}">Open the Scene</a></div>
        </div>
      </section>`;
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

  const decision = view.approved
    ? `<section class="m-review-decision m-review-decision--approved"><div class="m-stack"><h1 class="m-scene-work-heading">Artboard V${escape(view.version)} approved</h1><p class="m-copy">You approved this exact version on ${escape(view.approved.approvedAt)}.</p></div><span class="m-state m-state--approved">Approved</span></section>`
    : `<section class="m-review-decision"><div class="m-stack"><h1 class="m-scene-work-heading">Review Artboard V${escape(view.version)}</h1><p class="m-copy">Approve this version, or leave feedback for the team.</p></div><div class="m-action-bar__actions"><a class="m-button" href="#client-feedback">Leave feedback</a><button class="m-button m-button--primary" type="button" data-approve>Approve Artboard V${escape(view.version)}</button></div></section>`;
  const feedback = view.approved ? "" : `<section class="m-client-review__feedback m-stack" id="client-feedback" aria-labelledby="say-heading"><div class="m-stack"><span class="m-label">Your feedback</span><h2 id="say-heading" class="m-scene-work-heading">Feedback on Artboard V${escape(view.version)}</h2></div><textarea class="m-textarea" id="comment" aria-label="Feedback on Artboard V${escape(view.version)}" placeholder="Tell us what should change or what you want us to know.">${escape(view.draft)}</textarea><button class="m-button" type="button" data-comment>Send feedback on V${escape(view.version)}</button></section>`;
  page.innerHTML = `${decision}${view.message ? `<div class="m-client-review__message"><div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div></div>` : ""}<section class="m-client-review__work" aria-labelledby="work-heading"><div class="m-client-review__work-head"><div class="m-stack"><span class="m-label">Scene</span><h2 id="work-heading" class="m-section-heading">${escape(view.assignment.title)}</h2></div><span class="m-meta">${escape(String(view.label).toUpperCase())}</span></div><div class="m-work-frame m-client-review__frame" aria-label="Artboard version ${escape(view.version)}">${frame()}<span class="m-work-frame__label">Artboard V${escape(view.version)}</span></div><p class="m-copy m-copy--large">${escape(view.rationale)}</p></section>${feedback}${said}`;
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
      view.message = `Artboard V${view.version} approved.`;
      await refresh();
      render();
    });
    return;
  }
  if (target.hasAttribute("data-comment")) {
    guard(async () => {
      await call("client-comment", { assignmentId: view.sceneId, artboardVersion: view.version, text: view.draft });
      view.draft = "";
      view.message = `Feedback sent for Artboard V${view.version}.`;
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
