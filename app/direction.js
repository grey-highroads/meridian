const TOUR_ID = new URLSearchParams(window.location.search).get("tour") || "off-the-map-2026";
const locationBar = document.getElementById("location");
const root = document.getElementById("direction");

const view = { tour: null, words: "", onBehalfOf: "", saved: null, affected: [], message: "", working: false };

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, tourId: TOUR_ID, ...extra }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function version(value) { return String(value || 0).padStart(2, "0"); }

function intro() {
  const current = view.tour.direction;
  return `<header class="m-form-page__intro"><span class="m-label">Tour Direction</span><h1 class="m-heading">Name the creative center.</h1><p class="m-copy m-copy--large">Keep the director's words intact. Meridian versions them and shows which Scenes still point to the earlier direction.</p><div class="m-stack"><span class="m-state m-state--current">Current V${version(current.version)}</span><span class="m-meta">SET BY ${escape(String(current.setBy || "NOT RECORDED").toUpperCase())}</span></div></header>`;
}

function work() {
  if (view.saved) {
    const affected = view.affected.length
      ? `<details class="m-disclosure"><summary><span class="m-label">Scenes still on the earlier direction</span><span class="m-meta">${escape(view.affected.length)} SCENES</span></summary><div class="m-disclosure__body m-stack">${view.affected.map((entry) => `<a class="m-inspector__item" href="./scene.html?tour=${escape(TOUR_ID)}&amp;scene=${escape(entry.id)}"><strong>${escape(entry.title)}</strong><span class="m-meta">WRITTEN AGAINST V${version(entry.directionVersion)}</span></a>`).join("")}</div></details>`
      : `<p class="m-copy">No existing Scene points to an earlier version.</p>`;
    return `<div class="m-form-page__work"><div class="m-callout m-callout--approved"><span class="m-state m-state--approved">Direction V${version(view.saved.version)} stored</span><p class="m-copy">The words are preserved exactly as entered.</p></div>${affected}<a class="m-button m-button--primary" href="./tour.html?tour=${escape(TOUR_ID)}">Return to Tour details</a></div>`;
  }
  return `<div class="m-form-page__work"><div class="m-field"><label class="m-label" for="words">Director's words</label><textarea class="m-textarea m-authoring__field" id="words" data-field="words">${escape(view.words)}</textarea><span class="m-help">Edit only what the director changed. Saving creates a new version.</span></div><details class="m-disclosure"><summary><span class="m-label">Recording this for someone else</span><span class="m-meta">Optional</span></summary><div class="m-disclosure__body"><div class="m-field"><label class="m-label" for="behalf">Direction given by</label><input class="m-input" id="behalf" data-field="onBehalfOf" value="${escape(view.onBehalfOf)}" placeholder="Creative director's name" /></div></div></details>${view.message ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>` : ""}<button class="m-button m-button--primary" type="button" data-save ${view.working ? "disabled" : ""}>${view.working ? "Saving" : `Save Direction V${version(view.tour.direction.version + 1)}`}</button></div>`;
}

function render() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb"><a href="./tour.html?tour=${escape(TOUR_ID)}">${escape(view.tour.name)}</a><span aria-hidden="true">/</span><span class="m-breadcrumb__current">Tour Direction</span></nav>`;
  root.innerHTML = `${intro()}${work()}`;
}

document.addEventListener("input", (event) => {
  if (event.target.dataset && event.target.dataset.field) view[event.target.dataset.field] = event.target.value;
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-save]");
  if (!target) return;
  view.working = true;
  render();
  call("add-tour-direction", { words: view.words, onBehalfOf: view.onBehalfOf }).then((result) => {
    view.saved = result.direction;
    view.affected = result.affectedScenes;
    view.working = false;
    render();
  }).catch((error) => {
    view.working = false;
    view.message = error.message;
    render();
  });
});

call("get-tour").then(({ tour }) => {
  view.tour = tour;
  view.words = tour.direction.words;
  render();
}).catch((error) => {
  root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`;
});
