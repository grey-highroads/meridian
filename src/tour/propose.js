// Concept proposals for one assignment.
//
// The brain proposes and never decides. What comes back is two or three
// directions a creative person can react to, each carrying the findings it
// rhymes with, so anyone reading it can open a proposal and see what it rests
// on. No prompts are written here. A prompt is execution instructions and that
// is Jim's craft.
//
// Nothing is stored. A proposal is a thing a person reads and then shapes into
// a brief. It becomes a record when someone chooses one.

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6";

const SYSTEM = [
  "You help a live production team explore what is possible inside one artist's world.",
  "You are given a tour's creative direction in the director's own words, one request from the tour manager in theirs, and every finding the artist brain holds for this identity, each with an id and the sources behind it.",
  "Do two things.",
  "First, pick the findings that actually bear on this request. Expect a handful, not most of them. For each one say in one plain sentence why it belongs here. Leaving a finding out is a real answer; a long list is worse than a short one.",
  "Second, propose two or three concept directions for the request. Each one is an idea a creative person can react to, not a plan and not instructions for how to build anything.",
  "A concept describes what appears on the tour's surfaces and how it develops across the song. It sits with lighting and IMAG around a live band, so say what the audience sees on the surfaces and what the band is doing while it happens.",
  "Write concepts a video content team could brief from. Never describe an effect the listed surfaces cannot produce.",
  "Every proposal names the finding ids it rhymes with, by id, and only ids you were given. Never state a fact about the artist that no finding supports. If something would help and nothing supports it, put it in openQuestions instead of asserting it.",
  "Say what each proposal would ask of the production, and where it might miss the direction.",
  "Say what the brand avoids that bears on this request, in avoidNotes, drawing on the findings for it.",
  "Write plain language a tour manager would use. No architecture words, no scores, no verdicts, no em dashes.",
  "Return JSON only, with no code fence and no preamble, shaped as:",
  '{"appliedFindings":[{"id":"finding-1","why":""}],"proposals":[{"title":"","idea":"","whyThisArtist":"","rhymesWith":["finding-1"],"asksOfProduction":"","whereItMightMiss":""}],"avoidNotes":[""],"openQuestions":[""]}',
].join("\n");

export function buildProposalRequest(context, options = {}) {
  const findings = context.findings.map((entry) => ({
    id: entry.findingId,
    part: entry.facetName,
    text: entry.text,
    sources: entry.independentSourceCount,
    tiers: entry.tiers,
  }));
  const setup = context.productionSetup;
  const exceptions = setup && setup.venueExceptions ? setup.venueExceptions : [];
  const user = [
    "Tour direction, version " + context.directionVersion + ", stored as the director gave it:",
    context.direction.words,
    "",
    "What the tour manager is asking for:",
    context.request,
    "",
    // The surfaces come before the findings, because a concept that the rig
    // cannot show is not a concept for this tour.
    ...(setup ? [
      `What the show plays on, production setup version ${setup.version}, stored as production gave it:`,
      setup.words,
      "",
    ] : []),
    ...(exceptions.length ? [
      "Dates where the rig differs:",
      exceptions.map((entry) => `- ${entry.date}, ${entry.venue}. ${entry.text}`).join("\n"),
      "",
    ] : []),
    `Every finding the brain holds for the ${context.identity} identity, ${findings.length} of them:`,
    JSON.stringify(findings, null, 2),
  ].join("\n");
  return {
    model: options.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  };
}

// Anything the model names that was not given to it is dropped rather than
// shown. A proposal that cites a finding the brain does not hold would read as
// evidence and would not be.
export function checkProposals(parsed, context) {
  const byId = new Map(context.findings.map((entry) => [entry.findingId, entry]));
  const known = new Set(byId.keys());
  const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
  if (!proposals.length) throw new Error("The brain returned no concept directions.");
  const applied = (Array.isArray(parsed.appliedFindings) ? parsed.appliedFindings : [])
    .filter((entry) => known.has(entry?.id))
    .map((entry) => ({ ...byId.get(entry.id), why: String(entry.why || "").trim() }));
  return {
    appliedFindings: applied,
    proposals: proposals.map((proposal) => {
      const cited = Array.isArray(proposal.rhymesWith) ? proposal.rhymesWith : [];
      const kept = cited.filter((id) => known.has(id));
      return {
        title: String(proposal.title || "").trim(),
        idea: String(proposal.idea || "").trim(),
        whyThisArtist: String(proposal.whyThisArtist || "").trim(),
        rhymesWith: kept,
        droppedCitations: cited.filter((id) => !known.has(id)),
        asksOfProduction: String(proposal.asksOfProduction || "").trim(),
        whereItMightMiss: String(proposal.whereItMightMiss || "").trim(),
      };
    }),
    avoidNotes: Array.isArray(parsed.avoidNotes) ? parsed.avoidNotes.map(String) : [],
    droppedFindings: (Array.isArray(parsed.appliedFindings) ? parsed.appliedFindings : [])
      .filter((entry) => !known.has(entry?.id))
      .map((entry) => String(entry?.id)),
    openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.map(String) : [],
  };
}

export async function proposeConcepts(context, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("The brain cannot propose concepts until OPENAI_API_KEY is set on this deployment.");
    error.status = 503;
    throw error;
  }
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildProposalRequest(context, options)),
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
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error("The model returned nothing to read.");
  return checkProposals(JSON.parse(content), context);
}
