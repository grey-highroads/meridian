import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { artistRecordPath, artistsPath, createArtistDirectory } from "../src/org/artists.js";
import { createOrgStore } from "../src/org/store.js";

// Brief 3 of docs/spec-accounts-artists-tours.md. Artists were a constant map
// in api/artist/index.js and are now rows under the account that owns them.
// Every test here asserts the effect on stored bytes, not the presence of a
// field.

const DEMO = "dierks-bentley";
const OTHER = "stagecraft";

const DEMO_OPERATOR = {
  id: "operator",
  displayName: "Ray Mercer",
  role: "higher-roads",
  roleLabel: "Higher Roads",
  accountId: DEMO,
};

const OTHER_OPERATOR = {
  id: "operator-b",
  displayName: "Sam Field",
  role: "higher-roads",
  roleLabel: "Higher Roads",
  accountId: OTHER,
};

function contextFor(backend, user) {
  return { user, store: createArtistStore({ backend, accountId: user.accountId }) };
}

// The route refuses an account that is not on the list, so a test acting inside
// one puts it there first. The demo account is on the list from the first read.
async function accountExists(backend, accountId) {
  const org = createOrgStore({ backend });
  const accounts = await org.readAccounts();
  if (accounts.some((entry) => entry.id === accountId)) return;
  await org.createAccount(accountId);
}

test("the demo account with nothing stored reads Dierks Bentley, and a second read changes nothing", async () => {
  const backend = createMemoryBackend();
  const directory = createArtistDirectory({ backend, accountId: DEMO });
  assert.equal(backend.files.size, 0);

  const first = await directory.readArtists();
  assert.equal(first.length, 1);
  assert.equal(first[0].id, "dierks-bentley");
  assert.equal(first[0].name, "Dierks Bentley");
  assert.deepEqual(first[0].identities, ["main-stage", "hot-country-knights", "shared"]);

  // The seed is written, not held in memory, so the live account needs no
  // migration: the first read after this lands is the migration.
  const written = backend.files.get(artistsPath(DEMO));
  assert.ok(written);

  const second = await directory.readArtists();
  assert.deepEqual(second, first);
  assert.equal(backend.files.get(artistsPath(DEMO)), written, "the second read rewrote the list");
  assert.equal(backend.files.size, 1);
});

test("a second account starts with no artists and never inherits the demo seed", async () => {
  const backend = createMemoryBackend();
  const directory = createArtistDirectory({ backend, accountId: OTHER });
  assert.deepEqual(await directory.readArtists(), []);
  assert.equal(backend.files.size, 0, "an empty account wrote a list it does not have");
});

test("an artist created in one account is visible there and absent from the demo account, one backend", async () => {
  const backend = createMemoryBackend();
  await accountExists(backend, OTHER);

  const created = await artistAction(
    { action: "create-artist", name: "Wren Halloway" },
    contextFor(backend, OTHER_OPERATOR),
  );
  assert.equal(created.artist.id, "wren-halloway");
  assert.equal(created.artist.name, "Wren Halloway");
  // A new artist gets the main stage and the shared bin. The third identity in
  // the demo seed belongs to that artist, not to the shape.
  assert.deepEqual(created.artist.identities, ["main-stage", "shared"]);

  const theirs = await artistAction({ action: "list-artists" }, contextFor(backend, OTHER_OPERATOR));
  assert.deepEqual(theirs.artists.map((entry) => entry.id), ["wren-halloway"]);

  const demo = await artistAction({ action: "list-artists" }, contextFor(backend, DEMO_OPERATOR));
  assert.deepEqual(demo.artists.map((entry) => entry.id), ["dierks-bentley"]);
  assert.equal(demo.artists.some((entry) => entry.id === "wren-halloway"), false);
});

test("named identities are stored as given", async () => {
  const backend = createMemoryBackend();
  await accountExists(backend, OTHER);
  const created = await artistAction(
    { action: "create-artist", name: "Wren Halloway", identities: ["main-stage", "the-quiet-hour", "shared"] },
    contextFor(backend, OTHER_OPERATOR),
  );
  assert.deepEqual(created.artist.identities, ["main-stage", "the-quiet-hour", "shared"]);
});

