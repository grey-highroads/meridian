import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { uploadPrefix } from "../api/tour-upload.js";
import { createArtistStore, createMemoryBackend, pathFor } from "../src/artist/store.js";
import { createOrgStore } from "../src/org/store.js";
import { createArtistDirectory } from "../src/org/artists.js";
import { resolveActingAccount } from "../src/org/acting-account.js";
import { createTourStore, tourDocumentPathFor, tourPathFor } from "../src/tour/store.js";
import { artifactPathFor } from "../src/seam/stand-in.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { artistsPath, artistRecordPath } from "../src/org/artists.js";
import { usersPath } from "../src/org/store.js";

const DEMO_OPERATOR = { id: "operator", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads", accountId: "dierks-bentley" };
const OTHER_CLIENT = { id: "client-b", displayName: "Sam Field", role: "client-reviewer", roleLabel: "Client reviewer", accountId: "stagecraft" };

test("the shared acting-account rule defaults operators and pins clients", () => {
  assert.equal(resolveActingAccount(DEMO_OPERATOR), "dierks-bentley");
  assert.equal(resolveActingAccount(DEMO_OPERATOR, "stagecraft"), "stagecraft");
  assert.equal(resolveActingAccount(OTHER_CLIENT, "dierks-bentley"), "stagecraft");
});

test("a session from another account asking for the demo tour gets absence, not the fixture", async () => {
  const tourStore = createTourStore({ backend: createMemoryBackend(), accountId: "stagecraft" });
  await assert.rejects(
    () => tourAction({ action: "get-tour", tourId: "off-the-map-2026" }, { user: OTHER_CLIENT, tourStore }),
    (error) => error.status === 404 && error.message === "No tour is stored under that name.",
  );
});

test("a tour created in one account is invisible from another, both directions", async () => {
  const backend = createMemoryBackend();
  await createArtistDirectory({ backend, accountId: "stagecraft" }).createArtist({ name: "Some Artist" });
  const forOther = { user: OTHER_CLIENT, tourStore: createTourStore({ backend, accountId: "stagecraft" }) };
  const created = await tourAction({ action: "create-tour", name: "Stagecraft Run 2027", artistId: "some-artist" }, forOther);
  assert.equal(created.tour.id, "stagecraft-run-2027");
  const seen = await tourAction({ action: "get-tour", tourId: "stagecraft-run-2027" }, forOther);
  assert.equal(seen.tour.name, "Stagecraft Run 2027");
  const forDemo = { user: DEMO_OPERATOR, tourStore: createTourStore({ backend, accountId: "dierks-bentley" }) };
  await assert.rejects(
    () => tourAction({ action: "get-tour", tourId: "stagecraft-run-2027" }, forDemo),
    (error) => error.status === 404,
  );
});

test("the two accounts write to different paths in the same backend", () => {
  // One shape for every account. The demo account has no path of its own, so
  // the same tour id in two accounts is two directories.
  assert.equal(tourPathFor("t1", "a1", "briefs", "dierks-bentley"), "brand-world-system/clients/dierks-bentley/tours/t1/a1/briefs.json");
  assert.equal(tourPathFor("t1", "a1", "briefs", "stagecraft"), "brand-world-system/clients/stagecraft/tours/t1/a1/briefs.json");
  assert.equal(uploadPrefix("t1", "a1", "dierks-bentley"), "brand-world-system/clients/dierks-bentley/tours/t1/a1/uploads/");
  assert.equal(uploadPrefix("t1", "a1", "stagecraft"), "brand-world-system/clients/stagecraft/tours/t1/a1/uploads/");
});

test("a path with no account is refused rather than shared between accounts", () => {
  assert.throws(() => tourPathFor("t1", "a1", "briefs"), /needs the account it belongs to/);
  assert.throws(() => tourDocumentPathFor("t1", "tour"), /needs the account it belongs to/);
  assert.throws(() => pathFor("some-artist", "record"), /needs the account it belongs to/);
  assert.throws(() => artifactPathFor("t1", "a1", 1), /needs the account it belongs to/);
});

test("another account reading the demo artist finds absence by construction", async () => {
  const backend = createMemoryBackend();
  const demoStore = createArtistStore({ backend, accountId: "dierks-bentley" });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store: demoStore });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley" }, { store: demoStore });
  const demoView = await artistAction({ action: "get-artist", artistId: "dierks-bentley" }, { store: demoStore });
  assert.equal(demoView.approved, true);
  const otherStore = createArtistStore({ backend, accountId: "stagecraft" });
  const otherView = await artistAction({ action: "get-artist", artistId: "dierks-bentley" }, { store: otherStore });
  assert.equal(otherView.approved, false);
  assert.notEqual(JSON.stringify(otherView), JSON.stringify(demoView));
});

