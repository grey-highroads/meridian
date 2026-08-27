import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createBlobBackend, createMemoryBackend } from "../artist/store.js";
import { ownEntry } from "../lookup.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "./roles.js";
import {
  ACTIVE,
  CLIENT_INTRODUCTION,
  DEACTIVATED,
  INVITED,
  buildPerson,
  displayNameFor,
  linkMatches,
  mintLink,
  normalizeEmail,
  publicPerson,
  recordExperienceSeen,
  reviewVersionExperience,
  reviewVersionsSeen,
  validEmail,
  validRole,
} from "./people.js";

export { CLIENT_ROLE, OPERATOR_ROLE };

// The organization layer, at the size the pilot needs it.
//
// Two kinds of person and two places they are stored. A client belongs to one
// account and is stored under it. A Higher Roads admin belongs to no account
// and is stored beside the account list, because an admin who lived inside an
// account would read as a client of that one. Ruled 2026-08-26 in
// docs/spec-admin-surface.md.
//
// Each person carries a name, a login, a hashed password, and a role. Both
// lists are seeded once from the two values on the deployment. There is no
// signup, no configuration screen, and nothing here a client sets up. Higher
// Roads operates Meridian for the client.
//
// The shape is the one the thesis describes: accounts hold users, users carry
// permissions, and a tour reads those permissions to decide who may do what.
// What is deliberately small is the count, not the shape, so more people and
// more accounts are rows rather than a rebuild.

export const ACCOUNT = { id: "dierks-bentley", name: "Dierks Bentley" };

// Accounts are rows. Brief 2 of docs/spec-accounts-artists-tours.md. The
// account above is seeded into the list on first read. Every account, this one
// included, stores its work under its own id. No delete; retirement is a later
// ruling.
export const ACCOUNTS_PATH = "brand-world-system/org/accounts.json";

// Higher Roads admins, beside the account list rather than inside an account.
export const ADMINS_PATH = "brand-world-system/org/users.json";

export function sanitizeAccountId(value) {
  const cleaned = String(value).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "default";
}


const ROLE_LABELS = {
  "higher-roads": "Higher Roads",
  "client-reviewer": "Client reviewer",
};

export function roleLabel(role) {
  return ownEntry(ROLE_LABELS, role, "Signed in");
}

export function usersPath(accountId = ACCOUNT.id) {
  return `brand-world-system/clients/${accountId}/org/users.json`;
}

// login:password:display name. The display name may carry anything, including
// a colon, so only the first two separators are read as separators.
export function parseSeed(value) {
  const text = String(value || "");
  const first = text.indexOf(":");
  if (first < 1) return null;
  const second = text.indexOf(":", first + 1);
  if (second === -1) return null;
  const login = text.slice(0, first).trim();
  const password = text.slice(first + 1, second);
  const displayName = text.slice(second + 1).trim();
  if (!login || !password || !displayName) return null;
  return { login, password, displayName };
}

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function passwordMatches(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const expected = Buffer.from(parts[2], "hex");
  let given;
  try {
    given = scryptSync(password, parts[1], expected.length);
  } catch {
    return false;
  }
  return expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
}

// What the rest of the app sees. The hash never leaves this file.
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    login: user.login,
    displayName: user.displayName,
    role: user.role,
    roleLabel: roleLabel(user.role),
    // No default. A client carries the account they belong to and a Higher
    // Roads admin carries none.
    accountId: user.accountId === undefined ? null : user.accountId,
    status: user.status || (user.password ? "active" : "invited"),
    introductionSeenAt: user.introductionSeenAt || user.experiencesSeen?.[CLIENT_INTRODUCTION] || null,
    reviewVersionsSeen: user.reviewVersionsSeen || reviewVersionsSeen(user),
  };
}

export { createBlobBackend, createMemoryBackend };

