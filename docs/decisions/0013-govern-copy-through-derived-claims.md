# ADR 0013: Govern copy through derived claims and a copy audit

- Status: Accepted (mechanism test passed 2026-08-09; amended 2026-08-10 after first beta-client output, see Revision: 2026-08-10)
- Date: 2026-08-09
- Owner: Higher Roads
- Supersedes: Nothing
- Related: ADR 0012 (products as governed records), ADR 0003 (compile and snapshot production policy), ADR 0010 (route feedback through candidate rules)

## Context

The system governs visual production through compiled prompts, constraint audits, protection blocks, and locked asset handling. Copy is ungoverned. The LinkedIn generate-copy endpoint pulls voice and rules from the brain and builds a system prompt, but it never checks its output against an approved or prohibited claims list. The studio caption field accepts free text with no validation. A generated post that invents a health claim, drops a required disclosure, or contradicts a product's approved language ships without detection.

For a regulated healthcare client like Dialog Health, an unapproved claim or a missing disclosure is the real risk surface, more than any visual error. Copy governance is the text analogue of `auditConstraints`: check what was produced against what the brand actually permits.

Three findings from the current codebase shape this decision.

**First, claims already live in three disconnected places.** Product records carry `approved_claim_language` per feature and per-product `exclusions`. The brain's `rules` guidance section carries prose rules. The brain's `dossier.guardrails` carry structured title/body pairs that `auditConstraints` checks against the image prompt. None of these is a queryable approved/prohibited claims list, and no copy path checks output against any of them.

**Second, the product record's evidence-fidelity discipline transfers directly.** ADR 0012's evaluation proved that per-product synthesis preserves verbatim claim language (seven-for-seven against the Dialog Health RCS deck) and correctly distinguishes stated from inferred content. The same discipline applies to copy governance: approved language must be exact, prohibited language must be enforced, and the system must surface findings rather than silently passing.

**Third, the brain document cannot absorb a growing claims list.** The same incremental-synthesis scaling wall that pushed products out of the brain (ADR 0012) applies to claims. A variable-length approved-claims list inside the brain document would require every re-synthesis to reproduce every prior claim verbatim. Cost grows with the list, and the model's paraphrase risk on exact claim language is the highest-stakes failure mode in copy governance.

## Decision

Copy governance uses a **derived claims model**: the set of governed claims for any production job is assembled at compilation time from two sources, not stored as a third parallel entity catalog.

**Source one: brand-level claims document.** A thin per-client JSON document stored alongside the brain and product records, namespaced per ADR 0011. It carries three lists: approved claims (brand-wide assertions the brand has cleared for use), prohibited claims (assertions production must never make), and required disclosures (statements that must appear when certain content types are produced). Each entry carries verbatim text, scope (brand-wide, channel, campaign), a source reference, an added-on date, and the identity of the person who added it. If an entry is revised, the prior version is retained with a superseded-on date. The document itself carries a version number bumped on any edit, matching the versioning discipline on product records. This document is authored by humans (from brand guides, legal review, regulatory requirements), not synthesized from sources. It is reviewed and approved through the existing "approve guidance" action.

**Source two: approved product records.** Each approved product record's `approved_claim_language` entries and `exclusions` entries flow into the claims set for any job scoped to that product. No duplication, no sync mechanism. The product record is the source of truth for product-scoped claims. If a product record's approval is cleared (after re-synthesis or revision), its claims exit the derived set automatically.

**Assembly at compilation time.** When a production job compiles its generation package, the compiler assembles the governing claims set: all entries from the brand-level claims document whose scope matches the job, plus all entries from the job's product record (if any). The assembled set is included in the generation package for audit and prompt steering. Assembly is a union of two reads, not a transformation. Nothing is paraphrased, merged, or reconciled during assembly.

