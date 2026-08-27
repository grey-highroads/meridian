import { TOUR_ID, scopedBody } from "./context.js";
import { showNoTour } from "./no-tour.js";

// The Scenes directory. One tour, the Scenes under it, read from the tour
// handler. Nothing is stored here and nothing is decided here. A Scene row is
// the way into the work.
//
// The directory is only a way into a Scene. Lifecycle detail belongs on Home,
// Reviews, and the Scene itself, where a person can act on it.

const locationBar = document.getElementById("location");
const scenes = document.getElementById("scenes");
const requestScene = document.getElementById("request-scene");
if (requestScene && TOUR_ID) requestScene.href = `./request.html?tour=${encodeURIComponent(TOUR_ID)}`;

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function call(action) {
  const response = await fetch("/api/tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID })),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Meridian could not load these Scenes. Refresh the page and try again.");
  return body;
}

function sceneRow(entry) {
  const link = `./scene.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(entry.id)}`;
  const moment = entry.moment ? String(entry.moment).toUpperCase() : "SCENE";
  return `<a class="m-rule-row m-scene-row" href="${escape(link)}">
      <div class="m-stack">
        <span class="m-meta">${escape(moment)}</span>
        <span class="m-rule-row__title">${escape(entry.title)}</span>
      </div>
      <span class="m-scene-row__open" aria-hidden="true">Open Scene</span>
    </a>`;
}

function firstScene() {
  return `<section class="m-empty-state m-empty-state--action" aria-labelledby="first-scene-heading">
      <div class="m-empty-state__visual" aria-hidden="true">
        <svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor">
          <rect x="10" y="16" width="44" height="32" rx="2"></rect>
          <path d="M20 32h24M32 20v24"></path>
          <path d="M6 24v-8a4 4 0 0 1 4-4h8M58 40v8a4 4 0 0 1-4 4h-8"></path>
        </svg>
      </div>
      <div class="m-empty-state__body">
        <h2 id="first-scene-heading" class="m-section-heading">Request the first Scene</h2>
        <p class="m-copy m-copy--large">A Scene can be a song, an intro, a transition, or any moment that needs screen content. Name it and tell Higher Roads what it should do. One sentence is enough.</p>
        <div class="m-empty-state__actions"><a class="m-button m-button--primary" href="./request.html?tour=${escape(TOUR_ID)}">Request a Scene</a><span class="m-meta">REFERENCES ARE OPTIONAL</span></div>
      </div>
    </section>`;
}

async function load() {
  if (!TOUR_ID) {
    if (requestScene) requestScene.hidden = true;
    showNoTour(scenes, locationBar);
    return;
  }
  scenes.innerHTML = `<p class="m-copy">Loading Scenes…</p>`;
  let body;
  try {
    body = await call("get-tour");
  } catch (error) {
    locationBar.innerHTML = "";
    scenes.innerHTML = `<p class="m-copy">${escape(error.message)}</p>`;
    return;
  }

  const tour = body.tour;
  const assignments = body.assignments || [];
  const tourLink = `./tour.html?tour=${encodeURIComponent(TOUR_ID)}`;
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <a href="${escape(tourLink)}">${escape(tour.name)}</a>
      <span aria-hidden="true">/</span>
      <span class="m-breadcrumb__current">Scenes</span>
    </nav>`;
  if (requestScene) requestScene.hidden = !assignments.length;
  scenes.innerHTML = assignments.length
    ? `<div class="m-rule-list">${assignments.map(sceneRow).join("")}</div>`
    : firstScene();
}

load();
