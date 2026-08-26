import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { handleAction } from "../api/artist/index.js";
import { readTourFixture } from "../api/tour/index.js";
import { createArtistStore, createMemoryBackend } from "../src/artist/store.js";
import { parseTourFixture } from "../src/tour/parse-fixture.js";
import { CLIENT_ROLE, OPERATOR_ROLE } from "../src/org/store.js";

const ACCOUNT = "dierks-bentley";
const ARTIST = "dierks-bentley";
const TOUR = "off-the-map-2026";
const SHARED = `brand-world-system/clients/${ACCOUNT}/tours/${TOUR}/`;
const FIXTURE_TOUR = join(process.cwd(), "tours", TOUR, "tour.md");
const FIXTURE_ASSIGNMENT = join(process.cwd(), "tours", TOUR, "assignments", "storm-and-lightning.md");

const OPERATOR = { id: "operator", role: OPERATOR_ROLE, accountId: ACCOUNT, displayName: "Grey" };
const CLIENT = { id: "client", role: CLIENT_ROLE, accountId: ACCOUNT, displayName: "Client reviewer" };

function run(backend, user, tourId = TOUR) {
  return handleAction(
    { action: "seed-tour-at-shared-path", artistId: ARTIST, tourId },
    { user, store: createArtistStore({ backend, accountId: ACCOUNT }) },
  );
}

async function stored(backend, name) {
  const body = await backend.read(`${SHARED}${name}.json`);
  return body === null || body === undefined ? null : JSON.parse(body);
}

async function committedFixture() {
  return parseTourFixture(await readTourFixture(TOUR));
}

test("a Higher Roads run stores the tour, its direction, and every assignment at the shared path", async () => {
  const backend = createMemoryBackend({});
  const before = await Promise.all([readFile(FIXTURE_TOUR, "utf8"), readFile(FIXTURE_ASSIGNMENT, "utf8")]);
  const fixture = await committedFixture();

  const result = await run(backend, OPERATOR);

  assert.deepEqual(await stored(backend, "tour"), { tour: fixture.tour, assignments: [] });
  assert.deepEqual(await stored(backend, "directions"), { versions: [fixture.tour.direction] });
  assert.deepEqual(await stored(backend, "requests"), { scenes: fixture.assignments });

  // Every assignment field survives the round trip, including the ones a
  // request written in the app does not carry.
  const scenes = (await stored(backend, "requests")).scenes;
  assert.equal(scenes.length, fixture.assignments.length);
  for (const [index, assignment] of fixture.assignments.entries()) {
    assert.deepEqual(Object.keys(scenes[index]).sort(), Object.keys(assignment).sort());
  }
  // The tour's production setup travels on the tour document, stored as given.
  assert.deepEqual((await stored(backend, "tour")).tour.productionSetup, fixture.tour.productionSetup);

  // Nothing landed anywhere but the shared location.
  for (const path of backend.files.keys()) assert.ok(path.startsWith(SHARED), `${path} is outside the shared location`);
  assert.equal(backend.files.size, 3);

  assert.equal(result.count, 2 + fixture.assignments.length);
  assert.equal(result.lines.length, result.count + 1);
  assert.ok(result.lines[0].startsWith(`Tour ${TOUR} written to ${SHARED}tour.json`));
  assert.ok(result.lines.some((line) => line.startsWith(`Direction version 1 written to ${SHARED}directions.json`)));
  for (const assignment of fixture.assignments) {
    assert.ok(
      result.lines.some((line) => line === `Assignment ${assignment.id} written to ${SHARED}requests.json`),
      `no line reports ${assignment.id}`,
    );
  }

  assert.deepEqual(await Promise.all([readFile(FIXTURE_TOUR, "utf8"), readFile(FIXTURE_ASSIGNMENT, "utf8")]), before);
});

test("a client session gets absence and nothing is written", async () => {
  const backend = createMemoryBackend({});
  await assert.rejects(run(backend, CLIENT), /not something this route does/);
  assert.equal(backend.files.size, 0);
});

test("a request with no session gets the same absence a client gets", async () => {
  const backend = createMemoryBackend({});
  await assert.rejects(run(backend, null), /not something this route does/);
  assert.equal(backend.files.size, 0);
});

test("a second run is refused in plain words and changes nothing", async () => {
  const backend = createMemoryBackend({});
  await run(backend, OPERATOR);
  const after = {};
  for (const path of backend.files.keys()) after[path] = await backend.read(path);

  const second = await run(backend, OPERATOR);
  assert.equal(second.count, 0);
  assert.equal(second.lines.length, 1);
  assert.match(second.lines[0], /already stored/);

  const now = {};
  for (const path of backend.files.keys()) now[path] = await backend.read(path);
  assert.deepEqual(now, after);
  assert.equal(backend.files.size, 3);
});

test("a tour with no committed fixture is reported as absent and writes nothing", async () => {
  const backend = createMemoryBackend({});
  await assert.rejects(run(backend, OPERATOR, "no-such-tour"), /No tour fixture is committed/);
  assert.equal(backend.files.size, 0);
});
