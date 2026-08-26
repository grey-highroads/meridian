import { TOUR_ID, scopedBody } from "./context.js";
import { showNoTour } from "./no-tour.js";

// The tour home. The tour record and the direction as the director gave it.
// The route and the production setup can be written here, each on its own and
// neither waiting on the other. Direction has its own screen and Scene work
// happens on a Scene.

const locationBar = document.getElementById("location");
const root = document.getElementById("tour");

// Which section is open for editing, and what has been typed into it. Nothing
// here is required before a Scene can be requested.
const view = { tour: null, editing: null, dates: [], words: "", suppliedBy: "", message: "", working: false };

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, ...extra })),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Dates arrive as written in the tour file. A row that is not a plain date is
// shown as it came rather than being reformatted into something wrong.
function readableDate(value) {
  const parts = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return value || "";
  const month = MONTHS[Number(parts[2]) - 1] || parts[2];
  return `${Number(parts[3])} ${month} ${parts[1]}`;
}

function run(dates) {
  if (!dates.length) return "";
  const first = readableDate(dates[0].date);
  const last = readableDate(dates[dates.length - 1].date);
  return first === last ? first : `${first} TO ${last}`;
}

function paragraphs(text) {
  return String(text || "").split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escape(block)}</p>`)
    .join("");
}

function version(value) {
  return String(value || "").padStart(2, "0");
}

function directionSection(tour) {
  const direction = tour.direction;
  if (!direction || !String(direction.words || "").trim()) {
    return `<section class="m-empty-state m-empty-state--waiting" aria-labelledby="direction-heading">
        <div class="m-empty-state__visual" aria-hidden="true">
          <svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor">
            <circle cx="32" cy="32" r="23"></circle>
            <path d="m39 25-4 10-10 4 4-10 10-4Z"></path>
            <path d="M32 5v7M32 52v7M5 32h7M52 32h7"></path>
          </svg>
          <span class="m-empty-state__calibration">Tour direction / Not set</span>
        </div>
        <div class="m-empty-state__body">
          <span class="m-label">Creative direction</span>
          <h2 id="direction-heading" class="m-section-heading">Put the tour's direction in one place</h2>
          <p class="m-copy m-copy--large">Store the director's words as given. Every Scene can then point to the exact version it was built against.</p>
          <div class="m-empty-state__actions"><a class="m-button m-button--primary" href="./direction.html?tour=${escape(TOUR_ID)}">Add Tour Direction</a></div>
        </div>
      </section>`;
  }
  return `<section class="m-orientation__primary" aria-labelledby="direction-heading">
      <header class="m-orientation__object-head">
        <div class="m-stack">
          <span class="m-label">Director-provided direction</span>
          <h2 id="direction-heading" class="m-section-heading">The direction</h2>
        </div>
        <span class="m-state m-state--current">Direction V${escape(version(direction.version))} / Current</span>
      </header>
      <div class="m-orientation__reading">
        <div class="m-source-copy">${paragraphs(direction.words)}</div>
      </div>
      <footer class="m-orientation__object-meta">
        <div><span class="m-label">Set by</span><p>${escape(direction.setBy)}</p></div>
        <div><span class="m-label">Set on</span><p class="m-meta">${escape(String(direction.setOn || "").toUpperCase())}</p></div>
        <span class="m-meta">STORED AS GIVEN</span>
      </footer>
      <a class="m-button" href="./direction.html?tour=${escape(TOUR_ID)}">Revise Tour Direction</a>
    </section>`;
}

function dateRow(entry) {
  return `<li class="m-compact-itinerary__row">
      <time class="m-meta" datetime="${escape(entry.date)}">${escape(readableDate(entry.date))}</time>
      <div class="m-compact-itinerary__place">
        <strong>${escape(entry.venue)}</strong>
        <span class="m-meta">${escape(entry.place)}</span>
      </div>
    </li>`;
}

function editorMessage(which) {
  return view.editing === which && view.message
    ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>`
    : "";
}

function dateFields(entry, index) {
  return `<li class="m-field">
      <label class="m-label" for="date-${index}">Date ${index + 1}</label>
      <input class="m-input" id="date-${index}" data-date-row="${index}" data-date-field="date" value="${escape(entry.date)}" placeholder="2026-05-04" />
      <input class="m-input" data-date-row="${index}" data-date-field="venue" value="${escape(entry.venue)}" placeholder="Venue" aria-label="Venue for date ${index + 1}" />
      <input class="m-input" data-date-row="${index}" data-date-field="place" value="${escape(entry.place)}" placeholder="City" aria-label="City for date ${index + 1}" />
    </li>`;
}

