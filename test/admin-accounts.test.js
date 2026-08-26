import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createOrgStore } from "../src/org/store.js";
import { createArtistDirectory } from "../src/org/artists.js";
import { createTourStore } from "../src/tour/store.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "../src/org/store.js";

// Making a second account usable. The acts that create one, the rule that keeps
// a client out of them, and the answer a page gets when the account it is in
// holds no tour.

const DEMO = "dierks-bentley";
const ACCOUNT_B = "northstar-live";

const OPERATOR = { id: "operator", role: OPERATOR_ROLE, roleLabel: "Higher Roads", accountId: DEMO, displayName: "Grey" };
const CLIENT = { id: "client", role: CLIENT_ROLE, roleLabel: "Client reviewer", accountId: DEMO, displayName: "Client reviewer" };

function artistOptions(backend, user, accountId = DEMO) {
  return { user, store: createArtistStore({ backend, accountId }) };
}

function tourOptions(backend, user, accountId = DEMO) {
  return { user, tourStore: createTourStore({ backend, accountId }), store: createArtistStore({ backend, accountId }) };
}

function read(name) {
  return readFileSync(join(process.cwd(), name), "utf8");
}

// An account and its first artist are made in one act, because a tour sits
// under an artist and an account with none is an account nobody can work in.
async function makeAccountB(backend) {
  return await artistAction(
    { action: "create-account", name: "Northstar Live", artistName: "Wren Halloway" },
    artistOptions(backend, OPERATOR),
  );
}

test("a created account is stored, listed, holds its first artist, and starts with no tours", async () => {
  const backend = createMemoryBackend();

  const { account, artist } = await makeAccountB(backend);
  assert.equal(account.id, ACCOUNT_B);
  assert.equal(account.name, "Northstar Live");
  assert.equal(artist.id, "wren-halloway");

  // The stored list, not the return value.
  const stored = JSON.parse(await backend.read("brand-world-system/org/accounts.json"));
  assert.deepEqual(stored.accounts.map((entry) => entry.id).sort(), [DEMO, ACCOUNT_B].sort());

  const listed = await artistAction({ action: "list-accounts" }, artistOptions(backend, OPERATOR));
  assert.deepEqual(listed.accounts.map((entry) => entry.id).sort(), [DEMO, ACCOUNT_B].sort());

  const artists = await artistAction(
    { action: "list-artists", accountId: ACCOUNT_B },
    artistOptions(backend, OPERATOR, ACCOUNT_B),
  );
  // The stored rows, not the return value. The account's own artist is there
  // and nobody else's is.
  assert.deepEqual(artists.artists.map((entry) => entry.id), ["wren-halloway"]);
  const storedArtists = JSON.parse(await backend.read(`brand-world-system/clients/${ACCOUNT_B}/org/artists.json`));
  assert.deepEqual(storedArtists.artists.map((entry) => entry.name), ["Wren Halloway"]);

  const tours = await tourAction(
    { action: "list-tours", accountId: ACCOUNT_B },
    tourOptions(backend, OPERATOR, ACCOUNT_B),
  );
  assert.deepEqual(tours.tours, [], "a new account inherits another account's tours");
});

test("a duplicate account name is refused in plain words and writes nothing", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);
  const before = new Map(backend.files);

  await assert.rejects(
    () => makeAccountB(backend),
    (error) => error.status === 409 && error.message === "An account already exists under that name.",
  );

  assert.deepEqual([...backend.files.keys()].sort(), [...before.keys()].sort());
  for (const [pathname, body] of backend.files) {
    assert.equal(body, before.get(pathname), `${pathname} changed on the refused create`);
  }
});

