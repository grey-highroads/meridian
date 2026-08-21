# System Architecture

> Status: Frozen target-state reference. Revised only by findings from design sprints or fixture work. This document defines implementation boundaries and responsibilities. It deliberately avoids committing to infrastructure that the fixtures have not yet justified.

Product and architecture decisions in this document are governed by [`product-development-principles.md`](product-development-principles.md). Logical components do not become product surfaces without passing the product architecture test.

## Architectural objective

Build one durable brand-intelligence system that supports two distinct workflows:

1. world-building turns evidence into governed brand knowledge;
2. production turns a request and a frozen view of that knowledge into an evaluated deliverable.

The brand brain is the shared source of truth. Production jobs consume versioned snapshots from it; they do not reconstruct it, and their results do not silently change it.

## Core principles

- **Persist knowledge, snapshot execution.** The brand brain evolves; each job retains the exact entity versions and policy it used.
- **Update from an approved baseline.** New evidence creates a candidate change against the active Brand Brain; it never resets or silently replaces the version production is using.
- **Separate classification from authority.** Domains say what an entity is. Governance role and lifecycle say how production may trust it.
- **Compile policy before each stage.** A workflow stage resolves brand rules and configured creative-control primitives into explicit locks, permissions, conditions, prohibitions, tools, and evaluation priorities.
- **Prefer deterministic operations.** Compose and validate exact material directly. Reserve model-based judgment for qualities that genuinely require judgment.
- **Make every state transition attributable.** Approval, rejection, supersession, correction, and canonical revision are recorded events.
- **Start with OpenAI and keep the boundary replaceable.** OpenAI is the sole initial generative renderer. Models, renderers, storage services, and evaluators still sit behind narrow adapters so later integrations do not change the production contract.
- **Isolate brand data.** Shared code and contracts are reusable; private evidence, canon, assets, jobs, and memory remain tenant-scoped.
- **Start operationally simple.** The first implementation should be a modular system with explicit internal contracts, not a premature network of microservices.

## System boundaries

### The system owns

- the structured brand brain and its version history;
- provenance and governance records;
- registered asset identity and integrity metadata;
- production requests, workflow definitions, compiled stage policy snapshots, and execution plans;
- job state, intermediate artifacts, outputs, and evaluation records;
- approvals, revisions, corrections, and candidate rules;
- provider adapters, validators, and orchestration logic.

### The system integrates with

- client-owned file and digital-asset systems;
- product-information and content systems;
- model and media-generation providers;
- deterministic composition and transformation tools;
- delivery, publishing, and project-management systems;
- identity providers and approval channels.

An integration may remain the system of record for source files. Brand World System stores the identity, version, provenance, constraints, and resolvable location required to use them safely.

### The system does not initially own

- universal digital asset management;
- project management for an entire organization;
- autonomous publishing;
- model training infrastructure;
- a general-purpose visual editor;
- every channel-specific renderer.

## Logical components

### 1. Evidence intake

Accepts documents, files, links, interviews, and structured imports. It creates an evidence manifest, captures source context and rights, computes file integrity metadata, and hands normalized evidence to world-building.

It must not convert ingestion into approval. Each routine intake record carries one file, page, or written source plus its concrete material type, intended use, applicable guidance area, and exclusions. Collections are represented as separate records or one deliberately composed grid, not as an unstructured folder whose contents silently share one instruction.

Declared material type is a claim to verify, not trusted authority. File compatibility is checked before extraction, and synthesis compares the declaration with actual contents. A mismatch becomes a review question rather than silently turning a business deck into cultural inspiration or a reference image into an exact protected asset.

### 2. Normalization and inference

Extracts candidate entities, relationships, contradictions, duplicates, and inferred guidance. It emits proposals with provenance and conditional confidence rather than writing directly to canon.

### 3. Brand repository

Persists entities, immutable versions, relationships, scopes, and their domain-specific content. It exposes queries for current approved material, canonical views, prior versions, evidence, and unresolved proposals.

The repository is the durable center of the system. A graph-shaped model may be useful, but a dedicated graph database is not an architectural requirement. The initial implementation may use relational storage with explicit relationship tables and JSON payloads by entity type.

### 4. Asset registry

Maintains stable asset identity, source references, checksums, renditions, technical metadata, rights, approval, canonical role, and usage relationships. Binary files may live elsewhere.

The registry distinguishes a file from the assertions made about it. Fifty files can support one inferred color rule without duplicating that rule 50 times.

### 5. Governance service

Validates lifecycle and governance invariants, enforces role authority, records approvals and canonical revisions, and creates auditable supersession events.

It is the only component allowed to change canonical status. Production and learning components submit proposals to it.

### 6. Workflow registry

