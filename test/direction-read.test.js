import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { analysisPathFor, createAnalysisStore, DIRECTION_READ, directionSubjectId } from "../src/intelligence/analysis.js";
import { renderDirectionRead } from "../app/intelligence/direction-view.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "../src/org/store.js";

// Job two of Intelligence, checked by what it stored and by what a reader
// receives rather than by what a call returned.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = "dierks-bentley";
const TOUR = "off-the-map-2026";

const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: OPERATOR_ROLE, roleLabel: "Higher Roads" };
const CLIENT = { id: "client", login: "nadia", displayName: "Nadia Cole", role: CLIENT_ROLE, roleLabel: "Client reviewer" };

function read(name) {
  return fs.readFileSync(path.join(rootPath, name), "utf8");
}

// A model that names one finding the brain holds and one it does not, and puts
// an entry in each cluster. The departure cites a finding nobody gave it, so an
// entry with no surviving trail is exercised on the way through.
function modelReply(overrides = {}) {
  const answer = {
    appliedFindings: [
      { id: "finding-1", why: "It bears on what the direction is asking the show to be." },
      { id: "finding-9999", why: "This one is not in the record." },
    ],
    continuity: [
      { title: "Weather as structure", note: "The direction builds the show around one event.", restsOn: ["finding-1"] },
    ],
    departure: [
      { title: "A claim with no record behind it", note: "Nothing supports this.", restsOn: ["finding-9999"] },
    ],
    echo: [
      { title: "The early club rig", note: "A single warm source on the band.", restsOn: ["finding-1", "finding-9999"] },
    ],
    openQuestions: ["Is the aviation reference meant to stay implicit?"],
    ...overrides,
  };
  return {
    async fetchImpl() {
      return {
        ok: true,
        async json() {
          return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer) } }], usage: {} };
        },
      };
    },
  };
}

async function ready() {
  const artistBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend, accountId: DEMO });
  await artistAction({ action: "import-intake", artistId: DEMO }, { store });
  await artistAction({ action: "approve-brain", artistId: DEMO, person: "Grey" }, { store });

  const tourBackend = createMemoryBackend();
  const tourStore = createTourStore({ backend: tourBackend, accountId: DEMO });
  await seedTourFromFixture(tourStore, TOUR);
  const analysisStore = createAnalysisStore({ backend: tourBackend, accountId: DEMO });
  return { artistBackend, store, tourBackend, tourStore, analysisStore };
}

function options(context, user = OPERATOR, extra = {}) {
  return {
    user,
    store: context.store,
    tourStore: context.tourStore,
    analysisStore: context.analysisStore,
    apiKey: "test-key",
    logger() {},
    ...extra,
  };
}

function storedReads(context, version = 1) {
  const body = context.tourBackend.files.get(
    analysisPathFor(DIRECTION_READ, TOUR, directionSubjectId(version), DEMO),
  );
  assert.ok(body, `nothing was stored for direction version ${version}`);
  return JSON.parse(body).analyses;
}

test("a direction read stores the version, both dates, the clusters, and the evidence snapshot", async () => {
  const context = await ready();
  await tourAction({ action: "run-direction-read", tourId: TOUR }, options(context, OPERATOR, modelReply()));

  const analyses = storedReads(context);
  assert.equal(analyses.length, 1);
  const analysis = analyses[0];

  assert.equal(analysis.job, DIRECTION_READ);
  assert.equal(analysis.run, 1);
  assert.equal(analysis.artistId, DEMO);
  assert.equal(analysis.ranBy, "Ray Mercer");
  // The subject of this job is a version of the tour direction.
  assert.equal(analysis.directionVersion, 1);
  assert.equal(analysis.subject.directionVersion, 1);
  assert.equal(analysis.subject.tourId, TOUR);
  assert.ok(!Number.isNaN(Date.parse(analysis.ranAt)), "the run has no usable date");
  assert.ok(!Number.isNaN(Date.parse(analysis.brainApprovedAt)), "the approved record is not named");

  assert.deepEqual(analysis.result.continuity.map((entry) => entry.title), ["Weather as structure"]);
  assert.deepEqual(analysis.result.continuity[0].restsOn, ["finding-1"]);
  assert.deepEqual(analysis.result.echo[0].restsOn, ["finding-1"], "a citation the record does not hold was stored");
  // Nothing the record cannot support survives, whole entry included.
  assert.deepEqual(analysis.result.departure, []);
  assert.deepEqual(analysis.result.openQuestions, ["Is the aviation reference meant to stay implicit?"]);

  // The trail as it stood when the run happened, copied rather than pointed at.
  assert.equal(analysis.evidence.length, 1);
  assert.equal(analysis.evidence[0].findingId, "finding-1");
  assert.equal(typeof analysis.evidence[0].independentSourceCount, "number");
  assert.ok(analysis.evidence[0].text, "the evidence carries an id and no words");
  assert.ok(Array.isArray(analysis.evidence[0].claimIds), "the run stored no claim list");
});

