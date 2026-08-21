# ADR 0018: Compile scene-relevant prompts and govern looks as a brand slate

- Status: Accepted. Owner ruled on all five decisions 2026-08-17; rulings recorded inline.
- Date: 2026-08-17
- Deciders: Grey rules. Chief architect drafts and verifies. Jim optional second reader on look language.
- Number note: VERIFIED 2026-08-17 against docs/decisions/ at head; 0017 is the latest record and 0018 is free.

## Context

Weeks of governance work produced almost no visible image quality change. An external audit of the compiled MycoPop prompt diagnosed why, and a three-condition render test confirmed the diagnosis directionally.

The evidence base, with claim labels:

- VERIFIED (audit of the v1 compiled prompt): roughly 2,610 words, 49 percent prohibitions and protections, 44 occurrences of "do not", scene content 10 percent, output instruction 1 percent. Inactive creative directions leak material cues into unrelated scenes. "Preserve the supplied package exactly" compiles with no master attached, which produced invented label artwork in render.
- VERIFIED (v2 render, additive test): capture-authenticity blocks appended after the full brain prompt had uneven influence. Strong early positive instructions defeated later negatives. Visible failures: simultaneous stretch-and-sip, uniform golden rim on every subject, evenly spaced background runners, wet bench with no scene cause, invented can label, readable third-party shoe mark.
- VERIFIED (v3 render, short compiled prompt with concrete topology): most failures corrected. One action, unbranded apparel, dry worn surfaces, irregular background population, localized light. Remaining misses: campaign-clean face, failed crop instruction, absent condensation.
- VERIFIED (code read at head, 2026-08-17): the generic look has three authors before dilution occurs. First, the assignment opener "A cinematic campaign-film still in a real environment with depth and atmosphere" is `AESTHETIC_MODES.cinematic_film_still.openingLine` in `src/production/prompt-craft.js`; mode selection is keyword matching over creative-direction text only, blind to the scene, and selected the cinematic mode for an observed outdoor activity scene that `documentary_lifestyle` describes exactly. Second, the scene writer authored "warm dusk glow highlighting the jogger's outline", "background joggers illuminated in the same warm tones", and the impossible simultaneous "stretch and sip". Third, the brain mass diluted whatever followed. Subtraction downstream cannot fix language authored upstream by our own code and our own scene writer.
- REASONED (from the v3 compliance table): the renderer obeys concrete scene topology (counts, positions, single actions, surface states with causes, named light source positions) and partially obeys or ignores abstract perceptual targets and numeric ratios ("natural", "unperformed", stop values). All compiled language, including look profiles, must be written in the topological register.
- ASSUMED, requires verification: the pattern holds beyond one brand, one scene, and one render per condition. This is the reason phase 0 exists. The v2 to v3 comparison changed many variables at once and cannot attribute improvement to specific mechanisms.

Separately, the photographic character layer brief (revision 2) positioned look profiles as configuration selected by preset and treatment, never a user-facing picker, citing ADR 0005. The owner has challenged this: looks are subjective art direction at the brand level, potentially varying by campaign, product, and channel, and there is a case for per-asset user choice.

## Decision 1: Looks are art direction, and no user choice ships yet

Owner ruling 2026-08-17: no user-facing look choice yet. The pass or fail for this whole direction is creating looks that actually do the work first.

The recorded finding against character brief r2 stands: the brief conflated "not authored by synthesis" with "not chosen by users", and its ADR 0005 citation was a wrong borrow. ADR 0005 excludes architecture concepts (constrained, hybrid, editorial are pipeline execution modes) from user-facing surfaces. A look is not architecture. It is art direction, the kind of choice marketers already make when selecting photographers and treatments. ADR 0005 stands unmodified; looks were never in its scope.

But the corrected principle does not schedule a picker. Looks ship headless, selected by per-brand defaults through existing preset and treatment mapping. Any user-facing choice is contingent on profiles passing the "does it look taken" gate on multiple brands, and gets designed as its own unit through the design sprint if and when that happens. If the looks cannot prove themselves headless, no interface for choosing among them earns existence.

