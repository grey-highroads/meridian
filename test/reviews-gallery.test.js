import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import tourUpload from "../api/tour-upload.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { reviewVersionExperience } from "../src/org/people.js";
import { ACCOUNT, createOrgStore, usersPath } from "../src/org/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";
import { createTourStore } from "../src/tour/store.js";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { accountId: ACCOUNT.id, tourId: TOUR, assignmentId: ASSIGNMENT };
const ENV = {
  MERIDIAN_OPERATOR: "grey@higherroads.co:operator-password:Grey Garner",
  MERIDIAN_CLIENT: "sarah@artist.co:client-password:Sarah Vance",
};
const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
  whyThisArtist: "The work stays grounded in real sky.",
  asksOfProduction: "One long build cue and a single break.",
  whereItMightMiss: "A break that lands too hard reads as spectacle.",
  rhymesWith: ["finding-19"],
  cameFrom: "written by Higher Roads",
};

function read(name) {
  return fs.readFileSync(path.join(rootPath, name), "utf8");
}

async function prepared(options = {}) {
  const backend = createMemoryBackend();
  const artistBackend = createMemoryBackend();
  const artistStore = createArtistStore({ backend: artistBackend, accountId: ACCOUNT.id });
  const tourStore = createTourStore({ backend, accountId: ACCOUNT.id });
  const artboardStore = createArtboardStore({ backend, accountId: ACCOUNT.id });
  const sceneRecord = createSceneRecord({ backend, accountId: ACCOUNT.id });
  const orgStore = createOrgStore({ backend, env: ENV });
  await seedTourFromFixture(tourStore, TOUR);
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store: artistStore });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store: artistStore });
  const operator = await orgStore.findUser("operator");
  const client = await orgStore.findUser("client");
  const base = { store: artistStore, tourStore, artboardStore, sceneRecord, orgStore };
  const asOperator = { ...base, user: operator };
  const asClient = { ...base, user: client };
  await tourAction({ action: "choose-concept", ...AT, concept: CONCEPT }, asOperator);
  await tourAction({ action: "freeze-brief", ...AT }, asOperator);
  if (options.humanHandoff) {
    await tourAction({ action: "issue-brief", ...AT, briefVersion: 1 }, asOperator);
  } else {
    await tourAction({ action: "send-brief", ...AT }, asOperator);
    await tourAction({ action: "approve-for-client", ...AT, artboardVersion: 1 }, asOperator);
  }
  return { backend, artboardStore, orgStore, operator, client, asOperator, asClient };
}

test("opening a version is stored once for that person and follows them to another device", async () => {
  const { backend, orgStore, operator, client, asClient } = await prepared();
  const seenAt = "2026-08-27T18:00:00.000Z";
  const result = await tourAction(
    { action: "mark-review-version-seen", ...AT, artboardVersion: 1 },
    { ...asClient, now: () => seenAt },
  );
  const key = reviewVersionExperience(ACCOUNT.id, TOUR, ASSIGNMENT, 1);
  assert.equal(result.seenAt, seenAt);
  assert.equal(result.user.reviewVersionsSeen[key], seenAt);

  const people = JSON.parse(await backend.read(usersPath(ACCOUNT.id))).users;
  assert.equal(people.find((person) => person.id === client.id).experiencesSeen[key], seenAt);
  const admins = await orgStore.readAdmins();
  assert.equal(admins.find((person) => person.id === operator.id).experiencesSeen?.[key], undefined);

  const freshStore = createOrgStore({ backend, env: ENV });
  assert.equal((await freshStore.findUser(client.id)).reviewVersionsSeen[key], seenAt);
  const before = await backend.read(usersPath(ACCOUNT.id));
  await tourAction(
    { action: "mark-review-version-seen", ...AT, artboardVersion: 1 },
    { ...asClient, orgStore: freshStore, now: () => "2026-08-28T18:00:00.000Z" },
  );
  assert.equal(await backend.read(usersPath(ACCOUNT.id)), before);
});

test("a client cannot mark an unpresented version as opened", async () => {
  const { artboardStore, asOperator, asClient } = await prepared();
  await tourAction({
    action: "send-revision",
    ...AT,
    revisionId: "stand-in-second",
    sourceArtboardVersion: 1,
    instructions: [{ text: "Leave more room around the band." }],
  }, asOperator);
  const before = await asClient.orgStore.findUser("client");
  await assert.rejects(
    () => tourAction({ action: "mark-review-version-seen", ...AT, artboardVersion: 2 }, asClient),
    (error) => error.status === 403,
  );
  await assert.rejects(
    () => tourAction({ action: "save-review", ...AT, artboardVersion: 1, departures: ["A stale review."] }, asOperator),
    /A newer version already came back/,
  );
  assert.deepEqual((await asClient.orgStore.findUser("client")).reviewVersionsSeen, before.reviewVersionsSeen);
  assert.equal((await artboardStore.readArtboards(TOUR, ASSIGNMENT)).length, 2);
  assert.equal((await artboardStore.readReviews(TOUR, ASSIGNMENT)).length, 0);
});