test("reading again chains a second run and leaves the first exactly as it was", async () => {
  const context = await ready();
  await tourAction({ action: "run-direction-read", tourId: TOUR }, options(context, OPERATOR, modelReply()));
  const first = JSON.stringify(storedReads(context)[0]);

  await tourAction(
    { action: "run-direction-read", tourId: TOUR },
    options(context, OPERATOR, modelReply({ continuity: [{ title: "A later read", note: "Second time.", restsOn: ["finding-1"] }] })),
  );

  const analyses = storedReads(context);
  assert.equal(analyses.length, 2);
  assert.equal(JSON.stringify(analyses[0]), first, "the earlier run was rewritten");
  assert.equal(analyses[1].run, 2);
  assert.deepEqual(analyses[1].result.continuity.map((entry) => entry.title), ["A later read"]);
});

test("a read is kept against the direction version it read, and earlier versions stay readable", async () => {
  const context = await ready();
  await tourAction({ action: "run-direction-read", tourId: TOUR }, options(context, OPERATOR, modelReply()));

  // The director's words move on. The tour now reads at version two.
  await context.tourStore.addDirection(TOUR, {
    version: 2,
    setBy: "Marguerite Sable",
    setOn: "2026-08-29",
    words: "Hold the weather unresolved until the last chorus.",
  });
  await tourAction({ action: "run-direction-read", tourId: TOUR }, options(context, OPERATOR, modelReply()));

  // Run numbering starts again under the new version, and version one is intact.
  assert.equal(storedReads(context, 1).length, 1);
  const second = storedReads(context, 2);
  assert.equal(second.length, 1);
  assert.equal(second[0].run, 1);
  assert.equal(second[0].directionVersion, 2);

  const body = await tourAction({ action: "get-direction-read", tourId: TOUR }, options(context, OPERATOR));
  assert.equal(body.directionVersion, 2);
  assert.deepEqual(body.analyses.map((entry) => entry.directionVersion), [1, 2]);
});

test("a client session is refused both actions and reaches no part of a read", async () => {
  const context = await ready();
  await tourAction({ action: "run-direction-read", tourId: TOUR }, options(context, OPERATOR, modelReply()));

  for (const action of ["run-direction-read", "get-direction-read"]) {
    await assert.rejects(
      () => tourAction({ action, tourId: TOUR }, options(context, CLIENT, modelReply())),
      (error) => {
        assert.equal(error.status, 403);
        assert.match(error.message, /Higher Roads team/);
        return true;
      },
      `${action} answered a client`,
    );
  }

  // The refusal is the allowlist, not a check written twice.
  const source = read("api/tour/index.js");
  const allowlist = source.slice(source.indexOf("const CLIENT_ACTIONS"), source.indexOf("function signedIn"));
  assert.ok(!allowlist.includes("direction-read"), "a direction read action is open to clients");
});

