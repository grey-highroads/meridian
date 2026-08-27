import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PAGES = [
  "app/index.html", "app/scenes.html", "app/reviews.html", "app/artist.html",
  "app/tour.html", "app/scene.html", "app/review.html", "app/client-review.html",
  "app/request.html", "app/direction.html", "app/handoff.html", "app/admin.html",
];
const SCRIPTS = [
  "app/home.js", "app/scenes.js", "app/reviews.js", "app/artist.js",
  "app/tour.js", "app/scene.js", "app/review.js", "app/client-review.js",
  "app/request.js", "app/direction.js", "app/handoff.js", "app/shell.js",
  "app/admin.js",
];

function read(name) {
  return fs.readFileSync(path.join(rootPath, name), "utf8");
}

// What a person can actually read on the page. Markup is read whole and script
// is read through its string literals, in both cases with comments, tags,
// attribute values and interpolations taken out. A literal with no space in it
// is a key or an id rather than copy, so it is left alone.
function clean(literal) {
  return literal
    .replace(/\$\{[^{}]*\}/g, " ")
    .replace(/<[^>]*>/g, " ")
    .trim();
}

function visibleText(name, source) {
  const stripped = source
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  if (name.endsWith(".html")) return clean(stripped);
  const literals = stripped.match(/`[^`]*`|"[^"\n]*"|'[^'\n]*'/g) || [];
  return literals.map(clean).filter((text) => /\s/.test(text)).join(" | ");
}

test("every Meridian page loads the design system and no Brand World System file", () => {
  for (const name of [...PAGES, ...SCRIPTS]) {
    const source = read(name);
    assert.doesNotMatch(source, /bws-/, `${name} loads a Brand World System file`);
    assert.doesNotMatch(source, /bws\.css/, `${name} loads a Brand World System stylesheet`);
    assert.doesNotMatch(source, /artist\.css/, `${name} loads the removed artist stylesheet`);
  }
  for (const name of PAGES) {
    const source = read(name);
    const sheets = source.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || [];
    assert.equal(sheets.length, 1, `${name} loads ${sheets.length} stylesheets`);
    assert.match(sheets[0], /\.\/design\/index\.css/, `${name} loads something other than the design system`);
    assert.match(source, /07-micro-icon-16px\.svg/, `${name} does not use the Meridian browser mark`);
  }
  assert.match(read("app/landing.html"), /07-micro-icon-16px\.svg/, "the front door does not use the Meridian browser mark");
});

test("no architecture words reach the pages", () => {
  for (const name of [...PAGES, ...SCRIPTS]) {
    const copy = visibleText(name, read(name));
    for (const word of ["bin", "facet", "governance", "candidate", "proposed", "finding-"]) {
      assert.ok(!new RegExp(`\\b${word}`, "i").test(copy), `${name} says "${word}" to a person`);
    }
    assert.ok(!copy.includes("\u2014"), `${name} carries an em dash`);
  }
});

test("the phase-two Home fixture is the shell composition reference", () => {
  const source = read("app/design/samples/index.html");
  const primaryNav = source.match(/<nav class="m-shell__nav"[\s\S]*?<\/nav>/)?.[0] || "";

  for (const label of ["Home", "Scenes", "Reviews", "Tour details"]) {
    assert.match(primaryNav, new RegExp(`>${label}<`), `Home fixture is missing ${label}`);
  }

  assert.doesNotMatch(primaryNav, />Artist Brain</, "Artist Brain appears in primary navigation");
  assert.match(source, /class="m-home"|class="[^"]*m-home[^"]*"/, "Home fixture does not use the Home pattern");
  assert.match(source, /class="m-attention-list"/, "Home fixture does not show assigned attention");
  assert.match(source, /class="m-lifecycle-list"/, "Home fixture does not show Scene lifecycle");
  assert.match(source, /class="m-home__sidecar m-inspector"/, "Home fixture does not use the readiness Inspector");
  assert.doesNotMatch(source, /style=/, "Home fixture uses an inline style");
});

test("the live shell has the four destinations and Home uses the approved patterns", () => {
  const source = read("app/index.html");
  const primaryNav = source.match(/<nav class="m-shell__nav"[\s\S]*?<\/nav>/)?.[0] || "";
  for (const label of ["Home", "Scenes", "Reviews", "Tour details"]) {
    assert.match(primaryNav, new RegExp(`>${label}<`), `live Home is missing ${label}`);
  }
  assert.doesNotMatch(primaryNav, />Artist Brain</, "Artist Brain appears in live primary navigation");
  const script = read("app/home.js");
  for (const pattern of ["m-home__layout", "m-attention-list", "m-lifecycle-list", "m-home__sidecar m-inspector"]) {
    assert.match(script, new RegExp(pattern), `live Home is missing ${pattern}`);
  }
  assert.doesNotMatch(script, /Foundation ready|Tour readiness/, "Home exposes architecture instead of tour language");
  assert.match(script, /Request a Scene/, "Home does not offer the primary Scene action independently");
  assert.match(script, /Welcome,/, "Home does not greet the signed-in person");
  for (const category of ["Creative direction", "Dates and venues", "Playback system", "Production details", "Tour-wide themes"]) {
    assert.match(script, new RegExp(category), `Tour at a glance is missing ${category}`);
  }
  assert.doesNotMatch(script, /m-lifecycle-row__fact/, "Home still splits one Scene state across several columns");
});

test("the shared shell restores every primary navigation icon", () => {
  const source = read("app/shell.js");
  for (const destination of ["index.html", "scenes.html", "reviews.html", "tour.html"]) {
    assert.match(source, new RegExp(`"${destination.replace(".", "\\.")}"`), `shell has no icon for ${destination}`);
  }
  assert.match(source, /link\.matches\("\.m-shell__nav-link"\)/, "shell can add a navigation icon to the wordmark");
  assert.match(source, /insertAdjacentHTML\("afterbegin"/, "shell does not add missing icons to live navigation");
});

test("account and Tour context travel through Meridian navigation and requests", () => {
  const context = read("app/context.js");
  assert.match(context, /params\.get\("account"\)/, "the shell does not read the selected account");
  assert.match(context, /params\.get\("tour"\)/, "the shell does not read the selected Tour");
  assert.match(context, /url\.searchParams\.set\("account", ACCOUNT_ID\)/, "navigation drops the selected account");
  assert.match(context, /url\.searchParams\.set\("tour", TOUR_ID\)/, "navigation drops the selected Tour");
  assert.doesNotMatch(context, /DEMO_TOUR_ID/, "an account with no Tour still substitutes the demo Tour");
  assert.match(context, /MutationObserver/, "links created after shell load do not receive the active context");

  for (const name of [
    "app/home.js", "app/scenes.js", "app/reviews.js", "app/tour.js",
    "app/scene.js", "app/review.js", "app/client-review.js", "app/request.js",
    "app/direction.js", "app/handoff.js", "app/artist.js", "app/shell.js",
  ]) {
    assert.match(read(name), /scopedBody\(/, `${name} does not send the selected account`);
  }
});

test("a successful login runs the Meridian identity boot sequence once", () => {
  const landing = read("app/landing.html");
  const shell = read("app/shell.js");
  const patterns = read("app/design/patterns.css");
  const components = read("app/design/components.css");

  assert.match(landing, /browserStore\.setItem\('meridian:boot-pending', '1'\)/, "login does not request the boot sequence");
  assert.match(shell, /sessionStorage\.removeItem\(BOOT_PENDING_KEY\)/, "the boot request can replay during the session");
  assert.match(shell, /08-boot-screen-object-4k\.svg/, "the boot sequence does not load the production identity object");
  assert.match(shell, /glyph\?\.classList\.add\("m-boot__glyph"\)/, "the boot sequence does not mount the vector object");
  assert.match(shell, /Opening Meridian/, "the boot sequence has no accessible status");
  assert.match(patterns, /width: min\(92vw, 142\.222vh\)/, "the boot object is not the intended viewport scale");
  for (const group of ["horizon", "axis", "paths", "atmospheric-glow", "alignment-point"]) {
    assert.match(patterns, new RegExp(`#${group}`), `the production ${group} group has no motion treatment`);
  }
  assert.match(patterns, /var\(--m-motion-boot\)/, "the identity parts do not share one build duration");
  assert.match(read("app/design/tokens.css"), /--m-motion-boot: 2880ms/, "the build is not three times the original duration");
  assert.match(shell, /reducedMotion \? 120 : 3120/, "the full-motion sequence exits before the build resolves");
  assert.doesNotMatch(shell, /\.gif|\.png|\.webp/, "the boot sequence uses a raster asset");
  assert.match(components, /04-shell-lockup-160-200px\.svg/, "the application shell does not use the production lockup");
  assert.match(patterns, /07-micro-icon-16px\.svg/, "the narrow shell does not use the optical micro mark");
});