Stores versioned client workflows as user jobs with configured stages, transitions, plain-language decisions, policy defaults, integrations, evaluators, approvals, and exception paths. Workflow definitions are maintained by system stewards or authorized administrators.

The registry is part of the reusable 80 percent; each client build configures only workflows that correspond to real recurring work.

### 7. Production request service

Turns a human or integration request for a configured workflow into a validated production-request contract: outcome, deliverables, audience, channel, scope, constraints, references, requested changes, and approval participants. It does not normally ask the user to select an architectural policy preset.

### 8. Context assembler

Retrieves only the entity versions, evidence, precedents, and rules relevant to the request. Retrieval is scope-aware and records why each item was included.

### 9. Policy compiler

Combines system invariants, brand rules, current workflow-stage configuration, request scope, and authorized exceptions. It resolves conflicts and emits an immutable stage policy snapshot containing:

- required, permitted, conditional, and prohibited decisions;
- locked and flexible elements;
- allowed tools and transformations;
- evaluation order and thresholds;
- approval and escalation requirements.

The compiler blocks execution when binding rules conflict or required assets cannot be resolved.

### 10. Execution planner and orchestrator

Converts the request and current stage policy snapshot into resumable steps. It routes exact work to deterministic tools and judgment-dependent work to model providers. Every step records its inputs, outputs, provider or tool version, duration, and failure state.

### 11. Provider and tool adapters

Wrap model APIs, generation services, image tools, composition engines, and export utilities behind typed capabilities. Policies target capabilities such as `compose_exact_asset` or `generate_scene`, not provider-specific endpoints.

The first renderer adapter targets OpenAI's Images API. Prompt-only production calls `/v1/images/generations`. Jobs with canonical or creative reference images call `/v1/images/edits`. In both paths, the adapter sends the compiler's exact prompt string without rewriting, expanding, or re-summarizing it. The model and API parameters are pinned in installation runtime configuration, not embedded in the generation package or exposed in the production job. The Responses API is excluded from the production path because the Riggg implementation showed that automatic prompt rewriting diluted carefully tuned style anchors and prompt fragments.

Brand Brain synthesis is a separate judgment capability. The intake layer extracts document text and normalizes public pages before calling Chat Completions with structured output. Image sources can accompany that synthesis as evidence. This path creates brand knowledge; it never renders production imagery or receives the compiler's production prompt.

After an approved Brand Brain exists, synthesis operates incrementally. The server retrieves the stored approved result, sends only the new source records with that pinned baseline, and asks for the smallest supported candidate update. Unaffected fields are copied exactly, earlier resolved questions do not reopen, conflicts and declaration mismatches become new review questions, and a field-level comparison identifies affected guidance. The approved baseline remains active until the candidate is reviewed and approved. A broad new source may legitimately affect every section, but that is an explicit candidate change rather than an implicit reset.

Deterministic composition and drift detection are Brand World System tool capabilities, not responsibilities delegated to the renderer. The system generates flexible context through OpenAI, composes exact protected assets through deterministic tooling, and evaluates integrity before judgment-based quality. No initial workflow depends on another renderer adapter.

### 12. Evaluation service

Runs deterministic checks first where possible, then model-based or human evaluation where judgment is necessary. Evaluation order and pass thresholds come from the stage policy snapshot.

The service returns findings and evidence. It does not approve its own output.

### 13. Review and approval

Supports targeted revision, unrequested-change comparison, workflow approval, and canonical change requests. Approving a deliverable and changing canon are deliberately separate actions with different authority.

### 14. Memory recorder

Stores jobs, outputs, evaluations, corrections, decisions, costs, failures, and learned preferences. It may propose candidate rules or positive precedents. It cannot silently promote them.

## Workflow one: world-building

```text
Evidence
  -> intake manifest
  -> normalization
  -> candidate entities and relationships
  -> contradiction and duplicate review
  -> governance decision
  -> versioned brand repository
```

The workflow is proposal-first. Inference remains labeled as inference after approval. Approval permits use; canonical promotion is a separate deliberate decision.

Batch intake uses exception-oriented review. The normal path records batch provenance and system-derived metadata; people resolve only decisions the system cannot make honestly.

## Workflow two: production

```text
Configured workflow + request
  -> current stage
  -> scoped context assembly
  -> stage policy compilation
  -> preflight and conflict resolution
  -> execution plan
  -> deterministic and generative work
  -> policy-aware evaluation
  -> revision, approval, or next stage
  -> output package + memory write-back
```

The job pins its request and workflow version. Each executable stage pins its context selection, entity versions, policy snapshot, and execution plan. A later workflow or brand-brain revision does not alter an in-flight or historical job invisibly.

### What the image prompt is made of

Established 2026-08-18 under ADR 0018. The compiled image prompt carries four authorities, and separating them is what keeps them from arguing with each other in prose order.

