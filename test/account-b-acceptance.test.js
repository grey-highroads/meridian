import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createArtistDirectory } from "../src/org/artists.js";
import { createOrgStore } from "../src/org/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { createTourStore } from "../src/tour/store.js";
import { uploadPathFor, uploadPrefix } from "../src/tour/upload-path.js";

const DEMO = "dierks-bentley";
const ACCOUNT_B = "northstar-live";
const TOUR = "northstar-2027";
const ARTIST = "dierks-bentley";
const BRAIN_SENTINEL = "Account B builds every visual around the north star mark.";
const OPERATOR = {
  id: "operator",
  displayName: "Ray Mercer",
  role: "higher-roads",
  roleLabel: "Higher Roads",
  accountId: DEMO,
};

function proposalReply() {
  return {
    ok: true,
    async json() {
      return {
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              appliedFindings: [{ id: "account-b-finding", why: "The mark is the artist's own recurring image." }],
              proposals: [{
                title: "North star arrival",
                idea: "A single fixed star gathers the field around it, then opens into the chorus.",
                whyThisArtist: "The account B Brain names the north star as a recurring image.",
                rhymesWith: ["account-b-finding"],
                asksOfProduction: "Keep the star stable while the field moves.",
                whereItMightMiss: "Too much motion would weaken the fixed point.",
              }],
              avoidNotes: [],
              openQuestions: [],
            }),
          },
        }],
        usage: { completion_tokens: 120 },
      };
    },
  };
}

