import { TOUR_ID, scopedBody } from "./context.js";
const locationBar = document.getElementById("location");
const root = document.getElementById("home");
const reviewCount = document.getElementById("review-count");

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, ...extra })) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Meridian could not load this tour. Refresh the page and try again.");
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

// Home with no tour in the account. One sentence about what Meridian is for
// and the one act that changes the situation. Nothing else belongs here,
// because there is nothing else a person can do yet.
function startTour() {
  locationBar.innerHTML = "";
  root.innerHTML = `<section class="m-empty-state m-empty-state--action" aria-labelledby="start-tour-heading">
      <div class="m-empty-state__visual" aria-hidden="true">${emptyGlyph("tour")}</div>
      <div class="m-empty-state__body">
        <span class="m-label">Welcome to Meridian</span>
        <h1 id="start-tour-heading" class="m-heading">Start the tour</h1>
        <p class="m-copy m-copy--large">Meridian keeps the direction, Scene requests, versions, and approvals for your tour together.</p>
        <div class="m-empty-state__actions"><a class="m-button m-button--primary" href="./new-tour.html">Start the tour</a></div>
      </div>
    </section>`;
}

// What the tour holds, one line each. A line reports what is stored and never
// what a person owes, so nothing here is a chore list and nothing is ticked.
// The suggestion is the first line with nothing in it, and it reads as a
// suggestion.
function setupLines(tour, assignments) {
  const dates = tour.dates || [];
  const setup = tour.productionSetup;
  const lines = [
    {
      label: "Creative direction",
      filled: Boolean(tour.direction && String(tour.direction.words || "").trim()),
      detail: tour.direction && String(tour.direction.words || "").trim() ? `Version ${version(tour.direction.version)} added` : "Not added",
      // Tour details, where the direction lives beside the rest of the tour,
      // rather than the screen that writes a new version. A person following a
      // suggestion is going to look first.
      href: `./tour.html?tour=${encodeURIComponent(TOUR_ID)}#direction-heading`,
    },
    {
      label: "Dates and venues",
      filled: dates.length > 0,
      detail: dates.length ? `${dates.length} ${dates.length === 1 ? "date" : "dates"} added` : "Not added",
      href: `./tour.html?tour=${encodeURIComponent(TOUR_ID)}#tour-run-heading`,
    },
    {
      label: "Production details",
      filled: Boolean(setup && String(setup.words || "").trim()),
      detail: setup && String(setup.words || "").trim() ? "Added" : "Not added",
      href: `./tour.html?tour=${encodeURIComponent(TOUR_ID)}#setup-heading`,
    },
    {
      label: "Scenes",
      filled: assignments.length > 0,
      detail: assignments.length ? `${assignments.length === 1 ? "First Scene requested" : `${assignments.length} Scenes requested`}` : "Not requested",
      href: `./request.html?tour=${encodeURIComponent(TOUR_ID)}`,
    },
  ];
  const suggested = lines.find((line) => !line.filled) || null;
  return lines.map((line) => `<a class="m-readiness-row" href="${escape(line.href)}"><div class="m-stack"><strong>${escape(line.label)}</strong><span class="m-meta">${escape(String(line.detail).toUpperCase())}</span></div>${line === suggested ? `<span class="m-state m-state--current">A good next step</span>` : ""}</a>`).join("");
}

// Home with a tour and no Scenes yet. What the tour holds, and the one act that
// starts the creative work.
function setupShape(user, tour, assignments) {
  return `<header class="m-home__header"><div class="m-home__header-copy"><span class="m-label">Today</span><h1 class="m-heading">Welcome, ${escape(firstName(user))}</h1><p class="m-copy m-copy--large">${escape(tour.name)} is ready. Add what you know in any order, or request the first Scene now.</p></div><a class="m-button m-button--primary" href="./request.html?tour=${escape(TOUR_ID)}">Request a Scene</a></header>
    <section class="m-stack" aria-labelledby="tour-holds-heading">
      <div class="m-section-lead"><div class="m-stack"><span class="m-label">Tour setup</span><h2 id="tour-holds-heading" class="m-section-heading">Add what you know</h2></div></div>
      <div class="m-readiness-list">${setupLines(tour, assignments)}</div>
      <p class="m-copy">You can do these in any order. None is required before you request a Scene.</p>
    </section>`;
}

