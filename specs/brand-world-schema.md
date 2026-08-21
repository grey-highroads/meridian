# Brand World Schema

> Status: Frozen target-state reference. Revised only by findings from design sprints or fixture work. A machine-readable schema should follow only after the examples and fixtures stabilize it.

## Purpose

The brand-world schema is the implementation-facing model for a persistent brand brain. It defines what the system stores, which facts are binding, where they came from, how they change, and how production may use them.

The model must support both world-building and production without confusing content classification with authority. A logo, ritual, claim, template, correction, and job record are different kinds of knowledge, but any identity-defining entity can be canonical within its own domain.

## Design tests

The schema succeeds only if it can:

- represent incomplete evidence without presenting inference as fact;
- distinguish permission to use something from its identity-defining force;
- bind production to canon without putting canon in a separate content container;
- express prohibitions, exceptions, and channel-specific rules with scope and rationale;
- preserve provenance and revision history without requiring seven manually entered fields on every item;
- register a batch of 50 ordinary assets without inviting lazy or misleading metadata;
- support the same brand brain across workflow stages with constrained, editorial, and hybrid policy presets.

## Model overview

The brand brain contains versioned entities connected by typed relationships. Each entity has:

1. a universal envelope for identity, content, provenance, and versioning;
2. a profile determined by entity type;
3. governance metadata when the entity can be reviewed or made canonical;
4. conditional qualifiers such as confidence or evaluation results only when they are meaningful.

Canon is a governed view across domains, not a domain or container:

```text
Canon = entities where governance_role = canonical
        and lifecycle = approved
        and current_version = true
```

Nothing becomes canonical without approval. Approval does not automatically confer canonical status.

## Domains

Every entity belongs to exactly one primary domain. A domain answers what kind of knowledge the entity represents; it does not confer authority.

| Domain | Purpose | Representative entity types |
| --- | --- | --- |
| Foundation | Durable strategic truths | purpose, value, audience, product truth, differentiator, proof point |
| Identity | Recognizable brand expressions | logo, color, typeface, voice rule, term, claim, character, asset |
| World | Lived and narrative logic | ritual, environment, behavior, tension, material, cultural signal, territory |
| Production | Execution rules and constraints | channel rule, template, format, technical constraint, workflow default |
| Memory | Accumulated operational history | job, output, evaluation, correction, approval, rejection, preference, failure |

Cross-domain meaning is expressed through relationships, not duplicate entities. For example, an Identity package asset can `depict` a World ritual and be `required_by` a Production template.

## Universal entity envelope

Every entity requires the following fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable, opaque identifier |
| `type` | Entity profile used for validation |
| `domain` | One of the five content domains |
| `name` | Human-readable label |
| `content` | Type-specific payload or reference |
| `provenance` | Traceable origin record |
| `created_at` | Creation timestamp |
| `created_by` | Human, system, import, or job actor |
| `version` | Monotonic version identifier |
| `current_version` | Whether this is the active version |

`provenance` must identify at least one source kind and source reference. Examples include an uploaded file and page, a human author, an import record, a production job, or a prior entity version.

The system should populate identifiers, timestamps, actor information, version fields, and import provenance whenever it already knows them. A person should not re-enter system facts.

## Governance dimensions

Governance dimensions are orthogonal. Their values must never be inferred from one another except where an invariant explicitly requires it.

### Governance role

Whether the entity is identity-defining:

- `canonical`: binding in production within scope and subject to governed change;
- `contextual`: useful without identity-defining force.

Default: `contextual`.

### Lifecycle

Where an entity stands in review:

- `proposed`
- `approved`
- `rejected`
- `deprecated`
- `superseded`

Lifecycle is required for governable knowledge, rules, and reusable assets. Imported evidence and immutable job events may instead use their profile's operational state.

No universal lifecycle default is assumed at ingestion. The intake workflow must make the source-specific default explicit: a migrated approved library may import as `approved`; an unreviewed discovery batch must import as `proposed`.

### Epistemic origin

Where the entity's meaning came from:

- `sourced`: taken directly from evidence;
- `inferred`: concluded from evidence;
- `authored`: written or deliberately specified by a human;
- `generated`: produced by a model.

Epistemic origin is required for knowledge, rules, reusable assets, and assertions. It is normally system-populated from the creation path and confirmed during review.

### Production effect

What a scoped rule or entity-policy relationship does to production:

- `required`
- `permitted`
- `conditional`
- `prohibited`

Production effect is not a general entity status. It belongs on a rule or policy relationship and must carry scope and rationale. A prohibited color, phrase, or behavior is represented by a rule whose effect is `prohibited`, not by marking the underlying entity prohibited.

### Confidence

Confidence is required only for inferred knowledge and model-generated assertions or candidate rules. It is not used for generated deliverables; those receive evaluation results.

