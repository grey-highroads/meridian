# ADR 0012: Model products as governed records outside the brain document

- Status: Accepted (implemented 2026-08-09)
- Date: 2026-08-08
- Owner: Higher Roads
- Supersedes: Nothing. Extends ADR 0006 (portable generation package) with a product-scoped input.
- Related: ADR 0001 (separate world-building and production), ADR 0003 (compile and snapshot production policy), ADR 0006 (portable generation package), ADR 0011 (shared multi-client deployment)

## Context

The Brand Brain models the audience, the lived world, the ethos, and the rules of a brand in depth. It models products in one string. The dossier carries a single `productTruth` field and a short list of proof points for the entire brand. A company with twelve products gets one sentence to describe all of them.

The Dialog Health sales enablement test made the consequence concrete. Asked to generate an RCS feature showcase, the system produced a competent generic mockup with invented client names and invented screen content, because the compiled prompt had no structured RCS knowledge to draw from. RCS exists in the brain only as scattered brand-level mentions across the guidance sections. The compiler had no RCS entity to compile.

The gap caps output quality wherever work is product-specific, and product-specific work is a large share of everyday marketing: feature showcases and one-sheeters in B2B, product cards, retail launch assets, and distributor sheets in B2C. A brain that understands who the brand serves but not what it sells is lopsided.

Three findings from a full code review shape the decision.

**First, the frozen v1 contracts already anticipate products.** The shared scope definition in `common.schema.json` carries a `product_ids` axis. The job brief schema carries `product_id` in its scope object. The frozen production compiler (`src/compiler.js`) resolves entities by scope including the product axis, and the Riggg fixture exercises it with a job scoped to a named product. Product scoping is designed, written as executable contracts, and tested. It never reached the live path.

**Second, the live brain document cannot absorb a product catalog.** The live synthesis produces one monolithic JSON document under a strict schema: six fixed guidance sections and three singular artifacts. Incremental updates instruct the model to copy every unaffected field exactly and re-emit the whole document. A variable-length products array inside that document would make every incremental synthesis reproduce every prior product verbatim. Cost grows with catalog size, and so does the risk of the model paraphrasing approved claim language it was told to copy. For a multi-SKU consumer brand this fails outright.

**Third, the diffing and change-impact machinery is section-scoped.** Candidate review diffs the six guidance sections and nothing else. Change-impact classification matches changed elements to consumed elements by substring. Product knowledge embedded in the brain document would be invisible to the diff and unreliable in impact analysis, weakening one of the product's honest differentiators.

The template intake built this week established the relevant precedent: templates are governed assets stored alongside the brain, tagged at intake, excluded from synthesis, and resolved by production when a job needs them. Products follow the same shape at a larger scale.

## Decision

Products are **governed records stored alongside the Brand Brain**, not fields inside the synthesized brain document.

**One brief in, one record out.** A product record is synthesized individually from its own sources (a product brief, a spec sheet, a feature page) using the same synthesis engine and the same authority discipline as the brain: trace claims to named sources, distinguish fact from inference, raise review questions rather than filling gaps. A product record that invents claims is worse than no record, because invented product claims in sales collateral carry real commercial and regulatory cost.

**Bounded record shape.** A product record carries: name, category, the one true thing about the product, structured features (each with its benefit, approved claim language, and any constraint or accuracy note), proof points, references to linked assets (product photography, packaging, screenshots), and per-product exclusions. The shape is small enough for a model to fill well in one pass and for a human to review in one sitting.

**Independent versioning.** Each product record versions on its own. Adding or revising one product touches one record. The brain document is unchanged and un-resynthesized. Approval of a product record follows the existing pattern: a candidate is reviewed and approved before production can consume it.

**Product-scoped compilation.** When a job names a product or feature, the live compiler resolves that product record and injects its knowledge into the generation package alongside the brand-level context. Jobs that name no product compile exactly as they do today. The sales enablement flow's feature field is the first consumer; the scope object recorded on the package uses the same shape as the frozen contracts (`product_ids`), so the live path converges on the target-state compiler rather than diverging from it.

