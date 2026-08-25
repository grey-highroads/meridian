import { createBlobBackend, createMemoryBackend } from "../artist/store.js";

// The account's artists, as stored rows. Brief 3 of
// docs/spec-accounts-artists-tours.md.
//
// Before this, one artist was a constant map in api/artist/index.js and every
// account saw the same name. An artist is now a row under the account that owns
// it: an id, the name a person reads, the identities the artist performs under,
// and when it was created. Nothing here holds brain content. The record, the
// approval, and the finding decisions stay in src/artist/store.js and no path in
// this file reads or writes them.
//
// Two documents per account, beside the account's users:
//
//   artists.json        The rows. Appended to, never rewritten in place.
//   artist-record.json  One line per thing that happened to this list.
//
// The demo account's list is seeded on first read the way its users are, so the
// live deployment needs no migration: the first read after this lands writes
// Dierks Bentley's row and every later read returns what is stored. The seed
// carries no timestamp, so a second read is byte-identical to the first.

const ROOT = "brand-world-system/clients";

export const DEMO_ACCOUNT_ID = "dierks-bentley";

// A new artist gets the main stage and the shared bin. The third identity in
// the demo seed is a side project this artist happens to have, not a shape
// every artist arrives with.
export const DEFAULT_IDENTITIES = ["main-stage", "shared"];

export const DEMO_ARTIST = {
  id: "dierks-bentley",
  name: "Dierks Bentley",
  identities: ["main-stage", "hot-country-knights", "shared"],
  createdAt: null,
};

// Facts written before anyone could sign in name Higher Roads and keep naming
// it, the same rule the Scene record follows.
export const RECORD_ACTOR = "Higher Roads";

export function artistsPath(accountId) {
  return `${ROOT}/${accountId || DEMO_ACCOUNT_ID}/org/artists.json`;
}

export function artistRecordPath(accountId) {
  return `${ROOT}/${accountId || DEMO_ACCOUNT_ID}/org/artist-record.json`;
}

export function sanitizeArtistId(value) {
  const cleaned = String(value).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "default";
}

export { createBlobBackend, createMemoryBackend };

export function createArtistDirectory(options = {}) {
  const backend = options.backend || createBlobBackend(options);
  const accountId = options.accountId || DEMO_ACCOUNT_ID;

  return {
    accountId,

    // Written once for the demo account. Every other account starts empty and
    // stays empty until someone creates an artist, so a new account never
    // inherits another account's names.
    async readArtists() {
      const body = await backend.read(artistsPath(accountId));
      if (body !== null && body !== undefined) {
        const stored = JSON.parse(body);
        if (Array.isArray(stored.artists) && stored.artists.length) return stored.artists;
      }
      if (accountId !== DEMO_ACCOUNT_ID) return [];
      const artists = [{ ...DEMO_ARTIST, identities: [...DEMO_ARTIST.identities] }];
      await backend.write(artistsPath(accountId), JSON.stringify({ artists }, null, 2));
      return artists;
    },

    // Absence is the answer for an artist this account does not hold. A session
    // from another account asking for this account's artist gets null, not a
    // row and not a message that confirms the name exists somewhere.
    async findArtist(artistId) {
      const artists = await this.readArtists();
      return artists.find((entry) => entry.id === artistId) || null;
    },

    async createArtist({ name, identities } = {}) {
      const cleaned = String(name || "").trim();
      if (!cleaned) {
        const error = new Error("Name the artist before creating it.");
        error.status = 400;
        throw error;
      }
      const id = sanitizeArtistId(cleaned);
      if (id === "default") {
        // sanitizeArtistId falls back to "default", which is the inherited BWS
        // namespace under the same storage root. Nothing lands there.
        const error = new Error("That name does not make a usable artist id. Use letters or numbers.");
        error.status = 400;
        throw error;
      }
      const artists = await this.readArtists();
      if (artists.some((entry) => entry.id === id)) {
        const error = new Error("An artist already exists under that name.");
        error.status = 409;
        throw error;
      }
      const chosen = Array.isArray(identities)
        ? identities.map((entry) => sanitizeArtistId(entry)).filter((entry) => entry !== "default")
        : [];
      const created = {
        id,
        name: cleaned,
        identities: chosen.length ? chosen : [...DEFAULT_IDENTITIES],
        createdAt: new Date().toISOString(),
      };
      await backend.write(artistsPath(accountId), JSON.stringify({ artists: [...artists, created] }, null, 2));
      return created;
    },

    async readArtistFacts() {
      const body = await backend.read(artistRecordPath(accountId));
      if (body === null || body === undefined) return [];
      const stored = JSON.parse(body);
      return Array.isArray(stored.facts) ? stored.facts : [];
    },

    // Append-only, the same shape the Scene record and the tour record write.
    // Everything already written is carried through untouched.
    async appendArtistFact(fact) {
      const facts = await this.readArtistFacts();
      const entry = {
        actor: fact.actor || RECORD_ACTOR,
        role: fact.role || null,
        account: fact.account || accountId,
        action: String(fact.action || "").trim(),
        artistId: fact.artistId || null,
        onBehalfOf: fact.onBehalfOf || null,
        at: fact.at || new Date().toISOString(),
      };
      if (!entry.action) {
        const error = new Error("A fact needs to say what happened.");
        error.status = 400;
        throw error;
      }
      facts.push(entry);
      await backend.write(artistRecordPath(accountId), JSON.stringify({ facts }, null, 2));
      return entry;
    },
  };
}
