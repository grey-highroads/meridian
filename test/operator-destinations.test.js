import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "../src/org/store.js";

// A Higher Roads admin working across client accounts. Admin and Artist Brain
// used to live in one page's markup, and an account could be created with no
// artist in it, which left a tour impossible to make. Both are effects, so
// every check here reads what is stored or what a page would build.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = "dierks-bentley";
const ACCOUNT_B = "northstar-live";

const OPERATOR = { id: "operator", role: OPERATOR_ROLE, roleLabel: "Higher Roads", accountId: DEMO, displayName: "Grey" };
const CLIENT = { id: "client", role: CLIENT_ROLE, roleLabel: "Client reviewer", accountId: DEMO, displayName: "Nadia Cole" };

function read(name) {
  return fs.readFileSync(path.join(rootPath, name), "utf8");
}

function artistOptions(backend, user, accountId = DEMO) {
  return { user, store: createArtistStore({ backend, accountId }) };
}

const SHELL_PAGES = [
  "app/index.html", "app/scenes.html", "app/reviews.html", "app/artist.html",
  "app/tour.html", "app/scene.html", "app/request.html",
  "app/direction.html", "app/handoff.html", "app/admin.html",
];

test("Admin and Artist Brain are built by the shell and live in no page's markup", () => {
  for (const page of SHELL_PAGES) {
    const source = read(page);
    assert.match(source, /shell\.js/, `${page} does not load the shell`);
    assert.doesNotMatch(source, /href="\.\/admin\.html"/, `${page} still hard-codes the Admin link`);
    assert.doesNotMatch(source, /href="\.\/artist\.html"/, `${page} still hard-codes the Artist Brain link`);
  }

  const shell = read("app/shell.js");
  assert.match(shell, /page: "admin\.html", label: "Admin"/, "the shell does not build Admin");
  assert.match(shell, /page: "artist\.html", label: "Artist Brain"/, "the shell does not build Artist Brain");
  assert.match(shell, /data-operator-utility/, "the built group is outside the rule that hides operator things");
});

