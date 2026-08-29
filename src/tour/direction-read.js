// The direction read. Job two of Intelligence.
//
// A creative director's words have arrived, or moved to a new version. Before
// Scenes get briefed against them, an admin asks what the tour direction looks
// like held up against everything the artist's approved record holds.
//
// What comes back is written, never scored. Three clusters:
//
//   continuity, where the direction is in lockstep with who this artist has been;
//   departure, where it leaves the record;
//   echo, older themes and imagery the direction quietly rhymes with, including
//   the ones a knowing fan would catch.
//
// Every entry names the findings it rests on, by id, and only ids the brain
// gave it. An entry left with no surviving finding is dropped rather than
// shown, because a read with no trail is a guess and the surface does not carry
// guesses. Nothing here writes a summary verdict. Whether the direction is a
// departure or in lockstep is the person's read of the clusters, and a sentence
// from the model saying so would be the score this job is not allowed to
// produce.
//
// The call follows propose-concepts rather than inventing a second path to the
// same provider.

import { DEFAULT_MODEL } from "./propose.js";

export { DEFAULT_MODEL };

// The same reasoning that governs the proposal cap governs this one. Three
// clusters of a handful of entries each, plus the applied findings list, sits
// near the same size of readable answer, and the model reasons before it writes
// against the same ceiling.
export const DIRECTION_READ_TOKEN_CAP = 6000;

const SYSTEM = [
  "You help a live production team understand a tour's creative direction against everything known about the artist.",
  "You are given the tour's creative direction in the director's own words, at a named version, and every finding the artist's approved record holds, each with an id and the sources behind it.",
  "Do two things.",
  "First, pick the findings that actually bear on this direction. Expect a handful, not most of them. For each one say in one plain sentence why it belongs here. Leaving a finding out is a real answer.",
  "Second, write the read as three groups.",
  "continuity: where the direction is in lockstep with who this artist has been.",
  "departure: where the direction leaves the record. A departure is a fact about the record, not a fault. Say what it leaves behind and what that costs or opens up.",
  "echo: older themes and imagery the direction quietly rhymes with, including the ones only a fan who knows the catalog would catch. Say what the echo is and where it comes from.",
  "Every entry names the finding ids it rests on, by id, and only ids you were given. An entry no finding supports does not belong in any group; put it in openQuestions instead.",
  "Never write a verdict, a score, a rating, a percentage, a count of how aligned the direction is, or a sentence that tells the reader what to conclude overall. The groups are the read.",
  "Write plain language a tour manager would use. No architecture words, no em dashes.",
  "Return JSON only, with no code fence and no preamble, shaped as:",
  '{"appliedFindings":[{"id":"finding-1","why":""}],"continuity":[{"title":"","note":"","restsOn":["finding-1"]}],"departure":[{"title":"","note":"","restsOn":["finding-1"]}],"echo":[{"title":"","note":"","restsOn":["finding-1"]}],"openQuestions":[""]}',
].join("\n");

export function buildDirectionReadRequest(context, options = {}) {
  const findings = context.findings.map((entry) => ({
    id: entry.findingId,
    part: entry.facetName,
    text: entry.text,
    sources: entry.independentSourceCount,
    tiers: entry.tiers,
  }));
  const user = [
    `Tour: ${context.tourName}`,
    "",
    `Tour direction, version ${context.directionVersion}, stored as the director gave it:`,
    context.direction.words,
    "",
    `Every finding the artist's approved record holds, ${findings.length} of them:`,
    JSON.stringify(findings, null, 2),
  ].join("\n");
  return {
    model: options.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: options.maxCompletionTokens || DIRECTION_READ_TOKEN_CAP,
  };
}

export const CLUSTERS = ["continuity", "departure", "echo"];

function cluster(parsed, name, known) {
  const rows = Array.isArray(parsed[name]) ? parsed[name] : [];
  return rows
    .map((row) => {
      const cited = Array.isArray(row && row.restsOn) ? row.restsOn : [];
      return {
        title: String((row && row.title) || "").trim(),
        note: String((row && row.note) || "").trim(),
        restsOn: cited.filter((id) => known.has(id)),
        droppedCitations: cited.filter((id) => !known.has(id)),
      };
    })
    // An entry the record cannot support does not appear. This is the rule the
    // surface already holds for ideas, applied where it matters more: a
    // departure nobody can trace would read as a finding about the direction.
    .filter((row) => row.title && row.restsOn.length);
}

export function checkDirectionRead(parsed, context) {
  const byId = new Map(context.findings.map((entry) => [entry.findingId, entry]));
  const known = new Set(byId.keys());
  const named = Array.isArray(parsed.appliedFindings) ? parsed.appliedFindings : [];
  const clusters = {};
  for (const name of CLUSTERS) clusters[name] = cluster(parsed, name, known);
  if (!CLUSTERS.some((name) => clusters[name].length)) {
    throw new Error("The read came back with nothing the artist's record supports.");
  }
  return {
    ...clusters,
    appliedFindings: named
      .filter((entry) => known.has(entry?.id))
      .map((entry) => ({ ...byId.get(entry.id), why: String(entry.why || "").trim() })),
    droppedFindings: named.filter((entry) => !known.has(entry?.id)).map((entry) => String(entry?.id)),
    openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.map(String) : [],
  };
}

export async function readDirection(context, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("The direction cannot be read until OPENAI_API_KEY is set on this deployment.");
    error.status = 503;
    throw error;
  }
  const fetchImpl = options.fetchImpl || fetch;
  const startedAt = Date.now();
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildDirectionReadRequest(context, options)),
  });
  if (!response.ok) {
    let message = `The model request failed with status ${response.status}.`;
    try {
      const body = await response.json();
      if (body?.error?.message) message = body.error.message;
    } catch {}
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const body = await response.json();
  const choice = body?.choices?.[0];
  const logger = options.logger || console.log;
  logger([
    "direction-read model call",
    `${Date.now() - startedAt}ms`,
    `${body?.usage?.completion_tokens ?? "unknown"} completion tokens`,
    `cap ${options.maxCompletionTokens || DIRECTION_READ_TOKEN_CAP}`,
    `finish ${choice?.finish_reason || "unknown"}`,
  ].join(", "));
  if (choice?.finish_reason === "length") {
    const error = new Error("The read ran too long and stopped before it finished. Ask again.");
    error.status = 502;
    throw error;
  }
  const content = choice?.message?.content;
  if (!content) throw new Error("The model returned nothing to read.");
  return checkDirectionRead(JSON.parse(content), context);
}
