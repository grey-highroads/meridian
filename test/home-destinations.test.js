import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { sceneLifecycle } from "../src/tour/lifecycle.js";

// Where Home sends a person. Work needing a decision opens in the Reviews
// gallery on the version in question; everything else opens the Scene. The two
// pages Home used to send people to were removed on 2026-08-27.

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOUR = "off-the-map-2026";

function element() {
  return { innerHTML: "", textContent: "", dataset: {}, addEventListener() {} };
}

function homePage(user, assignments) {
  const source = fs.readFileSync(path.join(rootPath, "app", "home.js"), "utf8")
    .replace(/^(import .*?;\n)+/, "");
  const elements = { location: element(), home: element(), "review-count": element() };
  const context = {
    URLSearchParams, JSON, Number, String, Array, Set, Boolean, Object, Date, console,
    encodeURIComponent, decodeURIComponent,
    ACCOUNT_ID: null,
    TOUR_ID: TOUR,
    scopedBody: (body) => ({ accountId: null, ...body }),
    TOUR_LABEL: "Tour",
    tourLabel: (record) => String((record && record.label) || "").trim() || "Tour",
    window: { location: { search: `?tour=${TOUR}`, href: "https://meridian.test/index.html" } },
    URL,
    document: {
      getElementById: (id) => elements[id] || element(),
      addEventListener() {},
      querySelectorAll: () => [],
    },
  };
  const okReply = (body) => ({ ok: true, status: 200, json: async () => body });
  context.fetch = async (url, init) => {
    const sent = JSON.parse(init.body);
    if (sent.action === "get-me") return okReply({ user });
    if (sent.action === "get-tour") {
      return okReply({ tour: { id: TOUR, name: "Off The Map 2026", direction: { words: "w", version: 1 }, dates: [], productionSetup: null }, assignments });
    }
    if (sent.action === "get-scene-activity") return okReply({ facts: [] });
    return okReply({});
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    elements,
    async settle() {
      for (let pass = 0; pass < 20; pass += 1) await new Promise((resolve) => setImmediate(resolve));
    },
    markup: () => elements.home.innerHTML,
  };
}

