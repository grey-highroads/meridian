import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import login from "../api/auth/login.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { ACCOUNT, CLIENT_ROLE, OPERATOR_ROLE, createOrgStore, usersPath, ADMINS_PATH } from "../src/org/store.js";

// Brief 4 of docs/spec-admin-surface.md. A person carries a name, a phone, an
// email that is their login, and whether they are a client or Higher Roads. An
// admin never sets somebody else's password; they send a link.

const DEMO = ACCOUNT.id;
const SEEDS = {
  MERIDIAN_OPERATOR: "ray@higherroads.co:one-password-here:Ray Mercer",
  MERIDIAN_CLIENT: "dana@northstar.co:another-password:Dana Whitlock",
};

// An admin belongs to no account and works inside the one the session resolved,
// which is what readSessionUser hands the route in the app.
const OPERATOR = { id: "operator", displayName: "Ray Mercer", role: OPERATOR_ROLE, accountId: null, actingAccount: DEMO };
const CLIENT = { id: "client", displayName: "Dana Whitlock", role: CLIENT_ROLE, accountId: DEMO };

function options(backend, user = OPERATOR) {
  return {
    user,
    store: createArtistStore({ backend, accountId: DEMO }),
    orgStore: createOrgStore({ backend, env: SEEDS }),
  };
}

const WHO = { firstName: "Tess", lastName: "Aguilar", email: "Tess@Northstar.co", phone: "615 555 0134", role: CLIENT_ROLE };

async function invite(backend, person = WHO) {
  return await artistAction({ action: "invite-person", person }, options(backend));
}

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(text) { this.body = text ? JSON.parse(text) : null; },
  };
}

async function postAuth(backend, payload) {
  const response = fakeResponse();
  const request = { method: "POST", url: "/api/auth/login", headers: {}, body: JSON.stringify(payload) };
  request[Symbol.asyncIterator] = async function* () { yield Buffer.from(request.body); };
  await login(request, response, { orgStore: createOrgStore({ backend, env: SEEDS }) });
  return response;
}

test("inviting somebody stores them, hands back one link, and never stores the link itself", async () => {
  const backend = createMemoryBackend();
  const { person, link } = await invite(backend);

  assert.equal(person.displayName, "Tess Aguilar");
  // The email is the login and is stored the same way however it was typed.
  assert.equal(person.email, "tess@northstar.co");
  assert.equal(person.login, "tess@northstar.co");
  assert.equal(person.status, "invited");
  assert.ok(person.invitePending);
  assert.ok(link.startsWith("/set-password.html?token="));

  const token = new URL(link, "http://meridian.local").searchParams.get("token");
  const stored = JSON.parse(backend.files.get(usersPath(DEMO)));
  const row = stored.users.find((entry) => entry.id === person.id);
  assert.ok(row, "the person was not stored under the account");
  assert.equal(row.password, null, "a password was set for somebody who has not chosen one");
  assert.ok(!JSON.stringify(stored).includes(token), "the link is readable in storage");

  // A second person cannot take the same login, whatever case it is typed in.
  await assert.rejects(
    () => invite(backend, { ...WHO, firstName: "Other", email: "TESS@northstar.co" }),
    (error) => error.status === 409,
  );
});

test("an invited person cannot sign in until the link is used, and the link works once", async () => {
  const backend = createMemoryBackend();
  const { person, link } = await invite(backend);
  const token = new URL(link, "http://meridian.local").searchParams.get("token");

  // Nothing to sign in with yet.
  const early = await postAuth(backend, { login: "tess@northstar.co", password: "anything-at-all" });
  assert.equal(early.statusCode, 401);

  const short = await postAuth(backend, { action: "set-password", token, password: "too-short" });
  assert.equal(short.statusCode, 400);

  const done = await postAuth(backend, { action: "set-password", token, password: "a-real-password" });
  assert.equal(done.statusCode, 200);
  assert.equal(done.body.user.id, person.id);
  assert.ok(String(done.headers["set-cookie"]).length > 0, "completing the link did not sign them in");

  // Used once. The same link opens nothing after that.
  const again = await postAuth(backend, { action: "set-password", token, password: "another-password" });
  assert.equal(again.statusCode, 400);

  const signedIn = await postAuth(backend, { login: "tess@northstar.co", password: "a-real-password" });
  assert.equal(signedIn.statusCode, 200);
  assert.equal(signedIn.body.user.displayName, "Tess Aguilar");
});