test("a read renders its clusters with no score, no meter, and no entry without its trail", () => {
  const analysis = {
    run: 2,
    ranAt: "2026-08-29T10:15:00.000Z",
    brainApprovedAt: "2026-08-19T00:00:00.000Z",
    directionVersion: 2,
    subject: { directionVersion: 2, directionSetBy: "Marguerite Sable" },
    result: {
      continuity: [{ title: "Weather as structure", note: "Built around one event.", restsOn: ["finding-1"] }],
      departure: [],
      echo: [{ title: "The early club rig", note: "One warm source.", restsOn: ["finding-1"] }],
      openQuestions: [],
    },
    evidence: [{
      findingId: "finding-1",
      text: "He has staged weather as structure before.",
      independentSourceCount: 6,
      tiers: ["A", "B"],
      why: "It is the precedent the direction is leaning on.",
      claims: [],
      sources: [],
    }],
  };
  const html = renderDirectionRead(analysis);

  assert.match(html, /What the direction keeps/);
  assert.match(html, /What it echoes/);
  // A cluster with nothing in it writes no heading over a void.
  assert.ok(!html.includes("Where it leaves the record"), "an empty cluster rendered its heading");

  // Every entry carries the finding it rests on, in full, under the one label.
  assert.match(html, /What this rests on in the artist&#039;s history|What this rests on in the artist's history/);
  assert.match(html, /He has staged weather as structure before/);
  assert.match(html, /It is the precedent the direction is leaning on/);

  // Version identity travels with the answer.
  assert.match(html, /TOUR DIRECTION V02/);
  assert.match(html, /RUN 02/);
  assert.match(html, /ARTIST KNOWLEDGE APPROVED 2026-08-19/);

  // Nothing that reads as a verdict.
  for (const word in { score: 1, verdict: 1, rating: 1, aligned: 1, "%": 1 }) {
    assert.ok(!html.toLowerCase().includes(word), `the read wrote the word ${word}`);
  }
  assert.ok(!/<meter|<progress|role="meter"|role="progressbar"/.test(html), "the read rendered a meter");
});

test("the direction instrument is live and names the version it will read", () => {
  const source = read("app/intelligence.js");
  assert.match(source, /Compare direction \$\{escape\(version\)\}/);
  assert.match(source, /data-read/);
  const asks = source.slice(source.indexOf("function asks()"), source.indexOf("function directionControl"));
  assert.ok(asks.includes("control: directionControl()"), "the direction ask does not use its own control");
  // Jobs one, two, and three are live and none of them sits behind a dead
  // state. Job four still names what it waits on. (Updated 2026-08-29 when the
  // board review shipped and job three's Coming state came off.)
  assert.ok(asks.includes("control: boardControl()"), "the board ask does not use its own control");
  assert.equal((asks.match(/m-state">Coming/g) || []).length, 0, "a live job still says Coming");
  assert.match(asks, /Waiting on tour data/);
});

test("the answer region with nothing in it is the answer region, not a card with a missing half", () => {
  const source = read("app/intelligence.js");
  const empty = source.slice(source.indexOf("function emptyResult()"), source.indexOf("function result()"));
  // m-empty-state is a two-column grid of a visual and a body. This page never
  // supplied the visual, so the body rendered inside the 7rem visual column.
  assert.ok(!empty.includes("m-empty-state"), "the empty answer is a card again");
  assert.match(empty, /m-intelligence-results__handoff/);
  assert.ok(!empty.includes("data-open-job"), "cross-job navigation returned to the answer head");
});

test("the run a person is reading is named rather than offered as a control", () => {
  const source = read("app/intelligence.js");
  const picker = source.slice(source.indexOf("function picker("), source.indexOf("function runHistory"));
  assert.match(picker, /m-state m-state--current/);
  assert.match(picker, /aria-current="true"/);
  // The current run is not a button. Earlier runs are.
  assert.ok(picker.indexOf("m-state--current") < picker.indexOf("<button"), "the current run is still a control");
});

test("each completed instrument owns the way back to its latest answer", () => {
  const source = read("app/intelligence.js");
  const asks = source.slice(source.indexOf("function asks()"), source.indexOf("function directionControl"));
  const answerDoor = source.slice(source.indexOf("function answerDoor("), source.indexOf("function directionControl"));
  const result = source.slice(source.indexOf("function result()"), source.indexOf("function reference()"));

  assert.equal((asks.match(/answer: answerDoor\(/g) || []).length, 3, "a completed job cannot own its answer");
  assert.match(answerDoor, /data-open-job/);
  assert.match(answerDoor, /SHOWING BELOW/);
  assert.ok(!result.includes("data-open-job"), "the answer head still switches between jobs");
  assert.match(source, /<span class="m-label">Run history<\/span>/, "within-job history is not named separately");
});
