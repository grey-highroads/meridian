import { createVercelBlobClientStore } from "../../src/clients/store.js";
import { readJsonBody, requireBrandWorldAccess, sendJson, sendPublicError } from "../../src/server/http.js";

export default async function handler(request, response) {
  if (!requireBrandWorldAccess(request, response)) return;
  try {
    const store = createVercelBlobClientStore();
    if (request.method === "GET") {
      sendJson(response, 200, { clients: await store.list() });
      return;
    }
    if (request.method === "POST") {
      const body = await readJsonBody(request);
      // Action dispatch keeps this within the existing function (12-function
      // ceiling). No action means create, preserving the original contract.
      if (body.action === "archive") {
        const client = await store.archive(body.id);
        sendJson(response, 200, { client });
        return;
      }
      if (body.action === "purge") {
        // Permanent deletion requires the exact client name typed back, so a
        // wrong id or a stale UI cannot destroy a namespace by accident.
        const clients = await store.list();
        const record = clients.find((client) => client.id === body.id);
        if (!record || String(body.confirmName || "").trim() !== record.name) {
          sendJson(response, 400, { error: "Type the client's exact name to confirm permanent deletion." });
          return;
        }
        const result = await store.purge(body.id);
        sendJson(response, 200, { purged: result });
        return;
      }
      const client = await store.create({ name: body.name });
      sendJson(response, 201, { client });
      return;
    }
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: "This route lists clients or creates one." });
  } catch (error) {
    sendPublicError(response, error);
  }
}