export function createOrgStore(options = {}) {
  const backend = options.backend || createBlobBackend(options);
  const env = options.env || process.env;
  const account = options.account || ACCOUNT;

  // Both values are read together, because the cookie is signed with both and a
  // deployment holding one of them can sign nobody in.
  function seeds() {
    const operator = parseSeed(env.MERIDIAN_OPERATOR);
    const client = parseSeed(env.MERIDIAN_CLIENT);
    if (!operator || !client) {
      const error = new Error("Meridian needs both of its sign in values set before anyone can sign in.");
      error.status = 503;
      throw error;
    }
    return { operator, client };
  }

  function person(id, role, seed, accountId) {
    return {
      id,
      login: seed.login,
      displayName: seed.displayName,
      role,
      accountId,
      password: hashPassword(seed.password),
    };
  }

  return {
    account,
    backend,

    // Written once. A second read returns what is stored and changes nothing,
    // so the hashes stay put and a session signed yesterday still resolves.
    async readAdmins() {
      const body = await backend.read(ADMINS_PATH);
      if (body !== null && body !== undefined) {
        const stored = JSON.parse(body);
        if (Array.isArray(stored.users) && stored.users.length) return stored.users;
      }
      const users = [person("operator", OPERATOR_ROLE, seeds().operator, null)];
      await backend.write(ADMINS_PATH, JSON.stringify({ users }, null, 2));
      return users;
    },

    // The account's own people. A deployment written before admins moved out
    // still holds an admin row in this document. It is filtered here rather
    // than rewritten, because a scoping change is no place to edit stored
    // people, and a row nobody reads gives nobody account scope.
    async readUsers() {
      const body = await backend.read(usersPath(account.id));
      if (body !== null && body !== undefined) {
        const stored = JSON.parse(body);
        const users = Array.isArray(stored.users)
          ? stored.users.filter((entry) => entry.role !== OPERATOR_ROLE)
          : [];
        if (users.length) return users;
      }
      // Only the account the deployment was seeded for gets a person from the
      // environment. Any other account holds nobody until someone is invited
      // into it, because seeding here would put one account's login into every
      // account that has none.
      if (account.id !== ACCOUNT.id) return [];
      const users = [person("client", CLIENT_ROLE, seeds().client, account.id)];
      await backend.write(usersPath(account.id), JSON.stringify({ account, users }, null, 2));
      return users;
    },

    async readAccounts() {
      const body = await backend.read(ACCOUNTS_PATH);
      if (body === null || body === undefined) return [{ ...ACCOUNT, createdAt: null, seeded: true }];
      return JSON.parse(body).accounts;
    },

    async createAccount(name) {
      const cleaned = String(name || "").trim();
      if (!cleaned) {
        const error = new Error("Name the account before creating it.");
        error.status = 400;
        throw error;
      }
      const id = sanitizeAccountId(cleaned);
      if (id === "default") {
        const error = new Error("That name does not make a usable account id. Use letters or numbers.");
        error.status = 400;
        throw error;
      }
      const accounts = await this.readAccounts();
      if (accounts.some((entry) => entry.id === id)) {
        const error = new Error("An account already exists under that name.");
        error.status = 409;
        throw error;
      }
      const created = { id, name: cleaned, createdAt: new Date().toISOString() };
      await backend.write(ACCOUNTS_PATH, JSON.stringify({ accounts: [...accounts, created] }, null, 2));
      return created;
    },

    // Admins first, then the account's people. The two lists never share an id,
    // so the order settles nothing except which document is read first.
    async everyone() {
      return (await this.everyPerson()).map((entry) => entry.person);
    },

    // Which tour an account opens when the address names none. Written onto the
    // account row, so an account holding several stops resolving one by the
    // order of a list. Ruled 2026-08-26 in docs/spec-admin-surface.md.
    async setActiveTour(accountId, tourId) {
      const accounts = await this.readAccounts();
      const wanted = sanitizeAccountId(accountId);
      if (!accounts.some((entry) => entry.id === wanted)) {
        const error = new Error("No account is stored under that name.");
        error.status = 404;
        throw error;
      }
      const next = accounts.map((entry) => (
        entry.id === wanted ? { ...entry, activeTourId: tourId || null } : entry
      ));
      await backend.write(ACCOUNTS_PATH, JSON.stringify({ accounts: next }, null, 2));
      return next.find((entry) => entry.id === wanted);
    },

    // The row only. Everything the account stored is removed by the caller,
    // which holds the backend and can say how much it removed.
    async removeAccount(accountId) {
      const accounts = await this.readAccounts();
      const wanted = sanitizeAccountId(accountId);
      const account = accounts.find((entry) => entry.id === wanted);
      if (!account) {
        const error = new Error("No account is stored under that name.");
        error.status = 404;
        throw error;
      }
      const next = accounts.filter((entry) => entry.id !== wanted);
      await backend.write(ACCOUNTS_PATH, JSON.stringify({ accounts: next }, null, 2));
      return account;
    },

    // Everyone Meridian holds, across every account and the admin list, with
    // the document each of them is stored in. Reading all of them is what makes
    // an email unique across accounts and lets a link be completed without the
    // person naming which account they belong to.
    async everyPerson() {
      const found = [];
      for (const person of await this.readAdmins()) found.push({ person, path: ADMINS_PATH, accountId: null });
      for (const entry of await this.readAccounts()) {
        const scoped = createOrgStore({ backend, account: entry, env });
        for (const person of await scoped.readUsers()) {
          found.push({ person, path: usersPath(entry.id), accountId: entry.id });
        }
      }
      return found;
    },

    // Writing one person back into whichever document they belong in. A role
    // change moves them, because an admin belongs to no account and a client
    // belongs to one.
    async writePerson(next, previousPath) {
      const path = next.role === OPERATOR_ROLE ? ADMINS_PATH : usersPath(next.accountId);
      if (previousPath && previousPath !== path) {
        const body = await backend.read(previousPath);
        const stored = body ? JSON.parse(body) : { users: [] };
        const users = (stored.users || []).filter((entry) => entry.id !== next.id);
        await backend.write(previousPath, JSON.stringify({ ...stored, users }, null, 2));
      }
      const body = await backend.read(path);
      const stored = body ? JSON.parse(body) : {};
      const users = Array.isArray(stored.users) ? stored.users.slice() : [];
      const at = users.findIndex((entry) => entry.id === next.id);
      if (at === -1) users.push(next);
      else users[at] = next;
      const document = next.role === OPERATOR_ROLE
        ? { users }
        : { account: { id: next.accountId, name: next.accountId }, ...stored, users };
      await backend.write(path, JSON.stringify(document, null, 2));
      return next;
    },

    async findPerson(personId) {
      return (await this.everyPerson()).find((entry) => entry.person.id === personId) || null;
    },

    async markIntroductionSeen(personId, now = new Date()) {
      const found = await this.findPerson(personId);
      if (!found) {
        const error = new Error("No person is stored under that name.");
        error.status = 404;
        throw error;
      }
      const next = recordExperienceSeen(found.person, CLIENT_INTRODUCTION, now);
      if (next !== found.person) await this.writePerson(next, found.path);
      return publicUser(next);
    },

    async markReviewVersionSeen(personId, accountId, tourId, sceneId, version, now = new Date()) {
      const found = await this.findPerson(personId);
      if (!found) {
        const error = new Error("No person is stored under that name.");
        error.status = 404;
        throw error;
      }
      const experience = reviewVersionExperience(accountId, tourId, sceneId, version);
      const next = recordExperienceSeen(found.person, experience, now);
      if (next !== found.person) await this.writePerson(next, found.path);
      return { experience, seenAt: next.experiencesSeen[experience], user: publicUser(next) };
    },

    // Inviting somebody. The link is handed back once and never stored, so an
    // admin who loses it sends a new one rather than reading the old one back.
    async invitePerson(accountId, fields) {
      const person = buildPerson(fields, sanitizeAccountId(accountId));
      const taken = (await this.everyPerson()).find((entry) => normalizeEmail(entry.person.login) === person.login);
      if (taken) {
        const error = new Error("Somebody already signs in with that email.");
        error.status = 409;
        throw error;
      }
      const minted = mintLink("invite");
      await this.writePerson({ ...person, link: minted.link });
      return { person: publicPerson({ ...person, link: minted.link }), token: minted.token };
    },

    async mintPersonLink(personId, purpose) {
      const found = await this.findPerson(personId);
      if (!found) {
        const error = new Error("No person is stored under that name.");
        error.status = 404;
        throw error;
      }
      if (found.person.status === DEACTIVATED) {
        const error = new Error("This person cannot sign in. Turn them back on before sending a link.");
        error.status = 409;
        throw error;
      }
      const minted = mintLink(purpose);
      const next = { ...found.person, link: minted.link };
      await this.writePerson(next, found.path);
      return { person: publicPerson(next), token: minted.token };
    },

    async clearPersonLink(personId) {
      const found = await this.findPerson(personId);
      if (!found) {
        const error = new Error("No person is stored under that name.");
        error.status = 404;
        throw error;
      }
      const next = { ...found.person, link: null };
      await this.writePerson(next, found.path);
      return publicPerson(next);
    },

    async editPerson(personId, fields) {
      const found = await this.findPerson(personId);
      if (!found) {
        const error = new Error("No person is stored under that name.");
        error.status = 404;
        throw error;
      }
      const role = validRole(fields.role) || found.person.role;
      const email = validEmail(fields.email);
      if (!email) {
        const error = new Error("That email address does not look like one. The email is how they sign in.");
        error.status = 400;
        throw error;
      }
      const displayName = displayNameFor(fields.firstName, fields.lastName);
      if (!displayName) {
        const error = new Error("Give this person a name. It is the name that stays on everything they approve.");
        error.status = 400;
        throw error;
      }
      const taken = (await this.everyPerson())
        .find((entry) => entry.person.id !== personId && normalizeEmail(entry.person.login) === email);
      if (taken) {
        const error = new Error("Somebody already signs in with that email.");
        error.status = 409;
        throw error;
      }
      const next = {
        ...found.person,
        firstName: String(fields.firstName || "").trim(),
        lastName: String(fields.lastName || "").trim(),
        displayName,
        phone: String(fields.phone || "").trim(),
        email,
        login: email,
        role,
        accountId: role === OPERATOR_ROLE ? null : (found.accountId || found.person.accountId),
      };
      await this.writePerson(next, found.path);
      return publicPerson(next);
    },

    // Turning somebody off keeps their name on everything they decided and
    // stops them signing in. It is the only way out for a person who has ever
    // signed in.
    async setPersonStatus(personId, status) {
      const found = await this.findPerson(personId);
      if (!found) {
        const error = new Error("No person is stored under that name.");
        error.status = 404;
        throw error;
      }
      const next = {
        ...found.person,
        status,
        link: status === DEACTIVATED ? null : found.person.link,
      };
      await this.writePerson(next, found.path);
      return publicPerson(next);
    },

    async removePerson(personId) {
      const found = await this.findPerson(personId);
      if (!found) {
        const error = new Error("No person is stored under that name.");
        error.status = 404;
        throw error;
      }
      if (!publicPerson(found.person).deletable) {
        const error = new Error("This person has signed in. Turn them off instead, so the record keeps their name on what they decided.");
        error.status = 409;
        throw error;
      }
      const body = await backend.read(found.path);
      const stored = body ? JSON.parse(body) : { users: [] };
      const users = (stored.users || []).filter((entry) => entry.id !== personId);
      await backend.write(found.path, JSON.stringify({ ...stored, users }, null, 2));
      return publicPerson(found.person);
    },

    // Completing an invite or a reset. The link goes with it, so the same one
    // cannot be used twice.
    async completeLink(token, password) {
      const now = new Date();
      const found = (await this.everyPerson()).find((entry) => linkMatches(entry.person.link, token, now));
      if (!found) {
        const error = new Error("That link has expired or has already been used. Ask for a new one.");
        error.status = 400;
        throw error;
      }
      if (String(password || "").length < 10) {
        const error = new Error("Use at least ten characters.");
        error.status = 400;
        throw error;
      }
      const next = {
        ...found.person,
        password: hashPassword(String(password)),
        status: ACTIVE,
        link: null,
        acceptedAt: found.person.acceptedAt || now.toISOString(),
      };
      await this.writePerson(next, found.path);
      return publicUser(next);
    },

    async findUser(userId) {
      const users = await this.everyone();
      return publicUser(users.find((entry) => entry.id === userId) || null);
    },

    // A wrong login and a wrong password fail the same way and say the same
    // thing, so the page never tells someone which half they got right.
    async signIn(login, password) {
      const users = await this.everyone();
      const wanted = String(login || "").trim().toLowerCase();
      const user = users.find((entry) => String(entry.login).toLowerCase() === wanted);
      if (!user) return null;
      // A person who has been turned off, and a person who has been invited and
      // has not set a password, both fail here rather than at a second check a
      // caller might forget.
      if (user.status === DEACTIVATED || !user.password) return null;
      if (!passwordMatches(String(password || ""), user.password)) return null;
      return publicUser(user);
    },
  };
}
