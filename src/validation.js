import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schemaDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../schemas/v1");

const schemaFiles = {
  "installation-profile": "installation-profile.schema.json",
  "brand-brain-snapshot-reference": "brand-brain-snapshot-reference.schema.json",
  "deliverable-preset": "deliverable-preset.schema.json",
  "job-brief": "job-brief.schema.json",
  "protected-production-asset": "protected-production-asset.schema.json",
  "supplemental-production-input": "supplemental-production-input.schema.json",
  "generation-package": "generation-package.schema.json",
  "resolution-receipt": "resolution-receipt.schema.json",
};

function readSchema(filename) {
  return JSON.parse(fs.readFileSync(path.join(schemaDirectory, filename), "utf8"));
}

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);

const commonSchema = readSchema("common.schema.json");
ajv.addSchema(commonSchema);

const validators = Object.fromEntries(
  Object.entries(schemaFiles).map(([contract, filename]) => {
    const schema = readSchema(filename);
    ajv.addSchema(schema);
    return [contract, ajv.getSchema(schema.$id)];
  }),
);

export class ContractValidationError extends Error {
  constructor(contract, errors) {
    const detail = errors
      .map((error) => `${error.instancePath || "/"} ${error.message}`)
      .join("; ");
    super(`Invalid ${contract}: ${detail}`);
    this.name = "ContractValidationError";
    this.contract = contract;
    this.errors = errors;
  }
}

export function validateContract(contract, value) {
  const validator = validators[contract];
  if (!validator) throw new Error(`Unknown contract: ${contract}`);
  const valid = validator(value);
  return { valid, errors: valid ? [] : structuredClone(validator.errors ?? []) };
}

export function assertValidContract(contract, value) {
  const result = validateContract(contract, value);
  if (!result.valid) throw new ContractValidationError(contract, result.errors);
  return value;
}

export function validateAllSchemas() {
  return Object.keys(validators);
}

export const contractNames = Object.freeze(Object.keys(schemaFiles));