function datesEditor() {
  return `<div class="m-stack">
      <ol class="m-stack">${view.dates.map(dateFields).join("")}</ol>
      <div class="m-cluster">
        <button class="m-button m-button--small" type="button" data-add-date>Add another date</button>
      </div>
      ${editorMessage("dates")}
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-save-dates ${view.working ? "disabled" : ""}>${view.working ? "Saving" : "Save the dates"}</button>
        <button class="m-button m-button--quiet" type="button" data-cancel>Cancel</button>
      </div>
    </div>`;
}

function datesSection(tour) {
  const dates = tour.dates || [];
  const first = dates.slice(0, 2).map(dateRow).join("");
  const rest = dates.slice(2).map(dateRow).join("");
  const reading = `${dates.length ? `<ol class="m-compact-itinerary">${first}</ol>` : `<div class="m-empty-inline m-empty-inline--waiting"><span class="m-label">Route not added</span><p class="m-copy">Add the dates and venues the media has to work across when the route is known.</p></div>`}
      ${rest ? `<details class="m-compact-disclosure">
        <summary>Full itinerary</summary>
        <ol class="m-compact-itinerary">${rest}</ol>
      </details>` : ""}
      <div class="m-cluster"><button class="m-button m-button--small" type="button" data-edit-dates>${dates.length ? "Edit the dates" : "Add the dates"}</button></div>`;
  return `<section class="m-orientation__section" aria-labelledby="tour-run-heading">
      <div class="m-orientation__section-head">
        <h3 id="tour-run-heading" class="m-label">Tour run</h3>
        <span class="m-meta">${escape(dates.length)} ${dates.length === 1 ? "DATE" : "DATES"}</span>
      </div>
      ${view.editing === "dates" ? datesEditor() : reading}
    </section>`;
}

function setupSection(tour) {
  const setup = tour.productionSetup;
  const setupState = setup ? `<span class="m-state m-state--current">Setup V${escape(version(setup.version))}</span>` : "";
  const exceptions = (setup && setup.venueExceptions || []).map((entry) => `<div class="m-setup-exception">
      <span class="m-meta">${escape(readableDate(entry.date))} / ${escape(entry.venue)}</span>
      <p class="m-copy">${escape(entry.text)}</p>
    </div>`).join("");
  const setupDetail = setup ? `<details class="m-compact-disclosure">
      <summary>View production setup</summary>
      <div class="m-setup-copy">
        <div>${paragraphs(setup.words)}</div>
        <div><span class="m-label">Supplied by</span><p class="m-meta">${escape(String(setup.suppliedBy || "").toUpperCase())} / ${escape(String(setup.suppliedOn || "").toUpperCase())}</p></div>
        <h4 class="m-label">Dates where the rig differs</h4>
        ${exceptions || `<p class="m-copy">Every date uses the standard setup.</p>`}
      </div>
    </details>` : "";
  const playback = tour.playbackSystem
    ? `<dl class="m-compact-definition"><div class="m-compact-definition__row"><dt class="m-label">Playback</dt><dd>${escape(tour.playbackSystem)}</dd></div></dl>`
    : `<div class="m-empty-inline m-empty-inline--waiting"><span class="m-label">Playback not added</span><p class="m-copy">Name the system the finished media must run on.</p></div>`;
  const setupEmpty = !setup ? `<div class="m-empty-inline"><span class="m-label">Setup not added</span><p class="m-copy">Record the standard screen and playback setup when production confirms it.</p></div>` : "";
  const editor = `<div class="m-stack">
      <div class="m-field">
        <label class="m-label" for="setup-words">What the show plays on</label>
        <textarea class="m-textarea m-authoring__field" id="setup-words" data-field="words">${escape(view.words)}</textarea>
        <span class="m-help">Stored as production wrote it. Saving keeps the version before this one.</span>
      </div>
      <div class="m-field">
        <label class="m-label" for="setup-by">Supplied by</label>
        <input class="m-input" id="setup-by" data-field="suppliedBy" value="${escape(view.suppliedBy)}" placeholder="Production designer's name" />
        <span class="m-help">Optional.</span>
      </div>
      ${editorMessage("setup")}
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-save-setup ${view.working ? "disabled" : ""}>${view.working ? "Saving" : "Save the production setup"}</button>
        <button class="m-button m-button--quiet" type="button" data-cancel>Cancel</button>
      </div>
    </div>`;
  const reading = `${playback}
      ${setupDetail}
      ${setupEmpty}
      <div class="m-cluster"><button class="m-button m-button--small" type="button" data-edit-setup>${setup ? "Edit the production setup" : "Add the production setup"}</button></div>`;
  return `<section class="m-orientation__section" aria-labelledby="setup-heading">
      <div class="m-orientation__section-head">
        <h3 id="setup-heading" class="m-label">Production setup</h3>
        ${setupState}
      </div>
      ${view.editing === "setup" ? editor : reading}
    </section>`;
}

