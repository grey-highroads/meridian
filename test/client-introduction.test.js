import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleAction as tourAction } from "../api/tour/index.js";
import { createMemoryBackend } from "../src/artist/store.js";
import { CLIENT_INTRODUCTION } from "../src/org/people.js";
import { ACCOUNT, CLIENT_ROLE, OPERATOR_ROLE, createOrgStore, usersPath } from "../src/org/store.js";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV = {
  MERIDIAN_OPERATOR: "grey@higherroads.co:operator-password:Grey Garner",
  MERIDIAN_CLIENT: "sarah@artist.co:client-password:Sarah Vance",
};
const SEEN_AT = "2026-08-27T14:00:00.000Z";

function read(name) {
  return fs.readFileSync(path.join(rootPath, name), "utf8");
}

test("the introduction is stored once on the person and follows them to another device", async () => {
  const backend = createMemoryBackend();
  const firstStore = createOrgStore({ backend, env: ENV });
  const firstSession = await firstStore.findUser("client");
  assert.equal(firstSession.introductionSeenAt, null);

  const before = await tourAction({ action: "get-me" }, { user: firstSession, orgStore: firstStore });
  assert.equal(before.user.introductionSeenAt, null);
  await tourAction(
    { action: "mark-introduction-seen" },
    { user: firstSession, orgStore: firstStore, now: () => SEEN_AT },
  );

  const document = JSON.parse(await backend.read(usersPath(ACCOUNT.id)));
  const stored = document.users.find((entry) => entry.id === "client");
  assert.deepEqual(stored.experiencesSeen, { [CLIENT_INTRODUCTION]: SEEN_AT });

  // A fresh store stands in for a second device and a later sign in. The
  // browser contributes nothing to the answer.
  const secondStore = createOrgStore({ backend, env: ENV });
  const secondSession = await secondStore.findUser("client");
  assert.equal(secondSession.introductionSeenAt, SEEN_AT);
  const storedBeforeSecondMark = await backend.read(usersPath(ACCOUNT.id));
  await tourAction(
    { action: "mark-introduction-seen" },
    { user: secondSession, orgStore: secondStore, now: () => "2026-08-28T14:00:00.000Z" },
  );
  assert.equal(await backend.read(usersPath(ACCOUNT.id)), storedBeforeSecondMark, "seeing it again rewrote the first record");
});
test("Higher Roads cannot mark or receive the client introduction", async () => {
  const backend = createMemoryBackend();
  const store = createOrgStore({ backend, env: ENV });
  const operator = await store.findUser("operator");
  const before = new Map(backend.files);
  await assert.rejects(
    () => tourAction({ action: "mark-introduction-seen" }, { user: operator, orgStore: store }),
    (error) => error.status === 403,
  );
  assert.deepEqual(backend.files, before);

  const home = read("app/home.js");
  assert.match(home, /user\.role !== "higher-roads" && \(params\.has\("introduction"\) \|\| !user\.introductionSeenAt\)/);
  const shell = read("app/shell.js");
  assert.match(shell, /if \(body\.user\.role === "higher-roads"\)[\s\S]*?\} else \{\s*\n\s*mountClientIntroduction\(\)/);
});

test("the five introduction cards use the existing empty state and exact copy", () => {
  const home = read("app/home.js");
  for (const copy of [
    "Home\", copy: \"Your snapshot into everything happening with the tour creative.",
    "Scenes\", copy: \"A Scene can be a song, an intro, a transition, or any moment that needs screen content.",
    "Reviews\", copy: \"Provide feedback, request changes, or approve the work for final production.",
    "Instructions that guide the creative work across all the scenes of the tour.",
    "visual direction and details so the creative process can begin.",
  ]) assert.ok(home.includes(copy), `introduction copy changed: ${copy}`);
  for (const calibration of ["Scene register / Open", "Decision queue / Clear", "${label} direction / Not set", "${label} / Not started"]) {
    assert.ok(home.includes(calibration), `introduction lost ${calibration}`);
  }
  // Two cards name the job by the word the account chose. Ruled 2026-09-04.
  assert.match(home, /title: `\$\{label\} details`/, "the details card does not read the record's word");
  assert.match(home, /<section class="m-empty-state m-empty-state--action"/);
  assert.match(home, /data-next-introduction/);
  assert.match(home, /data-skip-introduction/);
  assert.match(home, /data-finish-introduction/);
  assert.match(home, /completeIntroduction\("tour"\)/, "the last card does not go to the details page");
  assert.match(read("app/shell.js"), /data-client-introduction/, "the introduction cannot be reopened from the utility group");
  assert.doesNotMatch(home, /localStorage|sessionStorage/, "Home stores introduction state in the browser");
  assert.doesNotMatch(read("src/org/people.js"), /localStorage|sessionStorage/, "the person record depends on browser storage");
});
