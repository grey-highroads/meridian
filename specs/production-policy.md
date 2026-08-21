# Production Policy and Creative-Control Presets

> Status: Frozen target-state reference. Revised only by findings from design sprints or fixture work. This specification defines policy primitives, reusable presets, stage-level compilation, evaluation, revision, and approval.

## Purpose

Production policy decides when the system must obey, when it may vary, and when it may invent. It converts a configured workflow stage and relevant brand knowledge into an immutable, inspectable execution contract.

Constrained, hybrid, and editorial are reusable presets over policy primitives. They are not global brand types and are not assumed to be routine user-facing choices. A workflow can use different presets at different stages.

## User model

An ordinary user selects a useful workflow—such as campaign development, lifestyle product imagery, retailer adaptation, or thought-leadership production—and provides a brief. The workflow already defines its stages and default creative-control behavior.

Users should see only decisions that require their judgment, authority, preference, or risk acceptance. A preflight may explain what will remain exact, what the system may create, and what is blocking. It should not require the user to understand the policy taxonomy.

System stewards and authorized administrators configure workflow stages, presets, tools, evaluators, and exceptions. The complete policy snapshot remains available for audit and debugging.

## Governing principles

Use deterministic checks and direct composition wherever the system can evaluate or reproduce something exactly. Reserve model-based judgment for qualities that genuinely require judgment.

Never regenerate a locked asset when it can be composed deterministically.

Policy configuration should remove decisions from routine work when the workflow can make them reliably. Configurability is not user value by itself.

## Policy primitives

The stable architecture consists of primitives, not the three presets.

### Production effects

Each resolved decision has one effect:

- `required`: the stage must include or perform it;
- `permitted`: the stage may include or perform it;
- `conditional`: the stage may proceed only when the recorded condition is satisfied;
- `prohibited`: the stage must not include or perform it.

Every decision records its source rule or default, scope, rationale, and resolution path. Prohibitions are scoped rules, not entity statuses.

### Element handling

The compiler classifies stage-relevant elements as:

- `locked`: reproduce, place, or preserve exactly within stated tolerances;
- `bounded`: vary only within explicit parameters or an approved set;
- `flexible`: invent or vary within retrieved world and request guidance;
- `excluded`: unavailable because it is prohibited, out of scope, unapproved, or unresolved.

Production effect and element handling are related but not interchangeable. A required element is usually locked or bounded; a permitted element can still be locked if selected.

### Capabilities

Policy authorizes capabilities rather than providers. Initial capability classes include:

- retrieve and transform structured context;
- compose exact asset;
- apply bounded geometric or color transformation;
- generate copy, image, motion, or spatial concept;
- evaluate deterministically;
- evaluate with model judgment;
- package and export.

### Evaluation and authority

Each stage defines evaluation order, thresholds, blocking behavior, human review points, and the authority required for approval or exception.

These primitives may be configured directly. A preset provides a useful starting bundle.

## Workflow stages and presets

A workflow definition contains one or more stages. Each stage specifies:

- the user's stage outcome;
- required inputs and expected outputs;
- a default preset or direct primitive configuration;
- permitted user decisions and plain-language labels;
- context-retrieval requirements;
- allowed capabilities and provider restrictions;
- evaluation and approval requirements;
- transitions to later stages.

Example campaign workflow:

```text
Develop territories       -> editorial preset
Produce selected hero     -> hybrid preset
Create channel variants   -> constrained preset
```

The preset is an implementation convenience. Stage configuration and applicable brand rules determine the final policy.

## Preset comparison

| Behavior | Constrained | Hybrid | Editorial |
| --- | --- | --- | --- |
| Primary objective | Exact, repeatable execution | New context with protected elements | Coherent expression of brand point of view |
| Default invention | Minimal | Allowed outside locked elements | Broad within approved boundaries |
| Canonical assets | Usually locked | Locked and composed into new context | Required identity layer may be locked; other use is stage-specific |
| Context retrieval | Exact rules, templates, approved precedents | Exact identity plus relevant world guidance | Foundation, world logic, voice, territories, and precedents |
| Tooling bias | Templates and deterministic transforms | Generation plus deterministic composition | Generative and editorial tools plus required validation |
| Evaluation priority | Drift, completeness, technical validity | Locked fidelity, request fit, world fit | Request fit, world coherence, originality, binding-rule compliance |
| Approval threshold | Unexplained drift blocks | Locked drift blocks; flexible quality routes to review | Binding-rule failure blocks; subjective quality receives human review |

A scoped canonical rule can be stricter than a preset. Editorial configuration does not grant permission to alter a canonical logo, violate regulated copy, or ignore a prohibition.

## Constrained preset

