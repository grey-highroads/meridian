import { createBlobBackend, createMemoryBackend } from "../artist/store.js";
import { tourPathFor } from "./store.js";

// The Scene record. One line per thing that happened to this Scene: who did it,
// what they did, which version it was, and when.
//
// It is append-only. There is no update and no delete here on purpose, because
// a record someone can edit answers a different question than the one a tour
// team needs answered. Memory in the pilot is facts and nothing else. Nothing
// in this file interprets, scores, or draws a conclusion.
//
// Until step 4 supplies real identities the actor on every fact is Higher
// Roads, since the app has one shared login and a name it cannot stand behind
// would be worse than a name it can. Recorded in docs/deferred-work.md.

export const RECORD_ACTOR = "Higher Roads";

export { createBlobBackend, createMemoryBackend };

export function createSceneRecord(options = {}) {
  const backend = options.backend || createBlobBackend(options);

  async function readAll(tourId, assignmentId) {
    const body = await backend.read(tourPathFor(tourId, assignmentId, "scene-record"));
    if (body === null || body === undefined) return [];
    const stored = JSON.parse(body);
    return Array.isArray(stored.facts) ? stored.facts : [];
  }

  return {
    async readFacts(tourId, assignmentId) {
      return await readAll(tourId, assignmentId);
    },

    // Everything already written is carried through untouched. The new fact
    // goes on the end.
    async appendFact(tourId, assignmentId, fact) {
      const facts = await readAll(tourId, assignmentId);
      const entry = {
        actor: fact.actor || RECORD_ACTOR,
        action: String(fact.action || "").trim(),
        version: fact.version || null,
        at: fact.at || new Date().toISOString(),
      };
      if (!entry.action) {
        const error = new Error("A fact needs to say what happened.");
        error.status = 400;
        throw error;
      }
      facts.push(entry);
      await backend.write(
        tourPathFor(tourId, assignmentId, "scene-record"),
        JSON.stringify({ facts }, null, 2),
      );
      return entry;
    },
  };
}
