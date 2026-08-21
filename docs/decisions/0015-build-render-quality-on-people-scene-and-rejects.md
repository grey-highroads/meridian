# ADR 0015: Build render quality on synthesized people, an authored scene, and what the brand is not

- Status: Proposed. Steps 1, 2, 4, and 5 shipped 2026-08-14. One rejection corrected by the session findings below.
- Date: 2026-08-14
- Owner: Higher Roads
- Supersedes: The 2026-08-14 draft of this ADR, which scoped the problem to Lived World inference alone
- Related: ADR 0006 (portable generation package), ADR 0009 (update from an approved baseline), ADR 0012 (products as governed records), ADR 0014 (governed copy alongside imagery)

## Context

A Mycopop social image review on 2026-08-14 produced a render that read as generic category work. The compiled prompt, the Brand Brain artifacts, the BWS repository, and the PWP source were all read to find the cause.

The renderer was faithful to its prompt. The prompt was faithful to the scene brief. The scene brief was faithful to the Brand Brain. The Brand Brain was faithful to its sources. Every stage did its job, which is why nothing looked broken.

A PWP render package for Liquid Death, direction "Late-Shift Kitchen Camaraderie", is used throughout as the reference case. It produced a photograph of a line cook on a milk crate in a service alley at blue hour, face hidden behind a hand mid-laugh, warm sodium light pooling on wet asphalt, another person's legs cropped into the frame. No product, no copy, and unmistakably that brand. It is a viable brand world background: subject weighted right, open ground on the left for a can, clear sky above for a headline.

Four differences separate that package from what BWS compiles today.

### One: the Lived World has no person in it, and no way to say so

Mycopop's Lived World describes the brand's marketing output. Every entry under `environments` is justified by the brand's own posting behavior:

> Earned by repeated polished product compositions in the Instagram screenshot.

Five environments, five variants of that justification. The `patterns` entries fill the `time` field with content-calendar categories rather than times of day. The `social` entries describe content modes.

Dialog Health's Lived World, same schema and same synthesis prompt, describes a person: "A capable healthcare communicator working under pressure." Its life patterns are temporal, from days before care through weeks or months later. Its rejects are that person's rejects.

**Verified.** Mycopop's sources are a website and an Instagram screenshot, both brand-published material about a product. Dialog Health's website is B2B and describes a buyer in its source text. The synthesizer is evidence-faithful in both cases.

**Reasoned.** This is a category asymmetry rather than a client accident. B2B marketing sites describe the buyer because that is how B2B sells. Consumer packaged goods sites describe the product because that is how CPG sells. Emerging CPG is one of two revenue tracks, and every CPG client will produce a Mycopop-shaped artifact.

**Verified.** The synthesis instructions already carry the right rule: "When evidence is thin or conflicting, create a review question rather than filling the gap." The schema overrides it. `environments` requires three to six entries, `patterns` three to six, `wants` three to six, `social` two to four. Structured output enforces the schema, so the model cannot follow the instruction and return a valid document. Handed brand-only evidence and a floor of three, it produced three from the only behavior it could observe.

**Verified.** Nothing in the synthesis prompt states what the Lived World is about. The only mention is "Build a genuinely useful Brand Dossier, Lived World, and Story Architecture, not short placeholders." The subject is carried entirely by field names and interface headings.

### Two: the scene brief is one prose field where PWP had four

PWP authored **World**, **Composition**, **Lighting**, and **Props** as separate fields. The composition field for the reference case specifies off-center placement in the left two-thirds, the decisive moment of a hand-to-mouth gesture, depth running from foreground crate through midground prep table to background graffiti, one shoulder cropped by the right edge, a second person's legs cropped at the bottom, head-height camera, 50mm equivalent, shallow depth of field, and loose documentary framing. It states an explicit ranking: human gesture first, worn environment second, light transition third.

BWS asks for two or three sentences in one field, under three rules: describe only what a camera could see, stay inside earned environments, make the three options differ. Mycopop's scene brief came back as "A MycoPop can is dramatically lit against a glossy red backdrop. Digital pink-and-red light effects pulse around the can. The scene conveys a sense of bold, dynamic energy." That satisfies all three rules.

