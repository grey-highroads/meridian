import { readProductionJob } from "../../src/production/service.js";
import { createVercelBlobProductionStore } from "../../src/production/store.js";
import { requireBrandWorldAccess, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";

export default async function handler(request, response) {
  if (!requireBrandWorldAccess(request, response)) return;
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "This route only reads the latest production job." });
    return;
  }
  try {
    const clientId = resolveClientId(request);
    sendJson(response, 200, { job: await readProductionJob({ productionStore: createVercelBlobProductionStore({ clientId }) }) });
  } catch (error) {
    sendPublicError(response, error);
  }
}
