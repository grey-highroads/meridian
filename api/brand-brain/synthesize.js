import { synthesizeBrandBrain } from "../../src/brand-brain/service.js";
import { createVercelBlobBrandBrainStore } from "../../src/brand-brain/store.js";
import { readJsonBody, requireUser, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { OPERATOR_ROLE } from "../../src/org/store.js";

export default async function handler(request, response) {
  const user = await requireUser(request, response, { role: OPERATOR_ROLE });
  if (!user) return;
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