Camera behavior, light behavior, and compositional hierarchy have nowhere to be written down.

### Three: the world gets two percent of the prompt

PWP's writer records `"world_share":59`. Its header comment states the design directly: an earlier compiler fragmented the authored scene into a labeled field taxonomy, and the revision inverted the instruction budget so the authored prose is the render prompt, with protection appended as one compact block.

Mycopop's authored scene is 371 characters inside a 22,571 character package. Two percent. Measured by section:

| Section | Chars | Share |
| --- | --- | --- |
| Product knowledge | 4,063 | 18% |
| Protection | 3,107 | 14% |
| Rules | 2,275 | 10% |
| Creative | 2,255 | 10% |
| Display copy | 2,129 | 9% |
| Foundation | 1,784 | 8% |
| Identity | 1,760 | 8% |
| World | 1,687 | 7% |
| Visual materials | 1,057 | 5% |
| Brand foundation | 1,013 | 4% |
| Audience and feeling | 750 | 3% |
| Assignment (contains the scene) | 383 | 2% |

The guidance sections are recited at full synthesized length. They are strategic prose written for a marketer to read, compiled verbatim into an instruction for an image model.

**The payload comparison runs the opposite way to expectation.** PWP's full render payload for the reference case was 2,737 characters, positive and negative combined. BWS compiles 22,571, which is 8.2 times heavier and produces the weaker image. Giving the world its share is a matter of compressing what is already there, and the result should be a smaller payload rather than a larger one. This bears on API cost and latency as well as quality.

### Four: nothing tells the model what the brand is not

The PWP negative for the reference case is brand-specific: generic beer culture, frat party stereotypes, extreme sports clichés, fake rebellion, people posing with products, empty edgy aesthetics, generic nightlife, luxury lifestyle, wellness imagery, corporate advertising polish, staged influencer content, and "avoid treating the brand as simply a canned water product."

That is a rejects list. It closes off the obvious wrong answers and leaves everything else open.

**Verified.** `livedWorld.rejects` exists in the BWS schema, is populated by synthesis, and is displayed in the interface. It appears nowhere in the production path. Neither do `wants` or `tensions`. Dialog Health's rejects include "Generic technology spectacle disconnected from healthcare work" and "Fear-based depictions of patients or clinical situations." The 2026-08-11 evaluation recorded renders producing invented analytics dashboards and fabricated clinical instructions from a named surgical center.

**Verified.** `src/production/package.js` never reads `artifacts.livedWorld` at all. The guidance order is foundation, identity, world, creative, rules, plus dossier palette, materials, and guardrails.

The distinction that matters here is between instruction that closes the space and instruction that opens it. Prescriptive guidance removes options with every sentence. A rejects list removes wrong answers and leaves the model free among the rest. BWS is almost entirely prescriptive, and the guardrails it does carry (no invented text, no opened packaging, no readable screens) are platform invariants that apply identically to every client. It has no brand-specific negative anywhere.

### What this adds up to

The pipeline is a governance document with a sentence of art direction attached, aimed at an artifact that describes the client's own marketing. The renderer is the last stage and the least at fault.

## Decision

Render quality rests on synthesizing the people a brand serves, giving the scene room and structure to be a scene, and telling the model what the brand is not. Four changes, in dependency order.

### 1. The Lived World is the load-bearing artifact for production

It is not one of three peers. Its quality sets the ceiling on every render, because the scene writer composes from the person, the earned environments, and their reasons. A Lived World that describes a content calendar produces renders of a content calendar.

Synthesis gains an explicit subject anchor: the Lived World is the person the brand serves, living their life, with products in tow. It is not the brand's content practice, and observed posting behavior is not a life pattern.

### 2. Lived World entries may be inferred, and inference is recorded as a field

