import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseIntake } from "../../src/artist/parse-intake.js";
import { applyRulings, createArtistStore } from "../../src/artist/store.js";
import { copyArtistToAccountPath } from "../../src/artist/copy-to-account-path.js";
import { seedTourFromFixture } from "../../src/tour/seed-from-fixture.js";
import { createTourStore, tourDocumentPathFor } from "../../src/tour/store.js";
import { buildArtistView, evidenceFor, listFindings } from "../../src/artist/service.js";
import { readJsonBody, requireUser, sanitizeClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { ACCOUNT, OPERATOR_ROLE } from "../../src/org/store.js";
import { RECORD_ACTOR, createArtistDirectory } from "../../src/org/artists.js";
import { resolveActingAccount } from "../../src/org/acting-account.js";

// The artist layer's one function. New operations arrive as actions here
// rather than as new files, because the hosting tier caps functions and
// retrofitting dispatch later is more work than starting with it.
//
// The actions are: create-artist, list-artists, import-intake, get-artist,
// list-findings, approve-brain, remove-finding, restore-finding, get-evidence,
// copy-artist-paths, seed-tour-at-shared-path.
// None of them returns the prior. The prior is written at import and read by
// nothing, because the thesis says it is never shown.
//
// Approval is wholesale. The operator read and sorted every finding during
// intake, so one person approves the whole brain and then takes out the
// individual findings that should not be in it.

const INTAKE_FILES = {
  prior: "00-prior.md",
  sources: "01-sources.md",
  claims: "02-claims.md",
  findings: "03-findings.md",
  log: "04-log.md",
};

function optionalText(value) {
  const text = String(value || "").trim();
  return text || null;
}

// The account's artist rows, opened on the same backend as the artist store so
// a caller that injected one backend gets one backend. Brief 3 of
// docs/spec-accounts-artists-tours.md.
function openDirectory(options, store, accountId) {
  if (options.artists) return options.artists;
  const backend = store && store.backend ? store.backend : null;
  return createArtistDirectory(backend ? { backend, accountId } : { accountId });
}

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

async function importIntake(store, directory, artistId, reader) {
  let texts;
  try {
    texts = await readIntakeFiles(artistId, reader);
  } catch {
    const error = new Error("No intake files are stored for that artist yet.");
    error.status = 404;
    throw error;
  }
  // Intake requires an artist that exists in the account doing the importing.
  // The display name is the one stored on that row, so two accounts holding the
  // same artist id read their own name and neither learns about the other.
  const artist = await directory.findArtist(artistId);
  if (!artist) {
    const error = new Error("No artist is stored under that name. Create the artist before importing intake files.");
    error.status = 404;
    throw error;
  }
  const parsed = parseIntake({
    artistId,
    artistName: artist.name,
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

async function setRemoved(store, artistId, findingId, entry) {
  const record = await store.readRecord(artistId);
  const findings = Array.isArray(record.findings) ? record.findings : [];
  if (!findings.some((finding) => finding.id === findingId)) {
    const error = new Error("That finding was not found.");
    error.status = 404;
    throw error;
  }
  await store.setRemoved(artistId, findingId, entry);
  const decisions = await store.readDecisions(artistId);
  return { finding: applyRulings(findings, decisions).find((finding) => finding.id === findingId) };
}

// The demo tour arrived as committed markdown, from before a tour was a stored
// thing. Seeding writes that same fixture into the tour store through the
// store's own writers, so the tour is an ordinary stored tour like any other
// account's. The files on disk are left where they are and nothing reads them
// after this.
async function seedTourAtSharedPath(store, options, accountId, tourId) {
  const tours = options.tourStore || createTourStore({ backend: store.backend, accountId });
  const where = (name) => tourDocumentPathFor(tourId, name, tours.accountId);

  let parsed;
  try {
    parsed = await seedTourFromFixture(tours, tourId);
  } catch (error) {
    if (error.status === 409) {
      return { lines: ["A tour is already stored under that name for this account. Nothing was written."], count: 0 };
    }
    if (error.code === "ENOENT") {
      const absent = new Error("No tour fixture is committed under that name.");
      absent.status = 404;
      throw absent;
    }
    throw error;
  }

  const lines = [
    `Tour ${parsed.tour.id} written to ${where("tour")}`,
    `Direction version ${parsed.tour.direction.version} written to ${where("directions")}`,
    ...parsed.assignments.map((assignment) => `Assignment ${assignment.id} written to ${where("requests")}`),
  ];
  const count = lines.length;
  lines.push(`Wrote ${count} object${count === 1 ? "" : "s"}. The committed files were not touched.`);
  return { lines, count };
}

export async function handleAction(body, options = {}) {
  // The artist store is bound to the session's account, and every account uses
  // the same path shape. A session from another account reading this account's
  // artist finds absence by construction, never an acknowledgment.
  //
  // The route itself requires a session. An internal call made without one acts
  // in the deployment's own account, which is the account a store needs to
  // resolve a path at all.
  const accountId = options.user
    ? resolveActingAccount(options.user, body.accountId || options.user.actingAccount)
    : ACCOUNT.id;
  const store = options.store || createArtistStore({ accountId });
  const reader = options.reader;

  // Both of these name an artist by its name or name none at all, so they run
  // before the guard that requires an artist id on the body.
  if (body.action === "list-artists") {
    return { artists: await openDirectory(options, store, accountId).readArtists() };
  }
  if (body.action === "create-artist") {
    const directory = openDirectory(options, store, accountId);
    const created = await directory.createArtist({ name: body.name, identities: body.identities });
    await directory.appendArtistFact({
      actor: options.user ? options.user.displayName : RECORD_ACTOR,
      role: options.user ? options.user.roleLabel || null : null,
      account: accountId,
      action: "Created the artist",
      artistId: created.id,
      onBehalfOf: optionalText(body.onBehalfOf),
    });
    return { artist: created };
  }

  const artistId = sanitizeClientId(body.artistId || "");
  if (!artistId || artistId === "default") {
    const error = new Error("Name the artist to work on.");
    error.status = 400;
    throw error;
  }

  if (body.action === "import-intake") {
    return await importIntake(store, openDirectory(options, store, accountId), artistId, reader);
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
  if (body.action === "approve-brain") {
    const record = await store.readRecord(artistId);
    if (!record.artist) {
      const error = new Error("Import this artist's intake files before approving the brain.");
      error.status = 400;
      throw error;
    }
    await store.approveBrain(artistId, body.person);
    const decisions = await store.readDecisions(artistId);
    return buildArtistView(record, decisions);
  }
  if (body.action === "remove-finding") {
    return await setRemoved(store, artistId, body.findingId, {
      removedBy: body.person || "Higher Roads",
      removedAt: new Date().toISOString(),
    });
  }
  if (body.action === "restore-finding") {
    return await setRemoved(store, artistId, body.findingId, null);
  }
  // Moving an artist's stored documents to the path every account uses is a
  // Higher Roads act. A client session never learns the action exists: it falls
  // past this branch to the same answer an unknown action gets, which is how
  // every other cross-account read returns absence rather than an
  // acknowledgment. The copying and the byte comparison are the script's, which
  // is why this collects the lines it already reports instead of asking it to
  // report differently.
  if (body.action === "copy-artist-paths" && options.user && options.user.role === OPERATOR_ROLE) {
    const lines = [];
    const result = await copyArtistToAccountPath({
      backend: store.backend,
      accountId: accountId,
      artistId,
      log: (line) => lines.push(line),
    });
    return { lines, count: result.copied.length };
  }
  // The same shape the copy action uses: a Higher Roads act, and a client
  // session falls past the branch to the answer an unknown action gets.
  if (body.action === "seed-tour-at-shared-path" && options.user && options.user.role === OPERATOR_ROLE) {
    return await seedTourAtSharedPath(store, options, accountId, sanitizeClientId(body.tourId || ""));
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
  const user = await requireUser(request, response, { role: OPERATOR_ROLE });
  if (!user) return;
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "This route takes an action." });
      return;
    }
    const body = await readJsonBody(request);
    sendJson(response, 200, await handleAction(body, { user }));
  } catch (error) {
    sendPublicError(response, error);
  }
}
