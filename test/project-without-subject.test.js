import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtistDirectory } from "../src/org/artists.js";
import { parseTour } from "../src/tour/parse-fixture.js";
import { compileBrief, renderBriefDocument, renderBriefSidecar } from "../src/tour/brief.js";
import { OPERATOR_ROLE } from "../src/org/store.js";

// A project is a job Higher Roads was engaged for. Most of them are about
// somebody. A projection mapping job is about a building, and until this landed
// the app refused to hold one: create-account demanded a first artist,
// create-tour demanded an artistId twice, and the fixture parser demanded one
// too. Step 2 of docs/meridian-roadmap-phase-2.md.
//
// The state the author was not looking at runs both ways here: an account that
// holds artists making a project without one, and an account that holds none
// making a project at all.

const ACCOUNT = "northstar-live";

const OPERATOR = { id: "operator", role: OPERATOR_ROLE, roleLabel: "Higher Roads", accountId: ACCOUNT, displayName: "Grey" };

function tourOptions(backend) {
  return {
    user: OPERATOR,
    actingAccount: ACCOUNT,
    tourStore: createTourStore({ backend, accountId: ACCOUNT }),
    store: createArtistStore({ backend, accountId: ACCOUNT }),
    artists: createArtistDirectory({ backend, accountId: ACCOUNT }),
  };
}

async function accountHoldingAnArtist(backend) {
  const directory = createArtistDirectory({ backend, accountId: ACCOUNT });
  await directory.createArtist({ name: "Wren Halloway" });
  return directory;
}

test("a project stores no artist when none is chosen", async () => {
  const backend = createMemoryBackend();
  await accountHoldingAnArtist(backend);
  const created = await tourAction(
    { action: "create-tour", name: "Riverside Facade 2027" },
    tourOptions(backend),
  );
  // Null, not an empty string and not the account's only artist picked for
  // somebody. Nothing chose on the person's behalf.
  assert.equal(created.tour.artistId, null);
  assert.equal(created.tour.id, "riverside-facade-2027");
});

test("a project that names an artist is verified exactly as before", async () => {
  const backend = createMemoryBackend();
  await accountHoldingAnArtist(backend);
  const created = await tourAction(
    { action: "create-tour", name: "Off The Map 2027", artistId: "wren-halloway" },
    tourOptions(backend),
  );
  assert.equal(created.tour.artistId, "wren-halloway");

  await assert.rejects(
    () => tourAction(
      { action: "create-tour", name: "Ghost Job 2027", artistId: "nobody-here" },
      tourOptions(backend),
    ),
    (error) => error.status === 404,
  );
});

test("an account holding no artist can still start a project", async () => {
  const backend = createMemoryBackend();
  // The account is made from the Higher Roads admin's own session, which sits
  // outside any client account, the same way Admin makes one.
  const created = await artistAction(
    { action: "create-account", name: "Northstar Live" },
    { user: { ...OPERATOR, accountId: "dierks-bentley" }, store: createArtistStore({ backend, accountId: "dierks-bentley" }) },
  );
  assert.equal(created.artist, null);
  const tour = await tourAction(
    { action: "create-tour", name: "Riverside Facade 2027" },
    tourOptions(backend),
  );
  assert.equal(tour.tour.artistId, null);
});

test("a tour file without an Artist line parses to no artist", () => {
  const text = [
    "# Riverside Facade 2027",
    "",
    "Tour id: riverside-facade-2027",
    "Label: Mapping job",
    "",
    "## Direction, version 1",
    "",
    "Set by: Nadia Cole",
    "The facade is the instrument. Everything reads as light on stone.",
  ].join("\n");
  const parsed = parseTour(text);
  assert.equal(parsed.artistId, null);
  assert.equal(parsed.id, "riverside-facade-2027");
  assert.equal(parsed.label, "Mapping job");

  // A file missing a title or an id is still refused, so dropping the artist
  // did not drop the check around it.
  assert.throws(() => parseTour("Tour id: nameless\n\n## Direction, version 1\n\nWords."), /a title and a tour id/);
});

