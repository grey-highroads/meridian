# Decision Records

This directory contains concise records of consequential product and architecture decisions.

Each record should state:

- the decision and its status;
- the context and forces that shaped it;
- the options considered;
- the rationale and tradeoffs;
- the consequences for schemas, workflows, fixtures, or implementation; and
- the date and owner.

Use sequential filenames such as `0001-persist-brand-canon.md`. Superseded decisions remain in the repository and link to their replacements.

## Decision index

- [`0001-separate-world-building-and-production.md`](0001-separate-world-building-and-production.md), Accepted
- [`0002-model-canon-as-a-governed-view.md`](0002-model-canon-as-a-governed-view.md), Accepted
- [`0003-compile-and-snapshot-production-policy.md`](0003-compile-and-snapshot-production-policy.md), Superseded in part by ADR 0005
- [`0004-separate-shared-platform-and-private-brand-data.md`](0004-separate-shared-platform-and-private-brand-data.md), Superseded in part by ADR 0007
- [`0005-apply-policy-presets-per-workflow-stage.md`](0005-apply-policy-presets-per-workflow-stage.md), Accepted
- [`0006-treat-generation-package-as-portable-artifact.md`](0006-treat-generation-package-as-portable-artifact.md), Accepted
- [`0007-deliver-isolated-client-installations-first.md`](0007-deliver-isolated-client-installations-first.md), Superseded in part by ADR 0011
- [`0008-use-openai-as-the-initial-renderer.md`](0008-use-openai-as-the-initial-renderer.md), Accepted
- [`0009-update-brand-brain-from-an-approved-baseline.md`](0009-update-brand-brain-from-an-approved-baseline.md), Accepted
- [`0010-route-production-feedback-through-candidate-rules.md`](0010-route-production-feedback-through-candidate-rules.md), Accepted
- [`0011-operate-a-shared-multi-client-deployment.md`](0011-operate-a-shared-multi-client-deployment.md), Accepted
- [`0012-model-products-as-governed-records.md`](0012-model-products-as-governed-records.md), Accepted (implemented 2026-08-09)
- [`0013-govern-copy-through-derived-claims.md`](0013-govern-copy-through-derived-claims.md), Accepted (mechanism test passed 2026-08-09)
- [`0014-produce-governed-copy-alongside-imagery.md`](0014-produce-governed-copy-alongside-imagery.md), Part one accepted and shipped 2026-08-10; part two revised 2026-08-11
- [`0015-build-render-quality-on-people-scene-and-rejects.md`](0015-build-render-quality-on-people-scene-and-rejects.md), Proposed; steps 1, 2, 4, and 5 shipped 2026-08-14, visual grammar rejection corrected by session findings
- [`0016-articulate-visual-grammar-and-evaluate-renders-against-it.md`](0016-articulate-visual-grammar-and-evaluate-renders-against-it.md), Proposed
- [`0017-govern-refusals-as-durable-records.md`](0017-govern-refusals-as-durable-records.md), Proposed; step 1 judged and ruled 2026-08-17, step 2 pre-registered and parked, step 3 bootstrap shipped and confirmed on real client storage 2026-08-17
- [`0018-compile-scene-relevant-prompts-and-govern-looks.md`](0018-compile-scene-relevant-prompts-and-govern-looks.md), Accepted; owner ruled on all five decisions 2026-08-17 (index entry added 2026-08-21)
