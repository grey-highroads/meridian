# Handoff: Chief Architect and Code Review, 2026-08-18

This document exists so a new architecture session can pick up with full context and without re-deriving anything. It is written for a reviewer, not a builder. The builder handoff is `docs/handoff-2026-08-18-builder-look-library.md`.

Read this first, then `docs/decisions/0018-compile-scene-relevant-prompts-and-govern-looks.md`, then the delta list at the head of `docs/image-pipeline-contract.md`. Verify anything you intend to act on against the committed tree rather than against this summary.

## What this session was, and what it should have been

It began as a master code review and became a fourteen hour build session. The owner has named that drift and wants the two separated going forward: an architect chat for review and rulings, builder chats for execution. This document is the handle for the architect thread.

The consequence worth flagging: almost everything shipped today was shipped by the same agent that proposed it, reviewed by renders rather than by code review. That is fine for a day of rapid hypothesis testing and it is not fine as a standing practice. A cold read of `src/production/prompt-craft.js`, `src/production/looks.js`, and `src/production/package.js` by a reviewer who did not write them is the first thing this thread owes the project.

## The single most important finding of the day

Weeks of governance work produced no visible improvement in render quality. One block of concrete physical facts, positioned second in the prompt, changed the output decisively within an hour.

The generalized rule, which now has roughly thirty renders behind it:

**This renderer obeys concrete physical facts and ignores abstract description. Position matters: an early strong statement defeats a later qualifier. What suppressed quality was never prompt length. It was competing and abstract instruction.**

Every intervention that worked today was the same move applied to a different axis:

| Axis | What was missing | What fixed it |
|---|---|---|
| Finish | The prompt described content and never described how the photograph was made, so the renderer supplied its own finish | `CAPTURE_CHARACTER`, then the look library, compiled second |
| Look | No vocabulary for a photographic medium | 14 looks as code, each ending with what its medium cannot do |
| World | The visual grammar reached the scene writer but never the image prompt | `worldDirection`, compiled third, plus world rules in the scene writer |
| Reference | Preservation language forbade relighting, producing an overlay | Reference governs artwork and geometry, scene governs light |
| People | Skin described as a category rather than as zones | `HUMAN_TEXTURE`, compiled under every look |

Four of those five were absences, not errors. The system was silent on the thing that mattered and the renderer filled the silence with consensus. That is the pattern to look for next time quality plateaus: ask which axis nobody has written to yet.

## What shipped, in order, with rationale

All commits are on `main`. Each content commit is followed by a `chore: trigger deploy` on the same tree.

### Phase 0, baseline and evidence

- `220f171` ADR 0018. Five rulings, all made by the owner: looks ship headless first with a picker contingent on proof; three layer look architecture (library in code, governed brand slate, per asset selection); protections compile by scene relevance with risk explicitly accepted; phase gate failures iterate within the phase rather than halting work; the look library replaces the existing aesthetic modes system.
- `34f3e51` Capture harness, draft fixture scenes, pre-registered gate. Gate committed before any capture existed so commit order proves pre-registration.
- `167e74a` Scenes frozen. Harness mirrors `service.js` product image promotion so captures compile the same path production does.
- `d255180` MycoPop baseline. The approved brain, product record, and accepted protections were reconstructed from the external audit's v1 prompt and **proven** by compiling to a byte identical 2,610 word prompt, zero diff. Reconstruction that is verified rather than trusted.
- `d3f54fa` Dialog Health baseline, from the real approved brain. Four findings, including that roughly nine tenths of any prompt was scene invariant brand payload.
- `873576a`, `1fef3f1` Renders recorded, three compiler findings, gate clause amendments.

### Phase 1, the interventions that worked

