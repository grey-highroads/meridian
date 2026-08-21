# Handoff: ADR 0012 complete, product records live end to end

- Date: 2026-08-09
- Prior session: ADR 0012 sequencing carried to completion (steps 2 through 5) plus two follow-ups
- Repository: `github.com/grey-highroads/brand-world-system`, branch `main`
- Deployment: Vercel, deployed via commit `3ed6b12`
- Serverless function count: 12 of 12 (Hobby ceiling held throughout the phase)

## Where things stand

ADR 0012 is fully implemented. The product loop is a real thing in the product now: a product brief comes in as a source, gets synthesized into a governed record, waits for human review, then feeds production automatically once approved. Revisions bump the version, reset approval, and surface any outputs that used the older version.

Every step from the ADR's sequencing landed:

- **Step 1 (prior session):** Prototype synthesis passed the evidence-fidelity gate against the Dialog Health RCS deck. Seven-for-seven verbatim claim language, Version 2 conditionality correctly detected, demonstration content correctly excluded. Documented in `docs/evaluations/2026-08-08-adr-0012-product-synthesis.md`.
- **Step 2:** Product record schema graduated to `schemas/v1/product-record.schema.json` as frozen JSON Schema 2020-12 with snake_case field names matching the frozen contracts. Per-record store namespaced under the client, versioned independently of the brain. Single dispatching API endpoint at `api/products/index.js`. Three prototype files deleted in the same commit.
- **Step 3:** Intake tagging for product-brief sources. Sources tagged as product briefs carry `productMeta` with a product name, are excluded from Brand Brain synthesis, and are excluded from the locked assets list.
- **Step 4:** Product-scoped compilation in `src/production/package.js`. When a job carries a `productId`, the compiler injects a Product Knowledge section with approved claim language, features, exclusions, visual direction, and proof points. Product exclusions merge into the Protection section. The returned package carries product metadata for downstream consumption tracking.
- **Step 5:** Product management surface. New Products navigation entry, list screen with candidate/approved status pills, detail screen with expandable sections for features, proof points, exclusions, and review questions. Approve button on candidates. Production rejects unapproved records with a 409 and a marketer-legible message.
- **Follow-ups:** Product synthesis button on product-brief source rows (no more hitting the API by hand). Re-synthesis bumps the version and clears approval. Product-version drift surfaces on the workspace and Design Studio chooser alongside the existing Brain-version drift.

## Read these first, in order

The next agent should read these before touching product code. Reading order matters: the ADR states the decision, the step-1 evaluation records the evidence that made it safe to proceed, and the current source files show what actually works.

1. `docs/decisions/0012-model-products-as-governed-records.md`. The decision itself.
2. `docs/evaluations/2026-08-08-adr-0012-product-synthesis.md`. The evidence-fidelity gate that unblocked steps 2 through 5.
3. `docs/handoff-2026-08-08-adr-0012-continuation.md`. The incoming handoff that opened this phase.
4. This document.
5. `schemas/v1/product-record.schema.json`. The frozen product record contract.
6. `src/products/service.js`. Synthesis, persistence, approval.
7. `src/products/store.js`. Per-client namespaced storage.
8. `src/production/service.js`. How product resolution enters the live compiler path.
9. `src/production/package.js`. How a product record becomes a prompt section.
10. `app/app.js`. The Products screens, the source-row synthesis button, and the drift cards.

## What ships to end users right now

The following flow works end to end in the deployed app:

1. Add a product brief on the Brand Brain sources screen. Tag it as "Product brief or spec" and give it a product name.
2. Expand the source row. Click **Synthesize product record**. The system builds a candidate.
3. Open **Products** in the sidebar. Review the candidate: the one true thing, category, audience, features with approved claim language and accuracy notes, proof points, exclusions, and review questions.
4. Click **Approve product record**. The candidate flips to approved with a timestamp. Production can now consume it.
5. Open Design Studio, pick Sales enablement, and select the product from the dropdown. The compiled prompt now carries the product's governed knowledge automatically.
6. Later, when the brief updates, re-synthesize from the same source. The version bumps, approval resets, and any older outputs get flagged on the workspace and Design Studio chooser.

## The seams the next agent needs to know about

**Two compilers, one repo.** `src/compiler.js` is the frozen v1 entity compiler from the Riggg lineage. It already knows how to filter by `product_ids` scope and remains not on the live path (only fixtures exercise it). `src/production/package.js` is the live compiler used by every production flow. Step 4 added product resolution to `package.js`, not to `compiler.js`. The live path now adopts product scoping without taking on the full compiler migration.