test("a created tour's fact names the account it was created in", async () => {
  const backend = createMemoryBackend();
  await createArtistDirectory({ backend, accountId: "stagecraft" }).createArtist({ name: "Some Artist" });
  const tourStore = createTourStore({ backend, accountId: "stagecraft" });
  await tourAction({ action: "create-tour", name: "Stagecraft Run 2027", artistId: "some-artist" }, { user: OTHER_CLIENT, tourStore });
  const facts = await tourStore.readTourFacts("stagecraft-run-2027");
  assert.equal(facts.length, 1);
  assert.equal(facts[0].account, "stagecraft");
  assert.equal(facts[0].actor, "Sam Field");
});

test("accounts are rows: demo seeded, duplicates and the default id refused", async () => {
  const backend = createMemoryBackend();
  const org = createOrgStore({ backend });
  const first = await org.readAccounts();
  assert.equal(first.length, 1);
  assert.equal(first[0].id, "dierks-bentley");
  const created = await org.createAccount("Stagecraft");
  assert.equal(created.id, "stagecraft");
  const after = await org.readAccounts();
  assert.deepEqual(after.map((entry) => entry.id).sort(), ["dierks-bentley", "stagecraft"]);
  await assert.rejects(() => org.createAccount("Stagecraft"), (error) => error.status === 409);
  await assert.rejects(() => org.createAccount("!!!"), (error) => error.status === 400);
});

test("a client session cannot act in another account by naming it", async () => {
  const backend = createMemoryBackend();
  const tourStore = createTourStore({ backend, accountId: "stagecraft" });
  // The client names the demo account in the body; the acting account stays
  // their own, so the demo fixture is still absent to them.
  await assert.rejects(
    () => tourAction({ action: "get-tour", tourId: "off-the-map-2026", accountId: "dierks-bentley" }, { user: OTHER_CLIENT, tourStore }),
    (error) => error.status === 404,
  );
});

test("create-tour does not accept an artist with the same id in another account", async () => {
  const backend = createMemoryBackend();
  await createArtistDirectory({ backend, accountId: "dierks-bentley" }).readArtists();
  const tourStore = createTourStore({ backend, accountId: "stagecraft" });
  await assert.rejects(
    () => tourAction(
      { action: "create-tour", accountId: "stagecraft", name: "Stagecraft Run 2027", artistId: "dierks-bentley" },
      { user: DEMO_OPERATOR, tourStore },
    ),
    (error) => error.status === 404 && /in this account/.test(error.message),
  );
  assert.equal(await tourStore.readTour("stagecraft-run-2027"), null);
});

// The demo account is an account like any other. No builder anywhere returns
// the address these documents were written at before accounts existed.
test("every path builder puts the demo account under its own account directory", () => {
  const demo = "dierks-bentley";
  const built = [
    tourPathFor("off-the-map-2026", "storm-and-lightning", "briefs", demo),
    tourDocumentPathFor("off-the-map-2026", "tour", demo),
    pathFor("dierks-bentley", "record", demo),
    artistsPath(demo),
    artistRecordPath(demo),
    usersPath(demo),
    uploadPrefix("off-the-map-2026", "storm-and-lightning", demo),
    artifactPathFor("off-the-map-2026", "storm-and-lightning", 1, demo),
  ];
  for (const path of built) {
    assert.ok(path.startsWith(`brand-world-system/clients/${demo}/`), `${path} is not under the account`);
    assert.ok(!/\/tour\//.test(path), `${path} still carries the old tour directory`);
    assert.ok(!/\/artist\//.test(path), `${path} still carries the old artist directory`);
  }
});

// Two accounts running a tour under the same name keep separate artboards. The
// stand-in writes the file, so the account has to reach it.
test("the same tour and Scene in two accounts read back only their own artboard", async () => {
  const backend = createMemoryBackend();
  const tourId = "off-the-map-2026";
  const sceneId = "storm-and-lightning";
  const demoPath = artifactPathFor(tourId, sceneId, 1, "dierks-bentley");
  const otherPath = artifactPathFor(tourId, sceneId, 1, "stagecraft");
  assert.notEqual(demoPath, otherPath);

  const demoStore = createArtboardStore({ backend, accountId: "dierks-bentley" });
  const otherStore = createArtboardStore({ backend, accountId: "stagecraft" });
  const entryFor = (location) => ({
    receipt: { jobId: "job", receivedAt: "2026-08-26T00:00:00.000Z" },
    artboard: { artboardVersion: 1, briefVersion: 1, artifact: { type: "artboard", format: "svg", location } },
  });
  await demoStore.addArtboard(tourId, sceneId, entryFor(demoPath), "<svg>demo</svg>");
  await otherStore.addArtboard(tourId, sceneId, entryFor(otherPath), "<svg>stagecraft</svg>");

  assert.equal(await demoStore.readArtifact(demoPath), "<svg>demo</svg>");
  assert.equal(await otherStore.readArtifact(otherPath), "<svg>stagecraft</svg>");
  const demoVersions = await demoStore.readArtboards(tourId, sceneId);
  const otherVersions = await otherStore.readArtboards(tourId, sceneId);
  assert.equal(demoVersions.length, 1);
  assert.equal(otherVersions.length, 1);
  assert.equal(demoVersions[0].artboard.artifact.location, demoPath);
  assert.equal(otherVersions[0].artboard.artifact.location, otherPath);
});
