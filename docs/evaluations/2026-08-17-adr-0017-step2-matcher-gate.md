# ADR 0017 step 2: the concern matcher gate, pre-registered

- Date: 2026-08-17
- Status: Pre-registered. Written and pushed before any matcher line, any re-cut hand judgment, and any run. Commit order is the proof, the same discipline step 1 and the ADR 0016 step 3 cycles used.
- Governs: ADR 0017 sequencing step 2, the diff between fresh synthesis output and a client's refusals document.
- Carries forward from the step 1 gate: G1 re-cut per prohibition, the eight boundary cases as a hard test set, and the boundary register as a standing structure rather than an appendix.

## What is being tested

Step 1 established that concerns are separable from wordings when a careful reader does the separating. Step 2 asks the next question and only that one: **can the matcher reproduce a hand judgment closely enough that its errors are tolerable in the direction they fall?**

The ADR already ruled the posture: err toward proposing. A wrong match that proposes something already ruled costs a redundant question. A wrong match that absorbs a new refusal into an existing concern costs a protection, silently, which is the failure mode the whole decision record exists to end. The two errors are not symmetric and this gate does not score them symmetrically.

## Input contract, widened per step 1 finding 3

The matcher takes refusals from four channels, not two. Step 1's inclusion rule saw three of them and missed the fourth, which is how MycoPop's floating-product rule stayed invisible to a fixture built from the captures.

| Channel | Present in the fixtures | Testable in this gate |
| --- | --- | --- |
| Visual grammar rejects | Yes, ten captures | Yes |
| Dossier guardrails | Yes, six stability captures | Yes |
| `livedWorld.rejects` | Yes, six stability captures | Yes |
| Creative and world guidance principles | No | **No, pending an owner paste** |

The fourth channel is named in the contract and is untestable here, because the guidance sections of both brands' approved brains are client state and the hard rules forbid reading them. If the paste arrives during this work it enters as gitignored fixture input under the step 1 convention and the channel is measured. If it does not, the gate reports the channel as declared and unmeasured rather than treating its absence as a pass. **Recording it as unmeasured is the whole point: a matcher that never sees a channel cannot fail on it, and a gate that stays silent about that reproduces the error step 1 finding 3 named.**

## The hand judgment, re-cut per prohibition

Step 1's G1 failed because it mapped per captured item. Guardrails and lived-world rejects are prose and carry as many prohibitions as their author wanted; four of 138 items carried two or three. The remedy is structural rather than a threshold change.

The hand judgment for this gate is authored at the prohibition level: every captured item is first decomposed into the distinct prohibitions it carries, and each prohibition is then assigned to exactly one concern or marked genuinely new. The decomposition is committed as its own artifact, separate from the assignment, so a later reader can disagree with either half without disturbing the other. The four items step 1 named are the known decompositions; more are expected and each one found is recorded.

The matcher is scored against the assignment. It never sees it.

## Conditions

**Condition A, in distribution.** The matcher runs over the captured prohibitions from all four cycle-2-instruction runs per brand, matched against the step 1 refusals documents at `fixtures/adr-0017-refusals/`. The two cycle-1 captures are run separately and reported as an out-of-distribution check, since cycle 1 predates the rejects-source revision and its output is not what a live matcher will meet.

**Condition B, held out.** A reduced refusals document is authored per brand from the cycle 2 capture alone. The matcher then runs the S1, S2, and S3 prohibitions against that reduced document. Condition B exists because of a leak that Condition A cannot remove: the step 1 fixture statements were written by an author who had read all ten captures, so their wording overlaps the material they are scored against more than a real client's document would overlap a fresh run.

**Where A and B disagree, B is the reading this gate reports as primary.** Stated here so the choice is not made after the numbers exist.

## Measures

Computed per brand, per condition, over prohibitions rather than items.

**M1, over-merge. The harmful direction.** A prohibition the hand judgment marks genuinely new, which the matcher attaches to an existing entry. Each one is a protection that never reaches a person.
- Rate above 0.05 of genuinely-new prohibitions fails.
- **Absolute, independent of rate: any over-merge onto a `declined` or `retired` entry fails the clause outright.** Absorbing a new refusal into a concern a person already declined suppresses it under a ruling nobody made about it.

**M2, under-merge. The tolerable direction.** A prohibition the hand judgment assigns to an existing concern, which the matcher calls new. Each one is a redundant question.
- Rate above 0.30 of already-covered prohibitions fails. The threshold is loose on purpose. A rebuild surfacing two redundant questions is an annoyance; the ADR accepted that cost explicitly.