Each entry in `environments`, `patterns`, and `social` gains a basis: whether it rests on supplied evidence or on reasoning, what it was derived from, and a confidence value from the existing High, Medium, Low vocabulary. The shape mirrors the existing `earned` field.

The compiler already treats epistemic origin, confidence, and provenance as fields never derived from one another, per `docs/production-compiler.md`. This extends that discipline to a live artifact that lacks it.

**Inference reasons at two nested layers.** The broad layer draws on category knowledge to establish the audience a product of this kind serves. The narrow layer reasons from the client's own supplied facts to find the tighter segment inside it, naming the specific facts it rests on. Caffeine-free formulation, Appalachian sourcing, a slim can at a premium shelf position, and mushroom-led positioning imply things about a buyer, and those implications are specific to this brand.

**The narrow layer governs production.** The broad layer is by construction what every competitor in the category would also receive.

**Inference surfaces in review.** `reviewQuestion` already carries confidence, an evidence array with quotes, method, rationale, and two to five actions. Its `type` enum gains a value for this class rather than a second review pattern being built.

**Evidence attaches to inference rather than replacing it.** One customer review does not overturn a persona, and no automatic threshold promotes an inference to evidenced. Confirmation in review is the only thing that changes the label, which makes a person the promotion gate. This matches the existing separation between approving an output, approving guidance, and promoting to canon.

### 3. The scene brief becomes structured

The scene writer produces **world**, **composition**, **lighting**, and **props** as separate authored fields rather than one paragraph.

Composition is where camera behavior, spatial depth, cropping, and visual hierarchy get stated. Lighting is where sources, direction, colour condition, and contrast get stated. These are the fields PWP used, and they are where the creative direction actually lives.

This replaces the alternative of restoring PWP's twelve-module visual grammar library. The modules encoded camera and light knowledge in a selectable form; four authored fields encode the same thing per job without a library to maintain or a selection mechanism to build.

The three options a user chooses between remain three options in plain language. The structure is behind them.

### 4. The world carries the prompt budget, and the brand's rejects reach the model

Guidance sections are compiled as compact direction rather than recited at synthesized length. Protection stays as one compact block, which is already its documented design. The authored scene becomes the majority of the prompt.

`livedWorld.rejects` compiles into the prompt as brand-specific exclusions.

**The renderer accepts one prompt string and has no negative channel.** `src/renderers/openai-images.js` builds a single `prompt` field for both generation and edit paths. Rejects therefore compile as avoid-clauses inside the positive prompt. PWP's positive did this partially alongside its separate negative, so the pattern is proven but the load-bearing version is not. This needs a small test before commitment.

## Options considered

**Anchor the subject in synthesis and change nothing else.** Rejected. The schema minimums remain, so the model must still produce three to six environments. Pushed toward people without evidence about people, it invents an audience instead of describing posts. That output is more plausible, less falsifiable, and carries no traceable source. Mycopop's current artifact is wrong and legible, which is how the fault was found in minutes. This trades a visible failure for an invisible one.

**Relax the schema minimums to zero and let artifacts come back thin.** Rejected for now, and it remains the honest fallback. It surfaces a real gap to the client at onboarding, which has product value. It also ships visibly incomplete brains and changes what onboarding promises without giving the client a way forward. Revisit if inference quality proves poor.

**Restore PWP's twelve-module visual grammar library.** Rejected in favour of structured scene fields. The library encoded genuine craft, but `docs/product-thesis.md` records that PWP became prompt-heavy and hard to debug, and ADR 0013's revision names PWP as the over-prescription failure mode already learned from. A module library needs a selection mechanism, a maintenance burden, and a discipline against accumulating modules into a prompt. Four authored fields get the same knowledge into the render for a fraction of the machinery.

**Add a customer-evidence intake slot.** Deferred by the owner on 2026-08-14. The seven current slots are website, logo, brand guide, templates, Instagram, LinkedIn, and recent work, all brand-published. A slot for reviews, support tickets, or community posts is what makes inference improvable rather than permanent. It is the natural follow-on and is not on the critical path once inference exists.

## Consequences

