import { ACCOUNT_ID, TOUR_ID, scopedBody } from "./context.js";
const locationBar = document.getElementById("location");
const root = document.getElementById("home");
const reviewCount = document.getElementById("review-count");
const params = new URLSearchParams(window.location.search);
const homeView = { user: null, tour: null, assignments: [], introductionStep: 0, introductionWorking: false, introductionMessage: "" };

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
  if (kind === "scene") return `<svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true"><rect x="10" y="16" width="44" height="32" rx="2"></rect><path d="M20 32h24M32 20v24"></path><path d="M6 24v-8a4 4 0 0 1 4-4h8M58 40v8a4 4 0 0 1-4 4h-8"></path></svg>`;
  if (kind === "review") return `<svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="32" cy="32" r="21"></circle><path d="m22 32 7 7 14-16"></path><path d="M32 5v7M32 52v7M5 32h7M52 32h7"></path></svg>`;
  if (kind === "direction") return `<svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="32" cy="32" r="23"></circle><path d="m39 25-4 10-10 4 4-10 10-4Z"></path><path d="M32 5v7M32 52v7M5 32h7M52 32h7"></path></svg>`;
  return `<svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 44h40M16 36h32M22 28h20"></path><circle cx="32" cy="16" r="4"></circle></svg>`;
}

const INTRODUCTION = [
  { title: "Home", copy: "Your snapshot into everything happening with the tour creative.", kind: "tour", calibration: "Tour / Not started" },
  { title: "Scenes", copy: "A Scene can be a song, an intro, a transition, or any moment that needs screen content.", kind: "scene", calibration: "Scene register / Open" },
  { title: "Reviews", copy: "Provide feedback, request changes, or approve the work for final production.", kind: "review", calibration: "Decision queue / Clear" },
  { title: "Tour Details", copy: "Instructions that guide the creative work across all the scenes of the tour.", kind: "direction", calibration: "Tour direction / Not set" },
  { title: "Get Started", copy: "Start by adding Tour visual direction and details so the creative process can begin.", kind: "tour", calibration: "Tour / Not started" },
];

