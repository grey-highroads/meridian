import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import middleware from "../middleware.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createAnalysisStore, analysisPathFor, SCENE_IDEAS } from "../src/intelligence/analysis.js";
import { renderConceptPacket } from "../src/intelligence/concept-packet.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "../src/org/store.js";
import { SESSION_COOKIE, signSession } from "../src/org/session.js";

// Job one of Artist Intelligence, checked by what it stored and what a reader
// receives rather than by what a call returned.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = "dierks-bentley";
const TOUR = "off-the-map-2026";
const SCENE = "storm-and-lightning";

const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: OPERATOR_ROLE, roleLabel: "Higher Roads" };
const CLIENT = { id: "client", login: "nadia", displayName: "Nadia Cole", role: CLIENT_ROLE, roleLabel: "Client reviewer" };

const ENV = { MERIDIAN_OPERATOR: "operator-secret", MERIDIAN_CLIENT: "client-secret" };

function read(name) {
  return fs.readFileSync(path.join(rootPath, name), "utf8");
}

// A model that answers with two directions, one of them citing a finding the
// brain does not hold, so the dropped citation is exercised on the way through.
function modelReply(overrides = {}) {
  const answer = {
    appliedFindings: [{ id: "finding-1", why: "It bears on what this Scene is asking for." }],
    proposals: [
      {
        title: "A front that arrives",
        idea: "The weather comes in over the lawn and breaks across the song.",
        whyThisArtist: "He built his live reputation on sheds and open air.",
        rhymesWith: ["finding-1"],
        asksOfProduction: "Rehearsal time on the timing.",
        whereItMightMiss: "It could read as spectacle.",
      },
      {
        title: "The road at night",
        idea: "Headlights and county roads, cut to the tempo.",
        whyThisArtist: "The catalog keeps returning to the drive.",
        rhymesWith: ["finding-9999"],
        asksOfProduction: "Plate footage.",
        whereItMightMiss: "It has been done on other tours.",
      },
    ],
    avoidNotes: ["Nothing that reads as arena rock."],
    openQuestions: ["Which dates are indoors?"],
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

function storedAnalyses(context) {
  const body = context.tourBackend.files.get(analysisPathFor(SCENE_IDEAS, TOUR, SCENE, DEMO));
  assert.ok(body, "nothing was stored for this Scene");
  return JSON.parse(body).analyses;
}

test("asking for ideas stores the Scene, the direction version, both dates, the directions, and the evidence", async () => {
  const context = await ready();
  await tourAction(
    { action: "run-scene-ideas", tourId: TOUR, assignmentId: SCENE },
    options(context, OPERATOR, modelReply()),
  );

  const analyses = storedAnalyses(context);
  assert.equal(analyses.length, 1);
  const analysis = analyses[0];

  assert.equal(analysis.job, SCENE_IDEAS);
  assert.equal(analysis.run, 1);
  assert.equal(analysis.subject.tourId, TOUR);
  assert.equal(analysis.subject.sceneId, SCENE);
  assert.ok(analysis.subject.sceneTitle, "the Scene name was not stored");
  assert.equal(analysis.artistId, DEMO);
  assert.equal(analysis.directionVersion, 1);
  assert.equal(analysis.ranBy, "Ray Mercer");
  assert.ok(!Number.isNaN(Date.parse(analysis.ranAt)), "the run has no usable date");
  // The approved brain the answer came from. It is a date because the brain has
  // no version identifier yet, recorded in docs/deferred-work.md.
  assert.ok(!Number.isNaN(Date.parse(analysis.brainApprovedAt)), "the approved brain is not named");

  assert.deepEqual(analysis.result.directions.map((entry) => entry.title), ["A front that arrives", "The road at night"]);
  assert.deepEqual(analysis.result.directions[0].rhymesWith, ["finding-1"]);
  assert.deepEqual(analysis.result.directions[1].rhymesWith, [], "a citation the brain does not hold was stored");

  assert.equal(analysis.evidence.length, 1);
  assert.equal(analysis.evidence[0].findingId, "finding-1");
  assert.equal(typeof analysis.evidence[0].independentSourceCount, "number");
  assert.ok(analysis.evidence[0].text, "the evidence carries an id and no words");
  assert.match(analysis.evidence[0].why, /bears on/);
});

test("asking again chains a second run and leaves the first exactly as it was", async () => {
  const context = await ready();
  await tourAction({ action: "run-scene-ideas", tourId: TOUR, assignmentId: SCENE }, options(context, OPERATOR, modelReply()));
  const first = JSON.stringify(storedAnalyses(context)[0]);

  await tourAction(
    { action: "run-scene-ideas", tourId: TOUR, assignmentId: SCENE },
    options(context, OPERATOR, modelReply({ proposals: [{ title: "A second look", idea: "Something else.", rhymesWith: [] }] })),
  );

  const analyses = storedAnalyses(context);
  assert.equal(analyses.length, 2);
  assert.equal(JSON.stringify(analyses[0]), first, "the earlier run was rewritten");
  assert.equal(analyses[1].run, 2);
  assert.notEqual(analyses[0].runId, analyses[1].runId);
  assert.deepEqual(analyses[1].result.directions.map((entry) => entry.title), ["A second look"]);

  const read = await tourAction({ action: "get-scene-ideas", tourId: TOUR, assignmentId: SCENE }, options(context));
  assert.equal(read.analyses.length, 2);
});

test("the packet carries every field it promises and never calls itself a brief", async () => {
  const context = await ready();
  await tourAction({ action: "run-scene-ideas", tourId: TOUR, assignmentId: SCENE }, options(context, OPERATOR, modelReply()));
  const packet = await tourAction({ action: "get-concept-packet", tourId: TOUR, assignmentId: SCENE }, options(context));
  const analysis = storedAnalyses(context)[0];

  assert.match(packet.filename, /^concept-packet-storm-and-lightning-run-01\.txt$/);
  assert.match(packet.document, /Concept packet/);
  assert.match(packet.document, /Scene: /);
  assert.match(packet.document, /Tour direction version: V01/);
  assert.match(packet.document, new RegExp(`Generated: ${analysis.ranAt.slice(0, 10)}`));
  assert.match(packet.document, new RegExp(`Artist knowledge approved: ${analysis.brainApprovedAt.slice(0, 10)}`));
  assert.match(packet.document, /A front that arrives/);
  assert.match(packet.document, /The road at night/);
  assert.match(packet.document, /independent sources/);
  assert.match(packet.document, /Nothing that reads as arena rock/);
  assert.match(packet.document, /Which dates are indoors\?/);
  assert.ok(!/brief/i.test(packet.document), "the packet calls itself a brief");
  assert.ok(!/brief/i.test(packet.filename), "the filename calls it a brief");
  assert.ok(!packet.document.includes("\u2014"), "the packet carries an em dash");

  // The document is rendered from the stored run and from nothing else.
  assert.equal(renderConceptPacket(analysis), packet.document);
});

test("the packet source and the record name nothing a brief", () => {
  for (const name of ["src/intelligence/concept-packet.js", "src/intelligence/analysis.js"]) {
    const source = read(name).replace(/\/\/[^\n]*/g, " ");
    assert.ok(!/brief/i.test(source), `${name} names something a brief`);
  }
});

test("a Scene nobody submitted cannot be asked about", async () => {
  const context = await ready();
  await context.tourStore.addRequest(TOUR, { id: "draft-scene", title: "Draft scene", request: "" });

  await assert.rejects(
    () => tourAction({ action: "run-scene-ideas", tourId: TOUR, assignmentId: "draft-scene" }, options(context, OPERATOR, modelReply())),
    (error) => error.status === 400 && /has not been submitted/.test(error.message),
  );
  assert.equal(context.tourBackend.files.has(analysisPathFor(SCENE_IDEAS, TOUR, "draft-scene", DEMO)), false);

  // And the page offers only the Scenes that can be asked about.
  const page = read("app/intelligence.js");
  assert.match(page, /scene\.stage !== "Draft request"/, "the page offers Scenes with nothing in them");
});

test("a client session is refused by the route and receives no part of an analysis", async () => {
  const context = await ready();
  await tourAction({ action: "run-scene-ideas", tourId: TOUR, assignmentId: SCENE }, options(context, OPERATOR, modelReply()));

  for (const action of ["run-scene-ideas", "get-scene-ideas", "get-concept-packet"]) {
    await assert.rejects(
      () => tourAction({ action, tourId: TOUR, assignmentId: SCENE }, options(context, CLIENT, modelReply())),
      (error) => error.status === 403,
      `${action} answered a client`,
    );
  }

  // Nothing a client does receive carries the run. The Scene a client opens is
  // the strongest case, because it is the same Scene the ideas were asked about.
  const workspace = await tourAction(
    { action: "get-scene-workspace", tourId: TOUR, assignmentId: SCENE },
    options(context, CLIENT),
  );
  const body = JSON.stringify(workspace);
  assert.ok(!body.includes("A front that arrives"), "a client received an idea");
  assert.ok(!/analys/i.test(body), "a client received an analysis");
  assert.ok(!body.includes("finding-1"), "a client received the evidence");

  // The run is still there. A refusal wrote nothing and removed nothing.
  assert.equal(storedAnalyses(context).length, 1);
});

test("the page and its script are closed to a client at the front door", async () => {
  const saved = { operator: process.env.MERIDIAN_OPERATOR, client: process.env.MERIDIAN_CLIENT };
  process.env.MERIDIAN_OPERATOR = ENV.MERIDIAN_OPERATOR;
  process.env.MERIDIAN_CLIENT = ENV.MERIDIAN_CLIENT;
  try {
    const secret = `meridian-session:${ENV.MERIDIAN_OPERATOR}:${ENV.MERIDIAN_CLIENT}`;
    const at = (pathname, cookie) => new Request(`https://meridian.test${pathname}`, {
      headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {},
    });
    const client = await signSession({ userId: "client", role: CLIENT_ROLE }, secret);
    assert.equal((await middleware(at("/intelligence.html", client))).status, 403);
    assert.equal((await middleware(at("/intelligence.js", client))).status, 403);
    assert.equal((await middleware(at("/intelligence.html"))).status, 302);
  } finally {
    process.env.MERIDIAN_OPERATOR = saved.operator;
    process.env.MERIDIAN_CLIENT = saved.client;
  }
});

test("the rail destination is built for a Higher Roads session and the brain has one home", () => {
  const shell = read("app/shell.js");
  const guard = shell.match(/if \(body\.user\.role === "higher-roads"\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(guard, /mountIntelligenceDestination\(\)/, "the rail link is built before the role is known");
  assert.match(shell, /Artist Intelligence/, "the shell does not build the destination");
  assert.doesNotMatch(shell, /label: "Artist Brain"/, "the corner still carries the reference view");
  assert.match(shell, /data-operator-utility/, "the rail link is outside the rule that hides operator things");

  // The reference view is reached from the one home rather than from a corner.
  assert.match(read("app/intelligence.js"), /href="\.\/artist\.html"/, "the research is unreachable from here");

  // And no page hard-codes it, the same rule Admin lives under.
  for (const page of ["app/index.html", "app/scenes.html", "app/reviews.html", "app/tour.html", "app/scene.html", "app/artist.html"]) {
    assert.doesNotMatch(read(page), /href="\.\/intelligence\.html"/, `${page} hard-codes the Intelligence link`);
  }
});

test("the four asks are on the page in the words of the person making them", () => {
  const page = read("app/intelligence.js");
  for (const ask of [
    "Ideas for a Scene",
    "Read the direction against the artist",
    "Review a board before the client sees it",
    "Check the tour stops",
  ]) {
    assert.ok(page.includes(ask), `the page is missing "${ask}"`);
  }
  // The job that cannot run states what it needs rather than sitting behind a
  // dead control.
  assert.match(page, /Requires venue and screen specifications as fields rather than prose/);
  assert.doesNotMatch(page, /Coming soon/, "an ask promises a date nobody set");
});
