# ADR 0016: Articulate visual grammar as a brain artifact and evaluate renders against it

- Status: Proposed
- Date: 2026-08-15
- Owner: Higher Roads
- Related: ADR 0015 (render quality on people, scene, and rejects), ADR 0013 (copy audit as the evaluation precedent), ADR 0010 (production feedback through candidate rules), ADR 0009 (update from an approved baseline)
- Source findings: [`../findings-2026-08-14-adr-0015-session.md`](../findings-2026-08-14-adr-0015-session.md), findings 1, 2, 3, and the addendum

## Context

`docs/product-thesis.md` requires the world-building workflow to articulate visual grammar and lived-world logic. Lived-world logic exists as a schema artifact. Visual grammar exists nowhere in the schema. ADR 0015 rejected restoring PWP's visual grammar library on the reasoning that four authored scene fields carry the same knowledge, and the same-day build corrected that rejection in place: the reasoning was correct about the library and wrong about the knowledge. Four fields let a scene writer invent craft per job from a summary. They do not give a brand a durable, versioned, editable account of how it looks. Scene writer rules were tightened three times during the session and each was satisfied at its weakest available reading, because nothing specific existed for the rules to reach.

That correction stands. This ADR does not reopen it. It decides what the artifact is.

Three findings from the 2026-08-14 session shape the decision.

**A declared aesthetic ambition reaches production only as a prohibition.** Mycopop supplied an 8-bit retro gaming reference marked as an outside inspiration with strong declared influence. The brain derived a correct intellectual property rule from it, and the production path delivered that rule as its most specific statement about the aesthetic, under RULES AND GUARDRAILS. The identity principles, which carry the most concrete positive statement, did not reach the scene writer when this finding was recorded: `api/production/generate-copy.js` pushed `identity.summary` alone. Three consecutive suggestion sets produced a home office, an urban park, and a living room. The territory was reachable, demonstrated by an ungoverned frame produced outside BWS that reached it convincingly and cannot ship because it contains readable third-party marks. The system retreats from the territory when the correct behavior is to author the brand's own version of it. **Corrected 2026-08-15.** That sentence went stale the day this ADR was written and is amended rather than removed, because the observation above was taken against the old behavior. Commit `1a9357e` changed the identity push to summary plus principles, matching world and creative, an interim fix under ADR 0015 recorded in the session findings under Finding 2 and superseded when step 4 below lands. The finding stands on its other half, which the fix does not touch: every usable identity statement describes retro gaming as a graphic system of icons, frames, motion, and data display, so the scene writer gains no account of people, wardrobe, rooms, or era from them. The three suggestion sets predate the fix and have not been rerun (Verified that they predate it; whether a rerun has happened since is not established, so verify before citing them as current behavior).

**The rejects list serves copy, not images.** `livedWorld.rejects` describes what the person rejects, which is right for copy governance and audience work. Two of Mycopop's six entries describe something a camera could see. The reference case's eleven exclusions were all visual territories, authored for an image. One field cannot serve both consumers.

**There is no aesthetic evaluation loop.** The existing audit confirms rules reached the compiled text. Nothing examines the returned image. A frame that is fully compliant and mediocre passes every check the system has. An evaluation loop needs a standard to evaluate against, and visual grammar is that standard. Grammar states what the brand looks like; evaluation asks whether the frame met it. Building either alone leaves half a mechanism, which is why both are in this ADR's scope.

## Decision

Visual grammar becomes a first-class brain artifact, synthesized from sources, editable, versioned, and consumed by the scene writer and the compiler. A render evaluation reads the returned image against it and surfaces findings to the reviewer. Five parts.

### 1. A fourth artifact: `visualGrammar`

A peer to `dossier`, `livedWorld`, and `storyArchitecture` under `artifacts`. **Verified:** `artifacts` is a strict object requiring exactly those three keys, so this is a brain version bump and existing clients need re-synthesis to gain it, following the ADR 0015 precedent.

Its sections cover what a camera can see and nothing else:

- **People.** Who appears in the frame, what they look like, what they wear, how they carry themselves on camera. Casting logic rather than audience strategy.
- **Objects.** The era and condition of things: technology period, wear state, prop territory the brand owns.
- **Places.** Rooms, surfaces, and materials in physical space. Not content categories.
- **Light.** Sources, direction, behavior, color condition, contrast character.
- **Camera.** Objective settings, not adjectives: camera and format type, lens focal length, aperture and depth of field, exposure character, film stock or its emulation, composition construction including framing distance, height, and symmetry discipline. A register word such as documentary or editorial may appear only as shorthand that resolves to stated settings in the same entry, and never stands alone. This is the vocabulary the aesthetic mode library stood in for, quantified instead of named.
- **Rejects.** Visual territory the brand refuses, in terms a camera can see. The addendum's vocabulary shows the register: centred symmetry, spotless environments, decorative haze, exaggerated rim light, staged influencer poses.

