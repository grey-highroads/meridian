import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { analysisPathFor, BOARD_REVIEW, boardSubjectId, createAnalysisStore } from "../src/intelligence/analysis.js";
import { buildBoardReviewRequest, checkBoardReview } from "../src/tour/board-review.js";
import { renderBoardReview, renderBoardReviewInDrawer } from "../app/intelligence/board-view.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "../src/org/store.js";

// Job three of Intelligence, checked by what it stored, by what a reader
// receives, and by what a client cannot reach.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = "dierks-bentley";
const TOUR = "off-the-map-2026";
const SCENE = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: SCENE };

const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: OPERATOR_ROLE, roleLabel: "Higher Roads" };
const CLIENT = { id: "client", login: "nadia", displayName: "Nadia Cole", role: CLIENT_ROLE, roleLabel: "Client reviewer" };

const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nCQAAAAASUVORK5CYII=";
const IMAGE = { name: "storm-v1.png", contentType: "image/png", size: 68, dataUrl: `data:image/png;base64,${PIXEL}` };
const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
  cameFrom: "written by Higher Roads",
};

function read(name) {
  return fs.readFileSync(path.join(rootPath, name), "utf8");
}

// A model that names one finding the record holds and one it does not, and puts
// an entry in each group. The departure cites a finding nobody gave it, so an
// entry with no surviving trail is exercised on the way through.
function modelReply(overrides = {}) {
  const answer = {
    appliedFindings: [
      { id: "finding-1", why: "It bears on how this artist has staged weather before." },
      { id: "finding-9999", why: "This one is not in the record." },
    ],
    alignment: [
      { title: "One front, held back", note: "The board keeps the weather at the horizon.", restsOn: ["finding-1"] },
    ],
    departure: [
      { title: "A claim with no record behind it", note: "Nothing supports this.", restsOn: ["finding-9999"] },
    ],
    prohibition: [
      { title: "The flag reads as a device", note: "It sits centre frame behind the band.", restsOn: ["finding-1"] },
    ],
    openQuestions: ["Is the horizon line meant to stay this low?"],
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
  const tourBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend, accountId: DEMO });
  const tourStore = createTourStore({ backend: tourBackend, accountId: DEMO });
  const artboardStore = createArtboardStore({ backend: tourBackend, accountId: DEMO });
  const sceneRecord = createSceneRecord({ backend: tourBackend, accountId: DEMO });
  const analysisStore = createAnalysisStore({ backend: tourBackend, accountId: DEMO });
  await seedTourFromFixture(tourStore, TOUR);
  await artistAction({ action: "import-intake", artistId: DEMO }, { store });
  await artistAction({ action: "approve-brain", artistId: DEMO, person: "Grey" }, { store });
  const context = { store, tourStore, artboardStore, sceneRecord, analysisStore, tourBackend };
  await tourAction({ action: "choose-concept", ...AT, concept: CONCEPT }, options(context));
  await tourAction({ action: "freeze-brief", ...AT }, options(context));
  await tourAction({ action: "issue-brief", ...AT, briefVersion: 1, recipient: "Jess Harper" }, options(context));
  return context;
}

function options(context, user = OPERATOR, extra = {}) {
  return {
    user,
    store: context.store,
    tourStore: context.tourStore,
    artboardStore: context.artboardStore,
    sceneRecord: context.sceneRecord,
    analysisStore: context.analysisStore,
    apiKey: "test-key",
    logger() {},
    ...extra,
  };
}

async function submit(context, artifact = IMAGE, extra = {}) {
  return await tourAction({
    action: "submit-artboard",
    ...AT,
    briefVersion: 1,
    artifact,
    conceptSummary: "The weather stays quiet until the last break.",
    ...extra,
  }, options(context));
}

function storedReads(context, version = 1) {
  const body = context.tourBackend.files.get(
    analysisPathFor(BOARD_REVIEW, TOUR, boardSubjectId(SCENE, version), DEMO),
  );
  assert.ok(body, `nothing was stored for artboard version ${version}`);
  return JSON.parse(body).analyses;
}