- `8af3e82` Scene writer rewritten into the physical register: one action per subject, named source position with explicit no fill, optical falloff instead of narrative focus order, per surface state and cause instead of a material pool.
- `c91f623` Crop event required, off center placement, expression as stated mouth and eye direction, background population with exact counts.
- `40f8406` `CAPTURE_CHARACTER` compiled second. **The turning point.** Also stripped the finish claims from the aesthetic mode openers, one of which had been ordering "a cinematic campaign-film still with depth and atmosphere" at the top of every prompt for both clients.
- `b6443ea` Six look library as code, selectable.
- `b27d5ae`, `b7d8b57`, `86a2f93` Three UI defects on the same control in one day. See Mistakes.
- `dc5cb27` Environment classes on looks; binding looks decide the setting; four weak signatures rewritten from gradual to binary tells.
- `3d72529` Studio seamless removed as structurally incompatible; clean digital added.
- `a72cded` Lit on location added from the owner's portraiture references.
- `b81cade` Neutral replaces both No look and Clean digital as the default.
- `3049d2e` Visual look grid, chosen before the scene is written. ADR 0018 Decision 1 amended by owner ruling.
- `6540a01` Visual grammar compiled into the prompt as the world block, third.
- `7a8d3da` The world becomes required content in the scene writer's RULES rather than context.
- `984b3bd` Scene suggestion regression fix. See Mistakes.
- `2e88438` Reference governs artwork, scene governs light.
- `14ce9ac` Human texture floor, and the phase 1 word gate recorded as failed and wrong.

## Current architecture of the compiled prompt

Section order, and the reasoning for it:

1. **Assignment** the scene, from the scene writer or hand written
2. **Capture** the selected look, plus the human texture floor. Second because finish must be settled before the brand mass arrives
3. **The world this brand lives in** the visual grammar, when present. Third for the same reason
4. Brand foundation, Foundation, Identity, Rules
5. Audience and feeling
6. Visual materials
7. Creative references
8. Protection
9. Output

Key files:

- `src/production/looks.js` 14 looks. Each has `id`, `label`, `environment` (`agnostic` or `binding`), optional `requires`, and `line`. Every line ends by naming what the medium cannot do. This is the file most worth a cold review.
- `src/production/prompt-craft.js` `CAPTURE_CHARACTER` (fallback when no look), `HUMAN_TEXTURE` (compiled under every look), `AESTHETIC_MODES` (now register only, slated for removal per ADR 0018), `protectionBlock`.
- `src/production/package.js` `compileBrandWorldImagePackage`, `worldDirection`, section assembly and ordering.
- `api/production/generate-copy.js#handleSceneBrief` scene writer. Now carries world rules and look rules in the system RULES block, world first.
- `app/app.js` look grid, `lookOptions` (ids must stay in sync with `looks.js`), studio setup screens.
- `fixtures/adr-0018-phase0-capture.mjs` capture harness with `--baseline` isolation checking and `--briefs` override.

## Authority boundaries, as currently ruled

These were derived under pressure and deserve review.

- **World versus look.** The world decides what is in the frame and which sources are present and what color they emit. The look decides how it was photographed and how those sources render. Delegated to the architect by the owner, not independently ruled by him.
- **Reference versus scene.** The reference governs artwork and geometry. The scene governs light. This is the newest boundary and the least tested.
- **Binding looks versus earned environments.** A look requiring a condition outranks the preference for a familiar setting; the writer picks the earned environment that can provide the condition.
- **Known unresolved conflict.** Look lines contain color claims ("color is warm with reds and skin favored") which outrank the world's light content. The owner deliberately deferred this as look governance rather than look proving. It is a real conflict and it will resurface.

## Mistakes made in this session, recorded so they are not repeated

**Three UI defects on one control in one day, all the same shape.** The look field shipped on the legacy brief screen rather than the studio screens the owner actually uses; its handler was registered on `change` while the control was a `button` that fires `click`, so every card was inert; and it carried `studio-setup-field` without `field full`, so it rendered at half width. In all three the markup was verified and the path a person takes to reach and operate the control was not. Recorded in `docs/ui-contribution-guide.md`.

