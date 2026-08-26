import assert from "node:assert/strict";
import test from "node:test";
import { collectPages, createMemoryBackend, removeInBatches } from "../src/artist/store.js";

// The two directories differ by more than a separator on purpose. A prefix of
// `.../dierks/` must not reach `.../dierks-bentley/`, which is the case that
// separates a path prefix from a string that merely starts the same way.
const DIERKS = "brand-world-system/clients/dierks/";
const NEIGHBOUR = "brand-world-system/clients/dierks-bentley/";

function seeded() {
  return createMemoryBackend({
    [`${DIERKS}record.json`]: "record",
    [`${DIERKS}decisions.json`]: "decisions",
    [`${DIERKS}prior.json`]: "prior",
    [`${NEIGHBOUR}record.json`]: "neighbour record",
  });
}

async function contents(backend, paths) {
  const out = {};
  for (const path of paths) out[path] = await backend.read(path);
  return out;
}

test("a prefix with nothing under it lists as empty", async () => {
  const backend = seeded();
  assert.deepEqual(await backend.list("brand-world-system/clients/nobody/"), []);
});

test("a prefix lists every path under it", async () => {
  const backend = seeded();
  const listed = await backend.list(DIERKS);
  assert.deepEqual(listed.sort(), [`${DIERKS}decisions.json`, `${DIERKS}prior.json`, `${DIERKS}record.json`]);
});

test("a prefix does not list a neighbour whose name starts the same way", async () => {
  const backend = seeded();
  const listed = await backend.list(DIERKS);
  assert.equal(listed.length, 3);
  assert.ok(!listed.some((path) => path.startsWith(NEIGHBOUR)));
  // The neighbour is still there to be found under its own prefix.
  assert.deepEqual(await backend.list(NEIGHBOUR), [`${NEIGHBOUR}record.json`]);
});

test("a listing longer than one page returns every path", async () => {
  const seed = {};
  for (let index = 0; index < 7; index += 1) seed[`${DIERKS}source-${index}.json`] = String(index);
  const backend = createMemoryBackend(seed, { pageSize: 2 });
  const listed = await backend.list(DIERKS);
  assert.equal(listed.length, 7);
  assert.deepEqual(listed.sort(), Object.keys(seed).sort());
});

test("removing some paths leaves the others exactly as they were", async () => {
  const backend = seeded();
  await backend.remove([`${DIERKS}prior.json`, `${NEIGHBOUR}record.json`]);
  assert.deepEqual(await contents(backend, [`${DIERKS}record.json`, `${DIERKS}decisions.json`]), {
    [`${DIERKS}record.json`]: "record",
    [`${DIERKS}decisions.json`]: "decisions",
  });
  assert.equal(await backend.read(`${DIERKS}prior.json`), null);
  assert.equal(await backend.read(`${NEIGHBOUR}record.json`), null);
  assert.deepEqual((await backend.list(DIERKS)).sort(), [`${DIERKS}decisions.json`, `${DIERKS}record.json`]);
});

test("removing everything under a prefix empties it and touches nothing else", async () => {
  const backend = seeded();
  await backend.remove(await backend.list(DIERKS));
  assert.deepEqual(await backend.list(DIERKS), []);
  assert.equal(await backend.read(`${NEIGHBOUR}record.json`), "neighbour record");
});

test("removing nothing is not an error and changes nothing", async () => {
  const backend = seeded();
  const before = await contents(backend, [...backend.files.keys()]);
  await backend.remove([]);
  await backend.remove(undefined);
  assert.deepEqual(await contents(backend, [...backend.files.keys()]), before);
  assert.equal(backend.files.size, 4);
});

test("a removal longer than one batch removes every path", async () => {
  const seed = {};
  for (let index = 0; index < 7; index += 1) seed[`${DIERKS}source-${index}.json`] = String(index);
  seed[`${NEIGHBOUR}record.json`] = "neighbour record";
  const backend = createMemoryBackend(seed, { pageSize: 2 });
  await backend.remove(await backend.list(DIERKS));
  assert.deepEqual(await backend.list(DIERKS), []);
  assert.equal(await backend.read(`${NEIGHBOUR}record.json`), "neighbour record");
});

// The blob backend cannot be reached without a network call, so the paging and
// batching it depends on are tested here directly. These are the same two
// functions both backends call.

test("collectPages follows the cursor until it runs out", async () => {
  const pages = [
    { paths: ["a", "b"], cursor: "1" },
    { paths: ["c", "d"], cursor: "2" },
    { paths: ["e"], cursor: undefined },
  ];
  const seen = [];
  const collected = await collectPages(async (cursor) => {
    seen.push(cursor);
    return pages[seen.length - 1];
  });
  assert.deepEqual(collected, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(seen, [undefined, "1", "2"]);
});

test("collectPages returns empty when the first page is empty", async () => {
  assert.deepEqual(await collectPages(async () => ({ paths: [], cursor: undefined })), []);
});

test("removeInBatches deletes every path in bounded calls", async () => {
  const calls = [];
  const count = await removeInBatches(["a", "b", "c", "d", "e"], async (batch) => calls.push(batch), 2);
  assert.equal(count, 5);
  assert.deepEqual(calls, [["a", "b"], ["c", "d"], ["e"]]);
});

test("removeInBatches drops duplicates and empty values and makes no call for none", async () => {
  const calls = [];
  assert.equal(await removeInBatches(["a", "a", "", null, "b"], async (batch) => calls.push(batch), 10), 2);
  assert.deepEqual(calls, [["a", "b"]]);
  assert.equal(await removeInBatches([], async (batch) => calls.push(batch), 10), 0);
  assert.equal(await removeInBatches(undefined, async (batch) => calls.push(batch), 10), 0);
  assert.equal(calls.length, 1);
});
