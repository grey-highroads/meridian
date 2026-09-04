import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as tourAction } from "../api/tour/index.js";
import { handleAction as artistAction } from "../api/artist/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore, tourDocumentPathFor } from "../src/tour/store.js";
import { artistsPath, createArtistDirectory } from "../src/org/artists.js";
import { parseTour } from "../src/tour/parse-fixture.js";
import { ARTIST_LABEL, TOUR_LABEL, artistLabel, storedLabel, tourLabel } from "../src/label.js";

// The word a record is called on screen. Ruled 2026-09-04 in
// docs/meridian-product-architecture.md. Every check here asserts what is
// stored and what a person would read, and one asserts that nothing else
// changed shape because of it.

const DEMO = "dierks-bentley";
const ACCOUNT_B = "northstar-live";
const OPERATOR = { id: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads", accountId: null };

function ready(accountId = DEMO, backend = createMemoryBackend()) {
  const tourStore = createTourStore({ backend, accountId });
  const store = createArtistStore({ backend, accountId });
  return {
    backend,
    tourStore,
    options: { tourStore, store, user: { ...OPERATOR, actingAccount: accountId }, accountId },
  };
}

const FIXTURE = `# Off The Map 2026

Tour id: off-the-map-2026
Artist: dierks-bentley

## Direction, version 1

Set by: Marguerite Sable

Everything reads like weather coming in.
`;

test("a tour file without a Label line parses and reads the default word", () => {
  const parsed = parseTour(FIXTURE);
  assert.equal(parsed.label, null, "an absent Label line stored something");
  assert.equal(tourLabel(parsed), TOUR_LABEL);
});

test("a tour file naming a Label reads that word", () => {
  const parsed = parseTour(FIXTURE.replace("Artist: dierks-bentley", "Artist: dierks-bentley\nLabel: Residency"));
  assert.equal(parsed.label, "Residency");
  assert.equal(tourLabel(parsed), "Residency");
});

// The reason this exists: everything already stored on the live deployment was
// written before the field did. None of it is migrated, so absence has to read
// as the default rather than as an empty heading.
test("a record stored before the label existed reads the default rather than empty", async () => {
  const { backend, tourStore, options } = ready();
  // Written the way createTour wrote before this commit: no label key at all.
  await tourStore.createTour("off-the-map-2026", {
    tour: { id: "off-the-map-2026", name: "Off The Map 2026", artistId: DEMO, dates: [], themes: [] },
    assignments: [],
  });
  await backend.write(artistsPath(DEMO), JSON.stringify({
    artists: [{ id: DEMO, name: "Dierks Bentley", identities: ["main-stage"], createdAt: null }],
  }, null, 2));

  const { tour } = await tourAction({ action: "get-tour", tourId: "off-the-map-2026" }, options);
  assert.equal(tour.label, undefined, "a tour written before the field gained one");
  assert.equal(tourLabel(tour), TOUR_LABEL, "an unlabeled tour reads something other than Tour");
  assert.notEqual(tourLabel(tour), "", "an unlabeled tour reads empty");

  const [listed] = await tourStore.readTours();
  assert.equal(listed.label, null, "the listing invents a word for an unlabeled tour");
  assert.equal(tourLabel(listed), TOUR_LABEL);

  const row = await createArtistDirectory({ backend, accountId: DEMO }).findArtist(DEMO);
  assert.equal(row.label, undefined, "an artist row written before the field gained one");
  assert.equal(artistLabel(row), ARTIST_LABEL, "an unlabeled artist reads something other than Artist");
});

test("the word set at creation is what the tour reads back, and clearing it returns the default", async () => {
  const { backend, options } = ready();
  await createArtistDirectory({ backend, accountId: DEMO }).readArtists();
  await tourAction({
    action: "create-tour",
    name: "Highway Nights 2027",
    label: "  Residency  ",
    artistId: DEMO,
  }, options);

  const opened = await tourAction({ action: "get-tour", tourId: "highway-nights-2027" }, options);
  assert.equal(opened.tour.label, "Residency", "the typed word was not trimmed and stored");
  assert.equal(tourLabel(opened.tour), "Residency");

  await tourAction({ action: "save-tour-label", tourId: "highway-nights-2027", label: "Festival" }, options);
  const changed = await tourAction({ action: "get-tour", tourId: "highway-nights-2027" }, options);
  assert.equal(tourLabel(changed.tour), "Festival");
  // Everything else the tour holds survives a change to the word.
  assert.equal(changed.tour.name, "Highway Nights 2027");
  assert.equal(changed.tour.artistId, DEMO);

  await tourAction({ action: "save-tour-label", tourId: "highway-nights-2027", label: "   " }, options);
  const cleared = await tourAction({ action: "get-tour", tourId: "highway-nights-2027" }, options);
  assert.equal(cleared.tour.label, null, "a cleared word was stored as an empty string");
  assert.equal(tourLabel(cleared.tour), TOUR_LABEL);

  const record = JSON.parse(await options.tourStore.backend.read(
    tourDocumentPathFor("highway-nights-2027", "record", DEMO),
  ));
  const actions = record.facts.map((fact) => fact.action);
  assert.ok(actions.includes("Called this job Festival"), "changing the word left no record");
  assert.ok(actions.includes("Went back to the default word for this job"), "clearing the word left no record");
});

test("an artist carries its own word and a subject with none reads Artist", async () => {
  const { backend, options } = ready();
  const directory = createArtistDirectory({ backend, accountId: DEMO });
  await directory.readArtists();

  const created = await directory.createArtist({ name: "Wren Halloway", label: "Composer" });
  assert.equal(created.label, "Composer");
  assert.equal(artistLabel(created), "Composer");

  const plain = await directory.createArtist({ name: "Ada Sole" });
  assert.equal(plain.label, null, "an artist created without a word stored one anyway");
  assert.equal(artistLabel(plain), ARTIST_LABEL);

  const view = await artistAction({ action: "get-artist", artistId: "wren-halloway" }, {
    ...options,
    artists: directory,
  });
  assert.equal(view.label, "Composer", "the Knowledge page does not read the row's word");

  const seeded = await artistAction({ action: "get-artist", artistId: DEMO }, { ...options, artists: directory });
  assert.equal(seeded.label, ARTIST_LABEL, "the seeded artist reads something other than Artist");
});

// The failure shape this guards: code that is right for the account in front of
// you and wrong after a switch. A word belongs to one record in one account.
test("an account switch does not carry a label across", async () => {
  const backend = createMemoryBackend();
  const demo = ready(DEMO, backend);
  const other = ready(ACCOUNT_B, backend);

  await createArtistDirectory({ backend, accountId: DEMO }).readArtists();
  await createArtistDirectory({ backend, accountId: ACCOUNT_B }).createArtist({ name: "Wren Halloway" });

  await tourAction({ action: "create-tour", name: "Shared Name", label: "Residency", artistId: DEMO }, demo.options);
  await tourAction({ action: "create-tour", name: "Shared Name", artistId: "wren-halloway" }, other.options);

  const mine = await tourAction({ action: "get-tour", tourId: "shared-name" }, demo.options);
  const theirs = await tourAction({ action: "get-tour", tourId: "shared-name" }, other.options);
  assert.equal(tourLabel(mine.tour), "Residency");
  assert.equal(tourLabel(theirs.tour), TOUR_LABEL, "the other account inherited a word it never set");

  const [mineListed] = await demo.tourStore.readTours();
  const [theirsListed] = await other.tourStore.readTours();
  assert.equal(mineListed.label, "Residency");
  assert.equal(theirsListed.label, null, "the listing carried a word across accounts");

  // The same shape on the artist side. Two accounts, one artist id apiece.
  await createArtistDirectory({ backend, accountId: DEMO }).setArtistLabel(DEMO, "Composer");
  const theirArtist = await createArtistDirectory({ backend, accountId: ACCOUNT_B }).findArtist("wren-halloway");
  assert.equal(artistLabel(theirArtist), ARTIST_LABEL, "the other account inherited a subject word it never set");
});

test("the label is a word and nothing reads it to decide anything", async () => {
  const { backend, options } = ready();
  await createArtistDirectory({ backend, accountId: DEMO }).readArtists();
  await tourAction({ action: "create-tour", name: "Highway Nights 2027", label: "Residency", artistId: DEMO }, options);
  const stored = JSON.parse(await options.tourStore.backend.read(
    tourDocumentPathFor("highway-nights-2027", "tour", DEMO),
  ));
  for (const key of ["shape", "type", "kind", "container", "recordType"]) {
    assert.ok(!(key in stored.tour), `the label brought a ${key} field with it`);
  }
  assert.equal(storedLabel("  Residency  "), "Residency");
  assert.equal(storedLabel(""), null);
  assert.equal(storedLabel(null), null);
  assert.equal(storedLabel("x".repeat(80)).length, 40, "a long word is not cut to a length a rail can hold");
});
