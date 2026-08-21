import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertValidContract, compileProduction, validateAllSchemas } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function validateBundle(data, presetNames) {
  assertValidContract("installation-profile", data.trustedInstallationProfile);
  assertValidContract("brand-brain-snapshot-reference", data.brandBrainSnapshot);
  presetNames.forEach((name) => assertValidContract("deliverable-preset", data[name]));
  assertValidContract("job-brief", data.jobBrief);
  data.protectedAssets.forEach((asset) => assertValidContract("protected-production-asset", asset));
  data.supplementalInputs.forEach((input) => assertValidContract("supplemental-production-input", input));
}

validateAllSchemas();

for (const relativePath of [
  "fixtures/compiler/slake/production-case.json",
  "fixtures/compiler/pwp/production-case.json",
]) {
  const data = read(relativePath);
  validateBundle(data, ["deliverablePreset"]);
  const result = compileProduction(data);
  assertValidContract("generation-package", result.generationPackage);
  assertValidContract("resolution-receipt", result.resolutionReceipt);
}

const riggg = read("fixtures/compiler/riggg/policy-control.json");
validateBundle(riggg, ["hybridPreset", "constrainedPreset"]);
compileProduction({ ...riggg, deliverablePreset: riggg.hybridPreset });
const constrainedJob = structuredClone(riggg.jobBrief);
constrainedJob.preset_ref = { id: riggg.constrainedPreset.preset_id, version: riggg.constrainedPreset.version };
compileProduction({ ...riggg, deliverablePreset: riggg.constrainedPreset, jobBrief: constrainedJob });

console.log("Validated 8 schemas and 4 compiled fixture runs.");