test("the group is built for the Higher Roads role only and sits in the upper right", () => {
  const shell = read("app/shell.js");
  const guard = shell.match(/if \(body\.user\.role === "higher-roads"\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(guard, /mountOperatorDestinations\(\)/, "the group is built before the role is known");
  assert.match(shell, /getElementById\("location"\)/, "the group is not placed in the bar at the top of the page");
  const group = shell.match(/function operatorGroup\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(group, /m-cluster/, "the group does not use an existing design class");
  assert.doesNotMatch(group, /m-shell__nav/, "the group was built with the rail's classes");
  assert.doesNotMatch(group, /style=/, "the group uses an inline style");
  // Pages write that bar whole on every render, so the group has to be put back.
  assert.match(shell, /new MutationObserver\(place\)\.observe\(bar, \{ childList: true \}\)/, "a page render can drop the group for good");
});

test("a client session is refused by the route, not by a link that is missing", async () => {
  const backend = createMemoryBackend();
  await assert.rejects(
    () => artistAction({ action: "create-account", name: "Northstar Live", artistName: "Wren Halloway" }, artistOptions(backend, CLIENT)),
    (error) => error.status === 400,
  );
  await assert.rejects(
    () => artistAction({ action: "list-accounts" }, artistOptions(backend, CLIENT)),
    (error) => error.status === 400,
  );
  assert.equal(backend.files.size, 0, "a refused client session wrote something");
});

test("creating an account creates its artist, and a tour can be made in it at once", async () => {
  const backend = createMemoryBackend();
  const created = await artistAction(
    { action: "create-account", name: "Northstar Live", artistName: "Wren Halloway" },
    artistOptions(backend, OPERATOR),
  );
  assert.equal(created.account.id, ACCOUNT_B);
  assert.equal(created.artist.id, "wren-halloway");
  assert.equal(created.artistError, undefined);

  // The stored rows in the new account, not the return value.
  const stored = JSON.parse(await backend.read(`brand-world-system/clients/${ACCOUNT_B}/org/artists.json`));
  assert.deepEqual(stored.artists.map((entry) => entry.id), ["wren-halloway"]);
  const facts = JSON.parse(await backend.read(`brand-world-system/clients/${ACCOUNT_B}/org/artist-record.json`));
  assert.equal(facts.facts.at(-1).action, "Created the artist");
  assert.equal(facts.facts.at(-1).actor, "Grey");
  assert.equal(facts.facts.at(-1).account, ACCOUNT_B);

  // And the account it was made from is untouched.
  const demo = await backend.read(`brand-world-system/clients/${DEMO}/org/artists.json`);
  assert.equal(demo, null, "the new account's artist landed in the account it was created from");

  // No second visit to Admin. The tour is creatable straight away.
  const tour = await tourAction(
    { action: "create-tour", accountId: ACCOUNT_B, name: "Northstar 2027", artistId: "wren-halloway" },
    { user: OPERATOR, tourStore: createTourStore({ backend, accountId: ACCOUNT_B }), store: createArtistStore({ backend, accountId: ACCOUNT_B }) },
  );
  assert.equal(tour.tour.id, "northstar-2027");
});

test("an unusable artist name is refused before any account is written", async () => {
  const backend = createMemoryBackend();
  for (const artistName of ["", "   ", "!!!"]) {
    await assert.rejects(
      () => artistAction({ action: "create-account", name: "Northstar Live", artistName }, artistOptions(backend, OPERATOR)),
      (error) => error.status === 400,
    );
  }
  assert.equal(backend.files.size, 0, "half an account was left behind");
});

test("a half-failed create names the half that failed and keeps the account", async () => {
  const backend = createMemoryBackend();
  const store = createArtistStore({ backend, accountId: DEMO });
  // A directory that refuses the artist, which is what a failure after the
  // account is written looks like from the caller's side.
  const artists = {
    accountId: ACCOUNT_B,
    async createArtist() { throw new Error("An artist already exists under that name."); },
    async appendArtistFact() {},
  };
  const result = await artistAction(
    { action: "create-account", name: "Northstar Live", artistName: "Wren Halloway" },
    { user: OPERATOR, store, artists },
  );
  assert.equal(result.account.id, ACCOUNT_B);
  assert.equal(result.artist, null);
  assert.match(result.artistError, /already exists/);
  // The account is stored, so the page reporting the failed half is telling
  // the truth about what happened.
  const accounts = JSON.parse(await backend.read("brand-world-system/org/accounts.json"));
  assert.ok(accounts.accounts.some((entry) => entry.id === ACCOUNT_B));
});

test("Admin asks for the initial artist and keeps both values on a failure", () => {
  const admin = read("app/admin.js");
  assert.match(admin, /artistName: acts\.account\.artistName/, "the account act does not carry the artist name");
  assert.match(admin, /data-field="account-artist"/, "there is no artist field beside the account field");
  assert.match(admin, /if \(!created\.artist\)/, "a half-failed create is reported as a success");
  assert.doesNotMatch(admin, /Add another artist/, "a populated account still offers another artist");
  assert.match(admin, /if \(view\.artists\.length\)[\s\S]*return rows\([\s\S]*return `<div class="m-admin-empty">/, "artist creation is not confined to the no-artist empty state");
  // run() writes the message and leaves the typed values in state, so a
  // refused create repaints with both of them still there.
  assert.match(admin, /state\.message = error\.message;\s*\n\s*render\(\);/, "a refused create loses what was typed");
});

test("Tour details names the tour and points a Higher Roads reader at the artist", () => {
  const page = read("app/tour.js");
  assert.match(page, /<span class="m-label">Start the tour<\/span>/, "the label no longer says start the tour");
  assert.match(page, /<h1 class="m-heading">Name the tour<\/h1>/, "the page does not lead with the one required action");
  assert.doesNotMatch(page, /Higher Roads adds the artist/, "the page still tells Higher Roads that Higher Roads will do it");
  assert.match(page, /Higher Roads needs to add the artist before you can start a tour/, "the client does not get a plain explanation when the artist is missing");
  assert.match(page, /Add an artist to this account before starting a tour/, "Higher Roads does not get a direct next step when the artist is missing");
  assert.match(page, /view\.role === "higher-roads" \? .*admin\.html/, "a Higher Roads reader gets no way to add the artist");
});