Every entry carries the `basis` object from ADR 0015: origin, what it was derived from, and a confidence value. The origin enum gains a third value, `ambition`, for direction that rests on a declared outside inspiration rather than on evidence or reasoning about the brand as it stands. This mirrors the palette's existing directional-rather-than-approved label and keeps Rule 1 discipline in the artifact: an aspiration is never labeled as an established fact. Whether `ambition` is a third origin or a flag on `inference` is a shape question the prototype settles.

The interface presents it as marketers read it, in plain language, editable like its peers, with basis rendered as the existing plain-language note. No schema field names on screen.

### 2. Substitution rather than suppression is a synthesis rule, not a value statement

When a source is marked as an outside inspiration with declared influence, synthesis must author the brand's own physical version of that territory into the relevant grammar sections: what the people wear in that world, what era the objects belong to, what the rooms are made of, how the light behaves. Original motifs and invented forms carrying no readable third-party identity.

The intellectual property prohibition derived from the same source stays in the guardrails and continues to compile. The two are a pair with different jobs: the grammar opens the territory, the guardrail draws the line at the edge of it. The current failure is that only the line exists.

**Ambition, intake influence, and job-time weighting.** An earlier revision of this section claimed no influence field exists at intake. That was wrong and is corrected here. **Verified:** the Add Source form stores influence on the source at intake, alongside where it came from, whether it shows the brand today or a direction to explore, and how the Brain should use it. **Verified:** synthesis receives every source's influence, and the synthesis instructions define provenance and aspiration in detail while never defining influence, so the setting currently has no specified effect on what the brain writes. **Verified:** production offers the stored sources as job references, each defaulting to its intake influence and adjustable per job, and job settings never override approved guidance.

Three consequences follow.

The ambition trigger is the intake declaration the form already asks for: an outside reference marked as a direction to explore. The synthesizer is already instructed to treat such sources as declared direction and never as fact about the brand today. The ambition origin carries that same honesty into the grammar artifact, and the source becomes the entry's `derivedFrom`.

Influence gains a defined job on the brain side: it sets how much of the grammar a direction source may shape. Lead can set the frame for whole sections of the look. Light earns an entry, not a takeover. This makes the intake field mean what it tells the user it means, creative priority, and closes the gap where a declared level reached the synthesizer undefined. The instruction wording is a synthesis-step task and the prototype can test it by varying the level by hand.

Origin never sets compile weight. An ambition entry in an approved brain is approved guidance and compiles at full strength with no epistemic hedging in the prompt, because the image model needs direction and the human needs the label. The label persists in the package record and on the result screen. Approved grammar outranks a job-time reference's influence setting, including when both trace to the same source. If an ambition should steer softer, a person edits the brain; the compiler never dampens by origin.

**One gate question is tabled until testing.** Whether an ambition entry needs its own individual sign-off beyond brain approval, the way inferred audience facts do, is deferred to the prototype and the first real renders. The owner's stated inclination on 2026-08-15 is no second approval step, so brain approval stands as the gate unless testing argues otherwise. The schema work in step 2 should not build a second confirmation surface in the meantime.

### 3. Visual rejects live here, and `livedWorld.rejects` leaves the image path

Grammar rejects compile as avoid-clauses through the existing `rejectsDirection` pattern, which shipped in ADR 0015 step 5 and is proven at the mechanism level. Once grammar rejects compile, `livedWorld.rejects` stops compiling into image prompts. It remains in the schema, the interface, and the copy path, where it is doing the job it was designed for.

**The switch is per client, never global.** Clients re-synthesize at different times, so a compiler that switched at deploy would strip avoid-clauses from every brain that has not yet re-synthesized: no grammar rejects because the artifact does not exist yet, no lived-world rejects because the path was turned off. The compiler branches on artifact presence instead. A brain without a `visualGrammar` artifact keeps compiling `livedWorld.rejects` into image prompts until it has one, and the old path retires for that client at re-synthesis. The 2026-08-15 review flagged this as a regression waiting to ship, and it is treated as part of the decision rather than an implementation detail.