**Two brain states, live vs. target.** The live brain is six fixed guidance sections plus three artifacts, synthesized monolithically. Products live outside the brain document specifically to avoid the incremental-synthesis scaling wall. Do not, under any circumstances, add products as a field inside the brain schema in `src/brand-brain/schema.js`.

**Namespacing per ADR 0011.** All product records live under `brand-world-system/clients/{clientId}/products/{productId}.json` in Vercel Blob. An index lives at `brand-world-system/clients/{clientId}/products/index.json`. The `resolveClientId` seam in every API route is a security placeholder waiting for real auth (Jim's territory). The pattern is established by the brain and template stores; the product store follows it exactly.

**The 12-function Vercel Hobby ceiling.** Held throughout this phase. Every new product operation went through the single dispatching handler at `api/products/index.js` rather than adding files. Step 5 added the approve action to that same handler.

**Product ids are server-assigned.** Auto-generated from the product name plus a short random suffix, matching the client-store pattern. They conform to the frozen `identifier` type (`^[a-z0-9][a-z0-9._-]*$`). No user ever picks a slug.

**Re-synthesis is anchored to source id.** When a product-brief source is re-synthesized, the service looks up any existing product record with `provenance.source_ref === source.id` and increments its version rather than creating a new record. Approval clears on every revision.

## Files that matter and their current shape

**Frozen contracts, do not evolve without a governed schema change:**
- `schemas/v1/product-record.schema.json`. Snake_case field names, references `common.schema.json` for shared definitions like `schema_version`, `identifier`, `version`, and `provenance`. Carries `$defs` for `feature`, `feature_evidence`, and `review_question`. `approved_claim_language` and `accuracy_note` allow empty strings by design.

**Product paths:**
- `src/products/store.js`. Per-client namespaced storage. `listProducts`, `readProduct`, `writeProduct`, `deleteProduct`, `generateProductId`. Status is derived from `approved_at` in the index entry.
- `src/products/service.js`. `synthesizeAndPersistProduct` (with source-anchored re-synthesis and version bumping), `listProducts`, `readProduct`, `approveProduct`. Reuses `collectChatCompletionStream` and `extractChatCompletionText` from the brain provider. Synthesis prompt carries the same evidence discipline as brain synthesis.
- `api/products/index.js`. Single dispatching handler. GET lists products. POST dispatches on `action`: `synthesize`, `read`, `approve`.
- **Deleted this phase:** `src/products/schema.js`, `src/products/prototype-provider.js`, `api/products/prototype.js`. Removed in the step 2 commit.

**Compiler wiring:**
- `src/production/service.js`. `resolveProduct` fetches the record and rejects candidates with a 409 (`"is a candidate and has not been approved"`). Called from `prepareProductionPackage` when `body.productId` is present.
- `src/production/package.js`. `compileProductSection` builds the Product Knowledge prompt section. Product exclusions merge into Protection with `Product rule:` prefix. Returned package carries `product: { product_id, product_name, version }`.
- `api/production/preflight.js` and `api/production/generate.js` both pass a `createVercelBlobProductStore` into the service so product resolution works server-side.

**UI:**
- `app/app.js`. State slice `state.products` with `{ list, detail, loading, approving, activeId, error, loadedForClient }`. State field `state.brain.productSynthesizingId` tracks which source row is currently synthesizing. State field `state.studio.salesProductId` holds the selected product for sales enablement.
  - Nav entry "Products" between Campaigns and Library.
  - Screens `products` (list) and `product-detail` (full record).
  - `renderSalesSetup` includes an approved-products dropdown alongside the existing feature focus text field.
  - `sourceGroupRow` renders a synthesis button and status pill on product-brief sources.
  - `renderWorkspace` and `renderChooser` show product-version drift cards using `outputsAffectedByProductVersion()`.
- No new CSS. All new components use existing tokens from `app/polish.css` per the UI contribution guide.

## Rules that governed this phase and should carry forward

- **Verified, Reasoned, Assumed.** Every architectural claim labeled. Grey has explicitly corrected fabricated competitive analysis in the past and expects verified sources over speculation.
- **No em dashes.** Applied everywhere including code comments, commit messages, ADRs, and this document.
- **Peer-to-peer language in UI copy.** Marketer-legible throughout: "Approve product record," "Needs review," "Made with an older version." Schema terms like `approved_claim_language` and `accuracy_note` live in the contract and never surface in the interface.
- **Build-then-refine.** Grey reviews the live deployed app, not the JavaScript. Push, let him look, react to real output.
- **Approval is a distinct action.** The three-way discipline holds: approve output, approve guidance, promote to canon. Product record approval is the "approve guidance" action, kept distinct from the other two.
- **Chief architect framing.** The responsibility is to hold the whole product vision, not just the current slice. Every step in this ADR was evaluated against how it lands for founders, owners, marketers, and salespeople in everyday use.

## Follow-ups noted but not blocking

- **Index read-modify-write race.** `writeProduct` and `deleteProduct` in `src/products/store.js` read the index, modify in memory, and write back. Two concurrent synthesis calls can drop an index entry (last write wins). Cheapest mitigation is a rebuild-index utility that regenerates `index.json` from a blob list of the products folder, so any corruption is recoverable in one call. Real fix (compare-and-swap or single-writer queueing) can wait for real multi-user evidence.
- **N+1 reads on re-synthesis lookup.** `synthesizeAndPersistProduct` finds the existing record for a source by iterating every product and reading each full record to check `provenance.source_ref`. Adding `source_ref` to the index entry makes the lookup one read. Fine at three products, ugly at forty SKUs.
- **`classifyChangeImpact` extension.** The client compares product versions directly to power the affected-outputs cards. If any headless consumer of `classifyChangeImpact` in `package.js` needs product-aware impact classification, that piece was not extended. Small piece of tidying.
- **Vision handling for image-dense product briefs.** The evaluation used a text-legible PDF. A design-heavy brief may need the vision path exercised before the schema is trusted on it. Worth a second test source.
- **Text extraction at intake, not synthesis.** Every synthesis call re-parses the same PDF via `normalizeSourcesForSynthesis`. Persisting extracted text on the source record at intake would remove this cost. Cheap, not urgent.
- **Product picker across other production surfaces.** Sales enablement is the first consumer. Social image, ad image, and website image flows do not yet expose the product picker. When those flows need product-specific claims, wiring the picker follows the same pattern.
- **Product record deletion, revision history browsing, batch approval.** Polish for when a real client hits the need.
- **Cross-session persistence for candidate rules.** Still session-scoped. Unchanged from the sprint close handoff.
- **Old outputs with unusable `imagePublicUrl` values.** Cosmetic. Not related to this phase but still present.

## Commits landed this phase, in order

- `4ecb393` feat: ADR 0012 step 2, product record schema, store, and service
- `c2c3a70` feat: ADR 0012 step 3, product brief intake tagging
- `8ea3ad5` feat: ADR 0012 step 4, product-scoped compilation
- `bdd5d43` feat: ADR 0012 step 5, product management surface
- `cdae93d` feat: ADR 0012 follow-ups, in-UI product synthesis and version drift

Plus corresponding `chore: trigger deploy` commits reusing each tree SHA to trigger the Vercel webhook.

### Post-close fixes

- `0adf4c3` fix: prevent loadProducts render loop when product list is empty (partial, insufficient)
- `90b2d67` fix: stop loadProducts render loop completely (concurrent-call guard, failure idempotency, remove auto-load from workspace and chooser)
- `c6b5f2a` docs: capture learning from loadProducts render loop incident
- One more fix commit landed this session restoring `approveProduct` in `src/products/service.js`, extending `product-record.schema.json` with the operational metadata fields the service actually writes, and moving `void loadProducts()` out of `renderSalesSetup` per the incident rule. External code review caught all three.

## What not to change without discussion

- **The frozen product record contract** at `schemas/v1/product-record.schema.json`. Field name changes, cardinality changes, or new required fields need a schema version bump and a plan for migrating existing candidate records.
- **The formal compiler** at `src/compiler.js` and its schemas in `schemas/v1/`. The live path (package.js) and the target-state path (compiler.js) remain parallel. Merging them is deliberate future work, not incidental change.
- **The three distinct approval actions.** Approve output, approve guidance, promote to canon. Product record approval is the "approve guidance" flavor and stays distinct from the other two.
- **The candidate-rule-queue pattern.** Feedback never auto-writes to the brain. ADR 0010 governs this. Product records follow the same discipline: every synthesis produces a candidate, review is required, approval is explicit.
- **The 12-function ceiling.** Adding a new serverless function requires either freeing a slot elsewhere or moving to Vercel Pro. Grey's preference has been to consolidate; new operations dispatch through existing handlers.

## First action for the next chat

The phase is complete. Two natural next moves, depending on what Grey wants to pursue:

- **A second real product brief.** The Dialog Health test proved evidence fidelity on a text-legible deck. A design-heavy or multi-product brief would exercise the vision path and stress the schema in the honest way the evaluation memo said it hadn't been stressed yet.
- **A new roadmap slice.** Roadmap items 5, 6, 13, or 14 (preservation/fidelity levels, copy governance, reusable creative directions, effort transparency) were never in ADR 0012 scope. Any of these would open a new phase.

Grey values finishing work properly before moving on. If he asks about the next step, offer the choice rather than picking for him.
