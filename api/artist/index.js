import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseIntake } from "../../src/artist/parse-intake.js";
import { applyDecisions, createArtistStore } from "../../src/artist/store.js";
import { buildArtistView, evidenceFor, listFindings } from "../../src/artist/service.js";
import { readJsonBody, requireBrandWorldAccess, sanitizeClientId, sendJson, sendPublicError } from "../../src/server/http.js";

// The artist layer's one function. New operations arrive as actions here
// rather than as new files, because the hosting tier caps functions and
// retrofitting dispatch later is more work than starting with it.
//
// The actions are: import-intake, get-artist, list-findings, approve-finding,
// decline-finding, get-evidence. None of them returns the prior. The prior is
// written at import and read by nothing, because the thesis says it is never
// shown.

const INTAKE_FILES = {
  prior: "00-prior.md",
  sources: "01-sources.md",
  claims: "02-claims.md",
  findings: "03-findings.md",
  log: "04-log.md",
};

// Names the operator would use for the artists the repo carries intake for.
const ARTIST_NAMES = { "dierks-bentley": "Dierks Bentley" };

export function intakeDirectory(artistId) {
  return join(process.cwd(), "artists", artistId, "intake");
}

export async function readIntakeFiles(artistId, reader = readFile) {
  const directory = intakeDirectory(artistId);
  const texts = {};
  for (const [key, filename] of Object.entries(INTAKE_FILES)) {
    texts[key] = await reader(join(directory, filename), "utf8");
  }
  return texts;
}

async function importIntake(store, artistId, reader) {
  let texts;
  try {
    texts = await readIntakeFiles(artistId, reader);
  } catch {
    const error = new Error("No intake files are stored for that artist yet.");
    error.status = 404;
    throw error;
  }
  const parsed = parseIntake({
    artistId,
    artistName: Object.prototype.hasOwnProperty.call(ARTIST_NAMES, artistId) ? ARTIST_NAMES[artistId] : artistId,
    ...texts,
  });
  const record = await store.writeImport(artistId, parsed);
  return {
    artist: record.artist,
    counts: {
      sources: record.sources.length,
      claims: record.claims.length,
      findings: record.findings.length,
    },
  };
}

async function rule(store, artistId, findingId, status, person) {
  const record = await store.readRecord(artistId);
  const findings = Array.isArray(record.findings) ? record.findings : [];
  if (!findings.some((finding) => finding.id === findingId)) {
    const error = new Error("That finding was not found.");
    error.status = 404;
    throw error;
  }
  await store.writeDecision(artistId, findingId, {
    status,
    decidedBy: person || "Higher Roads",
    decidedAt: new Date().toISOString(),
  });
  const decisions = await store.readDecisions(artistId);
  const decided = applyDecisions(findings, decisions).find((finding) => finding.id === findingId);
  return { finding: decided };
}

export async function handleAction(body, options = {}) {
  const store = options.store || createArtistStore();
  const reader = options.reader;
  const artistId = sanitizeClientId(body.artistId || "");
  if (!artistId || artistId === "default") {
    const error = new Error("Name the artist to work on.");
    error.status = 400;
    throw error;
  }

  if (body.action === "import-intake") {
    return await importIntake(store, artistId, reader);
  }
  if (body.action === "get-artist") {
    const [record, decisions] = await Promise.all([store.readRecord(artistId), store.readDecisions(artistId)]);
    return buildArtistView(record, decisions);
  }
  if (body.action === "list-findings") {
    const [record, decisions] = await Promise.all([store.readRecord(artistId), store.readDecisions(artistId)]);
    return {
      artist: record.artist || null,
      groups: listFindings(record, decisions, { facet: body.facet || null, identity: body.identity || null }),
    };
  }
  if (body.action === "approve-finding") {
    return await rule(store, artistId, body.findingId, "approved", body.person);
  }
  if (body.action === "decline-finding") {
    return await rule(store, artistId, body.findingId, "declined", body.person);
  }
  if (body.action === "get-evidence") {
    const record = await store.readRecord(artistId);
    return evidenceFor(record, body.findingId);
  }

  const error = new Error("That is not something this route does.");
  error.status = 400;
  throw error;
}

export default async function handler(request, response) {
  if (!requireBrandWorldAccess(request, response)) return;
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "This route takes an action." });
      return;
    }
    const body = await readJsonBody(request);
    sendJson(response, 200, await handleAction(body));
  } catch (error) {
    sendPublicError(response, error);
  }
}
