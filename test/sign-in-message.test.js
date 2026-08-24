import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import login from "../api/auth/login.js";
import { createMemoryBackend, createOrgStore } from "../src/org/store.js";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SEEDED = {
  MERIDIAN_OPERATOR: "ray:one-password:Ray Mercer",
  MERIDIAN_CLIENT: "dana:another-password:Dana Whitlock",
};

const SETUP = /sign in values set/;
const MISMATCH = /did not match/;

function storeWith(env) {
  return createOrgStore({ backend: createMemoryBackend(), env });
}

// A response the handler can write to and a test can read back.
function collector() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(text) {
      this.body = text ? JSON.parse(text) : null;
    },
  };
}

async function signIn(orgStore, credentials) {
  const request = { method: "POST", body: JSON.stringify(credentials), headers: {} };
  const response = collector();
  await login(request, response, { orgStore });
  return response;
}

// The sign in screen, run rather than read. The page's own script is loaded
// into a context with stand-in fields, so what the test reads is the sentence
// a person would see in the box on the page.
function screenAfter(serverReply) {
  const page = fs.readFileSync(path.join(rootPath, "app", "landing.html"), "utf8");
  const blocks = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const script = blocks.find((block) => block.includes("attemptLogin"));
  assert.ok(script, "the sign in page no longer carries its own sign in script");

  const field = (value) => ({
    value,
    textContent: "",
    classList: { add() {}, remove() {}, contains: () => false },
    focus() {},
  });
  const fields = {
    "login-user": field("ray"),
    "login-pass": field("one-password"),
    loginError: field(""),
    loginOverlay: field(""),
  };
  const context = {
    document: {
      getElementById: (id) => fields[id] || field(""),
      addEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    window: { location: { href: "" } },
    setTimeout() {},
    fetch: async () => ({ json: async () => serverReply }),
    console,
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { run: () => context.attemptLogin(), error: fields.loginError };
}

test("sign in with no seed values says the deployment needs setting up, not that the password was wrong", async () => {
  const response = await signIn(storeWith({}), { login: "ray", password: "one-password" });

  assert.equal(response.statusCode, 503);
  assert.match(response.body.error, SETUP);
  assert.doesNotMatch(response.body.error, MISMATCH, "a missing seed value still reads as a typo");

  const screen = screenAfter(response.body);
  await screen.run();
  assert.match(screen.error.textContent, SETUP, "the setup sentence never reached the screen");
  assert.doesNotMatch(screen.error.textContent, MISMATCH, "the screen still sends the person hunting a typo");
});

test("sign in with the seed values set and the wrong password says the two did not match", async () => {
  const response = await signIn(storeWith(SEEDED), { login: "ray", password: "not-the-password" });

  assert.equal(response.statusCode, 401);
  assert.match(response.body.error, MISMATCH);
  assert.doesNotMatch(response.body.error, SETUP);

  const screen = screenAfter(response.body);
  await screen.run();
  assert.match(screen.error.textContent, MISMATCH, "the mismatch sentence never reached the screen");
  assert.doesNotMatch(screen.error.textContent, SETUP);

  // An unknown login fails the same way, so the page never says which half was
  // right.
  const unknown = await signIn(storeWith(SEEDED), { login: "nobody", password: "one-password" });
  assert.deepEqual(unknown.body, response.body);
});

test("sign in with the seed values set and the right credentials signs the person in", async () => {
  const response = await signIn(storeWith(SEEDED), { login: "ray", password: "one-password" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.user.displayName, "Ray Mercer");
  assert.equal(response.body.user.password, undefined, "a password hash left the store");
  assert.match(response.headers["set-cookie"], /HttpOnly/);

  const screen = screenAfter(response.body);
  await screen.run();
  assert.equal(screen.error.textContent, "", "a successful sign in still put a sentence in the error box");
});
