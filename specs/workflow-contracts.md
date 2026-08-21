# Workflow Contracts

> Status: Frozen target-state reference. Revised only by findings from design sprints or fixture work. These are logical payload contracts for product journeys, fixtures, and implementation planning—not yet a machine-readable API specification.

## Purpose

The contracts make boundaries between world-building, governance, configured workflows, production stages, evaluation, approval, and learning explicit. Every contract is serializable, versioned, tenant-scoped, and traceable to an actor or system event.

Contracts are internal architecture unless a user job requires a plain-language representation. Their native field structure should not dictate the interface.

## Shared envelope

Every contract includes:

```yaml
contract_type: production_request
contract_version: 0.2
id: request_042
tenant_id: tenant_pwp_fixture
created_at: 2026-08-02T14:00:00Z
created_by:
  actor_type: human
  actor_id: producer_01
correlation_id: launch_social_042
```

`correlation_id` connects artifacts from one journey without replacing stable identifiers.

## Evidence manifest

Created by intake. Describes evidence without claiming what it means.

Required content:

- source kind and source reference;
- captured files, URLs, pages, or records;
- checksums or immutable version references where possible;
- capture context and actor;
- approval posture of the source collection;
- rights, confidentiality, and expiry when applicable;
- extraction status and failures.

Approval posture distinguishes a migrated approved library from unreviewed evidence. It supplies an explicit intake default; it does not make every extracted assertion approved.

## Entity proposal batch

Created by normalization, inference, import, or human authoring. Contains proposed entities and relationships plus review exceptions.

Required content:

- source evidence manifests;
- candidate entities using the brand-world schema;
- candidate relationships;
- duplicate and contradiction findings;
- confidence for inferred assertions;
- suggested scope and governance metadata;
- fields requiring human resolution;
- normalization and inference method versions.

The batch is proposal-only. Acceptance routes each governable item through a governance event.

## Governance event

Records an attributable state transition.

```yaml
contract_type: governance_event
subject:
  entity_id: asset_package_front
  from_version: 2
  to_version: 3
action: canonical_revision
decision: approved
authority:
  required_role: brand_owner
  actor_id: owner_01
rationale: Updated legal panel and barcode; front geometry unchanged.
supersedes: asset_package_front@2
```

Initial actions include approve, reject, deprecate, supersede, promote to canonical, revise canonical, and remove from canon. The governance service validates actor authority and schema invariants before committing the event.

## Workflow definition

Configured by a system steward or authorized administrator. Defines a reusable client workflow in terms of the user's job and a sequence or graph of stages.

Required content:

- stable workflow identifier and version;
- client-facing name, description, intended role, and outcome;
- required request fields in user language;
- stage definitions and transitions;
- roles and approval route;
- exception paths and recovery states;
- required integrations;
- completion criteria;
- product owner and maintenance status.

A workflow definition must pass the product architecture test in [`../docs/product-development-principles.md`](../docs/product-development-principles.md). It cannot exist only because the architecture supports it.

## Stage definition

Defines one meaningful phase within a workflow.

Required content:

- stable stage identifier and version;
- user or system outcome;
- entry and completion conditions;
- required inputs and expected outputs;
- default policy preset or direct primitive configuration;
- context requirements;
- allowed capabilities and provider restrictions;
- evaluation plan and thresholds;
- human decisions, using plain-language labels;
- approval, exception, and next-stage rules.

Stages may use constrained, hybrid, or editorial presets internally. A stage may also configure the primitives directly. Preset names are not automatically exposed to users.

## Production request

Defines what the user wants from a configured workflow before stage policy compilation.

Required content:

- workflow identifier and version;
- objective and requested deliverables;
- brand, product, audience, channel, format, geography, and campaign scope as applicable;
- requested changes and explicit non-changes;
- provided references and assets;
- deadlines or service constraints;
- intended approval participants;
- human clarifications and unresolved questions.

The request does not normally ask the user to select constrained, hybrid, or editorial policy. Creative latitude is collected only when the workflow makes it a meaningful user decision, in language specific to the job.

## Context manifest

Records the exact brand-brain material selected for one stage and why.

Required content:

- production request, workflow, and stage references;
- entity and relationship version references;
- selection reason for every item;
- scope match and precedence information;
- excluded conflicting or lower-priority material;
- unresolved retrieval warnings;
- retrieval method and version.

The manifest lets a reviewer distinguish “the rule did not exist” from “the rule existed but retrieval missed it.”

## Stage policy snapshot

The immutable execution contract compiled for one stage.

```yaml
contract_type: stage_policy_snapshot
request_id: request_042
workflow:
  id: campaign_launch
  version: 3
stage:
  id: produce_hero
  version: 2
preset: hybrid
context_manifest_id: context_042_hero
decisions:
  required:
    - entity: asset_package_front@3
      handling: locked
      operation: compose_exact
  permitted:
    - capability: generate_scene
      scope: environment_and_casting
  conditional:
    - rule: adult_cast_only
      condition: paid_social
  prohibited:
    - rule: no_floating_package@1
element_handling:
  locked: [asset_package_front@3]
  flexible: [environment, lighting]
allowed_capabilities:
  - generate_scene
  - compose_exact_asset
  - resize_with_safe_area
evaluation_plan:
  - evaluator: locked_element_drift
    kind: deterministic
    blocking: true
  - evaluator: request_fit
    kind: judgment
    weight: 0.30
approval_route: workflow_approver
```