test("a duplicate create-artist is refused and writes nothing", async () => {
  const backend = createMemoryBackend();
  await accountExists(backend, OTHER);
  await artistAction({ action: "create-artist", name: "Wren Halloway" }, contextFor(backend, OTHER_OPERATOR));
  const before = new Map(backend.files);

  await assert.rejects(
    () => artistAction({ action: "create-artist", name: "Wren Halloway" }, contextFor(backend, OTHER_OPERATOR)),
    (error) => error.status === 409 && error.message === "An artist already exists under that name.",
  );

  assert.deepEqual([...backend.files.keys()].sort(), [...before.keys()].sort());
  for (const [pathname, body] of backend.files) {
    assert.equal(body, before.get(pathname), `${pathname} changed on the refused create`);
  }
});

test("a name that derives no usable id is refused", async () => {
  const backend = createMemoryBackend();
  await accountExists(backend, OTHER);
  const stored = backend.files.size;
  await assert.rejects(
    () => artistAction({ action: "create-artist", name: "!!!" }, contextFor(backend, OTHER_OPERATOR)),
    (error) => error.status === 400 && /usable artist id/.test(error.message),
  );
  await assert.rejects(
    () => artistAction({ action: "create-artist", name: "  " }, contextFor(backend, OTHER_OPERATOR)),
    (error) => error.status === 400 && error.message === "Name the artist before creating it.",
  );
  assert.equal(backend.files.size, stored, "a refused create wrote something");
});

test("the created artist's fact carries the account and the actor", async () => {
  const backend = createMemoryBackend();
  await accountExists(backend, OTHER);
  await artistAction({ action: "create-artist", name: "Wren Halloway" }, contextFor(backend, OTHER_OPERATOR));

  const facts = await createArtistDirectory({ backend, accountId: OTHER }).readArtistFacts();
  assert.equal(facts.length, 1);
  assert.equal(facts[0].account, OTHER);
  assert.equal(facts[0].actor, "Sam Field");
  assert.equal(facts[0].role, "Higher Roads");
  assert.equal(facts[0].action, "Created the artist");
  assert.equal(facts[0].artistId, "wren-halloway");
  assert.ok(facts[0].at);

  // The fact lands in the account that created the artist and nowhere else.
  const demoFacts = await createArtistDirectory({ backend, accountId: DEMO }).readArtistFacts();
  assert.deepEqual(demoFacts, []);
  assert.ok(backend.files.has(artistRecordPath(OTHER)));
  assert.equal(backend.files.has(artistRecordPath(DEMO)), false);
});

test("import-intake for an id with no stored artist is refused and writes nothing", async () => {
  const backend = createMemoryBackend();
  await accountExists(backend, OTHER);
  const stored = backend.files.size;
  // The intake files for this id are committed in the tree, so the refusal is
  // the missing artist row and not a missing file. The second account holds no
  // artist under this id, so intake has nothing to import onto.
  await assert.rejects(
    () => artistAction({ action: "import-intake", artistId: DEMO }, contextFor(backend, OTHER_OPERATOR)),
    (error) => error.status === 404 && /Create the artist before importing intake files/.test(error.message),
  );
  assert.equal(backend.files.size, stored, "a refused import wrote something");
});

test("the demo import path still works and still names the artist the way it did", async () => {
  const backend = createMemoryBackend();
  const imported = await artistAction({ action: "import-intake", artistId: DEMO }, contextFor(backend, DEMO_OPERATOR));
  assert.equal(imported.artist.id, "dierks-bentley");
  assert.equal(imported.artist.name, "Dierks Bentley");
  assert.equal(imported.counts.sources, 78);
  assert.equal(imported.counts.claims, 261);
  assert.equal(imported.counts.findings, 80);

  const view = await artistAction({ action: "get-artist", artistId: DEMO }, contextFor(backend, DEMO_OPERATOR));
  assert.equal(view.artist.name, "Dierks Bentley");
});

test("an artist created in an account can then import intake under that account", async () => {
  const backend = createMemoryBackend();
  await accountExists(backend, OTHER);
  const context = contextFor(backend, OTHER_OPERATOR);
  // Created under the demo artist's id so the committed intake files are found,
  // with this account's own name on the row.
  await artistAction({ action: "create-artist", name: "Dierks Bentley" }, context);
  const imported = await artistAction({ action: "import-intake", artistId: DEMO }, context);
  assert.equal(imported.artist.name, "Dierks Bentley");
  assert.equal(imported.counts.findings, 80);
});
