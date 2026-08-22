// The Scenes directory. One tour, the Scenes under it, read from the tour
// handler. Nothing is stored here and nothing is decided here. A Scene row is
// the way into the work.

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

function sceneRow(entry, index) {
  const link = `./scene.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(entry.id)}`;
  return `<a class="m-rule-row" href="${escape(link)}">
      <div class="m-stack">
        <span class="m-meta">SCENE ${number(index)}</span>
        <span class="m-rule-row__title">${escape(entry.title)}</span>
      </div>
      <span class="m-meta">${escape(entry.moment || "")}</span>
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
  locationBar.innerHTML = `<span class="m-meta">${escape(tour.name)}${tour.cycle ? ` / ${escape(tour.cycle)}` : ""}</span>`;
  scenes.innerHTML = assignments.length
    ? `<div class="m-rule-list">${assignments.map(sceneRow).join("")}</div>`
    : `<p class="m-copy">No Scenes have been requested on this tour yet.</p>`;
}

load();