Every decision includes its originating rule, stage configuration, preset default, scope, and rationale. Explicit exceptions record who authorized them. Exceptions cannot bypass system invariants or canonical rules without the required authority.

One job may retain several stage policy snapshots. A snapshot's preset field is optional provenance about its starting configuration, not the operative policy itself.

## Execution plan

Created after stage preflight. Describes an ordered or dependency-linked set of resumable steps.

Required content:

- workflow, stage, and stage policy snapshot references;
- step identifiers and dependencies;
- required capability for each step;
- pinned inputs and expected outputs;
- retry and fallback policy;
- determinism or judgment classification;
- cache and idempotency key where supported;
- approval gates;
- estimated cost class when available.

A plan targets capabilities, not named providers. Provider selection is recorded when a step begins.

## Step result

Records one execution attempt.

Required content:

- execution plan and step reference;
- attempt number and status;
- provider, model, tool, and version;
- exact input references and parameter digest;
- output artifact references;
- start and end time;
- usage and cost;
- failure classification and recovery action;
- substitution from the preferred provider, if any.

Sensitive prompt or provider payload storage may be redacted by tenant policy, but the record retains enough information to explain the operation.

## Artifact manifest

Identifies a produced or composed artifact and how it was made.

Required content:

- source workflow, stage, job, and step results;
- asset URI, media type, checksum, dimensions, and rendition information;
- composition lineage for locked assets;
- generated regions or layers when the medium supports them;
- embedded claims, logos, products, or templates;
- technical validation results;
- rights and usage scope;
- lifecycle if the artifact enters a reusable library.

Composition lineage states whether each locked element was copied, transformed deterministically, or regenerated. Regeneration of a locked element requires a blocking policy exception.

## Evaluation record

Stores findings against a stage policy snapshot and request.

Required content:

- artifact and stage policy snapshot references;
- evaluator type, version, and inputs;
- deterministic findings before judgment findings;
- result per requirement or criterion;
- evidence supporting each failure;
- pass, fail, or needs-human-review outcome;
- blocking and non-blocking distinction;
- evaluator uncertainty where relevant.

Model-based evaluation reports uncertainty and rationale; it does not borrow the schema's epistemic-confidence field for generated artifacts.

## Revision request

Describes a targeted change while protecting everything else.

Required content:

- source artifact and evaluation references;
- requested changes;
- protected non-changes;
- reason and actor;
- stage policy snapshot reference;
- whether recompilation is required;
- affected execution steps.

If stage scope or policy changes, the system compiles a new snapshot. A correction that does not affect policy may reuse the existing snapshot and branch the execution plan.

## Approval event

Records a human decision about an output or guidance proposal.

Required content:

- subject and exact version;
- decision and rationale;
- actor and verified authority;
- approval scope;
- related evaluations and exceptions;
- downstream action or stage transition.

Output approval, guidance approval, and canonical promotion use distinct actions. The interface and API must not collapse them into one generic approval.

## Memory proposal

Created from corrections, repeated preferences, failures, or successful precedents.

Required content:

- supporting workflows, stages, jobs, outputs, evaluations, or corrections;
- proposed entity, relationship, validator, or workflow change;
- epistemic origin and conditional confidence;
- proposed scope;
- contradiction check against approved and canonical material;
- required reviewer and promotion path.

Memory proposals never mutate the brand repository directly.

## Contract invariants

1. Every production artifact resolves to one request, workflow version, stage, and stage policy snapshot.
2. Every job uses exact entity versions, not `latest` pointers after execution begins.
3. Every policy decision resolves to a rule, invariant, stage configuration, preset default, or authorized exception.
4. Every locked asset has composition lineage and an integrity check.
5. Every blocking finding prevents stage approval unless an authorized exception is recorded.
6. Every revision states protected non-changes.
7. Every governance and approval event identifies the authority exercised.
8. No memory proposal changes canon without a separate governance event.
9. No preset name must appear in a user interface unless a validated user decision requires it.

## Journey-first fixture requirements

PWP and Riggg fixtures are product-journey proofs before they are contract test suites. Each fixture begins with:

- a named user and operating context;
- a concrete job and desired outcome;
- what the user knows at the beginning;
- the decisions that genuinely require the user;
- what the configured workflow decides automatically;
- the happy path, exception path, approval, and visible result;
- the value delivered and friction introduced.

The fixture then supplies representative contracts for that journey. The hybrid control test reuses a common stage request and brand-brain snapshot while producing distinct stage policy snapshots, plans, and evaluation order. At least one fixture should include a multi-stage workflow that changes presets without asking the user to operate a mode selector.

Fixtures should settle optional fields, enum values, error formats, contract versioning, and product-language gaps before public APIs are designed.