test("account B completes the Meridian path without reading the demo Tour or Brain", async () => {
  const backend = createMemoryBackend();

  await createOrgStore({ backend }).createAccount("Northstar Live");

  const demoArtistStore = createArtistStore({ backend, accountId: DEMO });
  await artistAction({ action: "import-intake", artistId: ARTIST }, { store: demoArtistStore });
  await artistAction({ action: "approve-brain", artistId: ARTIST, person: "Grey" }, { store: demoArtistStore });
  const demoTour = await tourAction(
    { action: "get-tour", tourId: "off-the-map-2026" },
    {
      user: OPERATOR,
      tourStore: createTourStore({ backend, accountId: DEMO }),
      artboardStore: createArtboardStore({ backend, accountId: DEMO }),
      sceneRecord: createSceneRecord({ backend, accountId: DEMO }),
    },
  );
  assert.equal(demoTour.tour.name, "Off The Map Tour");
  assert.equal(demoTour.assignments[0].id, "storm-and-lightning");

  const artistStore = createArtistStore({ backend, accountId: ACCOUNT_B });
  const artistOptions = { user: OPERATOR, store: artistStore };
  const createdArtist = await artistAction(
    { action: "create-artist", accountId: ACCOUNT_B, name: "Dierks Bentley" },
    artistOptions,
  );
  assert.equal(createdArtist.artist.id, ARTIST, "the account namespace preserves the shared artist-id sentinel");
  await artistStore.writeImport(ARTIST, {
    artist: { id: ARTIST, name: "Northstar Artist", identities: ["main-stage", "shared"] },
    prior: {},
    sources: [{ id: "account-b-source", title: "Northstar source", url: "https://example.com/northstar" }],
    claims: [{ id: "account-b-claim", text: BRAIN_SENTINEL, sourceId: "account-b-source" }],
    findings: [{
      id: "account-b-finding",
      facet: "VL",
      identity: "main-stage",
      bin: "confirmed",
      text: BRAIN_SENTINEL,
      independentSourceCount: 1,
      tiers: [1],
      claimIds: ["account-b-claim"],
      evidenceLinked: true,
    }],
    log: {},
  });
  await artistStore.approveBrain(ARTIST, "Grey");

  const tourStore = createTourStore({ backend, accountId: ACCOUNT_B });
  const artboardStore = createArtboardStore({ backend, accountId: ACCOUNT_B });
  const sceneRecord = createSceneRecord({ backend, accountId: ACCOUNT_B });
  let proposalRequest = "";
  const options = {
    user: OPERATOR,
    store: artistStore,
    artists: createArtistDirectory({ backend, accountId: ACCOUNT_B }),
    tourStore,
    artboardStore,
    sceneRecord,
    apiKey: "test-key",
    logger() {},
    fetchImpl: async (_url, request) => {
      proposalRequest = request.body;
      return proposalReply();
    },
  };
  const call = async (action, extra = {}) => await tourAction({ action, accountId: ACCOUNT_B, ...extra }, options);
  const seen = [];

  seen.push(await call("create-tour", { name: "Northstar 2027", artistId: ARTIST }));
  seen.push(await call("add-tour-direction", {
    tourId: TOUR,
    words: "Hold one fixed point through the whole show. Let everything else find it.",
  }));
  const requested = await call("create-scene-request", {
    tourId: TOUR,
    title: "Opening constellation",
    moment: "Show open",
    request: "Begin with a scattered field and let one north star bring it into focus.",
    requiredElements: ["The north star remains fixed."],
  });
  seen.push(requested);
  const sceneId = requested.assignment.id;

  const homeRead = await call("get-tour", { tourId: TOUR });
  const scenesRead = await call("get-tour", { tourId: TOUR });
  const sceneRead = await call("get-assignment", { tourId: TOUR, assignmentId: sceneId });
  seen.push(homeRead, scenesRead, sceneRead);
  assert.equal(homeRead.tour.name, "Northstar 2027");
  assert.deepEqual(scenesRead.assignments.map((entry) => entry.id), [sceneId]);
  assert.equal(sceneRead.assignment.title, "Opening constellation");

  const context = await call("assignment-context", { tourId: TOUR, assignmentId: sceneId });
  const proposed = await call("propose-concepts", { tourId: TOUR, assignmentId: sceneId });
  seen.push(context, proposed);
  assert.equal(context.context.counts.inBrain, 1);
  assert.equal(context.context.findings[0].text, BRAIN_SENTINEL);
  assert.match(proposalRequest, /Account B builds every visual around the north star mark/);
  assert.doesNotMatch(proposalRequest, /weather coming in over the lawn|finding-19/i);

  const direction = await call("choose-concept", {
    tourId: TOUR,
    assignmentId: sceneId,
    concept: proposed.proposals[0],
  });
  const frozen = await call("freeze-brief", { tourId: TOUR, assignmentId: sceneId });
  const issued = await call("issue-brief", {
    tourId: TOUR,
    assignmentId: sceneId,
    briefVersion: frozen.brief.briefVersion,
    recipient: "Northstar media artist",
  });
  seen.push(direction, frozen, issued);
  assert.match(issued.handoff.directPath, /account=northstar-live/);
  assert.match(issued.handoff.directPath, /tour=northstar-2027/);

  const pathname = uploadPathFor(TOUR, sceneId, "northstar-v1.png", ACCOUNT_B, "account-b-upload");
  assert.ok(pathname.startsWith(uploadPrefix(TOUR, sceneId, ACCOUNT_B)));
  assert.match(pathname, /^brand-world-system\/clients\/northstar-live\/tours\/northstar-2027\//);
  await backend.write(pathname, "account B uploaded bytes");
  const submitted = await call("submit-artboard", {
    tourId: TOUR,
    assignmentId: sceneId,
    briefVersion: frozen.brief.briefVersion,
    artifact: {
      name: "northstar-v1.png",
      contentType: "image/png",
      size: 24,
      blobPathname: pathname,
    },
    conceptSummary: "The fixed star gathers the field without becoming a spectacle.",
  });
  const artboards = await call("get-artboards", { tourId: TOUR, assignmentId: sceneId });
  const returned = await call("get-artboard-artifact", {
    tourId: TOUR,
    assignmentId: sceneId,
    artboardVersion: submitted.artboard.artboardVersion,
  });
  seen.push(submitted, artboards, returned);
  assert.equal(submitted.artboard.artifact.blobPathname, pathname);
  assert.equal(artboards.artboards.length, 1);
  assert.equal(artboards.artboards[0].artboard.artifact.blobPathname, pathname);
  assert.equal(returned.blobPathname, pathname);

  const accountBPath = `brand-world-system/clients/${ACCOUNT_B}/`;
  for (const pathnameKey of backend.files.keys()) {
    if (pathnameKey.includes("northstar-2027") || pathnameKey.includes(sceneId)) {
      assert.ok(pathnameKey.startsWith(accountBPath), `account B data escaped its namespace: ${pathnameKey}`);
    }
  }
  const accountBResults = JSON.stringify(seen);
  assert.doesNotMatch(accountBResults, /Off The Map Tour|storm-and-lightning|weather coming in over the lawn|finding-19/i);
});