test("the Reviews page is a newest-first lazy gallery with one linkable role-projected viewer", () => {
  const page = read("app/reviews.js");
  const markup = read("app/reviews.html");
  assert.match(page, /right\.artboard\.artboardVersion - left\.artboard\.artboardVersion/);
  assert.match(page, /new IntersectionObserver/);
  assert.match(page, /thumbnailQueue = thumbnailQueue\.then/);
  assert.match(page, /mark-review-version-seen/);
  assert.match(page, /address\.searchParams\.set\("scene"/);
  assert.match(page, /address\.searchParams\.set\("version"/);
  assert.match(page, /m-button--instrument/);
  assert.match(markup, /<dialog class="m-dialog m-client-shell" id="review-viewer"/);
  assert.match(markup, /<details class="m-disclosure" id="review-drawer">/);
  assert.doesNotMatch(markup, /<details[^>]*open/);
  assert.match(page, /objectFit: "contain"/);
  assert.match(page, /maxWidth: "none"/);
  assert.match(markup, /<div class="m-client-review__frame" id="viewer-artifact"><\/div>/);
  assert.match(page, /call\("save-review"/);
  assert.match(page, /call\("issue-revision"/);
  assert.match(page, /call\("approve-for-client"/);
  assert.match(page, /call\("client-comment"/);
  assert.match(page, /call\("client-approve"/);
  assert.doesNotMatch(page, /send-revision|Open client view|side-by-side|compareTo/);
  assert.ok(fs.existsSync(path.join(rootPath, "app/review.html")));
  assert.ok(fs.existsSync(path.join(rootPath, "app/client-review.html")));
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

async function uploadRequest(contentType) {
  const response = responseRecorder();
  await tourUpload({
    method: "POST",
    headers: {},
    body: { ...AT, filename: "work.file", contentType, size: 1024 },
  }, response, {
    user: { id: "operator", displayName: "Grey Garner", role: "higher-roads", roleLabel: "Higher Roads", actingAccount: ACCOUNT.id },
    issueSignedToken: async ({ pathname }) => `signed:${pathname}`,
    presignUrl: async (_token, { pathname }) => ({ presignedUrl: `https://files.example/${encodeURIComponent(pathname)}` }),
  });
  return response;
}

test("PNG and JPEG are the only submission types admitted by upload, stored submission, and picker", async () => {
  const refused = await uploadRequest("image/webp");
  assert.equal(refused.statusCode, 400);
  assert.deepEqual(refused.body, { error: "Choose a PNG or JPEG for this submission." });
  for (const contentType of ["image/png", "image/jpeg"]) {
    const accepted = await uploadRequest(contentType);
    assert.equal(accepted.statusCode, 200);
    assert.match(accepted.body.presignedUrl, /^https:\/\/files\.example\//);
  }
  const handoff = read("app/handoff.js");
  assert.match(handoff, /accept="image\/png,image\/jpeg"/);
  assert.doesNotMatch(handoff, /image\/webp|image\/gif|image\/svg\+xml|application\/pdf/);

  const { asOperator, artboardStore } = await prepared({ humanHandoff: true });
  const before = await artboardStore.readArtboards(TOUR, ASSIGNMENT);
  await assert.rejects(
    () => tourAction({
      action: "submit-artboard",
      ...AT,
      briefVersion: 1,
      conceptSummary: "A submitted reading.",
      artifact: { dataUrl: "data:image/webp;base64,AAAA", contentType: "image/webp", name: "work.webp", size: 4 },
    }, asOperator),
    /That submitted file format is not supported/,
  );
  assert.deepEqual(await artboardStore.readArtboards(TOUR, ASSIGNMENT), before);
});

test("the gallery sends a human revision without manufacturing another Artboard", async () => {
  const { asOperator, artboardStore } = await prepared();
  await tourAction({
    action: "save-review",
    ...AT,
    artboardVersion: 1,
    departures: ["Leave more room around the band."],
  }, asOperator);
  await tourAction({
    action: "issue-revision",
    ...AT,
    revisionId: "human-revision-one",
    sourceArtboardVersion: 1,
    instructions: [{ text: "Leave more room around the band." }],
  }, asOperator);
  assert.equal((await artboardStore.readReviews(TOUR, ASSIGNMENT)).at(-1).departures[0], "Leave more room around the band.");
  assert.equal((await artboardStore.readRevisions(TOUR, ASSIGNMENT)).at(-1).revisionId, "human-revision-one");
  assert.equal((await artboardStore.readHandoffs(TOUR, ASSIGNMENT)).at(-1).kind, "revision");
  assert.equal((await artboardStore.readArtboards(TOUR, ASSIGNMENT)).length, 1);
});
