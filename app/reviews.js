import { ACCOUNT_ID, TOUR_ID, preserveContextNavigation, scopedBody } from "./context.js";
import { resolveArtifact } from "./artifact.js";
import { showNoTour } from "./no-tour.js";
import { renderBoardReviewInDrawer } from "./intelligence/board-view.js";

preserveContextNavigation();

const params = new URLSearchParams(window.location.search);
const locationBar = document.getElementById("location");
const root = document.getElementById("reviews");
const viewer = document.getElementById("review-viewer");
const viewerScene = document.getElementById("viewer-scene");
const viewerTitle = document.getElementById("viewer-title");
const viewerState = document.getElementById("viewer-state");
const viewerArtifact = document.getElementById("viewer-artifact");
const viewerContext = document.getElementById("viewer-context");
const viewerSurfaceBody = document.getElementById("viewer-surface-body");
let drawer = document.getElementById("review-drawer");
let drawerBody = document.getElementById("drawer-body");

const view = {
  user: null,
  actingAccount: null,
  tour: null,
  scenes: [],
  artifacts: new Map(),
  selected: null,
  detail: null,
  size: "fit",
  draft: { feedback: "", technical: "", preserve: "", comment: "" },
  message: "",
  messageAt: "",
  // Job three of Intelligence, met where the decision is made. It is recruited
  // context under Present to client, it is closed until asked for, and nothing
  // about presenting waits on it or reads it.
  boardReading: false,
  boardReviewOpen: false,
};

let thumbnailQueue = Promise.resolve();
let thumbnailObserver = null;

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, ...extra })),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function version(value) {
  return String(value || 0).padStart(2, "0");
}

function lines(value) {
  return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function artifactKey(sceneId, artboardVersion) {
  return `${sceneId}:${artboardVersion}`;
}

function seenKey(sceneId, artboardVersion) {
  const account = view.actingAccount || ACCOUNT_ID || "";
  const parts = [account, TOUR_ID, sceneId].map((value) => encodeURIComponent(String(value || "")));
  return `review-version-v1:${parts.join(":")}:${Number(artboardVersion)}`;
}

function hasOpened(sceneId, artboardVersion) {
  return Boolean(view.user?.reviewVersionsSeen?.[seenKey(sceneId, artboardVersion)]);
}

function sceneFor(sceneId) {
  return view.scenes.find((scene) => scene.id === sceneId) || null;
}

function selectedEntry() {
  const scene = view.selected && sceneFor(view.selected.sceneId);
  return scene ? scene.artboards.find((entry) => entry.artboard.artboardVersion === view.selected.artboardVersion) || null : null;
}

function newestVersion(scene) {
  return scene && scene.artboards.length ? scene.artboards[0].artboard.artboardVersion : null;
}

function emptyGallery() {
  const client = view.user.role !== "higher-roads";
  return `<section class="m-empty-state m-empty-state--waiting" aria-labelledby="empty-reviews-heading">
      <div class="m-empty-state__visual" aria-hidden="true">
        <svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor"><rect x="12" y="15" width="40" height="34" rx="2"></rect><path d="M20 24h24M20 32h16M20 40h10"></path></svg>
        <span class="m-empty-state__calibration">Reviews / Standing by</span>
      </div>
      <div class="m-empty-state__body">
        <span class="m-label">No Artboards yet</span>
        <h2 id="empty-reviews-heading" class="m-section-heading">Versions will appear here</h2>
        <p class="m-copy m-copy--large">${client ? "Each version appears when it is ready for the tour team." : "A Scene appears here when its first Artboard comes back."}</p>
        <div class="m-empty-state__actions"><a class="m-button" href="./scenes.html">Open Scenes</a></div>
      </div>
    </section>`;
}

function thumbnail(scene, entry) {
  const value = entry.artboard.artboardVersion;
  const unopened = !hasOpened(scene.id, value);
  return `<button class="m-button${unopened ? " m-button--instrument" : ""}" type="button" data-open-scene="${escape(scene.id)}" data-open-version="${escape(value)}" aria-label="Open ${escape(scene.title)}, Artboard version ${escape(value)}">
      <span class="m-stack">
        <span class="m-work-frame m-client-review__frame" data-thumb-scene="${escape(scene.id)}" data-thumb-version="${escape(value)}" aria-hidden="true"><span class="m-artboard__shape"></span></span>
        <span class="m-meta">ARTBOARD V${version(value)}</span>
      </span>
    </button>`;
}

function renderGallery() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./index.html">${escape(view.tour.name)}</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Reviews</span></nav>`;
  root.innerHTML = view.scenes.length ? view.scenes.map((scene) => `<section class="m-directory-section" aria-labelledby="scene-${escape(scene.id)}">
      <div class="m-directory-section__head"><h2 class="m-scene-work-heading" id="scene-${escape(scene.id)}">${escape(scene.title)}</h2><a class="m-button m-button--small" href="./scene.html?scene=${encodeURIComponent(scene.id)}">Open Scene</a></div>
      <div class="m-reference-grid">${scene.artboards.map((entry) => thumbnail(scene, entry)).join("")}</div>
    </section>`).join("") : emptyGallery();
  observeThumbnails();
}

