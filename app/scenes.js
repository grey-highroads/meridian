// The Scenes directory. One tour, the Scenes under it, read from the tour
// handler. Nothing is stored here and nothing is decided here. A Scene row is
// the way into the work.
//
// The directory is only a way into a Scene. Lifecycle detail belongs on Home,
// Reviews, and the Scene itself, where a person can act on it.

const TOUR_ID = new URLSearchParams(window.location.search).get("tour") || "off-the-map-2026";

const locationBar = document.getElementById("location");
const scenes = document.getElementById("scenes");
const requestScene = document.getElementById("request-scene");
if (requestScene) requestScene.href = `./request.html?tour=${encodeURIComponent(TOUR_ID)}`;

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function number(index) {
  return String(index + 1).padStart(2, "0");
}

function sceneRow(entry, index) {
  const link = `./scene.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(entry.id)}`;
  const moment = entry.moment ? ` / ${String(entry.moment).toUpperCase()}` : "";
  return `<a class="m-rule-row m-scene-row" href="${escape(link)}">
      <div class="m-stack">
        <span class="m-meta">SCENE ${number(index)}${escape(moment)}</span>
        <span class="m-rule-row__title">${escape(entry.title)}</span>
      </div>
      <span class="m-scene-row__open" aria-hidden="true">Open</span>
    </a>`;
}

async function load() {
  scenes.innerHTML = `<p class="m-copy">Reading the tour.</p>`;
  let body;
  try {
    const response = await fetch("/api/tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get-tour", tourId: TOUR_ID }),
    });
    body = await response.json();
    if (!response.ok) throw new Error(body.error || "That did not work.");
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
  scenes.innerHTML = assignments.length
    ? `<div class="m-rule-list">${assignments.map(sceneRow).join("")}</div>`
    : `<p class="m-copy">No Scenes have been requested on this tour yet.</p>`;
}

load();
