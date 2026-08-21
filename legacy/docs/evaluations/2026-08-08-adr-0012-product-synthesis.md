# Evaluation: ADR 0012 product synthesis prototype

- Date: 2026-08-08
- Author: Higher Roads
- Status: Passed. Evidence-fidelity gate cleared.
- Related: ADR 0012 (model products as governed records outside the brain document)

## What this memo is

ADR 0012 conditioned every downstream step on one gate: a prototype of per-product synthesis that carries the brain's evidence discipline into a scoped product record. This memo records the evaluation that gate produced, the specific checks that were run, and the finding that unblocks the rest of the ADR's sequencing.

The prototype code is throwaway (`api/products/prototype.js`, `src/products/prototype-provider.js`, `src/products/schema.js`) and remains in the repository for reproducibility. It persists nothing.

## The test

**Source.** The Dialog Health RCS Presentation, Phase 1 & 2. A three-page PDF: title page, one Phase 1 content slide, one Phase 2 content slide. Modern PDF with a real text layer. Uploaded during the Dialog Health brain build, stored as source `file-1786137927612`.

**Method.** The prototype endpoint pulled the source from the brain store, ran it through the same `normalizeSourcesForSynthesis` used by brain synthesis (2,630 characters extracted, no vision entries), and passed the normalized register to a scoped-down synthesis call using the same OpenAI chat-completions pipeline as brain synthesis. Model: gpt-5.6-sol. Response parsed against the draft product record schema.

**Iterations.** Three runs were required to reach a valid test. The first two runs returned a nearly empty record because the endpoint bypassed the normalizer to avoid a bundling risk that turned out not to exist. The bundling problem we thought we were seeing was actually the Vercel Hobby plan's 12-serverless-function limit, which silently killed the deployment when the prototype tipped the count to 13. Merging `api/blob/read.js` into `api/blob/upload.js` (as a `mode: "read"` branch) freed a slot. Restoring the normalizer produced the run this memo evaluates.

## What the record contained

Full response object retained in project chat history. Summary:

- **oneTrueThing:** "Dialog Health uses RCS to deliver branded healthcare mobile messages with interactive actions, rich media, read receipts and multilingual communication."
- **productName / category / audienceNote:** all substantive, scoped to healthcare organizations sending screening outreach, appointment scheduling, confirmations, reminders, and intake forms.
- **features:** seven, corresponding one-to-one to the deck's feature callouts (Verified Sender, brand customization, delivery/read receipts, action links, rich media, one-tap CTAs, multilingual).
- **exclusions:** four, each a real production risk drawn from the deck's own limits.
- **reviewQuestions:** five, at High or Medium confidence, targeting the deck's actual gaps.
- **visualDirection:** constrained to what the deck depicts (mobile healthcare message conversation, branded sender, logo, read status, trackable form).

## Verbatim audit

The `approvedClaimLanguage` field is the discipline the whole ADR turns on: the model must return exact verbatim text from the source or an empty string. Composed claim language would compromise every downstream sales collateral produced from the record.

Every one of the seven feature entries was audited against the source. Each `approvedClaimLanguage` string was located in the deck as a byte-for-byte match, including preserved layout line breaks. The audit was conducted with the source PDF open alongside the returned record.

| Feature | Model output | Located in source | Match |
| --- | --- | --- | --- |
| Verified Sender | "Verified Sender" | Slide 1 and slide 2 header | Verbatim |
| Brand customization | "Customized with your\nlogo and brand colors" | Slide 1 under Verified Sender | Verbatim |
| Read receipts | "Know when a\nmessage was read by\nits recipient" | Slide 1 under Delivery and Read Receipts | Verbatim |
| Action links | "trackable short links\nor digital forms" | Slide 1 under Action Links (phrase excerpted from full sentence) | Verbatim within excerpt |
| Rich media | "Include videos, images, gifs,\nstickers and other\ninteractive elements" | Slide 2 under Rich Media Cards | Verbatim |
| One-tap CTAs | "One-tap calls-to-action\nmake next steps a breeze" | Slide 2 under Suggested Actions | Verbatim |
| Multilingual | "Dialog Health gives you\n130+ languages at your\nfingertips" | Slide 2 under Multi-Language | Verbatim |

Result: **seven of seven verbatim.** No composed claim language. The layout newlines in the deck are preserved in the output, which is a helpful signal that the model is quoting rather than paraphrasing.

## Stated versus inferred audit

Every feature carried an `origin` field marked `stated` or `inferred`, and an `accuracyNote` explaining the reasoning where inference was involved. Two specific behaviors were checked:

