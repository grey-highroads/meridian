// Every page under app/ must be a build input, or the deploy serves a 404 for
// a page the repo carries. This asserts effect: the built output contains one
// HTML file for every page-level HTML source.
const test = require("node:test");
const assert = require("node:assert");
const { readdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

test("every app page is a vite input", () => {
  const pages = readdirSync(join(__dirname, "..", "app"))
    .filter((name) => name.endsWith(".html"));
  const config = readFileSync(join(__dirname, "..", "vite.config.js"), "utf8");
  const missing = pages.filter((name) => !config.includes(`app/${name}`));
  assert.deepStrictEqual(missing, [], `pages missing from vite inputs: ${missing.join(", ")}`);
});
