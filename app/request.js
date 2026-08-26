import { ACCOUNT_ID, TOUR_ID, scopedBody } from "./context.js";
const locationBar = document.getElementById("location");
const root = document.getElementById("request");
const view = { tour: null, request: "", title: "", moment: "", references: "", onBehalfOf: "", images: [], imageMessage: "", saved: null, message: "", working: false };

async function call(action, extra = {}) {
  const response = await fetch("/api/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scopedBody({ action, tourId: TOUR_ID, ...extra })) });
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
  return `<div class="m-form-page__work"><div class="m-field"><label class="m-label" for="title">Scene name</label><input class="m-input" id="title" data-field="title" value="${escape(view.title)}" placeholder="Name the Scene" required /></div><div class="m-field"><label class="m-label" for="request-words">The request</label><textarea class="m-textarea m-authoring__field" id="request-words" data-field="request" placeholder="What should this moment become?" required>${escape(view.request)}</textarea></div><section class="m-field" aria-label="Reference images"><div class="m-stack"><label class="m-label">Reference images (optional)</label><p class="m-copy">Attach a photo, a mood image, or a still from another show. The concept can be developed with or without them.</p>${view.images.length ? `<ul class="m-stack">${view.images.map((entry) => `<li class="m-copy">${escape(entry.filename)}</li>`).join("")}</ul>` : ""}${view.imageMessage ? `<p class="m-copy">${escape(view.imageMessage)}</p>` : ""}<label class="m-button m-button--secondary"><input type="file" accept="image/*" data-reference="input" hidden>Add a reference image</label></div></section><details class="m-disclosure"><summary><span class="m-label">Add context</span><span class="m-meta">Optional</span></summary><div class="m-disclosure__body m-stack"><div class="m-field"><label class="m-label" for="moment">Song or moment</label><input class="m-input" id="moment" data-field="moment" value="${escape(view.moment)}" placeholder="Song, transition, opener, finale" /></div><div class="m-field"><label class="m-label" for="references">Reference links</label><textarea class="m-textarea" id="references" data-field="references" placeholder="One link per line.">${escape(view.references)}</textarea></div><div class="m-field"><label class="m-label" for="behalf">Requesting for someone else</label><input class="m-input" id="behalf" data-field="onBehalfOf" value="${escape(view.onBehalfOf)}" placeholder="Name or team" /></div></div></details>${view.message ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.message)}</p></div>` : ""}<button class="m-button m-button--primary" type="button" data-submit ${view.working ? "disabled" : ""}>${view.working ? "Submitting" : "Request Scene"}</button></div>`;
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
  call("create-scene-request", { request: view.request, title: view.title, moment: view.moment, references: lines(view.references), onBehalfOf: view.onBehalfOf }).then(async ({ assignment }) => {
    view.saved = assignment;
    await uploadStagedImages(assignment.id);
    view.working = false;
    render();
  }).catch((error) => {
    view.working = false;
    view.message = error.message;
    render();
  });
});

call("get-tour").then(({ tour }) => { view.tour = tour; render(); }).catch((error) => { root.innerHTML = `<div class="m-callout m-callout--change"><p class="m-copy">${escape(error.message)}</p></div>`; });

async function uploadStagedImages(assignmentId) {
  if (!view.staged || !view.staged.length) return;
  for (const file of view.staged) {
    try {
      const authorization = await fetch("/api/tour-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: ACCOUNT_ID, tourId: TOUR_ID, assignmentId, filename: file.name, contentType: file.type, size: file.size }) });
      const authorized = await authorization.json();
      if (!authorization.ok) continue;
      const put = await fetch(authorized.presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) continue;
      await fetch("/api/tour-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: ACCOUNT_ID, tourId: TOUR_ID, assignmentId, mode: "reference-record", pathname: authorized.pathname, filename: file.name, contentType: file.type }) });
    } catch (_error) {
      // A failing image never blocks the Scene request; the Scene page will show whatever landed.
    }
  }
}

document.addEventListener("change", (event) => {
  const field = event.target;
  if (!field || !field.dataset || field.dataset.reference !== "input") return;
  const files = Array.from(field.files || []);
  if (!files.length) return;
  view.staged = (view.staged || []).concat(files);
  view.images = view.staged.map((file) => ({ filename: file.name, contentType: file.type }));
  view.imageMessage = files.length === 1 ? "Ready to upload after the Scene is created." : `Ready to upload ${view.staged.length} images after the Scene is created.`;
  render();
});