When looks do reach users, they appear in marketer language only. Profile identifiers, spec blocks, and internal vocabulary never reach the interface.

The honesty rule from the brief survives untouched: no brand's sources document camera character, so synthesis never authors a look. Look content is ours.

## Decision 2: Three-layer look architecture

1. **Library is code.** Look profiles, spec blocks, compiled paragraphs, and strength variants live in the codebase, versioned, maintained by Higher Roads. Roughly four to seven foundational profiles. No client edits profile internals. This follows the standing rule that render capabilities are code.
2. **Slate is governed configuration.** Each brand carries an enabled subset of the library (roughly two to four looks) with one default, optionally mapped per channel or deliverable type. The slate is where brand-level art direction lives. A look enters a brand's world through approval against sample renders, following the existing governance shape.
3. **Per-asset selection draws from the slate, never the library, when selection exists at all.** Per Decision 1, no picker ships in this ADR's scope; assets take the brand default or a per-deliverable mapping. The layer is recorded now so the slate boundary shapes the data model from the start: whenever selection arrives, it offers the brand's approved looks in marketer language with the default indicated but not preselected (standing rule: no preselected answers), campaigns pin a look and version, assets inherit, and a per-asset override is recorded.

**The library absorbs and retires `AESTHETIC_MODES`.** Owner ruling 2026-08-17: the idea of aesthetic modes is correct; the implementation is not, and this work fixes it. VERIFIED at head: `src/production/prompt-craft.js` already carries four aesthetic modes with names, opening lines, and best-when descriptions, selected by `selectAestheticMode` and compiled as the assignment opener. This is a proto-look library, and the look system is its correct implementation rather than a rival. Keeping both would mean two systems making "what kind of photograph is this" claims in one prompt, the same conflict shape flagged between profiles and the visual grammar. When profiles land in phase 3, the mode opener's role is taken over by the selected look's compiled paragraph, `AESTHETIC_MODES` and its selection logic are removed, and the package's `aestheticMode` field is replaced by the look id and version. Existing mode names can seed look labels where they map cleanly.

Consensus-drift mitigation: every look on a slate is deliberately characterful. A studio or ecommerce look exists on a slate only when the brand deliberately includes it. Choice among differentiated options cannot average back into the house style.

Deferred per Decision 1: whether slate approval is a client-facing governed approval or an internal per-brand setting. No answer is needed until a picker earns existence.

## Decision 3: Phased sequence, subtraction before addition

- **Phase 0 (this ADR): baseline and freeze.** Fixture scenes, pinned prompt and render baselines, pre-registered gates, the protections question below. Two immediate protection fixes ride along: a third-party wardrobe and equipment mark policy entry for both brands (true omission exposed by the v2 render), and adoption of exposure-priority phrasing ("expose for the sunlit highlights, do not compensate for the face") as tested observable language.
- **Phase 1: subtraction, two co-equal workstreams.** (a) Compile path, all targets VERIFIED at head as localized to `src/production/package.js` and `src/production/prompt-craft.js` with no new api files: `sectionDirection` compact mode currently compiles the summary plus every principle of every guidance section, and gains relevance gating; the audience-and-feeling section and `dossier.guardrails` currently compile unconditionally and gain the same; `rejectsDirection` joins all governed statements with no relevance test, pending the ruling below; `protectionBlock` gains asset-fidelity states so no preservation instruction compiles without a qualifying asset; deduplicate invariants to one occurrence; gate claims language on whether copy is requested; ban "photorealistic"; order the prompt intent-scene-subject-camera-look-materials-assets-constraints-output. Precedent inside the codebase: `compileProductSectionForImage` already excludes claim wording from image prompts by deliberate design, with a comment recording that claims were the single largest block. Phase 1 generalizes a filtering principle the code already endorses. (b) Scene writer (`api/production/generate-copy.js#handleSceneBrief`): rewrite its instructions into the topological register. One action per subject, named light source position, surface states with causes, concrete population counts. Every dropped or transformed statement receives a disposition code recorded in the package.
- **Phase 2: conflict resolution and trace surface.** Field-level authority (scene owns content, look owns photographic behavior, asset policy owns fidelity, deliverable owns format). Incompatibilities reported, never concatenated. Prompt trace rendered in View package. This is the inspectability payoff.
- **Phase 3: character layer, headless.** Brief r2 profiles, rewritten through the topological filter, land as the look block on the cleaned substrate. Per-brand defaults wire through existing preset and treatment mapping. No new UI. Brief r2's four open questions are answered here.
- **Phase 4: evaluation contracts.** ADR 0016 step 5 and the profile gate run as independent post-generation checks. Evaluation language never enters prompts.
- **Picker phase (contingent, not scheduled): slate and per-asset selection UI.** Exists only if profiles pass the gate on multiple brands, per Decision 1, and is then designed through the design sprint as its own unit.

