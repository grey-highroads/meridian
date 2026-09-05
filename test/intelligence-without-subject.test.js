import assert from "node:assert/strict";
import test from "node:test";
import { assembleContext } from "../src/tour/select.js";
import { buildProposalRequest } from "../src/tour/propose.js";
import { buildBoardReviewRequest, checkBoardReview } from "../src/tour/board-review.js";
import { buildAnalysis } from "../src/intelligence/analysis.js";
import { renderIdeas } from "../src/../app/intelligence/ideas-view.js";

// Intelligence degrades by capability, not by page. Ruled 2026-09-05. Scene
// ideas and the artboard check run on a job with no subject. The direction
// comparison needs a history and says so. What the prompt carries on a
// subjectless run is the part worth guarding: no artist material, no empty
// artist fields, and no assumptions about what kind of work this is.

const TOUR = {
  id: "riverside-facade-2027",
  name: "Riverside Facade 2027",
  artistId: null,
  productionSetup: { version: 2, words: "Six projectors onto the north face.", venueExceptions: [] },
  direction: { version: 1, words: "The facade is the instrument.", setBy: "Nadia Cole", setOn: "2026-09-01" },
};

const ASSIGNMENT = {
  id: "scene-1",
  title: "Opening sweep",
  request: "Open with the stone lighting from the base upward.",
};

// Words that assume the work is a music job, or that assume a subject exists.
// A subjectless run must not put any of them in front of the model.
const ASSUMPTIONS = [
  "artist", "song", "band", "setlist", "album", "stage", "audience member",
  "brain", "finding", "identity", "artistContext", "artistId",
];

function promptText(request) {
  return request.messages.map((message) => (typeof message.content === "string"
    ? message.content
    : message.content.map((part) => part.text || "").join("\n"))).join("\n");
}

test("a subjectless context carries no findings and says which it is", () => {
  const context = assembleContext(null, TOUR, ASSIGNMENT);
  assert.equal(context.hasSubject, false);
  assert.deepEqual(context.findings, []);
  assert.deepEqual(context.avoids, []);
  assert.deepEqual(context.counts, { inBrain: 0, inScope: 0 });
  // The direction and the setup still travel, because those are the job's own
  // material and they are what the instruments run from.
  assert.equal(context.direction.words, "The facade is the instrument.");
  assert.equal(context.productionSetup.words, "Six projectors onto the north face.");
});

test("the scene ideas prompt carries no artist material on a subjectless run", () => {
  const context = assembleContext(null, TOUR, ASSIGNMENT);
  const text = promptText(buildProposalRequest(context)).toLowerCase();
  for (const word of ASSUMPTIONS) {
    assert.ok(!text.includes(word), `the subjectless ideas prompt says "${word}"`);
  }
  // Nothing empty stands in for the material that is absent.
  assert.ok(!text.includes("[]"), "an empty list reached the model");
  assert.ok(!text.includes("0 of them"), "a count of nothing reached the model");
  // What it does carry is the job's own material.
  assert.ok(text.includes("the facade is the instrument."));
  assert.ok(text.includes("open with the stone lighting from the base upward."));
  assert.ok(text.includes("six projectors onto the north face."));
});

test("the artboard check prompt carries no artist material on a subjectless run", () => {
  const context = {
    ...assembleContext(null, TOUR, ASSIGNMENT),
    tourName: TOUR.name,
    sceneTitle: ASSIGNMENT.title,
    artboardVersion: 1,
    briefVersion: 1,
    conceptSummary: "Light climbing the stone.",
    chosenConcept: { title: "Rising stone", idea: "Light climbs the facade." },
    avoid: [],
    board: { dataUrl: "data:image/png;base64,AAAA", contentType: "image/png" },
  };
  const request = buildBoardReviewRequest(context);
  const text = promptText(request).toLowerCase();
  for (const word of ASSUMPTIONS) {
    assert.ok(!text.includes(word), `the subjectless board prompt says "${word}"`);
  }
  // The board is still what is read. A check that stopped looking at the image
  // would be a read of the paperwork.
  const parts = request.messages[1].content;
  assert.ok(parts.some((part) => part.type === "image_url"), "the board image was dropped");
});

test("a subjectless read is grounded in the direction rather than in findings", () => {
  const context = { hasSubject: false, findings: [] };
  // With no findings to cite, an entry that cites none is still a real entry.
  const read = checkBoardReview({
    alignment: [{ title: "The sweep starts low", note: "The light begins at the base." }],
    departure: [],
    prohibition: [],
    openQuestions: ["Which face is lit first?"],
  }, context);
  assert.equal(read.alignment.length, 1);
  assert.deepEqual(read.appliedFindings, []);
  assert.deepEqual(read.openQuestions, ["Which face is lit first?"]);
});

test("a read with a subject still drops an entry no finding supports", () => {
  const context = {
    hasSubject: true,
    findings: [{ findingId: "finding-1", facetName: "Visual language", text: "He plays weather." }],
  };
  const read = checkBoardReview({
    alignment: [
      { title: "Grounded", note: "It rests on the record.", restsOn: ["finding-1"] },
      { title: "Floating", note: "Nothing supports this.", restsOn: [] },
    ],
    departure: [],
    prohibition: [],
  }, context);
  assert.deepEqual(read.alignment.map((entry) => entry.title), ["Grounded"]);
});

test("a subjectless run stores what it read rather than an empty trail", () => {
  const analysis = buildAnalysis({
    job: "scene-ideas",
    ranAt: "2026-09-05T10:00:00.000Z",
    artistId: null,
    brainApprovedAt: null,
    readFrom: ["The tour direction", "The Scene request", "No research about a subject. This job has none."],
    result: { directions: [{ title: "Rising stone", idea: "Light climbs." }] },
    evidence: [],
  });
  assert.equal(analysis.brainApprovedAt, null);
  assert.deepEqual(analysis.evidence, []);
  assert.match(analysis.readFrom.join(" "), /No research about a subject/);

  const html = renderIdeas(analysis);
  // The run says what stood behind it rather than showing a date nobody
  // recorded, which is what an absent approval used to read as.
  assert.match(html, /RAN WITH NO RESEARCH BEHIND IT/);
  assert.ok(!html.includes("NOT RECORDED"), "an absent approval read as a missing date");
  assert.match(html, /Read from The tour direction\. The Scene request\./);
});

test("a run stored before the field existed reads as it did", () => {
  const analysis = buildAnalysis({
    job: "scene-ideas",
    ranAt: "2026-08-28T10:00:00.000Z",
    artistId: "wren-halloway",
    brainApprovedAt: "2026-08-20T10:00:00.000Z",
    result: { directions: [{ title: "Front line", idea: "The storm crosses." }] },
  });
  assert.deepEqual(analysis.readFrom, []);
  const html = renderIdeas(analysis);
  assert.match(html, /RESEARCH APPROVED 2026-08-20/);
  assert.ok(!html.includes("Read from"), "a run with nothing recorded claims to have read something");
});