// Ruled 2026-08-27. The Scene page has one column and one job: read what was
// asked, see it beside what the tour holds, then ask the client something or
// send the work. No inspector, and nobody picks parts of the direction.
test("the Scene page is one column with the request, the tour facts, and two ways out", () => {
  const source = read("app/scene.js");
  assert.match(source, /Client request/, "Scene does not show the request");
  assert.match(source, /Venues and screens/, "Scene does not show the venue and screen facts");
  assert.match(source, /Note for production, optional/, "Scene does not offer the optional note");
  assert.match(source, /Ask the client a question/, "Scene does not offer the question");
  assert.match(source, /data-send>Send to production/, "Scene does not offer the send");
  assert.doesNotMatch(source, /travels with the brief|Nobody picks parts of it/, "the interface narrates how briefs are assembled");
  assert.doesNotMatch(source, /data-reference="input"/, "the Scene page still takes an upload");
  assert.doesNotMatch(source, /Scene direction for production/, "the note still presents itself as the gating step");
  assert.doesNotMatch(source, /m-workstation__inspector/, "the Scene page still carries an inspector");
  assert.doesNotMatch(source, /data-inspector|m-workstation__tabs/, "the Scene page still carries inspector tabs");
  assert.doesNotMatch(source, /data-paragraph|data-venue/, "the Scene page still asks a person to mark direction or dates");
  assert.doesNotMatch(source, /propose-concepts|Ask Artist Brain/, "the brain still offers ideas from the Scene page");
  assert.match(source, /Artboard V0.*is ready for review/s, "returned artboards are not announced above the Scene workspace");
  assert.match(source, /actions\.innerHTML = "";\s*return;/, "returned artboards still put review at the bottom of the page");
});

