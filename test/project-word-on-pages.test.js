import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { TOUR_LABEL, tourLabel } from "../app/label.js";

// Pages that name the engagement read the project record's own word. A project
// carrying a word renders that word, a project carrying none renders Tour, and
// what is asserted here is the sentence a person reads rather than a call.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOUR = "off-the-map-2026";

function element() {
  return { innerHTML: "", textContent: "", dataset: {}, hidden: false, href: "", addEventListener() {} };
}

function baseContext(elements) {
  return {
    URLSearchParams, JSON, Number, String, Array, Set, Boolean, Object, Date, console,
    encodeURIComponent, decodeURIComponent, URL, Promise, setTimeout, Math,
    TOUR_LABEL, tourLabel,
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

test("the Scenes directory reads the word the project carries", async () => {
  const elements = await scenesPage("Residency");
  assert.equal(elements["scenes-intro"].textContent, "Every Scene on the residency, from request through delivery.");
  assert.equal(elements["scene-list-heading"].textContent, "Scenes on this residency");
});

test("the Scenes directory reads Tour for a project carrying no word", async () => {
  const elements = await scenesPage(null);
  assert.equal(elements["scenes-intro"].textContent, "Every Scene on the tour, from request through delivery.");
  assert.equal(elements["scene-list-heading"].textContent, "Scenes on this tour");
});
