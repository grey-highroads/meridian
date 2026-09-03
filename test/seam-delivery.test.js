import assert from "node:assert/strict";
import test from "node:test";
import { handleAction as artistAction } from "../api/artist/index.js";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { createTourStore } from "../src/tour/store.js";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { seedTourFromFixture } from "../src/tour/seed-from-fixture.js";
import { deliverBrief, productionEndpoint } from "../src/seam/delivery.js";
import { jobIdFor } from "../src/tour/brief.js";
import { PRODUCTION_ACKNOWLEDGED, productionAcknowledged, SENT_TO_PRODUCTION } from "../src/tour/lifecycle.js";

const DEMO_ACCOUNT = "dierks-bentley";
const OPERATOR = { id: "operator", login: "ray", displayName: "Ray Mercer", role: "higher-roads", roleLabel: "Higher Roads" };
const REVIEWER = { id: "client", login: "dana", displayName: "Dana Whitlock", role: "client-reviewer", roleLabel: "Client reviewer" };

const TOUR = "off-the-map-2026";
const ASSIGNMENT = "storm-and-lightning";
const AT = { tourId: TOUR, assignmentId: ASSIGNMENT };
const JOB = jobIdFor(TOUR, ASSIGNMENT);

const CONFIGURED = {
  MERIDIAN_PRODUCTION_URL: "https://production.example/meridian/brief",
  MERIDIAN_PRODUCTION_SECRET: "shared-secret",
};

const CONCEPT = {
  title: "The front, not the flash",
  idea: "Weather builds behind the band, breaks once, and clears by the last line.",
  cameFrom: "proposal: The front, not the flash",
};

// A stand-in for production's receiver. It records every call so a test can
// read what actually went over the wire rather than what the code meant to
// send.
function receiver(answer, status = 200) {
  const calls = [];
  async function fetchImpl(url, init) {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        if (answer === null) throw new Error("no body");
        return typeof answer === "function" ? answer(calls.length) : answer;
      },
    };
  }
  return { fetchImpl, calls };
}

