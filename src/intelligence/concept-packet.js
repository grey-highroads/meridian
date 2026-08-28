// The concept packet. What an admin hands to a creative after asking the
// artist's intelligence for ideas on a Scene.
//
// It is a plain document a person reads. It is not the production artifact and
// it never governs anything across the seam, so it does not carry that name
// anywhere: not in the copy, not in the filename, not in the identifiers here.
// The frozen versioned document that governs production owns that word, and one
// word naming two things in the same record would cost more than it saves.
//
// Everything in the packet came from the stored analysis. Nothing is worked out
// again at download time, so a packet downloaded in October says what the brain
// said in August.

function pad(value) {
  return String(Number(value) || 0).padStart(2, "0");
}

function day(value) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return "not recorded";
  return parsed.toISOString().slice(0, 10);
}

// What a finding rests on, in the words the intake file counted. The individual
// source rows are not linked to findings in this intake run, so the count and
// the tiers are the whole trail there is, and the packet says so rather than
// implying more.
export function sourceLine(entry) {
  if (!entry || !entry.independentSourceCount) return "Source count not recorded";
  const plural = entry.independentSourceCount === 1 ? "source" : "sources";
  const tiers = (entry.tiers || []).join(", ");
  const count = `${entry.independentSourceCount} independent ${plural}`;
  return tiers ? `${count}, from tier ${tiers}` : count;
}

function evidenceBlock(evidence) {
  if (!evidence.length) return ["Nothing in the artist's record was cited for these ideas."];
  return evidence.map((entry) => {
    const lines = [`- ${String(entry.text || "").replace(/\*\*/g, "").trim()}`];
    lines.push(`  Rests on ${sourceLine(entry).toLowerCase()}.`);
    if (entry.why) lines.push(`  Why it belongs here: ${entry.why}`);
    return lines.join("\n");
  });
}

export function conceptPacketFilename(analysis) {
  const subject = (analysis && analysis.subject) || {};
  const scene = String(subject.sceneId || "scene").trim();
  return `concept-packet-${scene}-run-${pad(analysis && analysis.run)}.txt`;
}

export function renderConceptPacket(analysis) {
  const subject = (analysis && analysis.subject) || {};
  const result = (analysis && analysis.result) || {};
  const directions = Array.isArray(result.directions) ? result.directions : [];
  const evidence = Array.isArray(analysis && analysis.evidence) ? analysis.evidence : [];
  const byId = new Map(evidence.map((entry) => [entry.findingId, entry]));

  const lines = [
    "Concept packet",
    "Meridian, by Higher Roads",
    "",
    `Scene: ${subject.sceneTitle || subject.sceneId || "not recorded"}`,
    `Tour: ${subject.tourName || subject.tourId || "not recorded"}`,
    `Tour direction version: V${pad(analysis && analysis.directionVersion)}`,
    `Generated: ${day(analysis && analysis.ranAt)}`,
    `Artist knowledge approved: ${day(analysis && analysis.brainApprovedAt)}`,
    `Run: ${pad(analysis && analysis.run)}`,
    "",
    "These are starting points, not decisions. Nothing here has been approved.",
    "",
  ];

  directions.forEach((direction, index) => {
    lines.push(`Direction ${pad(index + 1)}. ${direction.title || "Untitled"}`);
    lines.push("");
    if (direction.idea) lines.push(direction.idea, "");
    if (direction.whyThisArtist) lines.push(`Why this artist: ${direction.whyThisArtist}`, "");
    if (direction.asksOfProduction) lines.push(`What it asks of production: ${direction.asksOfProduction}`, "");
    if (direction.whereItMightMiss) lines.push(`Where it might miss: ${direction.whereItMightMiss}`, "");
    const cited = (direction.rhymesWith || []).map((id) => byId.get(id)).filter(Boolean);
    if (cited.length) {
      lines.push("What it rests on in the artist's history:");
      lines.push(...evidenceBlock(cited));
      lines.push("");
    }
  });

  const avoid = Array.isArray(result.avoidNotes) ? result.avoidNotes : [];
  if (avoid.length) {
    lines.push("What this artist stays away from", "");
    lines.push(...avoid.map((entry) => `- ${entry}`));
    lines.push("");
  }

  const questions = Array.isArray(result.openQuestions) ? result.openQuestions : [];
  if (questions.length) {
    lines.push("Open questions", "");
    lines.push(...questions.map((entry) => `- ${entry}`));
    lines.push("");
  }

  lines.push("Everything these ideas rest on", "");
  lines.push(...evidenceBlock(evidence));
  lines.push("");

  return lines.join("\n");
}
