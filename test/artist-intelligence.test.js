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
import { renderIdeas } from "../src/intelligence/ideas-view.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "../src/org/store.js";
import { SESSION_COOKIE, signSession } from "../src/org/session.js";

// Job one of Intelligence, checked by what it stored and what a reader
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

test("a packet holds one idea and carries the whole run's lineage with it", async () => {
  const context = await ready();
  await tourAction({ action: "run-scene-ideas", tourId: TOUR, assignmentId: SCENE }, options(context, OPERATOR, modelReply()));
  const analysis = storedAnalyses(context)[0];

  const first = await tourAction(
    { action: "get-concept-packet", tourId: TOUR, assignmentId: SCENE, directionIndex: 0 },
    options(context),
  );
  const second = await tourAction(
    { action: "get-concept-packet", tourId: TOUR, assignmentId: SCENE, directionIndex: 1 },
    options(context),
  );

  // One idea per file, and the other one is not in it.
  assert.match(first.document, /A front that arrives/);
  assert.ok(!first.document.includes("The road at night"), "the file carries an idea nobody asked for");
  assert.match(second.document, /The road at night/);
  assert.ok(!second.document.includes("A front that arrives"), "the file carries an idea nobody asked for");
  assert.match(first.document, /Idea 01 of 02/);
  assert.match(second.document, /Idea 02 of 02/);
  assert.notEqual(first.filename, second.filename);

  // Full lineage on each one.
  for (const packet of [first, second]) {
    assert.match(packet.document, /Concept packet/);
    assert.match(packet.document, /Scene: /);
    assert.match(packet.document, /Tour direction version: V01/);
    assert.match(packet.document, new RegExp(`Generated: ${analysis.ranAt.slice(0, 10)}`));
    assert.match(packet.document, new RegExp(`Artist knowledge approved: ${analysis.brainApprovedAt.slice(0, 10)}`));
    assert.match(packet.document, /Run: 01/);
    assert.ok(!/brief/i.test(packet.document), "the packet calls itself a brief");
    assert.ok(!/brief/i.test(packet.filename), "the filename calls it a brief");
    assert.ok(!packet.document.includes("\u2014"), "the packet carries an em dash");
  }

  // The evidence counts travel with the idea that cites them.
  assert.match(first.document, /independent sources/);
  assert.match(first.filename, /^concept-packet-storm-and-lightning-run-01-01-a-front-that-arrives\.txt$/);

  // Rendered from the stored run and from nothing else.
  assert.equal(renderConceptPacket(analysis, 0), first.document);

  // An idea nobody stored is a refusal rather than an empty file.
  await assert.rejects(
    () => tourAction({ action: "get-concept-packet", tourId: TOUR, assignmentId: SCENE, directionIndex: 7 }, options(context)),
    (error) => error.status === 404,
  );
});

// The composition, checked against the markup a person receives rather than
// against strings in the page source. The first version of this view passed a
// source-matching test and was still a two-column layout with a label printed
// over nothing.
const RUN = {
  run: 2,
  runId: "run-1",
  ranAt: "2026-08-28T10:00:00.000Z",
  directionVersion: 1,
  brainApprovedAt: "2026-08-20T10:00:00.000Z",
  subject: { sceneTitle: "Storm and Lightning", sceneId: SCENE, tourId: TOUR },
  result: {
    directions: [
      {
        title: "A front that arrives",
        idea: "The weather comes in over the lawn.",
        whyThisArtist: "He built his live reputation on sheds.",
        asksOfProduction: "Rehearsal time.",
        whereItMightMiss: "It could read as spectacle.",
        rhymesWith: ["finding-1", "finding-2"],
      },
      { title: "The road at night", idea: "Headlights and county roads.", rhymesWith: [] },
    ],
    avoidNotes: ["Nothing that reads as arena rock."],
    openQuestions: [],
  },
  evidence: [
    // One finding with a supporting sentence behind its lead, and one with
    // nothing behind it but its counts and tiers.
    { findingId: "finding-1", text: "**He plays sheds.** Twelve of the last fifteen runs were amphitheatres.", independentSourceCount: 4, tiers: [1, 2], why: "It bears on the request." },
    { findingId: "finding-2", text: "**The aviation staging returns.**", independentSourceCount: 3, tiers: [1], why: "The Scene asks for height." },
  ],
};

