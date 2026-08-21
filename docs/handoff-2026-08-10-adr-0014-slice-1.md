# Handoff: ADR 0014 steps 1 through 3, governed copy in the social flow

- Date: 2026-08-10
- ADR: 0014, part one, sequencing steps 1 through 3
- Repository: `github.com/grey-highroads/brand-world-system`, branch `main`
- Serverless function count: 12 of 12 (Hobby ceiling held, no new function files)
- Part two (in-image display copy) untouched and still gated on the renderer fidelity memo

## What shipped

A social image job now produces a complete post: the image, a caption written from the Brand Brain, and an audit of that caption against the brand's approved and prohibited claims. This closes ADR 0013 step 6 for the combined flow.

### Step 1: the copy-type mechanism

Two new modules under `src/copy/`.

`types.js` is the catalog. A copy type is a data entry declaring its id, label, role line, structural rules, length guidance, output format, topic fallback order, and audit posture. One entry ships: `social_caption`. Adding `headline_set` and `one_sheet_prose` is a data change in this file, with no new endpoint and no new generation logic.

`generate.js` is the shared capability. It builds the system prompt from the catalog entry plus brand guidance, product knowledge, and the assembled claims; calls the model; then runs the ADR 0013 audit. The claims modules (`assembly.js`, `copy-audit.js`, `resolver.js`) are consumed unchanged.

Caption length follows the placement rather than a per-channel catalog entry. LinkedIn resolves to 150 to 300 words, Instagram to 40 to 120, and an unrecognized placement falls back to a general range. A new platform is a line in a map, not a new copy type. This was a deliberate choice against the alternative of a separate `linkedin_post` entry, which would have reproduced the per-channel hardcoding ADR 0011 rejected.

Generation dispatches through the existing `api/production/generate-copy.js` handler via a `copy_type` action, alongside the existing `scene_brief` action. No new serverless function.

### Step 2: combined compile

`compileBrandWorldImagePackage` accepts `copyOutputs` and `claimsSet`. When copy is declared, the package gains a `copy` section holding the declared types, the governing claims, and a `produced` array. When no copy is declared, the compiler adds no key at all and the package is byte-identical to what it produced before this existed.

`prepareProductionPackage` assembles the claims set once and uses it twice: to steer generation and to record what governed the words. `api/production/preflight.js` and `api/production/generate.js` both pass a claims store.

Copy is produced after the image, so a copy failure never costs a render that already succeeded, and it is written into the generation package before `writeOutputPackage` saves the blob. Past outputs therefore reopen with their captions and findings from the same durable record that already carried the compiled prompt.

### Step 3: surfacing the audit

**Preflight** gains a "What stays exact in the words" panel: the approved wording the caption may use, the prohibited wording it may not, and any disclosures that must appear, each in the brand's own language with its source. A job with nothing on either list says so plainly.

**The result screen** shows the caption as part of the finished piece rather than as a side panel, with a per-block status pill and copy and rewrite actions. Findings appear in the evaluation list in the same shape as image findings: the flagged sentence verbatim, the finding type, and the governing rule.

Treatments follow the established convention. Coral for prohibited-claim violations and for an audit that did not run. Yellow for unapproved claims and missing disclosures. Green only when the audit ran against a real claims set and found nothing.

**Audit-errored is its own visible state.** The shipped audit signalled failure with an error object, and the calling code skipped the audit entirely when there were no claims, so "nothing to check" and "we never checked" both arrived as null. Those are now three explicit statuses (`governed`, `no_claims`, `errored`) normalized in `src/copy/generate.js`. An audit that could not complete renders as coral "Not checked" and can never be read as a clean pass.

**Targeted repair.** "Rewrite the caption" regenerates the words and keeps the image, following the guarded loader pattern: a concurrent call is refused, and both the success and failure paths clear the flag.

## Findings recorded

**The post caption section in social setup was a mock.** `state.studio.caption` was a free-text textarea whose value was never sent to any endpoint and never appeared in `productionRequest()`. It carried two field notes asserting governance that did not run: "Governed by brand voice" and "Approved claims available. Prohibited claims blocked." This is the same class of contradiction as the "placed directly, never regenerated" marketing claim, living inside the product rather than on the homepage. It is now a real default-on output with a direction field, and the claims are true.

**Brain guardrails still steer copy generation without being audited as claims.** The comment in `generate-copy.js` recording this remains accurate and the new path inherits the behavior unchanged. Prose rules such as "Never clinical" reach the generation prompt through the BOUNDARIES section but are not in the audited prohibited list. Migrating guardrails into the claims document is still open work and was deliberately not attempted here.

## Testing

`test/copy-contract.test.js`, 11 tests, all passing.

A compile-time change tested against only the placement that motivated it caused the 2026-08-09 regression, so the parity tests run across five placement shapes: scene, sales enablement with a template, sales enablement without one, brand template, and a locked-asset job. Each asserts that a job declaring no copy compiles identically, and that a job declaring copy changes nothing outside the `copy` key.

The audit-state tests cover the empty claims set, a missing disclosure, a present disclosure, an unreachable model, an unparseable model response, and a full classification run confirming findings resolve match codes back to the rule text rather than printing "P1".

Cold start was verified separately: a client with no claims document and no products assembles an empty claims set, compiles a copy contract, and reports `no_claims` with a plain-language message rather than an error.

Full suite: 31 passing, 5 failing. The same 5 fail on an unmodified clone; they require `node_modules` and `OPENAI_API_KEY` and are unrelated to this work.

Note on process: the first parity check appeared to pass but had compared the baseline against itself, because a shell error aborted the step that applied the change. The result was discarded and the check redone. Parity holds, and it is now a committed test rather than a one-time verification.

## Gaps and next steps

**Not verified against a live client.** Everything above is verified by test and by static reading. The deployed behavior with a real Dialog Health claims document and a real caption has not been observed yet. That is the next thing to do, and the boundary calibration question from ADR 0013 stays open until there is real volume.

**Copy findings do not gate approval.** Approve output covers the complete piece and stays available even with a prohibited-claim violation showing. The violation renders loudly in coral; the decision to ship anyway remains the reviewer's. If that turns out to be the wrong call for a regulated client, gating the approve button is a small change in the result screen and should be recorded as an ADR amendment rather than a quiet fix.

**Only the social flow declares copy.** `declaredCopyOutputs()` returns an empty list for every other studio category. Sales enablement and website are the obvious next candidates and need `one_sheet_prose` and `headline_set` catalog entries first, per ADR 0014 sequencing step 4.

**The LinkedIn deliverable still uses its own path.** `startLinkedInGeneration` calls `generate-copy` without a `copyTypeId` and continues to work exactly as before. Folding it onto the copy-type mechanism is straightforward now that `social_caption` handles LinkedIn length, but it was left alone rather than changing a working path in the same slice that introduced the mechanism.

**Long-copy layout was checked structurally, not visually.** The new regions are stacked, declare wrapping, and set no fixed heights or clamps. A three-hundred-word LinkedIn caption beside a short findings list has not been looked at in a browser. Worth a glance on the first real long caption.

## What to look at in the deployed app

1. Design Studio, Social image. The caption is on by default with a direction field beneath it. Switch it off and the job behaves exactly as it did before.
2. Write a one-sentence brief, continue to preflight. "What stays exact in the words" sits above "What the system will do".
3. Generate. The result shows the image, then the caption, then findings naming the sentence and the rule.
4. Rewrite the caption. The image stays.
5. Discard, approve, and reopen past outputs, including ones made before this change. All should behave as they did.
