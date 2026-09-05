import { createBlobBackend, createMemoryBackend } from "../artist/store.js";

// What the artist's intelligence produced when somebody asked it something.
//
// Four jobs will write here. They ask different questions of the same brain, so
// they share one record: what was asked about, which version of the tour
// direction the answer was read against, when it ran, which approved brain it
// came from, the answer, and the evidence the answer rests on. A job adds its
// own answer under `result` and changes nothing else.
//
// Runs chain. A second run is appended and the first is left exactly as it was,
// because an idea somebody already acted on is a record of what the brain said
// that day, and rewriting it would remove the only trace of why the work went
// the way it did.
//
// Nothing here writes into the artist layer. Every job reads the brain and
// leaves it alone.

const ROOT = "brand-world-system/clients";

export const SCENE_IDEAS = "scene-ideas";
export const DIRECTION_READ = "direction-read";
export const BOARD_REVIEW = "board-review";
export const TOUR_STOPS = "tour-stops";

export const JOBS = [SCENE_IDEAS, DIRECTION_READ, BOARD_REVIEW, TOUR_STOPS];

function requireAccount(accountId) {
  if (!accountId) {
    const error = new Error("An intelligence path needs the account it belongs to.");
    error.status = 400;
    throw error;
  }
  return accountId;
}

// One path shape for every job. The subject is whatever the job was asked
// about: a Scene for ideas, a direction version for the direction read, an
// artboard version for a board review, the tour itself for the stops.
export function analysisPathFor(job, tourId, subjectId, accountId) {
  return `${ROOT}/${requireAccount(accountId)}/tours/${tourId}/intelligence/${job}/${subjectId}.json`;
}

function versionSubjectId(version) {
  return `v${String(Number(version) || 0).padStart(2, "0")}`;
}

// The direction read's subject is a version of the tour direction. Runs are
// kept per version, so a read made against V02 stays readable after the
// director's words move to V03 and the run numbering for V03 starts again at
// one. Both the writer and the reader take the id from here.
export function directionSubjectId(version) {
  return versionSubjectId(version);
}

// The board review's subject is one artboard version of one Scene, so its id
// names both. Runs chain inside a version for the same reason the direction
// read's do: a read of V01 stays readable after V02 comes back, and V02 starts
// its own run numbering at one.
export function boardSubjectId(assignmentId, version) {
  return `${assignmentId}-${versionSubjectId(version)}`;
}

export function buildAnalysis(entry = {}) {
  const ranAt = entry.ranAt || new Date().toISOString();
  return {
    job: entry.job,
    runId: entry.runId || `run-${Date.parse(ranAt) || Date.now()}`,
    run: Number(entry.run) || 1,
    ranAt,
    ranBy: entry.ranBy || null,
    artistId: entry.artistId || null,
    subject: entry.subject || null,
    directionVersion: entry.directionVersion ?? null,
    // Which approved brain the answer came from. The brain has no version
    // number of its own yet, so the date it was approved is the reference.
    // Recorded in docs/deferred-work.md.
    brainApprovedAt: entry.brainApprovedAt || null,
    // What the run had to read, in plain sentences. A run on a job with no
    // subject snapshots no evidence, and an empty evidence list on its own
    // reads as research holding nothing rather than as no research at all. A
    // run stored before this field existed carries none and the reader falls
    // back to the approval date beside it.
    readFrom: Array.isArray(entry.readFrom) ? entry.readFrom : [],
    result: entry.result || {},
    evidence: Array.isArray(entry.evidence) ? entry.evidence : [],
  };
}

export function createAnalysisStore(options = {}) {
  const backend = options.backend || createBlobBackend(options);
  const accountId = requireAccount(options.accountId);

  async function readAll(job, tourId, subjectId) {
    const body = await backend.read(analysisPathFor(job, tourId, subjectId, accountId));
    if (body === null || body === undefined) return [];
    const stored = JSON.parse(body);
    return Array.isArray(stored.analyses) ? stored.analyses : [];
  }

  return {
    backend,
    accountId,

    async readAnalyses(job, tourId, subjectId) {
      return await readAll(job, tourId, subjectId);
    },

    // The run number is worked out from what is stored rather than passed in,
    // so two callers cannot both write run two.
    async appendAnalysis(job, tourId, subjectId, analysis) {
      const analyses = await readAll(job, tourId, subjectId);
      const entry = { ...analysis, run: analyses.length + 1 };
      const next = [...analyses, entry];
      await backend.write(
        analysisPathFor(job, tourId, subjectId, accountId),
        JSON.stringify({ analyses: next }, null, 2),
      );
      return { analysis: entry, analyses: next };
    },
  };
}

export { createBlobBackend, createMemoryBackend };
