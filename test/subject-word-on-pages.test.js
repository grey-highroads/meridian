import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { renderBoardReview, renderBoardReviewInDrawer } from "../app/intelligence/board-view.js";
import { renderDirectionRead } from "../app/intelligence/direction-view.js";
import { renderIdeas } from "../app/intelligence/ideas-view.js";

// The reader is told what the project is about in that subject's own word. A
// venue reads venue, a stored label wins over the kind, and a project with no
// subject reads the no-subject copy and gains no word at all.

function read(relative) {
  return fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

const EVIDENCE = [{ findingId: "finding-1", statement: "Storm imagery recurs across three eras.", sources: [] }];

function boardAnalysis() {
  return {
    run: 1,
    ranAt: "2026-09-08T12:00:00.000Z",
    directionVersion: 2,
    brainApprovedAt: "2026-09-01T12:00:00.000Z",
    subject: { sceneTitle: "Storm and lightning", artboardVersion: 2 },
    evidence: EVIDENCE,
    result: {
      alignment: [{ observation: "The palette holds.", restsOn: ["finding-1"] }],
      departure: [],
      prohibition: [{ observation: "Literal rain appears.", restsOn: ["finding-1"] }],
      openQuestions: [],
    },
  };
}

function directionAnalysis() {
  return {
    run: 1,
    ranAt: "2026-09-08T12:00:00.000Z",
    directionVersion: 2,
    subject: { directionSetBy: "Dana Reyes" },
    evidence: EVIDENCE,
    result: {
      continuity: [{ observation: "Weather stays central.", restsOn: ["finding-1"] }],
      departure: [{ observation: "The palette cools.", restsOn: [] }],
      echo: [],
      openQuestions: [],
    },
  };
}

function ideasAnalysis() {
  return {
    run: 1,
    ranAt: "2026-09-08T12:00:00.000Z",
    directionVersion: 2,
    subject: { sceneTitle: "Storm and lightning" },
    evidence: EVIDENCE,
    result: {
      directions: [{ title: "The front, not the flash", idea: "Weather builds.", rhymesWith: ["finding-1"] }],
      avoidNotes: ["Literal rain"],
      openQuestions: [],
    },
  };
}

test("a venue subject is read as a venue everywhere on Intelligence", () => {
  const board = renderBoardReview(boardAnalysis(), "", "venue");
  assert.match(board, /Where it matches this venue's history/, "the Artboard check still calls it an artist");
  assert.match(board, /What this venue stays away from/, "the prohibition group still calls it an artist");
  assert.match(board, /How this Artboard compares to this venue's history/, "the Artboard check summary still calls it an artist");
  assert.doesNotMatch(board, /artist/i, "the word artist survived somewhere in the Artboard check");

  const direction = renderDirectionRead(directionAnalysis(), "", "venue");
  assert.match(direction, /THE DIRECTION AGAINST THE VENUE'S RECORD/, "the direction read heading still names an artist");
  assert.match(direction, /Where it stays with who this venue has been/, "the continuity cluster still names an artist");
  assert.match(direction, /Where it goes somewhere the venue's record has not been/, "the departure cluster still names an artist");
  assert.match(direction, /compare to everything Meridian knows about this venue/, "the direction read summary still names an artist");
  assert.doesNotMatch(direction, /artist/i, "the word artist survived somewhere in the direction read");

  const ideas = renderIdeas(ideasAnalysis(), "", {}, "venue");
  assert.match(ideas, /What this rests on in this venue's history/, "the evidence cluster still names an artist");
  assert.match(ideas, /WHAT THIS VENUE STAYS AWAY FROM/, "the avoid list still names an artist");
});

test("the Reviews drawer reads the subject's word", () => {
  const drawer = renderBoardReviewInDrawer(boardAnalysis(), "venue");
  assert.match(drawer, /Where it matches this venue's history/, "the drawer summary still calls it an artist");
  assert.match(drawer, /What this venue stays away from/, "the drawer prohibition group still calls it an artist");
  assert.doesNotMatch(drawer, /artist/i, "the word artist survived in the Reviews drawer");
});

test("a stored label is used in place of the kind", () => {
  const board = renderBoardReview(boardAnalysis(), "", "room");
  assert.match(board, /Where it matches this room's history/, "the stored label did not reach the heading");
  assert.doesNotMatch(board, /venue/i, "the kind was used where a stored label exists");
  assert.doesNotMatch(board, /artist/i, "the default was used where a stored label exists");
});

test("with no word supplied every surface reads the way it always did", () => {
  const board = renderBoardReview(boardAnalysis());
  assert.match(board, /Where it matches this artist's history/, "the default stopped reading artist");
  const direction = renderDirectionRead(directionAnalysis());
  assert.match(direction, /THE DIRECTION AGAINST THE ARTIST'S RECORD/, "the default stopped reading artist");
  const ideas = renderIdeas(ideasAnalysis());
  assert.match(ideas, /What this rests on in this artist's history/, "the default stopped reading artist");
});

test("the Intelligence page keeps its no-subject copy and gains no word", () => {
  const source = read("app/intelligence.js");
  for (const line of [
    "This job has no subject, so no research sits behind them.",
    "This job has no subject, so there is no history to compare the direction against.",
    "Four things you can ask about this job.",
  ]) {
    assert.ok(source.includes(line), `the no-subject copy lost "${line}"`);
  }
  assert.doesNotMatch(read("app/intelligence.html"), /artist/i, "the meta description still names an artist before any record is read");
});

