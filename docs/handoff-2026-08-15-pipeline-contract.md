# Handoff: image pipeline contract build session

- Date: 2026-08-15
- Session scope: write `docs/image-pipeline-contract.md` per `docs/image-pipeline-contract-spec.md`. No code changes were made; every fault found while tracing is recorded, not fixed.
- Verified against commit: `cfddd0a86841bf14790f55d5eee3bc755f1c6b2b`

## What was documented

The full contract: all twelve stages with the eight-field template, plus the three cross-cutting sections (the copy path on the image job, the invariant index, known ambient states). The practice gate ran first: stages 6 and 7 were pushed as a draft and passed owner review on 2026-08-15 before the remaining ten stages were written. Per the owner's gate disposition, inputs half-built in `prepareProductionPackage` stay documented under stage 7's Inputs with service.js citations, and stage 8 cross-references stage 7 rather than duplicating them.

Pushed alongside the contract in the same tree:

- `docs/ui-contribution-guide.md` gained the maintenance-rule paragraph making the contract mandatory reading before image-path work and the contract update the second mechanical ritual of the push workflow.
- `docs/deferred-work.md` gained the server-side refusal entry for unaudited display copy (required before any client-facing beta touches display copy; interface-as-gate accepted until then), per the owner's disposition.

## Findings where code and its records disagree

All recorded in the contract's Known ambient states with citations; the ones that are genuine disagreements rather than documented waiting states:

1. **ADR 0016 carries a stale Verified claim** that the scene writer receives `identity.summary` alone. Commit `1a9357e` added identity principles; the ADR text and the contract spec both still carry the old claim. Disposition: pending a separate cleanup session.
2. **The spec names a scene writer kind (`object`) that does not exist.** Actual kinds: `scene`, `template_surface`, `sales_element`.
3. **Display copy governance is client-enforced at the API seam.** ADR 0014 part two's produced-and-audited requirement is held by the interface, not the server; a direct API caller can render an unaudited string, recorded but not refused. Now in deferred work with the beta gate stated.
4. **`compileProductSection` in `src/production/package.js` is dead code** that compiles claim language into an image prompt section, next to the live `compileProductSectionForImage` that deliberately excludes claim language. Disposition: pending the cleanup session.
5. **The ADR 0013 amended mechanism test is recorded in the ADR as never run** (API key unavailable in the implementing session). Whether it has been run since is not establishable from code; the runnable path exists (`run_audit_test` action, `fixtures/copy-audit-mechanism-test.mjs`).

Lesser recorded observations, no action per the owner: `checkRequirements` hardcoded to `brand-world-image` for every placement; the constraint audit satisfied by construction (regression tripwire, not live filter); the suggestion picker displaying one of four authored fields; the two-compile gap between preflight and render; the prototype-only `resolveClientId`; two legacy flat-path read-throughs; the legacy LinkedIn copy path living beside the catalog path with duplicated steering and audit logic.

## Confidence below Verified, and why

The contract is Verified throughout with two labeled exceptions:

- **Stage 8 invariants, the preflight-to-render drift note.** That the second compile can differ from what preflight showed is Reasoned from the two call sites; no test or code pins the preflight package to the render, and no incident has demonstrated the drift.
- **Known ambient states item 6.** The constraint audit's value as a regression tripwire is Reasoned; the by-construction guarantee itself is Verified from the compile and audit code.

The display-budget characters-per-line figures are labeled Reasoned inside their own module and the contract repeats the label rather than upgrading it.

## Modules whose next change must update the contract

Any commit touching these updates `docs/image-pipeline-contract.md` in the same commit or states in the commit message why no update is needed:

- `src/brand-brain/`: `schema.js`, `service.js`, `chat-completions-provider.js`, `source-reader.js`, `source-normalizer.js`, `store.js`
- `src/products/`: `service.js`, `store.js`
- `src/claims/`: `store.js`, `assembly.js`, `copy-audit.js`
- `src/scope/resolver.js`
- `src/copy/`: `generate.js`, `types.js`, `prose-check.js`, `display-budget.js`
- `src/production/`: `package.js`, `prompt-craft.js`, `service.js`, `store.js`
- `src/renderers/openai-images.js`
- `src/server/http.js` (client resolution and access gate, cited by stages 1, 10, 11)
- `api/brand-brain/`: `index.js`, `save.js`, `synthesize.js`
- `api/products/index.js`
- `api/production/`: `preflight.js`, `generate.js`, `generate-copy.js`, `outputs.js`, `current.js`
- `api/blob/upload.js`
- `app/app.js`, for the preflight and result regions and the output-log and suggestion functions the contract cites by line

ADR 0016's implementation will touch the scene writer, synthesis instructions, compiler, and prompt-craft at once; its own sequencing names this contract as the mandatory prerequisite, which is now satisfied.

## Acceptance status

The spec's acceptance test stands ready for the owner's spot check: three behaviors from past incidents, verified against the contract's citations. Candidate checks from this session's reading: the duplicate-render ownership walls (stage 10), the loadProducts loop's guarded-loader consequences (contribution guide, stage 12 consumers), and the stable image route's no-store redirect (stage 11).
