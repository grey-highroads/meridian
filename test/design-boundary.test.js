import assert from "node:assert/strict";
import test from "node:test";
import { inspectDesignBoundary, inspectDesignSource } from "../scripts/check-design-boundary.js";

test("Meridian UI stays inside the design boundary", async () => {
  const violations = await inspectDesignBoundary();
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("the design boundary rejects forbidden presentation code", () => {
  const violations = [
    ...inspectDesignSource("app/new-screen.css", ".example { color: var(--m-text-primary); }"),
    ...inspectDesignSource("app/new-screen.html", "<div style=\"color: red\"></div>"),
    ...inspectDesignSource("app/new-screen.js", "const color = \"#123456\";"),
    ...inspectDesignSource("app/another-screen.js", "node.style.width = '20rem';"),
  ];

  assert.equal(violations.length, 4);
  assert.match(violations[0], /Stylesheets must live in app\/design/);
  assert.match(violations[1], /inline styles/);
  assert.match(violations[2], /hex values/);
  assert.match(violations[3], /script-owned style changes/);
});
