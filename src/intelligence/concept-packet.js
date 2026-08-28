// The concept packet. What an admin hands to a creative after asking the
// artist's intelligence for ideas on a Scene.
//
// It is a plain document a person reads. It is not the production artifact and
// it never governs anything across the seam, so it does not carry that name
// anywhere: not in the copy, not in the filename, not in the identifiers here.
// The frozen versioned document that governs production owns that word, and one
// word naming two things in the same record would cost more than it saves.
//
// A packet covers one idea. A person picks an idea and takes that idea away, so
// the whole run travelling as one file was giving them three ideas to hand over
// when they wanted one. Every packet still carries the run's lineage, because an
// idea that arrives without the Scene, the direction version, and the dates
// behind it cannot be traced back to what the system knew.
//
// Everything comes from the stored analysis. Nothing is worked out again at
// download time, so a packet downloaded in October says what the artist's
// intelligence said in August.

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

export function evidenceLines(evidence) {
  return evidence.map((entry) => {
    const lines = [`- ${String(entry.text || "").replace(/\*\*/g, "").trim()}`];
    lines.push(`  Rests on ${sourceLine(entry).toLowerCase()}.`);
    if (entry.why) lines.push(`  Why it belongs here: ${entry.why}`);
    return lines.join("\n");
  });
}

// The lineage every packet carries, whichever idea it holds.
function lineage(analysis) {
  const subject = (analysis && analysis.subject) || {};
  return [
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
  ];
}

export function directionsOf(analysis) {
  const result = (analysis && analysis.result) || {};
  return Array.isArray(result.directions) ? result.directions : [];
}

// The one idea a person asked for, resolved from the stored run rather than
// from anything the browser sent back.
export function directionAt(analysis, index) {
  const directions = directionsOf(analysis);
  const wanted = Number(index);
  if (!Number.isInteger(wanted) || wanted < 0 || wanted >= directions.length) {
    const error = new Error("We couldn't find that idea.");
    error.status = 404;
    throw error;
  }
  return directions[wanted];
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "idea";
}

export function conceptPacketFilename(analysis, index) {
  const subject = (analysis && analysis.subject) || {};
  const scene = slug(subject.sceneId || "scene");
  const direction = directionAt(analysis, index);
  return `concept-packet-${scene}-run-${pad(analysis && analysis.run)}-${pad(Number(index) + 1)}-${slug(direction.title)}.txt`;
}

export function renderConceptPacket(analysis, index) {
  const direction = directionAt(analysis, index);
  const evidence = Array.isArray(analysis && analysis.evidence) ? analysis.evidence : [];
  const byId = new Map(evidence.map((entry) => [entry.findingId, entry]));
  const result = (analysis && analysis.result) || {};

  const lines = [
    ...lineage(analysis),
    `Idea ${pad(Number(index) + 1)} of ${pad(directionsOf(analysis).length)}`,
    "",
    "This is a starting point, not a decision. Nothing here has been approved.",
    "",
    direction.title || "Untitled",
    "",
  ];

  if (direction.idea) lines.push(direction.idea, "");
  if (direction.whyThisArtist) lines.push(`Why this artist: ${direction.whyThisArtist}`, "");
  if (direction.asksOfProduction) lines.push(`What it asks of production: ${direction.asksOfProduction}`, "");
  if (direction.whereItMightMiss) lines.push(`Where it might miss: ${direction.whereItMightMiss}`, "");

  const cited = (direction.rhymesWith || []).map((id) => byId.get(id)).filter(Boolean);
  if (cited.length) {
    lines.push("What it rests on in the artist's history", "");
    lines.push(...evidenceLines(cited));
    lines.push("");
  }

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

  return lines.join("\n");
}