```yaml
confidence:
  value: 0.82
  method: evidence-weighted-inference-v1
  rationale: Observed in 9 of 11 approved campaign examples.
```

A confidence score must include a method and a human-readable rationale. Precision without a stated basis is not valid confidence.

## Entity profiles

Profiles keep the ontology complete without forcing irrelevant fields onto every entity.

| Profile | Examples | Required beyond envelope | Conditional |
| --- | --- | --- | --- |
| Governable knowledge | purpose, audience, claim, ritual, voice rule | lifecycle, governance role, epistemic origin | confidence when inferred or generated |
| Reusable asset | logo, package render, photo, illustration, template | lifecycle, governance role, epistemic origin, asset reference, integrity metadata | technical metadata by medium |
| Scoped rule | composition rule, channel rule, prohibition | lifecycle, governance role, epistemic origin, production effect, scope, rationale | confidence when inferred or generated; exception handling |
| Evidence | source document, interview, image set | evidence reference, capture context | rights, confidentiality, expiry |
| Production job | request and compiled execution state | request, workflow version, stage policy snapshots, input references, status | costs and model/tool details |
| Generated output | rendered or composed deliverable | job reference, asset reference, generation/composition record, evaluation results | lifecycle if reusable or approvable |
| Memory event | correction, approval, rejection, supersession | subject, actor, timestamp, reason | candidate-rule reference |

## Relationships

Relationships are versioned, scoped assertions between entities. Each relationship requires:

- a stable identifier;
- source and target entity/version references;
- a typed predicate;
- provenance;
- scope when the assertion is not global;
- governance metadata when the relationship itself can bind production.

Initial predicates include `supports`, `contradicts`, `depicts`, `derived_from`, `supersedes`, `approved_for`, `required_by`, `prohibited_by`, `used_in`, `evaluates`, and `corrects`.

Relationships should carry production effect only when they function as policy. Ordinary semantic links must not accidentally become rules.

## Scope

Scope defines where an entity, rule, or policy relationship applies. It may include:

- brand or sub-brand;
- product or product family;
- geography;
- audience;
- channel;
- format;
- campaign;
- date range;
- workflow and stage.

An empty scope means brand-wide only when the entity profile permits it. The interface must label that interpretation clearly; it must never rely on an invisible default for high-risk rules.

## Invariants

Implementations must reject or flag states that violate these rules:

1. A canonical entity must be approved and current.
2. Approval never changes governance role automatically.
3. A canonical revision requires a governed revision event naming the actor, reason, prior version, and replacement.
4. A superseded entity cannot be the current version.
5. Every entity and relationship has provenance.
6. Inferred knowledge and generated assertions have confidence with method and rationale.
7. Generated outputs have evaluations rather than epistemic confidence.
8. Production effect appears only on scoped rules or policy relationships.
9. A prohibition has scope and rationale.
10. A production job stores the resolved policy snapshot used by every executable stage.
11. A locked asset is composed deterministically whenever the requested operation permits it.
12. Learning never silently mutates canon; corrections can create candidate rules, and promotion requires approval.

## Example: valid hybrid-production state

This abbreviated example shows an approved canonical package asset, a contextual world insight, and a scoped prohibition. Fields such as timestamps are omitted only for readability.

```yaml
entities:
  - id: asset_package_front_v3
    type: reusable_asset
    domain: Identity
    name: Citrus Spark package front
    content:
      asset_uri: asset://pwp/package-front-v3.png
      checksum: sha256:5c1d...
      media_type: image/png
    governance_role: canonical
    lifecycle: approved
    epistemic_origin: sourced
    provenance:
      source_kind: approved_asset_library
      source_ref: import_2026_08_01/item_17
    version: 3
    current_version: true

  - id: ritual_after_work_share
    type: ritual
    domain: World
    name: The after-work share
    content:
      description: The product appears as an informal reward shared after a demanding day.
    governance_role: contextual
    lifecycle: approved
    epistemic_origin: inferred
    confidence:
      value: 0.84
      method: evidence-weighted-inference-v1
      rationale: Repeated across interviews and seven approved social posts.
    provenance:
      source_kind: evidence_set
      source_refs: [interviews_q2, social_approved_2025]
    version: 1
    current_version: true

  - id: rule_no_floating_package
    type: scoped_rule
    domain: Production
    name: Package must contact a plausible surface
    content:
      instruction: Do not depict the package floating or unsupported.
    governance_role: canonical
    lifecycle: approved
    epistemic_origin: authored
    production_effect: prohibited
    scope:
      channels: [paid_social, retail_media]
      workflows: [campaign_launch]
      stages: [produce_hero, create_variants]
    rationale: Preserves product realism and prevents a recurring off-brand composition.
    provenance:
      source_kind: brand_owner_decision
      source_ref: decision_2026_07_18
    version: 1
    current_version: true

job:
  id: job_launch_social_042
  type: production_job
  domain: Memory
  request: Create a 4:5 paid-social image for the Citrus Spark launch.
  workflow:
    id: campaign_launch
    version: 3
  stages:
    - id: produce_hero
      preset: hybrid
      locked_entities: [asset_package_front_v3]
      flexible_entities: [ritual_after_work_share]
      policy_snapshot: policy-snapshot://job_launch_social_042/produce_hero
  composition_record:
    asset_package_front_v3: deterministically_composited
```

