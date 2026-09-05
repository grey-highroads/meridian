// The board review. Job three of Intelligence.
//
// An artboard version has come back and somebody is about to decide whether the
// client sees it. Before that, an admin asks for a second read from the
// artist's side: what the board holds of the record and the direction it was
// briefed against, where it leaves them, and anything it puts near something
// this artist stays away from.
//
// What comes back is three groups:
//
//   alignment, where the board sits with the artist's record and the direction;
//   departure, where it leaves them;
//   prohibition, where it touches something the artist stays away from.
//
// Every entry names the findings it rests on, by id, and only ids the record
// gave it. An entry with no surviving finding is dropped whole, which is the
// rule job two holds and it matters at least as much here: a departure nobody
// can trace would read as a fault in somebody's work.
//
// Nothing here writes a verdict, a score, or a recommendation about presenting.
// Findings inform the person and gate nothing. The renderer has nowhere to put
// an overall conclusion and the model is told not to write one.
//
// The model reads the board itself. The board is a PNG or a JPEG, so the call
// carries an image part alongside the text, the same shape the brain synthesis
// already uses for source images. A version with no readable image is refused
// rather than reviewed from its metadata, because a read of the paperwork
// presented as a read of the work would be worse than no read at all.

import { DEFAULT_MODEL } from "./propose.js";

export { DEFAULT_MODEL };

// The same ceiling job two writes against. Three groups of a handful of entries
// each plus the applied findings list is the same size of readable answer, and
// the model reasons before it writes against this number too.
export const BOARD_REVIEW_TOKEN_CAP = 6000;

export const READABLE_BOARD_TYPES = ["image/png", "image/jpeg"];

const SYSTEM = [
  "You help a live production team read one artboard against everything known about the artist and against the direction the board was briefed from.",
  "You are given the image of the board, the tour's creative direction in the director's own words, the request the Scene was made from, the concept the board was briefed to build, and every finding the artist's approved record holds, each with an id and the sources behind it.",
  "Look at the image. Everything you say about the board describes what is actually in it.",
  "Do two things.",
  "First, pick the findings that actually bear on this board. Expect a handful, not most of them. For each one say in one plain sentence why it belongs here. Leaving a finding out is a real answer.",
  "Second, write the read as three groups.",
  "alignment: where the board sits with the artist's record and with the direction it was briefed against. Say what you see in the board that does it.",
  "departure: where the board leaves the record or the direction. A departure is an observation, not a fault. Say what the board does instead and what that costs or opens up.",
  "prohibition: where the board touches something this artist stays away from. Say what is in the board and which part of the record it runs into.",
  "Every entry names the finding ids it rests on, by id, and only ids you were given. An entry no finding supports does not belong in any group; put it in openQuestions instead.",
  "Never write a verdict, a score, a rating, a percentage, a count, a risk level, or any sentence telling the reader whether to show this board to anyone. The groups are the read and the decision is the reader's.",
  "Write plain language a tour manager would use. No architecture words, no em dashes.",
  "Return JSON only, with no code fence and no preamble, shaped as:",
  '{"appliedFindings":[{"id":"finding-1","why":""}],"alignment":[{"title":"","note":"","restsOn":["finding-1"]}],"departure":[{"title":"","note":"","restsOn":["finding-1"]}],"prohibition":[{"title":"","note":"","restsOn":["finding-1"]}],"openQuestions":[""]}',
].join("\n");

// A job with no subject. The board is still read, against the direction it was
// briefed from, the request, the concept, and whatever the brief said to
// avoid. No artist material and no assumptions about what kind of work this is
// reach the model. Ruled 2026-09-05.
const SUBJECTLESS_SYSTEM = [
  "You help a production team read one artboard against the direction it was briefed from and the concept it was built to make.",
  "You are given the image of the board, the direction for the job in the director's own words, the request the Scene was made from, and the concept the board was briefed to build.",
  "You are given no research about who or what the work is about. Do not invent any, and do not assume what kind of job this is. Nothing you write states a fact about anybody.",
  "Look at the image. Everything you say about the board describes what is actually in it.",
  "Write the read as three groups.",
  "alignment: where the board sits with the direction and with the concept it was briefed to build. Say what you see in the board that does it.",
  "departure: where the board leaves them. A departure is an observation, not a fault. Say what the board does instead and what that costs or opens up.",
  "prohibition: where the board touches something the brief said to avoid. Leave this group empty when the brief said nothing to avoid.",
  "Anything you cannot ground in the direction, the request, the concept, or the brief's avoid list goes in openQuestions.",
  "Never write a verdict, a score, a rating, a percentage, a count, a risk level, or any sentence telling the reader whether to show this board to anyone. The groups are the read and the decision is the reader's.",
  "Write plain language the person who asked would use. No architecture words, no em dashes.",
  "Return JSON only, with no code fence and no preamble, shaped as:",
  '{"alignment":[{"title":"","note":""}],"departure":[{"title":"","note":""}],"prohibition":[{"title":"","note":""}],"openQuestions":[""]}',
].join("\n");

