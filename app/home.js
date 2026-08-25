const TOUR_ID = new URLSearchParams(window.location.search).get("tour") || "off-the-map-2026";
const locationBar = document.getElementById("location");
const root = document.getElementById("home");
const reviewCount = document.getElementById("review-count");

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, tourId: TOUR_ID, ...extra }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) { return String(value === null || value === undefined ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function version(value) { return String(value || 0).padStart(2, "0"); }

function sceneHref(scene) {
  if (scene.stage === "Production review") {
    return scene.waitingOn === "the client"
      ? `./client-review.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(scene.id)}`
      : `./review.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(scene.id)}`;
  }
  return `./scene.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(scene.id)}`;
}

function needsUser(scene, user) {
  if (user.role === "higher-roads") return scene.waitingOn === "Higher Roads";
  return scene.waitingOn === "the client";
}

function attention(assignments, user) {
  const rows = assignments.filter((scene) => needsUser(scene, user)).map((scene) => `<a class="m-attention-row" href="${escape(sceneHref(scene))}"><div class="m-stack"><span class="m-meta">${escape(String(scene.stage).toUpperCase())}</span><strong>${escape(scene.title)}</strong><span class="m-copy">${escape(scene.nextAction)}</span></div><span class="m-button m-button--small">Open</span></a>`).join("");
  return `<section class="m-home__attention" aria-labelledby="attention-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Needs your attention</span><h2 id="attention-heading" class="m-section-heading">${rows ? "Move the work" : "Nothing needs you"}</h2></div><span class="m-state ${rows ? "m-state--current" : "m-state--approved"}">${rows ? "Action waiting" : "Clear"}</span></div><div class="m-attention-list">${rows || `<div class="m-callout m-callout--approved"><p class="m-copy">The tour is moving and no decision is waiting on you.</p></div>`}</div></section>`;
}

function progress(assignments) {
  const active = assignments.filter((scene) => scene.stage !== "Delivered").slice(0, 6);
  const rows = active.map((scene) => `<a class="m-lifecycle-row" href="${escape(sceneHref(scene))}"><div class="m-lifecycle-row__object"><strong>${escape(scene.title)}</strong><span class="m-meta">${escape(String(scene.currentVersion || "NO VERSION YET").toUpperCase())}</span></div><div class="m-lifecycle-row__fact"><span class="m-label">Stage</span><span class="m-lifecycle-row__stage">${escape(scene.stage)}</span></div><div class="m-lifecycle-row__fact"><span class="m-label">Waiting on</span><span class="m-lifecycle-row__value">${escape(scene.waitingOn)}</span></div><div class="m-lifecycle-row__fact"><span class="m-label">Next</span><span class="m-lifecycle-row__value">${escape(scene.nextAction)}</span></div></a>`).join("");
  return `<section class="m-home__progress" aria-labelledby="progress-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Scenes in progress</span><h2 id="progress-heading" class="m-section-heading">Current work</h2></div><a class="m-button m-button--small" href="./scenes.html?tour=${escape(TOUR_ID)}">All Scenes</a></div><div class="m-lifecycle-list">${rows || `<p class="m-copy">No Scenes are in progress.</p>`}</div></section>`;
}

function tourReference(tour) {
  const missing = [];
  if (!tour.direction?.words) missing.push("Add Tour Direction");
  if (!(tour.dates || []).length) missing.push("Add dates and venues");
  if (!tour.playbackSystem) missing.push("Add the playback system");
  return `<aside class="m-home__sidecar m-inspector" aria-labelledby="tour-reference-heading"><header class="m-inspector__header"><div class="m-stack"><span class="m-label">Tour at a glance</span><h2 id="tour-reference-heading" class="m-inspector-heading">${missing.length ? `${missing.length} details need attention` : "Key details are on record"}</h2></div></header><section class="m-inspector__section">${missing.length ? missing.map((item) => `<a class="m-inspector__item" href="./tour.html?tour=${escape(TOUR_ID)}"><strong>${escape(item)}</strong><span class="m-meta">OPEN TOUR DETAILS</span></a>`).join("") : `<p class="m-copy">Tour Direction V${version(tour.direction.version)}, ${escape((tour.dates || []).length)} dates, and ${escape(tour.playbackSystem)}.</p>`}</section><section class="m-inspector__section"><a class="m-button" href="./tour.html?tour=${escape(TOUR_ID)}">Open Tour Details</a></section></aside>`;
}

function recent(facts) {
  const rows = facts.sort((left, right) => String(right.at).localeCompare(String(left.at))).slice(0, 5).map((fact) => `<div class="m-activity-row"><span class="m-activity-row__marker ${fact.action.includes("Approved") ? "m-activity-row__marker--approved" : ""}"></span><div><p class="m-activity-row__copy">${escape(fact.action)} ${escape(fact.version || "")}</p><span class="m-meta">${escape(String(fact.actor).toUpperCase())} / ${escape(fact.at)}</span></div></div>`).join("");
  return `<section class="m-home__activity" aria-labelledby="activity-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Recent decisions</span><h2 id="activity-heading" class="m-section-heading">What changed</h2></div></div><div class="m-activity-list">${rows || `<p class="m-copy">No decisions have been recorded yet.</p>`}</div></section>`;
}

async function load() {
  const [{ user }, { tour, assignments }] = await Promise.all([call("get-me"), call("get-tour")]);
  document.querySelectorAll("[data-operator-utility]").forEach((entry) => { entry.hidden = user.role !== "higher-roads"; });
  const facts = [];
  for (const scene of assignments) {
    try { facts.push(...(await call("get-scene-activity", { assignmentId: scene.id })).facts); } catch {}
  }
  const reviews = assignments.filter((scene) => scene.stage === "Production review" || scene.stage === "Concept review");
  reviewCount.textContent = reviews.length ? String(reviews.length) : "";
  locationBar.innerHTML = `<span class="m-meta">ACTIVE TOUR</span><span class="m-state m-state--current">${escape(tour.name)}</span>`;
  root.innerHTML = `<header class="m-home__header"><div class="m-home__header-copy"><span class="m-label">Today</span><h1 class="m-heading">${escape(tour.name)}</h1><p class="m-copy m-copy--large">See what needs you, then move on.</p></div><a class="m-button m-button--primary" href="./request.html?tour=${escape(TOUR_ID)}">Request a Scene</a></header><div class="m-home__layout"><div class="m-home__primary">${attention(assignments, user)}${progress(assignments)}${recent(facts)}</div>${tourReference(tour)}</div>`;
}

load().catch((error) => { locationBar.innerHTML = ""; root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`; });