function themesSection(tour) {
  const themes = (tour.themes || []).map((entry) => `<li>${escape(entry)}</li>`).join("");
  return `<section class="m-orientation__section" aria-labelledby="themes-heading">
      <h3 id="themes-heading" class="m-label">Themes</h3>
      ${themes ? `<ul class="m-compact-themes">${themes}</ul>` : `<div class="m-empty-inline"><span class="m-label">Optional</span><p class="m-copy">No tour-wide themes have been named. Scenes can still be requested and developed.</p></div>`}
    </section>`;
}

function supportingReference(tour) {
  return `<aside class="m-orientation__aside" aria-labelledby="tour-facts-heading">
      <header class="m-orientation__aside-head">
        <span class="m-label">Supporting reference</span>
        <h2 id="tour-facts-heading" class="m-section-heading">Tour facts</h2>
      </header>
      ${datesSection(tour)}
      ${setupSection(tour)}
      ${themesSection(tour)}
    </aside>`;
}

function paint() {
  const tour = view.tour;
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <a href="./tour.html?tour=${escape(TOUR_ID)}">Tour</a>
      <span aria-hidden="true">/</span>
      <span class="m-breadcrumb__current">${escape(tour.name)}</span>
    </nav>`;
  root.innerHTML = `<header class="m-job-header m-tour-header">
      <div class="m-job-header__copy">
        <span class="m-label">Active upcoming tour</span>
        <h1 class="m-heading">${escape(tour.name)}</h1>
        <p class="m-meta">${escape(run(tour.dates || []))}</p>
        ${tour.cycle ? `<p class="m-copy">${escape(tour.cycle)}</p>` : ""}
      </div>
    </header>
    <div class="m-orientation">
      ${directionSection(tour)}
      ${supportingReference(tour)}
    </div>`;
}

async function render() {
  if (!TOUR_ID) {
    showNoTour(root, locationBar);
    return;
  }
  const { tour } = await call("get-tour");
  view.tour = tour;
  paint();
}

function blankDate() {
  return { date: "", venue: "", place: "" };
}

// Typing never repaints the page, so nothing under the cursor moves. The page
// repaints when a section opens, closes, gains a row, or saves.
document.addEventListener("input", (event) => {
  const row = event.target.closest("[data-date-row]");
  if (row) {
    const index = Number(row.getAttribute("data-date-row"));
    if (view.dates[index]) view.dates[index][row.getAttribute("data-date-field")] = event.target.value;
    return;
  }
  const field = event.target.closest("[data-field]");
  if (field) view[field.getAttribute("data-field")] = field.value;
});

async function save(action, payload) {
  view.working = true;
  paint();
  try {
    await call(action, payload);
    const { tour } = await call("get-tour");
    view.tour = tour;
    view.editing = null;
    view.message = "";
  } catch (error) {
    view.message = error.message;
  }
  view.working = false;
  paint();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target || !view.tour) return;
  if (target.hasAttribute("data-edit-dates")) {
    const stored = (view.tour.dates || []).map((entry) => ({
      date: entry.date || "",
      venue: entry.venue || "",
      place: entry.place || "",
    }));
    view.dates = stored.length ? stored : [blankDate()];
    view.editing = "dates";
    view.message = "";
    paint();
  }
  if (target.hasAttribute("data-add-date")) {
    view.dates = [...view.dates, blankDate()];
    paint();
  }
  if (target.hasAttribute("data-edit-setup")) {
    const setup = view.tour.productionSetup;
    view.words = setup ? setup.words || "" : "";
    view.suppliedBy = setup ? setup.suppliedBy || "" : "";
    view.editing = "setup";
    view.message = "";
    paint();
  }
  if (target.hasAttribute("data-cancel")) {
    view.editing = null;
    view.message = "";
    paint();
  }
  if (target.hasAttribute("data-save-dates")) void save("save-tour-dates", { dates: view.dates });
  if (target.hasAttribute("data-save-setup")) void save("save-production-setup", { words: view.words, suppliedBy: view.suppliedBy });
});

render().catch((error) => {
  locationBar.innerHTML = "";
  root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
});