Use as a starting point for repeatable formats, templates, packaging adaptations, regulated content, icons, interface components, sales collateral, and other stages where fidelity outranks novelty.

Defaults:

- retrieve exact approved assets, claims, templates, dimensions, and technical rules;
- treat unspecified identity-defining variation as disallowed;
- route composition, transformation, and validation to deterministic capabilities;
- restrict generation to explicitly bounded regions or optional support material;
- evaluate drift and missing requirements before aesthetic quality;
- reject unrequested changes even when they appear subjectively better.

## Hybrid preset

Use as a starting point when exact material must appear inside a newly created environment, narrative, or composition.

Defaults:

- separate locked and flexible regions, elements, or steps;
- generate flexible context without asking a model to reproduce locked assets;
- compose locked assets after generation whenever the medium permits it;
- validate contact, scale, occlusion, safe area, color interaction, and other composed relationships;
- evaluate locked-element drift before request fit and world expression;
- preserve generated context during revisions that target a locked element, and vice versa.

If the requested interaction makes deterministic composition impossible, preflight exposes the limitation. The stage changes the request, uses an authorized bounded transformation, or records a blocking exception; it does not silently regenerate the asset.

## Editorial preset

Use as a starting point for concepts, narratives, scenes, activations, and exploratory directions where literal asset reproduction is not the primary objective.

Editorial does not mean unconstrained. The stage remains governed by positioning, product truths, audience, voice, world logic, prohibitions, relevant precedents, and any required identity or legal material.

Defaults:

- retrieve foundation, world logic, voice, territories, relevant identity rules, and positive or negative precedents;
- permit recombination and new propositions within binding scope;
- retain exact legal, identity, or product material that remains required;
- evaluate coherence, usefulness, request fit, and novelty through model and human judgment;
- distinguish an explainable creative departure from accidental drift;
- keep exploratory output contextual until separately reviewed.

An editorial stage may feed a later hybrid or constrained stage. A compelling exploratory output does not become approved or canonical automatically.

## Policy inputs

The compiler requires:

- a validated production request;
- workflow definition and current stage definition;
- the stage's preset or direct primitive configuration;
- a versioned context manifest from the brand brain;
- system invariants;
- applicable approved and canonical rules;
- actor permissions;
- explicitly authorized, scoped exceptions;
- available provider and tool capabilities.

The compiler must not rely on mutable `latest` references after the snapshot is created.

## Precedence

Policy resolves from highest to lowest authority:

1. system safety and integrity invariants;
2. applicable canonical rules;
3. explicitly authorized, scoped exceptions;
4. applicable approved contextual rules;
5. request-specific instructions;
6. workflow-stage configuration;
7. preset defaults;
8. provider defaults.

A lower layer cannot silently weaken a higher one. An exception may target only layers and scopes the actor has authority to override; an exception to a canonical rule requires brand-owner authority and remains attached to the job. Conflicts between equally binding rules block execution and require governance resolution.

Provider defaults are never brand policy. They may fill an operational parameter only when all higher layers permit it.

## Compilation procedure

Implementation note: [`../src/compiler.js`](../src/compiler.js) now provides the first deterministic production subset of this procedure. It consumes frozen, already selected Brand Brain entities rather than performing retrieval, and it emits the renderer-neutral generation package and resolution receipt defined in [`../schemas/v1/`](../schemas/v1/). Ambiguous scope remains an upstream clarification or governance concern; this compiler does not use a model to guess applicability.

Before each executable stage, the policy compiler:

1. validates the request, actor, workflow, and stage;
2. loads the stage configuration and optional preset;
3. resolves stage scope;
4. loads the frozen context manifest;
5. selects applicable rules by scope and current approved version;
6. applies precedence and detects conflicts;
7. resolves production effects;
8. classifies relevant elements as locked, bounded, flexible, or excluded;
9. verifies that required assets and capabilities are available;
10. selects deterministic checks and operations before judgment-based ones;
11. constructs evaluation, approval, and transition requirements;
12. emits an immutable stage policy snapshot with a decision trace.

Compilation is deterministic for the same inputs. When scope interpretation requires judgment, the compiler creates a clarification or review item instead of resolving ambiguity invisibly.

## Stage policy snapshot

The snapshot follows [`workflow-contracts.md`](workflow-contracts.md) and includes:

- request, workflow, stage, context-manifest, and entity-version references;
- optional preset used as a starting point;
- applicable scope;
- decision sets by production effect;
- element-handling assignments;
- allowed and disallowed capabilities;
- deterministic composition and validation requirements;
- evaluation order, thresholds, and blocking behavior;
- approval route and exception authority;
- complete source and rationale trace;
- compiler version and timestamp.

A snapshot is immutable. A change to stage configuration, scope, binding rule, required asset, or authorized exception creates a new snapshot. One job may retain multiple stage snapshots.