test("the Scene workstation lets the center stage scroll independently", () => {
  const patterns = read("app/design/patterns.css");
  const desktop = patterns.match(/@media \(min-width: 64\.01rem\) \{([\s\S]*?)\n\}/)?.[1] || "";
  const stage = desktop.match(/\.m-workstation__stage\s*\{([^}]*)\}/)?.[1] || "";
  const canvas = desktop.match(/\.m-workstation__canvas\s*\{([^}]*)\}/)?.[1] || "";
  const editor = desktop.match(/\.m-direction-editor\s*\{([^}]*)\}/)?.[1] || "";
  const editorBody = desktop.match(/\.m-direction-editor__body\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(stage, /min-height:\s*0;/, "the center stage cannot shrink inside the viewport");
  assert.match(stage, /overflow-y:\s*auto;/, "the center stage clips long Scene content instead of scrolling");
  assert.match(canvas, /display:\s*block;/, "the canvas still constrains the editor to the scrollport height");
  assert.match(canvas, /flex:\s*none;/, "the Scene surface is still forced to the viewport height");
  assert.match(canvas, /min-height:\s*100%;/, "a short Scene no longer fills the center stage");
  assert.match(editor, /flex:\s*none;/, "the gray editor surface ends before its Scene content");
  assert.match(editor, /min-height:\s*100%;/, "a short editor no longer fills its canvas");
  assert.match(editorBody, /flex:\s*none;/, "the editor body overflows its gray surface");
});

test("the Scene directory is a quiet list and Scene requests require names", () => {
  const directory = read("app/scenes.js");
  assert.doesNotMatch(directory, /WAITING ON|currentVersion|nextAction/, "Scene cards still repeat lifecycle metadata");
  const request = read("app/request.js");
  assert.match(request, /id="title"[^>]*required/, "Scene name is not required in the request form");
});

