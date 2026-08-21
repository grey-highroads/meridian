# Findings: ADR 0015 implementation session, 2026-08-14 evening

- Date: 2026-08-14
- Author: Higher Roads
- Relates to: [`decisions/0015-build-render-quality-on-people-scene-and-rejects.md`](decisions/0015-build-render-quality-on-people-scene-and-rejects.md)
- Status of the work: steps 1, 2, 4, and 5 shipped to `main`. Step 3 not started. One finding invalidates part of the ADR's decision.

## Why this document exists

ADR 0015 was proposed in the morning and four of its five steps were built the same day. The build surfaced things the ADR could not have known, including one that contradicts a choice the ADR made explicitly. Recording them here keeps the ADR readable as a decision and keeps the correction traceable.

Read the finding on visual grammar first. It is the one that changes the plan.

## What shipped

All on `main`, all deployed.

**Steps 1 and 2.** A `basis` object on the `environments`, `patterns`, and `social` arrays of `livedWorld`, recording whether each entry rests on evidence or reasoning, what it was derived from, and a confidence value. Rendered in the artifact view as a plain-language note. The synthesis instructions gained a Lived World block stating the subject, naming the content-practice failure mode, and permitting inference in two layers.

**Version provenance and rebuild.** The Brand Brain overview now states whether the current version came from a full build or an update to an earlier one, when it was prepared, and how many sources it read. A rebuild control reads every source again with no baseline.

**Step 4.** The scene writer authors world, composition, lighting, and props as four fields. Composition carries camera height, focal length, depth of field, cropping, foreground to background structure, and a ranking of what the eye hits first.

**Step 5.** Guidance sections compile as summary plus principles rather than full recitation. Product knowledge compiles to physical form and visual direction. `livedWorld.rejects` compiles into the prompt as avoid-clauses.

**Composition hierarchy and instance rules.** The person and the action rank above the product. One unit carries readable branding and any further unit is turned away, occluded, cropped, or defocused past reading.

## Measured effect

Compiled payload for a Mycopop image job fell from 22,750 characters to 15,148, a 33 percent reduction. The authored scene rose from 236 characters to 1,161, a factor of 4.9. Both figures are from compiled packages, not projections.

**Verified.** The lighting field executed. A brief specifying warm sunset as primary, string lights as secondary, and long shadows produced exactly that. This is the first render in which authored light behavior reached the output.

**Not established.** Whether any of this improves image quality. Four renders were reviewed during the session. One ran through the completed path. One predated steps 4 and 5. One compiled with an empty scene field. One was produced outside BWS. A single data point supports no conclusion in either direction, and no image produced during the session was shippable.

## Finding 1: visual grammar was specified in the thesis and never built

`docs/product-thesis.md` lists what the world-building workflow must do, and includes:

> articulate visual grammar and lived-world logic

Lived-world logic exists as a schema artifact. Visual grammar does not exist anywhere in the schema. What stands in for it is a handful of sentences distributed across the identity and creative principles.

**This invalidates one of ADR 0015's rejections.** The ADR declined to restore PWP's visual grammar library, reasoning that four authored scene fields carry the same knowledge without the machinery. That reasoning was correct about the library and wrong about the knowledge. Four fields let a scene writer invent craft per job from a summary. They do not give a brand a durable, versioned, editable account of how it looks. The two are not substitutes, and the session demonstrated the difference: rules were added to the scene writer three times and each was satisfied at its weakest available reading, because there was nothing specific for the rules to reach.

**Verified** that the artifact does not exist. **Reasoned** that its absence is the binding constraint on scene quality, on the evidence in findings 2 and 3.

## Finding 2: a declared aesthetic ambition reaches production only as a prohibition

Mycopop supplied an 8-bit retro gaming reference marked as an outside inspiration source with strong declared influence. The product owner's intent was that it shape the visual world.

What the brain produced from it:

- In the identity principles: develop proprietary pixel icons, interface frames, and motion rules rather than lifting recognizable game imagery.
- In the creative principles: use original retro-game devices as framing, transitions, motion, navigation, or data display, not as decorative nostalgia everywhere.
- In the guardrails: retro gaming is a declared creative ambition from an outside reference, not an established current identity system. Use it as a direction to develop, not as proof that the brand already owns arcade culture.
- In the palette: one color, Arcade Black, labelled directional rather than approved.

