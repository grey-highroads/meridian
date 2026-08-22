import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the Meridian shell loads the design system and no Brand World System file", () => {
  const shell = fs.readFileSync(path.join(rootPath, "app/index.html"), "utf8");
  const script = fs.readFileSync(path.join(rootPath, "app/scenes.js"), "utf8");

  assert.match(shell, /design\/index\.css/);
  assert.doesNotMatch(shell, /bws-/);
  assert.doesNotMatch(shell, /bws\.css/);
  assert.doesNotMatch(script, /bws-/);
  assert.doesNotMatch(script, /bws\.css/);
});
