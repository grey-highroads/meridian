import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import middleware from "../middleware.js";
import {
  ACCOUNT,
  ADMINS_PATH,
  CLIENT_ROLE,
  createMemoryBackend,
  createOrgStore,
  OPERATOR_ROLE,
  parseSeed,
  usersPath,
} from "../src/org/store.js";
import { resolveActingAccount } from "../src/org/acting-account.js";
import { readCookie, SESSION_COOKIE, readSession, sessionCookie, signSession } from "../src/org/session.js";
import { readSessionUser } from "../src/server/http.js";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ENV = {
  MERIDIAN_OPERATOR: "ray:one-password:Ray Mercer",
  MERIDIAN_CLIENT: "dana:another-password:Dana Whitlock",
};

const SECRET = "test-secret";

function ready() {
  const backend = createMemoryBackend();
  return { backend, store: createOrgStore({ backend, env: ENV }) };
}

test("the two people are written once and a second read changes nothing", async () => {
  const { backend, store } = ready();
  const first = await store.readUsers();
  const admins = await store.readAdmins();
  const written = backend.files.get(usersPath());
  const writtenAdmins = backend.files.get(ADMINS_PATH);

  // The client belongs to the account and is stored under it. The Higher Roads
  // admin belongs to none and is stored beside the account list.
  assert.equal(first.length, 1);
  assert.equal(first[0].accountId, ACCOUNT.id);
  assert.equal(admins.length, 1);
  assert.equal(admins[0].accountId, null);
  assert.notEqual(ADMINS_PATH, usersPath(), "admins are stored inside the account");
  assert.ok(!ADMINS_PATH.includes("/clients/"), "admins are stored under an account");

  const second = await store.readUsers();
  assert.equal(backend.files.get(usersPath()), written, "the second read rewrote the account");
  assert.equal(backend.files.get(ADMINS_PATH), writtenAdmins, "the second read rewrote the admins");
  assert.deepEqual(second, first);

  // A second store over the same storage reads the same people rather than
  // seeding a second set, so a session signed earlier still resolves.
  const again = createOrgStore({ backend, env: ENV });
  assert.deepEqual(await again.readUsers(), first);
  assert.deepEqual(await again.readAdmins(), admins);
  assert.equal(backend.files.get(usersPath()), written);
});

test("an admin row left inside an account gives that person no account scope", async () => {
  const { backend, store } = ready();

  // What a deployment written before admins moved out still holds: both people
  // in the account's own document.
  backend.files.set(usersPath(), JSON.stringify({
    account: ACCOUNT,
    users: [
      { id: "operator", login: "ray", displayName: "Ray Mercer", role: OPERATOR_ROLE, accountId: ACCOUNT.id, password: "scrypt$a$b" },
      { id: "client", login: "dana", displayName: "Dana Whitlock", role: CLIENT_ROLE, accountId: ACCOUNT.id, password: "scrypt$c$d" },
    ],
  }));

  const users = await store.readUsers();
  assert.deepEqual(users.map((entry) => entry.id), ["client"], "the account still holds an admin");

  // The admin still signs in, from the document admins live in now, and comes
  // back carrying no account.
  const signedIn = await store.signIn("ray", "one-password");
  assert.equal(signedIn.role, OPERATOR_ROLE);
  assert.equal(signedIn.accountId, null);
  assert.equal(resolveActingAccount(signedIn), null, "an admin resolved into an account of their own");
  assert.equal(resolveActingAccount(signedIn, "stagecraft"), "stagecraft");

  // The client is unchanged and stays pinned to the account they belong to.
  const client = await store.findUser("client");
  assert.equal(client.accountId, ACCOUNT.id);
  assert.equal(resolveActingAccount(client, "stagecraft"), ACCOUNT.id);
});

test("an admin naming no account lands in the first account the deployment holds", async () => {
  const { backend, store } = ready();
  await store.createAccount("Stagecraft");
  const token = await signSession({ userId: "operator", role: OPERATOR_ROLE }, SECRET);
  const request = { headers: { cookie: sessionCookie(token, {}).split(";")[0] } };

  const user = await readSessionUser(request, { orgStore: store, secret: SECRET });
  assert.equal(user.accountId, null, "the admin record carries an account");
  assert.equal(user.actingAccount, ACCOUNT.id);

  const accounts = await store.readAccounts();
  assert.deepEqual(accounts.map((entry) => entry.id), [ACCOUNT.id, "stagecraft"]);
  assert.ok(backend.files.get(ADMINS_PATH));
});

test("a seed value states a login, a password, and a name", () => {
  assert.deepEqual(parseSeed("ray:one-password:Ray Mercer"), {
    login: "ray",
    password: "one-password",
    displayName: "Ray Mercer",
  });
  // Only the first two separators separate. The name keeps the rest.
  assert.equal(parseSeed("ray:one-password:Mercer: Ray").displayName, "Mercer: Ray");
  for (const bad of ["", "ray", "ray:one-password", ":one-password:Ray", "ray::Ray", "ray:one-password:"]) {
    assert.equal(parseSeed(bad), null, `"${bad}" was read as a person`);
  }
});

