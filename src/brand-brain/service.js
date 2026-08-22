import { synthesizeWithChatCompletions } from "./chat-completions-provider.js";
import { normalizeSourcesForSynthesis } from "./source-normalizer.js";
import { enrichUrlSources } from "./source-reader.js";

function persistedSources(sources) {
  return sources.map((source) => ({
    ...source,
    files: (source.files ?? []).map(({ data: _data, ...file }) => file),
  }));
}

export function selectApprovedBaseline(stored) {
  return stored?.approvedResult || (stored?.brain?.artifactStatus === "ready" ? stored.result : null) || null;
}

export function mergeIncrementalSources(previousSources = [], incomingSources = []) {
  const incomingIds = new Set(incomingSources.map((source) => source.id));
  return [...previousSources.filter((source) => !incomingIds.has(source.id)), ...incomingSources];
}

export async function saveBrandBrainSnapshot(snapshot, store) {
  const saved = { ...snapshot, savedAt: new Date().toISOString() };
  await store.write(saved);
  return saved;
}

export async function synthesizeBrandBrain(body, options) {
  const store = options.store;
  const fetchImpl = options.fetchImpl || fetch;
  const synthesize = options.synthesize || synthesizeWithChatCompletions;
  if (!Array.isArray(body.sources) || body.sources.length === 0) {
    const error = new Error("Add at least one source before building the Brand Brain.");
    error.status = 400;
    throw error;
  }
  if (body.sources.some((source) => source.intakeVersion === "single-source-v1" && (source.files?.length || 0) > 1)) {
    const error = new Error("Each source can contain only one uploaded file.");
    error.status = 400;
    throw error;
  }
  const uploadedBytes = body.sources.reduce(
    (total, source) => total + (source.files || []).reduce((sum, file) => sum + Number(file.size || 0), 0),
    0,
  );
  if (uploadedBytes > 40 * 1024 * 1024) {
    const error = new Error("One synthesis can contain up to 40 MB of uploaded source files.");
    error.status = 413;
    throw error;
  }

  const incremental = body.mode === "incremental";
  // A dry run computes the candidate and returns it without touching stored
  // state. It exists so a synthesis can be evaluated without persisting one,
  // which no other path allows.
  const dryRun = body.dryRun === true;
  const stored = await store.read();
  const baseline = selectApprovedBaseline(stored);
  // After the first approval there is no full synthesis. The brain changes only
  // by integrating sources, each change ruled by a person, so a request that is
  // not incremental is refused here before anything is read or synthesized.
  // Ruled 2026-08-21; see docs/meridian-thesis-and-architecture.md.
  if (!incremental && baseline) {
    const error = new Error("This artist already has an approved brain. Add sources to propose changes to it.");
    error.status = 409;
    throw error;
  }
  if (incremental && !baseline) {
    const error = new Error("The approved Brand Brain baseline could not be found. Reopen the approved version before preparing this update.");
    error.status = 409;
    throw error;
  }

  const incomingSources = await normalizeSourcesForSynthesis(await enrichUrlSources(body.sources, fetchImpl), {
    readStoredFile: store.readSourceFile?.bind(store),
  });
  const previousSources = incremental && Array.isArray(stored?.sources) ? stored.sources : [];
  const sources = incremental ? mergeIncrementalSources(previousSources, incomingSources) : incomingSources;
  const synthesis = await synthesize({
    apiKey: options.env.OPENAI_API_KEY,
    model: options.env.OPENAI_MODEL,
    sources: incomingSources,
    baseline,
    baselineVersion: body.baselineVersion,
    fetchImpl,
  });
  const saved = {
    kind: incremental ? "incremental-synthesis" : "synthesis",
    synthesisRequestId: typeof body.requestId === "string" ? body.requestId.slice(0, 120) : null,
    sources: persistedSources(sources),
    result: synthesis.result,
    approvedResult: baseline,
    baselineVersion: incremental ? body.baselineVersion || stored?.brain?.approvedVersion || stored?.brain?.artifactVersion || null : null,
    responseId: synthesis.responseId,
    model: synthesis.model,
    usage: synthesis.usage,
    brain: incremental
      ? {
          ...(stored?.brain || {}),
          stage: "review",
          processingComplete: true,
          revisionPending: true,
          candidateBaseVersion: body.baselineVersion || stored?.brain?.approvedVersion || stored?.brain?.artifactVersion || 0,
        }
      : undefined,
    savedAt: new Date().toISOString(),
  };

  if (dryRun) {
    // Returns before any write, so stored state is untouched. The flag travels
    // back on the payload so a captured result cannot be mistaken for something
    // the system stored.
    return { ...saved, dryRun: true };
  }

  await store.write(saved);
  return saved;
}
