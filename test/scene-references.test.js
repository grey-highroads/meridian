import assert from "node:assert/strict";
import test from "node:test";
import { uploadPathFor, uploadPrefix } from "../src/tour/upload-path.js";

test("reference upload path is scoped to the acting account, the demo one included", () => {
  assert.equal(uploadPrefix("off-the-map-2026", "storm-and-lightning", "dierks-bentley"), "brand-world-system/clients/dierks-bentley/tours/off-the-map-2026/storm-and-lightning/uploads/");
  assert.equal(uploadPrefix("run-2027", "opener", "stagecraft"), "brand-world-system/clients/stagecraft/tours/run-2027/opener/uploads/");
  const demo = uploadPathFor("off-the-map-2026", "storm-and-lightning", "photo.jpg", "dierks-bentley", "abc");
  const other = uploadPathFor("run-2027", "opener", "photo.jpg", "stagecraft", "xyz");
  assert.ok(demo.startsWith("brand-world-system/clients/dierks-bentley/tours/off-the-map-2026/storm-and-lightning/uploads/"));
  assert.ok(other.startsWith("brand-world-system/clients/stagecraft/tours/run-2027/opener/uploads/"));
});

// Two accounts naming a tour the same thing keep separate uploads, and a call
// that names no account is refused rather than landing somewhere they share.
test("the same tour id in two accounts gives two upload prefixes, and no account is refused", () => {
  assert.notEqual(
    uploadPrefix("off-the-map-2026", "storm-and-lightning", "dierks-bentley"),
    uploadPrefix("off-the-map-2026", "storm-and-lightning", "stagecraft"),
  );
  assert.throws(() => uploadPrefix("off-the-map-2026", "storm-and-lightning", null), /needs the account it belongs to/);
});
