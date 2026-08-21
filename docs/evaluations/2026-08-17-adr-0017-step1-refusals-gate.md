# ADR 0017 step 1: the refusals fixture gate, pre-registered

- Date: 2026-08-17
- Status: Pre-registered. Written and pushed before any fixture entry or store line exists. Commit order is the proof, the same discipline the ADR 0016 step 3 cycles used.
- Governs: ADR 0017 sequencing step 1, the store and the hand-authored refusals documents for both test brands.

## What is being tested

ADR 0017 rests on one load-bearing claim: **a refusal's concern is separable from its wording.** Everything downstream depends on it. Concern matching at step 2 matches on concern. A decline persists so a paraphrase of the same concern can be suppressed. A re-observation attaches to a concern rather than to a phrasing. If concerns are not separable from wordings against real synthesis output, the design does not work and the ADR revisits before step 2 rather than after.

This gate tests that claim against the only real material available: the ten recorded step 3 captures and the two brands' currently approved refusal exports. No model calls. No reads or writes on any client namespace. The captures already exist.

## Source material, stated so the population cannot be chosen after seeing results

**Grammar rejects.** Verbatim in `docs/evaluations/2026-08-16-adr-0016-step3-parity.md` across ten captures: cycle 1, cycle 2, and stability runs S1, S2, S3, for each of MycoPop and Dialog Health.

**Regenerated dossier guardrails and regenerated `livedWorld.rejects`.** Present in the six stability captures only. The four cycle captures carry `artifacts.visualGrammar` alone, because the capture snippet extracted nothing else. That scoping is recorded in the parity document and is not a gap this gate can close.

**Currently approved guardrails and `livedWorld.rejects` for both brands.** These live in client storage rather than the repo. They arrive as an owner paste, held under `fixtures/adr-0017-approved-refusals/` and gitignored, per ADR 0004 and the ADR 0016 step 1 precedent. Never committed.

## Authoring rules, fixed before authoring

**Rule A, the inclusion test.** A captured item enters the population when it is refusal shaped, meaning it names something that must not be done or must not appear. Applied to every grammar reject entry in the ten captures, every regenerated guardrail in the six stability captures, every regenerated `livedWorld.rejects` entry in the six stability captures, and every approved guardrail and approved `livedWorld.rejects` entry in the paste.

**Rule B, the exclusion is auditable.** A guardrail carrying no prohibition contributes no entry. Every such guardrail is listed by title in the judgment, so the exclusions can be checked rather than trusted.

**Rule C, status reflects standing today.** An entry whose concern is carried by currently approved material is authored as `active` with an accepted ruling, because it is a rule in force. An entry whose concern appears only in regenerated captures is authored as `proposed`. The fixture then shows exactly what a step 2 diff would surface, rather than flattening the two populations into one approved set.

**Rule D, no schema invention.** The entry shape is the ADR's shape. Where the material does not fit the shape, that is recorded as a finding against the shape. Fields are not added to make the fixture pass.

## Clauses and conditions

**G1, total mapping. Absolute.** Every refusal-shaped captured item maps to exactly one concern entry, or is recorded as genuinely new. Zero items map to two entries. Zero items map to none. A single item requiring two entries to be stated honestly fails the clause, because it means the concern granularity is wrong rather than the wording.

**G2, paraphrase convergence.** The five grammar-reject captures per brand are five draws under the same instruction, so they are the sharpest available test of whether wording varies while concern holds. Two measures, both computed per brand over grammar-reject items only.

- Under-merge test: concern count divided by item count. A ratio at or above 0.75 fails, because almost nothing merged and the concern key is doing no work.
- Convergence test: the share of grammar-reject items landing on a concern that two or more distinct captures reached. Below 0.70 fails.

Both thresholds are set here, before any count exists. G2 failing is the negative result the gate was built to be able to return: the concern split does not hold against real output, and the ADR's design revisits before step 2.

