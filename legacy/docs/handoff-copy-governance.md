# Handoff: copy governance (roadmap item 6)

- Date: 2026-08-09
- Prior phase: ADR 0012 products, complete and hardened, plus a product detail UX pass
- Repository: `github.com/grey-highroads/brand-world-system`, branch `main`
- Next slice: copy governance, roadmap item 6
- Posture: direction and open questions, not a committed build plan. Scope with Grey before writing code.

## Why this slice

Products now carry `approved_claim_language` per feature, verbatim from the source, gated by review and approval. That proved the evidence-fidelity model for one narrow case: product feature claims. But copy at large is ungoverned. The system will generate or accept a LinkedIn post, an ad headline, a caption, or body copy and check it against nothing. For a regulated healthcare client like Dialog Health, an unapproved claim or a missing disclosure is the real risk surface, more than any visual error. This slice makes copy a governed material the way products and assets already are.

It also compounds. The product record already holds approved claim language and per-product exclusions. Copy governance should consume those, not duplicate them. A product's approved claims are the seed of the brand's approved-claims list scoped to that product.

## What exists today, verified

Read these before scoping. The current state is honest starting material, not a governed system.

- **`api/production/generate-copy.js`.** Generates LinkedIn post copy. Pulls voice, foundation, world, and rules guidance from the approved brain and builds a system prompt. It never checks its output against an approved or prohibited list. There is no claim audit on generated copy.
- **Studio caption field (`app/app.js`, `state.studio.caption`).** A free-text field the user can fill or leave blank to draft from the brain. Ungoverned. Whatever the user types ships.
- **Product `approved_claim_language`.** Per-feature verbatim claims on the product record, plus per-product `exclusions` (things production must not claim or depict). These are the only governed claim data in the system today. They flow into the image prompt via `compileProductSection` in `package.js`, but nothing governs text output against them.
- **Brain `rules` guidance section and `dossier.guardrails`.** The brain holds prose rules and structured guardrails (title plus body). `auditConstraints` in `prompt-craft.js` does a substring presence check of guardrails against the compiled image prompt. This is the closest thing to a claim check that exists, and it is for images, not copy.
- **Brain `dossier.productTruth` (single string) and `dossier.proof` (2 to 6 strings).** Brand-level product framing. Not claim governance.

Net: claims live in three disconnected places (product records, brain rules prose, brain guardrails), none of them is a queryable approved/prohibited claims list, and no copy path checks output against any of them.

## The direction

Copy governance should mirror the discipline the rest of the system already uses, not invent a new one. That means:

- **Claims as governed entities**, with approved language, prohibited language, and required disclosures, each traceable to a source and each carrying scope (brand-wide, product, campaign, channel). The product record's `approved_claim_language` is the per-product case of this; the brand needs the general case.
- **A copy audit at production time**, the text analogue of `auditConstraints`. When copy is generated or entered, check it against the approved and prohibited lists for the job's scope, and confirm required disclosures are present. Surface findings in preflight and evaluation the way image constraints already surface, including the approved-but-incomplete warning pattern products just established.
- **The three-way approval discipline holds.** Approved claim language is "approve guidance." Nothing auto-writes. A generated claim that is not on the approved list is a finding, not a silent pass.
- **Marketer-legible throughout.** "Approved claim," "Do not say," "Required disclosure," not "claim entity" or "governance scope."

## Open questions to settle before building

These are genuine forks. Do not pre-decide them; settle them with Grey first.

1. **Where do brand-level claims live?** Three options, each with real consequences.
   - Inside the brain document, as a new structured section. Risk: the same monolithic-synthesis scaling wall that pushed products out of the brain (see ADR 0012). Claims that grow over time do not belong in a re-synthesized document.
   - As their own governed store, the way products and templates are. Consistent with the ADR 0012 pattern, versioned independently, but a third parallel store to maintain.
   - Derived: brand claims are assembled from product records plus a thin brand-level list. Least duplication, but the assembly logic is a new seam.
   The ADR 0012 reasoning strongly suggests option two or three over option one, but that is a decision to make explicitly, probably as its own ADR.

2. **What is a "claim" versus ordinary copy?** A prohibited-claims check needs a definition of what to check. Every sentence? Only sentences that assert a benefit, a statistic, a comparative, or a regulated property? Over-checking floods the reviewer; under-checking misses the risk. The product synthesis already distinguishes claim language from description; that heuristic may transfer.

