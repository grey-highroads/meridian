// Assemble the governed claims set for a production job (ADR 0013).
//
// Two sources, one union:
// 1. Brand-level claims document (approved, prohibited, disclosures),
//    filtered by scope to match the current job.
// 2. Approved product record (approved_claim_language as approved claims,
//    exclusions as prohibited claims), when the job names a product.
//
// The assembly is a union of two reads. Nothing is paraphrased, merged,
// or reconciled.
//
// Fail direction is asymmetric (code review 2026-08-09):
//   approved  -> fail closed (exclude when axis unresolvable)
//   prohibited -> fail open  (include when axis unresolvable)
//   disclosures -> fail closed

import { objectScopeAppliesToJob } from "../scope/resolver.js";

// Imperative-shaped exclusions are instructions, not claims.
//
// The fail direction is deliberate and matches the asymmetry above. Treating
// a real prohibited claim as a directive would drop a hard stop, so the test
// is narrow: only a clearly imperative opening counts. Anything ambiguous
// stays on the prohibited list and gets audited, which costs noise rather
// than safety.
const directiveOpenings = [
  /^\s*(do not|don't|dont|never|avoid|no\b|refrain from|must not|do never)\b/i,
  /^\s*(does not|should not|cannot) (depict|imply|state|claim|suggest|show)\b/i,
];

// Would this entry have applied if the job had named a segment? True only
// when the segment axis is the sole reason it was dropped, so the preflight
// panel reports a missing segment rather than every scope mismatch.
function withheldOnlyForSegment(scope, jobScope) {
  if (!scope?.segment) return false;
  if (jobScope?.segment) return false;
  const withoutSegment = { ...scope };
  delete withoutSegment.segment;
  return objectScopeAppliesToJob(withoutSegment, jobScope, FAIL_CLOSED);
}

/**
 * The segments a client actually uses, derived from the segments declared on
 * their claims entries. Deriving the list from use rather than maintaining a
 * separate registry keeps segments configuration in the same sense as catalog
 * entries, and avoids a management screen for a list that already exists
 * implicitly.
 */
export function listSegments(claimsDocument, activeEntries) {
  const seen = new Map();
  for (const section of ["approved", "prohibited", "disclosures"]) {
    for (const entry of activeEntries(claimsDocument, section)) {
      const scope = section === "disclosures" ? entry.trigger_scope : entry.scope;
      const segment = scope?.segment;
      if (!segment) continue;
      const key = String(segment).toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, { id: key, label: String(segment).trim(), count: 0 });
      seen.get(key).count += 1;
    }
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function isDirective(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return directiveOpenings.some((pattern) => pattern.test(value));
}


const FAIL_CLOSED = { unmatchedAxis: "exclude" };
const FAIL_OPEN   = { unmatchedAxis: "include" };

/**
 * @param {object} options
 * @param {object} options.claimsDocument - The brand-level claims document (from the claims store).
 * @param {object|null} options.product - An approved product record, or null.
 * @param {function} options.activeEntries - Filter function from the claims store: (doc, section) => active entries.
 * @param {object} [options.jobScope] - Normalized job scope from buildJobScope.
 * @returns {{ approved: Array, prohibited: Array, disclosures: Array }}
 */
export function assembleClaimsSet({ claimsDocument, product, activeEntries, jobScope }) {
  const approved = [];
  const prohibited = [];
  const disclosures = [];
  const directives = [];
  // Claims held back because the job names no segment. Fail-closed matching
  // drops these silently, which is correct behavior and confusing to a
  // marketer who wrote the claim and cannot see it. Reporting them lets the
  // preflight panel say what a missing segment left out.
  const withheldForSegment = [];

  // Source one: brand-level claims document.
  if (claimsDocument) {
    for (const entry of activeEntries(claimsDocument, "approved")) {
      if (objectScopeAppliesToJob(entry.scope, jobScope, FAIL_CLOSED)) {
        approved.push({
          text: entry.text,
          source: entry.source_ref || "Brand claims",
          scope: "brand",
          entry_id: entry.id,
        });
      } else if (withheldOnlyForSegment(entry.scope, jobScope)) {
        withheldForSegment.push({
          text: entry.text,
          source: entry.source_ref || "Brand claims",
          segment: entry.scope.segment,
          entry_id: entry.id,
        });
      }
    }
    for (const entry of activeEntries(claimsDocument, "prohibited")) {
      if (objectScopeAppliesToJob(entry.scope, jobScope, FAIL_OPEN)) {
        prohibited.push({
          text: entry.text,
          source: entry.source_ref || "Brand claims",
          scope: "brand",
          entry_id: entry.id,
        });
      }
    }
    for (const entry of activeEntries(claimsDocument, "disclosures")) {
      if (objectScopeAppliesToJob(entry.trigger_scope, jobScope, FAIL_CLOSED)) {
        disclosures.push({
          text: entry.text,
          source: entry.source_ref || "Brand claims",
          trigger_scope: entry.trigger_scope,
          entry_id: entry.id,
        });
      }
    }
  }

  // Source two: approved product record.
  if (product) {
    for (const feature of product.features || []) {
      if (feature.approved_claim_language) {
        approved.push({
          text: feature.approved_claim_language,
          source: `Product: ${product.product_name}, feature: ${feature.name}`,
          scope: "product",
        });
      }
    }
    for (const exclusion of product.exclusions || []) {
      const entry = {
        text: exclusion,
        source: `Product: ${product.product_name}`,
        scope: "product",
      };
      // A product exclusion can be either of two things, and they are not
      // interchangeable. "HIPAA compliant" is a claim string: stating it is
      // the violation, and the auditor can check for it. "Do not depict an
      // app download as necessary" is a directive to the generator: it has
      // no claim to match, and handing it to a claim auditor produces a
      // topic match rather than a finding. See the ADR 0013 amendment of
      // 2026-08-10.
      if (isDirective(exclusion)) directives.push(entry);
      else prohibited.push(entry);
    }
  }

  return { approved, prohibited, disclosures, directives, withheldForSegment };
}
