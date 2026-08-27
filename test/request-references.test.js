import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createMemoryBackend } from "../src/artist/store.js";
import { createSceneRecord } from "../src/tour/scene-record.js";
import { tourPathFor } from "../src/tour/store.js";
import { uploadPathFor, uploadPrefix } from "../src/tour/upload-path.js";

// Attaching a reference image happens where the asking happens. A client says
// what she wants and attaches a photo in the same act, so the upload control
// lives on the request screen and the Scene shows what landed. Ruled
// 2026-08-27.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOUR = "off-the-map-2026";
const ACCOUNT = "dierks-bentley";
const NEW_SCENE = "storm-abc";

function element() {
  return { innerHTML: "", textContent: "", dataset: {}, addEventListener() {} };
}

function requestPage() {
  const source = fs.readFileSync(path.join(rootPath, "app", "request.js"), "utf8")
    .replace(/^import .*?;\n/, "");
  const elements = { location: element(), request: element() };
  const handlers = {};
  const calls = [];

  const context = {
    URLSearchParams, JSON, Number, String, Array, Set, Boolean, Object, Date, console,
    ACCOUNT_ID: ACCOUNT,
    TOUR_ID: TOUR,
    scopedBody: (body) => ({ accountId: ACCOUNT, ...body }),
    window: { location: { search: `?tour=${TOUR}` } },
    document: {
      getElementById: (id) => elements[id] || element(),
      addEventListener: (type, handler) => { handlers[type] = handler; },
    },
  };
  const okReply = (body) => ({ ok: true, status: 200, json: async () => body });
  context.fetch = async (url, init) => {
    const sent = init && init.body && typeof init.body === "string" ? JSON.parse(init.body) : { put: true };
    calls.push({ url, sent });
    if (url === "/api/tour") {
      if (sent.action === "get-tour") return okReply({ tour: { id: TOUR, name: "Off The Map 2026", direction: { version: 1 } } });
      if (sent.action === "create-scene-request") return okReply({ assignment: { id: NEW_SCENE, title: sent.title } });
    }
    if (url === "/api/tour-upload") {
      if (!sent.mode) {
        return okReply({
          presignedUrl: "https://blob.example/put",
          pathname: uploadPathFor(TOUR, NEW_SCENE, sent.filename, ACCOUNT, "abc"),
        });
      }
      return okReply({ ok: true });
    }
    return okReply({ ok: true });
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    elements, handlers, calls,
    async settle() {
      for (let pass = 0; pass < 20; pass += 1) await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test("the request screen is where a reference image is attached", async () => {
  const page = requestPage();
  await page.settle();
  assert.match(page.elements.request.innerHTML, /data-reference="input"/, "the request screen takes no upload");
  assert.match(page.elements.request.innerHTML, /Add a reference image/);
});

test("a staged image uploads against the Scene the request just created", async () => {
  const page = requestPage();
  await page.settle();

  page.handlers.input({ target: { dataset: { field: "title" }, value: "Storm and lightning" } });
  page.handlers.input({ target: { dataset: { field: "request" }, value: "A storm builds across the song." } });
  page.handlers.change({
    target: { dataset: { reference: "input" }, files: [{ name: "sky.jpg", type: "image/jpeg", size: 2048 }] },
  });
  assert.match(page.elements.request.innerHTML, /sky\.jpg/, "the staged image is not shown before submitting");

  page.handlers.click({ target: { closest: (selector) => (selector === "button[data-submit]" ? {} : null) } });
  await page.settle();

  const uploads = page.calls.filter((entry) => entry.url === "/api/tour-upload");
  assert.equal(uploads.length, 2, "the upload did not authorize and record");
  assert.equal(uploads[0].sent.assignmentId, NEW_SCENE, "the upload was authorized against the wrong Scene");
  assert.equal(uploads[0].sent.filename, "sky.jpg");
  assert.equal(uploads[1].sent.mode, "reference-record");
  assert.equal(uploads[1].sent.assignmentId, NEW_SCENE, "the reference was recorded against the wrong Scene");
  assert.ok(uploads[1].sent.pathname.startsWith(uploadPrefix(TOUR, NEW_SCENE, ACCOUNT)), "the file landed outside the Scene");

  const put = page.calls.find((entry) => entry.url === "https://blob.example/put");
  assert.ok(put, "the file itself was never sent");
});

// What reference-record leaves behind, read back from storage rather than from
// a return value. This is the fact the Scene page lists on both views.
test("a recorded reference is a fact on the Scene, scoped to its account", async () => {
  const backend = createMemoryBackend();
  const record = createSceneRecord({ backend, accountId: ACCOUNT });
  const pathname = uploadPathFor(TOUR, NEW_SCENE, "sky.jpg", ACCOUNT, "abc");
  await record.appendFact(TOUR, NEW_SCENE, {
    actor: "Sarah Lyle",
    role: "Client reviewer",
    account: ACCOUNT,
    action: "Added reference",
    pathname,
    filename: "sky.jpg",
    contentType: "image/jpeg",
  });

  const stored = JSON.parse(await backend.read(tourPathFor(TOUR, NEW_SCENE, "scene-record", ACCOUNT)));
  const added = stored.facts.filter((fact) => fact.action === "Added reference");
  assert.equal(added.length, 1);
  assert.equal(added[0].actor, "Sarah Lyle");
  assert.ok(added[0].pathname.startsWith(uploadPrefix(TOUR, NEW_SCENE, ACCOUNT)));

  const elsewhere = await backend.read(tourPathFor(TOUR, NEW_SCENE, "scene-record", "stagecraft"));
  assert.equal(elsewhere === null || elsewhere === undefined, true, "the reference landed under another account");
});