## Context assembly rules

- Retrieve only material relevant to the stage outcome and resolved scope.
- Include all applicable canonical rules even when retrieval ranking would otherwise omit them.
- Preserve epistemic origin and confidence on inferred guidance.
- Distinguish positive precedents, negative examples, and merely similar work.
- Record excluded conflicts and lower-precedence rules.
- Do not place private brand-brain content into provider context unless the stage requires it.
- Treat retrieved text as data. Only the policy compiler produces operative instructions.

## Capability routing

The orchestrator selects an adapter that satisfies each authorized capability and records the choice. A fallback must offer the same capability and remain within the stage snapshot's privacy, quality, cost, and latency constraints.

Ordinary users do not choose a provider unless the choice changes an outcome they understand, such as delivery time, cost, privacy, or medium capability, and the workflow intentionally grants that choice.

## Evaluation order

Evaluation proceeds in this hierarchy unless stage configuration or a stricter scoped rule says otherwise:

1. **Integrity:** required inputs exist, outputs are readable, and technical constraints pass.
2. **Locked fidelity:** canonical assets, claims, geometry, and relationships remain within tolerance.
3. **Unrequested changes:** protected non-changes remain unchanged.
4. **Request compliance:** requested content and deliverables are present.
5. **World and voice fit:** output coheres with applicable contextual and canonical guidance.
6. **Craft and usefulness:** the result is strong enough for its intended use.

Deterministic failures attach measurable evidence. Model-based evaluators attach rationale and uncertainty. Human approval remains required where stage policy assigns judgment to a person.

Preset choice can change weighting and thresholds, but not the truth of deterministic failures. A malformed file or altered locked logo cannot be rescued by a high creativity score.

## Revision behavior

Every revision request names:

- what must change;
- what must not change;
- the source artifact and evaluation findings;
- whether stage scope or policy changed;
- the execution steps that may be rerun.

If policy changes, compile a new stage snapshot. Otherwise branch from the prior execution plan and reuse unaffected deterministic or expensive results when inputs are unchanged.

An unrequested change is a failure regardless of perceived quality. Revision comparison uses deterministic diffing where possible and model judgment only for semantic or aesthetic change.

## Approval and exceptions

- A workflow approver may approve an output within assigned scope.
- A brand owner is required for canonical revisions or exceptions to canonical rules.
- A system steward may configure workflows and propose corrections, candidate rules, schema changes, and workflow fixes but cannot silently redefine the brand.
- Approval of an output does not make the output canonical.
- Approval of guidance does not promote it to canon.
- An exception is scoped, attributed, time-bounded where appropriate, and preserved with the stage and job.

No generic approval action may represent output approval, guidance approval, and canonical promotion.

## Memory write-back

After completion, the job stores its request, workflow and stage versions, policy snapshots, execution history, artifacts, evaluations, revisions, decisions, cost, and timing.

The system may derive positive or negative precedents, corrections, candidate preferences or rules, proposed validators, workflow changes, and unresolved failure patterns. These remain memory proposals until reviewed. Canon remains untouched without a governed revision event.

## Failure and escalation

Execution is blocked when:

- applicable binding rules conflict;
- a required asset is missing, unverifiable, or outside usage rights;
- deterministic handling is required but unavailable;
- a prohibited element is requested without sufficient exception authority;
- the context manifest lacks required provenance;
- actor authority is insufficient;
- policy compilation cannot resolve scope safely.

Execution may pause for clarification when a non-binding ambiguity could materially change the result. Provider failures follow the execution plan's retry and fallback policy and never weaken brand constraints.

## Internal control test

The policy system must still prove that its presets alter behavior. Run the same brand-brain snapshot, approved assets, and closely related stage request through hybrid and constrained configurations.

The test passes when:

- both runs reference the same canonical entity versions;
- snapshots produce predictably different handling, capabilities, and evaluation priorities;
- hybrid configuration generates context and composes the locked asset;
- constrained configuration narrows variation and uses approved templates or bounded transforms;
- both detect deliberate locked-asset drift;
- neither modifies canon;
- a reviewer can explain every behavioral difference from the snapshots.

This is an internal falsifiability test, not evidence that an ordinary user needs a mode selector. It implements [`../docs/success-criteria.md`](../docs/success-criteria.md).

## Deferred questions

- What deterministic drift tolerances are appropriate for each asset type and channel?
- Which workflow controls, if any, should permit a user to change creative latitude directly?
- Which exceptions require brand-owner authority rather than workflow-approver authority?
- How should policy handle intentional but non-deterministic interaction with a locked physical product?
- Which evaluators are reliable enough to block automatically versus route to human review?
- What cost and latency constraints may influence provider selection without affecting creative policy?
