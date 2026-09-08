import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Pages that name the engagement read the word project. The word stored on the
// record is a label and stops reaching prose, so a project carrying one renders
// the same sentence as a project carrying none. Ruled 2026-09-08. What is
// asserted here is the sentence a person reads rather than a call.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOUR = "off-the-map-2026";

function element() {
  return { innerHTML: "", textContent: "", dataset: {}, hidden: false, href: "", addEventListener() {} };
}

function baseContext(elements) {
  return {
    URLSearchParams, JSON, Number, String, Array, Set, Boolean, Object, Date, console,
    encodeURIComponent, decodeURIComponent, URL, Promise, setTimeout, Math,
    ACCOUNT_ID: null,
    TOUR_ID: TOUR,
    scopedBody: (body) => ({ accountId: null, ...body }),
    showNoTour: () => {},
    preserveContextNavigation: () => {},
    window: { location: { search: `?tour=${TOUR}`, href: "https://meridian.test/scenes.html" } },
    document: {
      getElementById: (id) => elements[id] || element(),
      addEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null,
    },
  };
}

function run(page, elements, fetcher) {
  const source = fs.readFileSync(path.join(rootPath, "app", page), "utf8")
    .replace(/^(import .*?;\n)+/, "");
  const context = baseContext(elements);
  context.fetch = fetcher;
  vm.createContext(context);
  vm.runInContext(source, context);
  return async function settle() {
    for (let pass = 0; pass < 20; pass += 1) await new Promise((resolve) => setImmediate(resolve));
  };
}

// ---------------------------------------------------------------------------
// The Scenes directory
// ---------------------------------------------------------------------------

async function scenesPage(label) {
  const elements = {
    location: element(),
    scenes: element(),
    "request-scene": element(),
    "scenes-intro": element(),
    "scene-list-heading": element(),
  };
  const okReply = (body) => ({ ok: true, status: 200, json: async () => body });
  const settle = run("scenes.js", elements, async () => okReply({
    tour: { id: TOUR, name: "Off The Map 2026", ...(label === null ? {} : { label }) },
    assignments: [{ id: "storm-and-lightning", title: "Storm and lightning", moment: "Song 4" }],
  }));
  await settle();
  return elements;
}

test("the Scenes directory reads project and not the word the record carries", async () => {
  const elements = await scenesPage("Residency");
  assert.equal(elements["scenes-intro"].textContent, "Every Scene in this project, from request through delivery.");
  assert.equal(elements["scene-list-heading"].textContent, "Scenes in this project");
  for (const id of ["scenes-intro", "scene-list-heading"]) {
    assert.doesNotMatch(elements[id].textContent, /residency/i, `${id} still reads the record's label`);
  }
});

test("the Scenes directory reads project for a record carrying no word", async () => {
  const elements = await scenesPage(null);
  assert.equal(elements["scenes-intro"].textContent, "Every Scene in this project, from request through delivery.");
  assert.equal(elements["scene-list-heading"].textContent, "Scenes in this project");
});