Why it is valid:

- the package is both approved and canonical;
- the ritual is approved but remains contextual and explicitly inferred;
- the prohibition is a scoped rule with rationale, not an asset status;
- confidence appears only on the inference;
- the job records its workflow, stage configuration, locks, and stage policy snapshot;
- the locked package is composed rather than regenerated.

## Example: invalid state

```yaml
id: asset_master_logo
type: reusable_asset
domain: Identity
governance_role: canonical
lifecycle: proposed
epistemic_origin: generated
production_effect: prohibited
confidence: 0.97
provenance: null
current_version: true
```

This state must fail validation because:

- a proposed entity cannot be canonical;
- production effect does not belong on an ordinary reusable asset;
- the asset cannot prohibit itself without a scoped rule and rationale;
- confidence is malformed and is not the right quality measure for a generated artifact;
- provenance is missing.

## Example: deliberately ambiguous state

A reviewer uploads 50 past campaign images. Forty-two use a deep red accent, but there is no brand-guideline source confirming that the color is identity-defining.

The system should not force a false binary choice at intake. It should:

1. register the files as sourced evidence or reusable assets, using batch provenance and proposed lifecycle where review is required;
2. create one inferred Identity color entity rather than 42 duplicate claims;
3. attach the 42 observations as supporting evidence;
4. keep the color contextual and proposed;
5. require confidence with rationale;
6. offer a separate approval action and a separate canonical-promotion action.

Open review questions are visible rather than buried in metadata:

- Is the color intentional or merely common?
- Is it approved for reuse, or only evidence of past work?
- Does it apply brand-wide, to one campaign, or to one channel?
- Would making it canonical invalidate approved work that uses another accent?

This example is correct while unresolved. Ambiguity is a governed state of knowledge, not a validation failure.

## The Tuesday test: registering 50 assets

For a routine batch, the person registering assets should usually provide only:

- the files or source location;
- a batch label and intended collection;
- whether the source is already approved or still needs review;
- any scope the system cannot infer safely.

The system should derive file metadata, checksums, timestamps, actor, batch provenance, candidate types, and duplicate matches. It may suggest domains, names, and relationships, but suggestions remain reviewable. Confidence appears on inferred assertions, not on every file.

Exceptions receive focused review: conflicting approvals, suspected canonical assets, missing rights, duplicate-but-different files, unsupported formats, and inferred rules. The default path should make honest metadata easier than performative completeness.

## Revision and audit model

- Entity identity persists across revisions; content versions are immutable.
- A new version points to the version it supersedes.
- Contextual approved material may be superseded without canonical change control, but the event remains recorded.
- Canonical changes require brand-owner authorization through a governed revision event.
- Production jobs retain references to the exact entity versions and policy snapshot they used, even after later revisions.
- Deletion is exceptional. Normal removal uses rejection, deprecation, or supersession so historical production remains explainable.

## Machine-readable follow-on

Implementation note: the production-facing subset is now executable under [`../schemas/v1/`](../schemas/v1/). The first subset formalizes the installation profile, pinned Brand Brain snapshot reference, deliverable preset, job brief, protected asset, supplemental input, generation package, and resolution receipt. It does not claim to be the complete persistence schema for every Brand Brain entity or governance event.

The executable snapshot contract accepts only approved, current entity versions because it is an execution input, not an intake or governance payload. Proposed, rejected, deprecated, and superseded knowledge remains representable in the target-state model and belongs upstream of production snapshot creation.

Draft 0.2 should translate stable portions of this model into JSON Schema or an equivalent typed contract. Before that translation, the PWP and Riggg fixtures must each contribute:

- a valid brand-brain slice;
- at least one invalid case and expected error;
- at least one ambiguous case and expected review path;
- a production job with a frozen policy snapshot;
- a governed revision event.

The machine-readable model should encode structural invariants and leave judgment-dependent review questions explicit rather than disguising them as validation rules.

## Open questions

- Which entity types need globally stable identifiers across exported brand brains?
- Should lifecycle apply directly to raw evidence, or should evidence use a smaller operational state model?
- Which scope dimensions are allowed to inherit from a parent collection?
- How should conflicting canonical rules surface before a production job compiles?
- Which confidence methods are permitted, and how are they calibrated across inference types?
- What minimum evaluation record is required before a generated output can become a reusable approved asset?
