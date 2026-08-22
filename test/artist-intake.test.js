import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { handleAction, intakeDirectory, readIntakeFiles } from "../api/artist/index.js";
import { createArtistStore, createMemoryBackend, pathFor } from "../src/artist/store.js";
import { parseIntake } from "../src/artist/parse-intake.js";

const ARTIST = "dierks-bentley";

function freshStore() {
  const backend = createMemoryBackend();
  return { backend, store: createArtistStore({ backend }) };
}

async function importOnce(store) {
  return await handleAction({ action: "import-intake", artistId: ARTIST }, { store });
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

test("importing again does not undo a ruling", async () => {
  const { store } = freshStore();
  await importOnce(store);
  await handleAction({ action: "approve-finding", artistId: ARTIST, findingId: "finding-3" }, { store });
  await importOnce(store);
  const view = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  const approved = view.groups.flatMap((group) => group.findings).map((finding) => finding.id);
  assert.deepEqual(approved, ["finding-3"]);
});

test("approving one finding changes only that finding and leaves every other object byte-identical", async () => {
  const { backend, store } = freshStore();
  await importOnce(store);
  const before = new Map(backend.files);
  await handleAction({ action: "approve-finding", artistId: ARTIST, findingId: "finding-5", person: "Grey" }, { store });

  // The record and the prior are untouched, byte for byte.
  assert.equal(backend.files.get(pathFor(ARTIST, "record")), before.get(pathFor(ARTIST, "record")));
  assert.equal(backend.files.get(pathFor(ARTIST, "prior")), before.get(pathFor(ARTIST, "prior")));

  // Exactly one finding moved, and every other finding still needs a ruling.
  const listed = await handleAction({ action: "list-findings", artistId: ARTIST }, { store });
  const findings = listed.groups.flatMap((group) => group.findings);
  const moved = findings.filter((finding) => finding.status !== "proposed");
  assert.equal(moved.length, 1);
  assert.equal(moved[0].id, "finding-5");
  assert.equal(moved[0].status, "approved");
  assert.equal(moved[0].decidedBy, "Grey");
});

test("declining a finding keeps it out of the brain and leaves the rest proposed", async () => {
  const { store } = freshStore();
  await importOnce(store);
  await handleAction({ action: "decline-finding", artistId: ARTIST, findingId: "finding-7" }, { store });
  const view = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  assert.equal(view.groups.length, 0);
  const listed = await handleAction({ action: "list-findings", artistId: ARTIST }, { store });
  const findings = listed.groups.flatMap((group) => group.findings);
  assert.equal(findings.filter((finding) => finding.status === "declined").length, 1);
  assert.equal(findings.filter((finding) => finding.status === "proposed").length, findings.length - 1);
});

test("get-artist contains only approved findings", async () => {
  const { store } = freshStore();
  await importOnce(store);
  const empty = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  assert.equal(empty.groups.length, 0, "nothing is in the brain before anyone approves anything");
  assert.equal(empty.counts.findings, 80);

  for (const id of ["finding-1", "finding-2"]) {
    await handleAction({ action: "approve-finding", artistId: ARTIST, findingId: id }, { store });
  }
  await handleAction({ action: "decline-finding", artistId: ARTIST, findingId: "finding-4" }, { store });

  const view = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  const inBrain = view.groups.flatMap((group) => group.findings);
  assert.deepEqual(inBrain.map((finding) => finding.id).sort(), ["finding-1", "finding-2"]);
  assert.ok(inBrain.every((finding) => finding.status === "approved"));
  assert.equal(view.counts.approved, 2);
  // Grouped by facet and identity, with the evidence count on each finding.
  assert.ok(view.groups.every((group) => group.facet && group.identity && group.facetName));
  assert.ok(inBrain.every((finding) => Object.prototype.hasOwnProperty.call(finding, "independentSourceCount")));
});

test("list-findings filters by facet and by identity", async () => {
  const { store } = freshStore();
  await importOnce(store);
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
  const { store } = freshStore();
  await importOnce(store);

  // The prior is stored, so this test is about reach and not about absence.
  const priorText = await readFile(join(intakeDirectory(ARTIST), "00-prior.md"), "utf8");
  const marker = "Rich recollection is the Columbia failure shape";
  assert.ok(priorText.includes(marker), "the marker used by this test is in the prior");

  const calls = [
    { action: "get-artist" },
    { action: "list-findings" },
    { action: "get-evidence", findingId: "finding-1" },
    { action: "approve-finding", findingId: "finding-1" },
    { action: "decline-finding", findingId: "finding-2" },
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
  const { store } = freshStore();
  await importOnce(store);
  await handleAction({ action: "approve-finding", artistId: ARTIST, findingId: "finding-1" }, { store });

  const other = await handleAction({ action: "get-artist", artistId: "kacey-musgraves" }, { store });
  assert.equal(other.artist, null);
  assert.deepEqual(other.groups, []);
  assert.deepEqual(other.counts, { sources: 0, claims: 0, findings: 0, approved: 0 });

  const listed = await handleAction({ action: "list-findings", artistId: "kacey-musgraves" }, { store });
  assert.deepEqual(listed.groups, []);
  assert.ok(!JSON.stringify(other).includes("Dierks"));
  assert.ok(!JSON.stringify(listed).includes("Dierks"));

  // And the first artist is untouched by the second one being read.
  const first = await handleAction({ action: "get-artist", artistId: ARTIST }, { store });
  assert.equal(first.counts.findings, 80);
  assert.equal(first.counts.approved, 1);
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
  const { store } = freshStore();
  await importOnce(store);
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