Deferred register additions: campaign lock implementation, automatic look scoring, provider adapter abstraction, guided-selection UI, deterministic text compositing (owner rejected as a BWS concern; noted as a possible VRE seam).

## Rejected from the external recommendations

- Full typed-IR rebuild with provider adapters: one provider, one endpoint, 12-function ceiling. The behaviors (filtering, conflict resolution, trace) are adopted as refactors of the existing compile path in src/production/package.js and src/production/prompt-craft.js, not as a new object system.
- Deterministic two-layer text compositing: owner ruling, out of scope.
- Unconditional negative-prompt style anti-default blocks: anti-defaults compile as scene-activated positive physical rules plus one concise prohibition, per the v3 evidence that positive state-plus-cause language outperforms bare negation.

## The governance ruling: protections compile by scene relevance

Scene-relevance filtering collides with ADR 0017 step 4, which compiled avoid-clauses from accepted protections verbatim for any client with at least one active entry. Owner ruled 2026-08-17, amending ADR 0017: accepted.

- Synthesized brain content is filtered freely by scene relevance.
- Copy and claims protections compile only when the frame carries readable text, and they compile smart: aligned with the actual scene and headline content rather than dumped wholesale. The owner's reasoning, recorded: users will not sift through fifty rules per prompt; they would rather render and retry than read.
- IP and asset protections compile when the protected object class can plausibly appear in the scene.
- A small always-compile core (exactly one readable package, no unrequested text, no third-party marks) compiles unconditionally.
- **Risk accepted, explicitly.** A relevance filter can misjudge, and a misjudged protection is absent from that prompt. The owner accepts this tradeoff. The mitigation stands: every skipped protection is logged with a disposition code, so an absence is always auditable and never silent.

Classification of existing entries into these classes is presented for ruling before phase 1 ships, and the ADR 0017 amendment is recorded there as dated, citing this record.

## Phase 0 work items

1. Select and freeze fixture scenes: minimum four across both brands, covering lifestyle-with-person, product-forward, interior, and one clinical-register Dialog Health scene. Real client inputs stay gitignored per ADR 0004.
2. Capture the current compiled prompt for each fixture verbatim into docs/evaluations/, with word counts by section, plus baseline renders. Commit order proves pre-registration.
3. Pre-register the phase 1 gate before any phase 1 work: compiled prompt for each fixture lands between 500 and 900 words, zero impossible invariants (no preservation instruction without a qualifying asset state), zero inactive-direction leakage, every drop carries a disposition code, and the owner's three-second read judges each phase 1 render equal or better than baseline. A mis-specified gate clause is a recorded fail.
4. Record the gate discipline, per owner ruling 2026-08-17: a failed phase 1 gate does not halt the work; it halts the stacking. This is subjective territory, and problems found downstream get tweaked downstream, iterating within phase 1 against the same fixtures and gate until renders read equal or better. What is prohibited is starting phase 2 or phase 3 while the phase 1 gate is failing. No new layer lands on a layer that has not passed. The prior failure this guards against is weeks of work with no visible render change; the guard is that visible change is demanded per layer, not that work stops.
5. Write the third-party mark protection entries for both brands and submit for ruling through the refusals flow.
6. Record the finding against character brief r2 (Decision 1) in the brief's own revision trail.
7. Record the mode-selection finding: `selectAestheticMode` reads creative-direction text only and cannot see the scene, which put a cinematic opener on an observed outdoor scene. No fix ships in phase 0; the finding justifies scene-aware look selection when profiles absorb the modes in phase 3.

