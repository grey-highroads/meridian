import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ContractValidationError,
  assertValidContract,
  compileProduction,
  contractNames,
  validateAllSchemas,
  validateContract,
} from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fixture(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, "fixtures/compiler", relativePath), "utf8"));
}

function validateFixtureContracts(data, presetNames = ["deliverablePreset"]) {
  assertValidContract("installation-profile", data.trustedInstallationProfile);
  assertValidContract("brand-brain-snapshot-reference", data.brandBrainSnapshot);
  presetNames.forEach((name) => assertValidContract("deliverable-preset", data[name]));
  assertValidContract("job-brief", data.jobBrief);
  data.protectedAssets.forEach((asset) => assertValidContract("protected-production-asset", asset));
  data.supplementalInputs.forEach((input) => assertValidContract("supplemental-production-input", input));
}

function decision(receipt, subjectRef) {
  return receipt.decisions.find((item) => item.subject_ref === subjectRef);
}

function component(generationPackage, id) {
  return generationPackage.components.find((item) => item.id === id);
}

function containsForbiddenAdapterField(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenAdapterField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) => ["provider", "model", "credentials", "api_key"].includes(key) || containsForbiddenAdapterField(child),
  );
}

test("all eight public v1 schemas compile and fixtures validate", () => {
  assert.deepEqual(validateAllSchemas().sort(), contractNames.slice().sort());
  assert.equal(contractNames.length, 8);
  validateFixtureContracts(fixture("slake/production-case.json"));
  validateFixtureContracts(fixture("pwp/production-case.json"));
  validateFixtureContracts(fixture("riggg/policy-control.json"), ["hybridPreset", "constrainedPreset"]);
});

test("the job brief rejects a user-supplied installation_id", () => {
  const data = fixture("slake/production-case.json");
  data.jobBrief.installation_id = "untrusted-user-value";
  const result = validateContract("job-brief", data.jobBrief);
  assert.equal(result.valid, false);
  assert.throws(() => assertValidContract("job-brief", data.jobBrief), ContractValidationError);
});

test("SLAKE compilation enforces authority, protection, exclusions, compatibility, and determinism", () => {
  const data = fixture("slake/production-case.json");
  const first = compileProduction(data);
  const second = compileProduction(data);
  const { generationPackage, resolutionReceipt } = first;

  assert.deepEqual(first, second);
  assert.equal(generationPackage.installation.installation_id, data.trustedInstallationProfile.installation_id);
  assert.equal(Object.isFrozen(generationPackage), true);
  assert.equal(Object.isFrozen(resolutionReceipt), true);

  assert.equal(decision(resolutionReceipt, "medical-wellness-reference").status, "overridden");
  assert.equal(decision(resolutionReceipt, "lead-package-redraw").status, "excluded");
  assert.equal(decision(resolutionReceipt, "lead-package-redraw").influence, "lead");
  assert.equal(decision(resolutionReceipt, "incompatible-typography-reference").status, "excluded");
  assert.equal(decision(resolutionReceipt, "warm-window-reference").status, "included");

  assert.match(generationPackage.compiled_prompt.negative, /glossy spa styling/);
  assert.match(generationPackage.compiled_prompt.negative, /medicinal cues/);
  assert.match(generationPackage.compiled_prompt.positive, /one adult person/);
  assert.doesNotMatch(generationPackage.compiled_prompt.positive, /clinical-white|restorative health claim/i);

  const lighting = component(generationPackage, "lighting_and_composition");
  const warmInstruction = lighting.instructions.find((item) => item.source_ref.startsWith("warm-window-reference/"));
  assert.equal(warmInstruction.influence, "strong");
  assert.equal(warmInstruction.confidence.level, "high");
  const worldGuidance = component(generationPackage, "world_direction").instructions.find((item) => item.source_ref === "slake-four-pm-reset@2");
  assert.equal(worldGuidance.authority, "contextual");
  assert.equal(worldGuidance.lifecycle, "approved");
  assert.equal(worldGuidance.production_effect, "permitted");

  const protectedInput = generationPackage.generation_inputs.find((item) => item.id === "slake-yuzu-can");
  assert.equal(protectedInput.handling, "exact");
  assert.deepEqual(protectedInput.allowed_operations, ["compose_exact"]);
  assert.equal(protectedInput.source.checksum, data.protectedAssets[0].source.checksum);
  assert.equal(generationPackage.generation_inputs.some((item) => item.id === "lead-package-redraw"), false);
});