**M3, declined parity.** Suppression on `declined` entries must not be materially worse than on `active` ones, since the ADR's stated reason for persisting declines is that a re-proposed paraphrase gets matched rather than re-litigated. Measured as the difference in correct-match rate between the two statuses.
- A gap above 0.15 in favour of active entries fails, because it means declines persist without doing the job they persist for.

**M4, the eight boundary cases. Reports, does not pass or fail.** For each case in the step 1 boundary register, record whether the matcher merged or split, and against which entry. These cases have no correct answer, because a careful reader could not settle them. What they measure is whether the matcher is stable across runs on the same pair and whether it lands the same way in both conditions. An unstable boundary call is a finding about the matcher's usefulness rather than its accuracy.

**M5, the uncertainty posture.** The ADR ruled that an uncertain match proposes. This is checked as behavior, not as instruction text: for every prohibition the matcher reports at its lowest confidence band, record whether it proposed or matched. Any low-confidence outcome that matched rather than proposed fails, because the posture is either enforced by the mechanics or it is a sentence in a prompt that the sampling ignores when it feels like it.

## Decision rule, stated before the runs

- M1 failing, on either measure, fails the gate. No other result outranks it.
- M5 failing fails the gate, and is reported alongside M1 rather than after it.
- M2 or M3 failing is a real result that does not block step 3, provided M1 and M5 hold. A matcher that asks too many redundant questions is tunable; a matcher that eats protections is not shippable.
- Condition A passing while Condition B fails is reported as a Condition B failure. The leak runs in one direction and only one.
- Any clause found to be mis-specified during the work is reported as written, never re-cut after results exist. The step 1 precedent is the owner's ruling of 2026-08-17: the escape hatch would be discovered exactly when results disappoint. Remedies live forward, in step 3's pre-registration.

## Stated limitations, named before judgment

**The hand judgment has one author, who also authored the fixtures it scores against.** Step 1's finding 5 recorded that its mechanical check could not detect the failure it was written to catch, because the mapping was the author's judgment rather than an independent measurement, and the real failures were found by reading. That holds here with more force, since the matcher is scored against that same author's assignment. The boundary register is the structural mitigation and it is carried forward for exactly this reason: calls that could go either way are named rather than resolved silently, so a second reader can check the close ones without re-reading everything.

**Two brands and eight runs cannot estimate a distribution.** They can establish whether the matcher's errors fall in the tolerable direction on this material, which is what step 2 is allowed to ask.

**The creative and world guidance channel is unmeasured** unless the paste arrives, per the input contract above.

**Cycle 1 output is out of distribution** and its numbers are reported separately rather than pooled.

## Stop rule

The ADR specifies concern matching as a model call at synthesis time. **This session stops at the mechanics proposal, before any run**, per house precedent: the mechanism, its input contract, its confidence bands, and its fail-safe branch are proposed and ruled before a single call is made. Fixture construction, decomposition, and the reduced Condition B documents need no model calls and proceed.

## Mechanics proposal, for ruling before any run

Proposed, not built. The stop rule above holds: nothing runs until this is ruled.

### Where it sits

Inside the existing synthesis path in `src/brand-brain/service.js`, after `#parseSynthesisCompletion` returns a schema-valid brain and before persistence. No new `api/` file; the 12-function ceiling is unchanged. On `dryRun`, the matcher runs and its result rides along in the response without writing, which is what makes the gate's runs possible without touching a client's document.

### What it receives

Two arguments and nothing else.

**The fresh material**, drawn from the four channels in the input contract: `visualGrammar.sections.rejects`, `dossier.guardrails`, `livedWorld.rejects`, and the guidance principles once the channel is testable. Each arrives as an item with its channel named, because a guardrail and a grammar reject are different shapes and the decomposition step needs to know which it is holding.

**The client's concern list**, read from `refusals.json`: for every entry regardless of status, its id, concern, statement, and status. **Declined and retired entries are included.** Excluding them would mean a declined concern returns as a fresh proposal every rebuild, which is the exact behavior the ADR's persistence rule exists to prevent.

### What it returns

For each input item, a set of results rather than one. This is step 1 finding 1, accepted into the design by the owner's ruling of 2026-08-17: guardrails carry two or three prohibitions and a one-in one-out matcher drops the second silently.

Each result carries the prohibition as the matcher read it, a matched entry id or null, and a confidence band of high, medium, or low. Nothing else. **The matcher does not rewrite statements, does not rule, does not retire, and does not propose removals.** Its whole authority is to say whether it has seen this concern before.

