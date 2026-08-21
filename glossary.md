# Glossary

Shared terminology for the Brand World System. Definitions here are authoritative for all documents in this repository. When a document conflicts with the glossary, the glossary wins until it is deliberately revised.

## The system

**Brand brain.** The persistent, structured, versioned representation of a brand: its entities, relationships, rules, and history. The durable product. Production draws from it; it is never rebuilt per request.

**Brand World System (BWS).** The full system: the brand brain plus the workflows that build it and produce from it.

**World-building workflow.** The workflow that creates, validates, and evolves the brand brain from evidence. Its output is governed brand intelligence, not deliverables.

**Production workflow.** A configured path that helps a user complete a named production job. It contains one or more stages that retrieve relevant brand context, compile policy, generate or compose output, evaluate it, and route revision or approval.

**Workflow stage.** A meaningful phase in a configured workflow with its own outcome, inputs, policy, capabilities, evaluation, and transition rules. A job may move through stages with different creative-control behavior.

**PWP (Product World Preview).** The inference-first reference case. Demonstrates constructing a brand world from incomplete evidence and producing editorially from it. Formerly abbreviated PWB in early drafts; PWP is the standard abbreviation going forward.

**Riggg.** The canon-first reference case. Demonstrates constrained production from explicit, inherited canon: registered assets, locked geometry, exact rules.

**Fixture.** A sanitized, synthetic reference case used to test the schema and policy against a realistic scenario. Fixtures never contain real client-confidential material.

## The entity model

**Entity.** Any discrete item in the brand brain: an asset, claim, rule, character, audience, template, ritual, precedent, or record. Every entity belongs to one primary domain and carries the metadata required by its entity type and the governance dimensions that apply to it.

**Domain.** What kind of knowledge an entity represents. Domains classify content only; they confer no authority. The five domains are Foundation, Identity, World, Production, and Memory.

**Foundation.** Domain for durable strategic truths: purpose, positioning, values, audiences, product truths, differentiators, proof points.

**Identity.** Domain for the brand's expressions: logos, assets, characters, colors, typography, voice, terminology, claims, composition rules. (Also called Expression in some drafts; Identity is the standard term.)

**World.** Domain for the brand's lived logic: rituals, environments, behaviors, tensions, materials, cultural signals, narrative territories.

**Production.** Domain for execution rules: channels, formats, templates, technical constraints, workflow defaults, approval thresholds.

**Memory.** Domain for accumulated history: jobs, outputs, evaluations, corrections, approvals, rejections, preferences, costs, failures.

## Authority and governance dimensions

Each dimension is independent. An entity's position in one dimension implies nothing about another, except where an invariant says so. Not every dimension applies to every entity; the schema defines requirements and defaults by entity type.

**Governance role.** Whether an entity is identity-defining. Values: **canonical** (identity-defining, production-binding, change-controlled) or **contextual** (useful material without identity-defining force). Canon is the set of all canonical entities across every domain; it is a governed view, not a container or domain.

**Lifecycle.** Where an entity stands in review. Values: **proposed**, **approved**, **rejected**, **deprecated**, **superseded**. Approval clears an entity for use within its scope. Approval does not make an entity canonical.

**Production effect.** What a scoped production rule or entity-policy relationship requires of production. Values: **required**, **permitted**, **conditional**, **prohibited**. Production effects carry scope and rationale. A prohibition is a rule whose production effect is prohibited; the rule itself may be canonical or merely approved.

**Epistemic origin.** Where an entity came from. Values: **sourced** (taken directly from evidence), **inferred** (concluded from evidence by the system), **authored** (written by a human), **generated** (produced by a model).

**Confidence.** A qualifier expressing how much the system trusts inferred knowledge or a model-generated assertion. Required on inferred knowledge and model-generated assertions or candidate rules. Generated artifacts receive evaluation results rather than epistemic confidence scores.

**Provenance.** The traceable record of an entity's origin: source evidence, author, job, or prior version. Required on every entity.

**Invariants.** Nothing becomes canonical without approval. Approval does not automatically confer canonical status. Canonical changes require a governed revision event. Contextual approved material can be superseded within its scope without canonical change control, but every supersession remains versioned and auditable. Inferred guidance can be approved while remaining explicitly inferred.

## Governance roles (people)

**Brand owner.** Client-side authority who approves foundational and canonical changes. Ultimately owns canon.

**Workflow approver.** Person authorized to approve particular outputs or campaigns without touching canon.

**System steward.** The implementation team (Higher Roads). Proposes schema changes, corrections, and candidate rules; never silently redefines the client's brand.

## Production policy

**Production policy.** The explicit stage-level contract that determines what production requires, permits, conditions, and prohibits; how elements are handled; which capabilities may run; and how evaluation ranks success.

**Policy preset.** A reusable starting configuration over production-policy primitives. Constrained, hybrid, and editorial are presets applied to workflow stages, not global brand types or assumed user-facing choices.

**Constrained preset.** Fidelity to canon outranks novelty. A starting point for packaging, templates, regulated copy, icons, and repeatable formats.

**Editorial preset.** The system may synthesize broadly while expressing the brand's point of view and world logic. A starting point for concepts, stories, scenes, and activations. Editorial does not mean unconstrained.

**Hybrid preset.** Locked canonical elements are placed inside newly generated context. A starting point for stages that combine exact brand material with generative context.

**Bounded element.** An element that may vary only within stated parameters or an approved set.

**Excluded element.** An element unavailable to a stage because it is prohibited, out of scope, unapproved, or unresolved.

**Locked element.** An element a job must reproduce or place without change. Locked elements use deterministic methods whenever possible.

**Protected asset.** The interface term for a registered locked element: an approved file the system places rather than regenerates. Protected names what the system does for the asset; exact names the promise it keeps, which is why preflight says a protected asset stays exact. Contracts and specialist documentation continue to use locked element.

**Flexible element.** An element a job may invent or vary within policy limits.

**Deterministic composition.** Placing, transforming, or compositing an approved asset directly rather than asking a model to regenerate it. Principle: never regenerate a locked asset when it can be composed deterministically.

**Drift.** Unintended deviation from canon in a produced output. Stages with locked elements prioritize drift detection regardless of the preset used.

**Unrequested change.** A revision that alters something the request did not ask to change. Treated as a failure regardless of quality.

## Learning

**Correction.** An explicit human fix to an output. A candidate rule, never an automatic one.

**Candidate rule.** A pattern, preference, or correction proposed for promotion into approved guidance. Promotion always requires human approval.

**Governed revision event.** The recorded, approved act of changing a canonical entity: who, what, why, and what it superseded.