function buildSubjectlessRequest(context, options = {}) {
  const concept = context.chosenConcept || {};
  const text = [
    `Job: ${context.tourName}`,
    `Scene: ${context.sceneTitle}`,
    `Artboard version ${context.artboardVersion}, built against brief version ${context.briefVersion}.`,
    "",
    `The direction for this job, version ${context.directionVersion}, stored as the director gave it:`,
    context.direction.words,
    "",
    "What was asked for:",
    context.request,
    "",
    "The concept the board was briefed to build:",
    [concept.title, concept.idea].filter(Boolean).join("\n"),
    ...(context.conceptSummary ? ["", "How production said they read the brief:", context.conceptSummary] : []),
    ...(context.avoid && context.avoid.length
      ? ["", "What the brief said to avoid:", context.avoid.map((entry) => `- ${entry}`).join("\n")]
      : ["", "The brief named nothing to avoid."]),
  ].join("\n");
  return {
    model: options.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: SUBJECTLESS_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text },
          { type: "image_url", image_url: { url: context.board.dataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: options.maxCompletionTokens || BOARD_REVIEW_TOKEN_CAP,
  };
}

export function buildBoardReviewRequest(context, options = {}) {
  if (context.hasSubject === false) return buildSubjectlessRequest(context, options);
  const findings = context.findings.map((entry) => ({
    id: entry.findingId,
    part: entry.facetName,
    text: entry.text,
    sources: entry.independentSourceCount,
    tiers: entry.tiers,
  }));
  const concept = context.chosenConcept || {};
  const text = [
    `Tour: ${context.tourName}`,
    `Scene: ${context.sceneTitle}`,
    `Artboard version ${context.artboardVersion}, built against brief version ${context.briefVersion}.`,
    "",
    `Tour direction, version ${context.directionVersion}, stored as the director gave it:`,
    context.direction.words,
    "",
    "What the tour manager asked for:",
    context.request,
    "",
    "The concept the board was briefed to build:",
    [concept.title, concept.idea, concept.whyThisArtist].filter(Boolean).join("\n"),
    "",
    ...(context.conceptSummary ? ["How production said they read the brief:", context.conceptSummary, ""] : []),
    ...(context.avoid && context.avoid.length ? ["What the brief said to avoid:", context.avoid.map((entry) => `- ${entry}`).join("\n"), ""] : []),
    `Every finding the artist's approved record holds for this Scene, ${findings.length} of them:`,
    JSON.stringify(findings, null, 2),
  ].join("\n");
  return {
    model: options.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text },
          { type: "image_url", image_url: { url: context.board.dataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: options.maxCompletionTokens || BOARD_REVIEW_TOKEN_CAP,
  };
}

export const GROUPS = ["alignment", "departure", "prohibition"];

// An entry has to rest on a finding when findings were given, because a
// departure nobody can trace would read as a fault in somebody's work. On a
// job with no subject there are no findings to rest on, and the direction, the
// concept, and the brief's avoid list are what ground the read instead.
function group(parsed, name, known, grounded) {
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
    .filter((row) => row.title && (!grounded || row.restsOn.length));
}

export function checkBoardReview(parsed, context) {
  const grounded = context.hasSubject !== false;
  const byId = new Map(context.findings.map((entry) => [entry.findingId, entry]));
  const known = new Set(byId.keys());
  const named = Array.isArray(parsed.appliedFindings) ? parsed.appliedFindings : [];
  const groups = {};
  for (const name of GROUPS) groups[name] = group(parsed, name, known, grounded);
  if (!GROUPS.some((name) => groups[name].length)) {
    throw new Error(grounded
      ? "The read came back with nothing the artist's record supports."
      : "The read came back with nothing to show.");
  }
  return {
    ...groups,
    appliedFindings: named
      .filter((entry) => known.has(entry?.id))
      .map((entry) => ({ ...byId.get(entry.id), why: String(entry.why || "").trim() })),
    droppedFindings: named.filter((entry) => !known.has(entry?.id)).map((entry) => String(entry?.id)),
    openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.map(String) : [],
  };
}

export async function readBoard(context, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("A board cannot be read until OPENAI_API_KEY is set on this deployment.");
    error.status = 503;
    throw error;
  }
  const fetchImpl = options.fetchImpl || fetch;
  const startedAt = Date.now();
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildBoardReviewRequest(context, options)),
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
    "board-review model call",
    `${Date.now() - startedAt}ms`,
    `${body?.usage?.completion_tokens ?? "unknown"} completion tokens`,
    `cap ${options.maxCompletionTokens || BOARD_REVIEW_TOKEN_CAP}`,
    `finish ${choice?.finish_reason || "unknown"}`,
  ].join(", "));
  if (choice?.finish_reason === "length") {
    const error = new Error("The read ran too long and stopped before it finished. Ask again.");
    error.status = 502;
    throw error;
  }
  const content = choice?.message?.content;
  if (!content) throw new Error("The model returned nothing to read.");
  return checkBoardReview(JSON.parse(content), context);
}
