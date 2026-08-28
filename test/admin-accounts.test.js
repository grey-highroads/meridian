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
import { readFileSync as readSource } from "node:fs";

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

  // Scenes and Reviews keep the shared block. Tour details owns the form that
  // creates the first tour, and Home explains where the work will appear.
  for (const name of ["app/scenes.js", "app/reviews.js"]) {
    const source = read(name);
    assert.match(source, /showNoTour\(/, `${name} still asks for a tour that may not exist`);
  }
  assert.match(read("app/tour.js"), /paintTourCreation\(\)/, "Tour details has no no-tour creation state");
  const home = read("app/home.js");
  assert.match(home, /if \(!TOUR_ID\) \{\s*\n\s*explainedHome\(user, null\);/, "Home still asks for a tour that may not exist");
  assert.match(home, /href="\.\/tour\.html"/, "Home does not send tour creation to Tour details");
});

test("the account picker is built for the Higher Roads role only", () => {
  const shell = read("app/shell.js");
  assert.match(shell, /action: "list-accounts"/, "the shell never reads the accounts it may work in");
  assert.match(shell, /data-operator-utility/, "the picker is not hidden by the rule that hides the Admin link");
  assert.match(shell, /role === "higher-roads"\) \{\s*\n\s*mountOperatorDestinations\(\);\s*\n\s*mountIntelligenceDestination\(\);\s*\n\s*void mountAccountPicker/, "the picker is built for a role that may not have it");
  assert.match(shell, /url\.searchParams\.delete\("tour"\)/, "switching accounts carries the old account's tour id");
  // Under the wordmark and above the tour navigation, not in the group at the
  // bottom of the rail.
  assert.match(shell, /querySelector\("\.m-shell__brand"\)/, "the account switcher is not built under the wordmark");
  assert.match(shell, /brand\.after\(picker\)/, "the account switcher does not sit above the tour navigation");
  assert.doesNotMatch(shell, /m-select/, "the account switcher is still a select in the utility group");
  assert.match(shell, /New account/, "there is no way to start a new account from the switcher");
  assert.match(shell, /aria-current="true"/, "the account being worked in is not marked");
  // Every row names the account it switches to, so the active context must not
  // be written back over those links.
  assert.match(shell, /data-keep-href/, "the switcher links can be rewritten with the account they switch away from");
  assert.match(read("app/context.js"), /data-keep-href/, "navigation still writes the active account over a link that names another");
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

// Admin's lists. Ruled 2026-08-26 in docs/spec-admin-surface.md: the lists come
// first and every act hangs off a row in one of them.

const SEEDS = {
  MERIDIAN_OPERATOR: "ray:one-password:Ray Mercer",
  MERIDIAN_CLIENT: "dana:another-password:Dana Whitlock",
};

test("the people list holds the account's own people and names Higher Roads apart from them", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);
  const orgStore = createOrgStore({ backend, account: { id: DEMO, name: "Dierks Bentley" }, env: SEEDS });

  const demo = await artistAction({ action: "list-people" }, { ...artistOptions(backend, OPERATOR), orgStore });
  assert.equal(demo.accountId, DEMO);
  assert.deepEqual(demo.people.map((entry) => entry.id), ["client"]);
  assert.equal(demo.people[0].accountId, DEMO);

  // Higher Roads belongs to no account, so the admin comes back beside the
  // account's people rather than inside them.
  assert.deepEqual(demo.admins.map((entry) => entry.id), ["operator"]);
  assert.equal(demo.admins[0].accountId, null);
  assert.ok(!demo.people.some((entry) => entry.role === OPERATOR_ROLE), "an admin was listed as one of the account's people");

  // A password hash never leaves the store.
  for (const entry of [...demo.people, ...demo.admins]) assert.equal(entry.password, undefined);

  // The second account holds nobody. The deployment's own sign in values seed
  // one account and never spill into another.
  const other = await artistAction(
    { action: "list-people", accountId: ACCOUNT_B },
    { ...artistOptions(backend, OPERATOR, ACCOUNT_B), orgStore },
  );
  assert.equal(other.accountId, ACCOUNT_B);
  assert.deepEqual(other.people, []);
});

test("a client session asking for the people list learns nothing about anyone", async () => {
  const backend = createMemoryBackend();

  // The act is Higher Roads only, so a client falls past it to the same place a
  // client asking for the account list falls to. The two answers match, which
  // is what makes the act indistinguishable from one that is not there.
  const refusals = [];
  for (const action of ["list-people", "list-accounts"]) {
    await assert.rejects(
      () => artistAction({ action }, artistOptions(backend, CLIENT)),
      (error) => {
        refusals.push({ status: error.status, message: error.message });
        return true;
      },
    );
  }
  assert.deepEqual(refusals[0], refusals[1], "the people list answers a client differently");
  assert.equal(refusals[0].status, 400);
  for (const word of ["people", "admin", "Higher Roads", "account"]) {
    assert.ok(!refusals[0].message.includes(word), `the refusal says "${word}" to a client`);
  }
});

