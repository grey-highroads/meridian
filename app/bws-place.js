/*
 * Place on background.
 *
 * A finished output becomes the background. A product picture that already has
 * a cut out edge becomes the thing standing on it. The browser flattens the
 * two onto one canvas and paints a second canvas marking only the ground where
 * a shadow belongs. Both go to the model, which fills the marked area with
 * shadow and leaves the rest alone.
 *
 * This page is deliberately separate from app.js. It shares the stylesheets
 * and the server, and it shares no code, no state, and no screen. Deleting
 * this file, bws-place.html, bws-place.css, and one line of vite.config.js removes the
 * whole surface.
 *
 * Which client this belongs to is read from the same cookie the app writes, so
 * the page always follows whichever brand is active. It holds no state across
 * a client switch because it is loaded fresh each time and keeps nothing.
 */

const root = document.getElementById("place");

const state = {
  loading: true,
  loadError: "",
  backgrounds: [],
  products: [],
  productImages: [],
  chosenBackgroundId: "",
  chosenProductId: "",
  chosenImageId: "",
  lightFrom: "",
  lightNote: "",
  message: "",
  busy: false,
  resultUrl: "",
  resultId: "",
};

// Loaded pixels, kept out of state because they are not render inputs.
let backgroundImage = null;
let elementImage = null;
let box = null;
let viewScale = 1;
let drag = null;

// The shapes gpt-image-2 accepts. A background whose shape is not one of these
// would come back rescaled, which would move the product away from where it
// was put, so the page refuses rather than quietly shifting it.
const SHAPES = [
  { size: "1024x1024", ratio: 1 },
  { size: "1536x1024", ratio: 1.5 },
  { size: "1024x1536", ratio: 1 / 1.5 },
];

const DIRECTIONS = [
  { id: "left", label: "From the left", sentence: "the left side of the frame", push: 1 },
  { id: "right", label: "From the right", sentence: "the right side of the frame", push: -1 },
  { id: "behind", label: "From behind", sentence: "behind the object, facing the camera", push: 0 },
  { id: "above", label: "From above", sentence: "directly above", push: 0 },
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function directionById(id) {
  return DIRECTIONS.find((entry) => entry.id === id) || null;
}

function shapeFor(width, height) {
  const ratio = width / height;
  return SHAPES.find((shape) => Math.abs(ratio - shape.ratio) < 0.02) || null;
}

async function readJson(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "That request did not go through.");
  return payload;
}

/* Loading the two lists */

async function loadEverything() {
  try {
    const [outputsPayload, productsPayload] = await Promise.all([
      fetch("/api/production/outputs", { headers: { Accept: "application/json" } }).then(readJson),
      fetch("/api/products", { headers: { Accept: "application/json" } }).then(readJson),
    ]);
    // Newest first, the same ordering the app's recent work list uses. The
    // stored log is oldest first, because the app appends to it, so without
    // this a render you just made lands at the bottom of a short scrolling box
    // and looks like it never arrived.
    state.backgrounds = (outputsPayload.outputs || [])
      .filter((output) => output.id && output.hadImage)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    state.products = productsPayload.products || [];
  } catch (error) {
    state.loadError = error.message || "Your finished work could not be loaded.";
  } finally {
    state.loading = false;
    render();
  }
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That picture could not be opened."));
    image.src = dataUrl;
  });
}

async function chooseBackground(outputId) {
  state.message = "";
  state.busy = true;
  render();
  try {
    const payload = await readJson(await fetch(`/api/production/outputs?action=imageData&outputId=${encodeURIComponent(outputId)}`, {
      headers: { Accept: "application/json" },
    }));
    const image = await loadImage(payload.dataUrl);
    if (!shapeFor(image.naturalWidth, image.naturalHeight)) {
      state.message = `That background is ${image.naturalWidth} by ${image.naturalHeight}, which is not a shape this can place onto yet.`;
      return;
    }
    backgroundImage = image;
    state.chosenBackgroundId = outputId;
    state.resultUrl = "";
    if (elementImage) resetBox();
  } catch (error) {
    state.message = error.message || "That background could not be opened.";
  } finally {
    state.busy = false;
    render();
  }
}

async function chooseProduct(productId) {
  state.message = "";
  state.busy = true;
  render();
  try {
    const payload = await readJson(await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", productId }),
    }));
    const images = (payload.product?.images || payload.record?.images || []).filter((image) => image.kind === "isolated" && image.blob_pathname);
    state.chosenProductId = productId;
    state.productImages = images;
    state.chosenImageId = "";
    elementImage = null;
    box = null;
    if (!images.length) state.message = "That product has no cut out picture saved against it. Add one on the product screen first.";
  } catch (error) {
    state.message = error.message || "That product could not be opened.";
  } finally {
    state.busy = false;
    render();
  }
}