**G3, domain coverage. Reports, does not pass or fail.** Every entry is classified as visual, verbal, or both. Visual means the refusal can be stated in terms a camera can see, which is the ADR's stated discipline for `statement`. Any entry whose honest statement cannot be written in camera-visible terms is named. This clause exists because the approved refusal set includes claim-language and copy-domain protections, and the ADR's entry shape asks for visual terms. Whether that is a scope question or a shape question is not decided here.

**G4, origin honesty.** No entry requires an `ambition` origin to be honest. Every basis is evidence or inference with a `derivedFrom` naming material that actually contains it. The clause has teeth: MycoPop's cycle 1 grammar rejects contain two `ambition`-origin entries, recorded before the cycle 2 rule fixed the instruction. Failure reopens the ADR's origin rule rather than being patched in the fixture.

**G5, placement fidelity under clause S6.** For refusals that are approved and never regenerated, `derivedFrom` names where the refusal actually lives in the approved brain, per the clause S6 resolution. Two known cases are checked by name: Dialog Health's fear-based depiction refusal, and MycoPop's stimulant-culture refusal. An entry claiming derivation from material it does not appear in fails the clause.

**G6, lifecycle round trip. Absolute.** Each fixture document passes through the store's operations in sequence: propose, accept, decline, retire, with a supersession. Conditions: entry count never decreases, no field is dropped, ids are stable across every operation, declined entries remain present and readable, retired entries remain present and readable, and the document round-trips through serialization unchanged in content. Deletion must not exist as an operation. Runs offline against the pure document layer, zero blob calls, zero network.

**G7, the boundary register. Reports, does not pass or fail.** Every pair of captured refusals where a careful reader cannot decide whether the two share a concern is recorded by name with the reason. Step 2's matcher gate needs exactly these cases, and a gate that only records its confident calls hands step 2 a test set with the hard cases removed.

## Decision rule, stated before the work

- G1 or G6 failing fails the gate outright. Both are absolutes.
- G2 failing is a successful gate with a negative result. It is recorded plainly, the fixtures are not adjusted until they pass, and the ADR's concern design revisits before step 2 begins.
- G4 failing reopens the ADR's origin rule and is reported ahead of G3 and G5.
- G3, G5, and G7 report into step 2 regardless of the other outcomes.

## Stated limitations

Two brands and ten captures cannot establish that concern separability holds generally. They can establish whether it holds here, which is the question step 1 is allowed to ask.

The four cycle captures carry no guardrails and no regenerated `livedWorld.rejects`, so the regenerated population for those two channels is six captures rather than ten. Concern coverage drawn from those channels is correspondingly thinner and no clause treats absence there as evidence.

The author of the concern split is also its judge in this session. Nothing in this gate removes that. G7 is the mitigation: boundary calls are named rather than resolved silently, so a second reader can check the ones that were close.

## Judgment

Run 2026-08-17 against `fixtures/adr-0017-refusals/` and `src/refusals/store.js`, both created after the clauses above were pushed. Mechanical counts are reproducible with `node fixtures/adr-0017-refusals-gate.mjs`, which parses the captures out of the committed step 3 parity document.

### Population

| Channel | MycoPop | Dialog Health |
| --- | --- | --- |
| Grammar rejects, five captures | 30 | 23 |
| Regenerated guardrails, three captures | 17 | 15 |
| Regenerated lived-world rejects, three captures | 16 | 14 |
| Approved guardrails, from the paste | 6 | 5 |
| Approved lived-world rejects, from the paste | 6 | 6 |
| **Total captured items** | **75** | **63** |
| **Concern entries authored** | **24** | **19** |

**Corrected 2026-08-17.** The Dialog Health regenerated lived-world rejects row read 13 and the channel holds 14. The row was typed by hand while the totals came from the harness, so the total of 63 was right and the row beneath it did not sum to it. Recounted against the captures and corrected in place. No clause outcome depends on the row: every measure in this document is computed over the mapping, which covered all 14, and the harness confirmed zero unmapped items at the time of the run.

**Rule B, the auditable exclusion: the list is empty on both brands.** Every guardrail in every capture and in both pastes carried a prohibition, so none was excluded for lacking one. Guardrails whose title reads as positive direction still carry a refusal in the body. Dialog Health's `Keep people in the process` directs that automation not be shown replacing human judgment; MycoPop's `Own refreshment` directs that the competitor's system not be copied. A reader scanning titles alone would have excluded several of these wrongly.

