// Every deployed function must load. A route whose import graph is broken
// fails at cold start with a 500 and nothing in this repo notices, which is
// how /api/blob/upload sat dead from 2026-08-23 to 2026-08-31. This asserts
// effect: each file under api/, and the middleware, imports cleanly.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function routeFiles(directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...routeFiles(full));
    else if (entry.name.endsWith(".js")) found.push(full);
  }
  return found;
}

test("every API function and the middleware import cleanly", async () => {
  const files = [...routeFiles(path.join(root, "api")), path.join(root, "middleware.js")];
  assert.ok(files.length > 1, "no api files found");
  for (const file of files) {
    const loaded = await import(pathToFileURL(file).href);
    assert.equal(typeof loaded.default, "function", `${path.relative(root, file)} has no default handler`);
  }
});