### Decomposition and matching, one call or two

Proposed as one call, with the alternative stated because it is a real fork.

**One call.** The model receives the items and the concern list together and returns prohibition-level results directly. Cheaper, and the decomposition is informed by the concern list, which helps: a guardrail naming both borrowed property and competitor copying decomposes more cleanly when the reader already knows both concepts exist as separate concerns.

**Two calls.** Decompose first with no knowledge of the client's document, then match. More expensive and slower, and it removes a bias the one-call version carries: a decomposer that can see the concern list will tend to cut prohibitions along the lines the list already draws, which inflates match rates and hides genuinely new refusals inside familiar shapes.

**The recommendation is two calls,** on the reasoning that the bias runs toward over-merge, and over-merge is the harmful direction under M1. The cost is one extra call per synthesis, on a path that already makes one very expensive call. **This is the ruling most worth making before the runs**, because the gate cannot fairly measure over-merge on a mechanism whose decomposition step was primed by the answer key.

### Confidence and the fail-safe branch

Three bands, with the ADR's uncertainty posture enforced by the mechanics rather than by the prompt:

- High and medium: the match stands, a re-observation is appended to the entry, nothing surfaces.
- Low: **the mechanics discard the match and record a proposal**, whatever the model said. This is the M5 clause made structural. A posture that lives only in prompt text is a posture the sampling ignores when it feels like it.

Every failure mode collapses the same way: a non-2xx response, a timeout, a parse failure, a returned entry id that is not in the document, or a malformed result all cause every item in that synthesis to be recorded as a proposal. **Synthesis never fails because matching failed, and matching never suppresses because it broke.** The worst outcome is a person ruling on a slate they have mostly seen before.

Temperature 0, for the same reason the claim auditor runs at 0: this is a judgment about identity, not a generation.

### What it writes

Proposals enter the document as `proposed` through `proposeEntry`, carrying `ruling.proposed_by_run`. Matches append through `recordObservation` with the run id and the fresh wording, so an entry absorbing many observations is visible to a reader, which is the ADR's stated mitigation against a concern quietly swallowing everything.

Nothing else in the document is touched. Status changes stay human-initiated.

### Open questions the owner should settle with the ruling

1. **One call or two.** Recommended above as two. Everything else here holds either way.
2. **Does the matcher see statements or concerns alone?** Proposed: both, because the concern is a short name and two different refusals can share a short name. The risk is that statement wording drives the match and the concern key stops doing the work step 1 measured it doing.
3. **What happens on the first synthesis after this ships,** when a client has no `refusals.json`. Proposed: every prohibition is a proposal, the person rules the full initial slate once, exactly as the ADR describes. Worth confirming, because it is also the moment the matcher is least useful and most expensive.

### What remains before the runs

The prohibition-level decomposition and its assignment, and the Condition B reduced documents. Neither needs a model call and neither is blocked by this ruling.

## Decomposition record, authored before any matcher exists

The hand judgment is cut and committed. Two artifacts, deliberately separate: `fixtures/adr-0017-refusals/prohibition-decomposition.json` holds the cut, and `prohibition-assignment.json` holds the answer key. A reader can reject one without disturbing the other.

| | MycoPop | Dialog Health |
| --- | --- | --- |
| Captured items | 75 | 63 |
| Prohibitions after the cut | 79 | 69 |
| Items carrying more than one | 4 | 5 |
| Prohibitions marked genuinely new | 1 | 0 |

Step 1 named four multi-prohibition items across both brands. The finer cut found nine, and the five it added are the reason the re-cut was worth doing rather than a threshold change.

**The cut recovered the floating product.** MycoPop's cycle 1 reject against artificial forests carries two independent prohibitions: unreal forest staging, and a can placed without weight or contact. A product can float in a photographically ordinary room, so the second does not follow from the first. Step 1 finding 3 recorded the floating-product territory as living in a creative guidance principle and therefore outside the fixture population. It was also sitting in the grammar channel the whole time, hidden inside a staging reject that the per-item cut read as one refusal. It is the only prohibition on either brand marked genuinely new, and no fixture entry holds it.

**One step 1 reading is reversed, recorded rather than made quietly.** Boundary case 5 read MycoPop's regenerated reject against aggressive stimulation, jitters, and a crash as a single concern. The per-prohibition cut splits it, because the approved lived-world rejects hold stimulant signaling and the crash arc as separate entries, and the cut follows the material rather than the earlier call.