test("an artist and a tour created in one account are readable there and absent from the other", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);

  // The artist arrived with the account, so the tour can be created without a
  // second visit to Admin.
  const created = await tourAction(
    { action: "create-tour", accountId: ACCOUNT_B, name: "Northstar 2027", artistId: "wren-halloway" },
    tourOptions(backend, OPERATOR, ACCOUNT_B),
  );
  assert.equal(created.tour.id, "northstar-2027");

  // Stored where account B reads, and nowhere account A reads.
  assert.ok(
    backend.files.has(`brand-world-system/clients/${ACCOUNT_B}/tours/northstar-2027/tour.json`),
    "the tour did not land in the account that created it",
  );
  for (const path of backend.files.keys()) {
    assert.ok(!path.startsWith(`brand-world-system/clients/${DEMO}/tours/northstar-2027/`), `${path} put account B's tour in the demo account`);
  }

  const inB = await tourAction(
    { action: "list-tours", accountId: ACCOUNT_B },
    tourOptions(backend, OPERATOR, ACCOUNT_B),
  );
  assert.deepEqual(inB.tours.map((entry) => entry.id), ["northstar-2027"]);

  // Both directions. The demo account sees neither the artist nor the tour.
  const demoTours = await tourAction({ action: "list-tours" }, tourOptions(backend, OPERATOR));
  assert.deepEqual(demoTours.tours, []);
  const demoArtists = await artistAction({ action: "list-artists" }, artistOptions(backend, OPERATOR));
  assert.ok(
    !demoArtists.artists.some((entry) => entry.id === "wren-halloway"),
    "account B's artist is readable from the demo account",
  );

  // And a Higher Roads session acting in account B reads its tour, not the
  // demo account's.
  await createTourStore({ backend, accountId: DEMO }).createTour("off-the-map-2026", {
    tour: { id: "off-the-map-2026", name: "Off The Map", artistId: DEMO, direction: { version: 0, words: "" }, dates: [], themes: [] },
    assignments: [],
  });
  const again = await tourAction(
    { action: "list-tours", accountId: ACCOUNT_B },
    tourOptions(backend, OPERATOR, ACCOUNT_B),
  );
  assert.deepEqual(again.tours.map((entry) => entry.id), ["northstar-2027"]);
  const demoAgain = await tourAction({ action: "list-tours" }, tourOptions(backend, OPERATOR));
  assert.deepEqual(demoAgain.tours.map((entry) => entry.id), ["off-the-map-2026"]);
});

test("a client session is refused on the account acts and on creating an artist, and writes nothing", async () => {
  const backend = createMemoryBackend();

  // None of the three names an artist, so a client falls past every branch and
  // stops at the guard that asks for one. The answer never says the act is
  // there, which is the same absence a made-up action gets.
  const refused = (error) => error.status === 400 && !/account|create/i.test(error.message);
  await assert.rejects(
    () => artistAction({ action: "create-account", name: "Northstar Live" }, artistOptions(backend, CLIENT)),
    refused,
  );
  await assert.rejects(
    () => artistAction({ action: "list-accounts" }, artistOptions(backend, CLIENT)),
    refused,
  );
  await assert.rejects(
    () => artistAction({ action: "create-artist", name: "Wren Halloway" }, artistOptions(backend, CLIENT)),
    refused,
  );
  // The same three with an artist named, so nothing stops at the guard first
  // and the answer is the one an unknown action gets.
  for (const action of ["create-account", "list-accounts", "create-artist"]) {
    await assert.rejects(
      () => artistAction({ action, artistId: "wren-halloway", name: "Wren Halloway" }, artistOptions(backend, CLIENT)),
      /not something this route does/,
    );
  }
  assert.equal(backend.files.size, 0, "a refused client session wrote something");
});

// Creating a tour is open to a client inside its own account, which the tour
// route ruled when client and Higher Roads users were given the same tour and
// Scene workflow. What is closed is reaching another account, and that is what
// this asserts. Recorded in docs/deferred-work.md.
test("a client creating a tour lands in its own account and nowhere else", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);
  await createArtistDirectory({ backend, accountId: DEMO }).createArtist({ name: "Wren Halloway" });

  await tourAction(
    { action: "create-tour", accountId: ACCOUNT_B, name: "Northstar 2027", artistId: "wren-halloway" },
    { user: CLIENT, tourStore: createTourStore({ backend, accountId: DEMO }), store: createArtistStore({ backend, accountId: DEMO }) },
  );

  assert.ok(
    backend.files.has(`brand-world-system/clients/${DEMO}/tours/northstar-2027/tour.json`),
    "the client's tour did not land in the client's own account",
  );
  for (const path of backend.files.keys()) {
    assert.ok(
      !path.startsWith(`brand-world-system/clients/${ACCOUNT_B}/tours/`),
      `${path} put a client's tour in the account it named rather than its own`,
    );
  }
});

