# ADR 0014: Produce governed copy alongside imagery, and split the typography position

- Status: Part one accepted and shipped 2026-08-10 (steps 1 through 3). Part two reopened and revised 2026-08-11: display copy is rendered into images, gated on measurement rather than prohibited. The 2026-08-10 revision overreached and is superseded.
- Date: 2026-08-10
- Owner: Higher Roads
- Supersedes: The blanket generative-typography exclusion recorded in the Design Studio primer and enforced as universal text safety in the compiled prompt, in part (see "The position being revised")
- Related: ADR 0013 (derived claims and copy audit), ADR 0012 (products as governed records), ADR 0010 (feedback through candidate rules), ADR 0005 (presets are stage configuration)

## Context

Direct buyer feedback from the active beta client established that governed imagery alone does not clear the value bar. The unit of value in the buyer's workflow is the finished piece: image plus copy, ready to use. Producing one half leaves the buyer assembling the other, and the timesaver claim fails at their desk regardless of image quality. This confirms the position recorded at sprint close: the visual production is the demo, the copy production is the daily use case.

The copy mechanism is already built and proven. ADR 0013 shipped claims assembly, prohibited-claim hard stops, safe-harbor semantics, disclosure presence checks, prompt-level steering, and a post-hoc audit, with a passed mechanism test on verbatim and paraphrased violations. The generate-copy endpoint produces governed LinkedIn posts today. What is missing is product shape, not capability: copy is a side path attached to one channel rather than a first-class output of a production job.

A second, separate question rides alongside: copy rendered inside the image itself. The system currently enforces universal text safety in every compiled prompt: any surface that would carry writing is blanked or defocused, with no pseudo-text anywhere. That rule descends from a recorded finding during the beta client collateral test: generative typography is a losing battle, and text belongs in layout tools. The buyer's request for finished pieces puts pressure on that position, and it deserves a deliberate revision rather than quiet erosion.

## Decision, part one: copy is a first-class production output

A production job may declare copy outputs alongside its image output. Copy outputs are governed through the ADR 0013 path: claims assembled at compile time steer generation, and the audit runs on every produced copy block before it reaches the user.

**Copy types are a catalog, not a hardcoded channel.** Each copy type declares its prompt shape, structural expectations, and audit posture. The initial catalog:

- **Social caption.** Platform-length post copy paired with a social image. The existing LinkedIn path generalizes to this type.
- **Headline set.** Short display lines: headline, subhead, CTA. Produced as text fields for use in layout tools, and as the source of any future in-image copy (part two).
- **One-sheet prose.** Sectioned body copy for sales collateral: opening, value paragraphs, proof points, closing. Produced as structured text for placement into a designed layout, consistent with the better-building-blocks position. The system does not produce the laid-out document.

Copy types are configuration in the same sense as deliverable catalog entries: the catalog entry is data, the generation and audit capability is code. This follows the ADR 0011 line that prevents per-client forks.

**One job, one preflight, one evaluation.** When a job declares both image and copy outputs, they compile together. Preflight shows what will stay exact and what the system will interpret for both. The result screen presents the complete piece. Copy audit findings surface in evaluation with the same shape as image findings: specific sentence, finding type, governing rule. This closes ADR 0013 step 6 for the combined flow. Audit-errored renders as its own state, never as a clean pass.

**Approval stays whole.** Approve output covers the complete piece. A revision to copy alone routes through targeted repair (regenerate the caption, keep the image) rather than a full re-run, consistent with roadmap item 9. Feedback on copy routes through the same three-scope model as all feedback, per ADR 0010.

**The compiled package carries the copy contract.** The generation package gains a copy section: the declared copy types, the assembled claims that governed them, the produced text, and the audit findings. The package remains the durable record of what the brand asserted when the piece was made.

## Decision, part two: split the typography position

The blanket position "generative typography is a losing battle" conflates two problems with different difficulty and different governance exposure. The revision:

**Paragraph and layout typography stays excluded.** Body copy, multi-line text blocks, designed documents, and anything requiring typesetting remain the domain of layout tools. The better-building-blocks position holds. Universal text safety continues to suppress incidental environmental text (signs, menus, background screens) in every render.