**Two fixture entries are themselves compound**, which the cut can expose and cannot fix. `ref-dh-sender` carries both an unidentified sender and a missing next action in one concern name; three Dialog Health items decompose into halves that land on it separately. `ref-dh-logo-rebuild` absorbs the RCS Template asset's fixed role alongside artwork reconstruction, because no capture reaches the template role independently. Both are flagged in the assignment notes. A compound concern is a place where the matcher can be right and the answer key still coarse, and M4's stability reading should be read with that in mind.

### Condition B, built

`fixtures/adr-0017-refusals/condition-b/` holds the reduced documents: six entries for MycoPop, five for Dialog Health, being the step 1 entries whose concern is reached by at least one cycle 2 grammar-reject prohibition, carried over unchanged in wording and ruled active. Nothing was rewritten for this condition, because rewriting would reintroduce the leak the condition exists to remove.

Sizes are worth stating before the runs: the S1 through S3 prohibitions will be matched against 6 and 5 entries rather than 24 and 19. **A smaller candidate set makes over-merge harder and under-merge easier**, which pushes Condition B toward passing M1 and failing M2. That direction is stated now so it is read as a property of the condition rather than discovered as a result.

## The fourth channel, measured

The guidance principles for both brands arrived as an owner paste on 2026-08-17 and are held gitignored under the standing pattern. The channel step 1 finding 3 named is now cut and assigned alongside the other three, so this gate measures it rather than reporting it unmeasured.

| | MycoPop | Dialog Health |
| --- | --- | --- |
| Guidance principles carrying a prohibition | 21 | 21 |
| Prohibitions after the cut | 23 | 22 |
| Prohibitions marked genuinely new | 5 | 6 |
| Prohibitions across all four channels | 102 | 91 |
| Genuinely new across all four channels | 6 | 8 |

Principles carrying no prohibition are listed by key in the decomposition artifact, so the exclusion is auditable rather than trusted. MycoPop's required FDA disclaimer is excluded and named as the reason: a disclosure requirement is not a refusal, and folding it in would put a thing that must appear into a store of things that must not.

**This channel makes M1 measurable, which it was not before.** Over-merge is a rate over genuinely-new prohibitions. Across the three channels the fixtures were built from, that denominator was 1 on MycoPop and **0 on Dialog Health**. A rate over zero cases is not a loose measurement, it is no measurement, and the gate would have reported a clean M1 on Dialog Health while testing nothing. With the fourth channel the denominators are 6 and 8. Small, and stated as small, and real.

**Eleven concerns reach the brands only through this channel.** MycoPop: the floating product, identity specifications inferred from screenshots, generic lifestyle aspiration standing in for real routines, a single spokesperson as the only format, and mushrooms presented in isolation. Dialog Health: undocumented identity attributes invented rather than left undocumented, RCS Template.png altered, website and deck patterns promoted to approved rules, slogans and superlatives stacked, forced informality, and conditional capabilities presented without accurate labelling. That is roughly a quarter again on top of the 43 concerns the first three channels produced.

Three of them settle open questions rather than adding volume.

**The floating product is confirmed from a second direction.** The per-prohibition cut recovered it from MycoPop's artificial-forests grammar reject. The creative guidance principle states it outright: start with a recognizable human need, not a floating product. Two independent channels, one refusal, no fixture entry holding it.

**The RCS Template role is reached independently after all.** The step 1 assignment folded it into the artwork entry with a note saying it was arguably its own concern and was not split because no capture reached it alone. A guidance principle reaches it alone. The note is answered: it is its own concern.

**The fear concern gains a third home.** Dialog Health's world guidance directs against sensationalized clinical scenarios. Clause S6 established the refusal lives in the approved lived-world rejects and partly in a guardrail; it also lives here. A refusal absent from every regenerated channel across three runs is present in three separate places in the approved brain.

### What this does not change, and one ruling it needs

The step 1 gate's numbers stand. Its population was pre-registered and its clauses were scored against it, and a gate is not re-scored because later material arrived.

The ruling: **the step 1 fixture documents are not amended to hold the eleven new concerns.** They stay as judged, and the new concerns stay marked genuinely new in the assignment. The alternative, growing the documents, would make Condition A's candidate set include entries authored from the very channel being matched against it, which is the leak Condition B exists to remove, reintroduced on the other side. The cost is that Condition A's document is known incomplete, and a matcher that proposes those eleven is scored correct for doing so.

## Run harness proposal, for ruling before the action is pushed