**A prompt change broke a UI.** World rules referring to "the world field" six times caused the model to emit a key named `world` while the requested shape called it `brief`. Every suggestion card rendered a heading with no body, and selecting one silently wrote nothing. No markup had changed. Two lessons recorded: name the key in the shape instruction and accept both on parse, and a card built from model output needs a state for the field being absent.

**Two confident wrong answers from partial reads, in one exchange.** Told the owner that product URLs are never scraped, having grepped `api/products/index.js` alone; `src/products/service.js` imports `enrichUrlSources` and does fetch the page. Told the owner there was no way to mark an image isolated or in context; the product detail screen has exactly that, in two labeled buckets. Both were the standing correction the owner has given before: source, then write, then verify from the committed tree. Grepping one file and generalizing is not sourcing.

**Claimed isolation without proving it.** Asserted three couplings between scene text and the compiled prompt. One was wrong: `screenContentAbstracted` is computed into package metadata and changes no section text. Caught only by building the check.

**Over-instrumented before delivering.** Spent a large part of the morning building capture harnesses and isolation checks while the owner wanted visible render improvement. His correction, verbatim in effect: stop doodling, get progress. He was right, and the instruments have been little used since.

**Built a second layer on an unverified first.** Shipped three new scene writer levers on the evidence of a single render, which violates the project's own Rule 4. Flagged at the time only after the owner raised overprescription.

## The failed gate, and why it matters

Phase 1's pre-registered gate required every compiled prompt to land between 500 and 900 words. Prompts now run near 2,200. Recorded in `docs/evaluations/2026-08-17-adr-0018-phase0-baseline.md` as a fail and, more importantly, as a **wrong** gate.

It assumed length suppressed quality. The day's evidence is the opposite: roughly 900 added words across capture, looks, world, and texture are the only changes that moved the image, while roughly 250 words of genuine subtraction were individually invisible.

A replacement gate should measure whether every compiled statement is a physical fact that can change pixels, and whether any two statements make competing claims about the same property. Both are mechanically checkable and both would have caught the overlay bug and the golden coating bug without a render. Designing that gate is a good first task for this thread.

## Open items

**Structural**
- `AESTHETIC_MODES` still exists and still supplies the assignment opener. ADR 0018 rules that the look library absorbs and retires it. Not yet done.
- The brand slate layer does not exist. The picker currently exposes the entire library, which is what ADR 0018 says would let choice average back toward consensus.
- Products do several jobs badly and the owner has flagged it: the record is simultaneously a synthesis artifact from a scraped page, a governance object carrying claims and exclusions, and an asset container for reference imagery. Different lifecycles, one screen, imagery hidden behind a collapsed card the owner never found. Only the first isolated image is ever used.
- The look and world seam on color, above.
- Grammar ambition statements hedge themselves ("build selected frames", "no more than one cue"), which is a synthesis instruction problem and an ADR 0016 finding. The owner classed it as a client question.

**Carried from before this session**
- ADR 0016 step 5, render evaluation loop, unstarted.
- ADR 0017 step 2, concern matcher, parked with fixtures and gate on the shelf.
- ADR 0017 step 5, candidate not erase. Rebuild remains destructive behind one confirmation.
- Finding 2 investigation, which of seven verbal refusals fit the prohibited claims shape.
- Ambient state 8: the ambition label reaches the prompt via the grammar path but `package` and the result screen do not carry `grammarEntries`.
- Two format tables in `app/app.js` disagree for Website feature. In `docs/deferred-work.md`.
- Studio and product photography looks need world building suppressed. In `docs/deferred-work.md`.

## What a reviewer should probably do first

1. Cold read `looks.js`, `prompt-craft.js`, and the `package.js` section assembly. None of it has been reviewed by anyone who did not write it.
2. Design the replacement gate described above.
3. Rule on the look and world color conflict, since it is a known live contradiction.
4. Decide whether `AESTHETIC_MODES` retirement happens now or waits, since it is a ruled decision sitting undone.
5. Look hard at whether the Capture section, now roughly 540 words under Neutral, has internal redundancy diluting its strongest clauses. Suspected but unproven.
