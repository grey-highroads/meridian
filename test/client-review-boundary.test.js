import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import tourUpload from "../api/tour-upload.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";
import { createTourStore } from "../src/tour/store.js";
import { uploadPathFor } from "../src/tour/upload-path.js";

const ACCOUNT = "dierks-bentley";
const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };

const OPERATOR = {
  id: "operator",
  login: "ray",
  displayName: "Ray Mercer",
  role: "higher-roads",
  roleLabel: "Higher Roads",
  accountId: null,
  actingAccount: ACCOUNT,
};

const REVIEWER = {
  id: "client",
  login: "dana",
  displayName: "Dana Whitlock",
  role: "client-reviewer",
  roleLabel: "Client reviewer",
  accountId: ACCOUNT,
};

const SECOND_REVIEWER = {
  ...REVIEWER,
  id: "second-client",
  login: "alex",
  displayName: "Alex Morgan",
};

const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
  whyThisArtist: "He plays outdoors and the team already builds around real sky.",
  asksOfProduction: "One long build cue and a single break.",
  whereItMightMiss: "A break that lands too hard reads as spectacle.",
  rhymesWith: ["finding-19"],
  cameFrom: "written by Higher Roads",
};

function artifact(pathname, name) {
  return { blobPathname: pathname, contentType: "image/png", name, size: 1024 };
}

async function ready() {
  const artistBackend = createMemoryBackend();
  const tourBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend, accountId: ACCOUNT });
  const tourStore = createTourStore({ backend: tourBackend, accountId: ACCOUNT });
  const artboardStore = createArtboardStore({ backend: tourBackend, accountId: ACCOUNT });
  const sceneRecord = createSceneRecord({ backend: tourBackend, accountId: ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  const options = { store, tourStore, artboardStore, sceneRecord, user: OPERATOR };
  const asClient = { ...options, user: REVIEWER };
  const asSecondClient = { ...options, user: SECOND_REVIEWER };
  const firstPath = uploadPathFor(TOUR, ASSIGNMENT, "first.png", ACCOUNT, "first-version");
  const secondPath = uploadPathFor(TOUR, ASSIGNMENT, "second.png", ACCOUNT, "second-version");

  await tourAction({ action: "choose-concept", ...AT, concept: CONCEPT }, options);
  await tourAction({ action: "freeze-brief", ...AT }, options);
  await tourAction({ action: "issue-brief", ...AT, briefVersion: 1 }, options);
  await tourAction({
    action: "submit-artboard",
    ...AT,
    briefVersion: 1,
    conceptSummary: "The storm builds behind the performance.",
    technicalAssumptions: ["The PIP stays inside the live camera safe area."],
    technicalFindings: ["Lightning needs its own alpha layer."],
    warnings: ["The smallest labels need an actual-size read."],
    artifact: artifact(firstPath, "first.png"),
  }, options);
  await tourAction({
    action: "save-review",
    ...AT,
    artboardVersion: 1,
    departures: ["Make the scene less busy."],
    technicalItems: ["Keep lightning on its own layer."],
  }, options);
  await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 1 }, options);
  await tourAction({ action: "client-comment", ...AT, artboardVersion: 1, text: "The build feels right." }, asClient);
  await tourAction(
    { action: "client-comment", ...AT, artboardVersion: 1, text: "Please hold the final cloud." },
    asSecondClient,
  );
  await tourAction({ action: "client-approve", ...AT, artboardVersion: 1 }, asClient);
  await tourAction({
    action: "issue-revision",
    ...AT,
    revisionId: "revision-one",
    sourceArtboardVersion: 1,
    instructions: [{ text: "Make the scene less busy." }],
    preserve: ["Keep the cloud build."],
  }, options);
  await tourAction({
    action: "submit-artboard",
    ...AT,
    briefVersion: 1,
    sourceArtboardVersion: 1,
    conceptSummary: "The revised storm leaves more room around the band.",
    technicalAssumptions: ["The two PIPs remain separate layers."],
    technicalFindings: ["Clouds need alpha delivery."],
    artifact: artifact(secondPath, "second.png"),
  }, options);
  await tourAction({
    action: "save-review",
    ...AT,
    artboardVersion: 2,
    departures: ["Move the right PIP farther out."],
  }, options);

  return { tourBackend, tourStore, artboardStore, options, asClient, asSecondClient, firstPath, secondPath };
}

