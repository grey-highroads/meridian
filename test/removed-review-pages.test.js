import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// The Reviews gallery replaced two pages. This asserts they are gone and that
// nothing a browser is served still points at them.
//
// The check runs against the built output rather than a list of source files,
// because the source list is the thing that goes stale: a page can be dropped
// from the vite inputs and still sit in the tree linking to a dead address, and
// a source scan would either miss it or flag files no browser ever gets. What
// ships is what matters. Ruled 2026-08-27.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const REMOVED = ["review.html", "review.js", "client-review.html", "client-review.js"];

test("the two pages the gallery replaced are out of the tree", () => {
  for (const name of REMOVED) {
    assert.equal(fs.existsSync(path.join(root, "app", name)), false, `app/${name} is still in the tree`);
  }
  const config = fs.readFileSync(path.join(root, "vite.config.js"), "utf8");
  assert.ok(!config.includes("app/review.html"), "the build still names the removed review page");
  assert.ok(!config.includes("app/client-review.html"), "the build still names the removed client page");
});

test("the middleware drops the removed client page and keeps the gallery open to clients", () => {
  const source = fs.readFileSync(path.join(root, "middleware.js"), "utf8");
  const list = source.slice(source.indexOf("CLIENT_PATHS"), source.indexOf("CLIENT_HOME"));
  assert.ok(!list.includes("/client-review"), "a client may still load the removed page");
  assert.ok(!list.includes("/review.html"), "a client may still load the removed review page");
  assert.ok(list.includes('"/reviews.html"'), "a client cannot reach the gallery");
  assert.ok(list.includes('"/reviews.js"'), "a client cannot load the gallery");
});

// Building is slow next to the rest of the suite, so this is the one test that
// does it. It is worth the seconds: it is the only check that reads what a
// browser is actually served.
test("nothing in the built output links to either removed page", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-build-"));
  try {
    execFileSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir"], {
      cwd: root, stdio: "pipe", timeout: 180000,
    });

    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else files.push(full);
      }
    };
    walk(out);
    assert.ok(files.length > 0, "the build produced nothing");

    const pages = files.filter((file) => file.endsWith(".html")).map((file) => path.basename(file));
    assert.ok(pages.includes("reviews.html"), "the gallery was not built");
    for (const name of REMOVED.filter((entry) => entry.endsWith(".html"))) {
      assert.ok(!pages.includes(name), `${name} is still served`);
    }

    // A link to a removed page, in any file a browser receives. "reviews.html"
    // and "reviews.js" contain neither string, so no allowance is needed.
    const offenders = [];
    for (const file of files) {
      if (/\.(png|jpg|jpeg|svg|ico|woff2?)$/.test(file)) continue;
      const body = fs.readFileSync(file, "utf8");
      for (const dead of ["/review.html", "./review.html", "client-review.html", "client-review.js"]) {
        if (body.includes(dead)) offenders.push(`${path.relative(out, file)} links ${dead}`);
      }
    }
    assert.deepEqual(offenders, [], offenders.join("; "));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