**Copy audit at production time.** When copy is generated or entered, the system checks it against the assembled claims set. The audit uses the model itself to detect claim-like sentences in the output (assertions of benefit, capability, statistic, comparative, or regulatory property) and checks each detected claim against the approved and prohibited lists. The audit surfaces findings in the same shape as existing constraint audit findings: specific sentence, finding type, and the governing rule. Generated copy additionally receives prompt-level steering: the approved claims and prohibitions are included in the system prompt so the model avoids prohibited claims at generation time. Entered copy receives only the post-hoc audit.

**Approved claims are a safe harbor, not the only permitted language.** The prohibited list is a hard stop: any detected claim that matches a prohibited entry is flagged as a violation. The approved list works differently. A detected claim that matches an approved entry passes cleanly. A detected claim that matches neither list is flagged as "unapproved claim, review recommended," not as a violation. This is an advisory finding, not a blocker. Marketers write new true sentences all the time; treating every novel sentence as a violation would train reviewers to dismiss findings, and a dismissed-by-habit audit is worse than no audit because it manufactures false confidence. The prohibited list blocks. The approved list reassures. The gap between them surfaces work for the reviewer.

**Disclosures check presence, not correctness.** Each required disclosure entry in the brand-level document names its own trigger scope (for example, "appears on any paid ad" or "appears when RCS is mentioned"). The system checks whether the job's scope matches the disclosure's trigger scope, then checks whether the disclosure string is present in the output. Trigger scope is manually authored on each disclosure entry, not inferred by the system. Claim-to-disclosure correctness mapping (checking that the right disclosure accompanies the right claim) is deferred until the data entry burden proves worthwhile.

**Scope resolution extends the existing applicability resolver.** The applicability model from roadmap item 3 currently checks channel and placement. Copy governance extends it to also check product and campaign scope, which benefits both image and copy governance. This is the forcing function for the scope-resolution work that item 3 deferred.

## Why derived, not a dedicated store

A dedicated claims store (option two from the scoping discussion) would version claims independently and avoid the assembly step. But it creates a worse problem: two sources of truth for the same claim. A product record's `approved_claim_language` and a claims-store entry for the same claim would need a sync mechanism. If sync breaks or lags, production could enforce a stale version of a claim while the product record carries the current one. The derived model avoids this entirely: the product record is always authoritative for its own claims, and the brand-level document is always authoritative for brand-wide claims. No sync, no conflict, no reconciliation.

The assembly seam (a union of two reads) is the simplest possible aggregation. A claim is either in the union or it is not. The failure mode (assembly silently drops a claim) would require a bug in list concatenation, which is lower-probability than a sync mechanism falling out of date.

## Why not inside the brain document

The same argument as ADR 0012. A variable-length claims list in the brain document means every incremental re-synthesis reproduces every prior claim verbatim. Paraphrase risk on exact claim language is the highest-cost failure mode in copy governance, higher even than in product synthesis, because claims flow directly into regulated copy that carries commercial and legal exposure. The brain document is the wrong container for growing, exact-text data.

## Consequences

**Gained.** Copy production draws on governed claims instead of model invention. Product claims and brand claims share one audit mechanism without duplicating data. The applicability resolver gains product and campaign scope, closing the most common gap from roadmap item 3. The generate-copy endpoint becomes the first governed copy path.

**Accepted costs.** A brand-level claims document to create and maintain per client (thin, human-authored, not synthesized). An assembly step at compilation time (a union of two reads). The model-based claim detection in the audit introduces a judgment boundary: it may over-detect (flagging descriptive sentences as claims) or under-detect (missing implied claims). The prototype must evaluate this boundary before the schema is committed.

**Deferred.** Claim-to-disclosure correctness mapping. Ad copy governance (the ad flow does not generate copy yet). Automatic extraction of claims from existing marketing materials. Candidate-rule promotion of audit findings into the claims document (the ADR 0010 pattern applies but the mechanism is not built in this slice).

