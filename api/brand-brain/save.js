import { saveBrandBrainSnapshot } from "../../src/brand-brain/service.js";
import { createVercelBlobBrandBrainStore } from "../../src/brand-brain/store.js";
import { readJsonBody, requireBrandWorldAccess, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";

export default async function handler(request, response) {
  if (!requireBrandWorldAccess(request, response)) return;
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "This route only saves Brand Brain changes." });
    return;
  }
  try {
    const clientId = resolveClientId(request);
    const snapshot = await readJsonBody(request);
    const saved = await saveBrandBrainSnapshot(snapshot, createVercelBlobBrandBrainStore({ clientId }));
    sendJson(response, 200, { savedAt: saved.savedAt });
  } catch (error) {
    sendPublicError(response, error);
  }
}