function attention(assignments, user) {
  const waiting = assignments.filter((scene) => needsUser(scene, user));
  const rows = waiting.map((scene) => `<a class="m-attention-row" href="${escape(sceneHref(scene))}"><div class="m-stack"><span class="m-meta">${escape(String(scene.currentVersion || "Scene").toUpperCase())}</span><strong>${escape(scene.title)}</strong><span class="m-copy">${escape(scene.nextAction)}</span></div><span class="m-button m-button--small">Open Scene</span></a>`).join("");
  const empty = `<div class="m-empty-state m-empty-state--clear m-empty-state--compact"><div class="m-empty-state__visual">${emptyGlyph("clear")}</div><div class="m-empty-state__body"><p class="m-copy">When that changes, you will see the Scene and next step here.</p></div></div>`;
  const heading = waiting.length === 1 ? "1 thing needs you" : `${waiting.length} things need you`;
  return `<section class="m-home__attention" aria-labelledby="attention-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Needs your attention</span><h2 id="attention-heading" class="m-section-heading">${waiting.length ? heading : "Nothing needs you right now"}</h2></div></div><div class="m-attention-list">${rows || empty}</div></section>`;
}

function progress(assignments, user) {
  const active = assignments.filter((scene) => scene.stage !== "Delivered").slice(0, 6);
  const status = (scene) => {
    const current = scene.currentVersion || "The latest version";
    if (scene.stage === "Final approved") return `${current} is approved. Final delivery is next.`;
    if (scene.stage === "Production review" && scene.waitingOn === "the client") {
      return user.role === "higher-roads" ? `${current} is with the client for review.` : `${current} is ready for your review.`;
    }
    if (scene.stage === "Production review") return `Higher Roads is reviewing ${current}.`;
    if (scene.stage === "Approved for production") return `The media team is working from ${current}.`;
    if (scene.stage === "Concept review") return `Higher Roads is preparing to send ${current} to the media team.`;
    if (scene.stage === "Concept in development") return "Higher Roads is preparing this Scene for production.";
    if (scene.stage === "Requested") return "Higher Roads is developing this Scene.";
    return "The Scene request still needs to be submitted.";
  };
  const rows = active.map((scene) => `<a class="m-lifecycle-row" href="${escape(sceneHref(scene))}"><div class="m-lifecycle-row__object"><strong>${escape(scene.title)}</strong>${scene.currentVersion ? `<span class="m-meta">${escape(String(scene.currentVersion).toUpperCase())}</span>` : ""}</div><p class="m-lifecycle-row__summary">${escape(status(scene))}</p></a>`).join("");
  const empty = `<div class="m-empty-state m-empty-state--action"><div class="m-empty-state__visual">${emptyGlyph("scene")}</div><div class="m-empty-state__body"><h3 class="m-section-heading">Request the first Scene</h3><p class="m-copy m-copy--large">Name the song or moment and what it needs to do. One sentence is enough. Higher Roads can take it from there.</p><div class="m-empty-state__actions"><a class="m-button m-button--primary" href="./request.html?tour=${escape(TOUR_ID)}">Request a Scene</a><span class="m-meta">REFERENCES ARE OPTIONAL</span></div></div></div>`;
  return `<section class="m-home__progress" aria-labelledby="progress-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Current work</span><h2 id="progress-heading" class="m-section-heading">Scenes in progress</h2></div>${active.length ? `<a class="m-button m-button--small" href="./scenes.html?tour=${escape(TOUR_ID)}">View all Scenes</a>` : ""}</div><div class="m-lifecycle-list">${rows || empty}</div></section>`;
}