## Consequences

- Easier: attributing render failures to specific instructions, demonstrating inspectability with the prompt trace, adding looks without prompt bloat, onboarding future brands whose slates differ.
- Harder: the compile path gains a filtering stage that must be tested across both presence states, cross-placement, and cross-client-switch per house discipline. The scene writer rewrite risks regressing scene variety and needs its own before-and-after captures.
- Revisit: slate approval governance shape (client-facing approval versus internal setting) if and when a picker earns existence per Decision 1; campaign lock when a client runs its first multi-asset campaign; the M1/M2 question and concern matcher remain parked per ADR 0017.

## Amendment log

**Outcome note, 2026-08-18 end of day.** The record's central bet was addition by subtraction: that compile reduction rather than more governance would fix render quality. Half of that proved right and half proved wrong, and both halves are recorded rather than one being edited away.

Right: the diagnosis. Competing and abstract instruction was suppressing quality, and the audit's reverse engineering result held across roughly thirty renders. This renderer obeys concrete physical facts and ignores abstract description, and an early strong statement defeats a later qualifier.

Wrong: the remedy's emphasis. Subtraction was not what moved the image. Every intervention that visibly improved renders added concrete language in a strong early position, roughly 900 words across capture character, the look library, the world block, and the human texture floor. Genuine subtraction of roughly 250 words was individually invisible. The phase 1 word count gate is recorded as failed and as mis specified in `docs/evaluations/2026-08-17-adr-0018-phase0-baseline.md`.

The corrected principle, for whoever writes the next record: the failure was silence, not volume. Four of the five axes fixed today were absences rather than errors, and the renderer filled each silence with consensus. When quality plateaus, ask which axis nobody has written to yet.

Handoffs: `docs/handoff-2026-08-18-architect.md` and `docs/handoff-2026-08-18-builder-look-library.md`.

**Amended 2026-08-18.** Decision 1 said no user facing look choice ships yet, with any picker contingent on the looks proving themselves headless first. The owner has ruled that looks become a user facing feature now. The contingency was satisfied faster than the decision anticipated: on 2026-08-18 the film noir and drugstore flash looks both reached the render unmistakably on MycoPop, which established that look language moves finish and that the library is worth choosing from. The ruling also adds two requirements the original decision did not contemplate.

First, the picker is visual. A list of look names asks a marketer to imagine a photographic medium from its title, which is the same failure as naming a schema field in the interface. The picker is a grid of tone cards, each carrying its look's actual contrast, saturation, and color behavior, shipped as an interim stand in for real sample renders.

Second, and more consequentially, look selection moves ahead of scene direction in the decision chain, and the selected look is sent to the scene writer. A look and a scene can contradict each other: a noir look asks for one hard source and solid black, and a scene calling for a warm dusk glow across the whole frame cannot be photographed that way. Resolving that at compile time would mean arbitrating between two authored intents at the last moment, which is the failure shape this record exists to remove. Choosing the medium first and writing the scene for it removes the conflict rather than resolving it. The authority split is unchanged: the look owns capture character, the scene owns content, and the scene writer is told not to restate the medium so the same instruction does not compile twice.

The three layer architecture in Decision 2 is unaffected. The library is still code, a brand's slate is still governed configuration, and per asset selection still draws from the slate rather than the library. What changes is that the third layer arrives now instead of after a further proving period. The slate layer is not yet built, so the current picker exposes the whole library, and the slate remains the mechanism that keeps choice from averaging back into consensus.
