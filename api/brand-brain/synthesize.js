import { synthesizeBrandBrain } from "../../src/brand-brain/service.js";
import { createVercelBlobBrandBrainStore } from "../../src/brand-brain/store.js";
import { readJsonBody, requireBrandWorldAccess, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";

export default async function handler(request, response) {
  if (!requireBrandWorldAccess(request, response)) return;
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "This route only prepares a Brand Brain." });
    return;
  }
  try {
    const clientId = resolveClientId(request);
    const body = await readJsonBody(request, 45 * 1024 * 1024);
    const saved = await synthesizeBrandBrain(body, {
      store: createVercelBlobBrandBrainStore({ clientId }),
      env: process.env,
    });
    sendJson(response, 200, saved);
  } catch (error) {
    sendPublicError(response, error);
  }
}