test("the call hands the model the board itself, not a description of it", async () => {
  const context = await ready();
  await submit(context);

  let sent = null;
  await tourAction({ action: "run-board-review", ...AT, artboardVersion: 1 }, options(context, OPERATOR, {
    async fetchImpl(url, init) {
      sent = JSON.parse(init.body);
      return {
        ok: true,
        async json() {
          return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
            appliedFindings: [{ id: "finding-1", why: "Because." }],
            alignment: [{ title: "Held back", note: "Quiet.", restsOn: ["finding-1"] }],
            departure: [], prohibition: [], openQuestions: [],
          }) } }], usage: {} };
        },
      };
    },
  }));

  const parts = sent.messages.at(-1).content;
  assert.ok(Array.isArray(parts), "the board was sent as text alone");
  const image = parts.find((part) => part.type === "image_url");
  assert.ok(image, "no image part reached the model");
  assert.equal(image.image_url.url, IMAGE.dataUrl);
});

test("a version with no image is refused rather than reviewed from its paperwork", async () => {
  const context = await ready();
  // The stand-in writes an SVG. A model cannot look at one, so this version is
  // refused instead of read from its receipt and its brief.
  await submit(context, { name: "board.svg", contentType: "image/svg+xml", size: 12, blobPathname: null, dataUrl: null })
    .then(() => assert.fail("a version with no artifact was accepted"))
    .catch((error) => assert.match(error.message, /Add the work before submitting/));

  await submit(context);
  await context.artboardStore.addSubmittedArtboard(TOUR, SCENE, {
    artboard: {
      jobId: "job", briefVersion: 1, artboardVersion: 2, status: "received",
      artifact: { type: "artboard", location: "stand-in.svg" },
      conceptSummary: "Stand-in work.",
    },
    receipt: { artboardVersion: 2 },
  });

  await assert.rejects(
    () => tourAction({ action: "run-board-review", ...AT, artboardVersion: 2 }, options(context, OPERATOR, modelReply())),
    (error) => {
      assert.equal(error.status, 400);
      assert.match(error.message, /no image to check/);
      return true;
    },
  );
  assert.equal(context.tourBackend.files.get(analysisPathFor(BOARD_REVIEW, TOUR, boardSubjectId(SCENE, 2), DEMO)), undefined);
});

test("a board review stores the version, both dates, the groups, and the evidence snapshot", async () => {
  const context = await ready();
  await submit(context);
  await tourAction({ action: "run-board-review", ...AT, artboardVersion: 1 }, options(context, OPERATOR, modelReply()));

  const analyses = storedReads(context);
  assert.equal(analyses.length, 1);
  const analysis = analyses[0];

  assert.equal(analysis.job, BOARD_REVIEW);
  assert.equal(analysis.run, 1);
  assert.equal(analysis.artistId, DEMO);
  assert.equal(analysis.ranBy, "Ray Mercer");
  assert.equal(analysis.subject.artboardVersion, 1);
  assert.equal(analysis.subject.briefVersion, 1);
  assert.equal(analysis.subject.sceneId, SCENE);
  assert.ok(!Number.isNaN(Date.parse(analysis.ranAt)), "the run has no usable date");
  assert.ok(!Number.isNaN(Date.parse(analysis.brainApprovedAt)), "the approved record is not named");

  assert.deepEqual(analysis.result.alignment.map((entry) => entry.title), ["One front, held back"]);
  assert.deepEqual(analysis.result.prohibition[0].restsOn, ["finding-1"]);
  // Nothing the record cannot support survives, whole entry included.
  assert.deepEqual(analysis.result.departure, []);
  assert.deepEqual(analysis.result.openQuestions, ["Is the horizon line meant to stay this low?"]);

  // The trail as it stood when the run happened, copied rather than pointed at.
  assert.equal(analysis.evidence.length, 1);
  assert.equal(analysis.evidence[0].findingId, "finding-1");
  assert.ok(analysis.evidence[0].text, "the evidence carries an id and no words");
  assert.ok(Array.isArray(analysis.evidence[0].claimIds), "the run stored no claim list");

  // Nothing here is a verdict, a score, or a conclusion.
  const stored = JSON.stringify(analysis.result);
  for (const word of ["score", "verdict", "rating", "recommendation"]) {
    assert.ok(!stored.toLowerCase().includes(word), `the stored read carries a ${word}`);
  }
});