test("Admin scopes artists, tours, and people inside the selected account", () => {
  const admin = readSource("app/admin.js", "utf8");
  assert.match(admin, /class="m-admin-workspace"/, "Admin has no account workspace");
  assert.match(admin, /class="m-admin-accounts"/, "accounts are not the workspace scope");
  assert.match(admin, /sectionHead\("artists-heading", "Artists"/, "Admin has no Artists list");
  assert.match(admin, /sectionHead\("tours-heading", "Tours"/, "Admin has no Tours list");
  assert.match(admin, /sectionHead\("people-heading", "People"/, "Admin has no People list");
  assert.match(admin, /action: "list-people"/, "Admin does not read the account's people");
  assert.match(admin, /action: "list-tours"/, "Admin does not read the account's tours");
  assert.match(admin, /action: "list-artists"/, "Admin does not read the account's artists");
  assert.doesNotMatch(admin, /To start a tour for this client/, "Tours still carries setup instructions");
  assert.doesNotMatch(admin, /Add another artist/, "a populated account still offers another artist");

  // Both migration acts ran and were verified. They are gone from the page and
  // gone from the route.
  const route = readSource("api/artist/index.js", "utf8");
  for (const act of ["copy-artist-paths", "seed-tour-at-shared-path"]) {
    assert.ok(!admin.includes(act), `Admin still offers ${act}`);
    assert.ok(!route.includes(act), `the route still runs ${act}`);
  }
});

test("every destructive Admin row requires a confirmation and keeps a refusal visible", () => {
  const admin = readSource("app/admin.js", "utf8");
  for (const field of ["confirm", "confirm-tour", "confirm-person"]) {
    assert.match(admin, new RegExp(`data-field="${field}"`), `${field} confirmation is missing`);
  }
  for (const act of ["data-arm-delete", "data-arm-tour-delete", "data-arm-person-delete"]) {
    assert.match(admin, new RegExp(act), `${act} does not arm its destructive action`);
  }
  assert.match(admin, /if \(failure\) \{\s*view\.error = failure;\s*render\(\);/s, "a destructive refusal disappears when the lists reload");
});

// The row acts. Ruled 2026-08-26 in docs/spec-admin-surface.md: set which tour
// is active, delete a tour, delete an account.

async function seedTour(backend, accountId, tourId, name) {
  const tours = createTourStore({ backend, accountId });
  await tours.createTour(tourId, { tour: { id: tourId, name, artistId: "wren-halloway" } });
  await tours.addRequest(tourId, { id: "opening", title: "Opening" });
  return tours;
}

test("the active tour is the one an admin set, and it is cleared when that tour is deleted", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);
  const tours = await seedTour(backend, ACCOUNT_B, "first-run", "First Run");
  await seedTour(backend, ACCOUNT_B, "second-run", "Second Run");
  const options = { ...artistOptions(backend, OPERATOR, ACCOUNT_B), tourStore: tours };

  // With nothing set, the account reports no active tour and the caller falls
  // back to the first one it holds.
  const before = await tourAction({ action: "list-tours", accountId: ACCOUNT_B }, {
    ...tourOptions(backend, OPERATOR, ACCOUNT_B),
    orgStore: createOrgStore({ backend }),
  });
  assert.equal(before.activeTourId, null);

  await artistAction({ action: "set-active-tour", tourId: "second-run", accountId: ACCOUNT_B }, options);
  const after = await tourAction({ action: "list-tours", accountId: ACCOUNT_B }, {
    ...tourOptions(backend, OPERATOR, ACCOUNT_B),
    orgStore: createOrgStore({ backend }),
  });
  assert.equal(after.activeTourId, "second-run");

  // A tour this account does not hold cannot be pointed at.
  await assert.rejects(
    () => artistAction({ action: "set-active-tour", tourId: "off-the-map-2026", accountId: ACCOUNT_B }, options),
    (error) => error.status === 404,
  );

  // Deleting the active tour clears the pointer rather than leaving the account
  // opening a tour that is gone.
  await artistAction({ action: "delete-tour", tourId: "second-run", accountId: ACCOUNT_B }, options);
  const accounts = await createOrgStore({ backend }).readAccounts();
  assert.equal(accounts.find((entry) => entry.id === ACCOUNT_B).activeTourId, null);
});

test("deleting a tour removes what the tour stored and leaves the account's artists alone", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);
  const tours = await seedTour(backend, ACCOUNT_B, "first-run", "First Run");
  await seedTour(backend, ACCOUNT_B, "second-run", "Second Run");
  const options = { ...artistOptions(backend, OPERATOR, ACCOUNT_B), tourStore: tours };

  const result = await artistAction({ action: "delete-tour", tourId: "first-run", accountId: ACCOUNT_B }, options);
  assert.ok(result.removed > 0, "deleting the tour removed nothing");

  const left = [...backend.files.keys()];
  assert.ok(!left.some((path) => path.includes(`/${ACCOUNT_B}/tours/first-run/`)), "the tour's documents are still stored");
  assert.ok(left.some((path) => path.includes(`/${ACCOUNT_B}/tours/second-run/`)), "the other tour went with it");
  assert.ok(left.some((path) => path.includes(`/${ACCOUNT_B}/org/artists.json`)), "the account's artists went with the tour");
  assert.deepEqual(
    (await tourAction({ action: "list-tours", accountId: ACCOUNT_B }, tourOptions(backend, OPERATOR, ACCOUNT_B))).tours.map((entry) => entry.id),
    ["second-run"],
  );

  // A tour that is not there is absence, and nothing is removed on the way.
  const count = backend.files.size;
  await assert.rejects(
    () => artistAction({ action: "delete-tour", tourId: "first-run", accountId: ACCOUNT_B }, options),
    (error) => error.status === 404,
  );
  assert.equal(backend.files.size, count);
});