The generic render clichés in the addendum's vocabulary are mostly platform failure modes rather than brand facts: teal and orange grading and floating particles are wrong for every client. They do not compile as defaults into every brand's prompt, which would repeat the generic failure through a new door. They become evaluation criteria in part 4, and the synthesis instructions use them as register examples so brand rejects come back camera-visible.

### 4. A render evaluation reads the image against the grammar

After a render returns, an evaluation examines the image and reports findings on two standards:

- **Grammar fidelity.** Did the frame meet the brand's stated people, objects, places, light, and camera, and did it stay out of the rejected territory. Each finding cites the grammar statement it measures against, following the copy audit's pattern of a finding plus the governing text.
- **Render failure modes.** Is the frame generic, over-rendered, too clean, compositionally obvious. This is where the platform-level cliché vocabulary lives. It also checks for readable third-party marks, which is the guardrail's edge and the exact failure the ungoverned exhibit demonstrated.

Findings persist as a named block on the output record, a peer to `constraintAudit` and the copy audit findings, and render on the result screen beside the image. The evaluation runs post-render, so its findings attach to the output rather than to the pre-render package.

**The evaluation never delays the image.** The result screen shows the render immediately, with the evaluation shown in its not-run state, and findings replace that state when the evaluation completes. A render never waits on an advisory opinion. This also makes the not-run state the first thing every result renders, so the state is exercised constantly rather than only on errors. The evaluation is an additional vision-capable model call per render, a real cost and a real failure surface, which is another reason it stays out of the delivery path.

**Every finding carries an agree or disagree affordance from the day it ships.** One tap per finding, persisted on the output record beside the finding it judges, with no comment field required and no review queue built around it. Without this, the deferral of evaluator authority until a real reviewer's agreement rate says otherwise is a sentence with no mechanism, because nothing would ever collect the rate. The stored agreement data is what makes the tabled authority question answerable later. Cheap at build time, expensive to retrofit. The evaluation is advisory: the reviewer decides. It does not gate or auto-reject, because nothing has measured whether a model's aesthetic judgment is worth obeying, and an unmeasured judge should not burn render spend or block a human. If the evaluation errors, the output record and the result screen carry a not-run state rather than an absence. A clean-looking result with a silently failed evaluation is the failure direction this system never permits.

Calibration of the evaluation belongs to a real reviewer using the system over time, per the standing principle on audit calibration. The infrastructure ships ready for that person.

### 5. The scene writer consumes the grammar in place of summaries

The scene writer currently receives world, identity, and creative as summary plus principles, plus the creative rules summary and the dossier guardrails (identity amended 2026-08-15; see the correction in Context). It gains the visual grammar as its craft source: people, objects, places, light, camera, and rejects, compiled compact. This is what gives tightened rules something specific to reach.

The compiler carries the grammar into the image prompt within the budget discipline ADR 0015 established. Grammar compiles as direction, not recitation. The protection section is untouched: its 21.6 percent share is a verified measurement whose effect on output conventionality is assumed and untested, and this ADR does not compress it.

## Options considered

**A second rejects field on `livedWorld`.** Rejected. Finding 3 shows the two lists serve different consumers, and visual rejects are one section of a larger missing artifact, not a missing field on an existing one.

**Fold visual grammar into the identity and creative principles.** Rejected. This is the current state and it failed observably: the statements are marketer prose, distributed across sections with different production reach, and the most concrete one reaches the scene writer only as a graphic system rather than a physical world. A durable account of how the brand looks is an artifact, not a scattering of principles.

**Restore PWP's twelve-module library.** Remains rejected, unchanged from ADR 0015. The correction was about the knowledge, not the library. The grammar is brand-authored and brand-specific, synthesized per client, with no selection mechanism and no module accumulation.

**Evaluate against generic criteria without a grammar.** Rejected. A compliant, mediocre, generic frame passes generic checks. The evaluation is only as good as the standard, and the standard is the brand's.

**Ship grammar without evaluation, or evaluation without grammar.** Rejected per the addendum's reasoning: either alone is half a mechanism. They are sequenced within this ADR rather than split into two decisions.

**Gate renders on evaluation findings.** Deferred. Advisory first, measurement before authority.

## Consequences

The schema gains a fourth artifact and a third basis origin, a brain version bump requiring re-synthesis. Dialog Health is the regression check again: its grammar should come back evidenced and unsurprising. Mycopop is the effect check: its grammar should state the 8-bit territory as the brand's own physical world, labeled as ambition.