test("PWP preserves low confidence independently from strong semantic influence", () => {
  const data = fixture("pwp/production-case.json");
  const { generationPackage, resolutionReceipt } = compileProduction(data);
  const input = generationPackage.generation_inputs.find((item) => item.id === "gladiator-wheat-field");
  const resolved = decision(resolutionReceipt, "gladiator-wheat-field");
  const instruction = component(generationPackage, "world_direction").instructions.find((item) => item.source_ref.startsWith("gladiator-wheat-field/"));

  assert.equal(input.influence, "strong");
  assert.equal(input.confidence.level, "low");
  assert.equal(resolved.influence, "strong");
  assert.equal(resolved.confidence.level, "low");
  assert.equal(instruction.influence, "strong");
  assert.equal(instruction.confidence.level, "low");
});

test("scope exclusions and unused protected assets remain traceable", () => {
  const data = fixture("slake/production-case.json");
  data.brandBrainSnapshot.entities.push({
    id: "slake-retail-only-guidance",
    version: "1",
    kind: "knowledge",
    domain: "production",
    name: "Retail-only guidance",
    instruction: "Use the retailer's registered shelf context.",
    governance_role: "contextual",
    lifecycle: "approved",
    current_version: true,
    epistemic_origin: "sourced",
    scope: { channels: ["retail"] },
    provenance: { source_kind: "retail_playbook", source_ref: "slake/retail/playbook-1" },
    component: "world_direction",
  });
  const unusedAsset = structuredClone(data.protectedAssets[0]);
  unusedAsset.asset_id = "slake-unused-can-variant";
  unusedAsset.source.uri = "asset://slake/unused-can-variant.png";
  data.protectedAssets.push(unusedAsset);

  const { resolutionReceipt } = compileProduction(data);
  assert.equal(decision(resolutionReceipt, "slake-retail-only-guidance@1").status, "excluded");
  assert.equal(decision(resolutionReceipt, "slake-unused-can-variant@3").status, "excluded");
});

test("an editorial package may have no external generation inputs", () => {
  const data = fixture("pwp/production-case.json");
  data.supplementalInputs = [];
  const { generationPackage } = compileProduction(data);
  assert.deepEqual(generationPackage.generation_inputs, []);
  assert.match(generationPackage.compiled_prompt.positive, /practical reward shared after a demanding day/);
});

test("the generation package is renderer-neutral and portable across adapters", () => {
  const data = fixture("slake/production-case.json");
  const { generationPackage } = compileProduction(data);
  const adapterA = (pkg) => ({ adapter: "a", package_id: pkg.package_id, prompt: pkg.compiled_prompt });
  const adapterB = (pkg) => ({ adapter: "b", package_id: pkg.package_id, inputs: pkg.generation_inputs });

  assert.equal(containsForbiddenAdapterField(generationPackage), false);
  assert.equal(adapterA(generationPackage).package_id, generationPackage.package_id);
  assert.equal(adapterB(JSON.parse(JSON.stringify(generationPackage))).package_id, generationPackage.package_id);
  assert.equal(JSON.parse(JSON.stringify(generationPackage)).package_id, generationPackage.package_id);
});

