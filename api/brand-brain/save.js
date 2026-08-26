import { saveBrandBrainSnapshot } from "../../src/brand-brain/service.js";
import { createVercelBlobBrandBrainStore } from "../../src/brand-brain/store.js";
import { readJsonBody, requireUser, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { OPERATOR_ROLE } from "../../src/org/store.js";

export default async function handler(request, response) {
  const user = await requireUser(request, response, { role: OPERATOR_ROLE });
  if (!user) return;
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "This route only saves Brand Brain changes." });
    return;
  }
  try {
    const clientId = resolveClientId(request, user);
    const snapshot = await readJsonBody(request);
    const saved = await saveBrandBrainSnapshot(snapshot, createVercelBlobBrandBrainStore({ clientId }));
    sendJson(response, 200, { savedAt: saved.savedAt });
  } catch (error) {
    sendPublicError(response, error);
  }
}
