// The Scenes directory. One tour, the Scenes under it, read from the tour
// handler. Nothing is stored here and nothing is decided here. A Scene row is
// the way into the work.
//
// Each row carries the stage, the current version when one exists, who the
// work waits on, and the next job. All four come from the handler, which reads
// them from src/tour/lifecycle.js. This screen decides none of them.

const TOUR_ID = new URLSearchParams(window.location.search).get("tour") || "off-the-map-2026";

const locationBar = document.getElementById("location");
const scenes = document.getElementById("scenes");

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function number(index) {
  return String(index + 1).padStart(2, "0");
}

// Stages where the work is settled use the approved treatment. Everything in
// motion uses the current one. The words carry the meaning either way.
const SETTLED = ["Final approved", "Delivered"];

function stateClass(stage) {
  return SETTLED.includes(stage) ? "m-state m-state--approved" : "m-state m-state--current";
}

function sceneRow(entry, index) {
  const link = `./scene.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(entry.id)}`;
  const moment = entry.moment ? ` / ${String(entry.moment).toUpperCase()}` : "";
  const version = entry.currentVersion
    ? `<span class="m-meta">${escape(String(entry.currentVersion).toUpperCase())}</span>`
    : "";
  return `<a class="m-rule-row" href="${escape(link)}">
      <div class="m-stack">
        <span class="m-meta">SCENE ${number(index)}${escape(moment)}</span>
        <span class="m-rule-row__title">${escape(entry.title)}</span>
        <span class="m-copy">${escape(entry.nextAction || "")}</span>
      </div>
      <div class="m-stack">
        <span class="${escape(stateClass(entry.stage))}">${escape(entry.stage || "")}</span>
        ${version}
        <span class="m-meta">WAITING ON ${escape(String(entry.waitingOn || "").toUpperCase())}</span>
      </div>
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
