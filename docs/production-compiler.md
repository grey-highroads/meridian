# Production Compiler Foundation

## Status

Implemented production foundation. This module compiles governed production context into a portable generation package and an inspectable resolution receipt. It does not render, persist, authenticate, queue, or call a provider.

## Product boundary

The compiler is a framework-independent library under [`../src/`](../src/). It supports the Preflight job defined by the browser prototype without turning that prototype into a production application.

Its inputs are:

1. a trusted isolated-installation profile;
2. a pinned Brand Brain snapshot reference containing candidate frozen entity versions for scoped resolution;
3. a configured deliverable preset;
4. a job brief and its explicit constraints;
5. protected production assets; and
6. supplemental creative inputs containing reader evidence.

Its outputs are:

1. a renderer-neutral generation package; and
2. a resolution receipt explaining every governed item, preset decision, job constraint, protected asset, and supplemental input that was included, partially included, excluded, or overridden.

The generation package is the primary output. A renderer adapter may translate it into a provider request later. Provider, model, credential, retry, and queue fields do not belong in the package.

## Executable contracts

The public contracts are JSON Schema 2020-12 documents under [`../schemas/v1/`](../schemas/v1/):

- `installation-profile.schema.json`
- `brand-brain-snapshot-reference.schema.json`
- `deliverable-preset.schema.json`
- `job-brief.schema.json`
- `protected-production-asset.schema.json`
- `supplemental-production-input.schema.json`
- `generation-package.schema.json`
- `resolution-receipt.schema.json`

All public contracts use `schema_version: 1.0.0`. `common.schema.json` contains shared definitions and is not a ninth public payload.

The schema boundary encodes structural invariants and leaves judgment-dependent questions visible. For example, an inferred Brand Brain entity requires confidence, a scoped rule requires an effect, scope, and rationale, and an exact protected asset must allow exact composition. The schemas do not pretend to judge whether an image is aesthetically compatible.

## Trusted installation context

`compileProduction` accepts the installation profile through the explicitly named `trustedInstallationProfile` argument. The job brief schema rejects `installation_id`. The compiler also verifies that the Brand Brain snapshot, preset, brief, and protected assets all belong to the installation's configured brand and that the preset and requested capabilities are installed.

This is a trust boundary, not authentication. A production host is responsible for loading the installation profile from server-owned configuration before invoking the compiler.

## Resolution behavior

Resolution follows authority and scope before creative influence:

1. applicable canonical Brand Brain material;
2. applicable approved contextual material;
3. explicit job requirements and exclusions;
4. exact or bounded protected-asset handling;
5. compatible supplemental evidence, ordered semantically by `lead`, `strong`, `supporting`, and `light`; and
6. configured preset defaults.

The implementation preserves distinct fields for governance authority, lifecycle, production effect, epistemic origin, semantic influence, confidence, provenance, and asset handling. None is derived from another.

Supplemental readers emit evidence. A reader does not assign governance authority, relax a protected asset, add a claim, or create a policy exception. Supplemental input schemas reject claim and exception fields. Evidence tagged as a claim or policy exception is deterministically overridden during resolution.

Compatibility is explicit. A deliverable preset declares which flexible components accept which source types and roles. Reader evidence declares the components it can support. Influence is considered only after those declarations agree. If interpreting scope or compatibility would require model judgment, the upstream workflow must create a clarification or reviewed evidence record rather than asking this compiler to guess.

## Determinism and portability

The compiler sorts governed sources and supplemental evidence before assembly, uses content-derived package and receipt identifiers, and emits no wall-clock timestamp. Identical inputs produce byte-equivalent plain objects and stable IDs. Returned objects are deeply frozen to prevent an adapter from changing the resolved policy in memory.

Every source reference is pinned. The compiler rejects the mutable version label `latest` for Brand Brain, preset, and protected asset versions.

## Using the library

```js
import { compileProduction } from "brand-world-system";

const { generationPackage, resolutionReceipt } = compileProduction({
  trustedInstallationProfile,
  brandBrainSnapshot,
  deliverablePreset,
  jobBrief,
  protectedAssets,
  supplementalInputs,
});
```

Compilation throws a `ContractValidationError` for invalid payloads and a `CompilationError` with a stable `code` for unresolved execution contracts such as missing protected assets, mismatched brands, mutable references, unavailable capabilities, or an unsupported placement and format.

## Fixtures and verification

The executable fixtures under [`../fixtures/compiler/`](../fixtures/compiler/) are synthetic or sanitized:

- SLAKE proves canon and policy precedence, explicit exclusions, exact package handling, compatible and incompatible references, and receipt explanations.
- PWP proves that strong influence does not raise a low-confidence source read.
- Riggg compiles the same governed snapshot and protected character under hybrid and constrained production policies, producing predictable differences without changing canon.

Install dependencies and run:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm validate:fixtures
```

The fixture validator compiles four runs across all eight public schemas. Tests also pass a serialized package through two minimal renderer-adapter shapes to prove that the package is portable and provider-neutral.

## Deferred work

This slice does not add source readers, Brand Brain retrieval, persistence, authentication, rendering, provider adapters, prompt editing, queues, approvals, or UI workflows. The planned first renderer adapter targets OpenAI; deterministic composition and drift checks remain Brand World System responsibilities. Later renderer adapters are optional extensions. Those capabilities should consume or produce these contracts only when a validated product slice requires them.