test("a client receives only presented Artboard version identities while Higher Roads receives the full stored versions", async () => {
  const { artboardStore, options, asClient, firstPath, secondPath } = await ready();
  const client = await tourAction({ action: "get-artboards", ...AT }, asClient);
  assert.deepEqual(client, { artboards: [{ artboard: { artboardVersion: 1 } }] });
  const clientText = JSON.stringify(client);
  assert.ok(!clientText.includes(firstPath));
  assert.ok(!clientText.includes(secondPath));
  assert.ok(!clientText.includes("technicalFindings"));
  assert.ok(!clientText.includes("receipt"));

  const operator = await tourAction({ action: "get-artboards", ...AT }, options);
  assert.deepEqual(operator.artboards, await artboardStore.readArtboards(TOUR, ASSIGNMENT));
  assert.equal(operator.artboards.length, 2);
  assert.equal(operator.artboards[0].artboard.artifact.blobPathname, firstPath);
  assert.equal(operator.artboards[1].artboard.artifact.blobPathname, secondPath);
});

test("a client can read a presented Artboard file and is refused on an unpresented one while Higher Roads still reads both", async () => {
  const { options, asClient, firstPath, secondPath } = await ready();
  const presented = await tourAction({ action: "get-artboard-artifact", ...AT, artboardVersion: 1 }, asClient);
  assert.equal(presented.blobPathname, firstPath);
  await assert.rejects(
    () => tourAction({ action: "get-artboard-artifact", ...AT, artboardVersion: 2 }, asClient),
    (error) => error.status === 403 && error.message === "That part of Meridian is for the Higher Roads team.",
  );
  const internal = await tourAction({ action: "get-artboard-artifact", ...AT, artboardVersion: 2 }, options);
  assert.equal(internal.blobPathname, secondPath);
});

test("a client review read contains the tour team's attributed client feedback while Higher Roads reviews and revisions remain hidden", async () => {
  const { artboardStore, options, asClient } = await ready();
  const client = await tourAction({ action: "get-reviews", ...AT }, asClient);
  assert.deepEqual(client.comments.map((entry) => [entry.text, entry.writtenBy]), [
    ["The build feels right.", REVIEWER.displayName],
    ["Please hold the final cloud.", SECOND_REVIEWER.displayName],
  ]);
  assert.deepEqual(client.approvals.map((entry) => entry.approvedBy), [REVIEWER.displayName]);
  assert.deepEqual(Object.keys(client).sort(), ["approvals", "comments"]);
  const clientText = JSON.stringify(client);
  assert.ok(!clientText.includes("Make the scene less busy."));
  assert.ok(!clientText.includes("revision-one"));
  assert.ok(clientText.includes(SECOND_REVIEWER.displayName));

  const operator = await tourAction({ action: "get-reviews", ...AT }, options);
  assert.deepEqual(operator, {
    reviews: await artboardStore.readReviews(TOUR, ASSIGNMENT),
    revisions: await artboardStore.readRevisions(TOUR, ASSIGNMENT),
  });
});

test("a client production-intent read contains the team's presented responses but never the production intent", async () => {
  const { artboardStore, options, asClient } = await ready();
  const client = await tourAction({ action: "get-production-intent", ...AT }, asClient);
  assert.deepEqual(client.readyForClient, [{ artboardVersion: 1 }]);
  assert.deepEqual(client.clientApprovals.map((entry) => entry.approvedBy), [REVIEWER.displayName]);
  assert.deepEqual(client.comments.map((entry) => entry.writtenBy), [REVIEWER.displayName, SECOND_REVIEWER.displayName]);
  assert.equal(client.intents, undefined);
  assert.ok(JSON.stringify(client).includes(SECOND_REVIEWER.displayName));

  const approvals = await artboardStore.readApprovals(TOUR, ASSIGNMENT);
  const operator = await tourAction({ action: "get-production-intent", ...AT }, options);
  assert.deepEqual(operator, { ...approvals, intents: await artboardStore.readIntents(TOUR, ASSIGNMENT) });
  assert.equal(operator.intents.length, 1);
});