async function loadArtifact(sceneId, artboardVersion) {
  const key = artifactKey(sceneId, artboardVersion);
  if (!view.artifacts.has(key)) {
    view.artifacts.set(key, (async () => {
      const item = await call("get-artboard-artifact", { assignmentId: sceneId, artboardVersion });
      return resolveArtifact(item, { assignmentId: sceneId });
    })().catch(() => null));
  }
  return view.artifacts.get(key);
}

function loadThumbnail(element) {
  thumbnailQueue = thumbnailQueue.then(async () => {
    if (!element.isConnected || element.dataset.loaded) return;
    element.dataset.loaded = "true";
    const artifact = await loadArtifact(element.dataset.thumbScene, Number(element.dataset.thumbVersion));
    if (!element.isConnected || !artifact?.src) return;
    element.innerHTML = `<img src="${escape(artifact.src)}" alt="" />`;
  });
}

function observeThumbnails() {
  thumbnailObserver?.disconnect();
  thumbnailObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      thumbnailObserver.unobserve(entry.target);
      loadThumbnail(entry.target);
    }
  }, { rootMargin: "160px" });
  document.querySelectorAll("[data-thumb-scene]").forEach((element) => thumbnailObserver.observe(element));
}

function list(items, empty = "Nothing recorded for this version.") {
  if (!items?.length) return `<p class="m-copy">${escape(empty)}</p>`;
  return `<ul>${items.map((entry) => `<li class="m-copy">${escape(typeof entry === "string" ? entry : entry.text)}</li>`).join("")}</ul>`;
}

function stateFor(detail) {
  const value = view.selected.artboardVersion;
  if (detail.end.clientApprovals?.some((entry) => entry.artboardVersion === value)) return { label: "Client approved", className: "m-state m-state--approved" };
  if (detail.end.readyForClient?.some((entry) => entry.artboardVersion === value)) return { label: "Presented to client", className: "m-state m-state--current" };
  if (detail.handoffs?.some((entry) => entry.kind === "revision" && entry.sourceArtboardVersion === value)) return { label: "Changes issued", className: "m-state m-state--change" };
  if (detail.reviews?.some((entry) => entry.artboardVersion === value)) return { label: "Review saved", className: "m-state" };
  return { label: "Received", className: "m-state" };
}

function clientFeedback(detail) {
  const value = view.selected.artboardVersion;
  const comments = (detail.comments || []).filter((entry) => entry.artboardVersion === value);
  const approvals = (detail.approvals || []).filter((entry) => entry.artboardVersion === value);
  return `${comments.map((entry) => `<div class="m-contribution"><p class="m-copy">${escape(entry.text)}</p><span class="m-meta">${escape(entry.writtenBy)} / ${escape(entry.writtenAt)}</span></div>`).join("")}${approvals.map((entry) => `<div class="m-contribution"><p class="m-copy">Approved this version.</p><span class="m-meta">${escape(entry.approvedBy)} / ${escape(entry.approvedAt)}</span></div>`).join("")}`;
}

