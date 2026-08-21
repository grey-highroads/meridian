import assert from "node:assert/strict";
import test from "node:test";
import { compileBrandWorldImagePackage } from "../src/production/package.js";
import { getCopyType, defaultCopyOutputsForPlacement, listCopyTypes } from "../src/copy/types.js";
import { auditProducedCopy } from "../src/copy/generate.js";

// A compile-time change tested against only the placement that motivated it
// caused a regression on 2026-08-09. Every test here runs across all five
// placement shapes, not just the social flow the copy contract was built for.

const brain = {
  brandName: "Slake",
  brandDescription: "Sparkling functional beverages",
  guidanceSections: [
    { id: "foundation", name: "Foundation", summary: "Hydration with intent", principles: ["Clean", "Direct"] },
    { id: "identity", name: "Identity", summary: "Confident and warm", principles: ["Warm"] },
    { id: "creative", name: "Creative", summary: "Editorial photography, natural light", principles: ["Natural light"] },
    { id: "voice", name: "Voice", summary: "Peer to peer", principles: ["Plain"] },
    { id: "world", name: "World", summary: "Afternoon kitchens", principles: ["Domestic"] },
    { id: "rules", name: "Rules", summary: "Never clinical", principles: ["No lab imagery"] },
  ],
  artifacts: {
    dossier: {
      guardrails: [{ title: "No clinical", body: "Never show lab settings." }],
      palette: [{ name: "Yuzu", role: "primary" }],
      materials: ["glass", "citrus"],
      desiredFeeling: "bright",
    },
  },
  sources: [],
};

const placementShapes = {
  scene: {
    brief: { scene: "A can on a wooden counter in afternoon light", placement: "Instagram feed", format: "1:1 square", assetType: "scene" },
  },
  salesEnablementWithoutTemplate: {
    brief: { scene: "A device mockup showing the dashboard", placement: "Sales enablement", format: "16:9 landscape", assetType: "scene" },
  },
  salesEnablementWithTemplate: {
    brief: { scene: "A device mockup showing the dashboard", placement: "Sales enablement", format: "16:9 landscape", assetType: "scene" },
    templateAsset: { name: "One pager base", ratio: "16:9", file: {}, fileName: "base.png" },
  },
  brandTemplate: {
    brief: { scene: "A soft gradient surface with open space at the left", placement: "Brand template", format: "16:9 landscape", assetType: "scene" },
  },
  lockedAsset: {
    brief: { scene: "An open bottle beside a glass", placement: "LinkedIn feed", format: "1:1 square", assetType: "product" },
    lockedAsset: { name: "Yuzu can", assetType: "packaging", file: {}, fileName: "can.png", source: { id: "s1", name: "Yuzu can" } },
  },
};

function compile(shape, extra = {}) {
  return compileBrandWorldImagePackage({ approvedBrain: brain, brainVersion: 3, ...placementShapes[shape], ...extra });
}

test("a job with no copy output compiles identically across every placement shape", () => {
  for (const shape of Object.keys(placementShapes)) {
    const withoutArgument = compile(shape);
    const withEmptyCopy = compile(shape, { copyOutputs: [], claimsSet: null });
    assert.deepEqual(withEmptyCopy, withoutArgument, `${shape} changed when an empty copy list was passed`);
    assert.equal("copy" in withoutArgument, false, `${shape} gained a copy key without declaring one`);
  }
});

test("a declared copy output adds a copy contract without disturbing the rest of the package", () => {
  const claimsSet = {
    approved: [{ text: "Reduces no-shows by 30 percent", source: "Product: Reminders", scope: "product" }],
    prohibited: [{ text: "FDA cleared", source: "Brand claims", scope: "brand" }],
    disclosures: [{ text: "Results vary by organization.", source: "Brand claims" }],
  };
  for (const shape of Object.keys(placementShapes)) {
    const baseline = compile(shape);
    const withCopy = compile(shape, { copyOutputs: ["social_caption"], claimsSet });

    const { copy, ...rest } = withCopy;
    assert.deepEqual(rest, baseline, `${shape} changed outside the copy key`);
    assert.equal(copy.declared[0].copyTypeId, "social_caption");
    assert.equal(copy.governingClaims.approved.length, 1);
    assert.equal(copy.governingClaims.prohibited.length, 1);
    assert.equal(copy.governingClaims.disclosures.length, 1);
    assert.deepEqual(copy.produced, []);
  }
});

test("a declared copy output with no claims still compiles a contract, empty", () => {
  const withCopy = compile("scene", { copyOutputs: ["social_caption"], claimsSet: null });
  assert.equal(withCopy.copy.declared.length, 1);
  assert.deepEqual(withCopy.copy.governingClaims.approved, []);
  assert.deepEqual(withCopy.copy.governingClaims.prohibited, []);
});

