// Scope resolution (roadmap item 3, ADR 0013 step 5).
//
// A single scope-matching module consumed by both the image production
// path (package.js, treatments) and the copy governance path (claims
// assembly). Replaces the inline scopeAppliesToPlacement in package.js
// and the inline scopeMatches in claims/assembly.js.
//
// Two scope formats coexist:
//
// 1. Brain review question scope: an array of entries, each either
//    [label, value] or {label, value}. This is what the brain synthesis
//    emits on scoped rules (e.g., [{label: "channel", value: "paid social"}]).
//
// 2. Claims document scope: a plain object with optional keys
//    (brand_wide, channel, placement, product_id, campaign_id). This is
//    what the claims store uses.
//
// Both are checked against a normalized job scope built from the production
// brief's placement, product, and campaign.
//
// Fail direction is asymmetric by design (code review 2026-08-09):
//
//   unmatchedAxis: "exclude" (fail closed)
//     When a rule declares a scope axis the job cannot evaluate (e.g.,
//     product_id on a job with no product), the rule is excluded. Used
//     for approved claims and disclosures so scoped safe-harbor language
//     does not leak into unscoped jobs.
//
//   unmatchedAxis: "include" (fail open)
//     When a rule declares a scope axis the job cannot evaluate, the rule
//     is included. Used for prohibited claims and brain review question
//     rules so prohibitions apply even when the job lacks context to
//     confirm the axis match. Over-blocking is the safe error.

// ---------------------------------------------------------------------------
// Placement-to-channel mapping
// ---------------------------------------------------------------------------

const placementScopes = {
  "Instagram feed": { channel: "social", platform: "instagram" },
  "Instagram story": { channel: "social", platform: "instagram" },
  "LinkedIn feed": { channel: "social", platform: "linkedin" },
  "Facebook feed": { channel: "social", platform: "facebook" },
  "X feed": { channel: "social", platform: "x" },
  "Threads feed": { channel: "social", platform: "threads" },
  "Pinterest pin": { channel: "social", platform: "pinterest" },
  "TikTok cover": { channel: "social", platform: "tiktok" },
  "YouTube thumbnail": { channel: "social", platform: "youtube" },
  "Website feature": { channel: "web", platform: "website" },
  "Website hero": { channel: "web", platform: "website" },
  "Blog header": { channel: "web", platform: "website" },
  "Email hero": { channel: "email", platform: "email" },
  "Sales enablement": { channel: "sales", platform: "collateral" },
  "Brand template": { channel: "brand", platform: "template" },
  "Presentation slide": { channel: "presentation", platform: "slides" },
  // Paid placements
  "Meta feed ad": { channel: "paid_social", platform: "meta" },
  "Meta story ad": { channel: "paid_social", platform: "meta" },
  "LinkedIn sponsored": { channel: "paid_social", platform: "linkedin" },
  "X promoted": { channel: "paid_social", platform: "x" },
  "Google display": { channel: "display", platform: "google" },
  "Display ad": { channel: "display", platform: "display" },
};

// ---------------------------------------------------------------------------
// Build a normalized job scope from production context
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {string} [options.placement] - The job's placement string (e.g. "Instagram feed").
 * @param {string} [options.productId] - The job's product id.
 * @param {string} [options.campaignId] - The job's campaign id.
 * @param {string} [options.segment] - The job's segment, a subset of audience
 *   (e.g. "surgery centers" within healthcare providers). Optional on every
 *   flow. A broadcast job legitimately has no segment, and the unmatched-axis
 *   posture handles that case rather than the field being required.
 * @returns {{ channel: string|null, platform: string|null, placement: string|null, product_id: string|null, campaign_id: string|null, segment: string|null, unknownPlacement: boolean }}
 */
export function buildJobScope({ placement, productId, campaignId, segment } = {}) {
  const mapped = placementScopes[placement] || null;
  // When a placement string is provided but not found in the map, flag it.
  // Under fail-closed mode this means scoped approved claims are excluded
  // rather than silently included for an unrecognized placement.
  const unknownPlacement = !!(placement && !mapped);
  if (unknownPlacement) {
    console.warn(`[scope/resolver] Placement "${placement}" is not in placementScopes. Scoped rules will use the unmatched-axis posture for this job.`);
  }
  return {
    channel: mapped?.channel || null,
    platform: mapped?.platform || null,
    placement: placement || null,
    product_id: productId || null,
    campaign_id: campaignId || null,
    segment: segment || null,
    unknownPlacement,
  };
}

// ---------------------------------------------------------------------------
// Axis matching with fail-direction control
// ---------------------------------------------------------------------------

// Check one axis. Returns true (axis matches), false (axis conflicts),
// or null (axis is unresolvable because the job lacks it).
function axisResult(ruleValue, jobValue) {
  if (!ruleValue) return true; // Rule does not constrain this axis.
  if (!jobValue) return null;  // Rule constrains it but job cannot evaluate.
  return normalize(ruleValue) === normalize(jobValue);
}

// When an axis is unresolvable, use the mode to decide:
//   "exclude" -> treat null as false (fail closed, entry excluded)
//   "include" -> treat null as true  (fail open, entry included)
function resolveNull(mode) {
  return mode === "include";
}

// ---------------------------------------------------------------------------
// Scope matching: object format (claims document)
// ---------------------------------------------------------------------------

