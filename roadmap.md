# Roadmap

This roadmap moves from product definition to a reusable internal implementation kit. Dates will be assigned after the core specifications are stable.

## Phase 1: Define the product model

- Publish the product thesis ✓
- Write the plain-language primer
- Record the two-workflow and production-policy decisions ✓
- Establish a shared glossary ✓
- Define success criteria for the first proof ✓
- Establish the product architecture test and concept-visibility audit ✓

## Phase 2: Specify the system's core

- Draft the brand-world schema ✓
- Draft stage-level creative-control policy and reusable presets ✓
- Add valid, invalid, and ambiguous examples ✓
- Define workflow, asset-registry, provenance, and evaluation contracts ✓
- Freeze specifications as target-state references ✓

## Phase 3: Validate through design and fixtures

- Run a whole-product design sprint (active)
- Design the application shell and major navigation (production-flow pass complete)
- Design the asset-creation journey at high fidelity (interactive browser pass complete)
- Test the production interaction model in a runnable browser prototype ✓
- Design the brand-brain build journey at high fidelity (empty state through stored production-ready Brand Brain complete; supersession remains open)
- Design Brand Brain overview, source intake, synthesis progress, SLAKE review, guidance version, feedback, approval, history, and core-guidance change screens ✓
- Turn the Brand Brain's downstream artifact summaries into full, reviewable artifact experiences ✓
- Harden source intake around one source at a time, concrete material types, file compatibility, required usage instructions, and declaration checks ✓
- Preserve an approved Brand Brain while new sources produce a minimal candidate update for review ✓
- Run a selective readability pass on essential text below 10px without changing the overall type scale ✓
- Write the product primer from design learning
- Define what a client build includes as a deliverable
- Build sanitized PWP and Riggg fixture journeys
- Add a sanitized SLAKE 50-asset batch fixture with a contradiction, suspected duplicate, suspected-canon item, and proposed brand rule ✓
- Test a multi-stage journey and hybrid-versus-constrained policy control
- Record schema and policy changes revealed by each case

## Phase 4: Build the internal implementation kit

The production compiler foundation was selected through an explicit implementation directive after the first production-flow learning. Its completion starts Phase 4 without closing the active whole-product design sprint or its remaining brand-brain journey.

- Define the isolated client-installation profile and spin-up sequence ✓
- Identify the narrowest high-value implementation slice from design and fixture learning ✓
- Scope the first slice before committing to code ✓
- Implement the executable production compiler foundation and portable Preflight contracts ✓
- Implement intake, normalization, retrieval, context assembly, and persistence (first local OpenAI vertical slice and approved-baseline update path complete; production storage, full version retrieval, and durable upload library remain)
- Add the OpenAI image renderer adapter, deterministic protected-asset composition, measurable drift checks, evaluation, revision, and approvals
- Capture job state, provenance, token usage, cost, and failure recovery
- Keep shared infrastructure separate from private brand configuration

## Phase 5: Deliver a pilot workflow

- Select one recurring, high-value marketing workflow
- Onboard one brand and register its initial canon
- Measure production time, correction rate, fidelity, usefulness, and cost
- Turn repeated implementation work into documented reusable components

## Phase 6: Productize proven patterns

- Add additional output modules only after the pilot demonstrates value
- Add another renderer adapter only when a client integration or validated workflow requires it
- Standardize stable schemas, policies, evaluators, and operational tooling
- Define security, ownership, portability, hosting, and support packages
- Reassess whether the proven implementation kit should become a broader platform

## Status appendix (2026-08-09)

Recent implementation has run ahead of the phase outline above, driven by real-client testing on Dialog Health. Tracking the tactical production roadmap (the 14-item list in project knowledge):

- Products as governed records (ADR 0012): complete and hardened. Per-product synthesis with evidence-fidelity discipline, candidate/approved lifecycle, versioning, re-synthesis, deletion, review-question workflow with suggested answers and tabling, and an approved-but-incomplete production warning. Products are born on their own screen and consumed by the sales enablement flow.
- Item 6, copy governance: selected as the next slice. Handoff at `docs/handoff-copy-governance.md`. Direction set, six open questions to settle, first artifact is an ADR for where brand claims live.

Still open from the tactical list: preservation and fidelity levels (item 5), declared success criteria per deliverable (item 7), element-level targeted repair (item 9), full failure-disclosure options (item 10), reusable campaign-scoped creative directions (item 13), effort transparency (item 14). The intake page restructure (three-door intake, library demotion, event-driven update flow) is partially done: products got their own workflow; the evidence and asset doors and the library cleanup remain.