- **The scene** owns content: place, subject, moment, and what is happening. It compiles first, as the assignment.
- **The look** owns capture character: light quality, contrast, falloff, grain, tonal response, and what the medium cannot do. It compiles second, because finish has to be settled before the brand material arrives. Looks live in code as a library, are chosen before the scene is written, and brief the scene writer so the scene is authored for the medium rather than handed to it. The human texture floor compiles alongside, describing what a person is made of rather than how the photograph was taken.
- **The world** owns what belongs in the frame: the brand's people, objects, era, places, materials, and which light sources are present and what color they emit. It compiles third from the visual grammar. Declared ambitions compile at full strength.
- **The reference** owns artwork and geometry of a protected asset. It does not own that asset's light, which comes from the scene.

The governing rule behind all of it: this renderer obeys concrete physical facts and ignores abstract description, and an early strong statement defeats a later qualifier. Instructions that cannot change pixels do not belong in the prompt, and two instructions making competing claims about the same property is a design fault rather than something the renderer should arbitrate.

## Durable contracts

The initial contract set is defined in [`../specs/workflow-contracts.md`](../specs/workflow-contracts.md):

- evidence manifest;
- entity proposal batch;
- governance event;
- workflow and stage definition;
- production request;
- context manifest;
- stage policy snapshot;
- execution plan and step result;
- artifact manifest;
- evaluation record;
- revision request;
- approval event;
- memory proposal.

Contracts are logical and serializable. They do not require each component to be a separately deployed service.

## State and transaction boundaries

- Entity versions and governance events are immutable after acceptance.
- A canonical revision commits the replacement version and governed revision event atomically.
- A production stage references immutable snapshots, not mutable queries.
- Execution steps are idempotent where the provider permits it and safe to retry otherwise through explicit attempt records.
- Long-running work persists after every meaningful step and can resume without replaying completed expensive operations.
- When external human review is implemented, it must be a durable waiting state rather than an in-memory pause. External review routing is outside the bootstrap.

## Data layout and isolation

An initial deployment can use four logical stores even if some share one database or object-storage account:

1. **Brand repository:** entity versions, relationships, governance, and scope.
2. **Asset store:** source binaries, renditions, and output artifacts.
3. **Job store:** requests, snapshots, plans, step results, evaluations, and approvals.
4. **Audit and observability store:** append-only events, provider usage, cost, latency, and failures.

Every record is tenant-scoped. Storage paths, encryption context, cache keys, search indexes, logs, and background jobs must preserve that boundary. Sanitized fixtures are separate tenants and contain no client-confidential data.

## Security and authority

- The bootstrap records deliberate governance actions without defining users, roles, or permissions.
- Production deployments must define who may authorize canonical revisions before enforcement is implemented.
- Deliverable approval and canonical revision remain distinct actions regardless of the future authorization model.
- System stewards maintain schemas and propose corrections but do not own client canon.
- Service accounts receive the minimum capability required for their workflow step.
- Provider adapters receive only task-relevant context, not the complete brand brain by default.
- Secrets, provider credentials, and private source URLs never enter prompts or durable public fixtures.

Detailed retention, regional hosting, encryption, export, and deletion policies remain pilot decisions, but the architecture must not prevent tenant portability.

## Initial implementation shape

Begin with a modular application and background worker:

- one API and administration surface;
- one relational database for brand, governance, and job records;
- one object store for evidence, assets, and artifacts;
- one durable job queue;
- one versioned workflow registry;
- provider and deterministic-tool adapters;
- one evaluation pipeline;
- explicit modules matching the logical components above.

This shape minimizes operational overhead while preserving seams that can be separated later. Extraction is justified only by measured scaling, isolation, reliability, or team-ownership needs.

## Failure posture

The system fails closed when:

- binding rules conflict;
- required canonical material is missing or unverifiable;
- a locked asset would need unsupported regeneration;
- approval authority is insufficient;
- provenance required for production cannot be resolved;
- a job's pinned dependency changes before execution without a new snapshot.

Provider failure, rate limits, and timeouts pause or retry the affected step without discarding prior state. A fallback provider may be used only when the policy allows the same capability and the job records the substitution.

## Deferred decisions

The fixtures and first pilot should determine:

- the concrete database schema and indexing strategy;
- whether relationship traversal justifies graph-specific infrastructure;
- which asset store and composition engine to standardize;
- the workflow runtime and queue;
- evaluator calibration and pass thresholds;
- tenant deployment model and retention rules;
- which module, if any, needs independent deployment first.

They must also determine which architecture concepts users need to encounter, which belong only in workflow configuration, and which should remain internal. The current audit lives in [`concept-visibility.md`](concept-visibility.md).