function introduction() {
  const card = INTRODUCTION[homeView.introductionStep];
  const last = homeView.introductionStep === INTRODUCTION.length - 1;
  locationBar.innerHTML = "";
  reviewCount.textContent = "";
  root.innerHTML = `<section class="m-empty-state m-empty-state--action" aria-labelledby="introduction-heading">
      <div class="m-empty-state__visual" aria-hidden="true">${emptyGlyph(card.kind)}<span class="m-empty-state__calibration">${escape(card.calibration)}</span></div>
      <div class="m-empty-state__body">
        <span class="m-label">Welcome to Meridian</span>
        <h1 id="introduction-heading" class="m-heading">${escape(card.title)}</h1>
        <p class="m-copy m-copy--large">${escape(card.copy)}</p>
        ${homeView.introductionMessage ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(homeView.introductionMessage)}</p></div>` : ""}
        <div class="m-empty-state__actions">
          <button class="m-button m-button--primary" type="button" ${last ? "data-finish-introduction" : "data-next-introduction"} ${homeView.introductionWorking ? "disabled" : ""}>${last ? "Go to Tour details" : "Next"}</button>
          <button class="m-button m-button--quiet" type="button" data-skip-introduction ${homeView.introductionWorking ? "disabled" : ""}>Skip introduction</button>
          <span class="m-meta">${homeView.introductionStep + 1} OF ${INTRODUCTION.length}</span>
        </div>
      </div>
    </section>`;
}

function explainedCard(id, title, copy, kind, calibration, state = "") {
  return `<section class="m-empty-state ${state} m-empty-state--compact" aria-labelledby="${escape(id)}">
      <div class="m-empty-state__visual" aria-hidden="true">${emptyGlyph(kind)}<span class="m-empty-state__calibration">${escape(calibration)}</span></div>
      <div class="m-empty-state__body"><h2 id="${escape(id)}" class="m-section-heading">${escape(title)}</h2><p class="m-copy">${escape(copy)}</p></div>
    </section>`;
}

// Before Scenes exist, Home explains the sections that will fill in as the
// team works. The same three cards appear whether the tour exists or not.
function explainedHome(user, tour) {
  const action = tour ? "Open Tour details" : "Start the tour";
  const reason = tour
    ? "Add the tour direction and details there so the creative work has a shared foundation."
    : "Create the tour in Tour details so Meridian has a place for its direction, Scenes, reviews, and production information.";
  locationBar.innerHTML = tour ? `<span class="m-meta">ACTIVE TOUR</span><span class="m-state m-state--current">${escape(tour.name)}</span>` : "";
  reviewCount.textContent = "";
  root.innerHTML = `<header class="m-home__header"><div class="m-home__header-copy"><span class="m-label">Home</span><h1 class="m-heading">Welcome, ${escape(firstName(user))}</h1><p class="m-copy m-copy--large">Home is your snapshot of what needs you and what is moving across the tour creative.</p><p class="m-copy">${escape(reason)}</p></div><a class="m-button m-button--primary" href="./tour.html">${escape(action)}</a></header>
    <div class="m-stack">
      ${explainedCard("home-scenes-heading", "Scenes", "Scene requests, current work, and the next step for each Scene will appear here.", "scene", "Scene register / Open", "m-empty-state--action")}
      ${explainedCard("home-reviews-heading", "Reviews", "Work waiting for your feedback, changes, or approval will appear here.", "review", "Decision queue / Clear", "m-empty-state--clear")}
      ${explainedCard("home-tour-details-heading", "Tour Details", "Creative direction, dates, venues, and production details will live here.", "direction", "Tour direction / Not set", "m-empty-state--waiting")}
    </div>`;
}

// A question Higher Roads asked and nobody has answered. It sits beside the
// Scenes that need this person, because answering is the thing they can do.
// The Scene itself has not moved, so it keeps whatever stage and next step it
// already had.
function openQuestions(assignments, user) {
  if (user.role === "higher-roads") return [];
  return assignments.flatMap((scene) => (scene.openQuestions || []).map((question) => ({ scene, question })));
}

function attention(assignments, user) {
  const waiting = assignments.filter((scene) => needsUser(scene, user));
  const questions = openQuestions(assignments, user);
  const sceneRows = waiting.map((scene) => `<a class="m-attention-row" href="${escape(sceneHref(scene))}"><div class="m-stack"><span class="m-meta">${escape(String(scene.currentVersion || "Scene").toUpperCase())}</span><strong>${escape(scene.title)}</strong><span class="m-copy">${escape(scene.nextAction)}</span></div><span class="m-button m-button--small">Open Scene</span></a>`).join("");
  const questionRows = questions.map(({ scene, question }) => `<a class="m-attention-row" href="./scene.html?tour=${escape(TOUR_ID)}&scene=${escape(scene.id)}"><div class="m-stack"><span class="m-meta">QUESTION FROM ${escape(String(question.askedBy || "HIGHER ROADS").toUpperCase())}</span><strong>${escape(scene.title)}</strong><span class="m-copy">${escape(question.text)}</span></div><span class="m-button m-button--small">Answer</span></a>`).join("");
  const rows = questionRows + sceneRows;
  const empty = `<div class="m-empty-state m-empty-state--clear m-empty-state--compact"><div class="m-empty-state__visual">${emptyGlyph("clear")}</div><div class="m-empty-state__body"><p class="m-copy">When that changes, you will see the Scene and next step here.</p></div></div>`;
  const count = waiting.length + questions.length;
  const heading = count === 1 ? "1 thing needs you" : `${count} things need you`;
  return `<section class="m-home__attention" aria-labelledby="attention-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label">Needs your attention</span><h2 id="attention-heading" class="m-section-heading">${count ? heading : "Nothing needs you right now"}</h2></div></div><div class="m-attention-list">${rows || empty}</div></section>`;
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

async function completeIntroduction(destination) {
  homeView.introductionWorking = true;
  homeView.introductionMessage = "";
  introduction();
  try {
    await call("mark-introduction-seen");
    const url = new URL(destination === "tour" ? "./tour.html" : "./index.html", window.location.href);
    if (ACCOUNT_ID) url.searchParams.set("account", ACCOUNT_ID);
    if (TOUR_ID) url.searchParams.set("tour", TOUR_ID);
    window.location.href = url.href;
  } catch (error) {
    homeView.introductionWorking = false;
    homeView.introductionMessage = error.message;
    introduction();
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-next-introduction")) {
    homeView.introductionStep = Math.min(homeView.introductionStep + 1, INTRODUCTION.length - 1);
    homeView.introductionMessage = "";
    introduction();
  }
  if (target.hasAttribute("data-skip-introduction")) void completeIntroduction("home");
  if (target.hasAttribute("data-finish-introduction")) void completeIntroduction("tour");
});

async function load() {
  const { user } = await call("get-me");
  homeView.user = user;
  document.querySelectorAll("[data-operator-utility]").forEach((entry) => { entry.hidden = user.role !== "higher-roads"; });
  if (user.role !== "higher-roads" && (params.has("introduction") || !user.introductionSeenAt)) {
    introduction();
    return;
  }
  if (!TOUR_ID) {
    explainedHome(user, null);
    return;
  }
  const { tour, assignments } = await call("get-tour");
  homeView.tour = tour;
  homeView.assignments = assignments;
  if (!assignments.length) {
    explainedHome(user, tour);
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
