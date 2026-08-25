import assert from "node:assert/strict";
import test from "node:test";
import { uploadPathFor, uploadPrefix } from "../api/tour-upload.js";

test("reference upload path is scoped to the acting account", () => {
  assert.equal(uploadPrefix("off-the-map-2026","storm-and-lightning", null), "brand-world-system/clients/off-the-map-2026/tour/storm-and-lightning/uploads/");
  assert.equal(uploadPrefix("off-the-map-2026","storm-and-lightning", "dierks-bentley"), "brand-world-system/clients/off-the-map-2026/tour/storm-and-lightning/uploads/");
  assert.equal(uploadPrefix("run-2027","opener", "stagecraft"), "brand-world-system/clients/stagecraft/tours/run-2027/opener/uploads/");
  const demo = uploadPathFor("off-the-map-2026", "storm-and-lightning", "photo.jpg", null, "abc");
  const other = uploadPathFor("run-2027", "opener", "photo.jpg", "stagecraft", "xyz");
  assert.ok(demo.startsWith("brand-world-system/clients/off-the-map-2026/tour/storm-and-lightning/uploads/"));
  assert.ok(other.startsWith("brand-world-system/clients/stagecraft/tours/run-2027/opener/uploads/"));
});
