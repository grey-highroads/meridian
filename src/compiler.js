import { createHash } from "node:crypto";
import { assertValidContract } from "./validation.js";

export const COMPILER_ID = "brand-world-production-compiler";
export const COMPILER_VERSION = "1.0.0";

const INFLUENCE_ORDER = { lead: 4, strong: 3, supporting: 2, light: 1 };
const SCOPE_MAP = {
  brand_ids: "brand_id",
  product_ids: "product_id",
  channels: "channel",
  placements: "placement",
  formats: "format",
  campaigns: "campaign",
};

export class CompilationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CompilationError";
    this.code = code;
    this.details = details;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function unique(values) {
  return [...new Set(values)];
}

function scopeMatches(ruleScope = {}, jobScope) {
  return Object.entries(SCOPE_MAP).every(([scopeField, jobField]) => {
    const allowed = ruleScope[scopeField];
    return !allowed || (jobScope[jobField] !== undefined && allowed.includes(jobScope[jobField]));
  });
}

function provenance(sourceKind, sourceRef) {
  return { source_kind: sourceKind, source_ref: sourceRef };
}

function assertPinnedVersion(label, version) {
  if (String(version).toLowerCase() === "latest") {
    throw new CompilationError("MUTABLE_REFERENCE", `${label} must use a pinned version, not latest.`);
  }
}

function validateInputs(input) {
  const {
    trustedInstallationProfile,
    brandBrainSnapshot,
    deliverablePreset,
    jobBrief,
    protectedAssets = [],
    supplementalInputs = [],
  } = input;

  assertValidContract("installation-profile", trustedInstallationProfile);
  assertValidContract("brand-brain-snapshot-reference", brandBrainSnapshot);
  assertValidContract("deliverable-preset", deliverablePreset);
  assertValidContract("job-brief", jobBrief);
  protectedAssets.forEach((asset) => assertValidContract("protected-production-asset", asset));
  supplementalInputs.forEach((source) => assertValidContract("supplemental-production-input", source));

  const brandIds = unique([
    trustedInstallationProfile.brand_id,
    brandBrainSnapshot.brand_id,
    deliverablePreset.brand_id,
    jobBrief.scope.brand_id,
    ...protectedAssets.map((asset) => asset.brand_id),
  ]);
  if (brandIds.length !== 1) {
    throw new CompilationError("BRAND_CONTEXT_MISMATCH", "All governed inputs must belong to the trusted installation brand.", { brand_ids: brandIds });
  }

  if (!trustedInstallationProfile.configured_preset_ids.includes(deliverablePreset.preset_id)) {
    throw new CompilationError("UNCONFIGURED_PRESET", `Preset ${deliverablePreset.preset_id} is not configured for this installation.`);
  }
  if (jobBrief.preset_ref.id !== deliverablePreset.preset_id || jobBrief.preset_ref.version !== deliverablePreset.version) {
    throw new CompilationError("PRESET_REFERENCE_MISMATCH", "The job brief does not reference the supplied preset version.");
  }

  const placement = deliverablePreset.placement_profiles.find((profile) => profile.id === jobBrief.scope.placement);
  if (!placement || !placement.formats.includes(jobBrief.scope.format)) {
    throw new CompilationError("INVALID_OUTPUT_FORMAT", "The requested format is not allowed by the selected placement profile.");
  }

  const requestedCapabilities = deliverablePreset.policy.capabilities.map(({ id }) => id);
  const unavailable = requestedCapabilities.filter((id) => !trustedInstallationProfile.allowed_capabilities.includes(id));
  if (unavailable.length) {
    throw new CompilationError("CAPABILITY_UNAVAILABLE", "The trusted installation does not provide every capability required by the preset.", { unavailable });
  }

  const duplicatedEntityIds = brandBrainSnapshot.entities
    .map((entity) => `${entity.id}@${entity.version}`)
    .filter((ref, index, refs) => refs.indexOf(ref) !== index);
  if (duplicatedEntityIds.length) {
    throw new CompilationError("DUPLICATE_ENTITY_VERSION", "The Brand Brain snapshot contains duplicate entity versions.", { duplicated_entity_refs: unique(duplicatedEntityIds) });
  }

  assertPinnedVersion("Brand Brain", brandBrainSnapshot.brain_version);
  assertPinnedVersion("Deliverable preset", deliverablePreset.version);
  protectedAssets.forEach((asset) => assertPinnedVersion(`Protected asset ${asset.asset_id}`, asset.version));

  return { placement };
}

