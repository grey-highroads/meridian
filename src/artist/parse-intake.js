// Reads the five intake files a Higher Roads operator produces for one artist
// and turns them into the artist layer's objects. Pure: text in, objects out,
// no clock, no randomness, no network. That is what makes import idempotent.
//
// The file shapes this reads are the ones the first intake run produced
// (Dierks Bentley, 2026-08-21) and that docs/intake-playbook.md describes.
// Where a field the artist record wants is not present in the files, it is
// left empty and the gap is reported, never inferred. Two such gaps exist and
// both are recorded in docs/deferred-work.md:
//
//   1. Findings carry an independent source count and their tiers, and do not
//      name the claims behind them. So finding.claimIds is empty and
//      evidenceLinked is false.
//   2. A claim's source cell is prose naming an outlet and an article, not a
//      source number. It resolves to a source id only when exactly one source
//      row matches; otherwise sourceId stays null and sourceRef holds the text.

import { findingStatement } from "./finding.js";

export const FACET_CODES = ["CE", "LH", "VL", "BS", "PB", "AV"];

export const FACET_NAMES = {
  CE: "Catalog and eras",
  LH: "Live history",
  VL: "Visual language",
  BS: "Brand and story",
  PB: "People and business",
  AV: "What the brand avoids",
};

// The findings file numbers its facets. The numbering is the thesis order.
const FACET_BY_NUMBER = { 1: "CE", 2: "LH", 3: "VL", 4: "BS", 5: "PB", 6: "AV" };

// The sources file writes facet names in prose rather than codes.
const FACET_BY_PROSE = {
  "catalog and eras": "CE",
  "live history": "LH",
  "visual language": "VL",
  "visual language by era": "VL",
  "brand and story": "BS",
  "brand and story as the artist tells it": "BS",
  "people and business": "PB",
  "what the brand avoids": "AV",
  "what the brand avoids, read from the brand itself": "AV",
};

// The identities an artist performs under belong to that artist and not to
// this module. The intake states them in one line near the top of
// 01-sources.md, which the first run already wrote:
//
//   Identity: MS is main stage, HCK is Hot Country Knights, SH is shared.
//
// The sources and claims tables carry the code, the findings file carries the
// name as a heading, and nothing else in the files joins the two, so that line
// is the join. An intake that states no identity line gets the main stage and
// the shared bin, which is the pair a new artist row is created with.
export const DEFAULT_IDENTITIES = [
  { code: "MS", id: "main-stage", name: "Main stage" },
  { code: "SH", id: "shared", name: "Shared" },
];

