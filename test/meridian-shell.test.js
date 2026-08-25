import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PAGES = [
  "app/index.html", "app/scenes.html", "app/reviews.html", "app/artist.html",
  "app/tour.html", "app/scene.html", "app/review.html", "app/client-review.html",
  "app/request.html", "app/direction.html", "app/handoff.html",
];
const SCRIPTS = [
  "app/home.js", "app/scenes.js", "app/reviews.js", "app/artist.js",
  "app/tour.js", "app/scene.js", "app/review.js", "app/client-review.js",
  "app/request.js", "app/direction.js", "app/handoff.js", "app/shell.js",
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
  }
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
  for (const category of ["Tour Direction", "Dates and venues", "Playback system", "Production setup", "Themes"]) {
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

test("a successful login runs the temporary Meridian boot sequence once", () => {
  const landing = read("app/landing.html");
  const shell = read("app/shell.js");
  const patterns = read("app/design/patterns.css");

  assert.match(landing, /browserStore\.setItem\('meridian:boot-pending', '1'\)/, "login does not request the boot sequence");
  assert.match(shell, /sessionStorage\.removeItem\(BOOT_PENDING_KEY\)/, "the boot request can replay during the session");
  assert.match(shell, /class=\"m-boot__glyph\"/, "the boot sequence has no vector object");
  assert.match(shell, /Opening Meridian/, "the boot sequence has no accessible status");
  assert.match(patterns, /height: min\(80vh, 80vw\)/, "the boot object is not the intended viewport scale");
  assert.match(patterns, /m-boot-sweep/, "the temporary object has no calibration motion");
  assert.match(patterns, /var\(--m-motion-boot\)/, "the calibration parts do not share one build duration");
  assert.match(read("app/design/tokens.css"), /--m-motion-boot: 2880ms/, "the build is not three times the original duration");
  assert.match(shell, /reducedMotion \? 120 : 3120/, "the full-motion sequence exits before the build resolves");
  assert.doesNotMatch(shell, /\.gif|\.png|\.webp/, "the boot sequence uses a raster asset");
});

test("the Scene workspace keeps the request and applicable direction with the work", () => {
  const source = read("app/scene.js");
  assert.match(source, /Client request/, "Scene main workspace does not show the request");
  assert.match(source, /Tour Direction for this Scene/, "Scene main workspace does not show applicable Tour Direction");
  assert.match(source, /Scene direction for production/, "Scene main workspace does not name the production direction");
  assert.doesNotMatch(source, /tab\("request"|tab\("direction"/, "request or direction still live in the inspector");
  assert.match(source, /tab\("brain".*tab\("setup"/s, "inspector does not contain the optional Brain and Setup tools");
  assert.doesNotMatch(source, /tab\("versions"|Scene versions|What is current/, "Scene versions still occupy the inspector without a job");
  assert.match(source, /Artboard V0.*is ready for review/s, "returned artboards are not announced above the Scene workspace");
  assert.match(source, /actions\.innerHTML = "";\s*return;/, "returned artboards still put review at the bottom of the page");
});

test("the Scene directory is a quiet list and Scene requests require names", () => {
  const directory = read("app/scenes.js");
  assert.doesNotMatch(directory, /WAITING ON|currentVersion|nextAction/, "Scene cards still repeat lifecycle metadata");
  const request = read("app/request.js");
  assert.match(request, /id="title"[^>]*required/, "Scene name is not required in the request form");
});

test("an empty decision queue does not hide completed sample reviews", () => {
  const directory = read("app/reviews.js");
  assert.match(directory, /Past reviews/, "Reviews has no route back into completed work");
  assert.match(directory, /\["Final approved", "Delivered"\]/, "Reviews does not limit recent work to completed review states");
  assert.doesNotMatch(directory, /Open past work/, "the past-review section still reads like a card action");
  assert.match(directory, /Artboard or Scene concept needs your decision/, "the empty queue does not name what is clear");
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
  assert.match(home, /You are clear for now/, "Home does not reassure a person with no assigned work");
  assert.match(home, /Give the tour its first Scene/, "Home does not open the first creative job");

  const scenes = read("app/scenes.js");
  assert.match(scenes, /song, an intro, a transition/, "Scenes does not explain what a Scene can be");
  assert.match(scenes, /One sentence is enough/, "Scenes makes a first request feel heavier than it is");

  const tour = read("app/tour.js");
  assert.match(tour, /Store the director's words as given/, "Tour Direction empty state does not explain why the direction matters");
  assert.match(tour, /Scenes can still be requested and developed/, "optional themes read like a blocker");

  const scene = read("app/scene.js");
  assert.match(scene, /You can shape this Scene from the request/, "Scene does not explain work before Tour Direction arrives");
  assert.match(scene, /You can keep writing the Scene/, "missing setup blocks creative work");

  const review = read("app/review.js");
  assert.match(review, /The exact version will appear here when the work comes back/, "internal review does not explain the production handoff");
  const client = read("app/client-review.js");
  assert.match(client, /You do not need to do anything yet/, "client review does not release the client from an empty queue");
  const handoff = read("app/handoff.js");
  assert.match(handoff, /Freeze the brief before handoff/, "handoff does not name the required first step");
  const artist = read("app/artist.js");
  assert.match(artist, /Build the Brain from real research/, "Artist Brain does not start with the manual research job");
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
