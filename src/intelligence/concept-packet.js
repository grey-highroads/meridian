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

import { findingStatement } from "../artist/finding.js";

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
    const lines = [`- ${findingStatement(entry.text)}`];
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

const DIRECTION_GROUPS = [
  { key: "continuity", heading: "What the direction keeps" },
  { key: "departure", heading: "Where it leaves the record" },
  { key: "echo", heading: "What it echoes" },
];

const BOARD_GROUPS = [
  { key: "alignment", heading: "Where it matches this artist's history" },
  { key: "departure", heading: "Where it goes somewhere new" },
  { key: "prohibition", heading: "What this artist stays away from" },
];

function readLineage(analysis, title, objectLines = []) {
  const subject = (analysis && analysis.subject) || {};
  return [
    title,
    "Meridian, by Higher Roads",
    "",
    `Tour: ${subject.tourName || subject.tourId || "not recorded"}`,
    ...objectLines,
    `Tour direction version: V${pad(analysis && analysis.directionVersion)}`,
    `Generated: ${day(analysis && analysis.ranAt)}`,
    `Artist knowledge approved: ${day(analysis && analysis.brainApprovedAt)}`,
    `Run: ${pad(analysis && analysis.run)}`,
    "",
  ];
}

function entryAt(analysis, groups, groupKey, index) {
  const group = groups.find((entry) => entry.key === String(groupKey || ""));
  const entries = group && Array.isArray((analysis.result || {})[group.key])
    ? analysis.result[group.key]
    : [];
  const wanted = Number(index);
  if (!group || !Number.isInteger(wanted) || wanted < 0 || wanted >= entries.length) {
    const error = new Error("We couldn't find that observation.");
    error.status = 404;
    throw error;
  }
  return { group, entry: entries[wanted], index: wanted };
}

function citedEvidence(analysis, entry) {
  const evidence = Array.isArray(analysis && analysis.evidence) ? analysis.evidence : [];
  const byId = new Map(evidence.map((row) => [row.findingId, row]));
  return (entry.restsOn || []).map((id) => byId.get(id)).filter(Boolean);
}

function observationLines(analysis, entry, number = null) {
  const title = number === null ? entry.title : `${pad(number + 1)}. ${entry.title}`;
  const lines = [title || "Untitled", ""];
  if (entry.note) lines.push(entry.note, "");
  const evidence = citedEvidence(analysis, entry);
  if (evidence.length) {
    lines.push("What this rests on in the artist's history", "");
    lines.push(...evidenceLines(evidence), "");
  }
  return lines;
}

function wholeReadLines(analysis, groups) {
  const result = (analysis && analysis.result) || {};
  const lines = [];
  for (const group of groups) {
    const entries = Array.isArray(result[group.key]) ? result[group.key] : [];
    if (!entries.length) continue;
    lines.push(group.heading, "");
    entries.forEach((entry, index) => lines.push(...observationLines(analysis, entry, index)));
  }
  const questions = Array.isArray(result.openQuestions) ? result.openQuestions : [];
  if (questions.length) {
    lines.push("Open questions", "", ...questions.map((entry) => `- ${entry}`), "");
  }
  return lines;
}

function entrySuffix(analysis, groups, scope) {
  if (!scope) return "";
  const selected = entryAt(analysis, groups, scope.groupKey, scope.entryIndex);
  return `-${slug(selected.group.key)}-${pad(selected.index + 1)}-${slug(selected.entry.title)}`;
}

export function directionReadFilename(analysis, scope = null) {
  const subject = (analysis && analysis.subject) || {};
  return `direction-read-${slug(subject.tourId || "tour")}-v${pad(analysis && analysis.directionVersion)}-run-${pad(analysis && analysis.run)}${entrySuffix(analysis, DIRECTION_GROUPS, scope)}.txt`;
}

export function renderDirectionReadExport(analysis, scope = null) {
  const lines = readLineage(analysis, "Direction read");
  if (!scope) {
    lines.push("The direction against the artist's record", "", ...wholeReadLines(analysis, DIRECTION_GROUPS));
    return lines.join("\n");
  }
  const selected = entryAt(analysis, DIRECTION_GROUPS, scope.groupKey, scope.entryIndex);
  lines.push(selected.group.heading, "", ...observationLines(analysis, selected.entry));
  return lines.join("\n");
}

export function boardReviewFilename(analysis, scope = null) {
  const subject = (analysis && analysis.subject) || {};
  return `artboard-check-${slug(subject.sceneId || "scene")}-v${pad(subject.artboardVersion)}-run-${pad(analysis && analysis.run)}${entrySuffix(analysis, BOARD_GROUPS, scope)}.txt`;
}

export function renderBoardReviewExport(analysis, scope = null) {
  const subject = (analysis && analysis.subject) || {};
  const lines = readLineage(analysis, "Artboard check", [
    `Scene: ${subject.sceneTitle || subject.sceneId || "not recorded"}`,
    `Artboard version: V${pad(subject.artboardVersion)}`,
  ]);
  if (!scope) {
    lines.push(`${subject.sceneTitle || "This Scene"}, Artboard V${pad(subject.artboardVersion)}`, "", ...wholeReadLines(analysis, BOARD_GROUPS));
    return lines.join("\n");
  }
  const selected = entryAt(analysis, BOARD_GROUPS, scope.groupKey, scope.entryIndex);
  lines.push(selected.group.heading, "", ...observationLines(analysis, selected.entry));
  return lines.join("\n");
}