export function identityId(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function readableIdentity(value) {
  const text = String(value).trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function parseIdentities(text) {
  const line = String(text).match(/^Identity:\s*(.+)$/im);
  if (!line) return DEFAULT_IDENTITIES.map((entry) => ({ ...entry }));
  const identities = [];
  for (const part of line[1].replace(/\.\s*$/, "").split(",")) {
    const match = part.trim().match(/^([A-Za-z0-9]+)\s+is\s+(.+)$/);
    if (!match) continue;
    const name = readableIdentity(match[2]);
    const id = identityId(name);
    if (!id) continue;
    if (identities.some((entry) => entry.id === id || entry.code === match[1].toUpperCase())) continue;
    identities.push({ code: match[1].toUpperCase(), id, name });
  }
  if (!identities.length) fail("The identity line in 01-sources.md names no identities.");
  return identities;
}

const BINS = ["confirmed", "corrected", "new"];

function fail(message) {
  const error = new Error(message);
  error.status = 422;
  throw error;
}

// A markdown table row, split into its cells. Returns null for anything that
// is not a body row, including the header and the dashed separator.
function tableCells(line) {
  if (!/^\|\s*\d+\s*\|/.test(line)) return null;
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function facetsFromProse(value) {
  const codes = [];
  for (const part of String(value).split(",")) {
    const key = part.trim().toLowerCase();
    if (!key) continue;
    if (key === "all") {
      for (const code of FACET_CODES) if (!codes.includes(code)) codes.push(code);
      continue;
    }
    const code = Object.prototype.hasOwnProperty.call(FACET_BY_PROSE, key) ? FACET_BY_PROSE[key] : null;
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function facetsFromCodes(value) {
  const codes = [];
  for (const part of String(value).split(",")) {
    const code = part.trim().toUpperCase();
    if (FACET_CODES.includes(code) && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

// Identities arrive from the intake, so they are matched over the list rather
// than through an object keyed by them. A code or a heading that names no
// declared identity resolves to null and the row keeps no identity.
function identityFromCode(value, identities) {
  const code = String(value).trim().toUpperCase();
  const found = identities.find((entry) => entry.code === code);
  return found ? found.id : null;
}

function identityFromHeading(value, identities) {
  const name = String(value).trim().toLowerCase();
  const found = identities.find((entry) => entry.name.toLowerCase() === name);
  return found ? found.id : null;
}

// ---------------------------------------------------------------------------
// 01-sources.md
// ---------------------------------------------------------------------------

export function parseSources(text, identities) {
  const declared = identities || parseIdentities(text);
  const sources = [];
  let tier = null;
  for (const line of String(text).split("\n")) {
    const heading = line.match(/^##\s+Tier\s+(\d+)\b/i);
    if (heading) {
      tier = Number(heading[1]);
      continue;
    }
    if (/^#/.test(line)) {
      // Any other heading closes the tier, so the excluded and gaps sections
      // at the end of the file cannot pick up the last tier number.
      if (!heading) tier = null;
      continue;
    }
    const cells = tableCells(line);
    if (!cells) continue;
    if (cells.length !== 7) fail(`A source row has ${cells.length} columns and needs 7. Row starts: ${cells[0]}`);
    if (tier === null) fail(`Source row ${cells[0]} sits under no tier heading.`);
    if (tier < 1 || tier > 7) fail(`Source row ${cells[0]} names tier ${tier}, outside 1 to 7.`);
    const status = cells[6].toLowerCase();
    if (!["confirmed", "index", "constructed"].includes(status)) {
      fail(`Source row ${cells[0]} has status "${cells[6]}", which is not confirmed, index, or constructed.`);
    }
    const number = Number(cells[0]);
    sources.push({
      id: `source-${number}`,
      version: 1,
      number,
      title: cells[1],
      url: cells[2],
      tier,
      status,
      facets: facetsFromProse(cells[3]),
      era: cells[4],
      identity: identityFromCode(cells[5], declared),
      // Syndicated copies are collapsed to their origin during extraction, so
      // no row in this file is a copy of another. The field is here because
      // the seam and the playbook both expect it once a run keeps one.
      originId: null,
    });
  }
  if (!sources.length) fail("No sources were found in 01-sources.md.");
  return sources;
}

// ---------------------------------------------------------------------------
// 02-claims.md
// ---------------------------------------------------------------------------

// Resolve a claim's prose source cell to a source id. Matches on the host at
// the front of the cell and only commits when exactly one source row carries
// that host. Anything else keeps the prose and no id, because a wrong link is
// worse than an absent one.
function resolveSourceId(sourceRef, sources) {
  const head = String(sourceRef).trim().toLowerCase();
  const matches = sources.filter((source) => {
    const host = source.url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    return head.startsWith(host);
  });
  if (matches.length !== 1) return null;
  return matches[0].id;
}

export function parseClaims(text, sources = [], identities = DEFAULT_IDENTITIES) {
  const claims = [];
  const seen = new Set();
  for (const line of String(text).split("\n")) {
    const cells = tableCells(line);
    if (!cells) continue;
    if (cells.length !== 7) fail(`A claim row has ${cells.length} columns and needs 7. Row starts: ${cells[0]}`);
    const number = Number(cells[0]);
    if (seen.has(number)) fail(`Claim ${number} appears more than once.`);
    seen.add(number);
    const sourceRef = cells[5];
    const flags = [];
    // The one flagged claim in the first run carries its flag in the source
    // cell rather than in a column of its own.
    if (/unconfirmed|to be confirmed/i.test(sourceRef) || /no primary source/i.test(cells[6])) flags.push("unconfirmed");
    if (/index only/i.test(sourceRef)) flags.push("index-only");
    claims.push({
      id: `claim-${number}`,
      version: 1,
      number,
      text: cells[1],
      era: cells[2],
      facets: facetsFromCodes(cells[3]),
      identities: [identityFromCode(cells[4], identities)].filter(Boolean),
      sourceRef,
      sourceId: resolveSourceId(sourceRef, sources),
      // The file's own note says this column carries a locator and a
      // paraphrase in one cell. It is stored as it is written rather than
      // split on a guess.
      evidence: cells[6],
      flags,
    });
  }
  if (!claims.length) fail("No claims were found in 02-claims.md.");
  return claims;
}

// ---------------------------------------------------------------------------
// 03-findings.md
// ---------------------------------------------------------------------------

// The counts table at the top of the findings file states the bins per facet.
// It is parsed so the findings the parser produces can be checked against what
// the operator counted, rather than trusted.
export function parseFindingCounts(text) {
  const counts = { confirmed: 0, corrected: 0, new: 0 };
  let found = false;
  for (const line of String(text).split("\n")) {
    const match = line.match(/^\|\s*\*\*All facets\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/i);
    if (!match) continue;
    counts.confirmed = Number(match[1]);
    counts.corrected = Number(match[2]);
    counts.new = Number(match[3]);
    found = true;
  }
  if (!found) fail("The findings file has no all-facets counts row to check the parse against.");
  return counts;
}

// A finding's bin is the last bold span in its paragraph whose text starts
// with a bin word. The first run wrote three shapes: "**New.**",
// "**Corrected**," mid-sentence, and "**Confirmed and sharpened.**".
function binFromParagraph(paragraph) {
  const spans = paragraph.match(/\*\*[^*]+\*\*/g) || [];
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const inner = spans[index].slice(2, -2).trim().toLowerCase();
    const bin = BINS.find((candidate) => inner === candidate || inner.startsWith(`${candidate}.`) || inner.startsWith(`${candidate} `));
    if (bin) return bin;
  }
  return null;
}

export function parseFindings(text, identities = DEFAULT_IDENTITIES) {
  const findings = [];
  let facet = null;
  let identity = null;
  let ordinal = 0;
  const lines = String(text).split("\n");
  for (const line of lines) {
    const facetHeading = line.match(/^#\s+Facet\s+(\d+):/i);
    if (facetHeading) {
      const number = Number(facetHeading[1]);
      facet = Object.prototype.hasOwnProperty.call(FACET_BY_NUMBER, number) ? FACET_BY_NUMBER[number] : null;
      if (!facet) fail(`The findings file names facet ${number}, which is outside the six ruled facets.`);
      identity = null;
      continue;
    }
    if (/^#\s/.test(line)) {
      // A top-level heading that is not a facet ends the findings body.
      facet = null;
      identity = null;
      continue;
    }
    const identityHeading = line.match(/^##\s+(.+?)\s*$/);
    if (identityHeading) {
      identity = identityFromHeading(identityHeading[1], identities);
      continue;
    }
    if (!facet || !identity) continue;
    if (!line.startsWith("**")) continue;

    const paragraph = line.trim();
    const bin = binFromParagraph(paragraph);
    if (!bin) fail(`A finding under ${facet} carries no bin: ${paragraph.slice(0, 80)}`);
    const sourceLine = paragraph.match(/(\d+)\s+sources?,\s+tiers?\s+([\d,\sand]+?)\./i);
    const tiers = sourceLine
      ? [...new Set((sourceLine[2].match(/\d+/g) || []).map(Number))].sort((left, right) => left - right)
      : [];
    ordinal += 1;
    findings.push({
      id: `finding-${ordinal}`,
      version: 1,
      facet,
      identity,
      text: findingStatement(paragraph),
      bin,
      independentSourceCount: sourceLine ? Number(sourceLine[1]) : null,
      tiers,
      // Not present in the intake files. See the note at the top of this file.
      claimIds: [],
      evidenceLinked: false,
    });
  }
  if (!findings.length) fail("No findings were found in 03-findings.md.");

  const parsed = { confirmed: 0, corrected: 0, new: 0 };
  for (const finding of findings) parsed[finding.bin] += 1;
  const stated = parseFindingCounts(text);
  for (const bin of BINS) {
    if (parsed[bin] !== stated[bin]) {
      fail(`The findings file counts ${stated[bin]} ${bin} findings and the parse produced ${parsed[bin]}.`);
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// The whole record
// ---------------------------------------------------------------------------

export function parseIntake({ artistId, artistName, prior, sources, claims, findings, log }) {
  if (!artistId) fail("An artist id is needed to import intake files.");
  const identities = parseIdentities(sources);
  const sourceObjects = parseSources(sources, identities);
  const claimObjects = parseClaims(claims, sourceObjects, identities);
  const findingObjects = parseFindings(findings, identities);
  return {
    artist: {
      id: artistId,
      version: 1,
      name: artistName || artistId,
      identities: identities.map((entry) => ({ id: entry.id, name: entry.name, code: entry.code })),
    },
    sources: sourceObjects,
    claims: claimObjects,
    findings: findingObjects,
    // Written once at import and read by nothing the interface calls.
    prior: { id: "prior", version: 1, text: String(prior) },
    log: { id: "log", version: 1, text: String(log) },
  };
}
