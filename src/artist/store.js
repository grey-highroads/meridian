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
//   decisions.json  The one ruling that put this brain in, and any findings a
//                   person has since taken out. Import never touches this, so
//                   re-importing cannot undo a ruling.
//   prior.json      The unresearched prior. Written once at import. No action
//                   in the handler reads it back out.
//
// The ruling is wholesale. The operator already read every finding during
// intake, sorted it into a bin and counted its sources, so asking a second
// person to rule on each one again is the same work twice. One person approves
// the brain, which is the human ruling the artist layer requires, and takes out
// the individual findings that should not be there.

const ROOT = "brand-world-system/clients";

// Demo-account data stays at its legacy paths; other accounts get their own
// namespace. Brief 2 of docs/spec-accounts-artists-tours.md.
const DEMO_ACCOUNT_ID = "dierks-bentley";

export function pathFor(artistId, document, accountId) {
  if (!accountId || accountId === DEMO_ACCOUNT_ID) return `${ROOT}/${artistId}/artist/${document}.json`;
  return `${ROOT}/${accountId}/artists/${artistId}/${document}.json`;
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
  const accountId = options.accountId || null;

  async function readDocument(artistId, name, fallback) {
    const body = await backend.read(pathFor(artistId, name, accountId));
    if (body === null || body === undefined) return fallback;
    return JSON.parse(body);
  }

  return {
    // Exposed so a caller holding this store can open the account's artist
    // directory on the same backend. Reading it does not reach brain content.
    backend,

    async readRecord(artistId) {
      return await readDocument(artistId, "record", { ...EMPTY_RECORD });
    },
    async readDecisions(artistId) {
      return await readDocument(artistId, "decisions", { brain: null, removed: {} });
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
      await backend.write(pathFor(artistId, "record", accountId), JSON.stringify(record, null, 2));
      await backend.write(pathFor(artistId, "prior", accountId), JSON.stringify(parsed.prior, null, 2));
      return record;
    },
    async approveBrain(artistId, person) {
      const decisions = await readDocument(artistId, "decisions", { brain: null, removed: {} });
      const next = {
        brain: { approvedBy: person || "Higher Roads", approvedAt: new Date().toISOString() },
        removed: decisions.removed && typeof decisions.removed === "object" ? decisions.removed : {},
      };
      await backend.write(pathFor(artistId, "decisions", accountId), JSON.stringify(next, null, 2));
      return next;
    },
    // Taking a finding out and putting it back are both recorded, and neither
    // touches the record. A finding is never deleted, so a wrong click costs a
    // click rather than a piece of the artist's history.
    async setRemoved(artistId, findingId, entry) {
      const decisions = await readDocument(artistId, "decisions", { brain: null, removed: {} });
      const removed = decisions.removed && typeof decisions.removed === "object" ? { ...decisions.removed } : {};
      if (entry) removed[findingId] = entry;
      else delete removed[findingId];
      const next = { brain: decisions.brain || null, removed };
      await backend.write(pathFor(artistId, "decisions", accountId), JSON.stringify(next, null, 2));
      return next;
    },
  };
}

export function brainApproved(decisions) {
  return Boolean(decisions && decisions.brain && decisions.brain.approvedAt);
}

// A finding as a person reads it: what the intake file said, plus whether it is
// in the brain. Everything the operator produced is in once the brain is
// approved, except what someone has taken out by hand.
export function applyRulings(findings, decisions) {
  const approved = brainApproved(decisions);
  const removed = decisions && typeof decisions.removed === "object" ? decisions.removed : {};
  return findings.map((finding) => {
    const entry = ownEntry(removed, finding.id);
    return {
      ...finding,
      inBrain: approved && !entry,
      removedBy: entry?.removedBy || null,
      removedAt: entry?.removedAt || null,
    };
  });
}
