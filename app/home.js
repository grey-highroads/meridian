import { TOUR_ID, scopedBody } from "./context.js";
const locationBar = document.getElementById("location");
const root = document.getElementById("home");
const reviewCount = document.getElementById("review-count");

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, ...extra })) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) { return String(value === null || value === undefined ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function version(value) { return String(value || 0).padStart(2, "0"); }
function firstName(user) {
  const explicit = String(user.firstName || "").trim();
  if (explicit) return explicit;
  return String(user.displayName || "").trim().split(/\s+/)[0] || "there";
}

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

function emptyGlyph(kind) {
  if (kind === "clear") return `<svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="32" cy="32" r="21"></circle><path d="m22 32 7 7 14-16"></path></svg>`;
  if (kind === "scene") return `<svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true"><rect x="10" y="16" width="44" height="32" rx="2"></rect><path d="M20 32h24M32 20v24"></path></svg>`;
  return `<svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 44h40M16 36h32M22 28h20"></path><circle cx="32" cy="16" r="4"></circle></svg>`;
}

function attention(assignments, user) {
  const rows = assignments.filter((scene) => needsUser(scene, user)).map((scene) => `<a class="m-attention-row" href="${escape(sceneHref(scene))}"><div class="m-stack"><span class="m-meta">${escape(String(scene.stage).toUpperCase())}</span><strong>${escape(scene.title)}</strong><span class="m-copy">${escape(scene.nextAction)}</span></div><span class="m-button m-button--small">Open</span></a>`).join("");
  const empty = `<div class="m-empty-state m-empty-state--clear m-empty-state--compact"><div class="m-empty-state__visual">${emptyGlyph("clear")}</div><div class="m-empty-state__body"><h3 class="m-scene-work-heading">You are clear for now</h3><p class="m-copy">No decision or handoff needs you. We will put the exact Scene here when that changes.</p></div></div>`;
  return `<section class="m-home__attention" aria-labelledby="attention-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Needs your attention</span><h2 id="attention-heading" class="m-section-heading">${rows ? "Move the work" : "Nothing needs you"}</h2></div><span class="m-state ${rows ? "m-state--current" : "m-state--approved"}">${rows ? "Action waiting" : "Clear"}</span></div><div class="m-attention-list">${rows || empty}</div></section>`;
}

function progress(assignments) {
  const active = assignments.filter((scene) => scene.stage !== "Delivered").slice(0, 6);
  const status = (scene) => {
    if (scene.stage === "Final approved") return `${scene.currentVersion || "The latest artboard"} is approved. Final delivery is next.`;
    if (scene.stage === "Production review" && scene.waitingOn === "the client") return `${scene.currentVersion || "The latest artboard"} is with the client for approval.`;
    if (scene.stage === "Production review") return `${scene.currentVersion || "The latest artboard"} is ready for Higher Roads review.`;
    if (scene.stage === "Approved for production") return `${scene.currentVersion || "The approved brief"} is with production.`;
    if (scene.stage === "Concept review") return `${scene.currentVersion || "The brief"} is ready to send to production.`;
    if (scene.stage === "Concept in development") return "Higher Roads is preparing the production brief.";
    if (scene.stage === "Requested") return "Higher Roads is developing the Scene direction.";
    return "The Scene request still needs to be submitted.";
  };
  const rows = active.map((scene) => `<a class="m-lifecycle-row" href="${escape(sceneHref(scene))}"><div class="m-lifecycle-row__object"><strong>${escape(scene.title)}</strong>${scene.currentVersion ? `<span class="m-meta">${escape(String(scene.currentVersion).toUpperCase())}</span>` : ""}</div><p class="m-lifecycle-row__summary">${escape(status(scene))}</p></a>`).join("");
  const empty = `<div class="m-empty-state m-empty-state--action"><div class="m-empty-state__visual">${emptyGlyph("scene")}<span class="m-empty-state__calibration">First Scene / Ready</span></div><div class="m-empty-state__body"><span class="m-label">Start the creative loop</span><h3 class="m-section-heading">Give the tour its first Scene</h3><p class="m-copy m-copy--large">Name the song, transition, or show moment that needs media. Tell us what it should do. Higher Roads can take it from there.</p><div class="m-empty-state__actions"><a class="m-button m-button--primary" href="./request.html?tour=${escape(TOUR_ID)}">Request a Scene</a><span class="m-meta">ONE SENTENCE IS ENOUGH</span></div></div></div>`;
  return `<section class="m-home__progress" aria-labelledby="progress-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Scenes in progress</span><h2 id="progress-heading" class="m-section-heading">Current work</h2></div>${active.length ? `<a class="m-button m-button--small" href="./scenes.html?tour=${escape(TOUR_ID)}">All Scenes</a>` : ""}</div><div class="m-lifecycle-list">${rows || empty}</div></section>`;
}

function tourReference(tour) {
  const categories = [
    { label: "Tour Direction", ready: Boolean(tour.direction?.words), detail: tour.direction?.words ? `Direction V${version(tour.direction.version)}` : "Not added" },
    { label: "Dates and venues", ready: Boolean((tour.dates || []).length), detail: (tour.dates || []).length ? `${tour.dates.length} dates` : "Not added" },
    { label: "Playback system", ready: Boolean(tour.playbackSystem), detail: tour.playbackSystem ? "Recorded" : "Not added" },
    { label: "Production setup", ready: Boolean(tour.productionSetup?.words), detail: tour.productionSetup?.words ? `Setup V${version(tour.productionSetup.version)}` : "Not added" },
    { label: "Themes", ready: Boolean((tour.themes || []).length), detail: (tour.themes || []).length ? `${tour.themes.length} themes` : "Not added" },
  ];
  const ready = categories.filter((item) => item.ready).length;
  const rows = categories.map((item) => `<a class="m-readiness-row" href="./tour.html?tour=${escape(TOUR_ID)}"><div class="m-stack"><strong>${escape(item.label)}</strong><span class="m-meta">${escape(String(item.detail).toUpperCase())}</span></div><span class="m-state ${item.ready ? "m-state--approved" : "m-state--current"}">${item.ready ? "Ready" : "Needs info"}</span></a>`).join("");
  return `<aside class="m-home__sidecar m-inspector" aria-labelledby="tour-reference-heading"><header class="m-inspector__header"><div class="m-stack"><span class="m-label">Tour at a glance</span><h2 id="tour-reference-heading" class="m-inspector-heading">${ready} of ${categories.length} ready</h2></div></header><section class="m-inspector__section m-readiness-list">${rows}</section><section class="m-inspector__section"><a class="m-button" href="./tour.html?tour=${escape(TOUR_ID)}">Open Tour Details</a></section></aside>`;
}

function recent(facts) {
  const rows = facts.sort((left, right) => String(right.at).localeCompare(String(left.at))).slice(0, 5).map((fact) => `<div class="m-activity-row"><span class="m-activity-row__marker ${fact.action.includes("Approved") ? "m-activity-row__marker--approved" : ""}"></span><div><p class="m-activity-row__copy">${escape(fact.action)} ${escape(fact.version || "")}</p><span class="m-meta">${escape(String(fact.actor).toUpperCase())} / ${escape(fact.at)}</span></div></div>`).join("");
  const empty = `<div class="m-empty-inline"><span class="m-label">The record starts with the first decision</span><p class="m-copy">Approvals, feedback, and handoffs will stay here with the person, time, and exact version.</p></div>`;
  return `<section class="m-home__activity" aria-labelledby="activity-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Recent decisions</span><h2 id="activity-heading" class="m-section-heading">What changed</h2></div></div><div class="m-activity-list">${rows || empty}</div></section>`;
}

async function load() {
  const [{ user }, { tour, assignments }] = await Promise.all([call("get-me"), call("get-tour")]);
  document.querySelectorAll("[data-operator-utility]").forEach((entry) => { entry.hidden = user.role !== "higher-roads"; });
  const facts = [];
  for (const scene of assignments) {
    try { facts.push(...(await call("get-scene-activity", { assignmentId: scene.id })).facts); } catch {}
  }
  const reviews = assignments.filter((scene) => needsUser(scene, user) && ["Production review", "Concept review"].includes(scene.stage));
  reviewCount.textContent = reviews.length ? String(reviews.length) : "";
  locationBar.innerHTML = `<span class="m-meta">ACTIVE TOUR</span><span class="m-state m-state--current">${escape(tour.name)}</span>`;
  root.innerHTML = `<header class="m-home__header"><div class="m-home__header-copy"><span class="m-label">Today</span><h1 class="m-heading">Welcome, ${escape(firstName(user))}</h1><p class="m-copy m-copy--large">See what needs you, then move on.</p></div>${assignments.length ? `<a class="m-button m-button--primary" href="./request.html?tour=${escape(TOUR_ID)}">Request a Scene</a>` : ""}</header><div class="m-home__layout"><div class="m-home__primary">${attention(assignments, user)}${progress(assignments)}${recent(facts)}</div>${tourReference(tour)}</div>`;
}

load().catch((error) => { locationBar.innerHTML = ""; root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`; });
