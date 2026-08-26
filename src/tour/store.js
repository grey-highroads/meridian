import { get, put } from "@vercel/blob";
import { createBlobBackend, createMemoryBackend } from "../artist/store.js";

// Tour-layer storage, scoped by tour id, in the same blob namespace pattern the
// artist layer uses.
//
// Two documents per assignment:
//
//   concept.json  The concept a person chose or wrote, with what it came from
//                 and who shaped it. Overwritten when someone changes their
//                 mind before a brief is frozen.
//   briefs.json   Every brief version for this assignment, in order. A frozen
//                 version is never rewritten. Feedback produces a new version.

const ROOT = "brand-world-system/clients";

// One shape for every account. The demo account is an account like any other
// and has no path of its own. Everything stored is scoped account, then tour,
// which is what makes two accounts naming a tour the same thing separate.
//
// An account id is required rather than defaulted. A write with no account
// would land somewhere two accounts could share, and a default would hide the
// caller that forgot to resolve a session.
function requireAccount(accountId) {
  if (!accountId) {
    const error = new Error("A tour path needs the account it belongs to.");
    error.status = 400;
    throw error;
  }
  return accountId;
}

export function tourPathFor(tourId, assignmentId, document, accountId) {
  return `${ROOT}/${requireAccount(accountId)}/tours/${tourId}/${assignmentId}/${document}.json`;
}

export function tourDocumentPathFor(tourId, document, accountId) {
  return `${ROOT}/${requireAccount(accountId)}/tours/${tourId}/${document}.json`;
}

export { createBlobBackend, createMemoryBackend };

export function createTourStore(options = {}) {
  const backend = options.backend || createBlobBackend(options);
  const accountId = requireAccount(options.accountId);

  async function read(tourId, assignmentId, name, fallback) {
    const body = await backend.read(tourPathFor(tourId, assignmentId, name, accountId));
    if (body === null || body === undefined) return fallback;
    return JSON.parse(body);
  }

  async function write(tourId, assignmentId, name, value) {
    await backend.write(tourPathFor(tourId, assignmentId, name, accountId), JSON.stringify(value, null, 2));
    return value;
  }

  async function readTourDocument(tourId, name, fallback) {
    const body = await backend.read(tourDocumentPathFor(tourId, name, accountId));
    if (body === null || body === undefined) return fallback;
    return JSON.parse(body);
  }

  async function writeTourDocument(tourId, name, value) {
    await backend.write(tourDocumentPathFor(tourId, name, accountId), JSON.stringify(value, null, 2));
    return value;
  }

  return {
    backend,
    accountId,

    async readConcept(tourId, assignmentId) {
      return await read(tourId, assignmentId, "concept", null);
    },
    async writeConcept(tourId, assignmentId, concept) {
      return await write(tourId, assignmentId, "concept", concept);
    },
    async readBriefs(tourId, assignmentId) {
      const stored = await read(tourId, assignmentId, "briefs", { versions: [] });
      return Array.isArray(stored.versions) ? stored.versions : [];
    },
    // A frozen version is never touched again. Anything that would change a
    // frozen brief is a new version instead, which is what makes the brief a
    // thing a person can be held to.
    async addBrief(tourId, assignmentId, brief) {
      const versions = await this.readBriefs(tourId, assignmentId);
      if (versions.some((entry) => entry.briefVersion === brief.briefVersion)) {
        const error = new Error("That brief version already exists.");
        error.status = 409;
        throw error;
      }
      versions.push(brief);
      versions.sort((left, right) => left.briefVersion - right.briefVersion);
      await write(tourId, assignmentId, "briefs", { versions });
      return brief;
    },

    async readDirections(tourId) {
      const stored = await readTourDocument(tourId, "directions", { versions: [] });
      return Array.isArray(stored.versions) ? stored.versions : [];
    },

    // The stored tour document. Brief 1 of docs/spec-accounts-artists-tours.md:
    // a tour created through the app lives here in the exact shape
    // parseTourFixture produces, so downstream readers cannot tell the
    // difference. Absent for the demo tour until something writes it.
    async readTour(tourId) {
      return readTourDocument(tourId, "tour", null);
    },
    async createTour(tourId, document) {
      const existing = await readTourDocument(tourId, "tour", null);
      if (existing) {
        const error = new Error("A tour already exists under that name.");
        error.status = 409;
        throw error;
      }
      await writeTourDocument(tourId, "tour", document);
      return document;
    },
    // Tour-level facts, the same shape the Scene record writes. The shape is
    // written twice on purpose for now; extracting it inside this commit would
    // refactor tested code in a change that is about storage. Recorded in
    // docs/deferred-work.md.
    async appendTourFact(tourId, fact) {
      const stored = await readTourDocument(tourId, "record", { facts: [] });
      stored.facts.push({ ...fact, at: fact.at || new Date().toISOString() });
      await writeTourDocument(tourId, "record", stored);
      return fact;
    },
    async readTourFacts(tourId) {
      const stored = await readTourDocument(tourId, "record", { facts: [] });
      return stored.facts;
    },
    async addDirection(tourId, direction) {
      const versions = await this.readDirections(tourId);
      if (versions.some((entry) => entry.version === direction.version)) {
        const error = new Error("That Tour Direction version already exists.");
        error.status = 409;
        throw error;
      }
      versions.push(direction);
      versions.sort((left, right) => left.version - right.version);
      await writeTourDocument(tourId, "directions", { versions });
      return direction;
    },

    async readRequests(tourId) {
      const stored = await readTourDocument(tourId, "requests", { scenes: [] });
      return Array.isArray(stored.scenes) ? stored.scenes : [];
    },

    async addRequest(tourId, request) {
      const scenes = await this.readRequests(tourId);
      if (scenes.some((entry) => entry.id === request.id)) {
        const error = new Error("That Scene request already exists.");
        error.status = 409;
        throw error;
      }
      scenes.push(request);
      await writeTourDocument(tourId, "requests", { scenes });
      return request;
    },
  };
}