**Version 2 conditionality.** The Phase 2 content slide carries a yellow "Version 2" badge. Features 4, 5, and 6 (Rich Media Cards, Suggested Actions, Multi-Language) all appear on that slide. The model applied the same `accuracyNote` to all three: "This capability appears under 'Version 2.' The source does not state whether Version 2 is currently available or planned." That's a direct read of the deck's own labeling. Correct.

**Inference honesty.** Feature 0 (Verified Sender) carries the note "The source names 'Verified Sender' but does not explain how verification works; that context is inferred from adjacent branding language." Audit of the deck confirms: "Verified Sender" appears as a header with supporting phrases about branding, but the deck never defines verification, who verifies, or what is guaranteed. The model correctly labeled its extension of the concept as inference rather than fact from source.

## Demonstration content handling

The deck uses "Wynter Health" throughout as a fictional healthcare organization to demonstrate what a message thread looks like. "Wynter Health" appears in mocked screenshots on both content slides.

The product record contains no reference to Wynter Health. The model correctly distinguished demonstration content from product content, which is one of the brand brain's stated rules for Dialog Health (distinguish Dialog Health branding, client branding, and fictional demonstration branding).

## Exclusions produced

The four exclusions are the highest-leverage output in the record for downstream production. Each was audited against the deck:

1. "Do not present Phase 2 or 'Version 2' capabilities... until their current release status is confirmed." Traces to the Version 2 badge on slide 2. Correct.
2. "Do not claim a quantified improvement in engagement without a supporting study." Traces to the deck's line "which improves engagement and response rates" with no accompanying figure or study. Correct.
3. "Do not overpromise Verified Sender." Traces to the absence of a working definition of verification in the deck. Correct.
4. Multilingual capability caveat. Traces to slide 2 stating "130+ languages" without describing translation method, quality controls, or availability. Correct.

Each is a real production risk that a governed collateral system should prevent.

## Review questions produced

Five review questions were returned at High or Medium confidence, targeting the deck's actual evidentiary gaps: current availability of each feature, technical evidence for security claims, source of the engagement improvement claim, what Verified Sender specifically guarantees, and how multilingual actually works. These are the questions a good product marketer would ask a product manager before writing a one-pager. They are not filler.

## Finding

The evidence-fidelity gate is cleared. The scoped-down synthesis reused the brain's discipline without loss. The record structure produces artifacts (approved claim language, exclusions, review questions, version-conditional accuracy notes) that are directly useful to downstream sales and marketing collateral production. Nothing was invented, nothing was silently improved, and demonstration content was correctly excluded from product content.

## What this evaluation does not prove

Named honestly so we do not mistake this for more than it is:

- **One source, one product.** A B2C or multi-product source has not been tested. Product briefs that mix multiple products in one document may confuse the scoping.
- **Text-legible PDF.** Sources that carry most of their meaning in imagery (design-heavy decks, PDFs of scanned brochures) have not been tested. The vision path is available in the pipeline but was not exercised here.
- **One model, one day.** Model behavior on a single run is not a regression baseline. The prototype does not include an evaluation harness.
- **No compilation integration.** The record was not yet consumed by the production compiler. The next steps in ADR 0012 sequencing include product-scoped compilation, which is where the record's real production value gets tested.
- **contentLength was 2,630 characters.** A dense two-content-slide deck. Sources at 15,000+ characters may surface different failure modes at the schema boundaries (feature array cap, review question cap).

## Unblocks

Per ADR 0012 sequencing:

1. ~~Prototype per-product synthesis.~~ **Passed.**
2. Product record schema and store (namespaced per client per ADR 0011).
3. Intake tagging for product-brief sources.
4. Product-scoped compilation in the live compiler.
5. Product management surface and change-impact extension.

Steps 2 through 5 may proceed. The draft schema (`src/products/schema.js`) should graduate to `schemas/v1/product-record.schema.json` with the `draft` caveat removed, and the schema shape as currently drafted may be committed based on this evaluation.

## Follow-ups noted, not blocking

- **Vision handling for image-dense sources.** The 2,630-character extraction was rich enough here because the deck was text-legible. A design-heavy PDF may need vision-based synthesis. Worth building a second test source and evaluating.
- **Text extraction at intake, not synthesis.** Currently `normalizeSourcesForSynthesis` runs every time synthesis is invoked, which recomputes PDF extraction on each call. Persisting extracted text on the source record at intake would remove this cost and simplify the prototype endpoint's structure. Worth doing before step 2 hardens.
- **The 12-function Vercel Hobby ceiling.** Freed one slot by merging blob endpoints; further growth will hit the same ceiling. Either upgrade to Pro when the fifth or sixth new endpoint is planned, or consolidate more aggressively.
- **Old outputs with unusable `imagePublicUrl` values.** Not related to this evaluation but surfaced during it. Cosmetic problem, small backfill or a client-side hardening fix, not urgent.