Compiled prompts change for every image job, so parity testing across placement shapes applies, per the ADR 0014 pattern.

The suggestion picker currently renders one of four authored scene fields. Once those fields draw on the grammar, judging the writer on a quarter of its output gets more expensive. The defect stands on the list and gains priority.

ADR 0015 step 3 remains open work under that ADR. The session recommendation, delete the regex selector and have the scene writer author register as a field, is coordinated with this decision, and the settings rule applies to that field: register resolves to stated settings, drawing vocabulary from the grammar's camera section. **Verified** in `src/production/prompt-craft.js` that `openingLine` falls back to the cinematic film still mode, so every unmatched prompt currently opens with that register's vocabulary. That the vocabulary produces the generic treatment is reasoned, not measured; the deletion does not need the measurement and does not wait for this ADR.

Approved rejections with stated aesthetic reasons are the natural feedstock for candidate grammar rejects through the ADR 0010 path, and the thesis names writing negative examples back to memory as workflow-two behavior. Roadmap, not critical path.

## Sequencing

Prototype gates schema commitment. One prerequisite stands ahead of all implementation: the work touches the scene writer, the synthesis instructions, the compiler, and prompt-craft, the most complex and most misread machinery in the repo. The image pipeline contract document is mandatory reading for the implementing session, and implementation does not start until that document exists and is verified against the current commit.

1. **Prototype, two fixtures, two failure directions.** Hand-author Mycopop's visual grammar as a fixture, with no schema change, camera section written as settings. Feed it to the scene writer in place of the identity and creative guidance and review the suggestion sets. The Mycopop gate tests expressiveness: scenes reach the declared territory as the brand's own version, with no readable third-party identity, and composition and lighting fields carry the grammar's stated settings rather than register adjectives, across at least three consecutive suggestion sets. A second hand-authored fixture, Dialog Health, tests the opposite failure: its suggestion sets stay evidenced and unsurprising, and do not get louder or more stylized than the brand's materials support. Over-prescription is the failure that killed PWP's approach and it shows up on conservative brands, not expressive ones, so a gate that only tests reach would pass a grammar that shouts. Both gates pass before anything is committed. This also settles the section shape and the ambition-origin question.
2. **Schema and interface.** The `visualGrammar` artifact with basis on every entry, presented in the brain view, editable, versioned with the brain.
3. **Synthesis.** Grammar synthesis with the substitution rule. Regression check on Dialog Health, effect check on Mycopop.
4. **Consumption.** Scene writer and compiler switch to the grammar; `livedWorld.rejects` leaves the image path. Parity testing across placements.
5. **Evaluation.** The render evaluation module, result-screen findings with cited grammar statements, persistence on the output record.

Step 1 gates step 2. Step 3 gates step 4. Step 5 needs the schema shape from step 2 and real grammars from step 3 to test against, and its build can begin once step 2 lands.

## Risks

**The evidence asymmetry returns.** Brand-published CPG sources say little about wardrobe, era, or rooms. Grammar entries will lean on inference and ambition, which is why the basis labels and the review surface from ADR 0015 apply here unchanged. A grammar that is mostly inferred and labeled as such is honest. A thin grammar surfaced to the client is a finding about their materials, not a failure of the artifact.

**Ambition quietly becomes fact.** The label must reach the compiled prompt and the result screen, not stop at the brain interface. Same risk ADR 0015 recorded for inference, same answer: cheap at build time, expensive to retrofit.

**Over-prescription returns.** PWP became prompt-heavy and hard to debug, and a six-section grammar could recreate that by accumulation. The guards: grammar compiles compact, rejects close space rather than prescribe it, per-job craft stays in the four scene fields, and the payload is measured on every change as it was in ADR 0015.

**The evaluator is confidently wrong.** A model grading aesthetics is an unmeasured judge. Advisory-only until a real reviewer's agreement rate says otherwise, and findings always cite the statement they measure against so a human can see when the citation does not support the finding.

**Substitution crosses the line it was meant to respect.** Authoring the brand's own version of a referenced aesthetic sits one step from reproducing the reference. The guardrail still compiles, the evaluation checks for readable third-party marks, and the ungoverned exhibit stays in the record as the case where crossing looks like success.

**Image quality remains unestablished.** ADR 0015's measured effects were payload and authored-scene share, not image quality, and one render has run the completed path. This ADR adds the standard and the measurement loop. It does not assume the direction is proven, and the prototype gate exists so the shape is tested against real suggestion sets before the schema carries it.