test("reading again chains a second run, and a later version starts again at run one", async () => {
  const context = await ready();
  await submit(context);
  await tourAction({ action: "run-board-review", ...AT, artboardVersion: 1 }, options(context, OPERATOR, modelReply()));
  const first = JSON.stringify(storedReads(context)[0]);

  await tourAction({ action: "run-board-review", ...AT, artboardVersion: 1 }, options(context, OPERATOR, modelReply({
    alignment: [{ title: "A later read", note: "Second time.", restsOn: ["finding-1"] }],
  })));

  const analyses = storedReads(context);
  assert.equal(analyses.length, 2);
  assert.equal(JSON.stringify(analyses[0]), first, "the earlier run was rewritten");
  assert.equal(analyses[1].run, 2);

  // A second version of the work is its own subject.
  await tourAction({
    action: "issue-revision", ...AT, sourceArtboardVersion: 1, revisionId: "rev-1",
    instructions: [{ text: "Hold the last frame longer." }],
  }, options(context));
  await submit(context, IMAGE, { sourceArtboardVersion: 1 });
  await tourAction({ action: "run-board-review", ...AT, artboardVersion: 2 }, options(context, OPERATOR, modelReply()));

  assert.equal(storedReads(context, 1).length, 2, "version one's runs moved");
  const second = storedReads(context, 2);
  assert.equal(second.length, 1);
  assert.equal(second[0].run, 1);
  assert.equal(second[0].subject.artboardVersion, 2);

  const body = await tourAction({ action: "get-board-review", ...AT, artboardVersion: 2 }, options(context));
  assert.equal(body.artboardVersion, 2);
  assert.equal(body.analyses.length, 1);
});

test("a read full of departures does not change what presenting takes", async () => {
  // Two versions of the same work in the same tour. One carries a stored read
  // with entries in every group. The other has no read at all. Presenting is
  // the same single action on both, and neither presenting nor the state that
  // follows it consults the analysis.
  const withRead = await ready();
  await submit(withRead);
  await tourAction({ action: "run-board-review", ...AT, artboardVersion: 1 }, options(withRead, OPERATOR, modelReply({
    departure: [{ title: "It leaves the record", note: "Nothing here is what he has done.", restsOn: ["finding-1"] }],
  })));
  assert.ok(storedReads(withRead)[0].result.departure.length, "the read stored no departures");

  const withoutRead = await ready();
  await submit(withoutRead);

  const results = [];
  for (const context of [withRead, withoutRead]) {
    const presented = await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 1 }, options(context));
    const intent = await tourAction({ action: "get-production-intent", ...AT }, options(context));
    results.push(JSON.stringify({
      version: presented.readyForClient ? presented.readyForClient.artboardVersion : presented.artboardVersion,
      ready: (intent.readyForClient || []).map((entry) => entry.artboardVersion),
    }));
  }
  assert.equal(results[0], results[1], "a stored read changed what presenting produced");

  // The action's own code never looks at an analysis.
  const source = read("api/tour/index.js");
  const present = source.slice(source.indexOf('body.action === "approve-for-client"'), source.indexOf('body.action === "client-approve"'));
  assert.ok(!present.includes("BOARD_REVIEW"), "presenting reads the board review");
  assert.ok(!present.includes("readAnalyses"), "presenting reads a stored analysis");
});