test("each idea renders its own two actions and nothing carries a run-wide export", () => {
  const html = renderIdeas(RUN);
  for (const index of [0, 1]) {
    assert.ok(html.includes(`data-idea-download="${index}"`), `idea ${index} has no download`);
    assert.ok(html.includes(`data-idea-copy="${index}"`), `idea ${index} has no copy`);
  }
  assert.equal((html.match(/data-idea-download=/g) || []).length, 2);
  assert.equal((html.match(/data-idea-copy=/g) || []).length, 2);
  assert.ok(!html.includes("data-packet"), "the run-level export is still on the page");
  assert.ok(!/Download the concept packet/.test(html), "the run-level button is still on the page");
});

test("no label renders over a void, and a disclosure opens onto something", () => {
  const html = renderIdeas(RUN);
  // finding-1 has a sentence behind its lead, so it earns a disclosure.
  assert.match(html, /<details class="m-evidence-item">/);
  assert.match(html, /Twelve of the last fifteen runs were amphitheatres/);
  // finding-2 has only counts and tiers, so it is one quiet line and no label.
  assert.match(html, /<span class="m-meta">3 INDEPENDENT SOURCES, FROM TIER 1<\/span>/);
  assert.equal((html.match(/<details/g) || []).length, 1, "a disclosure was written over nothing");
  // Open questions is empty, so its heading does not render at all.
  assert.ok(!/OPEN QUESTIONS/.test(html), "an empty section printed its heading");
  assert.match(html, /WHAT THIS ARTIST STAYS AWAY FROM/, "a section with content did not render");
});

test("the ideas stack in one column and their titles are the largest text", () => {
  const html = renderIdeas(RUN);
  // The system's one-column reading pattern, not the two-column orientation
  // grid. The measure belongs to the page, so the asks above the ideas and the
  // ideas share one left edge rather than sitting at two.
  const markup = read("app/intelligence.html");
  assert.match(markup, /class="m-intelligence-reader m-directory"/, "the surface has no single measure");
  assert.ok(!/m-intelligence-reader"/.test(html), "the run opens a second measure inside the page");
  assert.match(html, /class="m-intelligence-reader__head"/);
  assert.match(html, /class="m-intelligence-principles"/);
  assert.ok(!/m-orientation/.test(html), "the ideas are back in the two-column grid");

  // An idea's title is the only thing at section scale inside the run.
  assert.equal((html.match(/m-intelligence-principle__heading/g) || []).length, 2);
  assert.ok(!/m-section-heading/.test(html), "something in the run competes with an idea title");
  assert.ok(!/m-heading/.test(html.replace(/m-intelligence-principle__heading/g, "")), "the run header shouts");

  // The run and its lineage are context, carried at meta scale.
  assert.match(html, /RUN 02 \/ 2026-08-28 \/ TOUR DIRECTION V01 \/ ARTIST KNOWLEDGE APPROVED 2026-08-20/);

  // And the surface does not run the full width of the window.
  assert.doesNotMatch(markup, /m-page--fluid/, "the page runs the full width of the window");
});

test("emphasis comes from the hierarchy, never from weight inside running text", () => {
  const html = renderIdeas(RUN);
  assert.ok(!html.includes("<strong>"), "bold is back inside running text");
  assert.ok(!html.includes("<b>"), "bold is back inside running text");
  // The intake file's own asterisks never reach a reader either.
  assert.ok(!html.includes("**"), "the intake file's markup reached the page");
  assert.match(html, /<p class="m-copy">He plays sheds\.<\/p>/);
});

test("the nav reads Intelligence, one word, and no page hard-codes it", () => {
  const shell = read("app/shell.js");
  assert.match(shell, /m-shell__nav-label">Intelligence</, "the rail does not read Intelligence");
  assert.ok(!/Artist Intelligence/.test(shell), "the two-word name survives in the shell");
  assert.ok(!/Artist Intelligence/.test(read("app/intelligence.js")), "the two-word name survives on the page");
  assert.ok(!/Artist Intelligence/.test(read("app/intelligence.html")), "the two-word name survives in the markup");
  assert.ok(!/Artist Intelligence/.test(read("docs/meridian-brain-reintegration.md")), "the orientation document still disagrees with the app");
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
  assert.match(shell, /Intelligence/, "the shell does not build the destination");
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
