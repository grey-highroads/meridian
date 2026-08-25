const TOUR_ID = new URLSearchParams(window.location.search).get("tour") || "off-the-map-2026";
const locationBar = document.getElementById("location");
const root = document.getElementById("reviews");

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, tourId: TOUR_ID, ...extra }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) { return String(value === null || value === undefined ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function needsUser(scene, user) {
  if (user.role === "higher-roads") return scene.waitingOn === "Higher Roads" && ["Concept review", "Production review"].includes(scene.stage);
  return scene.waitingOn === "the client";
}

function href(scene, user) {
  if (scene.stage === "Production review") return user.role === "higher-roads"
    ? `./review.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(scene.id)}`
    : `./client-review.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(scene.id)}`;
  return `./scene.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(scene.id)}`;
}

function reviewHref(scene, user) {
  return user.role === "higher-roads"
    ? `./review.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(scene.id)}`
    : `./client-review.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(scene.id)}`;
}

function queueRows(queue, user) {
  if (!queue.length) return `<div class="m-callout m-callout--approved"><h2 class="m-scene-work-heading">Nothing is waiting for review</h2><p class="m-copy">No Artboard or Scene concept needs your decision right now.</p></div>`;
  const rows = queue.map((scene) => {
    const object = scene.stage === "Production review" ? (scene.currentVersion || "Latest Artboard") : (scene.currentVersion || "Scene concept");
    return `<a class="m-rule-row" href="${escape(href(scene, user))}"><div class="m-stack"><span class="m-rule-row__title">${escape(scene.title)}</span><span class="m-meta">${escape(String(object).toUpperCase())}</span></div><div class="m-stack"><span class="m-state m-state--current">Decision requested</span><span class="m-copy">${escape(object)} needs your review.</span></div></a>`;
  }).join("");
  return `<section class="m-directory-section" aria-labelledby="waiting-reviews-heading"><div class="m-directory-section__head"><h2 id="waiting-reviews-heading" class="m-scene-work-heading">Waiting on you</h2></div><div class="m-directory-list m-rule-list">${rows}</div></section>`;
}

function recentRows(recent, user) {
  if (!recent.length) return "";
  return `<section class="m-directory-section" aria-labelledby="recent-reviews-heading"><div class="m-directory-section__head"><h2 id="recent-reviews-heading" class="m-scene-work-heading">Past reviews</h2><p class="m-copy">Open any completed decision with the Artboard it approved.</p></div><div class="m-directory-list m-rule-list">${recent.map((scene) => `<a class="m-rule-row" href="${escape(reviewHref(scene, user))}"><div class="m-stack"><span class="m-rule-row__title">${escape(scene.title)}</span><span class="m-meta">${escape(String(scene.currentVersion).toUpperCase())}</span></div><span class="m-state m-state--approved">${escape(scene.currentVersion)} approved</span></a>`).join("")}</div></section>`;
}

async function load() {
  const [{ user }, { tour, assignments }] = await Promise.all([call("get-me"), call("get-tour")]);
  document.querySelectorAll("[data-operator-utility]").forEach((entry) => { entry.hidden = user.role !== "higher-roads"; });
  const queue = assignments.filter((scene) => needsUser(scene, user));
  const queued = new Set(queue.map((scene) => scene.id));
  const recent = assignments.filter((scene) => scene.currentVersion && ["Final approved", "Delivered"].includes(scene.stage) && !queued.has(scene.id));
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./index.html?tour=${escape(TOUR_ID)}">${escape(tour.name)}</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Reviews</span></nav><span class="m-state ${queue.length ? "m-state--current" : "m-state--approved"}">${queue.length} waiting</span>`;
  root.innerHTML = `${queueRows(queue, user)}${recentRows(recent, user)}`;
}

load().catch((error) => { locationBar.innerHTML = ""; root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`; });