/**
 * @param {object} claimScope - Object with optional keys: brand_wide, channel,
 *   placement, product_id, campaign_id, segment.
 * @param {object} jobScope - Normalized job scope from buildJobScope.
 * @param {object} [options]
 * @param {"include"|"exclude"} [options.unmatchedAxis="include"] - How to treat
 *   scope axes the job cannot evaluate. "include" = fail open (prohibitions),
 *   "exclude" = fail closed (approved claims, disclosures).
 * @returns {boolean}
 */
export function objectScopeAppliesToJob(claimScope, jobScope, options = {}) {
  if (!claimScope || claimScope.brand_wide) return true;
  if (!jobScope) return options.unmatchedAxis !== "exclude";
  const mode = options.unmatchedAxis || "include";

  // Channel axis
  if (claimScope.channel) {
    const result = axisResult(claimScope.channel, jobScope.channel);
    if (result === false) return false;
    if (result === null && !resolveNull(mode)) return false;
  }

  // Placement axis (checks both raw placement string and mapped platform)
  if (claimScope.placement) {
    const claimPlacement = normalize(claimScope.placement);
    const jobPlacement = normalize(jobScope.placement || "");
    const jobPlatform = normalize(jobScope.platform || "");
    if (jobPlacement || jobPlatform) {
      if (claimPlacement !== jobPlacement && !jobPlatform.includes(claimPlacement)) return false;
    } else {
      // Job has no placement data.
      if (!resolveNull(mode)) return false;
    }
  }

  // Product axis
  if (claimScope.product_id) {
    const result = axisResult(claimScope.product_id, jobScope.product_id);
    if (result === false) return false;
    if (result === null && !resolveNull(mode)) return false;
  }

  // Campaign axis
  if (claimScope.campaign_id) {
    const result = axisResult(claimScope.campaign_id, jobScope.campaign_id);
    if (result === false) return false;
    if (result === null && !resolveNull(mode)) return false;
  }

  // Segment axis. Behaves exactly like the others, which means a segment-
  // scoped approved claim is excluded from a job with no segment set. That is
  // the intended behavior on broadcast work: a claim true for surgery centers
  // should not appear in a post addressed to nobody in particular. Because the
  // exclusion is silent by nature, the preflight panel reports what a missing
  // segment left out.
  if (claimScope.segment) {
    const result = axisResult(claimScope.segment, jobScope.segment);
    if (result === false) return false;
    if (result === null && !resolveNull(mode)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Scope matching: array format (brain review questions)
// ---------------------------------------------------------------------------

/**
 * @param {Array} ruleScope - Array of [label, value] or {label, value}.
 * @param {object} jobScope - Normalized job scope from buildJobScope.
 * @param {object} [options]
 * @param {"include"|"exclude"} [options.unmatchedAxis="include"] - Same as
 *   objectScopeAppliesToJob. Default is "include" to preserve the existing
 *   image-path behavior (brain review question rules fail open).
 * @returns {boolean}
 */
export function arrayScopeAppliesToJob(ruleScope, jobScope, options = {}) {
  if (!ruleScope || !ruleScope.length) return true;
  if (!jobScope) return options.unmatchedAxis !== "exclude";
  const mode = options.unmatchedAxis || "include";

  for (const entry of ruleScope) {
    const label = normalize(Array.isArray(entry) ? entry[0] : entry.label || "");
    const value = normalize(Array.isArray(entry) ? entry[1] : entry.value || "");

    if (label === "channel" || label === "channels") {
      if (value === "all channels") continue;
      if (!jobScope.channel) { if (!resolveNull(mode)) return false; continue; }
      if (!value.includes(jobScope.channel)) return false;
    }

    if (label === "placements" || label === "placement") {
      if (value.startsWith("all")) continue;
      if (!jobScope.platform) { if (!resolveNull(mode)) return false; continue; }
      if (!value.includes(jobScope.platform)) return false;
    }

    if (label === "product" || label === "product_id" || label === "products") {
      if (value === "all products") continue;
      if (!jobScope.product_id) { if (!resolveNull(mode)) return false; continue; }
      if (!value.includes(normalize(jobScope.product_id))) return false;
    }

    if (label === "campaign" || label === "campaign_id" || label === "campaigns") {
      if (value === "all campaigns") continue;
      if (!jobScope.campaign_id) { if (!resolveNull(mode)) return false; continue; }
      if (!value.includes(normalize(jobScope.campaign_id))) return false;
    }

    if (label === "segment" || label === "segments" || label === "audience") {
      if (value.startsWith("all")) continue;
      if (!jobScope.segment) { if (!resolveNull(mode)) return false; continue; }
      if (!value.includes(normalize(jobScope.segment))) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Unified entry point
// ---------------------------------------------------------------------------

/**
 * Check whether a scope declaration applies to a job. Detects the format
 * (array or object) and dispatches to the right matcher.
 *
 * @param {Array|object} scope - The rule or claim's scope declaration.
 * @param {object} jobScope - Normalized job scope from buildJobScope.
 * @param {object} [options] - Passed through to the format-specific matcher.
 * @returns {boolean}
 */
export function scopeAppliesToJob(scope, jobScope, options) {
  if (Array.isArray(scope)) {
    return arrayScopeAppliesToJob(scope, jobScope, options);
  }
  return objectScopeAppliesToJob(scope, jobScope, options);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}