**Short display copy becomes a rendereable element class, gated on evidence.** A headline, a CTA line, or a short overlay drawn from governed copy may be rendered into the image, under the following non-negotiable mechanics:

1. **The string is locked.** In-image copy comes only from a governed source: an approved claim, a produced-and-audited headline set, or explicitly approved text. Free text typed into a brief never renders into an image.
2. **Render is followed by verification.** The system reads the rendered text back out of the image and compares it against the intended string exactly. Character-perfect or fail.
3. **Mismatch is a failure disclosure, not a delivery.** Per roadmap item 10, the system stops and says what happened. It never delivers approximate lettering and calls it complete. A health claim wrong by one word inside a published image is worse than no claim, because nobody proofreads pixels.
4. **Treatment is locked, fidelity is exact.** In-image copy participates in the treatments model as a locked element with exact fidelity, same as a protected asset.

**Evidence gate before any commitment.** Before part two is implemented or promised to any client, a fixture-based renderer fidelity test must pass, per the gate discipline of ADRs 0012 and 0013:

- A test set of short strings (3 to 10 words) spanning plain phrases, brand names, numerals, and punctuation, rendered across the placements that would carry display copy.
- Pass criteria: the renderer holds the exact string at a rate that makes verification a backstop rather than a primary filter. If exact-match rates are low, in-image copy is not a prompt feature and part two is re-scoped as deterministic text compositing (a post-processing step that typesets the string onto the render), which is a different build with different costs.
- The test result is recorded as an evaluation memo before any schema or UI work begins.

Until the gate passes, part two is design intent, not roadmap. Part one does not depend on it.

## What this does not change

- The better-building-blocks position for composed documents. One-sheet prose is delivered as text for layout, not as a rendered document.
- Universal text safety for environmental surfaces. Incidental pseudo-text remains suppressed in every render.
- The three approval actions. Approve output covers the complete piece; approve guidance and promote to canon are untouched.
- The candidate-rule queue. Copy feedback never auto-writes to the brain.
- The claims model. No new claim storage; part one consumes the ADR 0013 assembly unchanged.
- Publishing. Distribution to channels remains excluded per the architecture exclusions. Reversing that requires its own ADR.

## Consequences

**Gained.** The production job's output matches the buyer's unit of value: a finished, governed piece. The copy audit surfaces where the ADR 0013 sequencing intended (preflight and evaluation). The regulated-client story sharpens: the system writes the post and cannot invent a claim legal never cleared, which no unassisted easy button can say. The typography position becomes precise instead of blanket, and the wall moves deliberately with a finding attached.

**Accepted costs.** A copy-type catalog to define and maintain. Preflight and result screens grow to present two output kinds without becoming the cockpit the design principles prohibit. The renderer fidelity gate costs a test cycle before part two can be scoped honestly.

**Risks.** Combined image-plus-copy jobs double the surface where free-text layouts break; every new screen region holding produced copy must be checked against long real content, per the session finding that fixture-length text hides layout faults. Part two's gate may fail, in which case the deterministic compositing path is slower to build than buyers expect; the mitigation is not promising in-image copy until the gate result exists.

## Sequencing

1. **Generalize generate-copy into the copy-type mechanism.** Social caption first, reusing the proven LinkedIn path. Catalog entry as data, capability as code.
2. **Combined compile.** Jobs declare copy outputs; the package carries the copy contract; the social flow produces image plus caption as one job.
3. **Surface the audit.** Preflight shows the governing claims for copy; evaluation shows findings with the standard shape; audit-errored is a distinct state. This closes ADR 0013 step 6.
4. **Headline set and one-sheet prose types.** Extend the catalog once the combined flow is proven on captions.
5. ~~**Renderer fidelity gate for display copy.**~~ Retired unrun by the revision of 2026-08-10. Replaced by: **Scope deterministic compositing**, once the build-or-integrate question has its own ADR.

## Revision: 2026-08-10, part two resolved without the fidelity gate

**The gate is retired unrun.** Step 5 required a renderer fidelity test before part two could be scoped. That test is not being run, because its result would not decide the question it was created to decide.

