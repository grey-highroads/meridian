import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryBackend, pathFor } from "../src/artist/store.js";
import { copyArtistToAccountPath, oldPrefix, uniformPrefix } from "../scripts/copy-artist-to-account-path.js";

const ACCOUNT = "dierks-bentley";
const ARTIST = "dierks-bentley";
const OLD = oldPrefix(ARTIST);
const NEW = uniformPrefix(ACCOUNT, ARTIST);

// A fourth document nobody remembered sits alongside the three we know about,
// so a hard-coded list of record, decisions and prior would leave it behind.
const DOCUMENTS = {
  [`${OLD}record.json`]: '{"artist":"Dierks Bentley"}',
  [`${OLD}decisions.json`]: '{"brain":{"approvedBy":"Higher Roads"}}',
  [`${OLD}prior.json`]: '{"prior":"unresearched"}',
  [`${OLD}looks.json`]: '{"looks":[]}',
};

function seeded(extra = {}) {
  return createMemoryBackend({ ...DOCUMENTS, ...extra });
}

function collector() {
  const lines = [];
  return { lines, log: (line) => lines.push(line) };
}

async function contents(backend, paths) {
  const out = {};
  for (const path of paths) out[path] = await backend.read(path);
  return out;
}

test("the uniform target is the shape pathFor already gives every other account", () => {
  assert.equal(uniformPrefix("other-account", ARTIST) + "record.json", pathFor(ARTIST, "record", "other-account"));
  // The old shape is what pathFor still returns for the demo account today.
  assert.equal(OLD + "record.json", pathFor(ARTIST, "record", ACCOUNT));
});

test("every document under the old prefix lands at the uniform path and the old paths are untouched", async () => {
  const backend = seeded();
  const { lines, log } = collector();
  await copyArtistToAccountPath({ backend, accountId: ACCOUNT, artistId: ARTIST, log });

  assert.deepEqual(await contents(backend, Object.keys(DOCUMENTS)), DOCUMENTS);
  assert.deepEqual(await contents(backend, ["record", "decisions", "prior", "looks"].map((name) => `${NEW}${name}.json`)), {
    [`${NEW}record.json`]: DOCUMENTS[`${OLD}record.json`],
    [`${NEW}decisions.json`]: DOCUMENTS[`${OLD}decisions.json`],
    [`${NEW}prior.json`]: DOCUMENTS[`${OLD}prior.json`],
    [`${NEW}looks.json`]: DOCUMENTS[`${OLD}looks.json`],
  });
  assert.equal(backend.files.size, 8);

  // One line per document, naming both paths, the byte count and the verdict.
  assert.equal(lines.length, 5);
  for (const line of lines.slice(0, 4)) {
    assert.match(line, /^brand-world-system\/clients\/.+ to brand-world-system\/clients\/.+, \d+ bytes, matched$/);
  }
  assert.match(lines[4], /^Copied 4 documents\./);
});

test("a document nobody listed by name is copied too", async () => {
  const backend = seeded({ [`${OLD}notes/extra.json`]: '{"note":"kept"}' });
  await copyArtistToAccountPath({ backend, accountId: ACCOUNT, artistId: ARTIST, log: () => {} });
  assert.equal(await backend.read(`${NEW}notes/extra.json`), '{"note":"kept"}');
});

test("a target already holding different bytes is overwritten and still compares equal", async () => {
  const backend = seeded({ [`${NEW}record.json`]: '{"artist":"stale"}' });
  await copyArtistToAccountPath({ backend, accountId: ACCOUNT, artistId: ARTIST, log: () => {} });
  assert.equal(await backend.read(`${NEW}record.json`), DOCUMENTS[`${OLD}record.json`]);
  assert.equal(await backend.read(`${OLD}record.json`), DOCUMENTS[`${OLD}record.json`]);
});

test("a second run copies the same bytes over the same bytes and reports the same result", async () => {
  const backend = seeded();
  const first = collector();
  await copyArtistToAccountPath({ backend, accountId: ACCOUNT, artistId: ARTIST, log: first.log });
  const after = await contents(backend, [...backend.files.keys()]);

  const second = collector();
  await copyArtistToAccountPath({ backend, accountId: ACCOUNT, artistId: ARTIST, log: second.log });
  assert.deepEqual(await contents(backend, [...backend.files.keys()]), after);
  assert.equal(backend.files.size, 8);
  assert.deepEqual(second.lines, first.lines);
});

test("the uniform directory is never read back as a source", async () => {
  const backend = seeded();
  await copyArtistToAccountPath({ backend, accountId: ACCOUNT, artistId: ARTIST, log: () => {} });
  await copyArtistToAccountPath({ backend, accountId: ACCOUNT, artistId: ARTIST, log: () => {} });
  const nested = [...backend.files.keys()].filter((path) => path.startsWith(`${NEW}artists/`));
  assert.deepEqual(nested, []);
  assert.equal(backend.files.size, 8);
});

test("a body that differs after the write is reported as a failure and stops the run", async () => {
  const backend = seeded();
  // decisions.json sorts first, so a drifted write there proves the run stops
  // before it reaches the documents that follow it.
  const drifting = {
    ...backend,
    read: (path) => backend.read(path),
    list: (prefix) => backend.list(prefix),
    write: (path, body) => backend.write(path, path === `${NEW}decisions.json` ? `${body} drift` : body),
  };
  const { lines, log } = collector();

  await assert.rejects(
    copyArtistToAccountPath({ backend: drifting, accountId: ACCOUNT, artistId: ARTIST, log }),
    /does not hold the same bytes/,
  );

  assert.equal(await backend.read(`${NEW}decisions.json`), `${DOCUMENTS[`${OLD}decisions.json`]} drift`);
  assert.equal(await backend.read(`${NEW}looks.json`), null);
  assert.equal(await backend.read(`${NEW}prior.json`), null);
  assert.equal(await backend.read(`${NEW}record.json`), null);
  assert.deepEqual(await contents(backend, Object.keys(DOCUMENTS)), DOCUMENTS);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /did not match$/);
});

test("an empty old prefix copies nothing and says so", async () => {
  const backend = createMemoryBackend({ [`${NEW}record.json`]: '{"artist":"already here"}' });
  const { lines, log } = collector();
  await copyArtistToAccountPath({ backend, accountId: ACCOUNT, artistId: ARTIST, log });
  assert.equal(backend.files.size, 1);
  assert.equal(await backend.read(`${NEW}record.json`), '{"artist":"already here"}');
  assert.deepEqual(lines, [`Nothing found under ${OLD}. No documents were copied.`]);
});

test("a missing account id or artist id refuses before touching storage", async () => {
  const backend = seeded();
  const before = await contents(backend, [...backend.files.keys()]);
  await assert.rejects(copyArtistToAccountPath({ backend, artistId: ARTIST }), /account id is required/);
  await assert.rejects(copyArtistToAccountPath({ backend, accountId: ACCOUNT }), /artist id is required/);
  assert.deepEqual(await contents(backend, [...backend.files.keys()]), before);
  assert.equal(backend.files.size, 4);
});
