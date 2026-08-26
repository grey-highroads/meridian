import assert from "node:assert/strict";
import test from "node:test";

// The module reads the account and tour off the address bar when it loads, so
// the page object it expects is put in place before it is brought in. Nothing
// else in the module touches the browser.
globalThis.window = { location: { search: "?account=dierks-bentley&tour=off-the-map-2026" } };
const { resolveArtifact } = await import("../app/artifact.js");

const AT = { assignmentId: "storm-and-lightning" };

test("work returned inline is shown from the address it came with", async () => {
  let asked = 0;
  const resolved = await resolveArtifact(
    { dataUrl: "data:image/png;base64,AAAA", contentType: "image/png", name: "storm.png" },
    { ...AT, readUpload: async () => { asked += 1; return {}; } },
  );
  assert.equal(resolved.src, "data:image/png;base64,AAAA");
  assert.equal(resolved.contentType, "image/png");
  assert.equal(resolved.name, "storm.png");
  assert.equal(asked, 0, "an inline file went looking for a link it did not need");
});

test("an uploaded file is exchanged for a link that opens, scoped to this Scene", async () => {
  const sent = [];
  const resolved = await resolveArtifact(
    {
      blobPathname: "tours/off-the-map-2026/storm-and-lightning/v2.pdf",
      contentType: "application/pdf",
      name: "storm-v2.pdf",
    },
    {
      ...AT,
      readUpload: async (body) => {
        sent.push(body);
        return { presignedUrl: "https://storage.example/v2.pdf?signed=1" };
      },
    },
  );
  assert.equal(resolved.src, "https://storage.example/v2.pdf?signed=1");
  assert.equal(resolved.contentType, "application/pdf");
  assert.equal(resolved.name, "storm-v2.pdf");

  assert.equal(sent.length, 1);
  assert.equal(sent[0].mode, "read");
  assert.equal(sent[0].pathname, "tours/off-the-map-2026/storm-and-lightning/v2.pdf");
  assert.equal(sent[0].assignmentId, "storm-and-lightning");
  assert.equal(sent[0].tourId, "off-the-map-2026");
  assert.equal(sent[0].accountId, "dierks-bentley");
});

test("drawing markup is wrapped so it can be shown without a round trip", async () => {
  const drawing = `<svg viewBox="0 0 10 10"><rect width="10" height="10" /></svg>`;
  const resolved = await resolveArtifact({ svg: drawing }, AT);
  assert.ok(resolved.src.startsWith("data:image/svg+xml;charset=utf-8,"));
  assert.equal(decodeURIComponent(resolved.src.split(",").slice(1).join(",")), drawing);
  assert.equal(resolved.contentType, "image/svg+xml");
});

test("a read that fails leaves the source empty instead of a link that opens nothing", async () => {
  const resolved = await resolveArtifact(
    { blobPathname: "tours/off-the-map-2026/storm-and-lightning/v3.png", contentType: "image/png", name: "storm-v3.png" },
    { ...AT, readUpload: async () => { throw new Error("That work file could not be opened."); } },
  );
  assert.equal(resolved.src, null);
  assert.equal(resolved.contentType, "image/png");
  assert.equal(resolved.name, "storm-v3.png");

  const missing = await resolveArtifact(
    { blobPathname: "tours/off-the-map-2026/storm-and-lightning/v4.png" },
    { ...AT, readUpload: async () => ({}) },
  );
  assert.equal(missing.src, null);
});
