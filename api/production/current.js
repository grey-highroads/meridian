import { readProductionJob } from "../../src/production/service.js";
import { createVercelBlobProductionStore } from "../../src/production/store.js";
import { requireUser, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { OPERATOR_ROLE } from "../../src/org/store.js";

export default async function handler(request, response) {
  const user = await requireUser(request, response, { role: OPERATOR_ROLE });
  if (!user) return;
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "This route only reads the latest production job." });
    return;
  }
  try {
    const clientId = resolveClientId(request, user);
    sendJson(response, 200, { job: await readProductionJob({ productionStore: createVercelBlobProductionStore({ clientId }) }) });
  } catch (error) {
    sendPublicError(response, error);
  }
}