**Verified.** The scene writer receives the world and creative principles, the guardrails, and the identity summary. It does not receive identity principles. `api/production/generate-copy.js` pushes `identity.summary` alone while world and creative push summary plus principles. The most concrete statement about the aesthetic never arrives.

**Fixed 2026-08-15.** The identity push now sends summary plus principles, matching the world and creative pattern, an interim fix under ADR 0015 taken during the ADR 0016 amendment pass. The ADR 0016 review required either this fix or a recorded decision to leave the known-broken state in place, and the owner chose the fix. Payload effect, reasoned from the schema rather than measured from a live compile: identity principles are three to six sentences, added to the scene writer's input context only. The compiled render package is untouched, so the ADR 0015 render payload budget is unaffected. The fix is superseded when ADR 0016 step 4 replaces guidance summaries with the visual grammar as the scene writer's craft source.

**Verified.** Of what does arrive, the guardrail is the most specific and it is a brake. It is delivered under the heading RULES AND GUARDRAILS, alongside claim rules and asset-reconstruction rules.

**Verified.** Every usable statement describes retro gaming as a graphic system: icons, frames, motion, navigation, data display. Nothing states what the people look like, what they wear, what room they are in, or what era the objects belong to. The scene writer composes photographic worlds and has nothing to build from.

Result: three consecutive suggestion sets produced a home office, an urban park, and a living room. The aesthetic did not appear.

**The mechanism is suppression rather than substitution.** The real constraint is an intellectual property rule: do not reproduce third-party game characters, screens, logos, typography, or package designs. That rule is correct and the synthesizer derived it properly from the client's material. What the system does with it is retreat from the entire territory, when the correct behavior is to author the brand's own version of it. Original sprite motifs, invented cartridge forms carrying no readable titles, era-correct display technology and lighting and room materials, the brand's palette in physical space.

**Exhibit.** A frame produced outside BWS from a short direct prompt reached the aesthetic convincingly and is unshippable for exactly the reason the rule exists. It contains a readable third-party controller wordmark, four readable third-party game titles, two third-party characters, and a third-party sprite repeated across five surfaces. It also fabricated the can label text and gave a second unit readable branding. The frame demonstrates both halves of the finding: the territory is reachable, and reaching it without governance produces work that cannot ship.

## Finding 3: the rejects list serves copy, not images

`livedWorld.rejects` now compiles into the image prompt. Mycopop's six entries are: jitters and a hard crash, artificial-tasting sweetness or a strange aftertaste, chalky or medicinal formats, vague wellness mysticism without product facts, aggressive gym-bro or extreme-energy signaling, dense scientific language with no practical meaning.

Two of six describe something a camera could see. The rest describe product experience and language.

**Verified** by reading the compiled package. **Reasoned:** the field is doing its job. It was designed to describe what a person rejects, which is the right content for copy governance and audience work. The ADR assumed one field could serve both consumers and it cannot. The reference case's eleven exclusions were all visual territories, authored for an image.

This belongs to the visual grammar artifact rather than to a second rejects field.

## Finding 4: incremental synthesis silently carries artifacts past the rules that govern them

Adding sources runs the incremental path, whose instructions require copying unaffected fields from the baseline exactly and preserving the baseline where new material conflicts. A change to the synthesis instructions therefore does not reach an existing brain, and a brain can carry passages written under rules that no longer exist while appearing freshly synthesized.

**Verified.** This is what happened between the step 2 push and its first review. The subject anchor had not executed once at the point it was assessed as ineffective.

Version provenance and the rebuild control were built in response and are the mitigation. The deeper question, whether the app should actively flag an artifact that predates the current instruction set, needs an instruction version stored alongside the brain and is not addressed.

## Finding 5: the sequencing held

Step 2 gating steps 4 and 5 was correct and worth the cost of ordering. After the rebuild, the Lived World described a person, the scene writer offered options outside the client's existing feed, and the aspirational source pulled through into the brand foundation and palette. Steps 4 and 5 then had a usable artifact to work from.