Proposed, not built. Follows the ADR 0013 precedent: a clearly named test action on an existing handler, callable from the owner's authenticated browser, using the server's own key, adding no serverless function. The container has no egress to the model, so the runs happen server-side and their payloads come back by paste, the same cost every prior gate carried.

### The action

`POST /api/brand-brain` with `action: "run_matcher_gate"`, dispatched from `api/brand-brain/index.js` alongside `run_audit_test`. The dispatch comment gains its line. Function count is unchanged at twelve.

**Request body**

| Field | Meaning |
| --- | --- |
| `action` | `run_matcher_gate` |
| `fixture` | `mycopop` or `dialog-health`. A fixture id, not a client id. |
| `condition` | `A` or `B`. Selects which refusals document the matcher is given. |
| `channels` | Which channels to run in this call, so a run can be chunked rather than sent whole. |
| `privateItems` | Captured items whose text is not in the repository, sent inline by the browser. Approved guardrails, approved lived-world rejects, and guidance principles. |

**Response**: one result per item, carrying the item key, the prohibitions the decomposer cut, and for each one a matched entry id or null, a confidence band, and the outcome after the low-confidence override. Plus the model id, the temperature, and both call counts. Nothing is persisted and nothing is written anywhere.

### Guards

1. **The action never touches a client namespace.** It constructs no store. Refusals documents come from the imported fixtures under `fixtures/adr-0017-refusals/`, selected by the `fixture` field, which is validated against the two known fixture ids and rejects anything else. There is no code path in this action that reaches a blob.
2. **The action never sees the answer key.** `prohibition-assignment.json` is not imported. Scoring runs offline against the returned payload. A handler that held both the input and the key could produce a scored result nobody could check.
3. **Private material is never persisted and never logged.** `privateItems` is read from the body, passed to the model, and dropped. It does not enter the response except as the prohibitions the decomposer cut from it, which is the measurement.
4. **Two calls, decomposer blind.** The decomposer receives items and nothing else. The matcher receives the decomposer's prohibitions plus the concern list. The handler cannot pass the concern list to the decomposer, because the decomposer function does not take it as an argument.
5. **Temperature 0 on both calls**, model reported in the payload so a later reader knows what produced the numbers.
6. **Chunking cap.** A request over a stated item count is refused with a message naming the cap, so a run cannot silently truncate.
7. **Naming and disposition.** `run_matcher_gate` says what it is. Retained or removed after the gate per the owner's call, with the ADR 0013 precedent being that `run_audit_test` was retained and recorded as a known ambient state.

### One new committed fixture this needs

`fixtures/adr-0017-refusals/captured-items.json`, holding the item text for the three channels already public in the step 3 parity document: grammar rejects, regenerated guardrails, regenerated lived-world rejects. Extracted mechanically from that document rather than retyped. It exists so the action can import its input instead of the browser pasting 106 items that are already in the repository. The approved and guidance channels stay out and arrive as `privateItems`.

### The thing the precedent forced, stated plainly

The pre-registered measures are defined over prohibitions. **A blind decomposer produces its own cut, which will not align one to one with the hand cut, so a prohibition-level score cannot be computed by matching prohibition ids.** That is a consequence of the blind-decomposer ruling and it is correct: a decomposer that produced the hand cut exactly would be a decomposer that had seen it.

The operational form proposed, specified now while no results exist:

- **Scoring is per item, over concern sets.** The hand judgment gives each item a set of concerns, possibly including `new`. The matcher gives each item a set. The two sets are compared.
- **Over-merge**: the hand set contains `new` and the matcher's set contains no proposal. A protection that should have surfaced did not.
- **Under-merge**: the hand set contains concern C and the matcher proposed new instead. A redundant question.
- **Decomposition quality is reported separately**, as prohibition count per item against the hand count, and it is a report rather than a measure. It is the number that tells a later reader whether a bad match was a bad cut wearing a match's clothes.

This specifies how the pre-registered measures are computed. It does not move a threshold and it is written before any run, which is the only time such a specification is legitimate. If the owner reads it as changing what M1 and M2 measure rather than how they are computed, it should be ruled as an amendment to the pre-registration and dated as one, not absorbed quietly.

### What the owner does

Approve or amend this shape. Then, per run: open the deployed app authenticated, send the action with the private items pasted for that brand and channel, and return the payload. Two brands, two conditions, chunked by channel. Scoring, judgment, and findings happen offline against those payloads.

## Judgment

To be written after the mechanics are ruled and the runs exist, appended below rather than folded into the clauses above.