### G1, total mapping: **fails as written, on four items, none of them grammar rejects**

The harness reports zero unmapped items, zero unknown keys, zero items carrying two concern ids, and zero dangling ids on both brands. **That result proves nothing by itself,** because the same hand that authored the concerns authored the mapping, and a one-to-one mapping can always be produced by choosing a primary concern. The clause asked whether any item *requires* two entries to be stated honestly. Four do.

| Item | Concerns it carries | Assigned to | Why the other half is not lost |
| --- | --- | --- | --- |
| MycoPop, S2 guardrail `Build an original world` | Borrowed entertainment property, and competitor execution copied | Borrowed entertainment property | The competitor half is carried by `ref-myc-competitor`, reached by four other captures |
| MycoPop, S2 lived-world reject on being trapped between caffeine energy drinks and inconvenient supplement rituals | Stimulant culture signaling, and preparation ritual as the cost | Preparation ritual as the cost | The stimulant half is carried by `ref-myc-stimulant` |
| Dialog Health, approved guardrail `Never reconstruct exact identity assets` | Artwork rebuilt from a screenshot, brand color estimated by eye, and the RCS Template asset's fixed role | Artwork rebuilt from a screenshot | The color half is carried by `ref-dh-guessed-color`, whose derivation names this guardrail; the template role is folded into the artwork statement |
| Dialog Health, approved lived-world reject naming generic technology spectacle disconnected from healthcare work | Unreal technology imagery, and the work not being identifiably healthcare | Unreal technology imagery | The category half is carried by `ref-dh-generic-category` |

**What this failure means, stated precisely.** The concern split holds. The *unit* the clause chose does not. Grammar rejects are one refusal per entry by construction, and all 53 of them mapped cleanly. Guardrails and lived-world rejects are prose, and prose carries as many prohibitions as its author wanted. The clause should have been written per prohibition rather than per item, and I wrote it per item before looking at the guardrail channel closely enough.

This is a defect in the pre-registration, recorded rather than corrected in place, and it is also a real property of the material that step 2 inherits: **the concern matcher must be able to emit more than one concern match from a single guardrail.** A matcher built on one-in, one-out will silently drop the second prohibition in roughly one guardrail in eight.

### G2, paraphrase convergence: **passes on MycoPop, fails on Dialog Health**

Grammar-reject captures only, five per brand.

| Measure | MycoPop | Dialog Health | Threshold |
| --- | --- | --- | --- |
| Concerns over items | 10 / 30 = 0.333 | 13 / 23 = 0.565 | fails at or above 0.75 |
| Items on a concern two or more captures reached | 26 / 30 = 0.867 | 16 / 23 = 0.696 | fails below 0.70 |

Dialog Health misses the convergence threshold by 0.004, and the miss turns on merge calls I could not make confidently. Two of them flip it independently:

- Merging `ref-dh-unreal-tech` into `ref-dh-generic-category` gives 0.783.
- Merging `ref-dh-clinical-product` into `ref-dh-clinical-theater` gives 0.739.

Both merges are defensible readings. I kept both pairs separate, and the reasons are in the boundary register below. Recording the fail rather than taking the merge that rescues it is the whole point of fixing the threshold before counting.

**The clause is also measuring the wrong thing, and this matters more than the 0.004.** Convergence as I defined it counts how often two runs surfaced the same concern. The step 3 stability check already established that runs do not agree on which concerns surface, and ADR 0017 exists because of that. A singleton concern is a run noticing something no other run noticed, which is the scouting value the ADR claims as a gain, not evidence that concern and wording are inseparable. So my convergence measure partly re-measures known instability and reads it as a failure of the concern key.

The separability question is answered by the other half of the table. On MycoPop, five captures produced 30 differently worded refusals that resolve to 10 concerns, and the four largest concerns are each reached by four or five separate draws in wording that shares almost no vocabulary. `No copied game worlds`, `No borrowed game property`, `No Borrowed Game Property`, `No borrowed properties`, and `No readable game property` are five drafts of one rule. On Dialog Health the same holds at 13 concerns from 23 items. **Concerns are separable from wordings on both brands.** The ADR's load-bearing claim survives this gate.

