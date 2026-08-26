import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { handleAction, intakeDirectory, readIntakeFiles } from "../api/artist/index.js";
import { createArtistStore, createMemoryBackend, pathFor } from "../src/artist/store.js";
import { parseIntake } from "../src/artist/parse-intake.js";

const DEMO_ACCOUNT = "dierks-bentley";

const ARTIST = "dierks-bentley";

function freshStore() {
  const backend = createMemoryBackend();
  return { backend, store: createArtistStore({ backend, accountId: DEMO_ACCOUNT }) };
}

async function importOnce(store) {
  return await handleAction({ action: "import-intake", artistId: ARTIST }, { store });
}

async function importedAndApproved() {
  const { backend, store } = freshStore();
  await importOnce(store);
  await handleAction({ action: "approve-brain", artistId: ARTIST, person: "Grey" }, { store });
  return { backend, store };
}

function allFindings(listed) {
  return listed.groups.flatMap((group) => group.findings);
}

test("the committed intake files parse into the counts they state", async () => {
  const texts = await readIntakeFiles(ARTIST);
  const parsed = parseIntake({ artistId: ARTIST, artistName: "Dierks Bentley", ...texts });
  assert.equal(parsed.sources.length, 78);
  assert.equal(parsed.claims.length, 261);
  assert.equal(parsed.findings.length, 80);
  // parseFindings throws when its bins disagree with the file's own counts
  // table, so reaching here means the parse matched what the operator counted.
  const bins = { confirmed: 0, corrected: 0, new: 0 };
  for (const finding of parsed.findings) bins[finding.bin] += 1;
  assert.deepEqual(bins, { confirmed: 31, corrected: 5, new: 44 });
});

test("importing twice yields identical stored objects", async () => {
  const { backend, store } = freshStore();
  await importOnce(store);
  const first = new Map(backend.files);
  await importOnce(store);
  assert.deepEqual([...backend.files.keys()].sort(), [...first.keys()].sort());
  for (const [pathname, body] of backend.files) {
    assert.equal(body, first.get(pathname), `${pathname} changed on the second import`);
  }
});

test("nothing is in the brain until a person approves it", async () => {
  const { store } = freshStore();
  await importOnce(store);
  const before = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  assert.equal(before.approved, false);
  assert.deepEqual(before.groups, []);
  assert.equal(before.counts.findings, 80);
  assert.equal(before.counts.inBrain, 0);

  // The findings exist and are readable before the ruling, they are just not
  // in the brain, so the ruling is what puts them there rather than the import.
  const listed = await handleAction({ action: "list-findings", artistId: ARTIST }, { store });
  assert.equal(allFindings(listed).length, 80);
  assert.ok(allFindings(listed).every((finding) => finding.inBrain === false));
});

test("one approval puts every finding in the brain and records who made it", async () => {
  const { store } = await importedAndApproved();
  const view = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  assert.equal(view.approved, true);
  assert.equal(view.approvedBy, "Grey");
  assert.ok(view.approvedAt);
  assert.equal(view.counts.inBrain, 80);
  assert.equal(view.counts.removed, 0);
  const inBrain = view.groups.flatMap((group) => group.findings);
  assert.equal(inBrain.length, 80);
  assert.ok(inBrain.every((finding) => finding.inBrain === true));
  // Grouped by facet and identity, each finding carrying its evidence count.
  assert.ok(view.groups.every((group) => group.facet && group.identity && group.facetName));
  assert.ok(inBrain.every((finding) => Object.prototype.hasOwnProperty.call(finding, "independentSourceCount")));
});

test("approving the brain before importing fails and writes nothing", async () => {
  const { backend, store } = freshStore();
  await assert.rejects(
    () => handleAction({ action: "approve-brain", artistId: ARTIST }, { store }),
    /Import this artist's intake files before approving the brain/,
  );
  assert.equal(backend.files.size, 0);
});

test("taking out one finding removes only that finding and leaves every other object byte-identical", async () => {
  const { backend, store } = await importedAndApproved();
  const before = new Map(backend.files);
  await handleAction({ action: "remove-finding", artistId: ARTIST, findingId: "finding-5", person: "Grey" }, { store });

  // The record and the prior are untouched, byte for byte. A finding is taken
  // out of the brain and is never deleted from the artist's history.
  assert.equal(backend.files.get(pathFor(ARTIST, "record", DEMO_ACCOUNT)), before.get(pathFor(ARTIST, "record", DEMO_ACCOUNT)));
  assert.equal(backend.files.get(pathFor(ARTIST, "prior", DEMO_ACCOUNT)), before.get(pathFor(ARTIST, "prior", DEMO_ACCOUNT)));

  const view = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  assert.equal(view.counts.inBrain, 79);
  assert.equal(view.counts.removed, 1);
  const ids = view.groups.flatMap((group) => group.findings).map((finding) => finding.id);
  assert.equal(ids.length, 79);
  assert.ok(!ids.includes("finding-5"));

  const listed = await handleAction({ action: "list-findings", artistId: ARTIST }, { store });
  const out = allFindings(listed).filter((finding) => !finding.inBrain);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "finding-5");
  assert.equal(out[0].removedBy, "Grey");
});