test("the copy catalog is data, and social placements default to a caption", () => {
  assert.equal(getCopyType("social_caption").id, "social_caption");
  // headline_set was added to the catalog on 2026-08-10. An id the catalog
  // does not carry still returns null.
  assert.equal(getCopyType("one_sheet_prose"), null);
  assert.equal(getCopyType("not_a_type"), null);
  assert.equal(listCopyTypes().length >= 1, true);
  assert.deepEqual(defaultCopyOutputsForPlacement("Instagram feed"), ["social_caption"]);
  assert.deepEqual(defaultCopyOutputsForPlacement("LinkedIn feed"), ["social_caption"]);
  assert.deepEqual(defaultCopyOutputsForPlacement("Sales enablement"), []);
  assert.deepEqual(defaultCopyOutputsForPlacement("Brand template"), []);
});

test("caption length guidance follows the placement rather than a per-channel copy type", () => {
  const type = getCopyType("social_caption");
  const linkedin = type.lengthGuidance({ placement: "LinkedIn feed" });
  const instagram = type.lengthGuidance({ placement: "Instagram feed" });
  const unknown = type.lengthGuidance({ placement: "Somewhere new" });
  assert.match(linkedin, /150 and 300 words/);
  assert.match(instagram, /40 and 120 words/);
  assert.match(unknown, /\d+ and \d+ words/);
});

// The three audit states have to be distinguishable by the interface. An
// audit that could not run must never look like a clean pass.
test("an empty claims set reports no_claims rather than a clean pass", async () => {
  const audit = await auditProducedCopy({
    text: "We help hospitals reach patients where they already are.",
    claimsSet: { approved: [], prohibited: [], disclosures: [] },
    apiKey: "unused",
  });
  assert.equal(audit.status, "no_claims");
  assert.deepEqual(audit.findings, []);
  assert.match(audit.message, /nothing to check/);
});

test("a missing required disclosure is a finding even with no claims to audit", async () => {
  const audit = await auditProducedCopy({
    text: "We help hospitals reach patients where they already are.",
    claimsSet: { approved: [], prohibited: [], disclosures: [{ text: "Results vary by organization.", source: "Brand claims" }] },
    apiKey: "unused",
  });
  assert.equal(audit.status, "no_claims");
  assert.equal(audit.findings.length, 1);
  assert.equal(audit.findings[0].kind, "disclosure");
  assert.equal(audit.findings[0].rule, "Results vary by organization.");
});

test("a present disclosure produces no finding", async () => {
  const audit = await auditProducedCopy({
    text: "We reach patients where they are. Results vary by organization.",
    claimsSet: { approved: [], prohibited: [], disclosures: [{ text: "Results vary by organization.", source: "Brand claims" }] },
    apiKey: "unused",
  });
  assert.deepEqual(audit.findings, []);
});

test("an audit that cannot reach the model reports errored, not clean", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
  };
  try {
    const audit = await auditProducedCopy({
      text: "Our platform reduces no-shows by 30 percent.",
      claimsSet: {
        approved: [{ text: "Reduces no-shows by 30 percent", source: "Product" }],
        prohibited: [],
        disclosures: [],
      },
      apiKey: "unused",
    });
    assert.equal(audit.status, "errored");
    assert.notEqual(audit.status, "governed");
    assert.match(audit.message, /has not been checked/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an audit the model answers unparseably reports errored, not clean", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: "I cannot do that." } }] }),
  });
  try {
    const audit = await auditProducedCopy({
      text: "Our platform reduces no-shows by 30 percent.",
      claimsSet: {
        approved: [{ text: "Reduces no-shows by 30 percent", source: "Product" }],
        prohibited: [],
        disclosures: [],
      },
      apiKey: "unused",
    });
    assert.equal(audit.status, "errored");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("findings name the governing rule in the brand's own words, not a match code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify([
            { sentence: "Our FDA cleared platform is trusted.", classification: "prohibited", match: "P1", reason: "States a regulatory clearance." },
            { sentence: "We reduce no-shows by 30 percent.", classification: "approved", match: "A1", reason: "Matches approved language." },
            { sentence: "We are the only platform anyone needs.", classification: "unapproved", match: null, reason: "Comparative claim not on either list." },
            { sentence: "Hospitals send many messages daily.", classification: "description", match: null, reason: "Context." },
          ]),
        },
      }],
    }),
  });
  try {
    const audit = await auditProducedCopy({
      text: "irrelevant, the model response is stubbed",
      claimsSet: {
        approved: [{ text: "Reduces no-shows by 30 percent", source: "Product" }],
        prohibited: [{ text: "FDA cleared", source: "Brand claims" }],
        disclosures: [],
      },
      apiKey: "unused",
    });
    assert.equal(audit.status, "governed");
    assert.equal(audit.findings.length, 2);

    const violation = audit.findings.find((f) => f.severity === "violation");
    assert.equal(violation.kind, "prohibited");
    assert.equal(violation.rule, "FDA cleared");
    assert.equal(violation.sentence, "Our FDA cleared platform is trusted.");

    const review = audit.findings.find((f) => f.severity === "review");
    assert.equal(review.kind, "unapproved");
    assert.equal(review.rule, null);

    assert.equal(audit.totals.prohibited, 1);
    assert.equal(audit.totals.approved, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