function renderedSummaryText(markup) {
  const summary = markup.match(/<details class="m-home-moving"[^>]*><summary>([\s\S]*?)<\/summary>/)?.[1];
  assert.ok(summary, "Home rendered no in-progress summary");
  return summary.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// The lifecycle is what Home reads, so the row under test carries exactly what
// the route would put on it rather than numbers a test made up.
function sceneAt(overrides) {
  const state = sceneLifecycle(overrides.stored);
  return { id: "storm-and-lightning", title: "Storm and lightning", openQuestions: [], ...state };
}

const CLEARED = {
  stored: {
    request: { requestedBy: "Sarah Lyle" },
    concept: { title: "c" },
    briefs: [{ briefVersion: 1, status: "frozen" }],
    artboards: [{ artboard: { artboardVersion: 1 } }, { artboard: { artboardVersion: 2 } }],
    approvals: { readyForClient: [{ artboardVersion: 2 }], clientApprovals: [], comments: [] },
  },
};

const NOT_CLEARED = {
  stored: {
    request: { requestedBy: "Sarah Lyle" },
    concept: { title: "c" },
    briefs: [{ briefVersion: 1, status: "frozen" }],
    artboards: [{ artboard: { artboardVersion: 1 } }, { artboard: { artboardVersion: 2 } }],
    approvals: { readyForClient: [], clientApprovals: [], comments: [] },
  },
};

test("the lifecycle carries the artboard version a gallery link needs", () => {
  const cleared = sceneAt(CLEARED);
  assert.equal(cleared.currentArtboardVersion, 2);
  assert.equal(cleared.currentVersion, "Artboard V02");
  const none = sceneAt({ stored: { request: { requestedBy: "x" } } });
  assert.equal(none.currentArtboardVersion, null);
});

test("an admin row for work needing a decision opens the newest version in the gallery", async () => {
  const page = homePage({ role: "higher-roads", displayName: "Ray Mercer" }, [sceneAt(NOT_CLEARED)]);
  await page.settle();
  const markup = page.markup();

  const href = markup.match(/href="([^"]*reviews\.html[^"]*)"/);
  assert.ok(href, "Home gives an admin no way through to the work");
  assert.match(href[1], /scene=storm-and-lightning/);
  assert.match(href[1], /version=2/, "Home does not open the newest version");
  assert.doesNotMatch(markup, /review\.html\?|client-review\.html/, "Home still links a removed page");
});

test("a client row for work that is ready opens the presented version in the gallery", async () => {
  const page = homePage({ role: "client-reviewer", displayName: "Sarah Lyle", introductionSeenAt: "2026-08-01" }, [sceneAt(CLEARED)]);
  await page.settle();
  const markup = page.markup();

  const href = markup.match(/href="([^"]*reviews\.html[^"]*)"/);
  assert.ok(href, "Home gives a client no way through to the work");
  assert.match(href[1], /version=2/, "the client is not sent to the presented version");
  assert.doesNotMatch(markup, /client-review\.html/, "Home still sends the client to the removed page");
});

test("a Scene with no artboard still opens the Scene", async () => {
  const waiting = sceneAt({ stored: { request: { requestedBy: "Sarah Lyle" } } });
  const page = homePage({ role: "higher-roads", displayName: "Ray Mercer" }, [waiting]);
  await page.settle();
  const markup = page.markup();

  assert.match(markup, /scene\.html\?tour=/, "a Scene with nothing back does not open the Scene");
  assert.doesNotMatch(markup, /reviews\.html\?/, "a Scene with nothing back opens the gallery");
});

test("one Scene with a question and a pending review appears once on Home", async () => {
  const scene = {
    ...sceneAt(CLEARED),
    openQuestions: [{ id: "question-1", askedBy: "Higher Roads", text: "Can final playback support alpha-channel media?" }],
  };
  const page = homePage({ role: "client-reviewer", displayName: "Sarah Lyle", introductionSeenAt: "2026-08-01" }, [scene]);
  await page.settle();
  const markup = page.markup();

  assert.equal((markup.match(/Storm and lightning/g) || []).length, 1, "Home repeats one Scene across decision and progress sections");
  assert.match(markup, /Answer requested/, "the question does not set the Scene's visible job");
  assert.match(markup, />Answer</, "the question does not carry its action");
  assert.doesNotMatch(markup, /In progress, nothing needed from you/, "a Scene needing an answer also appears as independent work");
});

test("both Home views render the in-progress disclosure as one composed line", async () => {
  const moving = [
    { id: "storm-and-lightning", title: "Storm and lightning", stage: "Requested", waitingOn: "production", currentVersion: null, openQuestions: [] },
    { id: "opening-sequence", title: "Opening sequence", stage: "Approved for production", waitingOn: "production", currentVersion: "Artboard V02", openQuestions: [] },
  ];
  const users = [
    { role: "higher-roads", displayName: "Ray Mercer" },
    { role: "client-reviewer", displayName: "Sarah Lyle", introductionSeenAt: "2026-08-01" },
  ];
  const rendered = [];

  for (const user of users) {
    const page = homePage(user, moving);
    await page.settle();
    const markup = page.markup();
    rendered.push(renderedSummaryText(markup));
    assert.match(markup, /<details class="m-home-moving" open>/, `${user.role} Home collapsed work that needs nothing`);
    assert.match(markup, /<span class="m-home-moving__count">2 Scenes<\/span>/, `${user.role} Home did not render the count as its own element`);
  }

  assert.deepEqual(rendered, [
    "In progress, nothing needed from you 2 Scenes",
    "In progress, nothing needed from you 2 Scenes",
  ]);

  const patterns = fs.readFileSync(path.join(rootPath, "app", "design", "patterns.css"), "utf8");
  const summaryRule = patterns.match(/\.m-home-moving > summary \{([\s\S]*?)\n  \}/)?.[1] || "";
  assert.match(summaryRule, /white-space:\s*nowrap;/, "the composed summary can break across lines at a narrow width");
});
