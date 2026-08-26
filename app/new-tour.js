import { ACCOUNT_ID, scopedBody } from "./context.js";

// Starting the tour. This is the client's first job in Meridian, so it asks for
// the least that makes the tour exist and offers the rest. The artist is shown
// rather than chosen while the account holds one, because picking from a list
// of one is a question with no answer in it.

const locationBar = document.getElementById("location");
const root = document.getElementById("new-tour");

const view = {
  name: "",
  approximateDates: "",
  primaryContact: "",
  artistId: "",
  artists: [],
  role: null,
  working: false,
  message: "",
};

async function post(route, payload) {
  const response = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody(payload)),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function artistField() {
  if (!view.artists.length) {
    // Higher Roads reads this and can go and do it. A client reads the same
    // sentence without the way in, because the artist is ours to add.
    return `<div class="m-callout m-callout--change">
        <p class="m-copy">This account holds no artist yet, and a tour sits under an artist. The tour can be started once the artist is there.</p>
        ${view.role === "higher-roads" ? `<div class="m-cluster"><a class="m-button m-button--small" href="./admin.html">Add the artist</a></div>` : ""}
      </div>`;
  }
  if (view.artists.length === 1) {
    return `<div class="m-field"><span class="m-label">Artist</span><p class="m-copy">${escape(view.artists[0].name)}</p></div>`;
  }
  const options = view.artists.map((entry) => `<option value="${escape(entry.id)}"${entry.id === view.artistId ? " selected" : ""}>${escape(entry.name)}</option>`).join("");
  return `<div class="m-field"><label class="m-label" for="artist">Artist</label><select class="m-select" id="artist" data-field="artistId">${options}</select></div>`;
}

function render() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./index.html">Home</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Start the tour</span></nav>`;
  root.innerHTML = `<header class="m-form-page__intro">
      <span class="m-label">Start the tour</span>
      <h1 class="m-heading">Start the tour Meridian works on.</h1>
      <p class="m-copy m-copy--large">The name is all Meridian needs. Direction, dates, production details, and Scenes all sit under the tour once it exists.</p>
    </header>
    <div class="m-form-page__work">
      ${artistField()}
      <div class="m-field">
        <label class="m-label" for="name">Tour name</label>
        <input class="m-input" id="name" data-field="name" value="${escape(view.name)}" placeholder="For example, Off The Map 2026" required />
      </div>
      <div class="m-field">
        <label class="m-label" for="approximate-dates">Rough dates</label>
        <input class="m-input" id="approximate-dates" data-field="approximateDates" value="${escape(view.approximateDates)}" placeholder="For example, May to September" />
        <span class="m-help">Optional. The full route goes in Tour details later.</span>
      </div>
      <div class="m-field">
        <label class="m-label" for="contact">Main contact</label>
        <input class="m-input" id="contact" data-field="primaryContact" value="${escape(view.primaryContact)}" placeholder="Who Meridian comes back to" />
        <span class="m-help">Optional. You are filled in here, and anyone else can take it.</span>
      </div>
      ${view.message ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>` : ""}
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-create ${view.working || !view.artists.length ? "disabled" : ""}>${view.working ? "Starting" : "Start the tour"}</button>
      </div>
      <p class="m-copy">Add what you know now, the rest can wait.</p>
    </div>`;
}

document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-field]");
  if (field) view[field.getAttribute("data-field")] = field.value;
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("button[data-create]")) return;
  view.working = true;
  view.message = "";
  render();
  post("/api/tour", {
    action: "create-tour",
    name: view.name,
    artistId: view.artistId,
    approximateDates: view.approximateDates,
    primaryContact: view.primaryContact,
  }).then(({ tour }) => {
    // Everything typed stays on the screen until the tour exists, and the next
    // page opens on the tour that was just made.
    const url = new URL("./index.html", window.location.href);
    url.searchParams.set("tour", tour.id);
    if (ACCOUNT_ID) url.searchParams.set("account", ACCOUNT_ID);
    window.location.href = url.href;
  }).catch((error) => {
    view.working = false;
    view.message = error.message;
    render();
  });
});

Promise.all([
  post("/api/artist", { action: "list-artists" }).catch(() => ({ artists: [] })),
  post("/api/tour", { action: "get-me" }).catch(() => null),
]).then(([{ artists }, me]) => {
  view.artists = Array.isArray(artists) ? artists : [];
  view.artistId = view.artists.length ? view.artists[0].id : "";
  if (me && me.user) {
    view.primaryContact = me.user.displayName || "";
    view.role = me.user.role || null;
  }
  render();
}).catch((error) => {
  view.message = error.message;
  render();
});