test("a brief from a subjectless project keeps its shape and says nothing about an artist", () => {
  const tour = {
    id: "riverside-facade-2027",
    name: "Riverside Facade 2027",
    artistId: null,
    productionSetup: null,
    direction: { version: 1, words: "The facade is the instrument.", setBy: "Nadia Cole", setOn: "2026-09-01" },
  };
  const assignment = {
    id: "scene-1",
    title: "Opening sweep",
    moment: null,
    requestedBy: "Nadia Cole",
    requestedOn: "2026-09-01",
    request: "Open with the stone lighting from the base upward.",
    requiredElements: ["The full facade"],
    creativeLatitude: [],
  };
  const concept = { title: "Rising stone", idea: "Light climbs the facade.", artistContext: [], avoid: [] };
  const brief = compileBrief({ tour, assignment, concept, artistId: null, briefVersion: 1 });

  // The contract does not change shape. Both fields are present and empty,
  // which is what the production receiver's checks read.
  assert.equal(brief.artistId, null);
  assert.deepEqual(brief.artistContext, []);
  const sidecar = renderBriefSidecar(brief);
  assert.ok("artistId" in sidecar, "artistId was dropped from the sidecar");
  assert.ok("artistContext" in sidecar, "artistContext was dropped from the sidecar");

  const document = renderBriefDocument(brief);
  assert.ok(!document.includes("The artist behind this"), "a job with no subject is given an artist section");
  assert.ok(!document.includes("this artist avoids"), "a job with no subject is told what this artist avoids");
  assert.ok(!document.includes("null"), "the word null reached the brief");
  assert.match(document, /Nothing on record to avoid\./);
  assert.match(document, /## The tour's direction/);
});

test("a brief from a project with a subject still reads the artist section", () => {
  const tour = {
    id: "off-the-map-2027",
    name: "Off The Map 2027",
    artistId: "wren-halloway",
    productionSetup: null,
    direction: { version: 1, words: "Storm light.", setBy: "Nadia Cole", setOn: "2026-09-01" },
  };
  const assignment = {
    id: "scene-1",
    title: "Storm",
    moment: null,
    requestedBy: "Nadia Cole",
    requestedOn: "2026-09-01",
    request: "Lightning across the upstage wall.",
    requiredElements: [],
    creativeLatitude: [],
  };
  const concept = {
    title: "Front line",
    idea: "The storm crosses the stage.",
    artistContext: [{ findingId: "finding-1", text: "He plays weather.", independentSourceCount: 3, tiers: [2, 3], why: "It is the request." }],
    avoid: ["Anything that reads as a lightning bolt logo."],
  };
  const brief = compileBrief({ tour, assignment, concept, artistId: "wren-halloway", briefVersion: 1 });
  const document = renderBriefDocument(brief);
  assert.match(document, /## The artist behind this/);
  assert.match(document, /He plays weather\./);
});

test("a project attaches and detaches subjects, and the created artist stays fixed", async () => {
  const backend = createMemoryBackend();
  const options = tourOptions(backend);
  const directory = createArtistDirectory({ backend, accountId: ACCOUNT });
  await directory.createArtist({ name: "First Artist" });
  const venue = await directory.createArtist({ name: "The Pinnacle", kind: "venue" });
  await tourAction({ action: "create-tour", name: "Attach Test", artistId: "first-artist" }, options);
  const attach = await tourAction({ action: "attach-subject", tourId: "attach-test", subjectId: venue.id }, options);
  assert.deepEqual(attach.subjectIds, ["first-artist", "the-pinnacle"], "artistId reads first, attachment after");
  await assert.rejects(
    tourAction({ action: "attach-subject", tourId: "attach-test", subjectId: venue.id }, options),
    /already on this job/, "attaching twice is refused");
  await assert.rejects(
    tourAction({ action: "detach-subject", tourId: "attach-test", subjectId: "first-artist" }, options),
    /stays on its record/, "the creation subject cannot be detached");
  const detach = await tourAction({ action: "detach-subject", tourId: "attach-test", subjectId: venue.id }, options);
  assert.deepEqual(detach.subjectIds, ["first-artist"], "detach removes the attachment only");
  const facts = await options.tourStore.readTourFacts("attach-test");
  const actions = facts.map((entry) => entry.action);
  assert.ok(actions.some((entry) => entry.includes("Attached The Pinnacle")), "the attach fact names the subject");
  assert.ok(actions.some((entry) => entry.includes("Removed The Pinnacle")), "the detach fact names the subject");
});

test("a subject from another account cannot be attached, and a subjectless project can gain its first", async () => {
  const backend = createMemoryBackend();
  const options = tourOptions(backend);
  await tourAction({ action: "create-tour", name: "Bare Job" }, options);
  await assert.rejects(
    tourAction({ action: "attach-subject", tourId: "bare-job", subjectId: "someone-elses" }, options),
    /No subject is stored under that name in this account/, "an id this account does not hold reads as absent");
  const directory = createArtistDirectory({ backend, accountId: ACCOUNT });
  const org = await directory.createArtist({ name: "Charity Org", kind: "organization" });
  const attach = await tourAction({ action: "attach-subject", tourId: "bare-job", subjectId: org.id }, options);
  assert.deepEqual(attach.subjectIds, ["charity-org"], "a project created with nobody gains its first subject later");
});
