import { createVercelBlobBrandBrainStore } from "../../src/brand-brain/store.js";
import { createVercelBlobProductStore } from "../../src/products/store.js";
import { createVercelBlobClaimsStore } from "../../src/claims/store.js";
import { createVercelBlobRefusalsStore } from "../../src/refusals/store.js";
import { prepareProductionPackage } from "../../src/production/service.js";
import { readJsonBody, requireBrandWorldAccess, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";

export default async function handler(request, response) {
  if (!requireBrandWorldAccess(request, response)) return;
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "This route only prepares a production package." });
    return;
  }
  try {
    const clientId = resolveClientId(request);
    const body = await readJsonBody(request);
    const { generationPackage } = await prepareProductionPackage(body, {
      brainStore: createVercelBlobBrandBrainStore({ clientId }),
      productStore: createVercelBlobProductStore({ clientId }),
      claimsStore: createVercelBlobClaimsStore({ clientId }),
      refusalsStore: createVercelBlobRefusalsStore({ clientId }),
    });
    sendJson(response, 200, { generationPackage });
  } catch (error) {
    sendPublicError(response, error);
  }
}

