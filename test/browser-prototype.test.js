import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function prototypeSession() {
  const listeners = {};
  const intervals = new Map();
  let nextIntervalId = 1;
  const appRoot = {
    innerHTML: "",
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
  };
  const windowMock = {
    scrollTo() {},
    setTimeout() {
      return 1;
    },
    setInterval(callback) {
      const id = nextIntervalId;
      nextIntervalId += 1;
      intervals.set(id, callback);
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
  };
  const context = {
    Blob,
    Date,
    URL: {
      createObjectURL() {
        return "blob:prototype";
      },
      revokeObjectURL() {},
    },
    document: {
      querySelector(selector) {
        return selector === "#app" ? appRoot : null;
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return { click() {}, remove() {}, select() {}, style: {} };
      },
      body: { append() {} },
      execCommand() {},
    },
    navigator: { clipboard: { async writeText() {} } },
    window: windowMock,
    console,
  };

  vm.runInNewContext(fs.readFileSync(path.join(rootPath, "app/app.js"), "utf8"), context);

  function click(action, dataset = {}) {
    listeners.click({
      target: {
        closest() {
          return { dataset: { action, ...dataset } };
        },
      },
    });
  }

  function input(action, value, dataset = {}) {
    listeners.input({ target: { value, dataset: { action, ...dataset }, matches(selector) { return selector === `[data-action="${action}"]`; } } });
  }

  function finishIntervals() {
    for (let pass = 0; pass < 6; pass += 1) {
      [...intervals.values()].forEach((callback) => callback());
    }
  }

  function evaluate(expression) {
    return vm.runInContext(expression, context);
  }

  return { appRoot, click, input, finishIntervals, evaluate };
}

test("Sources landing separates guided intake from the detailed source library", () => {
  const session = prototypeSession();

  session.click("brand-brain");
  session.click("navigate-brain", { screen: "brain-sources" });
  const landing = session.appRoot.innerHTML;

  assert.match(landing, /source-rhythm-stack/);
  assert.match(landing, /source-rhythm-section source-foundation tone-info/);
  assert.match(landing, /source-section-progress/);
  assert.match(landing, /source-foundation-list/);
  assert.match(landing, /source-presence-grid/);
  assert.match(landing, /source-context-entry/);
  assert.match(landing, /<h2>All sources<\/h2>/);
  assert.doesNotMatch(landing, /slot-coverage/);

  const website = landing.indexOf(">Website<");
  const logo = landing.indexOf(">Logo<");
  const guide = landing.indexOf(">Brand guide<");
  const templates = landing.indexOf(">Templates<");
  assert.ok(website < logo && logo < guide && guide < templates, "foundation slots stay in the settled order");
  assert.doesNotMatch(landing, /The main site the Brain should read/);
  assert.doesNotMatch(landing, /The logo files your team uses/);

  session.click("open-slot-intake", { slot: "logo" });
  assert.match(session.appRoot.innerHTML, /source-inline-drawer/);
  assert.match(session.appRoot.innerHTML, /source-drawer-title-logo">Add logo/);
  assert.match(session.appRoot.innerHTML, /<h2>Brand foundation<\/h2>/);
  assert.doesNotMatch(session.appRoot.innerHTML, /Guided source/);
  assert.doesNotMatch(session.appRoot.innerHTML, /What are you adding\?/);
  assert.doesNotMatch(session.appRoot.innerHTML, /What kind of asset\?/);
  assert.match(session.appRoot.innerHTML, /Which variation\? <b>Required<\/b>/);
  const logoDrawer = session.appRoot.innerHTML.slice(session.appRoot.innerHTML.indexOf('id="source-drawer-logo"'));
  assert.ok(logoDrawer.indexOf("Choose or drag a file here") < logoDrawer.indexOf("Which variation?"), "logo upload comes before variation");
  assert.match(session.appRoot.innerHTML, /Source name <b>Required<\/b>/);
  assert.match(session.appRoot.innerHTML, /An official brand mark\. Use exactly as supplied\./);
  session.evaluate('state.brain.sourceAssetVariation = "Monochrome"');
  const logoContract = JSON.parse(JSON.stringify(session.evaluate("sourceContract()")));
  assert.equal(logoContract.assetKind, "logo");
  assert.equal(logoContract.assetVariation, "Monochrome");
  assert.equal(logoContract.provenance, "ours");
  assert.equal(logoContract.aspiration, "current");
  session.evaluate('state.brain.sourceTitle = "Primary logo"');
  session.evaluate('state.brain.pendingFiles = [{ name: "primary-logo.svg", size: 1024, type: "image/svg+xml" }]');
  session.click("add-file-source");
  assert.doesNotMatch(session.appRoot.innerHTML, /source-drawer-title-logo/);
  assert.match(session.appRoot.innerHTML, /Primary logo/);

  session.click("open-slot-intake", { slot: "templates" });
  assert.match(session.appRoot.innerHTML, /Template format <b>Required<\/b>/);
  assert.match(session.appRoot.innerHTML, /Slide \(16:9 widescreen\)/);
  assert.match(session.appRoot.innerHTML, /One-pager \(8\.5 x 11\)/);

  session.click("close-intake-door");
  session.click("open-slot-intake", { slot: "guide" });
  assert.match(session.appRoot.innerHTML, /This file shows logos or other assets on its pages/);
  assert.match(session.appRoot.innerHTML, /Register anything you need to place as a brand asset separately/);

  session.click("close-intake-door");
  session.click("open-slot-intake", { slot: "instagram" });
  assert.match(session.appRoot.innerHTML, /source-drawer-title-instagram">Add Instagram screenshot/);
  assert.match(session.appRoot.innerHTML, /source-presence-grid/);
  assert.doesNotMatch(session.appRoot.innerHTML, /What are you adding\?/);
  assert.doesNotMatch(session.appRoot.innerHTML, /Does this reflect the brand today, or where it is heading\?/);
  assert.match(session.appRoot.innerHTML, /How should the Brain use this\? <b>Required<\/b>/);
  assert.match(session.appRoot.innerHTML, /More control/);
  const socialContract = JSON.parse(JSON.stringify(session.evaluate("sourceContract()")));
  assert.equal(socialContract.authority, "creative-reference");
  assert.equal(socialContract.provenance, "ours");
  assert.equal(socialContract.aspiration, "current");

  session.click("close-intake-door");
  assert.match(session.appRoot.innerHTML, /A recent full-screen capture works best/);
  assert.match(session.appRoot.innerHTML, /We can’t access Instagram directly/);
  assert.match(session.appRoot.innerHTML, /a few recent posts/);

  session.click("open-context-intake");
  assert.match(session.appRoot.innerHTML, /source-drawer-title-context">Add another source/);
  assert.match(session.appRoot.innerHTML, />File<\/button>/);
  assert.match(session.appRoot.innerHTML, />Link<\/button>/);
  assert.match(session.appRoot.innerHTML, /Where did this come from\?/);
  assert.match(session.appRoot.innerHTML, /Our brand/);
  assert.match(session.appRoot.innerHTML, /Outside reference/);
  assert.match(session.appRoot.innerHTML, /Does this show the brand today, or a direction to explore\?/);
  assert.match(session.appRoot.innerHTML, /How should the Brain use this\? <b>Required<\/b>/);
  assert.match(session.appRoot.innerHTML, /What should this teach\?/);
  assert.match(session.appRoot.innerHTML, />Influence<\/span>/);
  assert.doesNotMatch(session.appRoot.innerHTML, /What are you adding\?/);
  assert.doesNotMatch(session.appRoot.innerHTML, /intake-kind-grid/);
  session.click("set-source-provenance", { value: "emulate" });
  session.click("set-source-aspiration", { value: "aspiration" });
  const contextContract = JSON.parse(JSON.stringify(session.evaluate("sourceContract()")));
  assert.equal(contextContract.authority, "creative-reference");
  assert.equal(contextContract.provenance, "emulate");
  assert.equal(contextContract.aspiration, "aspiration");
});

test("Brand Brain prototype connects empty onboarding to a production-ready stored version", () => {
  const session = prototypeSession();

  session.click("brand-brain");
  assert.match(session.appRoot.innerHTML, /Turn what you know into reusable brand guidance/);
  assert.match(session.appRoot.innerHTML, /Overview/);
  assert.match(session.appRoot.innerHTML, /Sources/);
  assert.match(session.appRoot.innerHTML, /Needs review/);
  assert.match(session.appRoot.innerHTML, /Brand guidance/);
  assert.match(session.appRoot.innerHTML, /History/);

  session.click("load-sample-sources");
  assert.match(session.appRoot.innerHTML, /<h2>All sources<\/h2>/);
  assert.match(session.appRoot.innerHTML, /source-library-table-head/);
  assert.match(session.appRoot.innerHTML, /source-library-kind/);
  assert.match(session.appRoot.innerHTML, /Approved brand assets/);
  assert.match(session.appRoot.innerHTML, /Protected assets/);
  assert.match(session.appRoot.innerHTML, /Brand strategy decks/);
  assert.match(session.appRoot.innerHTML, /Campaign archive/);
  assert.doesNotMatch(session.appRoot.innerHTML, />Brand evidence</);

  session.click("open-slot-intake", { slot: "logo" });
  assert.match(session.appRoot.innerHTML, /Which variation\?/);
  assert.match(session.appRoot.innerHTML, /20 MB maximum/);

  session.click("close-intake-door");
  session.click("open-slot-intake", { slot: "guide" });
  assert.match(session.appRoot.innerHTML, /PDF, DOCX, PPTX, text files, PNG, JPG, WEBP/);
  assert.match(session.appRoot.innerHTML, /accept="[^"]*\.png[^"]*\.webp[^"]*"/);
  assert.doesNotMatch(session.appRoot.innerHTML, /accept="[^"]*\.svg/);

  session.click("close-intake-door");
  session.click("toggle-source-details", { id: "approved-brand-assets" });
  assert.match(session.appRoot.innerHTML, /Use these files exactly as supplied/);
  assert.match(session.appRoot.innerHTML, /What should we leave out/);

  session.click("start-brain-synthesis");
  assert.match(session.appRoot.innerHTML, /Building your Brand Brain/);
  session.finishIntervals();
  assert.match(session.appRoot.innerHTML, /Your sources are ready for review/);

  session.click("navigate-brain", { screen: "brain" });
  session.click("approve-clean-assets");
  session.click("resolve-brain-exception", { id: "audience-alignment-conflict", resolution: "keep-source-b" });
  session.click("resolve-brain-exception", { id: "yuzu-pack-duplicate", resolution: "keep-both" });
  session.click("resolve-brain-exception", { id: "four-pm-reset", resolution: "contextual" });
  session.click("resolve-brain-exception", { id: "no-medical-health-claims", resolution: "use-rule" });
  assert.match(session.appRoot.innerHTML, /Your Brand Brain draft is ready/);

  session.click("finish-brain-review");
  assert.match(session.appRoot.innerHTML, /SLAKE Brand Brain v1/);
  assert.match(session.appRoot.innerHTML, /Draft for review/);
  assert.match(session.appRoot.innerHTML, /What the Brand Brain understands/);
  assert.match(session.appRoot.innerHTML, /Why the system reached this view/);
  assert.match(session.appRoot.innerHTML, /Brand foundation dossier/);
  assert.match(session.appRoot.innerHTML, /Comment on this/);
  assert.match(session.appRoot.innerHTML, /category-foundation active/);
  assert.match(session.appRoot.innerHTML, /category-identity/);
  assert.match(session.appRoot.innerHTML, /category-rules/);

  session.click("open-brain-artifact", { id: "dossier" });
  assert.match(session.appRoot.innerHTML, /Brand Dossier/);
  assert.match(session.appRoot.innerHTML, /A person, not a segment/);
  assert.match(session.appRoot.innerHTML, /Pulled from approved identity/);
  assert.match(session.appRoot.innerHTML, /Never optimized/);

  session.click("select-brain-artifact", { id: "lived" });
  assert.match(session.appRoot.innerHTML, /Environments they have earned/);
  assert.match(session.appRoot.innerHTML, /A worked kitchen at 4pm/);

  session.click("select-brain-artifact", { id: "story" });
  assert.match(session.appRoot.innerHTML, /Four scenes from one believable life/);
  assert.match(session.appRoot.innerHTML, /Why these four/);
  session.click("toggle-guidance-comment", { target: "story:artifact:rhythm" });
  session.input("guidance-comment-draft", "Make the transition into the shared evening more specific.");
  session.click("save-guidance-comment", { target: "story:artifact:rhythm", section: "story", label: "Story Architecture" });
  assert.match(session.appRoot.innerHTML, /Make the transition into the shared evening more specific/);

  session.click("set-guidance-view", { view: "guidance" });
  assert.match(session.appRoot.innerHTML, /1 inline comment saved/);
  session.click("create-comment-revision");
  assert.match(session.appRoot.innerHTML, /SLAKE Brand Brain v2/);

  session.click("toggle-guidance-comment", { target: "foundation:prose:0" });
  session.input("guidance-comment-draft", "Make the role of flavor more prominent.");
  session.click("save-guidance-comment", { target: "foundation:prose:0", section: "foundation" });
  assert.match(session.appRoot.innerHTML, /Make the role of flavor more prominent/);
  assert.match(session.appRoot.innerHTML, /1 inline comment saved/);

  session.click("create-comment-revision");
  assert.match(session.appRoot.innerHTML, /SLAKE Brand Brain v3/);
  assert.match(session.appRoot.innerHTML, /Included in v3/);

  session.click("approve-brain-artifact");
  assert.match(session.appRoot.innerHTML, /Ready for production/);
  assert.match(session.appRoot.innerHTML, /Go to Design Studio/);

  session.click("navigate-brain", { screen: "brain-history" });
  assert.match(session.appRoot.innerHTML, /Brand Brain v3 approved/);
  assert.match(session.appRoot.innerHTML, /SLAKE source batch added/);

  session.click("navigate-brain", { screen: "brain-sources" });
  assert.match(session.appRoot.innerHTML, /Active v3/);
  session.click("open-context-intake");
  session.click("set-source-form", { kind: "url" });
  session.click("set-source-provenance", { value: "ours" });
  session.click("set-source-aspiration", { value: "current" });
  session.input("brain-source-title", "Retail expansion briefing");
  session.input("brain-source-url", "https://example.com/retail-expansion");
  session.input("brain-source-usage", "Use only as company background; do not treat growth targets as brand guidance.");
  session.click("add-url-source");
  assert.match(session.appRoot.innerHTML, /1 pending/);
  assert.match(session.appRoot.innerHTML, /Integrate new sources/);
});

test("shared visual polish layer centralizes spacing, surfaces, and semantic states", () => {
  const index = fs.readFileSync(path.join(rootPath, "app/index.html"), "utf8");
  const styles = fs.readFileSync(path.join(rootPath, "app/styles.css"), "utf8");
  const polish = fs.readFileSync(path.join(rootPath, "app/polish.css"), "utf8");
  const app = fs.readFileSync(path.join(rootPath, "app/app.js"), "utf8");

  assert.match(index, /polish\.css/);
  assert.match(polish, /--section-gap: var\(--space-6\)/);
  assert.match(polish, /--card-padding: var\(--space-5\)/);
  assert.match(polish, /\.surface-accent-governed/);
  assert.match(polish, /\.pill-protected/);
  assert.match(polish, /\.asset-icon-image::before/);
  assert.match(app, /surface-accent-governed/);
  assert.match(app, /pill-success/);
  assert.doesNotMatch(app, /style="color: #e6c765/);
  assert.doesNotMatch(styles, /font-family: var\(--body\)/);
});