3. **Generated copy versus entered copy.** Generated copy can be steered by the prompt (tell the model the approved claims and prohibitions up front). Entered copy can only be checked after the fact. Do both paths get the same audit, or does generated copy get prevention and entered copy get detection? Probably both get the post-hoc audit and generated copy additionally gets the prompt-level steer.

4. **Disclosures: presence or correctness?** Checking that a required disclosure string is present is mechanical. Checking that it is the *correct* disclosure for the claim being made (for example, a specific regulatory disclaimer tied to a specific health claim) is a mapping problem. Start with presence, or take on the mapping? Presence is the honest first slice.

5. **Scope resolution reuse.** Products introduced product scope. Campaigns already exist as a scope. Copy governance needs to resolve which claims apply to a given job (this product, this channel, this campaign). The applicability model from roadmap item 3 was only ever built for channel and placement on images. Does copy governance extend that resolver, or does it need its own? This connects to the long-deferred item 3 schema work.

6. **First consumer.** Which copy path gets governance first? The LinkedIn generate-copy endpoint is the most self-contained and already pulls brain guidance, so it is the natural pilot. Ad copy is where governance matters most (paid claims carry the most risk) but the ad flow does not generate copy yet. Recommendation to discuss: pilot on generate-copy, design for ad copy.

## Suggested sequencing, to confirm not follow

1. Write an ADR for where brand claims live (question 1). This is the load-bearing decision; everything else depends on it.
2. Prototype the copy audit against real Dialog Health copy, the way ADR 0012 prototyped product synthesis before committing a schema. Prove the claim-detection heuristic (question 2) works before building the store.
3. Claim store and schema, following whatever the ADR decides.
4. Copy audit at production time, surfaced in preflight and evaluation.
5. Wire the first consumer (generate-copy), then design for ad copy.

Mirror the ADR 0012 rhythm: decision, then evidence prototype, then schema, then compilation, then surface. That rhythm worked; the evaluation memo that gated the product schema saved real risk.

## Rules that carry forward

- **Verified, Reasoned, Assumed** labels on every architectural claim. Grey corrects fabrication and expects verified sources.
- **No em dashes** anywhere, including code comments, commit messages, ADRs, and this document's successors.
- **Peer-to-peer, marketer-legible UI copy.** Schema field names never surface in the interface.
- **Build-then-refine.** Grey reviews the live deployed app, not the JavaScript. Push, let him react.
- **Fetch every file fresh before editing.** Two regressions this phase came from stale-copy overwrites. The rule is in `docs/ui-contribution-guide.md` and it is load-bearing.
- **Verify against a fresh browser session before considering a thing shipped.** Two failures this phase were invisible at push time (the render loop, the deleted export). The incident doc at `docs/incidents/2026-08-09-loadproducts-render-loop.md` establishes this.
- **The 12-function Vercel Hobby ceiling.** Currently at 12 of 12. Any new endpoint requires consolidating into an existing dispatching handler (the `api/products/index.js` pattern) or moving to Pro. Copy governance should dispatch through an existing handler, not add a function.

## Known follow-ups carried from the products phase, not blocking this slice

- **Index read-modify-write races** in the product store (`writeProduct`, `deleteProduct`). Low risk single-steward, real under concurrency. A rebuild-index utility is the cheap mitigation.
- **N+1 read on product re-synthesis lookup.** Add `source_ref` to the index entry to make it a single read. The store now also indexes `open_questions`, so the index write path is already being touched.
- **A lint pass for class names used in markup but undefined in either stylesheet.** Three spacing bugs this phase (collapsible bodies, Summary body, `.page-actions`) were all the same failure: a class carrying layout meaning with no CSS behind it. A grep-level check in CI would have caught all three.
- **Cross-session persistence for candidate rules.** Still session-scoped, unchanged since the sprint close.
- **Old outputs with unusable `imagePublicUrl`** 403 in the console on load. Cosmetic, a small backfill or client hardening.

## First action for the next chat

Read this document, then `docs/decisions/0012-model-products-as-governed-records.md` and `docs/evaluations/2026-08-08-adr-0012-product-synthesis.md` for the pattern to mirror, then the three copy surfaces named under "What exists today." Then settle the six open questions with Grey before writing anything. The first artifact is an ADR for question one, not code.