test("a finding that was taken out can be put back", async () => {
  const { store } = await importedAndApproved();
  await handleAction({ action: "remove-finding", artistId: ARTIST, findingId: "finding-7" }, { store });
  await handleAction({ action: "restore-finding", artistId: ARTIST, findingId: "finding-7" }, { store });
  const view = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  assert.equal(view.counts.inBrain, 80);
  assert.equal(view.counts.removed, 0);
  const listed = await handleAction({ action: "list-findings", artistId: ARTIST }, { store });
  assert.ok(allFindings(listed).every((finding) => finding.removedBy === null));
});

test("importing again undoes neither the approval nor a removal", async () => {
  const { store } = await importedAndApproved();
  await handleAction({ action: "remove-finding", artistId: ARTIST, findingId: "finding-3" }, { store });
  await importOnce(store);
  const view = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  assert.equal(view.approved, true);
  assert.equal(view.approvedBy, "Grey");
  assert.equal(view.counts.inBrain, 79);
  assert.ok(!view.groups.flatMap((group) => group.findings).some((finding) => finding.id === "finding-3"));
});

test("list-findings filters by facet and by identity", async () => {
  const { store } = await importedAndApproved();
  const visual = await handleAction({ action: "list-findings", artistId: ARTIST, facet: "VL" }, { store });
  assert.ok(visual.groups.length > 0);
  assert.ok(visual.groups.every((group) => group.facet === "VL"));

  const knights = await handleAction({ action: "list-findings", artistId: ARTIST, identity: "hot-country-knights" }, { store });
  assert.ok(knights.groups.length > 0);
  assert.ok(knights.groups.every((group) => group.identity === "hot-country-knights"));

  const both = await handleAction({ action: "list-findings", artistId: ARTIST, facet: "VL", identity: "hot-country-knights" }, { store });
  assert.equal(both.groups.length, 1);
  assert.equal(both.groups[0].facet, "VL");
  assert.equal(both.groups[0].identity, "hot-country-knights");
});

test("the prior is reachable by no action the page calls", async () => {
  const { store } = await importedAndApproved();

  // The prior is stored, so this test is about reach and not about absence.
  const priorText = await readFile(join(intakeDirectory(ARTIST), "00-prior.md"), "utf8");
  const marker = "Rich recollection is the Columbia failure shape";
  assert.ok(priorText.includes(marker), "the marker used by this test is in the prior");

  const calls = [
    { action: "get-artist" },
    { action: "list-findings" },
    { action: "get-evidence", findingId: "finding-1" },
    { action: "approve-brain" },
    { action: "remove-finding", findingId: "finding-1" },
    { action: "restore-finding", findingId: "finding-1" },
    { action: "import-intake" },
  ];
  for (const call of calls) {
    const result = await handleAction({ ...call, artistId: ARTIST }, { store });
    assert.ok(!JSON.stringify(result).includes(marker), `${call.action} returned prior text`);
  }
  await assert.rejects(
    () => handleAction({ action: "get-prior", artistId: ARTIST }, { store }),
    /not something this route does/,
  );
});

test("a second artist with no import returns an empty record and never the first artist's data", async () => {
  const { store } = await importedAndApproved();

  const other = await handleAction({ action: "get-artist", artistId: "kacey-musgraves" }, { store });
  assert.equal(other.artist, null);
  assert.equal(other.approved, false);
  assert.deepEqual(other.groups, []);
  assert.equal(other.counts.findings, 0);
  assert.equal(other.counts.inBrain, 0);

  const listed = await handleAction({ action: "list-findings", artistId: "kacey-musgraves" }, { store });
  assert.deepEqual(listed.groups, []);
  assert.ok(!JSON.stringify(other).includes("Dierks"));
  assert.ok(!JSON.stringify(listed).includes("Dierks"));

  // The first artist is untouched by the second one being read, and the second
  // artist's brain is not approved just because the first one's is.
  const first = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  assert.equal(first.counts.inBrain, 80);
  assert.equal(first.approved, true);
});

test("importing an artist with no intake files fails plainly and writes nothing", async () => {
  const { backend, store } = freshStore();
  await assert.rejects(
    () => handleAction({ action: "import-intake", artistId: "kacey-musgraves" }, { store }),
    /No intake files are stored for that artist yet/,
  );
  assert.equal(backend.files.size, 0);
});

test("get-evidence reports what the intake files record behind a finding", async () => {
  const { store } = await importedAndApproved();
  const evidence = await handleAction({ action: "get-evidence", artistId: ARTIST, findingId: "finding-1" }, { store });
  assert.equal(evidence.findingId, "finding-1");
  assert.equal(typeof evidence.independentSourceCount, "number");
  assert.ok(evidence.tiers.length > 0);
  // The first intake run did not record which claims sit behind each finding,
  // so the chain is reported as unlinked rather than guessed at. Recorded in
  // docs/deferred-work.md. When a later run carries claim ids, this flips to
  // true and the claims and sources arrive with it.
  assert.equal(evidence.evidenceLinked, false);
  assert.deepEqual(evidence.claims, []);
  await assert.rejects(
    () => handleAction({ action: "get-evidence", artistId: ARTIST, findingId: "finding-9999" }, { store }),
    /That finding was not found/,
  );
});