// A cut out edge is the whole point. gpt-image-2 cannot make transparency and
// will not cut a product out for you, so a flat rectangle pasted on a
// background will look like a flat rectangle no matter what shadow is added.
// Say so and stop rather than spending a call to prove it.
function hasCutOutEdge(image) {
  const width = Math.min(220, image.naturalWidth);
  const height = Math.max(1, Math.round(width * (image.naturalHeight / image.naturalWidth)));
  const probe = document.createElement("canvas");
  probe.width = width;
  probe.height = height;
  const context = probe.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let clear = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 16) clear += 1;
  }
  return clear / (width * height) > 0.02;
}

async function chooseProductImage(imageId) {
  const record = state.productImages.find((image) => image.image_id === imageId);
  if (!record) return;
  state.message = "";
  state.busy = true;
  render();
  try {
    const payload = await readJson(await fetch("/api/blob/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname: record.blob_pathname, mode: "data" }),
    }));
    const image = await loadImage(payload.dataUrl);
    if (!hasCutOutEdge(image)) {
      state.message = "That picture has no cut out edge, so it would sit on the background as a rectangle. Use a version saved with a transparent background.";
      return;
    }
    elementImage = image;
    state.chosenImageId = imageId;
    state.resultUrl = "";
    if (backgroundImage) resetBox();
  } catch (error) {
    state.message = error.message || "That picture could not be opened.";
  } finally {
    state.busy = false;
    render();
  }
}

/* Placement, held in the background's own pixels */

function resetBox() {
  const width = backgroundImage.naturalWidth * 0.34;
  const height = width * (elementImage.naturalHeight / elementImage.naturalWidth);
  box = {
    x: (backgroundImage.naturalWidth - width) / 2,
    y: backgroundImage.naturalHeight * 0.62 - height / 2,
    width,
    height,
  };
}

function setScale(fraction) {
  if (!box || !backgroundImage || !elementImage) return;
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  box.width = backgroundImage.naturalWidth * fraction;
  box.height = box.width * (elementImage.naturalHeight / elementImage.naturalWidth);
  box.x = centreX - box.width / 2;
  box.y = centreY - box.height / 2;
  paintStage();
}

function paintStage() {
  const stage = document.getElementById("place-stage");
  if (!stage || !backgroundImage) return;
  const context = stage.getContext("2d");
  context.clearRect(0, 0, stage.width, stage.height);
  context.drawImage(backgroundImage, 0, 0, stage.width, stage.height);
  if (elementImage && box) {
    context.drawImage(elementImage, box.x * viewScale, box.y * viewScale, box.width * viewScale, box.height * viewScale);
  }
}