Both facts go forward: the pre-registered clause failed on one brand, and the claim the clause was built to test held on both.

### G3, domain coverage: **reported. Roughly one refusal in six governs language rather than imagery.**

| Domain | MycoPop | Dialog Health |
| --- | --- | --- |
| Visual, statable in terms a camera can see | 18 | 17 |
| Visual and verbal | 0 | 1 |
| Verbal only | 6 | 1 |

The seven verbal-only entries are MycoPop's health claims stated as promises, product specifics stated without records, current practice promoted to approved guidance, a declared direction presented as established identity, customer testimony used as substantiation, dense scientific language without practical meaning, and Dialog Health's feature inventory without consequence.

None of these can be written in camera terms without changing what they protect. `Do not state or imply that MycoPop cures disease` is not a fact about what a lens records. **This is a scope question the ADR does not answer.** ADR 0017 specifies `statement` in visual terms and specifies consumption as the avoid-clause source for image prompts. Both are correct for the image path. But the instability finding that motivated the ADR was measured on the dossier guardrails, and guardrails compile into the protection block of image prompts *and* carry the brand's claim discipline, which governs copy. A refusals document that holds only camera-visible statements leaves the verbal guardrails exactly where they are now: regenerated from scratch every rebuild, with the same silent churn the ADR was written to end.

Six of MycoPop's 24 approved and proposed protections are in that position. Recorded as finding 2 below rather than resolved here.

### G4, origin honesty: **pass on both brands**

Zero entries carry an origin other than evidence or inference. The store refuses `ambition` at the door with a named error, so the clause is enforced by the shape rather than by the author's discipline.

Two entries are the real test and both hold.

MycoPop's cycle 1 grammar rejects contain two `ambition`-origin entries, `No copied game worlds` and `No warm dry hero`, recorded before the cycle 2 instruction fixed the rule. Both re-ground cleanly: the same concerns appear in later captures at `inference`, derived from the fact that the 8-bit source and the Odyssey screenshot are outside material supplied as direction. The fact that a source is aspirational is itself evidence about the source.

`ref-myc-direction-as-identity` is the sharper case, because its entire subject is an ambition: do not present the 8-bit direction as an identity the brand already owns. Its origin is evidence, because the approved guardrail stating the rule exists, and `derivedFrom` names the direction source that motivated it. That is exactly the split ADR 0017 specifies, tested against the one entry most likely to break it.

### G5, placement fidelity under clause S6: **pass, with one count that moves**

**Dialog Health, fear-based depiction.** `ref-dh-fear` derives from the approved lived-world reject naming fear-based depictions of patients or clinical situations, and partly from the approved guardrail on making care communication practical, which directs focus onto useful actions rather than dramatizing patient vulnerability. It derives from nothing else, because there is nothing else: the concern is absent from the regenerated guardrails, the regenerated lived-world rejects, and the grammar rejects, in all three stability runs. It is one of two entries in this fixture whose only support is the approved paste. It compiles into production prompts today.

**MycoPop, stimulant culture.** `ref-myc-stimulant` derives from the approved guardrail against imitating stimulant culture and the approved lived-world reject of aggressive gym-bro or extreme-energy signaling. In the regenerated material it is reached by the S2 guardrail protecting caffeine-free positioning and by lived-world rejects in S1 and S3 that name always-on hustle.

That last part moves a number in the parity document. Clause S6 recorded the stimulant-culture territory as appearing in one stability run of three. Reading always-on hustle as the same concern as extreme-energy signaling makes it two of three. Both readings are defensible and I have flagged the merge in the boundary register. The S6 conclusion does not turn on it, since two of three is still a concern surviving on a minority of draws, but the number differs from the one that document records and a later reader comparing them should know why.

### G6, lifecycle round trip: **pass on both brands**