async function ready(extra = {}) {
  const artistBackend = createMemoryBackend();
  const tourBackend = createMemoryBackend();
  const store = createArtistStore({ backend: artistBackend, accountId: DEMO_ACCOUNT });
  const tourStore = createTourStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  await artistAction({ action: "import-intake", artistId: "dierks-bentley" }, { store });
  await artistAction({ action: "approve-brain", artistId: "dierks-bentley", person: "Grey" }, { store });
  const sceneRecord = createSceneRecord({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  await seedTourFromFixture(tourStore, TOUR);
  const artboardStore = createArtboardStore({ backend: tourBackend, accountId: DEMO_ACCOUNT });
  const options = { store, tourStore, artboardStore, sceneRecord, user: OPERATOR, ...extra };
  await tourAction({ action: "choose-concept", ...AT, concept: CONCEPT }, options);
  return { options, asClient: { ...options, user: REVIEWER }, tourBackend };
}

async function facts(options) {
  return (await tourAction({ action: "get-scene-record", ...AT }, options)).facts;
}

// ---------------------------------------------------------------------------
// The module on its own
// ---------------------------------------------------------------------------

test("with no address and secret set, nothing is posted and the reason says so", async () => {
  const { fetchImpl, calls } = receiver({ jobId: JOB });
  const outcome = await deliverBrief({ jobId: JOB }, { fetchImpl, env: {} });
  assert.equal(calls.length, 0);
  assert.equal(outcome.attempted, false);
  assert.equal(outcome.acknowledged, false);
  assert.match(outcome.reason, /no production address and secret/);
});

test("half the configuration is no configuration", async () => {
  const { fetchImpl, calls } = receiver({ jobId: JOB });
  for (const env of [
    { MERIDIAN_PRODUCTION_URL: CONFIGURED.MERIDIAN_PRODUCTION_URL },
    { MERIDIAN_PRODUCTION_SECRET: CONFIGURED.MERIDIAN_PRODUCTION_SECRET },
    { MERIDIAN_PRODUCTION_URL: "   ", MERIDIAN_PRODUCTION_SECRET: "   " },
  ]) {
    const outcome = await deliverBrief({ jobId: JOB }, { fetchImpl, env });
    assert.equal(outcome.attempted, false, `posted with ${JSON.stringify(env)}`);
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(productionEndpoint({}), { url: "", secret: "" });
});

test("the post carries the bearer secret and the sidecar unchanged", async () => {
  const { fetchImpl, calls } = receiver({ jobId: JOB, receivedAt: "2026-09-03T10:00:00.000Z" });
  const sidecar = { contract: "meridian.brief", jobId: JOB, briefVersion: 2, avoid: ["Arena rock."] };
  const outcome = await deliverBrief(sidecar, { fetchImpl, env: CONFIGURED });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, CONFIGURED.MERIDIAN_PRODUCTION_URL);
  assert.equal(calls[0].init.headers.Authorization, "Bearer shared-secret");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  // Exactly what the renderer produced. No field added for production's
  // benefit and none dropped.
  assert.deepEqual(calls[0].body, sidecar);
  assert.equal(outcome.acknowledged, true);
  assert.equal(outcome.acknowledgedAt, "2026-09-03T10:00:00.000Z");
  assert.equal(outcome.jobId, JOB);
});

test("an answer that names a different job is not an acknowledgement of this one", async () => {
  const { fetchImpl } = receiver({ jobId: "some-other-tour--some-other-scene", receivedAt: "2026-09-03T10:00:00.000Z" });
  const outcome = await deliverBrief({ jobId: JOB }, { fetchImpl, env: CONFIGURED });
  assert.equal(outcome.acknowledged, false);
  assert.equal(outcome.jobId, null);
  assert.match(outcome.reason, /some-other-tour--some-other-scene/);
});

test("an answer that names no job is not an acknowledgement", async () => {
  for (const answer of [{ receivedAt: "2026-09-03T10:00:00.000Z" }, {}, null]) {
    const { fetchImpl } = receiver(answer);
    const outcome = await deliverBrief({ jobId: JOB }, { fetchImpl, env: CONFIGURED });
    assert.equal(outcome.acknowledged, false, `an answer of ${JSON.stringify(answer)} was taken as an acknowledgement`);
    assert.match(outcome.reason, /without naming the job/);
  }
});

test("a job id inherited from a prototype is not a job id production named", async () => {
  // Every object literal inherits from Object.prototype, so an answer that does
  // not have its own jobId can still resolve one. The own-property helper is
  // what stops that being read as an acknowledgement.
  const inherited = Object.create({ jobId: JOB });
  inherited.receivedAt = "2026-09-03T10:00:00.000Z";
  const { fetchImpl } = receiver(inherited);
  const outcome = await deliverBrief({ jobId: JOB }, { fetchImpl, env: CONFIGURED });
  assert.equal(outcome.acknowledged, false);
  assert.match(outcome.reason, /without naming the job/);
});

test("a refusal and a network failure both come back as plain reasons", async () => {
  const refused = receiver({ jobId: JOB }, 503);
  const outcome = await deliverBrief({ jobId: JOB }, { fetchImpl: refused.fetchImpl, env: CONFIGURED });
  assert.equal(outcome.attempted, true);
  assert.equal(outcome.acknowledged, false);
  assert.match(outcome.reason, /status 503/);

  const dead = { fetchImpl: async () => { throw new Error("connect ECONNREFUSED"); } };
  const failed = await deliverBrief({ jobId: JOB }, { fetchImpl: dead.fetchImpl, env: CONFIGURED });
  assert.equal(failed.acknowledged, false);
  assert.match(failed.reason, /did not answer/);
});

// ---------------------------------------------------------------------------
// Sending, through the action a person presses
// ---------------------------------------------------------------------------

test("with delivery off, sending still sends and records only that", async () => {
  const { options } = await ready();
  const sent = await tourAction({ action: "send-to-production", ...AT }, options);
  assert.equal(sent.acknowledged, false);
  assert.equal(sent.handoff.briefVersion, 1);
  const record = await facts(options);
  assert.ok(record.some((entry) => entry.action === SENT_TO_PRODUCTION));
  assert.equal(record.filter((entry) => entry.action === PRODUCTION_ACKNOWLEDGED).length, 0);
});

test("an acknowledgement is a second fact carrying the job, the version, and production's time", async () => {
  const { fetchImpl, calls } = receiver({ jobId: JOB, acknowledgedAt: "2026-09-03T11:22:33.000Z" });
  const { options } = await ready({ env: CONFIGURED, deliveryFetch: fetchImpl });
  const sent = await tourAction({ action: "send-to-production", ...AT }, options);
  assert.equal(sent.acknowledged, true);
  assert.equal(calls.length, 1);
  // What went over the wire is what the action handed back, and the field
  // commit one removed is not on it.
  assert.deepEqual(calls[0].body, sent.sidecar);
  assert.equal("contractStatus" in calls[0].body, false);

  const record = await facts(options);
  const out = record.find((entry) => entry.action === SENT_TO_PRODUCTION);
  const answered = record.find((entry) => entry.action === PRODUCTION_ACKNOWLEDGED);
  assert.ok(answered, "production answered and no fact was written");
  assert.equal(answered.jobId, JOB);
  assert.equal(answered.version, "Brief V01");
  assert.equal(answered.at, "2026-09-03T11:22:33.000Z");
  // Two facts, in the order they happened.
  assert.ok(record.indexOf(out) < record.indexOf(answered));
  // The sent fact carries no job id, so the field is empty everywhere it is
  // not established.
  assert.equal(out.jobId, null);
});

test("production not answering leaves the send standing and writes no second fact", async () => {
  const refused = receiver({ jobId: JOB }, 500);
  const { options } = await ready({ env: CONFIGURED, deliveryFetch: refused.fetchImpl });
  const sent = await tourAction({ action: "send-to-production", ...AT }, options);
  assert.equal(sent.acknowledged, false);
  assert.equal(sent.handoff.kind, "brief");
  const record = await facts(options);
  assert.ok(record.some((entry) => entry.action === SENT_TO_PRODUCTION));
  assert.equal(record.filter((entry) => entry.action === PRODUCTION_ACKNOWLEDGED).length, 0);
});

test("pressing send again is the retry, and a repeat answer writes the fact once", async () => {
  // The first answer refuses, the second one lands, and the third would land
  // again if anything asked it to.
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(JSON.parse(init.body));
    const ok = calls.length > 1;
    return { ok, status: ok ? 200 : 502, async json() { return { jobId: JOB, receivedAt: "2026-09-03T12:00:00.000Z" }; } };
  };
  const { options } = await ready({ env: CONFIGURED, deliveryFetch: fetchImpl });

  const first = await tourAction({ action: "send-to-production", ...AT }, options);
  assert.equal(first.acknowledged, false);

  const second = await tourAction({ action: "send-to-production", ...AT }, options);
  assert.equal(second.acknowledged, true);
  assert.equal(second.brief.briefVersion, first.brief.briefVersion);
  assert.equal(second.handoff.handoffId, first.handoff.handoffId);

  // A third press posts nothing, because the acknowledgement already exists.
  const third = await tourAction({ action: "send-to-production", ...AT }, options);
  assert.equal(third.acknowledged, true);
  assert.equal(calls.length, 2, "an acknowledged Scene posted again");

  const record = await facts(options);
  assert.equal(record.filter((entry) => entry.action === PRODUCTION_ACKNOWLEDGED).length, 1);
  assert.equal(record.filter((entry) => entry.action === SENT_TO_PRODUCTION).length, 1);
  assert.equal(productionAcknowledged({ facts: record }), true);
});

test("a client reviewer is told nothing about delivery", async () => {
  const { fetchImpl } = receiver({ jobId: JOB, receivedAt: "2026-09-03T12:00:00.000Z" });
  const { options, asClient } = await ready({ env: CONFIGURED, deliveryFetch: fetchImpl });
  await tourAction({ action: "send-to-production", ...AT }, options);

  const mine = await facts(options);
  assert.ok(mine.some((entry) => entry.action === PRODUCTION_ACKNOWLEDGED));

  const theirs = (await tourAction({ action: "get-scene-activity", ...AT }, asClient)).facts;
  assert.equal(theirs.some((entry) => entry.action === PRODUCTION_ACKNOWLEDGED), false);
  assert.equal(JSON.stringify(theirs).includes("Production confirmed"), false);
  // Nothing on a client payload names a job either.
  assert.equal(theirs.some((entry) => entry.jobId), false);

  // And the action itself stays on our side of the glass.
  await assert.rejects(
    () => tourAction({ action: "send-to-production", ...AT }, asClient),
    /for the Higher Roads team/,
  );
});
