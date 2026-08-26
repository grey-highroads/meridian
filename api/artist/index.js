import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseIntake } from "../../src/artist/parse-intake.js";
import { applyRulings, createArtistStore } from "../../src/artist/store.js";
import { buildArtistView, evidenceFor, listFindings } from "../../src/artist/service.js";
import { readJsonBody, requireUser, sanitizeClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { ACCOUNT, OPERATOR_ROLE, createOrgStore, publicUser } from "../../src/org/store.js";
import { RECORD_ACTOR, createArtistDirectory, sanitizeArtistId } from "../../src/org/artists.js";
import { resolveActingAccount } from "../../src/org/acting-account.js";

// The artist layer's one function. New operations arrive as actions here
// rather than as new files, because the hosting tier caps functions and
// retrofitting dispatch later is more work than starting with it.
//
// The actions are: create-account, list-accounts, create-artist, list-artists,
// list-people, import-intake, get-artist, list-findings, approve-brain,
// remove-finding, restore-finding, get-evidence.
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
// The accounts list, opened on the same backend as the artist store so a
// caller that injected one backend gets one backend. Accounts are not stored
// under an account, so nothing here is scoped by one.
function openAccounts(options, store) {
  if (options.orgStore) return options.orgStore;
  const backend = store && store.backend ? store.backend : null;
  return createOrgStore(backend ? { backend } : {});
}

// The account's artist rows. An injected directory is bound to one account, so
// a caller that needs another account's rows names it and gets a directory on
// the same backend rather than the injected one.
// The people of one named account. An injected store is bound to whichever
// account the caller built it for, so a request naming another account gets a
// store on the same backend rather than the injected one.
function openPeople(options, store, accountId) {
  if (options.orgStore && options.orgStore.account && options.orgStore.account.id === accountId) return options.orgStore;
  const backend = (options.orgStore && options.orgStore.backend) || (store && store.backend ? store.backend : null);
  const account = { id: accountId, name: accountId };
  return createOrgStore(backend ? { backend, account } : { account });
}

function openDirectory(options, store, accountId, forAccount) {
  const wanted = forAccount || accountId;
  if (options.artists && options.artists.accountId === wanted) return options.artists;
  const backend = (options.artists && options.artists.backend)
    || (store && store.backend ? store.backend : null);
  return createArtistDirectory(backend ? { backend, accountId: wanted } : { accountId: wanted });
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
  // The three acts that make a second account exist. Each one is a Higher
  // Roads act, and a client session falls past the branch to the answer an
  // unknown action gets: absence rather than an acknowledgment that the act is
  // there at all.
  if (body.action === "list-accounts" && options.user && options.user.role === OPERATOR_ROLE) {
    return { accounts: await openAccounts(options, store).readAccounts() };
  }
  // The account's own people, for the lists on Admin. Higher Roads admins
  // belong to no account and are returned beside the account's people rather
  // than inside them, because an admin listed under an account would read as
  // that account's client. Ruled 2026-08-26 in docs/spec-admin-surface.md.
  if (body.action === "list-people" && options.user && options.user.role === OPERATOR_ROLE) {
    const org = openPeople(options, store, accountId);
    const [people, admins] = await Promise.all([org.readUsers(), org.readAdmins()]);
    return { accountId, people: people.map(publicUser), admins: admins.map(publicUser) };
  }
  // An account with no artist is an account nobody can do anything in, because
  // a tour needs an artist. The two are made in one act, and the artist name is
  // checked before the account is written so an unusable name never leaves half
  // an account behind. If the artist still fails after the account exists, the
  // account comes back with the reason the artist did not, and the caller says
  // which half it was.
  if (body.action === "create-account" && options.user && options.user.role === OPERATOR_ROLE) {
    const artistName = String(body.artistName || "").trim();
    if (!artistName) {
      const error = new Error("Name the artist this account works on before creating it.");
      error.status = 400;
      throw error;
    }
    if (sanitizeArtistId(artistName) === "default") {
      const error = new Error("That artist name does not make a usable artist id. Use letters or numbers.");
      error.status = 400;
      throw error;
    }
    const account = await openAccounts(options, store).createAccount(body.name);
    const directory = openDirectory(options, store, account.id, account.id);
    try {
      const artist = await directory.createArtist({ name: artistName, identities: body.identities });
      await directory.appendArtistFact({
        actor: options.user.displayName,
        role: options.user.roleLabel || null,
        account: account.id,
        action: "Created the artist",
        artistId: artist.id,
        onBehalfOf: optionalText(body.onBehalfOf),
      });
      return { account, artist };
    } catch (error) {
      return { account, artist: null, artistError: error.message };
    }
  }
  if (body.action === "create-artist" && options.user && options.user.role === OPERATOR_ROLE) {
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