test("an account is deleted only when its name is typed back, and the other account keeps everything", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);
  await seedTour(backend, ACCOUNT_B, "first-run", "First Run");
  await backend.write(`brand-world-system/clients/${DEMO}/artists/dierks-bentley/record.json`, JSON.stringify({ findings: [] }));
  const options = artistOptions(backend, OPERATOR, DEMO);

  // The wrong name removes nothing.
  const before = backend.files.size;
  await assert.rejects(
    () => artistAction({ action: "delete-account", accountToDelete: ACCOUNT_B, confirmName: "northstar live" }, options),
    (error) => error.status === 400,
  );
  assert.equal(backend.files.size, before, "a refused delete removed something");

  const result = await artistAction(
    { action: "delete-account", accountToDelete: ACCOUNT_B, confirmName: "Northstar Live" },
    options,
  );
  assert.equal(result.account.id, ACCOUNT_B);
  assert.ok(result.removed > 0);

  const left = [...backend.files.keys()];
  assert.ok(!left.some((path) => path.includes(`/clients/${ACCOUNT_B}/`)), "the account's documents are still stored");
  assert.ok(left.some((path) => path.includes(`/clients/${DEMO}/artists/dierks-bentley/record.json`)), "the other account's brain went with it");
  const accounts = await createOrgStore({ backend }).readAccounts();
  assert.deepEqual(accounts.map((entry) => entry.id), [DEMO]);
});

test("a client session cannot set an active tour, delete a tour, or delete an account", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);
  await seedTour(backend, ACCOUNT_B, "first-run", "First Run");
  const stored = backend.files.size;
  for (const body of [
    { action: "set-active-tour", tourId: "first-run", accountId: ACCOUNT_B },
    { action: "delete-tour", tourId: "first-run", accountId: ACCOUNT_B },
    { action: "delete-account", accountToDelete: ACCOUNT_B, confirmName: "Northstar Live" },
  ]) {
    await assert.rejects(() => artistAction(body, artistOptions(backend, CLIENT, ACCOUNT_B)), (error) => error.status === 400);
  }
  assert.equal(backend.files.size, stored, "a client removed or changed something");
  const accounts = await createOrgStore({ backend }).readAccounts();
  assert.deepEqual(accounts.map((entry) => entry.id).sort(), [DEMO, ACCOUNT_B].sort());
});

test("an account that is not on the list is absent, and Admin drops it from the address", async () => {
  const backend = createMemoryBackend();
  await makeAccountB(backend);

  // Deleting the account leaves nothing that answers about it. Naming it again
  // reads the same as naming one that never existed.
  await artistAction(
    { action: "delete-account", accountToDelete: ACCOUNT_B, confirmName: "Northstar Live" },
    artistOptions(backend, OPERATOR, DEMO),
  );
  for (const accountId of [ACCOUNT_B, "never-existed"]) {
    for (const action of ["list-people", "list-artists", "list-accounts"]) {
      await assert.rejects(
        () => artistAction({ action, accountId }, artistOptions(backend, OPERATOR, accountId)),
        (error) => error.status === 404 && error.message === "No account is stored under that name.",
        `${action} answered about ${accountId}`,
      );
    }
  }

  // The page stops naming it rather than showing lists headed with an account
  // nobody can reach.
  const admin = readSource("app/admin.js", "utf8");
  assert.match(admin, /window\.location\.replace\("\.\/admin\.html"\)/, "Admin keeps a dead account in the address");
  assert.match(admin, /namedAccount\(\) === accountToDelete/, "deleting the account being worked in keeps its name");
});
