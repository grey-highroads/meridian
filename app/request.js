const TOUR_ID = new URLSearchParams(window.location.search).get("tour") || "off-the-map-2026";
const locationBar = document.getElementById("location");
const root = document.getElementById("request");
const view = { tour: null, request: "", title: "", moment: "", references: "", onBehalfOf: "", saved: null, message: "", working: false };

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, tourId: TOUR_ID, ...extra }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) { return String(value === null || value === undefined ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function lines(value) { return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean); }

function intro() {
  return `<header class="m-form-page__intro"><span class="m-label">New Scene</span><h1 class="m-heading">What should this moment become?</h1><p class="m-copy m-copy--large">Give the Scene a name, then say what you want in your own words.</p><span class="m-state m-state--current">Against Direction V${String(view.tour.direction.version).padStart(2, "0")}</span></header>`;
}

function work() {
  if (view.saved) return `<div class="m-form-page__work"><div class="m-callout m-callout--approved"><span class="m-state m-state--approved">Scene requested</span><h2 class="m-section-heading">${escape(view.saved.title)}</h2><p class="m-copy">Your request is stored as written. We take it from here.</p></div><a class="m-button m-button--primary" href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(view.saved.id)}">Open the Scene</a></div>`;
  return `<div class="m-form-page__work"><div class="m-field"><label class="m-label" for="title">Scene name</label><input class="m-input" id="title" data-field="title" value="${escape(view.title)}" placeholder="Name the Scene" required /></div><div class="m-field"><label class="m-label" for="request-words">The request</label><textarea class="m-textarea m-authoring__field" id="request-words" data-field="request" placeholder="What should this moment become?" required>${escape(view.request)}</textarea></div><details class="m-disclosure" open><summary><span class="m-button m-button--secondary m-button--small">Add context</span><span class="m-meta">Optional</span></summary><div class="m-disclosure__body m-stack"><div class="m-field"><label class="m-label" for="moment">Song or moment</label><input class="m-input" id="moment" data-field="moment" value="${escape(view.moment)}" placeholder="Song, transition, opener, finale" /></div><div class="m-field"><label class="m-label" for="references">Reference links</label><textarea class="m-textarea" id="references" data-field="references" placeholder="One link per line.">${escape(view.references)}</textarea></div><div class="m-field"><label class="m-label" for="behalf">Requesting for someone else</label><input class="m-input" id="behalf" data-field="onBehalfOf" value="${escape(view.onBehalfOf)}" placeholder="Name or team" /></div></div></details>${view.message ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>` : ""}<button class="m-button m-button--primary" type="button" data-submit ${view.working ? "disabled" : ""}>${view.working ? "Submitting" : "Request Scene"}</button></div>`;
}

function render() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./scenes.html?tour=${escape(TOUR_ID)}">Scenes</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Request a Scene</span></nav>`;
  root.innerHTML = `${intro()}${work()}`;
}

document.addEventListener("input", (event) => { if (event.target.dataset && event.target.dataset.field) view[event.target.dataset.field] = event.target.value; });
document.addEventListener("click", (event) => {
  if (!event.target.closest("button[data-submit]")) return;
  view.working = true;
  render();
  call("create-scene-request", { request: view.request, title: view.title, moment: view.moment, references: lines(view.references), onBehalfOf: view.onBehalfOf }).then(({ assignment }) => {
    view.saved = assignment;
    view.working = false;
    render();
  }).catch((error) => {
    view.working = false;
    view.message = error.message;
    render();
  });
});

call("get-tour").then(({ tour }) => { view.tour = tour; render(); }).catch((error) => { root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`; });