**Finding: the gate measured the wrong variable.** The test as specified measures whether the renderer holds an exact short string. The reason to reject generated in-image copy is not string fidelity in isolation. It is that text and layout together must be correct predictably and repeatably, across every placement and fidelity requirement the product has to serve. A passing exact-match rate on isolated strings would say nothing about layout correctness at fidelity across formats, so a pass would not have licensed part two and a fail would only have confirmed a decision already reached on other grounds. Running it would produce a number that governs nothing.

**Finding: a probabilistic guarantee is a different category, not a weaker one.** This system's stated differentiator is that provenance and separation discipline are enforced in schema and compiled artifacts rather than left to model judgment. Exact claim language drawn by a model is model judgment regardless of the hit rate. "Correct most of the time" on a regulated claim is not a lower grade of governed; it is ungoverned with good odds. The original rejection of ungated rendering already recognized this by naming exact claim language the highest-stakes string in the system. The revision extends that reasoning to its conclusion: no fidelity number clears it, because the failure is categorical.

**Finding: layout is not this product's competence and should not become it.** The product is built to excel at world building. Layout and compositing are well served by tools built for them. This was already the accepted position in the rejected option "produce finished laid-out documents," which held that layout tools remain better at layout. Part two as originally drafted quietly reversed that by making the renderer responsible for typography.

**Change.** Part two is resolved rather than gated. Generated in-image copy is rejected permanently, not deferred. Deterministic compositing becomes the path: the image is produced without text, and approved copy is typeset onto it in code. The string is exact by construction because it is never redrawn, which satisfies the exact-fidelity mechanic part two required without depending on renderer behavior. The universal text safety rule in `src/production/prompt-craft.js` therefore stays in force unchanged and is no longer "in part" superseded.

Step 5 of the sequencing is replaced: **Scope deterministic compositing.** No fidelity test, no evaluation memo.

**Open question, deliberately unresolved here.** Whether the compositor is built inside this system or whether the system hands off to a tool that already does layout is not decided. Simple compositing, meaning approved text typeset at a known position in a known type style, is bounded and sits inside this product's lane. Layout across arbitrary formats is a different product and probably an integration. The distinction matters because building the second inside this system reintroduces exactly the competence problem this revision was written to avoid. A separate ADR should decide it before a compositor is built.

**Marketing consequence.** The "placed directly, never regenerated" claim on the homepage is currently unsupported by the live implementation, which uses model-based asset placement. Deterministic compositing would make that claim true for copy specifically. It does not make it true for asset placement, and the two should not be conflated in any material written before the compositor exists.

## Revision: 2026-08-11, display copy enters the render

The revision of 2026-08-10 rejected generated in-image copy permanently and named deterministic compositing as the path. That went too far, and it is corrected here.

**What the earlier revision got wrong.** It fused two independent questions: whether a string is allowed to be said, and whether the typesetting will hold it exactly. The first is liability and is already solved by the claims spine. The second is mechanical and is answered by measurement. Using "is it a claim" as a proxy for "will it render correctly" is the same category error recorded in the ADR 0013 amendment, where directives and claim strings shared one list.

It also generalized from the hardest case. The argument was built on regulated healthcare claims, where exactness is the governance, and then applied to every string in the system. For a tagline carrying no claim, approximate lettering is a quality problem, and quality problems have acceptable rates.

**What survives.** Layout across arbitrary formats is still not this product's competence, and composed documents remain the domain of layout tools. Nothing here reverses the better-building-blocks position for one-sheets, display ads, or multi-element artifacts. What changes is that a single authored display block, drawn from governed copy, may be rendered into an image.

**Change: text safety is narrowed, not dropped.** The universal rule forbade pseudo-text and letter-like marks anywhere, which would forbid the feature outright. When a job carries authored display copy, the rule becomes: apart from the specified copy, environmental surfaces stay blank and no other words are invented. Every other job keeps the original rule verbatim. This is a real narrowing of a safety rule and is recorded rather than made quietly.

**Change: the production order inverts for these jobs.** Copy is produced after the render everywhere else, so a copy failure never costs an image that already succeeded. A string that must be rendered has to exist first. The inverted failure is handled rather than propagated: if the display copy cannot be written, the job renders without it and reports that plainly. A blocked image is worse than an image missing its headline.