test("a revoked link opens nothing and a new one replaces the one before it", async () => {
  const backend = createMemoryBackend();
  const { person, link } = await invite(backend);
  const first = new URL(link, "http://meridian.local").searchParams.get("token");

  const resent = await artistAction({ action: "resend-invite", personId: person.id }, options(backend));
  const second = new URL(resent.link, "http://meridian.local").searchParams.get("token");
  assert.notEqual(first, second);
  assert.equal((await postAuth(backend, { action: "set-password", token: first, password: "a-real-password" })).statusCode, 400);

  await artistAction({ action: "revoke-invite", personId: person.id }, options(backend));
  assert.equal((await postAuth(backend, { action: "set-password", token: second, password: "a-real-password" })).statusCode, 400);
});

test("a person who has signed in is turned off rather than deleted, and keeps their name", async () => {
  const backend = createMemoryBackend();
  const { person, link } = await invite(backend);
  const token = new URL(link, "http://meridian.local").searchParams.get("token");
  await postAuth(backend, { action: "set-password", token, password: "a-real-password" });

  const listed = await artistAction({ action: "list-people" }, options(backend));
  const found = listed.people.find((entry) => entry.id === person.id);
  assert.equal(found.status, "active");
  assert.equal(found.deletable, false);

  await assert.rejects(
    () => artistAction({ action: "delete-person", personId: person.id }, options(backend)),
    (error) => error.status === 409 && /Turn them off instead/.test(error.message),
  );

  await artistAction({ action: "deactivate-person", personId: person.id }, options(backend));
  const off = await postAuth(backend, { login: "tess@northstar.co", password: "a-real-password" });
  assert.equal(off.statusCode, 401, "somebody turned off still signed in");

  // The name is still there to read, which is what keeps an approval honest.
  const after = await artistAction({ action: "list-people" }, options(backend));
  const still = after.people.find((entry) => entry.id === person.id);
  assert.equal(still.displayName, "Tess Aguilar");
  assert.equal(still.status, "deactivated");

  await artistAction({ action: "reactivate-person", personId: person.id }, options(backend));
  assert.equal((await postAuth(backend, { login: "tess@northstar.co", password: "a-real-password" })).statusCode, 200);
});

test("a person who has never signed in is deleted outright", async () => {
  const backend = createMemoryBackend();
  const { person } = await invite(backend);
  await artistAction({ action: "delete-person", personId: person.id }, options(backend));
  const listed = await artistAction({ action: "list-people" }, options(backend));
  assert.ok(!listed.people.some((entry) => entry.id === person.id), "the person is still on the list");
  const stored = JSON.parse(backend.files.get(usersPath(DEMO)));
  assert.ok(!stored.users.some((entry) => entry.id === person.id), "the person is still stored");
});

test("making somebody Higher Roads moves them out of the account", async () => {
  const backend = createMemoryBackend();
  const { person } = await invite(backend);

  await artistAction(
    { action: "edit-person", personId: person.id, person: { ...WHO, role: OPERATOR_ROLE } },
    options(backend),
  );

  const account = JSON.parse(backend.files.get(usersPath(DEMO)));
  const admins = JSON.parse(backend.files.get(ADMINS_PATH));
  assert.ok(!account.users.some((entry) => entry.id === person.id), "they are still one of the account's people");
  const moved = admins.users.find((entry) => entry.id === person.id);
  assert.ok(moved, "they were not stored with Higher Roads");
  assert.equal(moved.accountId, null, "an admin carries an account");

  const listed = await artistAction({ action: "list-people" }, options(backend));
  assert.ok(listed.admins.some((entry) => entry.id === person.id));
  assert.ok(!listed.people.some((entry) => entry.id === person.id));
});

test("a client cannot invite, edit, turn off, or delete anybody", async () => {
  const backend = createMemoryBackend();
  const { person } = await invite(backend);
  const before = new Map(backend.files);
  for (const body of [
    { action: "invite-person", person: { ...WHO, email: "someone@else.co" } },
    { action: "edit-person", personId: person.id, person: WHO },
    { action: "deactivate-person", personId: person.id },
    { action: "delete-person", personId: person.id },
    { action: "send-reset", personId: person.id },
  ]) {
    await assert.rejects(() => artistAction(body, options(backend, CLIENT)), (error) => error.status === 400);
  }
  for (const [path, body] of backend.files) {
    assert.equal(body, before.get(path), `${path} changed on a client's attempt`);
  }
  assert.equal(backend.files.size, before.size);
});

test("an admin cannot turn themselves off", async () => {
  const backend = createMemoryBackend();
  await artistAction({ action: "list-people" }, options(backend));
  await assert.rejects(
    () => artistAction({ action: "deactivate-person", personId: "operator" }, options(backend)),
    (error) => error.status === 409,
  );
  const admins = JSON.parse(backend.files.get(ADMINS_PATH));
  assert.ok(!admins.users.some((entry) => entry.status === "deactivated"));
});