test("a client session cannot act in another account", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);
  await createTourStore({ backend, accountId: ACCOUNT_B }).createTour("northstar-2027", {
    tour: { id: "northstar-2027", name: "Northstar 2027", artistId: "wren-halloway", direction: { version: 0, words: "" }, dates: [], themes: [] },
    assignments: [],
  });

  // The account named in the body is ignored for a client. It reads its own
  // account, which holds no tour, rather than the one it asked for.
  const tours = await tourAction(
    { action: "list-tours", accountId: ACCOUNT_B },
    { user: CLIENT, tourStore: createTourStore({ backend, accountId: DEMO }) },
  );
  assert.deepEqual(tours.tours, []);
});

test("an account holding no tour resolves without an error", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);

  const tours = await tourAction(
    { action: "list-tours", accountId: ACCOUNT_B },
    tourOptions(backend, OPERATOR, ACCOUNT_B),
  );
  assert.deepEqual(tours.tours, []);

  // Nothing was written by the read. What is stored is what creating the
  // account wrote: the accounts list, and the account's first artist.
  assert.deepEqual([...backend.files.keys()].sort(), [
    `brand-world-system/clients/${ACCOUNT_B}/org/artist-record.json`,
    `brand-world-system/clients/${ACCOUNT_B}/org/artists.json`,
    "brand-world-system/org/accounts.json",
  ]);
});

test("the demo account no longer holds a tour id any other account falls back to", () => {
  const context = read("app/context.js");
  assert.doesNotMatch(context, /off-the-map-2026/, "the demo tour is still a fallback in the shell context");
  assert.match(context, /action: "list-tours"/, "the shell never asks the account which tours it holds");

  // Home has a shape of its own for an account with no tour: one sentence and
  // the act that starts one. The other three keep the shared block.
  for (const name of ["app/scenes.js", "app/reviews.js", "app/tour.js"]) {
    const source = read(name);
    assert.match(source, /showNoTour\(/, `${name} still asks for a tour that may not exist`);
  }
  const home = read("app/home.js");
  assert.match(home, /if \(!TOUR_ID\) \{\s*\n\s*startTour\(\);/, "Home still asks for a tour that may not exist");
  assert.match(home, /new-tour\.html/, "Home has no way to start the first tour");
});

test("the account picker is built for the Higher Roads role only", () => {
  const shell = read("app/shell.js");
  assert.match(shell, /action: "list-accounts"/, "the shell never reads the accounts it may work in");
  assert.match(shell, /data-operator-utility/, "the picker is not hidden by the rule that hides the Admin link");
  assert.match(shell, /role === "higher-roads"\) \{\s*\n\s*mountOperatorDestinations\(\);\s*\n\s*void mountAccountPicker/, "the picker is built for a role that may not have it");
  assert.match(shell, /url\.searchParams\.delete\("tour"\)/, "switching accounts carries the old account's tour id");
});

test("the org store's account list and the tour store's listing stay account scoped", async () => {
  const backend = createMemoryBackend();
  const org = createOrgStore({ backend });
  const accounts = await org.readAccounts();
  assert.deepEqual(accounts.map((entry) => entry.id), [DEMO], "the seeded account list changed shape");

  const store = createTourStore({ backend, accountId: ACCOUNT_B });
  await store.createTour("northstar-2027", { tour: { id: "northstar-2027", name: "Northstar 2027", artistId: "wren-halloway" }, assignments: [] });
  assert.deepEqual(await store.readTours(), [{ id: "northstar-2027", name: "Northstar 2027", artistId: "wren-halloway" }]);
  assert.deepEqual(await createTourStore({ backend, accountId: DEMO }).readTours(), []);
});
