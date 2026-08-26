import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseIntake } from "../../src/artist/parse-intake.js";
import { applyRulings, createArtistStore } from "../../src/artist/store.js";
import { buildArtistView, evidenceFor, listFindings } from "../../src/artist/service.js";
import { readJsonBody, requireUser, sanitizeClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { ACCOUNT, OPERATOR_ROLE, createOrgStore } from "../../src/org/store.js";
import { ACTIVE, DEACTIVATED, publicPerson } from "../../src/org/people.js";
import { RECORD_ACTOR, createArtistDirectory, sanitizeArtistId } from "../../src/org/artists.js";
import { createTourStore } from "../../src/tour/store.js";
import { resolveActingAccount } from "../../src/org/acting-account.js";

// The artist layer's one function. New operations arrive as actions here
// rather than as new files, because the hosting tier caps functions and
// retrofitting dispatch later is more work than starting with it.
//
// The actions are: create-account, list-accounts, set-active-tour, delete-tour,
// delete-account, create-artist, list-artists, list-people, invite-person,
// resend-invite, revoke-invite, edit-person, send-reset, deactivate-person,
// reactivate-person, delete-person, import-intake, get-artist, list-findings,
// approve-brain, remove-finding, restore-finding, get-evidence.
// None of them returns the prior. The prior is written at import and read by
// nothing, because the thesis says it is never shown.
//
// Approval is wholesale. The operator read and sorted every finding during
// intake, so one person approves the whole brain and then takes out the
// individual findings that should not be in it.

// Where every account stores its work. One shape for every account.
const CLIENTS_ROOT = "brand-world-system/clients";

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
// Everything one account stored, or everything one tour stored. The trailing
// slash is what keeps a prefix from reaching its neighbours: without it,
// northstar would reach northstar-live, and tour-two would reach tour-twenty.
// The filter repeats what the prefix already asks for, so a backend that
// widened the match cannot hand this a path outside the directory being
// removed.
async function removeUnder(backend, prefix) {
  if (!prefix.endsWith("/")) throw new Error("A removal prefix has to end with a slash.");
  const paths = (await backend.list(prefix)).filter((path) => String(path).startsWith(prefix));
  if (paths.length) await backend.remove(paths);
  return paths.length;
}

const PEOPLE_ACTS = new Set([
  "invite-person",
  "resend-invite",
  "revoke-invite",
  "edit-person",
  "send-reset",
  "deactivate-person",
  "reactivate-person",
  "delete-person",
]);

// The address a person opens to set their own password. Relative, so it works
// on the deployment and on a preview without the deployment's name being
// written into a stored document.
function linkFor(token) {
  return `/set-password.html?token=${encodeURIComponent(token)}`;
}

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

  // An account that is not on the list is absent, whether it was deleted or
  // never existed. Without this a Higher Roads session naming a dead account in
  // the address keeps working inside it: the page reads back the id it sent and
  // shows lists headed with the name of an account that is gone. A client
  // cannot reach this, because a client's account is the one on their record.
  if (options.user && options.user.role === OPERATOR_ROLE) {
    const known = await openAccounts(options, store).readAccounts();
    if (!known.some((entry) => entry.id === accountId)) {
      const error = new Error("No account is stored under that name.");
      error.status = 404;
      throw error;
    }
  }

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
    return { accountId, people: people.map(publicPerson), admins: admins.map(publicPerson) };
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

  // Which tour the account opens when the address names none. The tour has to
  // be one this account holds, so an admin cannot point an account at another
  // account's tour by naming its id.
  if (body.action === "set-active-tour" && options.user && options.user.role === OPERATOR_ROLE) {
    const tourId = sanitizeClientId(body.tourId || "");
    const tours = options.tourStore || createTourStore({ backend: store.backend, accountId });
    const held = await tours.readTours();
    if (!held.some((entry) => entry.id === tourId)) {
      const error = new Error("No tour is stored under that name for this account.");
      error.status = 404;
      throw error;
    }
    const account = await openAccounts(options, store).setActiveTour(accountId, tourId);
    return { account };
  }
  // Deleting a tour removes what the tour stored and nothing else. The
  // account's artists and their brains sit outside the tour's directory and are
  // never reached by this.
  if (body.action === "delete-tour" && options.user && options.user.role === OPERATOR_ROLE) {
    const tourId = sanitizeClientId(body.tourId || "");
    const tours = options.tourStore || createTourStore({ backend: store.backend, accountId });
    const stored = await tours.readTour(tourId);
    if (!stored) {
      const error = new Error("No tour is stored under that name for this account.");
      error.status = 404;
      throw error;
    }
    const removed = await removeUnder(store.backend, `${CLIENTS_ROOT}/${accountId}/tours/${tourId}/`);
    const accounts = openAccounts(options, store);
    const row = (await accounts.readAccounts()).find((entry) => entry.id === accountId);
    // An account pointed at a tour that is gone would open nothing, so the
    // pointer is cleared with the tour it named.
    if (row && row.activeTourId === tourId) await accounts.setActiveTour(accountId, null);
    return { tourId, removed };
  }
  // Deleting an account removes every document it stored and takes its row out
  // of the list. The name is typed back before anything is removed, because
  // this is the one act here that cannot be undone.
  if (body.action === "delete-account" && options.user && options.user.role === OPERATOR_ROLE) {
    const wanted = sanitizeClientId(body.accountToDelete || "");
    const accounts = openAccounts(options, store);
    const row = (await accounts.readAccounts()).find((entry) => entry.id === wanted);
    if (!row) {
      const error = new Error("No account is stored under that name.");
      error.status = 404;
      throw error;
    }
    if (String(body.confirmName || "").trim() !== row.name) {
      const error = new Error("Type the account name exactly as it appears before deleting it.");
      error.status = 400;
      throw error;
    }
    const removed = await removeUnder(store.backend, `${CLIENTS_ROOT}/${wanted}/`);
    await accounts.removeAccount(wanted);
    return { account: row, removed };
  }

  // The people acts. Every one of them is Higher Roads only, and none of them
  // sends anything: Meridian hands back the link and the admin sends it from
  // their own inbox. Ruled 2026-08-26 in docs/spec-admin-surface.md.
  if (PEOPLE_ACTS.has(body.action) && options.user && options.user.role === OPERATOR_ROLE) {
    const org = openPeople(options, store, accountId);
    const personId = String(body.personId || "").trim();

    if (body.action === "invite-person") {
      const invited = await org.invitePerson(accountId, body.person || {});
      return { person: invited.person, link: linkFor(invited.token) };
    }
    if (body.action === "resend-invite" || body.action === "send-reset") {
      const purpose = body.action === "send-reset" ? "reset" : "invite";
      const minted = await org.mintPersonLink(personId, purpose);
      return { person: minted.person, link: linkFor(minted.token) };
    }
    if (body.action === "revoke-invite") {
      return { person: await org.clearPersonLink(personId) };
    }
    if (body.action === "edit-person") {
      return { person: await org.editPerson(personId, body.person || {}) };
    }
    if (body.action === "deactivate-person" || body.action === "reactivate-person") {
      // Turning yourself off would sign you out of the screen you did it on and
      // leave nobody able to turn you back on.
      if (personId === options.user.id && body.action === "deactivate-person") {
        const error = new Error("You cannot turn off the person you are signed in as.");
        error.status = 409;
        throw error;
      }
      const status = body.action === "deactivate-person" ? DEACTIVATED : ACTIVE;
      return { person: await org.setPersonStatus(personId, status) };
    }
    if (body.action === "delete-person") {
      return { person: await org.removePerson(personId) };
    }
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
