# Browser Prototype

## Status

Working interaction model, not a production implementation. The production journey and the first Brand Brain governance slice are interactive.

The prototype in [`../../app/`](../../app/) translates the current production-flow decisions into a browser experience. Its purpose is to expose product friction early, make workflow conversations concrete, and preserve useful design learning without selecting the production application stack prematurely.

## Implemented journey

### Brand Brain

1. Enter an empty Brand Brain overview that explains the value, supported material, onboarding sequence, and permanent section organization.
2. Navigate among Overview, Sources, Needs review, Brand guidance, and History.
3. Add one local file, URL, or written source at a time, or load the sanitized SLAKE sample batch. Choose the concrete material type first: protected asset, approved guidance, past brand work or research, single image, image grid, named cultural reference, or other business document.
4. Add a required usage instruction, guidance area, influence where interpretation is appropriate, and optional exclusions. Protected assets and approved guidance are not influence-weighted. File intake shows accepted formats, enforces 20 MB per file and 40 MB per synthesis batch, and does not accept folders or mixed multi-file records. Approved guidance can be PDF, DOCX, PPTX, RTF, a supported structured text file, or a PNG, JPG, or WebP page image. Multi-page books work best as PDF; older DOC or PPT files, SVG, and native design files require conversion when the system needs to interpret them.
5. Build with OpenAI to read real sources, connect the brand story, find questions, and prepare structured guidance and artifacts. The sanitized SLAKE sample remains available as a deterministic control journey.
6. Open the SLAKE foundational-library batch containing 50 synthetic assets.
7. Approve 47 clean assets for future work without changing core brand guidance.
8. Review conflicting guidance, a possible duplicate, a possible brand principle, and a proposed brand rule in one master-detail view.
9. Inspect the evidence in marketer-facing language: what was found, how it was found, why it matters, and what it could affect.
10. Resolve contradictions and suspected duplicates by keeping either item, keeping both, or deliberately leaving the affected guidance unresolved.
11. Use, defer, or discard the proposed rule against medical and health claims, with explicit paid-social scope and no V1 exception workflow.
12. Approve the system-suggested 4pm Reset ritual as helpful guidance and optionally review a separate change to core brand guidance.
13. Create a stored SLAKE Brand Brain version with six guidance tabs, extended synthesized prose, working principles, its source trail, production use, and richer downstream artifacts.
14. Switch from editable guidance to three composed cross-category artifacts: Brand Dossier, Lived World, and Story Architecture.
15. Read varied artifact modules covering the strategic read, audience, product truth, palette, materials, guardrails, tensions, life patterns, earned environments, emotional progression, and production moments.
16. Comment directly on a guidance passage or artifact section, prepare a revised version from inline feedback, leave overall feedback, or approve the exact version for production, then inspect the session history.
17. Add new sources after approval without resetting production guidance. The approved result stays active while only the additions are checked against it, affected guidance is identified, and a candidate next version waits for review and approval.

### Production

1. Choose from a client-configured catalog of ordinary deliverables.
2. Describe a product lifestyle image in brief language.
3. Choose a placement; the output schema constrains the available formats.
4. Optionally attach creative inputs, assigning each a role, semantic influence, and plain-language usage instruction.
5. Review Preflight as the deliverable: a portable generation package with named Brand Brain components, a read-only compiled prompt, exact and flexible production rules, output parameters, input provenance, extracted evidence, and a resolution receipt.
6. Invoke a mock Generate action and review a static result and evaluation state.

The prototype defaults to one image per render. It does not expose a renderer choice, imply that brand guidance is optional, permit prompt editing, or ask a production user to repair Brand Brain governance problems.

## Product architecture expressed