test("a client is refused both actions and finds no trace of a read in anything they receive", async () => {
  const context = await ready();
  await submit(context);
  await tourAction({ action: "run-board-review", ...AT, artboardVersion: 1 }, options(context, OPERATOR, modelReply()));
  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 1 }, options(context));

  for (const action of ["run-board-review", "get-board-review"]) {
    await assert.rejects(
      () => tourAction({ action, ...AT, artboardVersion: 1 }, options(context, CLIENT, modelReply())),
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
  assert.ok(!allowlist.includes("board-review"), "a board review action is open to clients");

  // Everything the client's Reviews surface asks for, checked for any trace.
  const asClient = options(context, CLIENT);
  const payloads = await Promise.all([
    tourAction({ action: "get-artboards", ...AT }, asClient),
    tourAction({ action: "get-reviews", ...AT }, asClient),
    tourAction({ action: "get-production-intent", ...AT }, asClient),
    tourAction({ action: "get-brief", ...AT, artboardVersion: 1 }, asClient),
    tourAction({ action: "get-artboard-artifact", ...AT, artboardVersion: 1 }, asClient),
    tourAction({ action: "get-scene-activity", ...AT }, asClient),
  ]);
  const body = JSON.stringify(payloads).toLowerCase();
  for (const trace of ["board-review", "boardread", "one front, held back", "prohibition", "restson", "finding-1"]) {
    assert.ok(!body.includes(trace), `a client payload carries ${trace}`);
  }

  // The client's own page never asks for it either.
  const script = read("app/reviews.js");
  const detail = script.slice(script.indexOf("async function detailFor("), script.indexOf("async function openVersion("));
  assert.match(detail, /higher-roads"\s*\n?\s*\?\s*call\("get-board-review"/, "the read is fetched without checking the role");
});

test("an entry the record cannot support is dropped whole, and a read with nothing left is an error", () => {
  const context = { findings: [{ findingId: "finding-1", text: "He has staged weather before.", facetName: "Stage" }] };
  const kept = checkBoardReview({
    appliedFindings: [{ id: "finding-1", why: "It is the precedent." }],
    alignment: [{ title: "Kept", note: "Traceable.", restsOn: ["finding-1", "finding-404"] }],
    departure: [{ title: "Dropped", note: "Nothing behind it.", restsOn: ["finding-404"] }],
    prohibition: [],
    openQuestions: [],
  }, context);
  assert.deepEqual(kept.alignment.map((entry) => entry.title), ["Kept"]);
  assert.deepEqual(kept.alignment[0].restsOn, ["finding-1"]);
  assert.deepEqual(kept.departure, []);
  assert.deepEqual(kept.droppedFindings, []);

  assert.throws(() => checkBoardReview({
    appliedFindings: [],
    alignment: [{ title: "Untraceable", note: "", restsOn: ["finding-404"] }],
    departure: [], prohibition: [], openQuestions: [],
  }, context), /nothing the artist's record supports/);

  // The instruction to the model refuses a verdict in words as well.
  const request = buildBoardReviewRequest({
    ...context,
    tourName: "Off The Map",
    sceneTitle: "Storm and lightning",
    directionVersion: 1,
    direction: { words: "Hold the weather unresolved." },
    request: "A storm behind the band.",
    artboardVersion: 1,
    briefVersion: 1,
    chosenConcept: { title: "The front", idea: "Weather builds." },
    avoid: ["No flag imagery."],
    board: { dataUrl: `data:image/png;base64,${PIXEL}`, contentType: "image/png" },
  });
  assert.match(request.messages[0].content, /Never write a verdict, a score/);
});

test("a read renders its groups with no verdict and no entry without its trail", () => {
  const analysis = {
    run: 2,
    ranAt: "2026-08-29T10:15:00.000Z",
    brainApprovedAt: "2026-08-19T00:00:00.000Z",
    directionVersion: 1,
    subject: { sceneTitle: "Storm and lightning", artboardVersion: 2 },
    result: {
      alignment: [{ title: "One front, held back", note: "The weather stays at the horizon.", restsOn: ["finding-1"] }],
      departure: [],
      prohibition: [{ title: "The flag reads as a device", note: "Centre frame.", restsOn: ["finding-1"] }],
      openQuestions: [],
    },
    evidence: [{
      findingId: "finding-1",
      text: "He has staged weather as structure before.",
      independentSourceCount: 6,
      tiers: ["A", "B"],
      why: "It is the precedent this board is leaning on.",
      claims: [],
      sources: [],
    }],
  };
  const html = renderBoardReview(analysis);

  assert.match(html, /m-intelligence-read-group/, "the review groups are not composed as one object's parts");
  assert.ok(!html.includes("m-section-heading"), "a review group still renders at page-section scale");
  assert.match(html, /m-intelligence-read__lineage/, "review lineage is not quieted separately from the read");

  assert.match(html, /Where it matches this artist&#039;s history|Where it matches this artist's history/);
  assert.match(html, /What this artist stays away from/);
  // A group with nothing in it writes no heading over a void.
  assert.ok(!html.includes("Where it goes somewhere new"), "an empty group rendered its heading");

  // Every entry carries the finding it rests on, in full, under the one label.
  assert.match(html, /What this rests on in the artist&#039;s history|What this rests on in the artist's history/);
  assert.match(html, /He has staged weather as structure before/);
  assert.match(html, /It is the precedent this board is leaning on/);

  // Version identity travels with the answer, and no conclusion is offered.
  assert.match(html, /ARTBOARD V02/);
  assert.match(html, /RUN 02/);
  for (const word of ["Overall", "verdict", "score", "aligned", "%"]) {
    assert.ok(!html.includes(word), `the read rendered a ${word}`);
  }

  // The drawer shows the same record, and offers a read where there is none.
  const drawer = renderBoardReviewInDrawer(analysis);
  assert.match(drawer, /One front, held back/);
  assert.match(drawer, /He has staged weather as structure before/);
  assert.match(drawer, /m-section-heading/, "the compact drawer inherited the full-page read treatment");
  assert.match(renderBoardReviewInDrawer(null), /has not been checked yet/);
  assert.match(renderBoardReviewInDrawer(null), /data-read-board/);
});
