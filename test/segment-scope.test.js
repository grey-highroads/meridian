import assert from "node:assert/strict";
import test from "node:test";
import { buildJobScope, objectScopeAppliesToJob, arrayScopeAppliesToJob } from "../src/scope/resolver.js";
import { assembleClaimsSet, listSegments } from "../src/claims/assembly.js";

const FAIL_CLOSED = { unmatchedAxis: "exclude" };
const FAIL_OPEN = { unmatchedAxis: "include" };
const activeEntries = (doc, section) => (doc?.[section] || []).filter((e) => !e.retired_at);

test("the job scope carries a segment and tolerates its absence", () => {
  const withSegment = buildJobScope({ placement: "Sales enablement", segment: "surgery centers" });
  assert.equal(withSegment.segment, "surgery centers");
  const withoutSegment = buildJobScope({ placement: "LinkedIn feed" });
  assert.equal(withoutSegment.segment, null);
});

test("a segment-scoped claim matches a job in that segment and conflicts with another", () => {
  const scope = { segment: "surgery centers" };
  assert.equal(objectScopeAppliesToJob(scope, buildJobScope({ segment: "surgery centers" }), FAIL_CLOSED), true);
  assert.equal(objectScopeAppliesToJob(scope, buildJobScope({ segment: "hospitals" }), FAIL_CLOSED), false);
  // A conflicting segment is a conflict under either posture. Fail direction
  // governs the unresolvable case, not the mismatched one.
  assert.equal(objectScopeAppliesToJob(scope, buildJobScope({ segment: "hospitals" }), FAIL_OPEN), false);
});

// This is the behavior the broadcast case depends on. An approved claim
// written for surgery centers must not appear in a post addressed to nobody
// in particular; a prohibition written for hospitals must still apply.
test("with no segment set, approved claims fail closed and prohibitions fail open", () => {
  const scope = { segment: "surgery centers" };
  const broadcast = buildJobScope({ placement: "LinkedIn feed" });
  assert.equal(objectScopeAppliesToJob(scope, broadcast, FAIL_CLOSED), false);
  assert.equal(objectScopeAppliesToJob(scope, broadcast, FAIL_OPEN), true);
});

test("an unsegmented claim is unaffected by the new axis", () => {
  const scope = { channel: "social" };
  const segmented = buildJobScope({ placement: "LinkedIn feed", segment: "surgery centers" });
  const unsegmented = buildJobScope({ placement: "LinkedIn feed" });
  assert.equal(objectScopeAppliesToJob(scope, segmented, FAIL_CLOSED), true);
  assert.equal(objectScopeAppliesToJob(scope, unsegmented, FAIL_CLOSED), true);
});

test("the array scope format understands segment and audience labels", () => {
  const job = buildJobScope({ placement: "Sales enablement", segment: "surgery centers" });
  assert.equal(arrayScopeAppliesToJob([{ label: "segment", value: "surgery centers" }], job, FAIL_CLOSED), true);
  assert.equal(arrayScopeAppliesToJob([{ label: "audience", value: "hospitals" }], job, FAIL_CLOSED), false);
  assert.equal(arrayScopeAppliesToJob([{ label: "segments", value: "all segments" }], job, FAIL_CLOSED), true);
});

// -------------------------------------------------------------------------
// Assembly
// -------------------------------------------------------------------------

const claimsDocument = {
  approved: [
    { id: "a1", text: "Reduces no-show rates by 30 percent", scope: {} },
    { id: "a2", text: "Coordinates pre-operative instructions across the care team", scope: { segment: "surgery centers" } },
    { id: "a3", text: "Integrates with enterprise EHR deployments", scope: { segment: "hospitals" } },
  ],
  prohibited: [
    { id: "p1", text: "HIPAA compliant", scope: {} },
    { id: "p2", text: "the only platform hospitals use", scope: { segment: "hospitals" } },
  ],
  disclosures: [],
};

test("a segmented job gets that segment's claims and not another segment's", () => {
  const set = assembleClaimsSet({
    claimsDocument,
    product: null,
    activeEntries,
    jobScope: buildJobScope({ placement: "Sales enablement", segment: "surgery centers" }),
  });
  const texts = set.approved.map((c) => c.text);
  assert.equal(texts.includes("Reduces no-show rates by 30 percent"), true);
  assert.equal(texts.includes("Coordinates pre-operative instructions across the care team"), true);
  assert.equal(texts.includes("Integrates with enterprise EHR deployments"), false);
});

test("a broadcast job gets only unsegmented approved claims, and every prohibition", () => {
  const set = assembleClaimsSet({
    claimsDocument,
    product: null,
    activeEntries,
    jobScope: buildJobScope({ placement: "LinkedIn feed" }),
  });
  assert.deepEqual(set.approved.map((c) => c.text), ["Reduces no-show rates by 30 percent"]);
  // Prohibitions fail open, so a segment-scoped prohibition still applies.
  assert.equal(set.prohibited.length, 2);
});

test("a broadcast job reports which claims the missing segment held back", () => {
  const set = assembleClaimsSet({
    claimsDocument,
    product: null,
    activeEntries,
    jobScope: buildJobScope({ placement: "LinkedIn feed" }),
  });
  assert.equal(set.withheldForSegment.length, 2);
  assert.deepEqual(set.withheldForSegment.map((c) => c.segment).sort(), ["hospitals", "surgery centers"]);
});

test("a segmented job reports nothing withheld for the segment it named", () => {
  const set = assembleClaimsSet({
    claimsDocument,
    product: null,
    activeEntries,
    jobScope: buildJobScope({ placement: "Sales enablement", segment: "surgery centers" }),
  });
  // The hospitals claim was dropped by conflict, not by a missing segment, so
  // reporting it as "held back because no segment is set" would be wrong.
  assert.deepEqual(set.withheldForSegment, []);
});

test("the segment list is derived from the segments claims actually use", () => {
  const segments = listSegments(claimsDocument, activeEntries);
  assert.deepEqual(segments.map((s) => s.label), ["hospitals", "surgery centers"]);
  assert.equal(segments.find((s) => s.label === "hospitals").count, 2);
});

test("a client with no segmented claims yields an empty list, so no picker renders", () => {
  assert.deepEqual(listSegments({ approved: [{ id: "a", text: "x", scope: {} }], prohibited: [], disclosures: [] }, activeEntries), []);
  assert.deepEqual(listSegments(null, activeEntries), []);
});