- Deliverable presets are client configuration, not universal intent categories.
- Placement and format are related through the output type rather than independent labels.
- References are optional production inputs with explicit jobs; they are not unexplained attachments.
- Influence describes creative priority, not authority. Confidence describes the quality of a source read and remains separate from influence.
- Source handling begins with a concrete material type rather than an abstract authority menu. Protected assets remain exact, approved guidance governs its stated area, past work and research are interpreted for patterns rather than rules, and outside references remain inspiration rather than brand truth.
- Declared material type is verified against file compatibility and actual contents. A mismatch becomes a review question instead of silently changing downstream authority.
- Canonical assets, policy, and explicit requirements cannot be weakened through the reference controls.
- Batch approval and exception resolution do not promote material into canon.
- Inferred material remains visibly inferred after contextual approval.
- Canon promotion is a separate deliberate action with an impact preview and governance event.
- Product copy speaks in ordinary brand and marketing language while the implementation retains precise contract terms internally.
- Brand Brain navigation is organized around user jobs rather than the five internal content domains.
- Synthesis progress shows what the system is doing without presenting model or service architecture.
- Feedback creates a new stored version in the prototype instead of silently rewriting the prior Brand Brain.
- New sources create a minimal candidate update against the stored approved baseline. Stable fields are copied exactly, earlier review questions stay closed, and the active version remains available to production until approval.
- Inline guidance feedback stays attached to the exact passage and records the version in which it was incorporated.
- Guidance categories remain the editable knowledge layer; composed artifacts combine several categories into a durable reading and production tool.
- V1 models local resolution outcomes, not user roles, permissions, escalation, notifications, or external review routing.
- Reader output is evidence for the compiler. The server-owned resolution contract decides what is included, rejected, or overridden.
- The product asset is canonical and exact. It is composed into the scene, not regenerated.
- Prompt compilation is visibly derived from specific Brand Brain components and the brief.
- The generation package is portable and useful even when rendering happens elsewhere.
- Rendering is downstream and configurable outside the job-level workflow.
- OpenAI is the sole planned initial renderer, while the generation package remains portable across future adapters.

## Visual direction

The browser artifact uses a compact dark dashboard language: layered blue-charcoal and slate surfaces, cool white type, low-radius modules, subtle tonal borders, and restrained shadows. The direction intentionally stays close to the supplied DroitLab dashboard reference while translating that system to Brand World System's production workflow.

Accent color carries product meaning rather than decoration:

- coral-orange identifies user action, attention, and exceptions;
- cyan identifies compiled system intelligence and production output;
- lavender identifies governance and Brand Brain context; and
- green identifies verified or successfully resolved state.

The palette is a product-shell hypothesis rather than a client brand requirement. Tokens are centralized in [`../../app/styles.css`](../../app/styles.css) so client themes can later change presentation without changing semantic color roles or workflow behavior.

## Deliberately absent

- authentication, authorization, or runtime client isolation (the delivery boundary is specified separately in [`../installation-model.md`](../installation-model.md))
- production database storage, saved jobs, durable upload binaries, or asset search
- full multi-version retrieval, rollback, or production prompt compilation from the generated Brand Brain
- model/provider selection in the interface or renderer calls
- production validation, durable approvals, revisions, or memory write-back
- production-grade ingestion, a background extraction queue, user and permission management, external review routing, rule exceptions, or supersession
- fully implemented deliverable presets beyond product lifestyle image

These omissions keep the artifact honest. The prototype tests the production interaction model; it is not evidence that the first implementation slice has been selected.

The absent renderer call is planned work rather than an external dependency. The first production adapter will target OpenAI, followed by Brand World System-owned deterministic composition and drift checks for protected assets. See [`../decisions/0008-use-openai-as-the-initial-renderer.md`](../decisions/0008-use-openai-as-the-initial-renderer.md).

## Two compilers

The browser application uses `src/production/package.js`, the `brand-world-image-v2` compiler. This is the live production path for the current output type: a single brand-world image compiled from an approved Brand Brain, optional creative references, and an optional locked asset. It includes a craft layer ported from the Product World Preview render-prompt-writer (v13): aesthetic mode selection, a format-aware protection block, an integration sentence, state-lock neutralization, and a constraint audit.

The schema-governed compiler in `src/compiler.js` remains the reference implementation for the full policy model, multi-stage workflows, and the Riggg falsifiability control that proves policy changes behavior predictably. The two converge when production supports multiple output types and stage-level policy configuration. Until then, the image compiler is the real product and the schema compiler is the specification proof.

## Running locally

From the repository root:

```sh
npm run dev
```

Open `http://localhost:4173`.
