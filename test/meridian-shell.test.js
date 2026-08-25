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
});