The schema gains a field on three artifact arrays, which is a brain version bump and requires re-synthesis for existing clients to benefit.

Mycopop's brain does not improve through re-synthesis alone until inference exists, and improves further only when customer evidence is supplied.

Dialog Health's Lived World should re-synthesize substantially unchanged, with its entries still marked as evidenced. That is the regression check.

Compiled prompts change for every image job, so parity testing across placement shapes applies, following the pattern established for the ADR 0014 copy contract after the 2026-08-09 regression.

The compiled payload should get smaller. That is a cost and latency improvement alongside the quality one, and it is worth measuring rather than assuming.

## Sequencing

1. Schema basis field and its interface presentation, no synthesis change. Existing artifacts read as evidenced.
2. Synthesis subject anchor plus inference permission. Regression check: Dialog Health re-synthesizes with entries still evidenced; Mycopop re-synthesizes with a person rather than a content calendar.
3. Review question type and the inference review surface.
4. Structured scene brief fields.
5. Prompt budget rebalance and rejects compilation, gated on the avoid-clause test.

Step two gates steps four and five. A structured scene brief and a rejects list applied to an artifact describing a client's Instagram grid produce well-composed generic work.

## Risks

**Inference quality is unmeasured.** Nothing here establishes that a reasoned persona beats no persona. The Dialog Health regression check tests that evidence still wins, not that inference is good. Real measurement needs client volume and a second CPG brand.

**The broad layer can dominate.** If category reasoning outweighs brand-fact narrowing, the system produces the category's audience for every client in that category. This is the generic failure returning through a new door, and it is the thing to watch on the first CPG re-synthesis.

**Compression can lose governance.** Compiling guidance as compact direction rather than full recitation risks dropping a constraint that was doing real work. Guidance compression and claim governance are different concerns and the ADR 0013 claims spine is unaffected, but the guardrails inside the guidance sections need checking against the compressed output.

**Avoid-clauses inside a positive prompt may not hold.** Models are known to attend poorly to negations in positive prompts. If the test in step five fails, the fallback is compiling rejects as positive statements of what the brand does instead, which is weaker because it closes the space the rejects were meant to leave open.

**The label can stop at the brain.** Rule 1 of this project requires inferred claims about how a business works to be labelled as inferred. Building that behaviour into the product means the label reaches the compiled prompt and the result screen, not only the brain interface. Cheap at build time, expensive to retrofit.

## Implementation findings, 2026-08-14

Four of the five steps were built the same day this ADR was proposed. The build is recorded in [`../findings-2026-08-14-adr-0015-session.md`](../findings-2026-08-14-adr-0015-session.md), which should be read alongside this decision.

One finding corrects this ADR rather than extending it. The rejection of PWP's visual grammar library, above, reasoned that four authored scene fields carry the same knowledge without the machinery. That was correct about the library and wrong about the knowledge. `docs/product-thesis.md` names visual grammar as a required output of the world-building workflow and no such artifact exists in the schema. Four fields let a scene writer invent craft per job from a summary. They do not give a brand a durable account of how it looks, and the session demonstrated the difference: scene writer rules were tightened three times and each was satisfied at its weakest reading, because nothing specific existed for them to reach.

Visual grammar as a first-class brain artifact is a separate decision and needs its own ADR. Two constraints carry into it. Substitution rather than suppression, since a declared aesthetic ambition currently reaches production only as a prohibition. And the visual rejects list belongs there rather than in `livedWorld`, since a rejects list useful to a copywriter is not the list an image model needs.

Measured effect of steps 4 and 5: compiled payload down 33 percent, authored scene up by a factor of 4.9, authored light behavior reaching a render for the first time. Whether image quality improved is not established. One reviewed render ran through the completed path.

## Reference case

The Liquid Death package is retained as the target specification rather than an illustration. It demonstrates the whole argument in one artifact: a synthesized person produced a scene brief with authored composition and lighting, the world took 59 percent of a 2,737 character payload, and the brand's rejects closed off eleven category clichés by name. The result is a usable brand world background that reads as that brand without a product in frame.
