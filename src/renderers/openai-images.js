export const OPENAI_IMAGE_MODEL = "gpt-image-2";
export const OPENAI_IMAGE_GENERATIONS_ENDPOINT = "https://api.openai.com/v1/images/generations";
export const OPENAI_IMAGE_EDITS_ENDPOINT = "https://api.openai.com/v1/images/edits";

function requiredPrompt(prompt) {
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("A compiled production prompt is required.");
  return prompt;
}

function decodeImageData(image) {
  if (image.bytes instanceof Uint8Array) return image.bytes;
  const match = String(image.data || "").match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error(`Reference image ${image.name || "image"} is not valid Base64 image data.`);
  return Uint8Array.from(Buffer.from(match[2], "base64"));
}

export function chooseOpenAIImageEndpoint(referenceImages = []) {
  return referenceImages.length ? OPENAI_IMAGE_EDITS_ENDPOINT : OPENAI_IMAGE_GENERATIONS_ENDPOINT;
}

export function buildOpenAIImageGenerationRequest({ prompt, model = OPENAI_IMAGE_MODEL, size = "auto", quality = "high", outputFormat = "png" }) {
  return {
    endpoint: OPENAI_IMAGE_GENERATIONS_ENDPOINT,
    contentType: "application/json",
    body: {
      model,
      prompt: requiredPrompt(prompt),
      size,
      quality,
      output_format: outputFormat,
    },
  };
}

export function buildOpenAIImageEditRequest({ prompt, referenceImages, model = OPENAI_IMAGE_MODEL, size = "auto", quality = "high", outputFormat = "png" }) {
  if (!Array.isArray(referenceImages) || !referenceImages.length) throw new Error("At least one reference image is required for an image edit request.");
  const body = new FormData();
  body.append("model", model);
  body.append("prompt", requiredPrompt(prompt));
  body.append("size", size);
  body.append("quality", quality);
  body.append("output_format", outputFormat);
  for (const image of referenceImages) {
    body.append("image[]", new Blob([decodeImageData(image)], { type: image.type || "image/png" }), image.name || "reference.png");
  }
  return {
    endpoint: OPENAI_IMAGE_EDITS_ENDPOINT,
    contentType: "multipart/form-data",
    body,
  };
}

export async function renderWithOpenAIImages({ apiKey, prompt, referenceImages = [], fetchImpl = fetch, ...options }) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const request = referenceImages.length
    ? buildOpenAIImageEditRequest({ prompt, referenceImages, ...options })
    : buildOpenAIImageGenerationRequest({ prompt, ...options });
  const headers = { Authorization: `Bearer ${apiKey}` };
  let body = request.body;
  if (request.contentType === "application/json") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetchImpl(request.endpoint, { method: "POST", headers, body });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result?.error?.message || `OpenAI image request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return result;
}

