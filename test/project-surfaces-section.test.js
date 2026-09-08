import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Project details holds what the media plays on, between the dates and the
// production setup. Every check reads the rendered markup a person would see,
// not that a function was called.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOUR = "off-the-map-2026";

const DATE = { date: "2026-10-02", venue: "Ryman Auditorium", place: "Nashville" };

function element() {
  return { innerHTML: "", textContent: "", dataset: {}, hidden: false, href: "", addEventListener() {} };
}

function run(page, elements, fetcher) {
  const source = fs.readFileSync(path.join(rootPath, "app", page), "utf8")
    .replace(/^(import .*?;\n)+/, "");
  const context = {
    URLSearchParams, JSON, Number, String, Array, Set, Boolean, Object, Date, console,
    encodeURIComponent, decodeURIComponent, URL, Promise, setTimeout, Math,
    ACCOUNT_ID: null,
    TOUR_ID: TOUR,
    ARTIST_LABEL: "Artist",
    artistLabel: () => "Artist",
    scopedBody: (body) => ({ accountId: null, ...body }),
    showNoTour: () => {},
    preserveContextNavigation: () => {},
    fetch: fetcher,
    window: { location: { search: `?tour=${TOUR}`, href: "https://meridian.test/tour.html" } },
    document: {
      getElementById: (id) => elements[id] || element(),
      addEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null,
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return async function settle() {
    for (let pass = 0; pass < 20; pass += 1) await new Promise((resolve) => setImmediate(resolve));
  };
}

async function projectPage({ surfaces = [], dates = [DATE], subject = true } = {}) {
  const elements = { location: element(), tour: element() };
  const tour = {
    id: TOUR,
    name: "Off The Map 2026",
    artistId: subject ? "dierks-bentley" : null,
    subjectIds: subject ? ["dierks-bentley"] : [],
    direction: { words: "Weather as memory.", version: 2, setBy: "Dana Reyes", setOn: "2026-07-14" },
    dates,
    surfaces,
    productionSetup: null,
    themes: [],
  };
  const settle = run("tour.js", elements, async (url, init) => {
    const action = JSON.parse(init.body).action;
    const body = action === "get-me"
      ? { user: { displayName: "Ray Mercer", role: "higher-roads" } }
      : action === "list-artists"
        ? { artists: [{ id: "dierks-bentley", name: "Dierks Bentley" }] }
        : { tour, assignments: [] };
    return { ok: true, json: async () => body };
  });
  await settle();
  return elements.tour.innerHTML;
}

function dates(count) {
  return Array.from({ length: count }, (entry, index) => ({
    date: `2026-10-0${index + 1}`,
    venue: `Venue ${index + 1}`,
    place: "Nashville",
  }));
}

test("Project details shows each surface with its description", async () => {
  const page = await projectPage({
    surfaces: [
      { name: "Side tent walls", description: "Both long walls, left and right of the stage." },
      { name: "Ceiling above the stage", description: "The canvas directly over the band." },
    ],
  });
  assert.match(page, /Side tent walls/, "the first surface is not on the page");
  assert.match(page, /Both long walls, left and right of the stage\./, "the first surface lost its description");
  assert.match(page, /Ceiling above the stage/, "the second surface is not on the page");
  assert.match(page, /2 SURFACES/, "the section does not say how many surfaces there are");
  assert.doesNotMatch(page, /Surfaces not added/, "a project with surfaces still shows the empty state");
});

test("a project with no surfaces is told what the field is for", async () => {
  const page = await projectPage({ surfaces: [] });
  assert.match(page, /Surfaces not added/, "the empty state is missing");
  assert.match(page, /Add what the media plays on, such as side tent walls or the ceiling above the stage\./, "the empty state does not say what a surface is");
  assert.match(page, /data-edit-surfaces/, "there is no way to add the surfaces");
});

test("Surfaces sits between the dates and the production setup", async () => {
  const page = await projectPage({ surfaces: [{ name: "Upstage screen", description: "Behind the band." }] });
  const run = page.indexOf('id="tour-run-heading"');
  const surfaces = page.indexOf('id="surfaces-heading"');
  const setup = page.indexOf('id="setup-heading"');
  assert.ok(run > -1 && surfaces > -1 && setup > -1, "one of the three sections is missing");
  assert.ok(run < surfaces, "Surfaces renders above the dates");
  assert.ok(surfaces < setup, "Surfaces renders below the production setup");
});

test("the dates empty state asks for dates without assuming a route", async () => {
  const page = await projectPage({ dates: [] });
  assert.match(page, /Add each date and where it happens, whether that is one night or a full run\./, "the dates empty state does not say what it wants");
  assert.doesNotMatch(page, /route is still taking shape/, "the dates empty state still assumes a route");
});

test("the full itinerary disclosure is absent at one and two dates and present at three", async () => {
  const one = await projectPage({ dates: dates(1) });
  assert.doesNotMatch(one, /Full itinerary/, "one date is hidden behind a disclosure");
  const two = await projectPage({ dates: dates(2) });
  assert.doesNotMatch(two, /Full itinerary/, "two dates are hidden behind a disclosure");
  const three = await projectPage({ dates: dates(3) });
  assert.match(three, /Full itinerary/, "three dates lost the disclosure");
});

test("both surface states render for a project with no subject attached", async () => {
  const withNone = await projectPage({ surfaces: [], subject: false });
  assert.match(withNone, /Surfaces not added/, "a project with no subject loses the surfaces empty state");
  const withSome = await projectPage({ surfaces: [{ name: "Upstage screen", description: "Behind the band." }], subject: false });
  assert.match(withSome, /Upstage screen/, "a project with no subject loses its surfaces");
});
