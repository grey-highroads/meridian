import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CLIENT_ROLE, createMemoryBackend, createOrgStore, OPERATOR_ROLE, usersPath } from "../src/org/store.js";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Vercel build keeps APIs server-side and gives synthesis a five-minute window", () => {
  const config = JSON.parse(fs.readFileSync(path.join(rootPath, "vercel.json"), "utf8"));
  assert.equal(config.outputDirectory, "dist");
  assert.equal(config.fluid, true);
  assert.equal(config.functions["api/**/*.js"].maxDuration, 300);
  assert.equal(config.headers[0].headers.find((header) => header.key === "X-Robots-Tag").value, "noindex, nofollow");
});

test("the hosted installation signs two people in and tells them apart", async () => {
  const backend = createMemoryBackend();
  const env = { MERIDIAN_OPERATOR: "ray:one-password:Ray Mercer", MERIDIAN_CLIENT: "dana:another-password:Dana Whitlock" };
  const store = createOrgStore({ backend, env });

  const operator = await store.signIn("ray", "one-password");
  assert.equal(operator.role, OPERATOR_ROLE);
  assert.equal(operator.displayName, "Ray Mercer");
  const reviewer = await store.signIn("dana", "another-password");
  assert.equal(reviewer.role, CLIENT_ROLE);
  assert.equal(reviewer.displayName, "Dana Whitlock");

  assert.equal(await store.signIn("ray", "another-password"), null, "one person's password opened another's account");
  assert.equal(await store.signIn("ray", "wrong"), null);
  assert.equal(await store.signIn("nobody", "one-password"), null);

  // The password is stored hashed and the plain text is nowhere in storage.
  const stored = backend.files.get(usersPath());
  assert.ok(!stored.includes("one-password"), "a password was stored in the clear");
  assert.ok(!stored.includes("another-password"), "a password was stored in the clear");
  assert.match(stored, /scrypt\$/);
});

test("a deployment missing its sign in values says so rather than letting anyone in", async () => {
  const store = createOrgStore({ backend: createMemoryBackend(), env: {} });
  await assert.rejects(() => store.signIn("ray", "one-password"), (error) => error.status === 503);
});

test("Blob access supports Vercel OIDC without requiring a long-lived token", () => {
  const uploadApi = fs.readFileSync(path.join(rootPath, "api", "tour-upload.js"), "utf8");
  const blobStore = fs.readFileSync(path.join(rootPath, "src", "artist", "store.js"), "utf8");
  assert.doesNotMatch(uploadApi, /if \(!process\.env\.BLOB_READ_WRITE_TOKEN\)/);
  assert.doesNotMatch(blobStore, /if \(!token\)/);
  assert.match(uploadApi, /const credentials = token \? \{ token \} : \{\}/);
  assert.match(blobStore, /const credentials = token \? \{ token \} : \{\}/);
});