function instructionRecord({ text, sourceRef, authority, lifecycle, effect, source, confidence, influence, epistemicOrigin }) {
  const record = {
    text,
    source_ref: sourceRef,
    authority,
    production_effect: effect,
    provenance: source,
  };
  if (lifecycle) record.lifecycle = lifecycle;
  if (epistemicOrigin) record.epistemic_origin = epistemicOrigin;
  if (confidence) record.confidence = confidence;
  if (influence) record.influence = influence;
  return record;
}

function compilePrompt(components, negativeInstructions) {
  const positive = components
    .filter((component) => component.id !== "prohibitions" && component.handling !== "excluded")
    .map((component) => {
      const instructions = component.instructions
        .filter((instruction) => instruction.production_effect !== "prohibited")
        .map((instruction) => instruction.text)
        .join(" ");
      return instructions ? `${component.id.toUpperCase().replaceAll("_", " ")}\n${instructions}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  const negative = negativeInstructions.map(({ text }) => text).join("; ");
  return { positive, negative };
}

function receiptSummary(decisions) {
  return ["included", "partially_included", "excluded", "overridden"].reduce(
    (summary, status) => ({ ...summary, [status]: decisions.filter((decision) => decision.status === status).length }),
    {},
  );
}

export function compileProduction(input) {
  const {
    trustedInstallationProfile,
    brandBrainSnapshot,
    deliverablePreset,
    jobBrief,
    protectedAssets = [],
    supplementalInputs = [],
  } = input;
  const { placement } = validateInputs(input);

  const decisions = [];
  const negativeInstructions = [];
  const generationInputs = [];
  const componentPolicies = new Map(deliverablePreset.policy.component_policies.map((policy) => [policy.component, policy]));
  const componentInstructions = new Map();

  function addInstruction(component, order, record) {
    if (!componentInstructions.has(component)) componentInstructions.set(component, []);
    componentInstructions.get(component).push({ order, record });
  }

  const sortedEntities = [...brandBrainSnapshot.entities].sort((a, b) => a.id.localeCompare(b.id));
  const applicableEntities = sortedEntities.filter((entity) => !entity.scope || scopeMatches(entity.scope, jobBrief.scope));
  const inapplicableEntities = sortedEntities.filter((entity) => entity.scope && !scopeMatches(entity.scope, jobBrief.scope));
  const governedRefs = new Set(applicableEntities.flatMap((entity) => [entity.id, `${entity.id}@${entity.version}`]));
  const selectedProtectedAssets = protectedAssets.filter((asset) => jobBrief.protected_asset_refs.includes(asset.asset_id));
  const protectedRefs = new Set(selectedProtectedAssets.flatMap((asset) => [asset.asset_id, `${asset.asset_id}@${asset.version}`]));
  const policyRefs = new Set(deliverablePreset.policy.decisions.map(({ id }) => id));
  const prohibitedTags = new Set(
    applicableEntities
      .filter((entity) => entity.production_effect === "prohibited")
      .flatMap((entity) => entity.semantic_tags ?? []),
  );

  for (const entity of applicableEntities) {
    const authority = entity.governance_role;
    const effect = entity.production_effect ?? (entity.governance_role === "canonical" ? "required" : "permitted");
    const order = entity.governance_role === "canonical" ? 900 : 800;
    const ref = `${entity.id}@${entity.version}`;
    const record = instructionRecord({
      text: entity.instruction,
      sourceRef: ref,
      authority,
      lifecycle: entity.lifecycle,
      effect,
      source: entity.provenance,
      confidence: entity.confidence,
      epistemicOrigin: entity.epistemic_origin,
    });
    addInstruction(entity.component, order, record);
    if (effect === "prohibited") {
      negativeInstructions.push({ text: entity.instruction, source_ref: ref, authority, provenance: entity.provenance });
    }
    decisions.push({
      subject_type: "governed_entity",
      subject_ref: ref,
      status: "included",
      component_ref: entity.component,
      reason: "Applicable approved Brand Brain material was selected by scope.",
      authority,
      lifecycle: entity.lifecycle,
      resolution_basis: "governance_role + lifecycle + scope",
      provenance: entity.provenance,
      ...(entity.confidence ? { confidence: entity.confidence } : {}),
    });
  }

  for (const entity of inapplicableEntities) {
    decisions.push({
      subject_type: "governed_entity",
      subject_ref: `${entity.id}@${entity.version}`,
      status: "excluded",
      component_ref: entity.component,
      reason: "The governed item does not apply to the resolved job scope.",
      authority: entity.governance_role,
      lifecycle: entity.lifecycle,
      resolution_basis: "scope mismatch",
      provenance: entity.provenance,
      ...(entity.confidence ? { confidence: entity.confidence } : {}),
    });
  }

  for (const presetDecision of [...deliverablePreset.policy.decisions].sort((a, b) => a.id.localeCompare(b.id))) {
    const source = provenance("deliverable_preset", `${deliverablePreset.preset_id}@${deliverablePreset.version}/${presetDecision.id}`);
    addInstruction(
      presetDecision.component,
      200,
      instructionRecord({
        text: presetDecision.instruction,
        sourceRef: presetDecision.id,
        authority: "workflow_configuration",
        effect: presetDecision.effect,
        source,
      }),
    );
    if (presetDecision.effect === "prohibited") {
      negativeInstructions.push({ text: presetDecision.instruction, source_ref: presetDecision.id, authority: "workflow_configuration", provenance: source });
      (presetDecision.semantic_tags ?? []).forEach((tag) => prohibitedTags.add(tag));
    }
    decisions.push({
      subject_type: "preset_decision",
      subject_ref: presetDecision.id,
      status: "included",
      component_ref: presetDecision.component,
      reason: "The configured deliverable preset applies this stage decision.",
      authority: "workflow_configuration",
      resolution_basis: "configured production policy",
      provenance: source,
    });
  }

  function resolveJobConstraint(constraint, kind, effect) {
    const conflicts = (constraint.conflicts_with ?? []).filter((ref) => governedRefs.has(ref));
    const source = provenance("job_brief", `${jobBrief.job_id}/${constraint.id}`);
    if (conflicts.length) {
      decisions.push({
        subject_type: kind,
        subject_ref: constraint.id,
        status: "overridden",
        component_ref: constraint.component,
        reason: `The job-level constraint conflicts with higher-authority governed material: ${conflicts.join(", ")}.`,
        authority: "job_direction",
        resolution_basis: "canonical and approved policy precedence",
        provenance: source,
      });
      return;
    }
    addInstruction(
      constraint.component,
      700,
      instructionRecord({ text: constraint.instruction, sourceRef: constraint.id, authority: "job_direction", effect, source, epistemicOrigin: "authored" }),
    );
    if (effect === "prohibited") {
      negativeInstructions.push({ text: constraint.instruction, source_ref: constraint.id, authority: "job_direction", provenance: source });
    }
    decisions.push({
      subject_type: kind,
      subject_ref: constraint.id,
      status: "included",
      component_ref: constraint.component,
      reason: "The explicit job constraint is binding within the resolved policy.",
      authority: "job_direction",
      resolution_basis: "authorized explicit constraint",
      provenance: source,
    });
  }

  jobBrief.requirements.forEach((constraint) => resolveJobConstraint(constraint, "job_requirement", "required"));
  jobBrief.exclusions.forEach((constraint) => resolveJobConstraint(constraint, "job_exclusion", "prohibited"));

  const protectedById = new Map(protectedAssets.map((asset) => [asset.asset_id, asset]));
  for (const assetRef of jobBrief.protected_asset_refs) {
    const asset = protectedById.get(assetRef);
    if (!asset) {
      throw new CompilationError("MISSING_PROTECTED_ASSET", `Required protected asset ${assetRef} was not supplied.`);
    }
    const ref = `${asset.asset_id}@${asset.version}`;
    const text = `Use ${asset.label} as the source of truth with ${asset.handling.mode} handling. Preserve ${asset.protected_elements.join(", ")}. Allowed operations: ${asset.handling.allowed_operations.join(", ")}.`;
    addInstruction(
      "protected_subject",
      650,
      instructionRecord({ text, sourceRef: ref, authority: "protected_asset_handling", effect: "required", source: asset.provenance, epistemicOrigin: "sourced" }),
    );
    generationInputs.push({
      id: asset.asset_id,
      input_type: "protected_asset",
      role: "protected_subject",
      handling: asset.handling.mode,
      source: asset.source,
      provenance: asset.provenance,
      protected_elements: asset.protected_elements,
      allowed_operations: asset.handling.allowed_operations,
    });
    decisions.push({
      subject_type: "protected_asset",
      subject_ref: ref,
      status: "included",
      component_ref: "protected_subject",
      reason: `The selected protected asset is emitted with ${asset.handling.mode} handling and integrity metadata.`,
      authority: "protected_asset_handling",
      resolution_basis: "explicit protected-subject path",
      provenance: asset.provenance,
    });
  }

  for (const asset of protectedAssets.filter((candidate) => !jobBrief.protected_asset_refs.includes(candidate.asset_id))) {
    decisions.push({
      subject_type: "protected_asset",
      subject_ref: `${asset.asset_id}@${asset.version}`,
      status: "excluded",
      component_ref: "protected_subject",
      reason: "The protected asset was supplied to the compiler but was not selected by the job brief.",
      authority: "protected_asset_handling",
      resolution_basis: "job protected_asset_refs",
      provenance: asset.provenance,
    });
  }

  const reservedCreativeTags = new Set(["claim", "policy_exception"]);
  const sortedSupplementalInputs = [...supplementalInputs].sort((a, b) => {
    const influenceDifference = INFLUENCE_ORDER[b.influence] - INFLUENCE_ORDER[a.influence];
    return influenceDifference || a.input_id.localeCompare(b.input_id);
  });

  for (const sourceInput of sortedSupplementalInputs) {
    const candidateComponents = sourceInput.intended_components.filter((component) => {
      const policy = componentPolicies.get(component);
      return (
        policy?.accepts_creative_influence &&
        policy.handling === "flexible" &&
        policy.compatible_roles.includes(sourceInput.role) &&
        policy.compatible_source_types.includes(sourceInput.source.type)
      );
    });
    const sourceRef = `${sourceInput.input_id}/${sourceInput.reader.id}@${sourceInput.reader.version}`;

    if (!candidateComponents.length) {
      decisions.push({
        subject_type: "supplemental_input",
        subject_ref: sourceInput.input_id,
        status: "excluded",
        reason: "No intended component accepts this source type and role under the configured policy; influence cannot change compatibility.",
        authority: sourceInput.authority_class,
        resolution_basis: "component compatibility",
        influence: sourceInput.influence,
        confidence: sourceInput.confidence,
        provenance: sourceInput.provenance,
        included_evidence_refs: [],
        excluded_evidence_refs: sourceInput.evidence.map(({ id }) => id),
      });
      continue;
    }

    const acceptedEvidence = [];
    const rejectedEvidence = [];
    for (const evidence of sourceInput.evidence) {
      const compatible = evidence.compatible_components.some((component) => candidateComponents.includes(component));
      const authorityConflict = evidence.conflicts_with.some((ref) => governedRefs.has(ref) || protectedRefs.has(ref) || policyRefs.has(ref));
      const semanticConflict = evidence.semantic_tags.some((tag) => prohibitedTags.has(tag) || reservedCreativeTags.has(tag));
      if (!compatible || authorityConflict || semanticConflict) rejectedEvidence.push(evidence);
      else acceptedEvidence.push(evidence);
    }

    if (!acceptedEvidence.length) {
      decisions.push({
        subject_type: "supplemental_input",
        subject_ref: sourceInput.input_id,
        status: "overridden",
        component_ref: candidateComponents[0],
        reason: "All reader evidence conflicts with governed policy, protected handling, or the rule that creative evidence cannot introduce claims or exceptions.",
        authority: sourceInput.authority_class,
        resolution_basis: "authority and protected-handling precedence",
        influence: sourceInput.influence,
        confidence: sourceInput.confidence,
        provenance: sourceInput.provenance,
        included_evidence_refs: [],
        excluded_evidence_refs: rejectedEvidence.map(({ id }) => id),
      });
      continue;
    }

    for (const evidence of acceptedEvidence) {
      const component = evidence.compatible_components.find((item) => candidateComponents.includes(item));
      const text = `${sourceInput.usage_instruction} Reader evidence: ${evidence.observation}`;
      if (sourceInput.authority_class === "negative_evidence") {
        negativeInstructions.push({ text: `Differentiate away from ${evidence.observation}`, source_ref: sourceRef, authority: "negative_evidence", provenance: sourceInput.provenance });
      } else {
        addInstruction(
          component,
          400 + INFLUENCE_ORDER[sourceInput.influence],
          instructionRecord({
            text,
            sourceRef,
            authority: "creative_evidence",
            effect: "permitted",
            source: sourceInput.provenance,
            confidence: sourceInput.confidence,
            influence: sourceInput.influence,
          }),
        );
      }
    }

    generationInputs.push({
      id: sourceInput.input_id,
      input_type: sourceInput.authority_class,
      role: sourceInput.role,
      handling: "flexible",
      source: sourceInput.source,
      provenance: sourceInput.provenance,
      influence: sourceInput.influence,
      confidence: sourceInput.confidence,
      usage_instruction: sourceInput.usage_instruction,
      evidence_refs: acceptedEvidence.map(({ id }) => id),
    });
    decisions.push({
      subject_type: "supplemental_input",
      subject_ref: sourceInput.input_id,
      status: rejectedEvidence.length ? "partially_included" : "included",
      component_ref: candidateComponents[0],
      reason: rejectedEvidence.length
        ? "Compatible evidence was included; conflicting or incompatible evidence was omitted without changing the source confidence."
        : "Compatible reader evidence was applied to its intended flexible component.",
      authority: sourceInput.authority_class,
      resolution_basis: "semantic compatibility, then influence among compatible evidence",
      influence: sourceInput.influence,
      confidence: sourceInput.confidence,
      provenance: sourceInput.provenance,
      included_evidence_refs: acceptedEvidence.map(({ id }) => id),
      excluded_evidence_refs: rejectedEvidence.map(({ id }) => id),
    });
  }

  const components = [...new Set([...componentPolicies.keys(), ...componentInstructions.keys()])]
    .sort()
    .map((id) => {
      const policy = componentPolicies.get(id);
      const instructions = (componentInstructions.get(id) ?? [])
        .sort((a, b) => b.order - a.order || a.record.source_ref.localeCompare(b.record.source_ref))
        .map(({ record }) => record);
      return instructions.length ? { id, handling: policy?.handling ?? "flexible", instructions } : null;
    })
    .filter(Boolean);

  const dedupedNegativeInstructions = negativeInstructions.filter(
    (instruction, index, all) => all.findIndex((candidate) => candidate.text === instruction.text && candidate.source_ref === instruction.source_ref) === index,
  );
  const compiledPrompt = compilePrompt(components, dedupedNegativeInstructions);
  if (!compiledPrompt.positive) {
    throw new CompilationError("EMPTY_GENERATION_DIRECTION", "Compilation produced no positive generation direction.");
  }

  const packageCore = {
    schema_version: "1.0.0",
    compiler: { id: COMPILER_ID, version: COMPILER_VERSION },
    installation: {
      installation_id: trustedInstallationProfile.installation_id,
      profile_version: trustedInstallationProfile.profile_version,
      core_version: trustedInstallationProfile.core_version,
    },
    source_refs: {
      brand_brain_snapshot: { id: brandBrainSnapshot.snapshot_id, version: brandBrainSnapshot.brain_version, digest: brandBrainSnapshot.content_digest },
      deliverable_preset: { id: deliverablePreset.preset_id, version: deliverablePreset.version },
      job_brief: { id: jobBrief.job_id, version: jobBrief.schema_version },
    },
    output_specification: {
      output_type: deliverablePreset.output_type,
      deliverable_preset: { id: deliverablePreset.preset_id, version: deliverablePreset.version, label: deliverablePreset.label },
      placement_profile: { id: placement.id, version: placement.version },
      format: jobBrief.scope.format,
      quantity: jobBrief.output.quantity,
      text_policy: jobBrief.output.text_policy,
    },
    components,
    compiled_prompt: compiledPrompt,
    negative_instructions: dedupedNegativeInstructions,
    generation_inputs: generationInputs,
    renderer_contract: {
      required_capabilities: deliverablePreset.policy.capabilities.map(({ id }) => id),
      evaluation_order: deliverablePreset.policy.evaluation_order.map(({ id }) => id),
    },
  };

  const packageId = `generation-package-${digest(packageCore).slice(0, 24)}`;
  const receiptCore = {
    schema_version: "1.0.0",
    package_id: packageId,
    compiler: { id: COMPILER_ID, version: COMPILER_VERSION },
    decisions,
    summary: receiptSummary(decisions),
  };
  const receiptId = `resolution-receipt-${digest(receiptCore).slice(0, 24)}`;
  const generationPackage = { ...packageCore, package_id: packageId, resolution_receipt_ref: receiptId };
  const resolutionReceipt = { ...receiptCore, receipt_id: receiptId };

  assertValidContract("generation-package", generationPackage);
  assertValidContract("resolution-receipt", resolutionReceipt);

  return deepFreeze({ generationPackage, resolutionReceipt });
}
