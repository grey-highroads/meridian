// Place on background. A spike, deliberately built beside the production path
// rather than through it.
//
// The browser composites a finished output and a product image onto one canvas
// and builds a mask covering only the ground where a shadow belongs. This
// module sends both to the image edits endpoint and saves what comes back.
//
// Why this file duplicates a little of src/renderers/openai-images.js instead
// of adding a mask option to it: the renderer is on the live path for every
// image the system makes, and this is an experiment. Ninety lines that nothing
// else imports can be deleted in one commit. An option threaded through the
// shared renderer cannot.
//
// What this does and does not give you. The product pixels are composited in
// the browser and the product is never sent to a model on its own, so its
// artwork and geometry are authored rather than drawn by a model. The picture
// that comes back is a new picture the model made, so the area outside the
// mask is re-encoded rather than returned untouched. If a true untouched
// guarantee is wanted later, draw the product over the returned image one more
// time in the browser before saving.

export const IMAGE_EDITS_ENDPOINT = "https://api.openai.com/v1/images/edits";
export const IMAGE_MODEL = "gpt-image-2";

// gpt-image-2 accepts these. A size that does not match the composite's shape
// makes the model rescale the picture, which moves the product away from where
// it was placed, so the browser sends the one matching its own canvas.
const ALLOWED_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536"]);

// Well under the four megabyte body limit at every size the app produces.
const MAX_PART_BYTES = 3 * 1024 * 1024;

// Concrete physical facts, stated early, because this renderer follows facts
// in strong positions and ignores description anywhere. The light note goes
// first when there is one: where the light comes from decides which side the
// shadow falls on, and every sentence after it depends on that answer.
export function shadowInstruction(lightNote = "") {
  const note = String(lightNote || "").trim().slice(0, 300);
  const parts = [];
  if (note) parts.push(`The light in this picture comes from ${note}.`);
  parts.push(
    "Add shadow where the object meets the surface. A tight dark contact shadow runs along the exact line where the object touches, darkest and hardest at that line.",
    "A softer cast shadow spreads away from the object on the side opposite the light, losing its edge as it travels and lightening at its far end.",
    "The surface directly beneath and around the object darkens slightly.",
    "If the surface is at all reflective, a faint reflection of the object's lower edge sits on it, dimmer and less defined than the object itself.",
    "Do not add, move, resize, or redraw the object. Do not change its colors, its artwork, its lettering, or its edges.",
    "Do not add any new object, surface, mark, or lettering anywhere in the picture. Shadow, surface darkening, and reflection are the only additions.",
  );
  return parts.join(" ");
}

function decodeDataUrl(value, label) {
  const match = String(value || "").match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error = new Error(`The ${label} did not arrive as image data.`);
    error.status = 400;
    throw error;
  }
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_PART_BYTES) {
    const error = new Error(`The ${label} is too large to send. Use a smaller background.`);
    error.status = 413;
    throw error;
  }
  return { bytes, type: match[1] };
}

function jobIdFor() {
  return `place-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// The edits call. One base image rather than an array, because a mask applies
// to a single image.
export async function callShadowEdit({ apiKey, composite, mask, prompt, size, fetchImpl = fetch }) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", "medium");
  form.append("output_format", "png");
  form.append("image", new Blob([composite.bytes], { type: composite.type }), "composite.jpg");
  form.append("mask", new Blob([mask.bytes], { type: "image/png" }), "mask.png");
  const response = await fetchImpl(IMAGE_EDITS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result?.error?.message || `The shadow pass failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return result;
}

// Saves under its own job id and never touches the current job slot. That slot
// carries one record and a real render may be running in it; a fast side path
// is not worth the chance of standing on a render someone is waiting for.
export async function placeOnBackground(body, options) {
  const size = String(body.size || "");
  if (!ALLOWED_SIZES.has(size)) {
    const error = new Error("That background is not a shape this can place onto.");
    error.status = 400;
    throw error;
  }
  const composite = decodeDataUrl(body.composite, "flattened picture");
  const mask = decodeDataUrl(body.mask, "shadow area");

  const prompt = shadowInstruction(body.lightNote);
  const jobId = jobIdFor();

  const result = await callShadowEdit({
    apiKey: options.env.OPENAI_API_KEY,
    composite,
    mask,
    prompt,
    size,
    fetchImpl: options.fetchImpl || fetch,
  });
  const image = result?.data?.[0];
  if (!image?.b64_json) throw new Error("The shadow pass returned no picture.");

  await options.productionStore.writeImage(jobId, Buffer.from(image.b64_json, "base64"), "image/png");

  // Provenance. Deliberately not shaped as a compiled package: this output was
  // not compiled from a brand brain, and a record pretending otherwise would
  // read as governed work when it is not. The review screen refuses to
  // evaluate it and says so plainly, which is the correct answer.
  if (options.productionStore.writeOutputPackage) {
    try {
      await options.productionStore.writeOutputPackage(jobId, {
        placement: {
          backgroundOutputId: String(body.backgroundOutputId || ""),
          productId: String(body.productId || ""),
          productImageId: String(body.productImageId || ""),
          box: body.box || null,
          lightNote: String(body.lightNote || "").slice(0, 300),
        },
        prompt,
        model: IMAGE_MODEL,
        endpoint: IMAGE_EDITS_ENDPOINT,
        size,
        savedAt: new Date().toISOString(),
      });
    } catch {
      // The picture is saved either way. Only later provenance is affected.
    }
  }

  return {
    jobId,
    status: "complete",
    model: IMAGE_MODEL,
    size,
    prompt,
    completedAt: new Date().toISOString(),
  };
}