The ADR's note that step 1 should read existing artifacts as evidenced was not implemented. Mycopop's pre-existing entries traced accurately to an Instagram screenshot while describing the wrong subject, so labelling them evidenced would have made a wrong artifact look trustworthy. The basis note is omitted where no basis exists.

## Defects found and not fixed

**Protection is the largest section in the prompt and the one failing hardest.** 3,278 characters, 21.6 percent of the compiled payload, larger than the reference case's entire render payload. It carries claim rules, asset-reconstruction rules, screen rules, text safety, and product rules in one block. Compressing it is the risky kind of compression and needs its own pass.

**The social path compiles with an empty scene.** One reviewed package contained the mode opening line, the format, and the placement craft note, with no authored scene at all. The render was a category-default product hero. Preflight should not permit it.

**The suggestion picker shows one of four authored fields.** Only `option.brief` renders. Composition, lighting, and props return in the same response and are never displayed, so the scene writer is judged on a quarter of its output.

**Suggestions enumerate the guidance.** The world section lists early starts, sustained work, movement, and later-day resets. Three consecutive suggestion sets mapped one option per listed routine. Variance is low because the writer is being faithful to a fixed list.

**Dead code.** `compileProductSection` in `src/production/package.js` is no longer called.

**The regex aesthetic mode selector.** Step 3 of the ADR sequencing, still open. The recommendation from this session is to delete it and have the scene writer name the register as an authored field, which is a small addition to work already touching that surface. Not verified that the opening line is its only consumer.

## What this changes about the plan

The remaining ADR 0015 work is step 3 and the defect list above. None of it is blocked.

The larger conclusion is that ADR 0015 addressed the production path and the Lived World, and left the gap the thesis named. Visual grammar as a first-class brain artifact is the next decision and needs its own ADR. Its scope: what the people look like, what they wear, the era and condition of the objects, the rooms and surfaces, how light behaves, what the camera does, and what visual territory the brand refuses. Brand-specific, synthesized from sources, editable, versioned, and consumed by the scene writer in place of a summary.

Two things to carry into that ADR. Substitution rather than suppression is the governing principle, from finding 2. And the visual rejects list belongs there rather than in `livedWorld`, from finding 3.

## Addendum: an independent repo review, same evening

A review of the repository was run separately against the question of why renders read as generic. It reached the same central conclusion, that the missing visual grammar artifact is the architectural gap, and it cites this document, so its agreement on findings 1, 2, 3, and on the protection measurement is not independent corroboration. Three of its points are new and are recorded here.

**There is no aesthetic evaluation loop.** The existing audit confirms that rules reached the compiled text. Nothing examines the returned image and asks whether it is generic, over-rendered, too clean, or compositionally obvious. A frame that is fully compliant and mediocre passes every check the system has.

This changes the scope of the visual grammar ADR rather than adding a second project. An evaluation loop needs a standard to evaluate against and visual grammar is that standard. Grammar states what the brand looks like; evaluation asks whether the frame met it. Building either alone leaves half a mechanism.

**The aesthetic mode selector steers rather than merely failing to steer.** Recorded above as coarse. The sharper reading is that its fallback default is a cinematic film still, and vocabulary of that kind is what produces a recognisable generated-commercial treatment. The opening line of every unmatched prompt is therefore pushing toward the failure mode. Step 3 of the ADR sequencing was scoped as cleanup folded into other work; it is better understood as a small change with plausibly high effect and the cheapest item outstanding.

**A usable starting vocabulary for visual rejects.** Centred symmetry, spotless environments, decorative haze, teal and orange grading, exaggerated rim light, floating particles, showroom materials, staged influencer poses, stock-photo behaviour. This is the register finding 3 says is missing: exclusions a camera can see.

One claim from the review is not accepted. It holds that protection at 21.6 percent of the payload pushes the renderer toward the safest and most conventional answer. The measurement is verified and the effect is **assumed**. It is a claim about attention weighting that nobody has tested, and it should not justify compressing a section where every line performs governance until it is.