function attachStage() {
  const stage = document.getElementById("place-stage");
  if (!stage || !backgroundImage) return;
  const available = Math.min(stage.parentElement.clientWidth || 720, 720);
  viewScale = available / backgroundImage.naturalWidth;
  stage.width = Math.round(backgroundImage.naturalWidth * viewScale);
  stage.height = Math.round(backgroundImage.naturalHeight * viewScale);
  paintStage();

  stage.addEventListener("pointerdown", (event) => {
    if (!box) return;
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / viewScale;
    const y = (event.clientY - rect.top) / viewScale;
    if (x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height) return;
    drag = { offsetX: x - box.x, offsetY: y - box.y };
    stage.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointermove", (event) => {
    if (!drag || !box) return;
    const rect = stage.getBoundingClientRect();
    box.x = (event.clientX - rect.left) / viewScale - drag.offsetX;
    box.y = (event.clientY - rect.top) / viewScale - drag.offsetY;
    paintStage();
  });

  const release = (event) => {
    if (!drag) return;
    drag = null;
    stage.classList.remove("is-dragging");
    if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
}

/* The two canvases */

function buildComposite() {
  const canvas = document.createElement("canvas");
  canvas.width = backgroundImage.naturalWidth;
  canvas.height = backgroundImage.naturalHeight;
  const context = canvas.getContext("2d");
  context.drawImage(backgroundImage, 0, 0);
  context.drawImage(elementImage, box.x, box.y, box.width, box.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

// Black everywhere means leave it alone. The hole is the only place the model
// may paint. Its edge is softened by a gradient, because a hard edged hole
// leaves a visible seam where the shadow stops.
function buildMask() {
  const canvas = document.createElement("canvas");
  canvas.width = backgroundImage.naturalWidth;
  canvas.height = backgroundImage.naturalHeight;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const push = directionById(state.lightFrom)?.push ?? 0;
  const radiusX = box.width * 1.15;
  const radiusY = Math.max(box.height * 0.3, box.width * 0.34);
  const centreX = box.x + box.width / 2 + push * box.width * 0.35;
  const centreY = box.y + box.height + radiusY * 0.25;

  context.globalCompositeOperation = "destination-out";
  context.save();
  context.translate(centreX, centreY);
  context.scale(radiusX / radiusY, 1);
  const gradient = context.createRadialGradient(0, 0, radiusY * 0.25, 0, 0, radiusY);
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(0.6, "rgba(0, 0, 0, 0.85)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radiusY, 0, Math.PI * 2);
  context.fill();
  context.restore();

  return canvas.toDataURL("image/png");
}

function lightSentence() {
  const direction = directionById(state.lightFrom);
  const extra = state.lightNote.trim();
  if (!direction && !extra) return "";
  if (!direction) return extra;
  return extra ? `${direction.sentence}, ${extra}` : direction.sentence;
}

function measure(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.round(base64.length * 0.75);
}

async function generate() {
  if (!backgroundImage || !elementImage || !box) return;
  const shape = shapeFor(backgroundImage.naturalWidth, backgroundImage.naturalHeight);
  if (!shape) {
    state.message = "That background is not a shape this can place onto yet.";
    render();
    return;
  }

  const composite = buildComposite();
  const mask = buildMask();
  const total = measure(composite) + measure(mask);
  // Measured before sending rather than discovered as a rejected request. The
  // ceiling is four megabytes for the whole body; this leaves room for the
  // rest of it.
  if (total > 3.4 * 1024 * 1024) {
    state.message = `The flattened picture and shadow area come to ${(total / 1024 / 1024).toFixed(1)} MB together, which is too much to send. Use a smaller background.`;
    render();
    return;
  }

  state.busy = true;
  state.message = `Sending ${(total / 1024).toFixed(0)} KB. The shadow pass takes about a minute.`;
  render();

  try {
    const payload = await readJson(await fetch("/api/production/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "place-on-background",
        backgroundOutputId: state.chosenBackgroundId,
        productId: state.chosenProductId,
        productImageId: state.chosenImageId,
        composite,
        mask,
        size: shape.size,
        lightNote: lightSentence(),
        box: {
          x: Math.round(box.x), y: Math.round(box.y),
          width: Math.round(box.width), height: Math.round(box.height),
          canvasWidth: backgroundImage.naturalWidth, canvasHeight: backgroundImage.naturalHeight,
        },
      }),
    }));
    state.resultId = payload.job.jobId;
    state.resultUrl = `/api/production/outputs?action=image&outputId=${encodeURIComponent(payload.job.jobId)}`;
    state.message = "";
    render();
    await addToRecentWork(payload.job.jobId);
  } catch (error) {
    state.message = error.message || "The shadow pass did not finish.";
  } finally {
    state.busy = false;
    render();
  }
}

// The picture is already saved on the server before this runs. This only puts
// a row in the shared list, and the list is replaced wholesale on every write,
// so it is read first and only written back when the read gave a real list.
// A failure here costs a row, never the picture.
async function addToRecentWork(jobId) {
  try {
    const payload = await readJson(await fetch("/api/production/outputs", { headers: { Accept: "application/json" } }));
    if (!Array.isArray(payload.outputs)) return;
    const background = state.backgrounds.find((output) => output.id === state.chosenBackgroundId);
    const product = state.products.find((entry) => entry.product_id === state.chosenProductId);
    const entry = {
      id: jobId,
      label: `${product?.product_name || "Product"} placed on ${background?.label || "a background"}`,
      status: "draft",
      format: background?.format || null,
      hadImage: true,
      createdAt: new Date().toISOString(),
    };
    await fetch("/api/production/outputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outputs: [entry, ...payload.outputs] }),
    });
  } catch {
    state.message = "The picture is saved. It could not be added to your recent work list.";
    render();
  }
}

/* Rendering */

function pickerMarkup(items, chosenId) {
  return items.map((item) => `
    <button class="place-option ${item.id === chosenId ? "is-chosen" : ""}" type="button" data-action="${escapeHtml(item.action)}" data-id="${escapeHtml(item.id)}">
      ${item.thumb ? `<img src="${escapeHtml(item.thumb)}" alt="" onerror="this.remove();">` : ""}
      <span>${escapeHtml(item.label)}</span>
    </button>
  `).join("");
}