Each fixture loads into an empty document through `proposeEntry`, then runs accept, decline, observe, supersede, accept the replacement, and retire. Checked after: every original id is still present and readable, the entry count rose by exactly the one supersession replacement and fell by nothing, the declined entry is still there with status `declined`, the retired entry is still there with status `retired` and is excluded from `activeEntries`, the observation attached to its entry rather than replacing anything, the superseded entry points at its replacement, and JSON serialization changes nothing. Deletion is not an operation the module exports.

Run offline against the pure document layer. Zero blob calls, zero network, zero client namespace touched.

### G7, the boundary register

The cases where a careful reader could go either way. Step 2's matcher gate needs these, and a register that lists only the confident calls hands step 2 a test set with the hard cases removed.

**1. MycoPop: period reenactment against the pasted pixel layer.** Both are failure modes of the retro direction. One is over-literal period staging, the other is postproduction imitation. Kept separate. A matcher that merges them is not obviously wrong.

**2. MycoPop: clinical staging against apothecary staging.** Examination rooms and dosage rows on one side, scattered powders and tinctures and pill piles on the other. Merged into one concern, the drink staged as medicine, because both protect the same thing and the approved lived-world reject of chalky or medicinal formats covers both. Splitting them gives 0.833 convergence, still a pass, so the clause outcome does not turn on it.

**3. MycoPop: the warm dry hero against the borrowed refresh filter.** One is a wrong subject, the other a wrong technique, and both protect the rule that refreshment is recorded rather than asserted. Merged. Splitting gives 0.833, still a pass.

**4. MycoPop: always-on hustle against gym-bro and extreme-energy signaling.** Merged into stimulant culture signaling. This is the merge that moves the clause S6 count from one run to two, described above. The strongest argument for merging is that the approved guardrail names frantic speed and a caffeine-like hit in the same breath as stimulant intensity. The strongest argument against is that hustle culture is a life posture and gym-bro is a visual register, and a camera acts on them differently.

**5. MycoPop: aggressive stimulation, jitters, and a crash in one regenerated reject.** Read as one concern, harsh energy as the expected cost. Reading it as two would split stimulant signaling from the crash arc, which the approved lived-world rejects do keep as separate entries.

**6. Dialog Health: unreal technology imagery against the work not being identifiably healthcare.** The sharpest case in the register, because the G2 outcome turns on it. Floating chat bubbles appear as a symptom in both. Kept separate on the reasoning that one protects against unreality and the other against category generality, and a frame can fail either without failing the other: a photographically real image of a person texting in a coffee shop fails the second and passes the first. Against that reading, the brand's own approved lived-world reject names both in a single phrase.

**7. Dialog Health: the platform staged as clinical treatment against clinical theater as shorthand.** One is the product misrepresented as a medical device, the other is medical set dressing standing in for real work. Kept separate. Merging gives 0.739, a pass, so this call also flips the clause.

**8. Dialog Health: executives-only against the passive administrator.** Merged into one concern, a role portrayed without the work it actually does. The two regenerated rejects are describing different omissions, and a matcher could reasonably hold them apart.

### Overall gate

| Clause | Result |
| --- | --- |
| G1 total mapping, absolute | **Fail**, four items, all in the guardrail and lived-world-reject channels |
| G2 under-merge | Pass on both brands |
| G2 convergence | Pass on MycoPop at 0.867, **fail on Dialog Health at 0.696** |
| G3 domain coverage | Reported: 7 of 43 entries are verbal only |
| G4 origin honesty | Pass on both brands |
| G5 placement fidelity | Pass, with one S6 count that moves under a flagged merge |
| G6 lifecycle round trip, absolute | Pass on both brands |
| G7 boundary register | Eight cases recorded |

**By the decision rule stated before the work, the gate does not pass.** G1 is an absolute and it failed. G2 failed on one brand.

**And the design claim the gate was built to test held on both brands.** Those two sentences are both true and neither cancels the other. The clauses that failed are the ones whose construction this session found to be wrong: G1 chose the wrong unit, and G2's convergence measure partly re-measures the instability ADR 0017 already accepts as given. Neither failure is evidence that concerns cannot be separated from wordings. The evidence on that question is 53 differently worded grammar rejects resolving to 23 concerns with no forced merges, across two brands with different source registers.

