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
// The actor comes from the signed session and carries the person's name and
// the role they were carrying at the time. Facts written before people could
// sign in name Higher Roads and keep naming it, because a record rewritten to
// look better answers a different question than the one a tour team needs
// answered.

export const RECORD_ACTOR = "Higher Roads";

export { createBlobBackend, createMemoryBackend };

export function createSceneRecord(options = {}) {
  const backend = options.backend || createBlobBackend(options);
  const accountId = options.accountId || null;

  async function readAll(tourId, assignmentId) {
    const body = await backend.read(tourPathFor(tourId, assignmentId, "scene-record", accountId));
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
        role: fact.role || null,
        action: String(fact.action || "").trim(),
        version: fact.version || null,
        // Who the actor was acting for, when the action establishes it, and
        // which route the work took. Both stay empty when the action does not
        // establish them. A person's role never fills either one in.
        onBehalfOf: fact.onBehalfOf || null,
        path: fact.path || null,
        at: fact.at || new Date().toISOString(),
      };
      if (!entry.action) {
        const error = new Error("A fact needs to say what happened.");
        error.status = 400;
        throw error;
      }
      facts.push(entry);
      await backend.write(
        tourPathFor(tourId, assignmentId, "scene-record", accountId),
        JSON.stringify({ facts }, null, 2),
      );
      return entry;
    },
  };
}