test("Riggg policy configuration changes behavior predictably without changing canon", () => {
  const data = fixture("riggg/policy-control.json");
  const snapshotBefore = structuredClone(data.brandBrainSnapshot);
  const hybrid = compileProduction({
    ...data,
    deliverablePreset: data.hybridPreset,
  });
  const constrainedJob = structuredClone(data.jobBrief);
  constrainedJob.preset_ref = { id: data.constrainedPreset.preset_id, version: data.constrainedPreset.version };
  const constrained = compileProduction({
    ...data,
    deliverablePreset: data.constrainedPreset,
    jobBrief: constrainedJob,
  });

  assert.deepEqual(data.brandBrainSnapshot, snapshotBefore);
  assert.deepEqual(hybrid.generationPackage.source_refs.brand_brain_snapshot, constrained.generationPackage.source_refs.brand_brain_snapshot);
  assert.equal(decision(hybrid.resolutionReceipt, "factory-environment-reference").status, "included");
  assert.equal(decision(constrained.resolutionReceipt, "factory-environment-reference").status, "excluded");
  assert.equal(hybrid.generationPackage.renderer_contract.required_capabilities.includes("generate_scene"), true);
  assert.equal(constrained.generationPackage.renderer_contract.required_capabilities.includes("generate_scene"), false);
  assert.equal(constrained.generationPackage.renderer_contract.required_capabilities.includes("apply_bounded_transform"), true);
  assert.deepEqual(
    hybrid.generationPackage.renderer_contract.evaluation_order.slice(0, 2),
    ["asset_integrity", "locked_asset_drift"],
  );
  assert.equal(constrained.generationPackage.renderer_contract.evaluation_order.includes("unrequested_change"), true);
  assert.equal(hybrid.generationPackage.generation_inputs.find((item) => item.id === "riggg-distribution-engine").handling, "exact");
  assert.equal(constrained.generationPackage.generation_inputs.find((item) => item.id === "riggg-distribution-engine").handling, "exact");
});

test("supplemental input schemas reject claims and policy exceptions as reader output", () => {
  const data = fixture("pwp/production-case.json");
  const invalid = structuredClone(data.supplementalInputs[0]);
  invalid.claims = ["An unsupported product claim"];
  invalid.policy_exceptions = ["Ignore the approved positioning"];
  assert.equal(validateContract("supplemental-production-input", invalid).valid, false);
});

test("the SLAKE Brand Brain fixture proves 50-asset intake and separate governance actions", () => {
  const data = JSON.parse(
    fs.readFileSync(path.join(root, "fixtures/pwp/slake-foundational-library.json"), "utf8"),
  );
  const clean = data.assets.filter((asset) => asset.status === "clean");
  const flagged = data.assets.filter((asset) => asset.status === "exception");
  const exceptionTypes = data.exceptions.map((item) => item.type).sort();
  const contextualApproval = data.governance_events.find(
    (item) => item.type === "entity.approved_for_contextual_use",
  );
  const canonPromotion = data.governance_events.find((item) => item.type === "canon.promoted");
  const contradiction = data.exceptions.find((item) => item.type === "contradiction");
  const duplicate = data.exceptions.find((item) => item.type === "suspected_duplicate");
  const suspectedCanon = data.exceptions.find((item) => item.type === "suspected_canon");
  const brandRule = data.rule_proposals.find((item) => item.id === "slake-no-medical-health-claims");

  assert.equal(data.synthetic, true);
  assert.equal(data.batch.asset_count, 50);
  assert.equal(data.assets.length, 50);
  assert.equal(clean.length, 47);
  assert.equal(flagged.length, 3);
  assert.deepEqual(exceptionTypes, ["contradiction", "suspected_canon", "suspected_duplicate"]);
  assert.equal(contextualApproval.changes_canon, false);
  assert.equal(canonPromotion.changes_canon, true);
  assert.equal(canonPromotion.depends_on, contextualApproval.id);
  assert.deepEqual(
    contradiction.resolution_options.map((item) => item.id),
    ["keep-source-a", "keep-source-b", "keep-both", "leave-unresolved"],
  );
  assert.deepEqual(
    duplicate.resolution_options.map((item) => item.id),
    ["keep-file-a", "keep-file-b", "keep-both", "leave-unresolved"],
  );
  assert.deepEqual(
    suspectedCanon.resolution_options.map((item) => item.id),
    ["contextual", "evidence-only", "dismiss-proposal"],
  );
  assert.deepEqual(
    brandRule.resolution_options.map((item) => item.id),
    ["use-rule", "keep-for-later", "discard-suggestion"],
  );
  assert.equal(brandRule.production_effect, "prohibited");
  assert.deepEqual(brandRule.scope.channels, ["paid_social"]);
  assert.deepEqual(brandRule.exceptions, []);
  assert.equal(
    contradiction.resolution_options.find((item) => item.id === "leave-unresolved").production_effect,
    "exclude_conflicted_guidance_only",
  );
  assert.equal(data.bootstrap_scope.identity_and_access, "not_modeled");
  assert.equal(data.bootstrap_scope.external_review_routing, "not_modeled");
  assert.equal(Object.hasOwn(canonPromotion, "actor_role"), false);
});