**Intake follows the template pattern.** A source can be tagged as a product brief and associated with a product at intake. Product-brief sources are excluded from brain synthesis and routed to per-product synthesis, the same way template sources are excluded from synthesis and stored as production assets.

**Consumption records carry product scope.** An output produced with a product record logs that record and its version. Change-impact for product-scoped outputs checks the named record's version rather than substring-matching the brain document.

## The hierarchy this creates

The base coat hierarchy gains a second inheritance dimension. The Brand Brain remains the evergreen base coat that flows into everything. Product records flow into product-scoped work. Campaigns keep their own creative direction and persistence. A single asset can inherit from all three: brand ethos, product truth, and campaign direction, with no layer owning another. A summer campaign for one SKU is the intersection of a campaign and a product, and the compiler resolves both.

## Consequences

**Gained.** Product-specific outputs draw on governed knowledge instead of model invention. Synthesis cost stays flat as the catalog grows. Diffing and change-impact become precise for product-scoped work. B2B feature showcases and B2C product cards share one mechanism. The live path converges on the frozen entity model one bounded step at a time.

**Accepted costs.** A second synthesis path to build and maintain, though it reuses the existing engine and discipline. A product management surface in the interface: list, create, review, approve. Intake gains one more material type and one more association step.

**Deferred.** Automatic extraction of products from a connected knowledge base or repository. Distribution is downstream of structure; a live Confluence connection feeding an unstructured brain flattens into the same blur. Structure first, connections later. Also deferred: retiring the section-based brain in favor of the full entity model. This decision converges toward it without committing to the migration.

**Risks.** Per-product synthesis quality is the make-or-break. The first implementation step is a prototype against a real Dialog Health RCS brief, evaluated for evidence fidelity before the schema is committed. Second risk: scope creep from product records into a full PIM. The record holds what production needs to make governed creative work, not inventory, pricing, or availability. That line is stated here so it can be defended later.

## Sequencing

1. **Prototype the per-product synthesis** against the Dialog Health RCS deck. Evaluate whether the record's claims trace to the source and whether review questions surface where evidence is thin. No schema commitment until this passes.
2. **Product record schema and store**, namespaced per client per ADR 0011, versioned independently of the brain.
3. **Intake tagging** for product-brief sources, following the template material-type pattern.
4. **Product-scoped compilation** in the live compiler, keyed off the sales enablement feature field first.
5. **Product management surface**: list, review, approve. Consumption records and change-impact extended to product scope.

## Implementation

All five steps in the sequencing landed by 2026-08-09.

- **Step 1** (2026-08-08). Prototype synthesis passed the evidence-fidelity gate. See `docs/evaluations/2026-08-08-adr-0012-product-synthesis.md`.
- **Step 2** (commit `4ecb393`). Frozen schema at `schemas/v1/product-record.schema.json`. Store at `src/products/store.js`. Service at `src/products/service.js`. Endpoint at `api/products/index.js`. Three prototype files deleted.
- **Step 3** (commit `c2c3a70`). Intake tagging in `app/app.js`. Product-brief material type with per-source `productMeta`. Excluded from brain synthesis.
- **Step 4** (commit `8ea3ad5`). Product-scoped compilation in `src/production/package.js`. `resolveProduct` in `src/production/service.js` with approval guard.
- **Step 5** (commit `bdd5d43`). Products navigation entry, list and detail screens, approve action, sales enablement product picker.
- **Follow-ups** (commit `cdae93d`). Product synthesis button on product-brief source rows. Re-synthesis bumps version and clears approval. Product-version drift on workspace and Design Studio chooser.

The closing handoff for this phase is `docs/handoff-2026-08-09-adr-0012-complete.md`.

Known follow-ups not blocking closure: server-side `classifyChangeImpact` extension for product-version comparisons, vision handling for image-dense product briefs, text extraction at intake, product picker across production surfaces beyond sales enablement.
