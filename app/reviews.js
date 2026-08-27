import { TOUR_ID, scopedBody } from "./context.js";
import { showNoTour } from "./no-tour.js";
const locationBar = document.getElementById("location");
const root = document.getElementById("reviews");

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, ...extra })) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Meridian could not load reviews. Refresh the page and try again.");
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

function clearQueue(hasScenes) {
  const title = hasScenes ? "Nothing needs your review" : "Reviews will appear here";
  const copy = hasScenes
    ? "Nothing is waiting on you. Completed reviews stay below."
    : "Once work is ready, the Scene and version will appear here.";
  return `<section class="m-empty-state m-empty-state--clear" aria-labelledby="clear-reviews-heading">
      <div class="m-empty-state__visual" aria-hidden="true">
        <svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor">
          <circle cx="32" cy="32" r="21"></circle>
          <path d="m22 32 7 7 14-16"></path>
          <path d="M32 5v7M32 52v7M5 32h7M52 32h7"></path>
        </svg>
      </div>
      <div class="m-empty-state__body">
        <h2 id="clear-reviews-heading" class="m-section-heading">${title}</h2>
        <p class="m-copy m-copy--large">${copy}</p>
      </div>
    </section>`;
}

function queueRows(queue, user, hasScenes) {
  if (!queue.length) return clearQueue(hasScenes);
  const rows = queue.map((scene) => {
    const object = scene.stage === "Production review" ? (scene.currentVersion || "Latest Artboard") : (scene.currentVersion || "Scene concept");
    const action = scene.stage === "Production review"
      ? user.role === "higher-roads"
        ? `Review ${object} before it goes to the client.`
        : `Approve ${object} or leave feedback.`
      : `${object} is ready to send to the media team.`;
    return `<a class="m-rule-row" href="${escape(href(scene, user))}"><div class="m-stack"><span class="m-rule-row__title">${escape(scene.title)}</span><span class="m-meta">${escape(String(object).toUpperCase())}</span></div><div class="m-stack"><span class="m-state m-state--current">Ready for review</span><span class="m-copy">${escape(action)}</span></div></a>`;
  }).join("");
  return `<section class="m-directory-section" aria-labelledby="waiting-reviews-heading"><div class="m-directory-section__head"><h2 id="waiting-reviews-heading" class="m-scene-work-heading">Ready for your review</h2></div><div class="m-directory-list m-rule-list">${rows}</div></section>`;
}

function recentRows(recent, user) {
  if (!recent.length) return "";
  return `<section class="m-directory-section" aria-labelledby="recent-reviews-heading"><div class="m-directory-section__head"><h2 id="recent-reviews-heading" class="m-scene-work-heading">Completed reviews</h2><p class="m-copy">Open a review to see what was approved and the version it applies to.</p></div><div class="m-directory-list m-rule-list">${recent.map((scene) => `<a class="m-rule-row" href="${escape(reviewHref(scene, user))}"><div class="m-stack"><span class="m-rule-row__title">${escape(scene.title)}</span><span class="m-meta">${escape(String(scene.currentVersion).toUpperCase())}</span></div><span class="m-state m-state--approved">${escape(scene.currentVersion)} approved</span></a>`).join("")}</div></section>`;
}

async function load() {
  if (!TOUR_ID) {
    showNoTour(root, locationBar);
    return;
  }
  const [{ user }, { tour, assignments }] = await Promise.all([call("get-me"), call("get-tour")]);
  document.querySelectorAll("[data-operator-utility]").forEach((entry) => { entry.hidden = user.role !== "higher-roads"; });
  const queue = assignments.filter((scene) => needsUser(scene, user));
  const queued = new Set(queue.map((scene) => scene.id));
  const recent = assignments.filter((scene) => scene.currentVersion && ["Final approved", "Delivered"].includes(scene.stage) && !queued.has(scene.id));
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./index.html?tour=${escape(TOUR_ID)}">${escape(tour.name)}</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Reviews</span></nav>${queue.length ? `<span class="m-state m-state--current">${queue.length} to review</span>` : ""}`;
  root.innerHTML = `${queueRows(queue, user, Boolean(assignments.length))}${recentRows(recent, user)}`;
}

load().catch((error) => { locationBar.innerHTML = ""; root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`; });
