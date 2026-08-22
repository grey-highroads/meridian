import { get, put } from "@vercel/blob";
import { ownEntry } from "../lookup.js";

// The artist layer's storage. It reuses the client-scoped blob path from
// ADR 0011 with the artist id as the scope value, because the vocabulary map
// says client becomes artist and renaming the store is a separate job.
//
// Three documents per artist, kept apart on purpose:
//
//   record.json     Everything the intake files say. Rewritten byte for byte
//                   on every import, so a second import changes nothing.
//   decisions.json  Which findings a person approved or declined, and who and
//                   when. Import never touches this, so re-importing cannot
//                   undo a ruling.
//   prior.json      The unresearched prior. Written once at import. No action
//                   in the handler reads it back out.

const ROOT = "brand-world-system/clients";

export function pathFor(artistId, document) {
  return `${ROOT}/${artistId}/artist/${document}.json`;
}

// Reads and writes as plain documents. The Vercel blob backend is the default.
// Tests pass an in-memory backend so the effect of every action is checked
// without a network call.
export function createBlobBackend(options = {}) {
  const token = options.token || process.env.BLOB_READ_WRITE_TOKEN;
  const credentials = token ? { token } : {};
  return {
    async read(pathname) {
      const result = await get(pathname, { access: "private", ...credentials, useCache: false });
      if (!result) return null;
      if (result.statusCode !== 200 || !result.stream) throw new Error("That artist record could not be read.");
      return await new Response(result.stream).text();
    },
    async write(pathname, body) {
      await put(pathname, body, {
        access: "private",
        ...credentials,
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 0,
      });
    },
  };
}

export function createMemoryBackend(seed = {}) {
  const files = new Map(Object.entries(seed));
  return {
    files,
    async read(pathname) {
      return files.has(pathname) ? files.get(pathname) : null;
    },
    async write(pathname, body) {
      files.set(pathname, body);
    },
  };
}

const EMPTY_RECORD = { artist: null, sources: [], claims: [], findings: [] };

export function createArtistStore(options = {}) {
  const backend = options.backend || createBlobBackend(options);

  async function readDocument(artistId, name, fallback) {
    const body = await backend.read(pathFor(artistId, name));
    if (body === null || body === undefined) return fallback;
    return JSON.parse(body);
  }

  return {
    async readRecord(artistId) {
      return await readDocument(artistId, "record", { ...EMPTY_RECORD });
    },
    async readDecisions(artistId) {
      return await readDocument(artistId, "decisions", { findings: {} });
    },
    // Import writes the record and the prior and leaves decisions alone.
    // The body is stable text for stable input, which is what makes a second
    // import a no-op rather than a rewrite that happens to look the same.
    async writeImport(artistId, parsed) {
      const record = {
        artist: parsed.artist,
        sources: parsed.sources,
        claims: parsed.claims,
        findings: parsed.findings,
        log: parsed.log,
      };
      await backend.write(pathFor(artistId, "record"), JSON.stringify(record, null, 2));
      await backend.write(pathFor(artistId, "prior"), JSON.stringify(parsed.prior, null, 2));
      return record;
    },
    async writeDecision(artistId, findingId, decision) {
      const decisions = await readDocument(artistId, "decisions", { findings: {} });
      const findings = decisions.findings && typeof decisions.findings === "object" ? decisions.findings : {};
      findings[findingId] = decision;
      const next = { findings };
      await backend.write(pathFor(artistId, "decisions"), JSON.stringify(next, null, 2));
      return next;
    },
  };
}

// A finding as a person reads it: what the file said, plus where the ruling on
// it stands. Status starts at proposed and moves only when someone rules.
export function applyDecisions(findings, decisions) {
  const map = decisions && typeof decisions.findings === "object" ? decisions.findings : {};
  return findings.map((finding) => {
    const decision = ownEntry(map, finding.id);
    return {
      ...finding,
      status: decision?.status || "proposed",
      decidedBy: decision?.decidedBy || null,
      decidedAt: decision?.decidedAt || null,
    };
  });
}
