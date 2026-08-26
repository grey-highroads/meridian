import { scopedBody, TOUR_ID } from "./context.js";

// Higher Roads maintenance. Two acts today, both of them a copy to the place
// every account reads from: the artist's stored files, and the tour that still
// lives as committed markdown. The rest of the acts the accounts spec describes
// arrive here later. Nothing on this page removes anything, so no confirm step
// and no new pattern are needed.

const ARTIST_ID = new URLSearchParams(window.location.search).get("artist") || "dierks-bentley";
const TOUR = TOUR_ID || "off-the-map-2026";

const locationBar = document.getElementById("location");
const root = document.getElementById("admin");

const acts = {
  copy: { working: false, result: null, message: "" },
  seed: { working: false, result: null, message: "" },
};

async function call(action, extra = {}) {
  const response = await fetch("/api/artist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody({ action, artistId: ARTIST_ID, ...extra })),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function resultBlock(state, label, heading) {
  if (state.message) {
    return `<div class="m-callout m-callout--change"><p class="m-copy">${escape(state.message)}</p></div>`;
  }
  if (!state.result) return "";
  const lines = state.result.lines.map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
  return `<div class="m-callout m-callout--approved">
      <span class="m-state m-state--approved">${escape(label)}</span>
      <p class="m-copy">${escape(heading(state.result))}</p>
    </div>
    ${lines ? `<div class="m-stack"><span class="m-label">What happened, line by line</span><ul class="m-stack">${lines}</ul></div>` : ""}`;
}

function copyHeading(result) {
  const moved = result.count === 1 ? "1 file" : `${result.count} files`;
  return result.count ? `${moved} moved. Every copy matched the original.` : "There was nothing left to move.";
}

function seedHeading(result) {
  const written = result.count === 1 ? "1 object" : `${result.count} objects`;
  return result.count ? `${written} written. The tour now sits where every account reads from.` : "Nothing was written.";
}

function render() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <span class="m-breadcrumb__current">Admin</span>
    </nav>
    <span class="m-state m-state--current">Higher Roads only</span>`;

  root.innerHTML = `<header class="m-job-header">
      <div class="m-job-header__copy">
        <span class="m-label">Maintenance</span>
        <h1 class="m-heading">Admin</h1>
      </div>
    </header>
    <section class="m-stack" aria-labelledby="move-heading">
      <h2 id="move-heading" class="m-section-heading">Move the artist's files</h2>
      <p class="m-copy m-copy--large">Every account keeps its artist files in the same place. This artist was set up before that was true, so its files sit somewhere of their own. Copying them puts an identical set where every account reads from.</p>
      <p class="m-copy">Nothing is removed. The files already there stay exactly where they are, and Meridian keeps reading them until the switch is made. Running this a second time copies the same files over the same files and changes nothing.</p>
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-copy ${acts.copy.working ? "disabled" : ""}>${acts.copy.working ? "Copying" : "Copy the artist's files"}</button>
        <span class="m-meta">${escape(ARTIST_ID.toUpperCase())}</span>
      </div>
      ${resultBlock(acts.copy, "Copy finished", copyHeading)}
    </section>
    <section class="m-stack" aria-labelledby="seed-heading">
      <h2 id="seed-heading" class="m-section-heading">Store the tour where every account reads from</h2>
      <p class="m-copy m-copy--large">This tour still lives as a file in the code rather than as stored work. Seeding writes the same tour, its direction, and every Scene request into storage at the shared location, so the tour is an ordinary stored tour like any other account's.</p>
      <p class="m-copy">Nothing is removed. The file in the code stays where it is and Meridian keeps reading what it reads today. Running this a second time is refused rather than writing a duplicate.</p>
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-seed ${acts.seed.working ? "disabled" : ""}>${acts.seed.working ? "Storing" : "Store the tour"}</button>
        <span class="m-meta">${escape(TOUR.toUpperCase())}</span>
      </div>
      ${resultBlock(acts.seed, "Seeding finished", seedHeading)}
    </section>`;
}

function start(state, action, extra) {
  state.working = true;
  state.message = "";
  state.result = null;
  render();
  call(action, extra).then((result) => {
    state.working = false;
    state.result = result;
    render();
  }).catch((error) => {
    state.working = false;
    state.message = error.message;
    render();
  });
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-copy")) start(acts.copy, "copy-artist-paths", {});
  if (target.hasAttribute("data-seed")) start(acts.seed, "seed-tour-at-shared-path", { tourId: TOUR });
});

render();