function render() {
  if (state.loading) {
    root.innerHTML = `<header class="page-header"><h1>Place on background</h1></header><p class="page-description">Loading your finished work.</p>`;
    return;
  }

  const ready = Boolean(backgroundImage && elementImage && box);
  const scaleFraction = ready ? box.width / backgroundImage.naturalWidth : 0.34;

  root.innerHTML = `
    <header class="page-header">
      <h1>Place on background</h1>
      <p class="page-description">Put a cut out product onto a picture you have already made. The product keeps its own artwork. The model is asked for one thing only, which is the shadow that settles it onto the surface.</p>
    </header>
    ${state.loadError ? `<div class="card"><p class="page-description">${escapeHtml(state.loadError)}</p></div>` : ""}
    <div class="place-layout">
      <div class="place-column">
        <section class="card">
          <div class="card-header"><h2>Background</h2></div>
          ${state.backgrounds.length ? `<p class="field-note place-note">${state.backgrounds.length} available, newest first.</p>` : ""}
          ${state.backgrounds.length
            ? `<div class="place-picker">${pickerMarkup(state.backgrounds.map((output) => ({
                id: output.id,
                label: output.label || "Untitled",
                action: "background",
                thumb: `/api/production/outputs?action=image&outputId=${encodeURIComponent(output.id)}`,
              })), state.chosenBackgroundId)}</div>`
            : `<p class="page-description">You have no finished pictures to place onto yet.</p>`}
        </section>

        <section class="card">
          <div class="card-header"><h2>Product</h2></div>
          ${state.products.length
            ? `<div class="place-picker">${pickerMarkup(state.products.map((product) => ({
                id: product.product_id,
                label: product.product_name || product.product_id,
                action: "product",
                thumb: "",
              })), state.chosenProductId)}</div>`
            : `<p class="page-description">You have no product records yet.</p>`}
          ${state.productImages.length
            ? `<p class="section-label place-note">Which picture</p>
               <div class="place-picker">${pickerMarkup(state.productImages.map((image) => ({
                 id: image.image_id,
                 label: image.file_name || "Cut out",
                 action: "product-image",
                 thumb: "",
               })), state.chosenImageId)}</div>`
            : ""}
        </section>

        <section class="card">
          <div class="card-header"><h2>Where the light is</h2></div>
          <p class="page-description">This decides which way the shadow falls. Leave it alone if you are not sure and the shadow will sit straight underneath.</p>
          <div class="place-direction">
            ${DIRECTIONS.map((direction) => `
              <button class="button small ${state.lightFrom === direction.id ? "" : "ghost"}" type="button" data-action="light" data-id="${direction.id}">${escapeHtml(direction.label)}</button>
            `).join("")}
          </div>
          <div class="field place-note">
            <label for="place-light-note">Anything else about the light</label>
            <input class="input-like" id="place-light-note" type="text" value="${escapeHtml(state.lightNote)}" placeholder="low and warm, late afternoon">
          </div>
        </section>
      </div>

      <div class="place-column">
        <section class="card">
          <div class="card-header"><h2>Placement</h2></div>
          ${backgroundImage
            ? `<canvas class="place-stage" id="place-stage"></canvas>
               ${ready
                 ? `<div class="field place-note">
                      <label for="place-scale">Size</label>
                      <input id="place-scale" type="range" min="8" max="90" value="${Math.round(scaleFraction * 100)}">
                    </div>
                    <p class="field-note">Drag the product to move it.</p>`
                 : `<p class="field-note place-note">Choose a product picture to place.</p>`}`
            : `<p class="place-empty page-description">Choose a background to start.</p>`}
          ${state.message ? `<p class="page-description place-note">${escapeHtml(state.message)}</p>` : ""}
          <div class="actions">
            <button class="button" type="button" data-action="generate" ${ready && !state.busy ? "" : "disabled"}>${state.busy ? "Working" : "Add the shadow"}</button>
          </div>
        </section>

        ${state.resultUrl
          ? `<section class="card place-result">
               <div class="card-header"><h2>Result</h2></div>
               <img src="${escapeHtml(state.resultUrl)}" alt="The product placed on the background with shadow added">
               <p class="field-note place-note">Saved to your recent work.</p>
             </section>`
          : ""}
      </div>
    </div>
  `;

  attachStage();

  const scale = document.getElementById("place-scale");
  if (scale) scale.addEventListener("input", (event) => setScale(Number(event.target.value) / 100));

  const note = document.getElementById("place-light-note");
  if (note) note.addEventListener("input", (event) => { state.lightNote = event.target.value; });
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || state.busy) return;
  const id = target.dataset.id || "";
  if (target.dataset.action === "background") chooseBackground(id);
  if (target.dataset.action === "product") chooseProduct(id);
  if (target.dataset.action === "product-image") chooseProductImage(id);
  if (target.dataset.action === "light") {
    state.lightFrom = state.lightFrom === id ? "" : id;
    render();
  }
  if (target.dataset.action === "generate") generate();
});

render();
loadEverything();