The fixtures are not adjusted. Nothing here is patched to pass.

## Findings

**Finding 1: guardrails carry more than one prohibition, and grammar rejects do not.** All 53 grammar-reject items mapped one to one. Four of the 65 guardrail and lived-world-reject items carry two or three prohibitions in one body. Step 2's concern matcher takes guardrails as input and must emit a set of concern matches per item rather than a single match, or it drops the second prohibition silently. This is the one finding on this page that changes step 2's design rather than its evidence.

**Finding 2: the refusals document as specified cannot hold the verbal guardrails whose instability motivated the ADR.** Seven of 43 entries govern language rather than what a camera records. ADR 0017 specifies `statement` in visual terms and specifies consumption as the image path's avoid-clause source, both correct for the image path. Finding 7 of the step 3 evaluation, the instability that motivated this ADR, was measured on dossier guardrails, and six of MycoPop's protections in that channel are claim-language rules that no camera statement expresses. Under the ADR as written those six stay regenerated from scratch on every rebuild. Whether the document widens to hold them, or a second governed record covers claim language, or the claims document already does and the seam needs stating, is a scope decision that belongs to the owner and probably to an amendment rather than to step 2.

**Finding 3: the fixture population is narrower than the set of refusals that actually govern.** The pre-registered inclusion rule drew from grammar rejects, guardrails, and lived-world rejects. It missed a third source. Clause S6 recorded that one of the three unreached territories, the floating product on MycoPop, rests on neither a guardrail nor a lived-world reject but on a creative guidance principle: start with a recognizable human need, not a floating product. That refusal governs today, and it is absent from this fixture because the inclusion rule could not see it. A refusals document populated from guardrails and rejects alone inherits the same blind spot. Recorded here because it is the same class of error as the rejects-source instruction scope that clause S6 diagnosed, arriving one layer up.

**Finding 4: the strongest and most consistent concern on MycoPop is absent from its approved material.** Borrowed entertainment property is reached by all five grammar-reject captures and by all three regenerated guardrail sets. No approved guardrail states it. The approved set covers the direction's status and the competitor's material, not third-party property in frame. The same holds on Dialog Health for real personal or health information in frame, reached by four of five grammar-reject captures and absent from the approved guardrails. This is the ADR's scouting-value claim showing up as a measurement rather than as an expectation: two refusals a brand would obviously accept, surfaced repeatedly by synthesis, currently governing nothing.

**Finding 5: this evaluation's own mechanical check cannot detect the failure it was written to catch.** The harness reports G1 as passing because every item carries exactly one concern id in the mapping file, and the mapping file is the author's judgment rather than an independent measurement. The four real failures were found by reading, not by running. Recorded as a limitation of the method, in the same spirit as finding 8 of the step 3 evaluation: a check built on counts will report a clean pass on a mapping that was constructed to produce one.

## Recommendation

**On the store: it stands.** The lifecycle round-trips both fixtures without loss, deletion does not exist, declined and retired entries stay readable, and the origin rule is enforced by the shape rather than by discipline. The two departures from the claims store pattern are recorded in the module header and in contract ambient state 16.

**On the gate result: the two failing clauses were mis-specified, and the fixtures should not be adjusted to satisfy them.** The recommendation is to record both failures as they stand, accept finding 1 into step 2's design, and re-cut G1 per prohibition when step 2 pre-registers its matcher gate. G2's convergence measure should not be carried into step 2 at all in its current form, because over-merge and under-merge against a hand judgment, which is what the ADR already specifies for step 2, measures the matcher without re-measuring sampling instability.

**On finding 2, which outranks the rest.** The scope question about verbal refusals is worth answering before step 3 builds a ruling surface, because the surface's copy depends on whether a person is ruling on visual protections or on all of them. It does not block step 2.

**Step 2 does not start in this session.** The concern matcher is the next piece of work and the eight cases in the boundary register are its test set.

**This document recommends. The gate is the owner's.**
