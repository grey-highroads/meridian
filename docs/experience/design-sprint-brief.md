# Design Sprint Brief: Brand World System

> Status: Active mandate. This document governs the whole-product design sprint. It records decisions made on 2026-08-02, with clarifications added after repository audits on 2026-08-02 and 2026-08-03.

## Context in one paragraph

The Brand World System repository defines a persistent brand brain plus two workflows: building and governing the brain, and producing work from it. The specification set (thesis, glossary, schema, production policy, contracts, architecture, ADRs 0001 through 0005) is complete enough that further specification is now over-engineering risk rather than progress. All specs are frozen as target-state references. The next unit of learning comes from designing the whole product visually, not from more documents and not yet from code. The prior production mockup already proved this method: it exposed a job-level mode selector as architecture leaking into the interface and produced ADR 0005.

## Sprint objective

Produce high-fidelity, coherent wireframes of the complete application: the shell, major navigation, and the two core journeys. The wireframes serve three purposes at once: pressure-test whether the architecture yields an intuitive product, supply the visual spine of the pitch narrative, and generate the product learning needed to pick the first implementation slice.

## Sequence

1. **Application shell and major navigation.** Establish where a user is, what work exists, and how the two workflows relate. Start from `docs/experience/screen-inventory.md`.
2. **Asset-creation journey first, at high fidelity.** Begins from a prepared, governed brand brain. Follows `docs/experience/flows/hybrid-production.md`. Production is designed before brain-building because what production consumes defines what the brain must contain, and because it is the journey a pitch walks first. The journey must begin with selecting or entering a named configured workflow from the application shell, not at the production request screen. The earlier mockup finding showed that entering production mid-workflow creates a "dropped into the middle" problem; the exit criteria require showing how the user arrived.
3. **Brand-brain build journey second, at high fidelity.** Onboarding, evidence intake, exception review, approval, and canonical promotion. Follows the journey structure in `fixtures/pwp/README.md` and the governance pressure tests in the screen inventory. This journey ends at "governed brain ready for use." Campaign-territory development and any subsequent production work belong in the asset-creation journey, even when they consume intelligence built during onboarding. The PWP fixture includes a campaign-development stage for reference, but the sprint boundary for this journey is the completed, governed brand brain.
4. **Write back findings.** Every design discovery updates `docs/concept-visibility.md`, an ADR, or a spec revision note. Mockups do not override contracts silently.

After the sprint: refine the primer and the client-build definition from what the journeys revealed, then identify and scope the next narrow high-value implementation slice. The production compiler foundation was selected separately through an explicit implementation directive; its completion does not imply that the whole-product design sprint is complete.

## Evidence gates

The sprint is subject to the same discipline the specs were frozen under.

- Every screen passes the product architecture test in `docs/product-development-principles.md`. Screens are not created because the schema contains a concept.
- The asset-creation journey must begin with workflow selection from the shell and answer the six questions listed in `docs/experience/flows/hybrid-production.md`. The governance journey must cover the seven pressure tests in `docs/experience/screen-inventory.md`.
- Constrained, hybrid, and editorial never appear as user-facing selectors. Per ADR 0005 they are stage-level configuration presets. Preflight shows plain-language exactness promises instead.
- Approve output, approve guidance, and promote to canon are always distinct actions.
- The concept-visibility map in `docs/concept-visibility.md` is the authority on what users see. Internal mechanisms do not earn screens.

## Exit criteria

The sprint ends when all of the following exist, even if more screens are imaginable:

- application shell and navigation model;
- the asset-creation journey at high fidelity, beginning from workflow selection and answering its listed questions;
- the brand-brain journey at high fidelity, ending at a governed brain ready for use, covering its listed pressure tests;
- findings written back into concept-visibility, ADRs, or spec revision notes;
- a short list of open product questions the wireframes could not settle.

## Synthetic brand requirement

All wireframes use one consistent synthetic brand so the product reads as real rather than templated. The brand needs, at minimum: a name, a locked package or hero asset, a palette, one inferred world ritual with confidence and evidence, one scoped prohibition with rationale, and a 50-asset batch scenario with at least one contradiction. This material is sanitized fixture content and advances Phase 3 while serving the sprint. No real client material.

Brand-derived theming (tinting content surfaces with the brand's palette while application chrome stays fixed) is a visual hypothesis worth exploring during the sprint. It has not yet passed the product architecture test: the user job it supports and what is lost without it remain unestablished. Explore it as one visual direction rather than treating it as a product requirement.

## Technical proof, not a sprint dependency

Brand World System owns the technical proof for deterministic composition of a locked asset into generated context, plus measurable drift detection. Wireframes cannot falsify this mechanism, and the pitch claim "we can build this" needs spike-level evidence. The design sprint does not block on the proof, and the proof does not depend on an external renderer. The initial render path uses OpenAI for flexible context generation, followed by project-owned deterministic composition and drift checks. See [`../decisions/0008-use-openai-as-the-initial-renderer.md`](../decisions/0008-use-openai-as-the-initial-renderer.md).

## Explicitly out of scope

- New or expanded specification documents.
- Implementation planning, estimation, or code.
- Multi-tenancy machinery, provider fallback, resumability design, governance-service design, candidate rules, memory proposals. These are deferred until a real workflow proves them necessary.
- Universal DAM, org-wide project management, autonomous publishing, and the other exclusions in `docs/architecture.md`.

## Source of truth and reading order

The repository is canon: `github.com/grey-highroads/brand-world-system`. Fetch live rather than trusting copies. Read in this order:

1. this brief;
2. `glossary.md`;
3. `docs/concept-visibility.md`;
4. `docs/experience/` (north-star, screen inventory, hybrid flow);
5. `docs/product-development-principles.md`;
6. `fixtures/pwp/README.md` and `fixtures/riggg/README.md`;
7. specs only as reference when a screen needs a contract detail.

## Working rules

- The Higher Roads prose ruleset (maintained as a project knowledge file in the working project) applies to all interface copy: no em dashes, no fragment stacks, no "It's not X, it's Y" constructions, no negation-first constructions, plain peer-to-peer language. When the ruleset and this brief conflict, the ruleset governs prose; this brief governs product decisions.
- Interface language prefers the user's words to the architecture's words. "Needs approval," not "lifecycle: proposed."
- Build-then-refine: get screens made, react to real output, iterate. Do not spec screens in prose before making them.
- Design findings that conflict with a frozen spec are recorded as findings, not silently designed around. The spec may then be revised deliberately.