function tourReference(tour) {
  const categories = [
    { label: "Creative direction", ready: Boolean(tour.direction?.words), detail: tour.direction?.words ? `Direction V${version(tour.direction.version)}` : "Not added" },
    { label: "Dates and venues", ready: Boolean((tour.dates || []).length), detail: (tour.dates || []).length ? `${tour.dates.length} dates` : "Not added" },
    { label: "Playback system", ready: Boolean(tour.playbackSystem), detail: tour.playbackSystem ? "Recorded" : "Not added" },
    { label: "Production details", ready: Boolean(tour.productionSetup?.words), detail: tour.productionSetup?.words ? `Version V${version(tour.productionSetup.version)}` : "Not added" },
    { label: "Tour-wide themes", ready: Boolean((tour.themes || []).length), optional: true, detail: (tour.themes || []).length ? `${tour.themes.length} themes` : "Add if useful" },
  ];
  const rows = categories.map((item) => {
    const state = item.ready ? "Added" : item.optional ? "Optional" : "Not added";
    const stateClass = item.ready ? "m-state--approved" : item.optional ? "" : "m-state--current";
    return `<a class="m-readiness-row" href="./tour.html?tour=${escape(TOUR_ID)}"><div class="m-stack"><strong>${escape(item.label)}</strong><span class="m-meta">${escape(String(item.detail).toUpperCase())}</span></div><span class="m-state ${stateClass}">${state}</span></a>`;
  }).join("");
  return `<aside class="m-home__sidecar m-inspector" aria-labelledby="tour-reference-heading"><header class="m-inspector__header"><div class="m-stack"><span class="m-label">Set up the tour</span><h2 id="tour-reference-heading" class="m-inspector-heading">Add what you know now</h2></div></header><section class="m-inspector__section m-readiness-list">${rows}</section><section class="m-inspector__section"><a class="m-button" href="./tour.html?tour=${escape(TOUR_ID)}">View tour details</a></section></aside>`;
}

function recent(facts) {
  const rows = facts.sort((left, right) => String(right.at).localeCompare(String(left.at))).slice(0, 5).map((fact) => `<div class="m-activity-row"><span class="m-activity-row__marker ${fact.action.includes("Approved") ? "m-activity-row__marker--approved" : ""}"></span><div><p class="m-activity-row__copy">${escape(fact.action)} ${escape(fact.version || "")}</p><span class="m-meta">${escape(String(fact.actor).toUpperCase())} / ${escape(fact.at)}</span></div></div>`).join("");
  const empty = `<div class="m-empty-inline"><p class="m-copy">Requests, feedback, and approvals will appear here as the tour moves.</p></div>`;
  return `<section class="m-home__activity" aria-labelledby="activity-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Recent activity</span><h2 id="activity-heading" class="m-section-heading">What has happened</h2></div></div><div class="m-activity-list">${rows || empty}</div></section>`;
}

async function load() {
  if (!TOUR_ID) {
    startTour();
    return;
  }
  const [{ user }, { tour, assignments }] = await Promise.all([call("get-me"), call("get-tour")]);
  document.querySelectorAll("[data-operator-utility]").forEach((entry) => { entry.hidden = user.role !== "higher-roads"; });
  if (!assignments.length) {
    reviewCount.textContent = "";
    locationBar.innerHTML = `<span class="m-meta">ACTIVE TOUR</span><span class="m-state m-state--current">${escape(tour.name)}</span>`;
    root.innerHTML = setupShape(user, tour, assignments);
    return;
  }
  const facts = [];
  for (const scene of assignments) {
    try { facts.push(...(await call("get-scene-activity", { assignmentId: scene.id })).facts); } catch {}
  }
  const reviews = assignments.filter((scene) => needsUser(scene, user) && ["Production review", "Concept review"].includes(scene.stage));
  reviewCount.textContent = reviews.length ? String(reviews.length) : "";
  locationBar.innerHTML = `<span class="m-meta">ACTIVE TOUR</span><span class="m-state m-state--current">${escape(tour.name)}</span>`;
  root.innerHTML = `<header class="m-home__header"><div class="m-home__header-copy"><span class="m-label">Today</span><h1 class="m-heading">Welcome, ${escape(firstName(user))}</h1><p class="m-copy m-copy--large">See what needs you and what is already moving.</p></div>${assignments.length ? `<a class="m-button m-button--primary" href="./request.html?tour=${escape(TOUR_ID)}">Request a Scene</a>` : ""}</header><div class="m-home__layout"><div class="m-home__primary">${attention(assignments, user)}${progress(assignments, user)}${recent(facts)}</div>${tourReference(tour)}</div>`;
}

load().catch((error) => { locationBar.innerHTML = ""; root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`; });
