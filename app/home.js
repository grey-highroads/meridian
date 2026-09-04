import { ACCOUNT_ID, TOUR_ID, scopedBody } from "./context.js";
import { TOUR_LABEL, tourLabel } from "./label.js";
const locationBar = document.getElementById("location");
const root = document.getElementById("home");
const reviewCount = document.getElementById("review-count");
const params = new URLSearchParams(window.location.search);
const homeView = { user: null, tour: null, label: TOUR_LABEL, assignments: [], introductionStep: 0, introductionWorking: false, introductionMessage: "" };

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

function todayLabel() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}

// Work that needs a decision opens in the Reviews gallery, on the version in
// question, board first. Both roles land on the same address; what a client
// may see there is decided by the server. Ruled 2026-08-27.
function reviewHref(sceneId, artboardVersion) {
  return `./reviews.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(sceneId)}&version=${encodeURIComponent(artboardVersion)}`;
}

function sceneHref(scene) {
  if (scene.stage === "Production review" && scene.currentArtboardVersion) {
    return reviewHref(scene.id, scene.currentArtboardVersion);
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

// The introduction runs before the tour itself is read, so it takes the word
// the account already resolved rather than waiting on a tour load.
function introductionCards(label) {
  return [
    { title: "Home", copy: "Your snapshot into everything happening with the tour creative.", kind: "tour", calibration: `${label} / Not started` },
    { title: "Scenes", copy: "A Scene can be a song, an intro, a transition, or any moment that needs screen content.", kind: "scene", calibration: "Scene register / Open" },
    { title: "Reviews", copy: "Provide feedback, request changes, or approve the work for final production.", kind: "review", calibration: "Decision queue / Clear" },
    { title: `${label} details`, copy: "Instructions that guide the creative work across all the scenes of the tour.", kind: "direction", calibration: `${label} direction / Not set` },
    { title: "Get Started", copy: `Start by adding ${label} visual direction and details so the creative process can begin.`, kind: "tour", calibration: `${label} / Not started` },
  ];
}

function introduction() {
  const cards = introductionCards(homeView.label);
  const card = cards[homeView.introductionStep];
  const last = homeView.introductionStep === cards.length - 1;
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
          <button class="m-button m-button--primary" type="button" ${last ? "data-finish-introduction" : "data-next-introduction"} ${homeView.introductionWorking ? "disabled" : ""}>${last ? `Go to ${escape(homeView.label)} details` : "Next"}</button>
          <button class="m-button m-button--quiet" type="button" data-skip-introduction ${homeView.introductionWorking ? "disabled" : ""}>Skip introduction</button>
          <span class="m-meta">${homeView.introductionStep + 1} OF ${cards.length}</span>
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
  const label = tour ? tourLabel(tour) : homeView.label;
  const action = tour ? `Open ${label} details` : "Start the tour";
  const lower = label.toLowerCase();
  const reason = tour
    ? `Add the ${lower} direction and details there so the creative work has a shared foundation.`
    : `Create the ${lower} in ${label} details so Meridian has a place for its direction, Scenes, reviews, and production information.`;
  locationBar.innerHTML = tour ? `<span class="m-meta">ACTIVE TOUR</span><span class="m-state m-state--current">${escape(tour.name)}</span>` : "";
  reviewCount.textContent = "";
  root.innerHTML = `<header class="m-home__header"><div class="m-home__header-copy"><span class="m-label">Home</span><h1 class="m-heading">Welcome, ${escape(firstName(user))}</h1><p class="m-copy m-copy--large">Home is your snapshot of what needs you and what is moving across the tour creative.</p><p class="m-copy">${escape(reason)}</p></div><a class="m-button m-button--primary" href="./tour.html">${escape(action)}</a></header>
    <div class="m-stack">
      ${explainedCard("home-scenes-heading", "Scenes", "Scene requests, current work, and the next step for each Scene will appear here.", "scene", "Scene register / Open", "m-empty-state--action")}
      ${explainedCard("home-reviews-heading", "Reviews", "Work waiting for your feedback, changes, or approval will appear here.", "review", "Decision queue / Clear", "m-empty-state--clear")}
      ${explainedCard("home-tour-details-heading", `${label} details`, "Creative direction, dates, venues, and production details will live here.", "direction", `${label} direction / Not set`, "m-empty-state--waiting")}
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

function progressStatus(scene, user) {
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
}

function shortVersion(scene) {
  return String(scene.currentVersion || "").match(/V\d+/i)?.[0]?.toUpperCase() || "";
}

// Home is a decision surface, not two directories that repeat the same Scene.
// A Scene appears once under Needs you when it carries a decision or question;
// everything else stays one disclosure beneath as work moving independently.
function currentWork(assignments, user) {
  const active = assignments.filter((scene) => scene.stage !== "Delivered");
  const questionsByScene = new Map(openQuestions(active, user).map(({ scene, question }) => [scene.id, question]));
  const needs = active.filter((scene) => needsUser(scene, user) || questionsByScene.has(scene.id));
  const needIds = new Set(needs.map((scene) => scene.id));
  const moving = active.filter((scene) => !needIds.has(scene.id)).slice(0, Math.max(0, 8 - needs.length));

  const needRows = needs.map((scene) => {
    const question = questionsByScene.get(scene.id);
    const current = shortVersion(scene);
    const eyebrow = question ? "Answer requested" : scene.stage === "Production review" ? "Ready to review" : "Decision needed";
    const copy = question ? question.text : scene.stage === "Production review" && current ? `${current} is ready to review.` : scene.nextAction;
    const action = question ? "Answer" : scene.stage === "Production review" && current ? `Review ${current}` : "Open Scene";
    const href = question ? `./scene.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(scene.id)}` : sceneHref(scene);
    const movingCopy = question ? progressStatus(scene, user) : "";
    return `<a class="m-attention-row" href="${escape(href)}">
        <div class="m-attention-row__content"><span class="m-label m-attention-row__signal">${escape(eyebrow)}</span><div class="m-attention-row__eyebrow"><strong class="m-attention-row__title">${escape(scene.title)}</strong>${current ? `<span class="m-meta">${escape(current)}</span>` : ""}</div></div>
        <div class="m-attention-row__content"><p class="m-attention-row__copy">${escape(copy)}</p>${movingCopy && movingCopy !== copy ? `<span class="m-meta">${escape(movingCopy)}</span>` : ""}</div>
        <span class="m-button m-button--small">${escape(action)}</span>
      </a>`;
  }).join("");

  const movingRows = moving.map((scene) => `<a class="m-lifecycle-row" href="${escape(sceneHref(scene))}"><div class="m-lifecycle-row__object"><strong class="m-lifecycle-row__title">${escape(scene.title)}</strong>${scene.currentVersion ? `<span class="m-meta">${escape(String(scene.currentVersion).toUpperCase())}</span>` : ""}</div><p class="m-lifecycle-row__summary">${escape(progressStatus(scene, user))}</p></a>`).join("");
  const empty = `<div class="m-empty-inline m-empty-inline--clear"><p class="m-copy">Nothing needs a decision right now.</p></div>`;
  const disclosure = moving.length ? `<details class="m-home-moving" open><summary><span class="m-home-moving__label">In progress, nothing needed from you</span> <span class="m-home-moving__count">${moving.length} ${moving.length === 1 ? "Scene" : "Scenes"}</span></summary><div class="m-lifecycle-list">${movingRows}</div></details>` : "";

  return `<section class="m-home__work" aria-labelledby="work-heading"><div class="m-section-lead"><div class="m-stack"><span class="m-label m-home__work-label">Current work</span><h2 id="work-heading" class="m-section-heading">Needs you</h2></div><a class="m-home__section-link" href="./scenes.html?tour=${escape(TOUR_ID)}">All Scenes</a></div><div class="m-attention-list">${needRows || empty}</div>${disclosure}</section>`;
}

function tourReference(tour) {
  const label = tourLabel(tour);
  const categories = [
    { label: "Creative direction", ready: Boolean(tour.direction?.words), detail: tour.direction?.words ? `Direction V${version(tour.direction.version)}` : "Not added" },
    { label: "Dates and venues", ready: Boolean((tour.dates || []).length), detail: (tour.dates || []).length ? `${tour.dates.length} dates` : "Not added" },
    { label: "Playback system", ready: Boolean(tour.playbackSystem), detail: tour.playbackSystem ? "Recorded" : "Not added" },
    { label: "Production details", ready: Boolean(tour.productionSetup?.words), detail: tour.productionSetup?.words ? `Version V${version(tour.productionSetup.version)}` : "Not added" },
    { label: `${label}-wide themes`, ready: Boolean((tour.themes || []).length), optional: true, detail: (tour.themes || []).length ? `${tour.themes.length} themes` : "Add if useful" },
  ];
  const rows = categories.map((item) => {
    const state = item.ready ? "Added" : item.optional ? "Optional" : "Not added";
    const stateClass = item.ready ? "m-state--approved" : item.optional ? "" : "m-state--current";
    return `<a class="m-readiness-row" href="./tour.html?tour=${escape(TOUR_ID)}"><div class="m-stack"><strong>${escape(item.label)}</strong><span class="m-meta">${escape(String(item.detail).toUpperCase())}</span></div><span class="m-state ${stateClass}">${state}</span></a>`;
  }).join("");
  const missing = categories.filter((item) => !item.ready && !item.optional);
  const next = missing[0];
  const heading = next ? `${next.label} not added` : `${label} foundation is in place`;
  const action = next ? `Add ${next.label.toLowerCase()}` : "View tour details";
  return `<section class="m-home__tour" aria-labelledby="tour-reference-heading"><header class="m-home__reference-head"><span class="m-label">${escape(label)} foundation</span><h2 id="tour-reference-heading" class="m-section-heading">${escape(heading)}</h2></header><div class="m-home__tour-actions"><a class="m-button ${next ? "m-button--primary" : ""}" href="./tour.html?tour=${escape(TOUR_ID)}">${escape(action)}</a>${next ? `<a class="m-home__section-link" href="./tour.html?tour=${escape(TOUR_ID)}">View all tour details</a>` : ""}</div><details class="m-home__tour-details"><summary>Show ${escape(label.toLowerCase())} foundation</summary><div class="m-readiness-list">${rows}</div></details></section>`;
}

function recent(facts, user) {
  const rows = [...facts].sort((left, right) => String(right.at).localeCompare(String(left.at))).slice(0, 3).map((fact) => {
    const actor = String(fact.actor || "Someone");
    const isYou = actor === user.displayName || actor === firstName(user);
    const action = String(fact.action || "Updated");
    const verb = action.charAt(0).toLowerCase() + action.slice(1);
    const copy = `${isYou ? "You" : actor} ${verb}${fact.version ? ` ${fact.version}` : ""}`;
    return `<div class="m-activity-row"><span class="m-activity-row__marker ${action.includes("Approved") ? "m-activity-row__marker--approved" : ""}"></span><div><p class="m-activity-row__copy">${escape(copy)}</p><span class="m-meta">${escape(fact.sceneTitle || "TOUR")} · ${escape(fact.at)}</span></div></div>`;
  }).join("");
  const empty = `<div class="m-empty-inline"><p class="m-copy">Requests, feedback, and approvals will appear here as the tour moves.</p></div>`;
  return `<section class="m-home__activity" aria-labelledby="activity-heading"><header class="m-home__reference-head"><span class="m-label">Recent activity</span><h2 id="activity-heading" class="m-section-heading">Since your last visit</h2></header><div class="m-activity-list">${rows || empty}</div></section>`;
}

function homeSummary(assignments, user) {
  const active = assignments.filter((scene) => scene.stage !== "Delivered");
  const decisionIds = new Set([
    ...active.filter((scene) => needsUser(scene, user)).map((scene) => scene.id),
    ...openQuestions(active, user).map(({ scene }) => scene.id),
  ]);
  const count = decisionIds.size;
  const word = count === 1 ? "One" : count === 2 ? "Two" : String(count);
  if (!count) return active.length ? "Nothing is waiting. The work is moving." : "Nothing is waiting.";
  const waiting = `${word} ${count === 1 ? "decision is" : "decisions are"} waiting.`;
  return active.length > count ? `${waiting} Everything else is moving.` : waiting;
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
    homeView.introductionStep = Math.min(homeView.introductionStep + 1, introductionCards(homeView.label).length - 1);
    homeView.introductionMessage = "";
    introduction();
  }
  if (target.hasAttribute("data-skip-introduction")) void completeIntroduction("home");
  if (target.hasAttribute("data-finish-introduction")) void completeIntroduction("tour");
});

// The word this account calls its tour, read from the account's own list. The
// introduction runs before the tour is loaded, so it reads the word here
// rather than showing the default and correcting itself a moment later.
async function resolveLabel() {
  if (!TOUR_ID) return TOUR_LABEL;
  try {
    const { tours } = await call("list-tours");
    const found = (Array.isArray(tours) ? tours : []).find((entry) => entry.id === TOUR_ID);
    return tourLabel(found);
  } catch {
    return TOUR_LABEL;
  }
}

async function load() {
  const { user } = await call("get-me");
  homeView.user = user;
  document.querySelectorAll("[data-operator-utility]").forEach((entry) => { entry.hidden = user.role !== "higher-roads"; });
  if (user.role !== "higher-roads" && (params.has("introduction") || !user.introductionSeenAt)) {
    homeView.label = await resolveLabel();
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
    try {
      const activity = await call("get-scene-activity", { assignmentId: scene.id });
      facts.push(...activity.facts.map((fact) => ({ ...fact, sceneTitle: scene.title })));
    } catch {}
  }
  const reviews = assignments.filter((scene) => needsUser(scene, user) && ["Production review", "Concept review"].includes(scene.stage));
  reviewCount.textContent = reviews.length ? String(reviews.length) : "";
  locationBar.innerHTML = `<span class="m-meta">ACTIVE TOUR</span><span class="m-state m-state--current">${escape(tour.name)}</span>`;
  root.innerHTML = `<header class="m-home__header"><div class="m-home__header-copy"><span class="m-label">${escape(todayLabel())}</span><h1 class="m-heading">Today</h1><p class="m-copy m-copy--large">${escape(homeSummary(assignments, user))}</p></div>${assignments.length ? `<a class="m-button m-button--primary" href="./request.html?tour=${escape(TOUR_ID)}">Request a Scene</a>` : ""}</header><div class="m-home__layout"><div class="m-home__primary">${currentWork(assignments, user)}</div><aside class="m-home__sidecar m-home__reference">${recent(facts, user)}${tourReference(tour)}</aside></div>`;
}

load().catch((error) => { locationBar.innerHTML = ""; root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`; });