test("Reviews shows every Artboard version as a gallery rather than an attention queue", () => {
  const directory = read("app/reviews.js");
  assert.match(directory, /right\.artboard\.artboardVersion - left\.artboard\.artboardVersion/, "the newest Artboard is not first");
  assert.match(directory, /return artboards\.length \? \{ \.\.\.scene, artboards \} : null/, "Scenes without Artboards still create gallery rows");
  assert.match(directory, /Versions will appear here/, "the empty gallery does not explain what will arrive");
  assert.doesNotMatch(directory, /to review|Nothing needs your review|Completed reviews/, "Reviews still reads as an attention queue");
  const review = read("app/review.js");
  assert.match(review, /was approved by the client/, "completed review does not show its exact approved version");
  assert.match(review, /read only/, "completed review still presents itself as an active decision");
});

test("empty states name the job and use the shared visual family", () => {
  const patterns = read("app/design/patterns.css");
  const docs = read("docs/design-system.md");
  for (const pattern of ["m-empty-state", "m-empty-state--action", "m-empty-state--waiting", "m-empty-state--clear", "m-empty-inline"]) {
    assert.match(patterns, new RegExp(`\\.${pattern}`), `design system is missing ${pattern}`);
  }
  assert.match(docs, /answers the question a person brought to the page/, "empty-state guidance starts with storage instead of the person's job");
  assert.match(docs, /colors clarify the kind of moment/, "empty-state color has no semantic restraint");
  assert.doesNotMatch(patterns, /#[0-9a-f]{3,8}/i, "empty-state patterns bypass the token palette");
});

test("empty screens speak to the person holding the work", () => {
  const home = read("app/home.js");
  assert.match(home, /Nothing needs you right now/, "Home does not reassure a person with no assigned work");
  assert.match(home, /Request the first Scene/, "Home does not open the first creative job");

  const scenes = read("app/scenes.js");
  assert.match(scenes, /song, an intro, a transition/, "Scenes does not explain what a Scene can be");
  assert.match(scenes, /One sentence is enough/, "Scenes makes a first request feel heavier than it is");

  const tour = read("app/tour.js");
  assert.match(tour, /What should guide the creative work across the tour/, "Tour Direction empty state does not ask for the direction plainly");
  assert.match(tour, /You can still request and develop Scenes/, "optional themes read like a blocker");

  const scene = read("app/scene.js");
  assert.match(scene, /Dates and venues are added on the tour page/, "Scene does not say where missing dates come from");
  assert.match(scene, /Confirmed playback and screen details are added on the tour page/, "missing setup does not say where it comes from");
  assert.match(scene, /Nothing is needed from you/, "the client Scene never says the work is not waiting on them");

  const request = read("app/request.js");
  assert.match(request, /Attach a photo, a mood image, or a still from another show/, "the request screen does not invite a reference image");

  const review = read("app/review.js");
  assert.match(review, /The exact version will appear here when the work comes back/, "internal review does not explain the production handoff");
  const client = read("app/client-review.js");
  assert.match(client, /You do not need to do anything yet/, "client review does not release the client from an empty queue");
  const handoff = read("app/handoff.js");
  assert.match(handoff, /Send the brief from the Scene/, "handoff does not name where the brief goes out from");
  const artist = read("app/artist.js");
  assert.match(artist, /Build the Artist Brain/, "Artist Brain does not start with the manual research job");
});

test("review decisions lead instead of hiding in a footer", () => {
  const operatorMarkup = read("app/review.html");
  const operator = read("app/review.js");
  const clientMarkup = read("app/client-review.html");
  const client = read("app/client-review.js");
  assert.doesNotMatch(operatorMarkup, /m-action-bar/, "internal review still reserves the footer for its decision");
  assert.doesNotMatch(clientMarkup, /m-action-bar/, "client review still reserves the footer for its decision");
  assert.match(operator, /Decide on Artboard V/, "internal review does not lead with the exact Artboard decision");
  assert.match(operator, /href="#review-feedback"/, "internal review does not offer feedback near the top");
  assert.doesNotMatch(client, /Your work/, "client review still spends its headline on a generic phrase");
  assert.match(client, /Approve Artboard V/, "client review does not offer exact-version approval near the top");
  assert.match(client, /Feedback on Artboard V/, "client feedback does not name the Artboard it affects");
});