**Change: display copy is budgeted in characters, not words.** Copy read in a feed is limited by attention; copy rendered into an image is limited by space, and a word limit does not express width. Budgets derive from the format's shape and the chosen zone, and an over-budget line is flagged deterministically. **The characters-per-line figures are REASONED from typographic practice, not measured against rendered output, and should be corrected once real renders exist.**

**Not built, and stated plainly: read-back verification.** Part two specified that the system reads the rendered text back out of the image and fails on mismatch. That does not exist. Until it does, the person is the verification step: the result screen shows the intended string beside the image and says nothing checks it automatically. The compiled record carries `verified: false` and nothing may set it true by assertion.

**The benchmark this enables.** With governed display copy reaching the renderer, the measurement can now run against real strings rather than synthetic fixtures. It needs two numbers, not one: the exact-match rate by string class, which sets the retry cost, and the rate at which verification passes a string that was actually wrong, which determines whether stakes matter. Mismatches should be scored by kind, malformed characters against substituted words, because a renderer that mangles letters is a quality problem while one that swaps words is a governance problem.

## Evidence

First real renders are recorded in [`evaluations/2026-08-11-display-copy-first-renders.md`](../evaluations/2026-08-11-display-copy-first-renders.md). Summary: authored strings rendered character-exact across three runs including punctuation, proportional design instruction outperformed character counts, and two unresolved problems sit in scene composition rather than in text. Both are logged in deferred work. The sample is one brand and is not the benchmark.

## Options considered

- Keep copy as a per-channel side path and add channels one at a time (rejected: repeats the hardcoded-catalog contradiction ADR 0011 named; each channel becomes bespoke code).
- Produce finished laid-out documents with copy typeset by the system (rejected: reverses the better-building-blocks position wholesale without evidence; paragraph typesetting remains a losing battle and layout tools remain better at it).
- Render display copy into images immediately, without a fidelity gate (rejected: exact claim language is the highest-stakes string in the system; committing before measuring renderer fidelity risks shipping approximate lettering on regulated copy).
- Copy as a first-class output through the existing claims path, with display-copy rendering gated on a fidelity test (accepted for part one; the gate on part two was retired unrun on 2026-08-10, see the revision above).
- Render display copy generatively once a fidelity test passes (rejected 2026-08-10: no hit rate makes a model-drawn claim exact by construction, and the test would not have measured layout correctness at fidelity across formats).
- Typeset approved copy onto a text-free render in code (accepted 2026-08-10 as the path for part two; whether the compositor is built here or handed off to a layout tool is left to a separate ADR).

## Revision: 2026-08-11, screens are a governed surface

**Finding.** The first display-copy renders (see the 2026-08-11 evaluation memo, finding four) showed that the renderer fills device screens with invented content, and that the severity grows as scene direction improves. One run produced fabricated post-operative clinical instructions attributed to an invented named surgical center, inside marketing material for a healthcare client. The narrowed text safety rule did not hold, because it was written for environmental surfaces and a subject screen is not environmental: the brief asks the device to present content, and the brief wins.

**Decision.** Screen content routes through the same governed door as every other exact element. On prompt-only renders, every device screen, including a device that is the subject of the shot, shows abstract non-textual content. Readable screen content appears only when supplied as a protected asset, in which case the asset's own display is preserved exactly and every other screen stays abstract. Preflight discloses the abstraction and names the path to real content.

**Why not wait for client calibration.** The deferral discipline applied to the ADR 0013 audit boundary does not apply here, because this failure is not a threshold that needs tuning against real volume. Fabricated clinical guidance attributed to a fabricated organization is categorically ungoverned content beside governed copy, and the mitigation reuses an existing wall (the protected asset path) rather than building a speculative one. This closes the qualification the evaluation memo recorded as unresolved.

**What this does not change.** Authored display copy continues to render under the narrowed text safety rule. The scale and posture collision on screen-bearing scenes (memo finding three) remains open in deferred work. Read-back verification remains the unbuilt acceptance bar for calling display copy governed.
