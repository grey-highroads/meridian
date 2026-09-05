import { ACCOUNT_ID, TOUR_ID, scopedBody } from "./context.js";
import { ARTIST_LABEL, TOUR_LABEL, artistLabel, tourLabel } from "./label.js";

// The tour home. The tour record and the direction as the director gave it.
// The route and the production setup can be written here, each on its own and
// neither waiting on the other. Direction has its own screen and Scene work
// happens on a Scene.

const locationBar = document.getElementById("location");
const root = document.getElementById("tour");

// Which section is open for editing, and what has been typed into it. Nothing
// here is required before a Scene can be requested.
const view = {
  attachSubject: "",
  tour: null,
  editing: null,
  dates: [],
  words: "",
  suppliedBy: "",
  message: "",
  working: false,
  name: "",
  approximateDates: "",
  primaryContact: "",
  artistId: "",
  artists: [],
  label: "",
  role: null,
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, ...extra })),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Meridian could not load the project. Refresh the page and try again.");
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

// Who the job is about, when it is about somebody. A projection mapping job or
// an install runs on the direction and the request, so the choice includes not
// naming one and an account holding none can still start a job.
function artistField() {
  const word = ARTIST_LABEL.toLowerCase();
  if (!view.artists.length) {
    return `<div class="m-field">
        <span class="m-label">${escape(ARTIST_LABEL)}</span>
        <p class="m-copy">This account has no ${escape(word)} stored. The job starts without one and can have one added later.</p>
        ${view.role === "higher-roads" ? '<div class="m-cluster"><a class="m-button m-button--small" href="./admin.html">Add one</a></div>' : ""}
      </div>`;
  }
  const rows = [
    `<option value=""${view.artistId ? "" : " selected"}>No ${escape(word)}</option>`,
    ...view.artists.map((entry) => `<option value="${escape(entry.id)}"${entry.id === view.artistId ? " selected" : ""}>${escape(entry.name)}</option>`),
  ].join("");
  return `<div class="m-field">
      <label class="m-label" for="artist">${escape(view.artists.length === 1 ? artistLabel(view.artists[0]) : ARTIST_LABEL)}</label>
      <select class="m-select" id="artist" data-field="artistId">${rows}</select>
      <span class="m-help">Optional. Leave it without one if the job is not about an ${escape(word)}.</span>
    </div>`;
}

// What the creation screen calls the job. Nothing is stored yet, so it reads
// what has been typed and falls back to the default.
function creationLabel() {
  return String(view.label || "").trim() || TOUR_LABEL;
}