**Risks.** Claim detection quality is the make-or-break, the same way product synthesis quality was for ADR 0012. The false-positive direction is the more dangerous failure: if the audit over-flags descriptive copy as unapproved claims, reviewers learn to dismiss findings, and a dismissed-by-habit audit is worse than no audit. The prototype carries explicit pass criteria (see sequencing step 1) including a false-positive ceiling. Second risk: the brand-level claims document could grow unwieldy without curation. The document should carry a standing note that it is a curated list of consequential claims, not a transcript of everything the brand has ever said.

## Sequencing

1. **Mechanism test of the copy audit** against a synthetic claims fixture. The fixture carries prohibited claims spanning four types (quantified benefit, regulatory property, superlative comparative, capability assertion) and copy samples in three groups: verbatim violations, paraphrase violations, and adjacent non-violations. The test passes when: (a) every verbatim violation is flagged as prohibited, (b) every paraphrase violation is flagged as prohibited, (c) no adjacent non-violation is flagged as prohibited, and (d) the audit-error path is exercised and distinguishable from a clean pass. See `fixtures/copy-audit-fixture.json` and `fixtures/copy-audit-mechanism-test.mjs`.
2. **Brand-level claims document schema and store**, namespaced per client, thin and human-authored. Three sections: approved, prohibited, disclosures. Each entry carries text, scope, source reference, and date.
3. **Assembly function in the compiler.** Union of brand-level claims (scope-matched) and product claims (product-matched). Included in the generation package.
4. **Copy audit wired to generate-copy.** Prompt-level steering (claims and prohibitions in the system prompt) plus post-hoc audit on the output. Findings surfaced in the response.
5. **Applicability resolver extended** to handle product and campaign scope alongside channel and placement.
6. **Copy audit surfaced in preflight and evaluation** for image+copy production flows (social image with caption, future ad copy).

## Revision: 2026-08-09

**Finding:** The original step 1 pass criteria (false-positive ceiling below 20%, advisory-findings quality check) were calibrated at client granularity against Dialog Health copy. A code review identified this as a platform-mechanism-versus-client-calibration mismatch: tuning the claim-detection boundary against one regulated healthcare client's copy patterns risks encoding that client's distribution into a global rule. This is the over-prescription failure mode the project has already learned from (PWP).

**Change:** Step 1 is replaced by a fixture-based mechanism test covering the prohibited-match hard stop and audit-failure semantics. These are platform invariants that hold regardless of client. The original criteria (c) and (d) are deferred, not dropped: they run when real client production volume provides a distribution to calibrate against. Until then, the safe-harbor design contains the over-flagging risk at the product level (unapproved findings are advisory, never blocking).

**Scope-matching fail direction.** The same review identified that scope matching on approved claims failed open: a claim scoped to product X passed into every job with no product, leaking product-specific safe-harbor language into unscoped jobs. Fixed by making the fail direction asymmetric: approved claims and disclosures fail closed (excluded when the job lacks the scoped axis), prohibited claims fail open (included, because over-blocking is the safe error). See `src/scope/resolver.js`.

## Revision: 2026-08-10

The first governed caption produced for the beta client through the ADR 0014 flow surfaced three faults. All three are recorded here rather than designed around, because two of them contradict the pass criteria this ADR was accepted on.

**Finding one: the prohibited list holds two different kinds of thing.** The audit returned a violation against the sentence "no extra apps needed", citing the rule "Do not depict an app download as necessary." The copy complies with that rule. It was flagged because it discusses the same subject.

The cause is a category error in assembly, not a detection failure. Product record `exclusions` were pushed wholesale onto the prohibited-claims list, but an exclusion can be either a claim string or a directive. "HIPAA compliant" is a claim string: stating it is the violation, and an auditor can match against it. "Do not depict an app download as necessary" is an instruction to the generator, with no claim to match. Handed a directive and told never to state or imply it, the model can only match on topic.

This reasoning was already recorded in the codebase and was not carried across. A comment in `generate-copy.js` explains that brain guardrails steer generation but are deliberately excluded from the audited prohibited list, because prose rules like "Never clinical" are not claims and auditing them adds noise. Product exclusions needed the same treatment and did not get it.

