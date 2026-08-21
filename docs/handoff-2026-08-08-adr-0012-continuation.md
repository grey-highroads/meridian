# Handoff: ADR 0012 continuation, step 2 onward

- Date: 2026-08-08
- Prior session: template intake, sales enablement flow, input handler bug fixes, ADR 0012 authored, prototype built and passed
- Repository: `github.com/grey-highroads/brand-world-system`, branch `main`
- Deployment: Vercel Hobby plan, deploy count sits at 12 of 12 serverless functions (ceiling reached, see follow-ups)

## Read these first, in order

The next agent should read these before touching code. Reading order matters: the ADR states the decision, the evaluation memo records the evidence that made it safe to proceed, and the prototype code shows what actually works.

1. `docs/decisions/0012-model-products-as-governed-records.md`. The full decision, its context, and the five-step sequencing.
2. `docs/evaluations/2026-08-08-adr-0012-product-synthesis.md`. The evaluation that cleared step 1's evidence-fidelity gate. Read the "What this evaluation does not prove" section carefully, it lists the honest limits of what today's test earned.
3. `src/products/schema.js`. The draft product record schema. This is what step 2 graduates.
4. `src/products/prototype-provider.js`. The synthesis provider that produced the passing record. Reuses `collectChatCompletionStream` and `extractChatCompletionText` from the brain synthesis path.
5. `api/products/prototype.js`. The throwaway endpoint. Preserves the working normalization and vision handling pattern. Delete this file when the real product record path lands.
6. `src/brand-brain/service.js` and `chat-completions-provider.js`. The reference implementation for how the brain synthesizes, incrementally updates, and persists. The product record store should follow the same discipline where it applies and diverge where it should (per-record versioning, not monolithic re-emission).
7. `src/clients/store.js` and `src/brand-brain/store.js`. The pattern for client-namespaced Vercel Blob storage per ADR 0011. The product record store must follow this pattern.

## Where we left off

**Step 1 of ADR 0012 is complete and passed.** The prototype synthesis produced a full product record from the Dialog Health RCS deck with seven-for-seven verbatim claim language, correctly detected Version 2 conditionality, correctly excluded demonstration content (Wynter Health), and returned substantive exclusions and review questions. The evaluation memo documents the check.

**Steps 2 through 5 are unblocked.** The next work is:

- **Step 2:** Product record schema graduates from `src/products/schema.js` to `schemas/v1/product-record.schema.json`. Product record store, namespaced per client per ADR 0011, versioned independently of the brain. The draft schema shape as it stands passed the evaluation and does not need refinement based on today's test.
- **Step 3:** Intake tagging for product-brief sources. Follows the pattern established for templates this session: a new material type in `sourceMaterialTypes`, association with a named product, exclusion from brain synthesis, routing to per-product synthesis.
- **Step 4:** Product-scoped compilation in `src/production/package.js`. When a job names a product (the sales enablement flow's feature field is the first consumer), resolve the product record and inject its knowledge alongside brand-level context. The scope object recorded on the package should use `product_ids`, matching the frozen contracts in `schemas/v1/common.schema.json` and `src/compiler.js`.
- **Step 5:** Product management surface (list, review, approve). Consumption records and change-impact classification extended to product scope.

## The seams the next agent needs to know about

**Two compilers, one repo.** `src/compiler.js` is the frozen v1 entity compiler from the Riggg lineage. It already knows how to filter by `product_ids` scope. It is not on the live path; only fixtures exercise it. `src/production/package.js` is the live compiler used by the sales, social, template, and other production flows. Step 4 adds product resolution to `package.js`, not to `compiler.js`. This is a deliberate convergence step: the live path adopts one more piece of the target-state shape (product scoping) without taking on the full compiler migration.

**Two brain states, live vs. target.** The live brain is six fixed guidance sections plus three artifacts, synthesized monolithically. The target brain in the v1 contracts is a flat entity array. Products are being modeled outside the brain document specifically because putting them inside the monolithic brain would fail on the incremental-synthesis scaling wall (documented in ADR 0012 context). Do not, under any circumstances, add products as a field inside the brain schema in `src/brand-brain/schema.js`.

**Namespacing per ADR 0011.** All product records live under `brand-world-system/clients/{clientId}/products/{productId}/...` in Vercel Blob. The `resolveClientId` seam in every API route is a security placeholder waiting for real auth (Jim's territory). The pattern is already established by the brain and template stores; follow it.

**The 12-function ceiling.** Vercel Hobby caps at 12 serverless functions per deployment. When exceeded, the entire deployment silently fails to build. We hit this once this session (unblocked by merging `api/blob/read.js` into `api/blob/upload.js` as `mode: "read"`). Step 5 will likely need at least one new endpoint (product record CRUD). Options in order of preference: merge product endpoints into a single dispatching handler at `api/products/index.js`; consolidate an existing endpoint further; or move to Vercel Pro. Do not add functions blindly.

## The prototype code and what to do with it

The three files (`src/products/schema.js`, `src/products/prototype-provider.js`, `api/products/prototype.js`) are marked as prototype and were pushed with that framing. Do not evolve them in place. The correct move is:

1. Author the graduated schema at `schemas/v1/product-record.schema.json` as a JSON Schema 2020-12 document following the shape of the frozen v1 contracts. The draft in `src/products/schema.js` was written in the brain-brain style (JavaScript builders). The frozen contracts are declarative JSON. Match the frozen style.
2. Author the production synthesis path in `src/products/service.js` (or similar), reusing `collectChatCompletionStream` and `extractChatCompletionText` from the brain provider, following the shape of `src/brand-brain/service.js` including its persistence and versioning discipline. Persist each product record under its own key so incremental synthesis touches one record, not the whole catalog.
3. Delete the prototype files (`src/products/schema.js`, `src/products/prototype-provider.js`, `api/products/prototype.js`) in the same commit that lands the real path. Removing them frees a serverless function slot and prevents confusion.

## Rules that carried this session and should carry forward

**Verified, Reasoned, Assumed.** Confidence discipline saved us from confabulation on the compiling strategy and the seams review. Every architectural claim should still be labeled. Grey has explicitly corrected fabricated competitive analysis in the past and expects verified sources over speculation.

**No em dashes.** Applies everywhere including code comments, commit messages, ADRs, and evaluation memos. Confirmed multiple times.

**Peer-to-peer language.** Interface copy uses the user's words, not architecture terms. "Needs approval," not "lifecycle: proposed." This applies to product record fields too: `oneTrueThing`, `approvedClaimLanguage`, `accuracyNote`, `benefit` are all deliberately marketer-legible names. Do not architecture-fy them.

**Build-then-refine.** Grey reviews the live deployed app, not the JavaScript. Push, let him look, react to real output. Do not spec screens in prose before making them.

**Chief architect framing.** Grey has explicitly named the assistant as chief architect of the system and thought partner. This is not decoration; the responsibility is to hold the whole product vision, not just the current slice. Every step in this ADR sequencing should be evaluated against how it lands for founders, owners, marketers, salespeople, and distributors in everyday use. Slice value and system value are both real.

## Known follow-ups, not blocking

These were noted in the evaluation memo and are worth naming here so they do not fall out of context:

- **Vision handling for image-dense sources.** Today's deck was text-legible at 2,630 characters. Product briefs are often design-heavy PDFs. Worth building a second test source and evaluating whether the vision path in the pipeline handles them well before assuming step 2's schema shape is safe for all sources.
- **Text extraction at intake, not synthesis.** `normalizeSourcesForSynthesis` runs every time synthesis is invoked, recomputing PDF extraction on each call. Persisting extracted text on the source record at intake would remove this cost and simplify per-product synthesis. Worth doing before step 2 hardens.
- **Old outputs with unusable `imagePublicUrl` values.** Cosmetic. Every generated output that existed before this session's private-blob fix still has an unusable stored URL and 403s on page load. Small backfill or a client-side hardening fix. Not urgent but noticeable.
- **`imagePublicUrl` cleanup on new outputs.** The service now stores `imagePublicUrl: null` deliberately so the presigned URL fallback fires. If step 4 adds any new image-persistence code, follow this pattern.

## Commits landed this session, in order

- `c6ca0fde` feat: compose sales element onto locked template (OpenAI path)
- `c1701ede` fix: studio input handlers wired to wrong events
- `c180b238` docs: ADR 0012, model products as governed records
- `950556c7` feat: ADR 0012 step 1, product synthesis prototype
- `d81b280f` fix: drop source-normalizer import from prototype endpoint (later reverted)
- `6c502910` fix: merge blob/read into blob/upload (function count)
- `ae1dc753` fix: restore normalizer in prototype endpoint
- `5f4bb21a` docs: evaluation memo for ADR 0012 product synthesis prototype

## First action for the next chat

Read the ADR, the evaluation memo, and the prototype files in the order above. Then confirm the schema-graduation plan (JSON Schema 2020-12 at `schemas/v1/product-record.schema.json`, drop the draft caveat, delete the JavaScript draft) with Grey before writing code. He may want to add fields the evaluation surfaced as valuable but the draft schema does not carry (audienceNote and category were both substantive in the evaluated record; both are present in the draft).

Grey values finishing work properly before moving on. Step 2 is a clean piece of work; take it end to end (schema, store, tests, commit) before starting step 3.
