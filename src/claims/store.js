import { get, put } from "@vercel/blob";

// Per-client brand-level claims document. See ADR 0013.
//
// One document per client, three sections: approved claims, prohibited claims,
// and required disclosures. Each entry is human-authored with provenance.
// The document versions independently of the brain and product records.
//
// This is the first source in the derived claims model. The second source is
// approved product records, assembled at compilation time.

function claimsPathname(clientId) {
  return `brand-world-system/clients/${clientId}/claims.json`;
}

function shortId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toLowerCase();
}

function emptyDocument() {
  return {
    schema_version: "1.0.0",
    version: 1,
    updated_at: new Date().toISOString(),
    approved: [],
    prohibited: [],
    disclosures: [],
  };
}

export function createVercelBlobClaimsStore(options = {}) {
  const token = options.token || process.env.BLOB_READ_WRITE_TOKEN;
  const clientId = options.clientId || "default";
  const credentials = token ? { token } : {};

  async function readOrCreate() {
    const pathname = claimsPathname(clientId);
    const result = await get(pathname, {
      access: "private",
      ...credentials,
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return emptyDocument();
    }
    return JSON.parse(await new Response(result.stream).text());
  }

  async function persist(doc) {
    doc.updated_at = new Date().toISOString();
    const pathname = claimsPathname(clientId);
    await put(pathname, JSON.stringify(doc), {
      access: "private",
      ...credentials,
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return doc;
  }

  return {
    // Read the full claims document. Returns an empty document if none exists.
    async read() {
      return readOrCreate();
    },

    // Add an entry to one of the three sections.
    // section: "approved" | "prohibited" | "disclosures"
    // entry: { text, scope?, source_ref?, added_by?, trigger_scope? }
    async addEntry(section, entry) {
      if (!["approved", "prohibited", "disclosures"].includes(section)) {
        throw new Error(`Invalid section "${section}". Use approved, prohibited, or disclosures.`);
      }
      if (!entry.text || !entry.text.trim()) {
        throw new Error("Entry text is required.");
      }
      const doc = await readOrCreate();
      const newEntry = {
        id: `${section.slice(0, 3)}-${shortId()}`,
        text: entry.text.trim(),
        scope: entry.scope || { brand_wide: true },
        source_ref: entry.source_ref || null,
        added_by: entry.added_by || null,
        added_at: new Date().toISOString(),
        superseded_at: null,
        superseded_by: null,
      };
      if (section === "disclosures") {
        newEntry.trigger_scope = entry.trigger_scope || null;
      }
      doc[section].push(newEntry);
      doc.version += 1;
      await persist(doc);
      return { document: doc, added: newEntry };
    },

    // Edit an existing entry. Retains the prior version inline (superseded).
    async editEntry(section, entryId, updates) {
      if (!["approved", "prohibited", "disclosures"].includes(section)) {
        throw new Error(`Invalid section "${section}".`);
      }
      const doc = await readOrCreate();
      const idx = doc[section].findIndex((e) => e.id === entryId);
      if (idx < 0) {
        throw new Error(`Entry "${entryId}" not found in ${section}.`);
      }
      const existing = doc[section][idx];
      // Mark existing as superseded, create a new entry.
      existing.superseded_at = new Date().toISOString();
      existing.superseded_by = `${section.slice(0, 3)}-${shortId()}`;
      const replacement = {
        id: existing.superseded_by,
        text: updates.text?.trim() || existing.text,
        scope: updates.scope || existing.scope,
        source_ref: updates.source_ref !== undefined ? updates.source_ref : existing.source_ref,
        added_by: updates.added_by || existing.added_by,
        added_at: new Date().toISOString(),
        superseded_at: null,
        superseded_by: null,
      };
      if (section === "disclosures") {
        replacement.trigger_scope = updates.trigger_scope !== undefined
          ? updates.trigger_scope
          : existing.trigger_scope;
      }
      // Keep the superseded entry for auditability, add the replacement.
      doc[section].push(replacement);
      doc.version += 1;
      await persist(doc);
      return { document: doc, superseded: existing, replacement };
    },

    // Remove an entry by marking it superseded with no replacement.
    async removeEntry(section, entryId) {
      if (!["approved", "prohibited", "disclosures"].includes(section)) {
        throw new Error(`Invalid section "${section}".`);
      }
      const doc = await readOrCreate();
      const idx = doc[section].findIndex((e) => e.id === entryId);
      if (idx < 0) {
        throw new Error(`Entry "${entryId}" not found in ${section}.`);
      }
      const removed = doc[section][idx];
      removed.superseded_at = new Date().toISOString();
      removed.superseded_by = null; // No replacement, just removed.
      doc.version += 1;
      await persist(doc);
      return { document: doc, removed };
    },

    // Return only active (non-superseded) entries from a section.
    activeEntries(doc, section) {
      return (doc[section] || []).filter((e) => !e.superseded_at);
    },
  };
}
