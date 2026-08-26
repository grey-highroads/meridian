import assert from "node:assert/strict";
import test from "node:test";
import { handleAction } from "../api/artist/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { oldPrefix, uniformPrefix } from "../src/artist/copy-to-account-path.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "../src/org/store.js";

const ACCOUNT = "dierks-bentley";
const ARTIST = "dierks-bentley";
const OLD = oldPrefix(ARTIST);
const NEW = uniformPrefix(ACCOUNT, ARTIST);

const DOCUMENTS = {
  [`${OLD}record.json`]: '{"artist":"Dierks Bentley"}',
  [`${OLD}decisions.json`]: '{"brain":{"approvedBy":"Higher Roads"}}',
  [`${OLD}prior.json`]: '{"prior":"unresearched"}',
};

const OPERATOR = { id: "operator", role: OPERATOR_ROLE, accountId: ACCOUNT, displayName: "Grey" };
const CLIENT = { id: "client", role: CLIENT_ROLE, accountId: ACCOUNT, displayName: "Client reviewer" };

function seeded() {
  return createMemoryBackend({ ...DOCUMENTS });
}

function run(backend, user) {
  return handleAction(
    { action: "copy-artist-paths", artistId: ARTIST },
    { user, store: createArtistStore({ backend, accountId: ACCOUNT }) },
  );
}

async function contents(backend, paths) {
  const out = {};
  for (const path of paths) out[path] = await backend.read(path);
  return out;
}

test("a Higher Roads session moves every document and leaves the old files alone", async () => {
  const backend = seeded();
  const result = await run(backend, OPERATOR);

  assert.deepEqual(await contents(backend, Object.keys(DOCUMENTS)), DOCUMENTS);
  assert.deepEqual(await contents(backend, ["record", "decisions", "prior"].map((name) => `${NEW}${name}.json`)), {
    [`${NEW}record.json`]: DOCUMENTS[`${OLD}record.json`],
    [`${NEW}decisions.json`]: DOCUMENTS[`${OLD}decisions.json`],
    [`${NEW}prior.json`]: DOCUMENTS[`${OLD}prior.json`],
  });
  assert.equal(backend.files.size, 6);

  assert.equal(result.count, 3);
  assert.equal(result.lines.length, 4);
  for (const name of ["record", "decisions", "prior"]) {
    assert.ok(
      result.lines.some((line) => line.startsWith(`${OLD}${name}.json to ${NEW}${name}.json,`) && line.endsWith("matched")),
      `no line reports ${name}.json`,
    );
  }
});

test("a client session gets absence and nothing is written", async () => {
  const backend = seeded();
  await assert.rejects(run(backend, CLIENT), /not something this route does/);
  assert.deepEqual(await contents(backend, [...backend.files.keys()]), DOCUMENTS);
  assert.equal(backend.files.size, 3);
  assert.equal(await backend.read(`${NEW}record.json`), null);
});

test("a request with no session gets the same absence a client gets", async () => {
  const backend = seeded();
  await assert.rejects(run(backend, null), /not something this route does/);
  assert.equal(backend.files.size, 3);
});

test("running it twice returns the same lines and changes nothing the second time", async () => {
  const backend = seeded();
  const first = await run(backend, OPERATOR);
  const after = await contents(backend, [...backend.files.keys()]);

  const second = await run(backend, OPERATOR);
  assert.deepEqual(await contents(backend, [...backend.files.keys()]), after);
  assert.equal(backend.files.size, 6);
  assert.deepEqual(second.lines, first.lines);
  assert.equal(second.count, first.count);
});