**Change.** `assembleClaimsSet` now returns a fourth list, `directives`. Imperative-shaped exclusions route there, steer generation through their own prompt section, and are never handed to the claim auditor. Claim-shaped exclusions continue to the prohibited list unchanged. The classification test is deliberately narrow: only a clearly imperative opening counts, so an ambiguous entry stays on the prohibited list and gets audited. That fail direction is consistent with the asymmetry established on 2026-08-09, where over-blocking is the safe error.

**Known limit.** A directive-shaped exclusion now governs generation but is not audited, so the copy is steered away from the prohibited territory without a post-hoc check. Converting directives into claim strings that can be audited is client-side curation work on the claims document, not a platform change. This is a real reduction in audit coverage and is accepted knowingly rather than hidden.

**Finding two: the claim definition made nearly all marketing copy a claim.** The audit returned five advisory findings on a nine-sentence caption, flagging "trust and clarity", "designed for action", and "ease and efficiency". The original definition counted any sentence asserting a benefit, a capability, or a comparative advantage. Marketing copy asserts general benefit almost continuously, so under that definition most sentences qualify.

This is the failure this ADR named as make-or-break: the risks section states that if the audit over-flags descriptive copy, reviewers learn to dismiss findings, and a dismissed-by-habit audit is worse than no audit. It arrived on the first real output.

**Change.** The claim test becomes falsifiability. A claim is a sentence specific enough that a reader could check it and find it false. General benefit language asserting ease, trust, clarity, confidence, simplicity, or efficiency is description, because there is no fact of the matter to verify. The auditor is instructed to apply the test to the specific assertion rather than the topic, and to choose description when torn.

**Structural caveat, not fixed here.** The advisory bucket asks whether a claim appears on the approved list. That question only carries information when the approved list is comprehensive enough that absence is a signal. The beta client's list is thin, so absence means little and the bucket generates volume rather than evidence. Tightening the claim definition reduces the volume; it does not repair the underlying logic. Whether advisory findings should be suppressed entirely below some approved-list size is a real question and is deferred until there is client volume to answer it with, consistent with the 2026-08-09 revision.

**Finding three: the structural prose rules are unenforced.** The generated caption contained an em dash and the word "straightforward". Both are forbidden in the generation prompt as non-negotiable. Nothing checked the output, so both shipped.

**Change.** A deterministic prose check runs on every produced copy block, in `src/copy/prose-check.js`. It uses string matching rather than a model, so it carries no false-positive risk, and it runs in every audit state including the one where the claim check failed. Only unambiguous patterns are included: a candidate pattern for "we help you do X" was rejected during implementation because it fires on ordinary writing, and a rule that produces false positives would cost this check the property that makes it worth having.

The value here exceeds the rules themselves. While the claim side is being recalibrated, this is the section of the findings list that is always correct, which is a direct counterweight to the dismissed-by-habit risk above.

**Amended mechanism test.** The original fixture carried only claim-shaped prohibitions and no puffery samples, so neither failure mode could have been caught by it. Two criteria are added:

5. Copy stating compliance with a restriction is not flagged as violating it.
6. Unfalsifiable marketing language classifies as description. The ceiling is one misclassified sample out of five; the beta run misclassified all five.

Criteria 1 through 4 continue to apply unchanged. Narrowing what reaches the auditor could in principle let a real prohibited claim through, and the verbatim and paraphrase groups exist to catch exactly that. **The amended test has not yet been run: it requires an API key that was not available in the implementing session.** The changes are verified by offline unit tests covering the directive split and the prose check; the falsifiability change is verified only by construction until the mechanism test runs.

## Options considered

- Store claims inside the brain document as a new structured section (rejected: incremental-synthesis scaling wall, paraphrase risk on exact claim language).
- Store claims as their own governed entity catalog, versioned independently (rejected: creates two sources of truth for product-scoped claims, requires sync mechanism).
- Derive claims from product records plus a thin brand-level document at compilation time (accepted: single source of truth per scope, simplest assembly, no sync).