function paintTourCreation() {
  const label = creationLabel();
  const lower = label.toLowerCase();
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><span class="m-breadcrumb__current">${escape(label)} details</span></nav>`;
  root.innerHTML = `<div class="m-form-page">
      <header class="m-form-page__intro">
        <span class="m-label">Start the ${escape(lower)}</span>
        <h1 class="m-heading">Name the ${escape(lower)}</h1>
        <p class="m-copy m-copy--large">The ${escape(lower)} name is the only required field. Add the rest if you know it.</p>
      </header>
      <div class="m-form-page__work">
        ${artistField()}
        <div class="m-field">
          <label class="m-label" for="name">${escape(label)} name</label>
          <input class="m-input" id="name" data-field="name" value="${escape(view.name)}" placeholder="For example, Off The Map 2026" required />
        </div>
        <div class="m-field">
          <label class="m-label" for="label">What to call this job</label>
          <input class="m-input" id="label" data-field="label" value="${escape(view.label)}" placeholder="${escape(TOUR_LABEL)}" />
          <span class="m-help">Optional. Use Residency, Festival, or whatever this job is called. Leave it blank for ${escape(TOUR_LABEL)}. You can change it later.</span>
        </div>
        <div class="m-field">
          <label class="m-label" for="approximate-dates">Rough dates</label>
          <input class="m-input" id="approximate-dates" data-field="approximateDates" value="${escape(view.approximateDates)}" placeholder="For example, May to September" />
          <span class="m-help">Optional. Add the full route in ${escape(label)} details later.</span>
        </div>
        <div class="m-field">
          <label class="m-label" for="contact">Main contact</label>
          <input class="m-input" id="contact" data-field="primaryContact" value="${escape(view.primaryContact)}" placeholder="Name" />
          <span class="m-help">Optional.</span>
        </div>
        ${view.message ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
        <div class="m-cluster">
          <button class="m-button m-button--primary" type="button" data-create-tour ${view.working ? "disabled" : ""}>${view.working ? "Starting" : `Start the ${escape(lower)}`}</button>
        </div>
      </div>
    </div>`;
}

function directionSection(tour) {
  const lower = tourLabel(tour).toLowerCase();
  const direction = tour.direction;
  if (!direction || !String(direction.words || "").trim()) {
    return `<section class="m-empty-state m-empty-state--waiting" aria-labelledby="direction-heading">
        <div class="m-empty-state__visual" aria-hidden="true">
          <svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor">
            <circle cx="32" cy="32" r="23"></circle>
            <path d="m39 25-4 10-10 4 4-10 10-4Z"></path>
            <path d="M32 5v7M32 52v7M5 32h7M52 32h7"></path>
          </svg>
        </div>
        <div class="m-empty-state__body">
          <h2 id="direction-heading" class="m-section-heading">Set the direction for the ${escape(lower)}</h2>
          <p class="m-copy m-copy--large">What should guide the creative work across the ${escape(lower)}?</p>
          <div class="m-empty-state__actions"><a class="m-button m-button--primary" href="./direction.html?tour=${escape(TOUR_ID)}">Set direction</a></div>
        </div>
      </section>`;
  }
  return `<section class="m-orientation__primary" aria-labelledby="direction-heading">
      <header class="m-orientation__object-head">
        <div class="m-stack"><h2 id="direction-heading" class="m-section-heading">Creative direction</h2><span class="m-state m-state--current">Current direction</span></div>
        <a class="m-button m-button--small" href="./direction.html?tour=${escape(TOUR_ID)}">Revise direction</a>
      </header>
      <div class="m-orientation__reading">
        <div class="m-source-copy">${paragraphs(direction.words)}</div>
      </div>
      <footer class="m-orientation__object-meta">
        <div><span class="m-label">Set by</span><p>${escape(direction.setBy)}</p></div>
        <div><span class="m-label">Set on</span><p class="m-meta">${escape(String(direction.setOn || "").toUpperCase())}</p></div>
        <span class="m-meta">SAVED EXACTLY AS ENTERED</span>
      </footer>
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
  const reading = `${dates.length ? `<ol class="m-compact-itinerary">${first}</ol>` : `<div class="m-empty-inline m-empty-inline--waiting"><span class="m-label">Dates and venues not added</span><p class="m-copy">The route is still taking shape. Add dates and venues when you have them.</p></div>`}
      ${rest ? `<details class="m-compact-disclosure">
        <summary>Full itinerary</summary>
        <ol class="m-compact-itinerary">${rest}</ol>
      </details>` : ""}`;
  return `<section class="m-orientation__section" aria-labelledby="tour-run-heading">
      <div class="m-orientation__section-head">
        <div class="m-stack"><h3 id="tour-run-heading" class="m-label">Dates and venues</h3>${dates.length ? `<span class="m-meta">${escape(dates.length)} ${dates.length === 1 ? "DATE" : "DATES"}</span>` : ""}</div>
        ${view.editing === "dates" ? "" : `<button class="m-button m-button--small" type="button" data-edit-dates>${dates.length ? "Edit the dates" : "Add the dates"}</button>`}
      </div>
      ${view.editing === "dates" ? datesEditor() : reading}
    </section>`;
}

function setupSection(tour) {
  const setup = tour.productionSetup;
  const setupState = setup ? `<span class="m-state m-state--current">Current setup</span>` : "";
  const exceptions = (setup && setup.venueExceptions || []).map((entry) => `<div class="m-setup-exception">
      <span class="m-meta">${escape(readableDate(entry.date))} / ${escape(entry.venue)}</span>
      <p class="m-copy">${escape(entry.text)}</p>
    </div>`).join("");
  const setupDetail = setup ? `<details class="m-compact-disclosure">
      <summary>View production details</summary>
      <div class="m-setup-copy">
        <div>${paragraphs(setup.words)}</div>
        <div><span class="m-label">Added by</span><p class="m-meta">${escape(String(setup.suppliedBy || "").toUpperCase())} / ${escape(String(setup.suppliedOn || "").toUpperCase())}</p></div>
        <h4 class="m-label">Setup changes by venue</h4>
        ${exceptions || `<p class="m-copy">No venue-specific setup changes have been added.</p>`}
      </div>
    </details>` : "";
  const playback = tour.playbackSystem
    ? `<dl class="m-compact-definition"><div class="m-compact-definition__row"><dt class="m-label">Playback system</dt><dd>${escape(tour.playbackSystem)}</dd></div></dl>`
    : `<div class="m-empty-inline m-empty-inline--waiting"><span class="m-label">Playback system not added</span><p class="m-copy">Add the system the finished media will use.</p></div>`;
  const setupEmpty = !setup ? `<div class="m-empty-inline"><span class="m-label">Production setup not added</span><p class="m-copy">Add the standard screen and playback setup when you have it.</p></div>` : "";
  const editor = `<div class="m-stack">
      <div class="m-field">
        <label class="m-label" for="setup-words">Screens and playback</label>
        <textarea class="m-textarea m-authoring__field" id="setup-words" data-field="words">${escape(view.words)}</textarea>
        <span class="m-help">Add anything the media team needs to know about the production setup.</span>
      </div>
      <div class="m-field">
        <label class="m-label" for="setup-by">Added by</label>
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
      ${setupEmpty}`;
  return `<section class="m-orientation__section" aria-labelledby="setup-heading">
      <div class="m-orientation__section-head">
        <div class="m-stack"><h3 id="setup-heading" class="m-label">Production details</h3>${setupState}</div>
        ${view.editing === "setup" ? "" : `<button class="m-button m-button--small" type="button" data-edit-setup>${setup ? "Edit the production setup" : "Add the production setup"}</button>`}
      </div>
      ${view.editing === "setup" ? editor : reading}
    </section>`;
}

function themesSection(tour) {
  const themes = (tour.themes || []).map((entry) => `<li>${escape(entry)}</li>`).join("");
  return `<section class="m-orientation__section" aria-labelledby="themes-heading">
      <h3 id="themes-heading" class="m-label">${escape(tourLabel(tour))}-wide themes</h3>
      ${themes ? `<ul class="m-compact-themes">${themes}</ul>` : `<div class="m-empty-inline"><span class="m-label">Optional</span><p class="m-copy">No tour-wide themes yet. You can still request and develop Scenes.</p></div>`}
    </section>`;
}

function subjectsSection(tour) {
  const ids = Array.isArray(tour.subjectIds) ? tour.subjectIds : [];
  const byId = new Map(view.artists.map((entry) => [entry.id, entry]));
  const kindWord = (row) => {
    if (!row) return "subject";
    if (row.kind && row.kind !== "artist") return row.kind;
    return artistLabel(row).toLowerCase();
  };
  const rows = ids.map((id) => {
    const row = byId.get(id);
    const name = row ? row.name : id;
    const fixed = tour.artistId === id;
    return `<div class="m-compact-definition__row"><dt class="m-label">${escape(kindWord(row))}</dt><dd>${escape(name)}${fixed ? "" : ` <button class="m-button m-button--small" type="button" data-detach-subject="${escape(id)}" ${view.working ? "disabled" : ""}>Remove</button>`}</dd></div>`;
  }).join("");
  const attachable = view.artists.filter((entry) => !ids.includes(entry.id));
  const options = attachable.map((entry) => `<option value="${escape(entry.id)}"${entry.id === view.attachSubject ? " selected" : ""}>${escape(entry.name)}</option>`).join("");
  const attach = attachable.length
    ? `<div class="m-cluster">
        <select class="m-input" data-field="attachSubject" aria-label="Subject to add">
          <option value="">Choose who to add</option>${options}
        </select>
        <button class="m-button m-button--small" type="button" data-attach-subject ${view.working ? "disabled" : ""}>Add to this job</button>
      </div>`
    : "";
  return `<section class="m-orientation__section" aria-labelledby="subjects-heading">
      <div class="m-orientation__section-head">
        <div class="m-stack"><h3 id="subjects-heading" class="m-label">Who this work is for</h3></div>
      </div>
      ${rows ? `<dl class="m-compact-definition">${rows}</dl>` : `<div class="m-empty-inline"><span class="m-label">Optional</span><p class="m-copy">Nobody is attached yet. The job runs on its own material either way.</p></div>`}
      ${attach}
      ${editorMessage("subjects")}
    </section>`;
}

function labelSection(tour) {
  const current = tourLabel(tour);
  const editor = `<div class="m-stack">
      <div class="m-field">
        <label class="m-label" for="tour-label">What to call this job</label>
        <input class="m-input" id="tour-label" data-field="label" value="${escape(view.label)}" placeholder="${escape(TOUR_LABEL)}" />
        <span class="m-help">Leave it blank to go back to ${escape(TOUR_LABEL)}.</span>
      </div>
      ${editorMessage("label")}
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-save-label ${view.working ? "disabled" : ""}>${view.working ? "Saving" : "Save the word"}</button>
        <button class="m-button m-button--quiet" type="button" data-cancel>Cancel</button>
      </div>
    </div>`;
  const reading = `<dl class="m-compact-definition"><div class="m-compact-definition__row"><dt class="m-label">On screen</dt><dd>${escape(current)}</dd></div></dl>`;
  return `<section class="m-orientation__section" aria-labelledby="label-heading">
      <div class="m-orientation__section-head">
        <div class="m-stack"><h3 id="label-heading" class="m-label">What this job is called</h3></div>
        ${view.editing === "label" ? "" : `<button class="m-button m-button--small" type="button" data-edit-label>Change the word</button>`}
      </div>
      ${view.editing === "label" ? editor : reading}
    </section>`;
}

function supportingReference(tour) {
  return `<aside class="m-orientation__aside" aria-labelledby="tour-facts-heading">
      <header class="m-orientation__aside-head">
        <h2 id="tour-facts-heading" class="m-section-heading">${escape(tourLabel(tour))} details</h2>
      </header>
      ${datesSection(tour)}
      ${setupSection(tour)}
      ${themesSection(tour)}
      ${subjectsSection(tour)}
      ${labelSection(tour)}
    </aside>`;
}

function paint() {
  const tour = view.tour;
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <a href="./tour.html?tour=${escape(TOUR_ID)}">${escape(tourLabel(tour))}</a>
      <span aria-hidden="true">/</span>
      <span class="m-breadcrumb__current">${escape(tour.name)}</span>
    </nav>`;
  root.innerHTML = `<header class="m-job-header m-tour-header">
      <div class="m-job-header__copy">
        <span class="m-label">Upcoming tour</span>
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
    const [artistsResult, me] = await Promise.all([
      fetch("/api/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scopedBody({ action: "list-artists" })),
      }).then(async (response) => response.ok ? response.json() : { artists: [] }).catch(() => ({ artists: [] })),
      call("get-me").catch(() => null),
    ]);
    view.artists = Array.isArray(artistsResult.artists) ? artistsResult.artists : [];
    view.artistId = view.artists.length ? view.artists[0].id : "";
    if (me && me.user) {
      view.primaryContact = me.user.displayName || "";
      view.role = me.user.role || null;
    }
    paintTourCreation();
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
  if (!target) return;
  if (target.hasAttribute("data-create-tour")) {
    view.working = true;
    view.message = "";
    paintTourCreation();
    call("create-tour", {
      name: view.name,
      label: view.label,
      artistId: view.artistId,
      approximateDates: view.approximateDates,
      primaryContact: view.primaryContact,
    }).then(({ tour }) => {
      const url = new URL("./tour.html", window.location.href);
      url.searchParams.set("tour", tour.id);
      if (ACCOUNT_ID) url.searchParams.set("account", ACCOUNT_ID);
      window.location.href = url.href;
    }).catch((error) => {
      view.working = false;
      view.message = error.message;
      paintTourCreation();
    });
    return;
  }
  if (!view.tour) return;
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
  if (target.hasAttribute("data-edit-label")) {
    view.label = view.tour.label || "";
    view.editing = "label";
    view.message = "";
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
  if (target.hasAttribute("data-save-label")) void save("save-tour-label", { label: view.label });
  if (target.hasAttribute("data-attach-subject")) {
    if (!view.attachSubject) {
      view.editing = "subjects";
      view.message = "Choose who to add first.";
      paint();
      return;
    }
    const chosen = view.attachSubject;
    view.attachSubject = "";
    view.editing = "subjects";
    void save("attach-subject", { subjectId: chosen });
  }
  if (target.hasAttribute("data-detach-subject")) {
    view.editing = "subjects";
    void save("detach-subject", { subjectId: target.getAttribute("data-detach-subject") });
  }
});

render().catch((error) => {
  locationBar.innerHTML = "";
  root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
});
