# Evaluation: display copy rendered into images, first runs

- Date: 2026-08-11
- Author: Higher Roads
- Status: Encouraging on the mechanism, unresolved on scene composition. Not a pass or a fail; the sample is four renders on one brand.
- Related: ADR 0014 part two (revision of 2026-08-11), ADR 0013 (derived claims and copy audit)

## What this memo is

ADR 0014 part two originally gated in-image copy on a renderer fidelity test. The revision of 2026-08-11 replaced that gate with measurement against real governed strings, on the grounds that a fixture of synthetic short strings would not measure what mattered. This memo records what the first real runs showed.

It is not the benchmark. The benchmark needs mismatch rates by string class across many runs, and read-back verification does not exist. This is four renders, all on Dialog Health, observed by eye.

## What was tested

Client: Dialog Health. Placement: LinkedIn feed, 4:5 landscape. Copy type: `headline_set`, produced through the ADR 0013 claims assembly and audit, then passed into the render prompt as authored display copy.

Four runs, escalating:

1. Headline only, left panel. "Your Appointment, Confirmed"
2. Headline, supporting line, and call to action, upper left. "Securely Confirm Your Appointment" / "One tap, and you're all set." / "Confirm now"
3. Same three fields after the proportional design instruction was added. "Empowering Healthcare Through Communication" / "Dialog Health bridges the gap between patients and providers with secure, efficient messaging." / "Discover our platform"
4. A prior run without display copy, retained as the control for invented text (see below).

## Finding one: the strings rendered exactly

Every authored string came back character for character across all three display-copy runs. This includes punctuation that would be easy to lose: a comma inside a headline, an apostrophe in a contraction, and sentence-final periods on the supporting lines.

No substitution, no paraphrase, no correction, no duplication elsewhere in the frame. The renderer added an arrow glyph after the call to action in run three, which is an addition to the composition rather than a change to the string.

**Three for three is not a rate.** It is a strong enough signal to keep going and not strong enough to claim anything. The relevant unknown is not the overall rate but the distribution of failure kinds when it does fail: malformed characters are a quality problem, substituted words are a governance problem, and only the second would force the read-back requirement back to the centre. Nothing here has tested numerals, ampersands, long brand names, or strings near the character budget.

## Finding two: proportional design instruction outperformed character counts

Run one was given a character budget and produced a headline set at display size that broke across three lines. The budget had allowed roughly 114 characters for a 27 character headline, so it was not constraining anything.

The diagnosis was that the budget was measuring the wrong thing. Type size is chosen by the renderer to fill the space, so a longer string does not overflow, it gets smaller. The budget was rewritten as a legibility floor rather than a fit ceiling, and the prompt gained proportional instruction: the headline occupies roughly 70 percent of the copy area's height, the supporting line sets at about 45 percent of the headline, the call to action at 35, stated as relative sizes.

Run three, the first after that change, produced the cleanest typography of the set: hierarchy held across all three fields, lines broke at phrase boundaries, alignment was consistent, and the group read as one typographic unit.

**REASONED, not measured.** One run after the change is not evidence that the change caused the improvement. The characters-per-line figures behind the budget still come from typographic practice rather than measurement and are expected to move.

## Finding three: screen-bearing scenes have a rule collision

Run three placed the phone too large and oriented incoherently: the subject holds it in a viewing grip while turned toward the camera, looking at it.

This is not renderer whim. `prompt-craft.js` carries screen orientation rules stating that the screen faces the camera directly and remains fully visible and readable, and that a person should be positioned beside or behind it presenting outward, or seen over the shoulder. The render violated the pose rule specifically. Two effects follow from the collision:

**Nothing constrains scale.** "Fully visible and readable" gives the model a reason to enlarge the device, because a larger screen is a more readable one, and no rule caps how much of the frame it may occupy.

**Legibility fights natural posture.** A person reading their own phone angles it toward themselves. A screen facing the camera directly requires presenting it outward. Asked for both at once, the model splits the difference and produces a pose that is neither.

The abstraction behavior observed in earlier sessions, where screen content lifts off the device into an independent overlay, is likely the same collision resolving the other way: if the screen cannot be both legible and naturally angled, the content leaves the screen.

**Fix direction, not yet implemented.** The rules need a scale constraint and a resolution order stating which requirement wins when legibility and natural posture conflict. Logged in deferred work.

## Finding four: invented screen content is ungoverned and grows with scene quality

Every screen-bearing render filled its screen with invented content. The severity escalated as scene direction improved.

Run four, a dashboard scene, produced a full analytics interface: sidebar navigation, six metric cards, a line chart with legend, a donut, and an eight-row activity log. The numbers were internally consistent arithmetic (17,985 of 18,642 is 96.5 percent, and the downstream percentages all computed correctly against delivered), which makes fabricated performance data more convincing rather than less.

Run three produced a patient message from "Riverside Surgery Center", an invented organization carrying a verified badge, containing post-operative instructions: continue wearing the sling, start gentle range of motion, avoid lifting over five pounds.

**This is the most serious thing in this memo.** Fabricated post-operative medical guidance, with a specific weight limit, attributed to a named surgical center, inside marketing material for a healthcare client. The authored copy passed every governance check the system has. The invented copy beside it passed through nothing, and in run three it was the most detailed text in the frame.

The narrowed text safety rule introduced on 2026-08-11 states that apart from the authored display copy, no other words, labels, or captions are invented. That instruction did not hold, and it is not close to holding.

**Why it fails.** The rule was written for background surfaces. In a product demonstration scene the screen is the subject, not incidental signage, and the scene brief asks for a device presenting content. The instruction and the brief pull in opposite directions and the brief wins. The better the scene direction gets, the more plausible the invented content becomes.

## Position on next steps

The product owner's position, recorded here because it governs sequencing: the invented screen content iteration waits for a real client to say what is a dealbreaker rather than being solved speculatively. This is consistent with the calibration discipline applied to the ADR 0013 audit, where boundary setting was deferred to real client volume.

One qualification was raised and is recorded rather than resolved: a fabricated named healthcare organization issuing fabricated clinical instructions is a different class from audit noise, because the failure is not a threshold that needs tuning. Whether that changes the sequencing is a judgment for the owner.

Testing moves to a second brand next, for two reasons. Dialog Health is the hardest case, being healthcare, clinical, and high stakes, and clearing it was never the near-term bar. And three clean typography runs on one brand could reflect that brand's creative direction suiting the renderer rather than the instruction working.

Two things to watch on the second brand: whether typography quality holds on different creative direction, and whether a scene without a device avoids the composition problem entirely, which would confirm the fault is specific to screen-bearing jobs rather than general.

## What remains unbuilt

Read-back verification. ADR 0014 part two specifies that the system reads rendered text back out of the image and fails on mismatch. It does not exist. Until it does, the person is the verification step, the result screen shows the intended string beside the image and says nothing checks it, and the compiled record carries `verified: false`.