function internalReviewHistory(detail) {
  const value = view.selected.artboardVersion;
  const reviews = (detail.reviews || []).filter((entry) => entry.artboardVersion === value);
  const revisions = (detail.revisions || []).filter((entry) => entry.sourceArtboardVersion === value);
  return `${reviews.map((entry) => `<div class="m-contribution"><span class="m-label">Review notes</span>${list(entry.departures)}${list(entry.technicalItems, "No technical notes.")}<span class="m-meta">${escape(entry.writtenBy)} / ${escape(entry.writtenAt)}</span></div>`).join("")}${revisions.map((entry) => `<div class="m-contribution"><span class="m-label">Changes requested</span>${list(entry.instructions)}<span class="m-meta">${escape(entry.sentBy)} / ${escape(entry.sentAt)}</span></div>`).join("")}`;
}

function operatorActions(detail, scene) {
  const value = view.selected.artboardVersion;
  const latest = value === newestVersion(scene);
  const review = detail.reviews?.find((entry) => entry.artboardVersion === value);
  const pending = detail.handoffs?.some((entry) => entry.kind === "revision" && entry.sourceArtboardVersion === value);
  const ready = detail.end.readyForClient?.some((entry) => entry.artboardVersion === value);
  const approved = detail.end.clientApprovals?.some((entry) => entry.artboardVersion === value);
  const feedback = review ? review.departures.join("\n") : view.draft.feedback;
  const technical = review ? review.technicalItems.join("\n") : view.draft.technical;
  const history = internalReviewHistory(detail);
  const briefVersion = selectedEntry()?.artboard?.briefVersion;
  const revisionResult = view.messageAt === "revision" && view.message
    ? `<div class="m-drawer__result"><p class="m-copy">${escape(view.message)}</p></div>` : "";
  const presentResult = view.messageAt === "present" && view.message
    ? `<div class="m-drawer__result"><p class="m-copy">${escape(view.message)}</p></div>` : "";
  return `<div class="m-drawer__stack">
      <section class="m-drawer__action" aria-labelledby="request-changes-heading">
        <h2 class="m-drawer__title" id="request-changes-heading">Request changes</h2>
        ${!latest ? `<p class="m-copy">Earlier Artboards are read-only history.</p>` : approved ? `<p class="m-copy">The client approved this Artboard.</p>` : pending ? `<p class="m-copy">Production has the change request.</p>` : `<div class="m-field"><label class="m-label" for="review-feedback">What should change</label><textarea class="m-textarea" id="review-feedback" data-draft="feedback" placeholder="One change per line.">${escape(feedback)}</textarea></div><div class="m-field"><label class="m-label" for="review-technical">Technical notes, optional</label><textarea class="m-textarea m-textarea--note" id="review-technical" data-draft="technical">${escape(technical)}</textarea></div><div class="m-field"><label class="m-label" for="review-preserve">Keep, optional</label><textarea class="m-textarea m-textarea--note" id="review-preserve" data-draft="preserve">${escape(view.draft.preserve)}</textarea></div><div class="m-drawer__actions"><button class="m-button m-button--change" type="button" data-revise>Request changes</button></div>`}
        ${revisionResult}
        <details class="m-drawer__context"><summary>Review history</summary><div class="m-drawer__context-body">${history || `<p class="m-copy">No internal review has been recorded for this Artboard.</p>`}</div></details>
      </section>
      <section class="m-drawer__action" aria-labelledby="present-heading">
        <h2 class="m-drawer__title" id="present-heading">Present to client</h2>
        ${!latest ? `<p class="m-copy">Only the latest Artboard can be presented.</p>` : approved ? `<p class="m-copy">The client approved this Artboard.</p>` : ready ? `<p class="m-copy">The client can now review this Artboard.</p>` : `<p class="m-copy">Make this Artboard available for the client's decision.</p><div class="m-drawer__actions"><button class="m-button m-button--primary" type="button" data-present>Present to client</button></div>`}
        ${presentResult}
        <details class="m-drawer__context"><summary>Brief used for this Artboard</summary><div class="m-drawer__context-body"><p class="m-copy">${briefVersion ? `Brief V${version(briefVersion)}` : "No brief reference was recorded."}</p></div></details>
        <details class="m-drawer__context"${view.boardReviewOpen ? " open" : ""}><summary>Read from the artist's side</summary><div class="m-drawer__context-body">${boardReadBody(detail)}</div></details>
      </section>
    </div>`;
}

// The read of this version, or the way to run one. Whatever it says, the
// Present to client action above is unchanged: it is written before this, it
// never consults it, and a version with a read full of departures presents in
// the same one click as a version with no read at all.
function boardReadBody(detail) {
  if (view.boardReading) return `<p class="m-copy">Reading this board.</p>`;
  const message = view.messageAt === "board" && view.message
    ? `<div class="m-drawer__result"><p class="m-copy">${escape(view.message)}</p></div>` : "";
  return `${renderBoardReviewInDrawer(detail.boardRead)}${message}`;
}

function clientActions(detail, scene) {
  const value = view.selected.artboardVersion;
  const latest = value === newestVersion(scene);
  const approved = detail.approvals?.some((entry) => entry.artboardVersion === value);
  if (!latest) return `<div class="m-callout"><p class="m-copy">Earlier versions are read-only history.</p></div>`;
  if (approved) return "";
  return `<section class="m-review-surface__section" aria-labelledby="client-actions-heading">
      <h2 class="m-scene-work-heading" id="client-actions-heading">Your decision</h2>
      <div class="m-field"><label class="m-label" for="client-comment">Comment</label><textarea class="m-textarea" id="client-comment" data-draft="comment" placeholder="Tell the team what should change or what they should know.">${escape(view.draft.comment)}</textarea></div>
      <div class="m-action-bar__actions"><button class="m-button" type="button" data-comment>Send comment</button><button class="m-button m-button--primary" type="button" data-approve>Approve this version</button></div>
      ${view.message && ["comment", "approve"].includes(view.messageAt) ? `<div class="m-callout m-callout--current"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
    </section>`;
}

function renderSurface() {
  const detail = view.detail;
  const scene = sceneFor(view.selected.sceneId);
  const rationale = view.user.role === "higher-roads" ? detail.brief?.brief?.chosenConcept?.idea : detail.brief?.rationale;
  const feedback = clientFeedback(detail);
  viewerSurfaceBody.innerHTML = `<section class="m-review-surface__section" aria-labelledby="rationale-heading">
      <span class="m-label">Why this direction</span>
      <h2 class="m-scene-work-heading" id="rationale-heading">The thinking behind the Artboard</h2>
      <p class="m-copy m-copy--large">${escape(rationale || "No rationale was recorded.")}</p>
    </section>
    <section class="m-review-surface__section" aria-labelledby="feedback-heading">
      <h2 class="m-scene-work-heading" id="feedback-heading">Client feedback</h2>
      ${feedback || `<p class="m-copy">No client feedback yet.</p>`}
    </section>
    ${view.user.role === "higher-roads" ? "" : clientActions(detail, scene)}`;
}

function renderDrawer() {
  if (!drawer) return;
  if (view.user.role !== "higher-roads") {
    drawer.remove();
    drawer = null;
    drawerBody = null;
    return;
  }
  drawer.hidden = false;
  drawerBody.innerHTML = operatorActions(view.detail, sceneFor(view.selected.sceneId));
}

function applyViewerSize() {
  viewerArtifact.dataset.viewSize = view.size;
  document.querySelectorAll("[data-size]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.size === view.size)));
}

async function detailFor(sceneId, artboardVersion) {
  const entry = selectedEntry();
  const briefRequest = view.user.role === "higher-roads"
    ? { assignmentId: sceneId, briefVersion: entry.artboard.briefVersion }
    : { assignmentId: sceneId, artboardVersion };
  const [written, end, brief, handoffs, boardReview] = await Promise.all([
    call("get-reviews", { assignmentId: sceneId }),
    call("get-production-intent", { assignmentId: sceneId }),
    call("get-brief", briefRequest),
    view.user.role === "higher-roads" ? call("get-handoffs", { assignmentId: sceneId }) : Promise.resolve({ handoffs: [] }),
    // A client never asks for this and never receives it. The route refuses the
    // action for a client session, and this call is not made in that role.
    view.user.role === "higher-roads"
      ? call("get-board-review", { assignmentId: sceneId, artboardVersion })
      : Promise.resolve({ analyses: [] }),
  ]);
  const reads = boardReview.analyses || [];
  return {
    reviews: written.reviews || [],
    revisions: written.revisions || [],
    comments: written.comments || end.comments || [],
    approvals: written.approvals || end.clientApprovals || [],
    end,
    brief,
    handoffs: handoffs.handoffs || [],
    boardRead: reads.length ? reads[reads.length - 1] : null,
  };
}

async function openVersion(sceneId, artboardVersion, pushAddress = true) {
  const scene = sceneFor(sceneId);
  if (!scene || !scene.artboards.some((entry) => entry.artboard.artboardVersion === artboardVersion)) return;
  view.selected = { sceneId, artboardVersion };
  view.detail = null;
  view.message = "";
  view.messageAt = "";
  view.size = "fit";
  view.boardReviewOpen = false;
  view.boardReading = false;
  if (drawer) drawer.open = false;
  const address = new URL(window.location.href);
  address.searchParams.set("scene", sceneId);
  address.searchParams.set("version", String(artboardVersion));
  if (pushAddress) history.pushState({}, "", address);
  if (!viewer.open) viewer.showModal();
  viewerScene.textContent = scene.title;
  viewerTitle.textContent = `Artboard V${version(artboardVersion)}`;
  viewerState.innerHTML = `<span class="m-state">Opening version</span>`;
  viewerContext.textContent = `${scene.title}, Artboard V${version(artboardVersion)}`;
  viewerArtifact.innerHTML = `<span class="m-artboard__shape"></span>`;
  const [artifact, detail, seen] = await Promise.all([
    loadArtifact(sceneId, artboardVersion),
    detailFor(sceneId, artboardVersion),
    call("mark-review-version-seen", { assignmentId: sceneId, artboardVersion }),
  ]);
  view.detail = detail;
  view.user = seen.user || view.user;
  const state = stateFor(detail);
  viewerState.innerHTML = `<span class="${escape(state.className)}">${escape(state.label)}</span>`;
  viewerArtifact.innerHTML = artifact?.src
    ? `<img src="${escape(artifact.src)}" alt="${escape(scene.title)}, Artboard version ${escape(artboardVersion)}" />`
    : `<div class="m-empty-inline"><span class="m-label">Artboard unavailable</span><p class="m-copy">The stored file could not be opened.</p></div>`;
  applyViewerSize();
  renderSurface();
  renderDrawer();
  renderGallery();
}

function closeViewer(pushAddress = true) {
  if (viewer.open) viewer.close();
  view.selected = null;
  view.detail = null;
  if (pushAddress) {
    const address = new URL(window.location.href);
    address.searchParams.delete("scene");
    address.searchParams.delete("version");
    history.pushState({}, "", address);
  }
}

function adjacent(delta) {
  const scene = sceneFor(view.selected.sceneId);
  const at = scene.artboards.findIndex((entry) => entry.artboard.artboardVersion === view.selected.artboardVersion);
  const wanted = scene.artboards[at + delta];
  if (wanted) openVersion(scene.id, wanted.artboard.artboardVersion);
}

async function refreshDetail(message, where = "") {
  view.message = message;
  view.messageAt = where;
  view.detail = await detailFor(view.selected.sceneId, view.selected.artboardVersion);
  const state = stateFor(view.detail);
  viewerState.innerHTML = `<span class="${escape(state.className)}">${escape(state.label)}</span>`;
  renderSurface();
  renderDrawer();
}

async function issueRevision() {
  const existing = view.detail.reviews.find((entry) => entry.artboardVersion === view.selected.artboardVersion);
  const departures = existing ? existing.departures : lines(view.draft.feedback);
  const technicalItems = existing ? existing.technicalItems : lines(view.draft.technical);
  if (!departures.length) throw new Error("Say what should change before issuing a revision.");
  if (!existing) {
    await call("save-review", { assignmentId: view.selected.sceneId, artboardVersion: view.selected.artboardVersion, departures, technicalItems });
  }
  await call("issue-revision", {
    assignmentId: view.selected.sceneId,
    sourceArtboardVersion: view.selected.artboardVersion,
    revisionId: `rev-${view.selected.artboardVersion}-${Date.now()}`,
    instructions: departures.map((text) => ({ text })),
    preserve: lines(view.draft.preserve),
  });
  view.draft = { feedback: "", technical: "", preserve: "", comment: "" };
  await refreshDetail("Production has the change request.", "revision");
}

// Running the read from the drawer. It writes a record and changes nothing
// about what this version can do next.
async function readBoard() {
  view.boardReviewOpen = true;
  view.boardReading = true;
  view.message = "";
  view.messageAt = "";
  renderDrawer();
  try {
    await call("run-board-review", {
      assignmentId: view.selected.sceneId,
      artboardVersion: view.selected.artboardVersion,
    });
    view.boardReading = false;
    await refreshDetail("", "board");
  } catch (error) {
    view.boardReading = false;
    view.message = error.message;
    view.messageAt = "board";
    renderDrawer();
  }
}

async function guard(work) {
  try {
    await work();
  } catch (error) {
    view.message = error.message;
    if (view.detail) {
      renderSurface();
      renderDrawer();
    }
    else root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
  }
}

document.addEventListener("input", (event) => {
  if (event.target.dataset?.draft) view.draft[event.target.dataset.draft] = event.target.value;
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.openScene) return void guard(() => openVersion(target.dataset.openScene, Number(target.dataset.openVersion)));
  if (target.hasAttribute("data-close")) return closeViewer();
  if (target.hasAttribute("data-previous")) return adjacent(-1);
  if (target.hasAttribute("data-next")) return adjacent(1);
  if (target.dataset.size) {
    view.size = target.dataset.size;
    applyViewerSize();
    return;
  }
  if (target.hasAttribute("data-read-board")) return void guard(readBoard);
  if (target.hasAttribute("data-revise")) return void guard(issueRevision);
  if (target.hasAttribute("data-present")) return void guard(async () => {
    await call("approve-for-client", { assignmentId: view.selected.sceneId, artboardVersion: view.selected.artboardVersion });
    await refreshDetail("The client can now review this Artboard.", "present");
  });
  if (target.hasAttribute("data-comment")) return void guard(async () => {
    await call("client-comment", { assignmentId: view.selected.sceneId, artboardVersion: view.selected.artboardVersion, text: view.draft.comment });
    view.draft.comment = "";
    await refreshDetail("Your comment was sent.", "comment");
  });
  if (target.hasAttribute("data-approve")) return void guard(async () => {
    await call("client-approve", { assignmentId: view.selected.sceneId, artboardVersion: view.selected.artboardVersion });
    await refreshDetail("You approved this Artboard.", "approve");
  });
});

window.addEventListener("popstate", () => {
  const address = new URL(window.location.href);
  const sceneId = address.searchParams.get("scene");
  const artboardVersion = Number(address.searchParams.get("version"));
  if (sceneId && artboardVersion) guard(() => openVersion(sceneId, artboardVersion, false));
  else closeViewer(false);
});

async function load() {
  if (!TOUR_ID) {
    showNoTour(root, locationBar);
    return;
  }
  const [{ user, actingAccount }, { tour, assignments }] = await Promise.all([call("get-me"), call("get-tour")]);
  view.user = user;
  view.actingAccount = actingAccount;
  view.tour = tour;
  const rows = await Promise.all(assignments.map(async (scene) => {
    const result = await call("get-artboards", { assignmentId: scene.id });
    const artboards = (result.artboards || []).slice().sort((left, right) => right.artboard.artboardVersion - left.artboard.artboardVersion);
    return artboards.length ? { ...scene, artboards } : null;
  }));
  view.scenes = rows.filter(Boolean);
  renderGallery();
  const sceneId = params.get("scene");
  const artboardVersion = Number(params.get("version"));
  if (sceneId && artboardVersion) await openVersion(sceneId, artboardVersion, false);
}

guard(load);