test("presenting, approving, and commenting on a superseded version are refused without changing the stored record", async () => {
  const { artboardStore, options, asClient } = await ready();
  const beforeApprovals = await artboardStore.readApprovals(TOUR, ASSIGNMENT);
  const beforeIntents = await artboardStore.readIntents(TOUR, ASSIGNMENT);
  const refusal = (error) => error.status === 409 && error.message === "A newer version already came back. Work with that one instead.";

  await assert.rejects(
    () => tourAction({ action: "approve-for-client", ...AT, artboardVersion: 1 }, options),
    refusal,
  );
  await assert.rejects(
    () => tourAction({ action: "client-approve", ...AT, artboardVersion: 1 }, asClient),
    refusal,
  );
  await assert.rejects(
    () => tourAction({ action: "client-comment", ...AT, artboardVersion: 1, text: "A stale note." }, asClient),
    refusal,
  );

  assert.deepEqual(await artboardStore.readApprovals(TOUR, ASSIGNMENT), beforeApprovals);
  assert.deepEqual(await artboardStore.readIntents(TOUR, ASSIGNMENT), beforeIntents);
});

test("presenting, commenting on, and approving the newest version write the attributed client record", async () => {
  const { artboardStore, options, asClient, asSecondClient } = await ready();
  const presented = await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 2 }, options);
  const commented = await tourAction(
    { action: "client-comment", ...AT, artboardVersion: 2, text: "This resolves the conflict." },
    asSecondClient,
  );
  const approved = await tourAction({ action: "client-approve", ...AT, artboardVersion: 2 }, asSecondClient);

  assert.equal(presented.readyForClient.artboardVersion, 2);
  assert.deepEqual(commented.comment, {
    artboardVersion: 2,
    text: "This resolves the conflict.",
    writtenBy: SECOND_REVIEWER.displayName,
    writtenAt: commented.comment.writtenAt,
  });
  assert.deepEqual(approved.approval, {
    artboardVersion: 2,
    approvedBy: SECOND_REVIEWER.displayName,
    approvedAt: approved.approval.approvedAt,
  });

  const stored = await artboardStore.readApprovals(TOUR, ASSIGNMENT);
  assert.deepEqual(stored.readyForClient.map((entry) => entry.artboardVersion), [1, 2]);
  assert.deepEqual(stored.comments.at(-1), commented.comment);
  assert.deepEqual(stored.clientApprovals.at(-1), approved.approval);
  assert.equal((await artboardStore.readIntents(TOUR, ASSIGNMENT)).at(-1).artboardVersion, 2);

  const visibleToFirstClient = await tourAction({ action: "get-production-intent", ...AT }, asClient);
  assert.deepEqual(visibleToFirstClient.comments.at(-1), commented.comment);
  assert.deepEqual(visibleToFirstClient.clientApprovals.at(-1), approved.approval);
});

test("a client gets only the rationale for a presented version while Higher Roads gets the complete brief payload", async () => {
  const { options, asClient } = await ready();
  const client = await tourAction({ action: "get-brief", ...AT, artboardVersion: 1 }, asClient);
  assert.deepEqual(client, { rationale: CONCEPT.idea });
  await assert.rejects(
    () => tourAction({ action: "get-brief", ...AT, artboardVersion: 2 }, asClient),
    (error) => error.status === 403 && error.message === "That part of Meridian is for the Higher Roads team.",
  );

  const operator = await tourAction({ action: "get-brief", ...AT, briefVersion: 1 }, options);
  assert.equal(operator.brief.chosenConcept.idea, CONCEPT.idea);
  assert.ok(operator.document.includes(CONCEPT.title));
  assert.equal(operator.sidecar.briefVersion, 1);
});

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

async function uploadRead(pathname, options) {
  const response = responseRecorder();
  await tourUpload({
    method: "POST",
    headers: {},
    body: { mode: "read", ...AT, pathname },
  }, response, {
    ...options,
    issueSignedToken: async ({ pathname: signedPath }) => `signed:${signedPath}`,
    presignUrl: async (_token, { pathname: signedPath }) => ({ presignedUrl: `https://files.example/${encodeURIComponent(signedPath)}` }),
  });
  return response;
}

test("the upload read route signs a presented file and refuses an unpresented file for a client while Higher Roads still reads both", async () => {
  const { artboardStore, firstPath, secondPath } = await ready();
  const presented = await uploadRead(firstPath, { user: REVIEWER, artboardStore });
  assert.equal(presented.statusCode, 200);
  assert.equal(presented.body.pathname, firstPath);
  assert.match(presented.body.presignedUrl, /^https:\/\/files\.example\//);

  const refused = await uploadRead(secondPath, { user: REVIEWER, artboardStore });
  assert.equal(refused.statusCode, 403);
  assert.deepEqual(refused.body, { error: "That part of Meridian is for the Higher Roads team." });

  const operator = await uploadRead(secondPath, { user: OPERATOR, artboardStore });
  assert.equal(operator.statusCode, 200);
  assert.equal(operator.body.pathname, secondPath);
});
