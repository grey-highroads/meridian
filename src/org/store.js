import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createBlobBackend, createMemoryBackend } from "../artist/store.js";
import { ownEntry } from "../lookup.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "./roles.js";

export { CLIENT_ROLE, OPERATOR_ROLE };

// The organization layer, at the size the pilot needs it.
//
// One account, the artist's organization. Two people in it, each with a name, a
// login, a hashed password, and a role. Users are stored under the account and
// are seeded once from two values on the deployment. There is no signup, no
// configuration screen, and nothing here a client sets up. Higher Roads
// operates Meridian for the client.
//
// The shape is the one the thesis describes: accounts hold users, users carry
// permissions, and a tour reads those permissions to decide who may do what.
// What is deliberately small is the count, not the shape, so more people and
// more accounts are rows rather than a rebuild.

export const ACCOUNT = { id: "dierks-bentley", name: "Dierks Bentley" };

// Accounts are rows. Brief 2 of docs/spec-accounts-artists-tours.md. The demo
// account above is seeded into the list on first read; its stored data stays
// at the legacy paths it has always used, and new accounts get their own
// namespace. No delete; retirement is a later ruling.
export const ACCOUNTS_PATH = "brand-world-system/org/accounts.json";

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
    accountId: user.accountId || ACCOUNT.id,
  };
}

export { createBlobBackend, createMemoryBackend };

export function createOrgStore(options = {}) {
  const backend = options.backend || createBlobBackend(options);
  const env = options.env || process.env;
  const account = options.account || ACCOUNT;

  function seeded() {
    const operator = parseSeed(env.MERIDIAN_OPERATOR);
    const client = parseSeed(env.MERIDIAN_CLIENT);
    if (!operator || !client) {
      const error = new Error("Meridian needs both of its sign in values set before anyone can sign in.");
      error.status = 503;
      throw error;
    }
    return [
      { id: "operator", role: OPERATOR_ROLE, ...operator },
      { id: "client", role: CLIENT_ROLE, ...client },
    ].map((entry) => ({
      id: entry.id,
      login: entry.login,
      displayName: entry.displayName,
      role: entry.role,
      accountId: account.id,
      password: hashPassword(entry.password),
    }));
  }

  return {
    account,

    // Written once. A second read returns what is stored and changes nothing,
    // so the hashes stay put and a session signed yesterday still resolves.
    async readUsers() {
      const body = await backend.read(usersPath(account.id));
      if (body !== null && body !== undefined) {
        const stored = JSON.parse(body);
        if (Array.isArray(stored.users) && stored.users.length) return stored.users;
      }
      const users = seeded();
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

    async findUser(userId) {
      const users = await this.readUsers();
      return publicUser(users.find((entry) => entry.id === userId) || null);
    },

    // A wrong login and a wrong password fail the same way and say the same
    // thing, so the page never tells someone which half they got right.
    async signIn(login, password) {
      const users = await this.readUsers();
      const wanted = String(login || "").trim().toLowerCase();
      const user = users.find((entry) => String(entry.login).toLowerCase() === wanted);
      if (!user) return null;
      if (!passwordMatches(String(password || ""), user.password)) return null;
      return publicUser(user);
    },
  };
}
