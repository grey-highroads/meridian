// Every page under app/ must be a build input, or the deploy serves a 404 for
// a page the repo carries. This asserts effect: the vite config names every
// page-level HTML source that exists in the tree.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("every app page is a vite input", () => {
  const pages = fs.readdirSync(path.join(root, "app")).filter((name) => name.endsWith(".html"));
  const config = fs.readFileSync(path.join(root, "vite.config.js"), "utf8");
  const missing = pages.filter((name) => !config.includes(`app/${name}`));
  assert.deepEqual(missing, [], `pages missing from vite inputs: ${missing.join(", ")}`);
});
