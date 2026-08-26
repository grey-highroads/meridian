import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createBlobBackend, createMemoryBackend } from "../artist/store.js";
import { ownEntry } from "../lookup.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "./roles.js";

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
      return [...(await this.readAdmins()), ...(await this.readUsers())];
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
      if (!passwordMatches(String(password || ""), user.password)) return null;
      return publicUser(user);
    },
  };
}