test("a session verifies for the person it was signed for and for nobody else", async () => {
  const token = await signSession({ userId: "operator", role: OPERATOR_ROLE }, SECRET);
  assert.deepEqual(await readSession(token, SECRET), { userId: "operator", role: OPERATOR_ROLE });

  // A forged or edited cookie is no session at all.
  const [body, signature] = token.split(".");
  const other = await signSession({ userId: "client", role: CLIENT_ROLE }, SECRET);
  assert.equal(await readSession(token, "a different secret"), null, "a session verified under the wrong key");
  assert.equal(await readSession(`${other.split(".")[0]}.${signature}`, SECRET), null, "an edited claim verified");
  assert.equal(await readSession(`${body}.${signature.slice(0, -2)}xx`, SECRET), null, "a bent signature verified");
  assert.equal(await readSession(body, SECRET), null);
  assert.equal(await readSession("", SECRET), null);
  assert.equal(await readSession(null, SECRET), null);
});

test("a request resolves to the stored person, and the role it uses is the stored one", async () => {
  const { backend, store } = ready();
  const token = await signSession({ userId: "client", role: OPERATOR_ROLE }, SECRET);
  const request = { headers: { cookie: sessionCookie(token, {}).split(";")[0] } };

  // The cookie claims the Higher Roads role. The user in storage is the client
  // reviewer, and that is the role that comes back.
  const user = await readSessionUser(request, { orgStore: store, secret: SECRET });
  assert.equal(user.role, CLIENT_ROLE);
  assert.equal(user.displayName, "Dana Whitlock");
  assert.equal(user.roleLabel, "Client reviewer");
  assert.equal(user.password, undefined, "a password hash left the store");

  assert.equal(await readSessionUser({ headers: {} }, { orgStore: store, secret: SECRET }), null);
  const forged = { headers: { cookie: `${SESSION_COOKIE}=made.up` } };
  assert.equal(await readSessionUser(forged, { orgStore: store, secret: SECRET }), null);

  const unknown = await signSession({ userId: "someone-else", role: OPERATOR_ROLE }, SECRET);
  assert.equal(
    await readSessionUser({ headers: { cookie: `${SESSION_COOKIE}=${unknown}` } }, { orgStore: store, secret: SECRET }),
    null,
    "a session for a person who does not exist resolved",
  );
  assert.ok(backend.files.get(usersPath()));
});

test("the cookie is not readable by scripts and clears on the way out", () => {
  const set = sessionCookie("a-token", { secure: true });
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Lax/);
  assert.match(set, /Secure/);
  assert.match(set, /Max-Age=86400/);
  assert.match(sessionCookie("", { secure: true }), /Max-Age=0/);
  assert.doesNotMatch(sessionCookie("a-token", {}), /Secure/);
  assert.equal(readCookie(`other=1; ${SESSION_COOKIE}=a-token`, SESSION_COOKIE), "a-token");
  assert.equal(readCookie("other=1", SESSION_COOKIE), null);
});

test("the front door turns away anyone without a session and keeps internal surfaces on the Higher Roads side", async () => {
  const secret = `meridian-session:${ENV.MERIDIAN_OPERATOR}:${ENV.MERIDIAN_CLIENT}`;
  const saved = { operator: process.env.MERIDIAN_OPERATOR, client: process.env.MERIDIAN_CLIENT };
  process.env.MERIDIAN_OPERATOR = ENV.MERIDIAN_OPERATOR;
  process.env.MERIDIAN_CLIENT = ENV.MERIDIAN_CLIENT;
  try {
    const at = (pathname, cookie) => new Request(`https://meridian.test${pathname}`, {
      headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {},
    });

    const away = await middleware(at("/scene.html"));
    assert.equal(away.status, 302);
    assert.equal(new URL(away.headers.get("location")).pathname, "/landing.html");
    assert.equal((await middleware(at("/api/tour"))).status, 401);
    assert.equal((await middleware(at("/scene.html", "made.up"))).status, 302);

    const client = await signSession({ userId: "client", role: CLIENT_ROLE }, secret);
    const refused = await middleware(at("/review.html", client));
    assert.equal(refused.status, 403);
    const words = await refused.text();
    assert.match(words, /Higher Roads team/);
    assert.ok(!words.includes("\u2014"));
    assert.equal((await middleware(at("/api/artist", client))).status, 403);
    assert.equal((await middleware(at("/bws.html", client))).status, 403);

    assert.equal((await middleware(at("/", client))).status, 200);
    assert.equal((await middleware(at("/scenes.html", client))).status, 200);
    assert.equal((await middleware(at("/scene.html", client))).status, 200);
    assert.equal((await middleware(at("/request.html", client))).status, 200);
    assert.equal((await middleware(at("/direction.html", client))).status, 200);
    assert.equal((await middleware(at("/handoff.html", client))).status, 200);
    assert.equal((await middleware(at("/api/tour-upload", client))).status, 200);
  } finally {
    process.env.MERIDIAN_OPERATOR = saved.operator;
    process.env.MERIDIAN_CLIENT = saved.client;
  }
});

test("the sign in page says what a person needs and no system words", () => {
  const page = fs.readFileSync(path.join(rootPath, "app", "landing.html"), "utf8");
  const copy = page.replace(/<[^>]*>/g, " ");
  for (const word of ["bin", "facet", "governance", "candidate", "proposed", "session", "credential"]) {
    assert.ok(!new RegExp(`\\b${word}`, "i").test(copy), `the sign in page says "${word}" to a person`);
  }
  assert.ok(!page.includes("\u2014"), "the sign in page carries an em dash");
  assert.match(page, /Use the login and password Higher Roads gave you\./);
  assert.match(page, /login, password/);
  assert.ok(!page.includes("brandworld"), "the sign in page still names the old shared login");
});
