import { scopedBody } from "./context.js";

// Higher Roads maintenance. One act today: move the demo artist's stored files
// to the place every account reads from. The rest of the acts the accounts spec
// describes arrive here later. Nothing on this page removes anything, so no
// confirm step and no new pattern are needed.

const ARTIST_ID = new URLSearchParams(window.location.search).get("artist") || "dierks-bentley";

const locationBar = document.getElementById("location");
const root = document.getElementById("admin");

const view = { working: false, result: null, message: "" };

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

function resultBlock() {
  if (view.message) {
    return `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>`;
  }
  if (!view.result) return "";
  const moved = view.result.count === 1 ? "1 file" : `${view.result.count} files`;
  const heading = view.result.count
    ? `${moved} moved. Every copy matched the original.`
    : "There was nothing left to move.";
  const lines = view.result.lines.map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
  return `<div class="m-callout m-callout--approved">
      <span class="m-state m-state--approved">Copy finished</span>
      <p class="m-copy">${escape(heading)}</p>
    </div>
    ${lines ? `<div class="m-stack"><span class="m-label">What happened, file by file</span><ul class="m-stack">${lines}</ul></div>` : ""}`;
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
        <button class="m-button m-button--primary" type="button" data-copy ${view.working ? "disabled" : ""}>${view.working ? "Copying" : "Copy the artist's files"}</button>
        <span class="m-meta">${escape(ARTIST_ID.toUpperCase())}</span>
      </div>
      ${resultBlock()}
    </section>`;
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target || !target.hasAttribute("data-copy")) return;
  view.working = true;
  view.message = "";
  view.result = null;
  render();
  call("copy-artist-paths").then((result) => {
    view.working = false;
    view.result = result;
    render();
  }).catch((error) => {
    view.working = false;
    view.message = error.message;
    render();
  });
});

render();
