import { del, get, list, put } from "@vercel/blob";

// The one document that lives outside any client namespace: the flat list of
// clients the steward can switch between. See ADR 0011.
const CLIENT_INDEX_PATHNAME = "brand-world-system/clients/index.json";

// The default client makes the pre-namespace brain reachable after namespacing.
// It is always present in the list even before the index document exists.
const DEFAULT_CLIENT = { id: "default", name: "Default brand", status: "active", configRef: null, createdAt: null };

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "client";
}

function shortId() {
  return (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
}

export function createVercelBlobClientStore(options = {}) {
  const token = options.token || process.env.BLOB_READ_WRITE_TOKEN;
  const credentials = token ? { token } : {};

  async function readIndexOrNull() {
    const result = await get(CLIENT_INDEX_PATHNAME, { access: "private", ...credentials, useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream) throw new Error("The client list could not be read.");
    return JSON.parse(await new Response(result.stream).text());
  }

  async function writeIndex(clients) {
    await put(CLIENT_INDEX_PATHNAME, JSON.stringify({ clients }), {
      access: "private",
      ...credentials,
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
  }

  return {
    async list() {
      const index = await readIndexOrNull();
      const clients = Array.isArray(index?.clients) ? index.clients : [];
      if (!clients.some((client) => client.id === "default")) return [DEFAULT_CLIENT, ...clients];
      return clients;
    },
    async create({ name }) {
      const trimmed = String(name || "").trim();
      if (!trimmed) {
        const error = new Error("A client needs a name.");
        error.status = 400;
        throw error;
      }
      const index = (await readIndexOrNull()) || { clients: [] };
      const clients = Array.isArray(index.clients) ? index.clients : [];
      // The id is server-assigned and never user-managed (ADR 0011).
      let id = `${slugify(trimmed)}-${shortId()}`;
      while (clients.some((client) => client.id === id) || id === "default") {
        id = `${slugify(trimmed)}-${shortId()}`;
      }
      const record = { id, name: trimmed, status: "active", configRef: null, createdAt: new Date().toISOString() };
      clients.push(record);
      await writeIndex(clients);
      return record;
    },
    // Archiving removes a client from the switcher and keeps every record in
    // its namespace. It is the default meaning of delete, and it is
    // reversible by hand. The default client cannot be archived because it
    // anchors the pre-namespace brain (ADR 0011).
    async archive(id) {
      if (id === "default") {
        const error = new Error("The default client cannot be archived.");
        error.status = 400;
        throw error;
      }
      const index = (await readIndexOrNull()) || { clients: [] };
      const clients = Array.isArray(index.clients) ? index.clients : [];
      const record = clients.find((client) => client.id === id);
      if (!record) {
        const error = new Error("That client was not found.");
        error.status = 404;
        throw error;
      }
      record.status = "archived";
      record.archivedAt = new Date().toISOString();
      await writeIndex(clients);
      return record;
    },
    // Purging permanently deletes every blob in the client's namespace and
    // removes the client from the index. Irreversible. Only archived clients
    // can be purged, so destruction is always a second, separate decision.
    async purge(id) {
      if (id === "default") {
        const error = new Error("The default client cannot be deleted.");
        error.status = 400;
        throw error;
      }
      const index = (await readIndexOrNull()) || { clients: [] };
      const clients = Array.isArray(index.clients) ? index.clients : [];
      const record = clients.find((client) => client.id === id);
      if (!record) {
        const error = new Error("That client was not found.");
        error.status = 404;
        throw error;
      }
      if (record.status !== "archived") {
        const error = new Error("Archive this client first. Permanent deletion is only available for archived clients.");
        error.status = 400;
        throw error;
      }
      const prefix = `brand-world-system/clients/${id}/`;
      let cursor;
      let deleted = 0;
      do {
        const page = await list({ prefix, cursor, limit: 1000, ...credentials });
        const urls = (page.blobs || []).map((blob) => blob.url);
        if (urls.length) {
          await del(urls, { ...credentials });
          deleted += urls.length;
        }
        cursor = page.cursor;
      } while (cursor);
      await writeIndex(clients.filter((client) => client.id !== id));
      return { id, deleted };
    },
  };
}
