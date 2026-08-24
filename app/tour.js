// The tour home. The tour record and the direction as the director gave it.
// A reference, not a working surface: nothing is authored here and nothing is
// decided here. Scene work happens on a Scene.

const TOUR_ID = new URLSearchParams(window.location.search).get("tour") || "off-the-map-2026";

const locationBar = document.getElementById("location");
const root = document.getElementById("tour");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, tourId: TOUR_ID, ...extra }),
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

function directionSection(tour) {
  return `<section class="m-reference-section" aria-labelledby="direction-heading">
      <div class="m-reference-section__label">
        <span class="m-state m-state--current">Direction V0${escape(tour.direction.version)} / Current</span>
        <div class="m-stack">
          <div>
            <span class="m-label">Set by</span>
            <p>${escape(tour.direction.setBy)}</p>
          </div>
          <div>
            <span class="m-label">Set on</span>
            <p class="m-meta">${escape(String(tour.direction.setOn || "").toUpperCase())}</p>
          </div>
          <span class="m-meta">STORED AS GIVEN</span>
        </div>
      </div>
      <div class="m-reference-section__body m-stack">
        <h2 id="direction-heading" class="m-section-heading">The direction</h2>
        <div class="m-source-copy">${paragraphs(tour.direction.words)}</div>
      </div>
    </section>`;
}

function datesSection(tour) {
  const dates = tour.dates || [];
  const rows = dates.map((entry, index) => `<li class="m-itinerary__row">
      <time class="m-meta" datetime="${escape(entry.date)}">${escape(readableDate(entry.date))}</time>
      <div class="m-itinerary__place">
        <strong>${escape(entry.venue)}</strong>
        <span class="m-meta">${escape(entry.place)}</span>
      </div>
      <span class="m-label">Show ${escape(String(index + 1).padStart(2, "0"))}</span>
    </li>`).join("");
  return `<section class="m-reference-section" aria-labelledby="dates-heading">
      <div class="m-reference-section__label">
        <span class="m-label">Tour record</span>
        <h2 id="dates-heading" class="m-section-heading">Dates and venues</h2>
      </div>
      <div class="m-reference-section__body">
        ${dates.length ? `<ol class="m-itinerary">${rows}</ol>` : `<p class="m-copy">No dates are recorded on this tour yet.</p>`}
      </div>
    </section>`;
}

// What the show plays on. Supplied by production, stored as given and
// versioned the same way the direction is. The playback line lives here now
// rather than beside the themes, because it is part of the same setup.
function setupSection(tour) {
  const setup = tour.productionSetup;
  if (!setup) return "";
  const rows = (setup.venueExceptions || []).map((entry) => `<li class="m-itinerary__row">
      <time class="m-meta" datetime="${escape(entry.date)}">${escape(readableDate(entry.date))}</time>
      <div class="m-itinerary__place">
        <strong>${escape(entry.venue)}</strong>
        <span class="m-copy">${escape(entry.text)}</span>
      </div>
      <span class="m-label">Differs</span>
    </li>`).join("");
  return `<section class="m-reference-section" aria-labelledby="setup-heading">
      <div class="m-reference-section__label">
        <span class="m-state m-state--current">Setup V0${escape(setup.version)} / Current</span>
        <div class="m-stack">
          <div>
            <span class="m-label">Supplied by</span>
            <p>${escape(setup.suppliedBy)}</p>
          </div>
          <div>
            <span class="m-label">Supplied on</span>
            <p class="m-meta">${escape(String(setup.suppliedOn || "").toUpperCase())}</p>
          </div>
          <span class="m-meta">STORED AS GIVEN</span>
        </div>
      </div>
      <div class="m-reference-section__body m-stack">
        <h2 id="setup-heading" class="m-section-heading">Production setup</h2>
        <div class="m-source-copy">${paragraphs(setup.words)}</div>
        <h3 class="m-section-heading">Playback</h3>
        <p class="m-copy">${escape(tour.playbackSystem || "Not recorded.")}</p>
        <h3 class="m-section-heading">Dates where the rig differs</h3>
        ${rows ? `<ol class="m-itinerary">${rows}</ol>` : `<p class="m-copy">Every date on this tour runs the setup above.</p>`}
      </div>
    </section>`;
}

function contextSection(tour) {
  const themes = (tour.themes || []).map((entry) => `<li>${escape(entry)}</li>`).join("");
  return `<section class="m-reference-section" aria-labelledby="context-heading">
      <div class="m-reference-section__label">
        <span class="m-label">Production reference</span>
        <h2 id="context-heading" class="m-section-heading">Themes</h2>
      </div>
      <div class="m-reference-section__body">
        ${themes ? `<ul class="m-theme-list">${themes}</ul>` : `<p class="m-copy">None recorded.</p>`}
      </div>
    </section>`;
}

function sceneList(assignments) {
  const rows = assignments.map((entry) => `<a class="m-rule-row" href="./scene.html?tour=${encodeURIComponent(TOUR_ID)}&scene=${encodeURIComponent(entry.id)}">
      <div class="m-stack">
        <span class="m-meta">WRITTEN AGAINST DIRECTION V0${escape(entry.directionVersion)}</span>
        <span class="m-rule-row__title">${escape(entry.title)}</span>
      </div>
      <span class="m-meta">${escape(entry.moment || "")}</span>
    </a>`).join("");
  return `<section class="m-reference-section" aria-labelledby="scenes-heading">
      <div class="m-reference-section__label">
        <span class="m-label">Under this direction</span>
        <h2 id="scenes-heading" class="m-section-heading">Scenes</h2>
      </div>
      <div class="m-reference-section__body">
        ${assignments.length ? `<div class="m-rule-list">${rows}</div>` : `<p class="m-copy">No Scenes have been requested on this tour yet.</p>`}
      </div>
    </section>`;
}

async function render() {
  const { tour, assignments } = await call("get-tour");
  locationBar.innerHTML = `<span class="m-meta">${escape(String(tour.name).toUpperCase())} / TOUR</span>
    <span class="m-state m-state--current">Active production</span>`;
  root.innerHTML = `<header class="m-job-header">
      <div class="m-job-header__copy">
        <span class="m-label">Active tour</span>
        <h1 class="m-heading">${escape(tour.name)}</h1>
        <p class="m-meta">${escape(run(tour.dates || []))}</p>
        ${tour.cycle ? `<p class="m-copy">${escape(tour.cycle)}</p>` : ""}
      </div>
    </header>
    ${tour.status ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(tour.status)}</p></div>` : ""}
    ${directionSection(tour)}
    ${setupSection(tour)}
    ${datesSection(tour)}
    ${contextSection(tour)}
    ${sceneList(assignments)}
    <aside class="m-contribution">
      <span class="m-contribution__source">Scene direction</span>
      <p class="m-copy">Scene direction is written inside each Scene and names the version of this direction it was written against. The brief to production carries the parts of this direction someone marked as bearing on that Scene.</p>
    </aside>`;
}

render().catch((error) => {
  locationBar.innerHTML = "";
  root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
});
