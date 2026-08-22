# Deferred work register

Things deliberately left undone, with the reason and the condition that should bring them back. This is not a backlog of ideas. Every entry here was a real decision made during a working session, recorded so the reasoning survives and so nobody re-litigates it from scratch or ships it by accident.

Three rules govern this file:

- An entry is added at the moment the decision is made, not later from memory.
- Every entry names what would have to be true for the work to become worth doing.
- An entry that ships is deleted, not marked done. Git history holds the record.

Entries are grouped by what kind of debt they are, since the kinds have different consequences. Prototype-only behavior is the sharpest category: it works for a demo and would be wrong in front of a paying client.

---

## Design pattern requests

This is the only register for missing Meridian UI patterns. Builders use the system in `app/design/` and do not edit that folder.

Each request names the job, the missing state, and where it occurs. Use one of four plain status phrases: requested, being designed, available, or use the existing pattern.

### Region anchor on a feedback note

Status: requested

Job: Higher Roads reviews an artboard version and says which part of it needs to change, so the note reaches production attached to a place rather than as a sentence about the whole picture.

Missing state: The feedback aside in `app/design/samples/review.html` sits inside the artboard frame and reads as a note about the version. There is no way to mark a region on the artboard, no way to show which region a note belongs to, and no way to show several notes on several regions at once.

Where: The Artboard review job, on the review screen built from that sample. The optional anchor is recorded as provisional in section 6 of `docs/meridian-seam-with-jim.md` and whether Jim's side can read one is a discovery question in section 4.

Standing in for it: the review screen offers a list of nine named places on the picture. It is a list of words, not a mark on the artboard, and it cannot show which note belongs to which place while a person reads the work. Marked provisional in a comment in `app/review.js` rather than on screen.

### Showing a real artboard file in the artboard frame

Status: requested

Job: Higher Roads looks at the work that came back and compares one version against another.

Missing state: `m-artboard` and its two halves are built around a placeholder shape, so there is no pattern for putting a real file in the frame at the right size, and no pattern for wiping one version over another. The review screen uses the two halves side by side with the file at a fixed width, which clips on a narrow window.

Where: The Artboard review job, on `app/review.html`.

Use this shape when a real job exposes a gap:

### Pattern name

Status: requested

Job: What the person is trying to complete.

Missing state: What the current system cannot show or support.

Where: The screen or step where the need occurs.

---

## Prototype-only behavior

Things that hold up in a demo and would not survive real use. These are the entries most likely to cause harm if forgotten, because nothing about the interface signals that they are temporary.

### Dismissal state does not persist

Drift notices on the Design Studio chooser can be dismissed, and dismissal is keyed to the version that raised the notice, so a later brain approval or product revision surfaces it again. The dismissal itself lives in memory and resets on reload.

The Snapshot drift rows dismiss the same way, per output rather than per notice, keyed to the version that raised the row.

Fine for a demo. Wrong for production, where a user dismisses something on Monday and expects it to stay dismissed on Tuesday.

Bring it back when: a real client is using the deployed app for daily work. The fix is a field on the client record, so it is server work rather than a UI change.

### Candidate rules do not survive a reload

Feedback broader than "fix this one" queues as a candidate rule in `state.production.candidateRules`. The queue is session-scoped. Carried over from the sprint close and still open.

Bring it back when: candidate rules get a cross-job governance surface, since a queue nobody can review across jobs has no value even when persisted.

### Campaigns are seeded into state and shared across clients

Campaigns compile correctly into a production job and do not persist. Outputs and brains reach Blob storage; campaigns do not.

They are also not client-scoped. The seed list is a constant, so every client sees the same campaigns, which contradicts the namespace boundary ADR 0011 enforces everywhere else. The seed currently holds one Dialog Health campaign, which means a different client would see a healthcare RCS campaign in their own workspace.

Bring it back when: a second client needs its own campaigns, or a campaign needs to outlive the session that created it. Client scoping and persistence are the same piece of work and should land together, since a persisted campaign with no client id would have to be migrated afterward.

---

## Stylesheet debt

### The card adjacency rule

`.card + .card { margin-top: 18px }` is correct when cards stack in a column and wrong inside a grid, where it applies to every card except the first. The result is a row whose first item sits higher and taller than its neighbours, which reads as a display bug.

The current fix cancels the margin inside nineteen named grid containers. That list is the debt: a new grid holding `.card` children inherits the bug until somebody adds it to the list.

The durable fix is to delete the adjacency rule and give every stacking container an explicit `gap`, which is how the rest of the design system already works. That is a stylesheet-wide pass with real regression surface, so it was not folded into a UI session.

Bring it back when: the next deliberate design-system pass, or the second time somebody hits the bug in a new grid.

### Orphaned selectors from cut components

`.guidance-source-summary` and its child rules remain in `styles.css` after the "How this section was shaped" card was cut from Brand guidance. Left in place in case the content returns somewhere.

Bring it back when: the same stylesheet pass as the entry above. Cutting dead CSS piecemeal costs more review attention than it saves.

### Hover treatments are inconsistent across selectable cards

The intake doors on Sources use a colored stroke on the dark surface, which reads as selectable rather than merely hovered. Studio category cards, source material options, and the guidance cells on Snapshot each do something different.

Bring it back when: working through the Design Studio screens, where most of the remaining selectable cards live.

---

## Incomplete paths

Work that functions but stops short of where it should land.

### Brands and sub-brands below the client

The source intake has no way to say which brand or sub-brand a source belongs to. Every source belongs to the client. Dialog Health has a sample brand, and enterprise clients routinely have sub-brands with their own marks and their own guidance.

Adding a picker is the small part. The real work is the entity: what a sub-brand inherits from its parent, whether it gets its own brain or a scoped view of one, what happens when parent and child guidance conflict, and how production resolves which applies to a job. That is a data model decision, not an intake field.

Bring it back when: a client needs to produce for two brands under one account, or when the segment axis work makes scoped resolution a solved problem that a brand axis could reuse.

### Protected asset variations are recorded but not chosen automatically

Logos carry an asset kind and, for logos and lockups, a required variation. The variation makes the production picker readable when a brand has five logo files, and it is the same data an automatic chooser would need.

Nothing chooses automatically. A job cannot ask for the monochrome mark because it knows the background is busy, because placement runs through the model rather than a compositor that can reason about the background.

Bring it back when: deterministic compositing lands. The intake data is already in the contract, so the work is on the production side only.

### Remaking a drifted output has no Design Studio path

Snapshot used to offer "Remake with current guidance" on drift rows. It restored the brief from an output record and navigated to the legacy production brief, because studio setup state is not reconstructible from an output record. That route was removed: the drift rows now offer Open evaluation and Dismiss, and retrying belongs to the evaluation screen where the findings are.

There is still no path from a drifted output back into the Design Studio setup that produced it.

Bring it back when: the Design Studio setup screens are worked through, since the fix is to record enough setup state on the output to rebuild it.

### Outputs made before package persistence cannot be evaluated

The compiled package is now written per job at generation time, which is what makes past work reviewable. Outputs generated before that change have no saved package and show a plain message instead of an evaluation screen.

No backfill is possible. The package was never stored. Recorded so nobody spends time looking for a migration.

### Re-reading one source

"Re-read this one source" is the update path with a single source in it, so it needs no separate mechanism. Built when intake shows the need.

### Refusals that govern language have no durable home

ADR 0017 makes refusals a governed record and specifies the entry's statement in visual terms, terms a camera can see, with consumption as the avoid-clause source for image prompts. Both are right for the image path. The step 1 fixture gate found that seven of 43 hand-authored entries across the two test brands govern language rather than what a lens records: health benefits stated as promises, product specifics stated without records, current practice promoted to approved guidance, a declared direction presented as established identity, customer testimony used as substantiation, dense scientific language, and feature inventories with no consequence attached.

That matters because the instability finding behind ADR 0017 was measured on dossier guardrails, and guardrails carry both halves. They compile into the protection block of image prompts and they carry the brand's claim discipline, which governs copy. Under the ADR as written, six of MycoPop's approved protections stay regenerated from scratch on every rebuild, with exactly the silent churn the ADR was written to end.

Three answers are open and none was taken in step 1: widen the document to hold verbal refusals alongside visual ones, add a second governed record for claim language, or establish that the claims document already covers this ground and state the seam between the two. The third is the cheapest if it turns out to be true.

Bring it back when: before ADR 0017 step 3 builds the ruling surface, because the surface's copy depends on whether a person is ruling over visual protections or over all of a brand's protections. It does not block step 2.

### Refusal sources reach past guardrails and lived-world rejects

The step 1 gate's inclusion rule drew its population from grammar rejects, dossier guardrails, and lived-world rejects, which is where the ADR expects refusals to live. Clause S6 of the step 3 parity evaluation had already recorded a refusal that lives in none of them: MycoPop's floating-product rule rests on a creative guidance principle, start with a recognizable human need rather than a floating product. It governs today and it is absent from the step 1 fixtures because the inclusion rule could not see it.

This is the same class of error as the rejects-source instruction scope that clause S6 diagnosed, arriving one layer up. A refusals document populated the way the ADR describes inherits the blind spot: whatever refusals live in the guidance sections never become proposals, so they are never ruled and never persist.

Bring it back when: ADR 0017 step 2 pre-registers its matcher gate, since the matcher's input set is the same question. Establishing which fields can hold a refusal is a read of the schema and the approved brains rather than new design.

### Brain export and import

There is no way to get a brain out of the system or back into it. Both halves came up during ADR 0016 step 1, when the prototype needed the Mycopop and Dialog Health brains in a working session and the only route was a manual copy of the stored state.

Export is the small half and the near-term one. The GET endpoint already serves the brain payload, so export is a download of what that endpoint returns rather than new synthesis or new shape. It unblocks offline review, fixture authoring, diffing two versions by hand, and handing a client their own brand intelligence.

Import is the later half and it carries a governance decision rather than a file format problem. Imported content should arrive as candidate rather than approved. A brain that arrives approved would let anything bypass the approval gate that every other path into the brain respects, which is the whole separation the system exists to enforce. Decide that before building it, not during.

Bring it back when: export follows the next brain endpoint work. Import waits for a session that can settle the candidate arrival rule and how an imported brain reconciles with an existing one.

### Product picker exists only on sales enablement

Social image, ad image, and website image flows do not expose the product picker. Wiring it follows the established pattern.

Bring it back when: one of those flows needs product-specific claims.

---

## Renderer constraints

### Resizing is not implemented, so catalog sizes are chosen to avoid it

gpt-image-2 accepts arbitrary resolutions when both sides are divisible by 16, the aspect ratio is within 3:1, and the pixel count falls between 655,360 and 8,294,400. Several familiar web sizes fail those rules: 800x600 and 800x800 are below the pixel floor, and 630 is not divisible by 16.

Rather than add an image-resizing dependency, the website catalog uses the nearest natively valid size at the same aspect ratio. Every format renders at exactly the dimensions the interface promises, with no post-processing.

This holds for website images. It will not hold everywhere. Print collateral at 300dpi, retina email images designed at 2x and displayed at 1x, and any format whose exact pixel dimensions are fixed by a third party will eventually need a real resize step.

Bring it back when: a required format cannot be expressed as a natively valid size, or feedback shows the delivered dimensions are causing work downstream. The tool would be sharp, which is a native binary and the first non-JavaScript dependency in the project, so it needs a throwaway deploy to verify before it enters the render path.

### Transparent backgrounds are unavailable on the current model

gpt-image-2 does not support transparent backgrounds, and requests specifying one are rejected.

Presentation elements, product floating shots, and sales collateral elements all assume transparent PNG, and the "better building blocks" position rests on producing elements that layout tools compose. Two unbuilt studio categories depend on this.

Bring it back when: those categories are built. The options are a background-removal step after generation, generating on a solid color and keying it out, or a render path that supports transparency natively. This is a real architectural decision rather than a small fix.

---

## Display copy in renders (ADR 0014 part two)

### Screen-bearing scenes carry a rule collision with no scale constraint

The screen orientation rules in `prompt-craft.js` require that a device screen faces the camera directly and stays fully visible and readable, and that a person be positioned beside or behind it presenting outward rather than holding it in a viewing grip. Renders on 2026-08-11 violated the pose rule and oversized the device.

Two causes, both in the rules rather than in the renderer:

- **No rule caps the device's share of the frame.** "Fully visible and readable" gives the model a reason to enlarge it and nothing to stop at.
- **Legibility and natural posture conflict, with no resolution order.** A person reading their own phone angles it toward themselves; a screen facing the camera requires presenting it outward. Asked for both, the model produces a pose that is neither. The behavior seen in earlier sessions where screen content lifts off the device into a floating overlay is likely the same collision resolving the other way.

The fix is a scale constraint plus a stated resolution order for which requirement wins. Evidence in `evaluations/2026-08-11-display-copy-first-renders.md`.

### Invented screen content is ungoverned

Every screen-bearing render on 2026-08-11 filled its screen with invented text, and the severity rose as scene direction improved. One produced an internally consistent analytics dashboard with fabricated performance figures. Another produced a patient message from an invented, verified-badged surgical center containing post-operative instructions including a specific lifting limit.

The narrowed text safety rule states that apart from authored display copy, no other words are invented. It does not hold, because it was written for background surfaces and a product demonstration scene makes the screen the subject.

Three directions were identified and none chosen: screen content becomes governed copy, declared and audited like a headline; screen-bearing scenes get a hard rule that device screens carry no readable text; or screen content is permitted but flagged in findings as ungoverned text requiring review. There is a hook in `inferScreenBearing` for whichever way it goes.

**Deferred deliberately**, per the owner: the iteration waits for a real client to say what is a dealbreaker rather than being solved speculatively. Recorded with the qualification raised at the time, that a fabricated named healthcare organization issuing fabricated clinical instructions is a different class from audit noise, because the failure is not a threshold needing calibration.

### Display copy character budgets are reasoned, not measured

The characters-per-line figures in `src/copy/display-budget.js` come from typographic practice rather than measurement against rendered output. The first run allowed roughly 114 characters for a headline that set at 27 and broke across three lines, so the budget was not constraining anything.

The budget has since been reframed from a fit ceiling to a legibility floor, which is the correct model, but the numbers behind it are unchanged. Correct them using actual line breaks from real renders rather than arithmetic.

### The server does not refuse unaudited display copy

`prepareProductionPackage` uses `body.draftedCopy` as sent. A draft arriving without an audit gets an errored-audit placeholder attached and the string still compiles into the render prompt. The gate that keeps display copy a produced-and-audited source is the interface, which blocks generation while an edit is unchecked; a direct API caller can render an unaudited string, and the package records the audit state without refusing the string. Found while writing the image pipeline contract (Known ambient states, item 3).

Required before any client-facing beta touches display copy: the server refuses a display block whose audit is absent or errored, in the same invocation that would render it. Until then, interface-as-gate is the accepted state, per the owner's 2026-08-15 disposition.

### Read-back verification for rendered copy does not exist

ADR 0014 part two specifies that the system reads rendered text back out of the image and compares it against the intended string, failing on mismatch. It is not built. The person is currently the verification step: the result screen shows the intended string beside the image and states that nothing checks it, and the compiled record carries `verified: false`, never set true by assertion.

When it is built, the measurement needs two numbers, not one. The exact-match rate by string class sets the retry cost. The rate at which verification passes a string that was actually wrong determines whether stakes matter at all. Mismatches should be scored by kind, malformed characters against substituted words, because the first is a quality problem and the second is a governance problem.

---

## Content and prompt debt

### Review questions written under earlier synthesis instructions

The synthesis instructions gained explicit plain-language rules for review question `summary`, `method`, and `rationale`, including a banned-word list. Questions generated before that change keep their original wording, since they are stored in the brain.

Re-synthesizing rewrites them and bumps the version. Whether that trade is worth making is a per-client judgment, not a default.

### Interface renames must reach the prompts

When the interface renamed exact asset to protected asset, the synthesis instructions kept the old term and the model wrote "exact asset" into copy users read. Fixed, and recorded here as a standing check rather than a task: **a user-facing vocabulary change is not complete until the prompts use the new word.**

### Slots holding model output need to survive long text

The artifact reader clipped its own content because two heading slots were fed model-generated strings. The SLAKE fixture has short values in both fields, so the fault only appeared once a real brand's synthesis filled them properly.

Standing check rather than a task: **any slot that renders model output should be tested against text several times longer than the fixture provides.**

### The studio reference picker offers a narrow slice and cannot upload

Reported broken in the live app on 2026-08-15: the creative inputs picker in the studio would not let the user upload or choose from previously uploaded sources. What the code confirms: the picker offers only sources that already contain a PNG, JPG, or WEBP file stored in Blob. Link sources never appear, document sources never appear, and the picker has no upload of its own. A client whose inspiration went in as links or documents sees an empty list. Whether a further live failure sits on top of the filter is not yet established.

The larger design answer is ADR 0016: declared influences reach every render automatically through the visual grammar, so the picker stops being the only channel where an intake influence touches an image. The owner decided on 2026-08-15 that the picker stays manual and deliberate: a per-job tool for the specific case of wanting the renderer to look at a particular image. Automating it was considered and dropped, because the benefit of image conditioning on top of grammar text is untested, the two frames that reached their target look did it with text alone, and the image channel is the ungoverned one. Revisit only if the evaluation loop shows grammar text falling short of a look, with that measurement in hand. Fixing the picker's filter and empty state remains worthwhile at low priority, since the deliberate channel survives.

---

## Known deficiencies with owners elsewhere

Recorded for completeness. These are not this workstream's to fix.

- **`resolveClientId` is a security placeholder.** Every API route resolves the client from a cookie with no session validation. ADR 0011 names the shared-password gate as a known deficiency with a planned replacement. Jim's authentication slice.
- **Deterministic composition is specified and not implemented.** The glossary states that a locked asset should never be regenerated when it can be composed deterministically. The live path sends protected assets through the OpenAI edits endpoint, which is model-based placement. This one matters commercially, because "your logo is placed, never redrawn" is the natural thing to say and the implementation does not currently guarantee it.
- **The 12-function Vercel Hobby ceiling.** Held so far by dispatching new operations through existing handlers. A new serverless function requires freeing a slot or moving to Pro.

## Two format tables disagree for Website feature

Found 2026-08-18 during ADR 0018 phase 0 baseline capture, by the owner noticing a render came back at a shape the frozen scene did not name.

`app/app.js` carries two format catalogs. `placementFormats` (line 59) lists Website feature as 16:9 landscape or 4:3 landscape. `websiteOutputFormats.feature` (line 83) gives 1200 x 800 at 3:2. The website studio flow reads the second and submits the pixel dimensions; the older brief flow reads the first. Every other website placement the two tables share agrees on ratio, so this is the only genuine contradiction.

Not fixed now because the correct resolution is a product question rather than a typo: whether Website feature is a 3:2 shape with the first table wrong, or a 16:9 shape with the studio catalog wrong, depends on what the placement is for. The output type catalog is the authority and should settle it. Revisit when the format catalogs are next touched, or sooner if a client receives a shape they did not choose.

## Studio and product photography looks need world building suppressed

Removed 2026-08-18 after the studio seamless look failed twice. It asks for a photographic studio against seamless paper with no room, window, furniture, or location in frame, and returned a co-working space with a window, a plant, a poster wall, and a second person. Moving the look into the system rules ahead of the earned environments rule did not fix it.

The diagnosis is structural rather than a wording problem. The whole compiled prompt is built to place a product in a lived setting: the assignment calls for a brand world image, the protection block speaks about environmental objects, and the scene writer is briefed with earned environments, a lived world person, and guardrails that all describe places. A studio portrait on seamless paper is the absence of a world, so one paragraph asking for seamless paper argues with roughly two thousand words asking for a place, and loses.

Studio and packshot looks are a real need for fashion, ecommerce, and product photography, and they would require the compile path to know that some looks suppress world building rather than style it: no earned environments in the scene brief, a different assignment line, and a protection block written for a studio rather than a location. That is its own unit of work and probably its own decision record. Revisit when a client needs product photography rather than brand world imagery.

The clean and professional need that studio seamless was partly serving is met instead by the `clean_digital` look, which supplies optical consequence without a studio and without a color personality.

## Retire AESTHETIC_MODES

ADR 0018 Decision 2 rules that the look library absorbs and retires the aesthetic modes system: the mode opener's role passes to the selected look's compiled paragraph, `AESTHETIC_MODES` and `selectAestheticMode` are removed, and the package's `aestheticMode` field is replaced by the look id and version. Not done. The modes still supply the assignment opening line, though their finish claims were stripped on 2026-08-18 so they now state register only.

Two findings recorded against the current implementation. Selection reads creative direction text only and cannot see the scene, which put a cinematic opener on an observed outdoor scene. And across both real clients all four fixture scenes selected the same mode, because neither brand's creative text contains the keywords that reach the other three, so the other modes are effectively unreachable.

## The brand slate layer does not exist

ADR 0018 Decision 2 describes three layers: library in code, a governed per brand slate of two to four looks, and per asset selection drawing from the slate. Layers one and three exist. The slate does not, so the picker currently exposes the whole library to every client. The slate is the mechanism that keeps per asset choice from averaging back toward consensus, since it means every available option is one the brand deliberately approved. Revisit before a client uses the picker in anger.

## Products do several jobs badly

Flagged by the owner 2026-08-18. A product record is simultaneously a synthesis artifact built from a scraped page or uploaded brief, a governance object carrying claims and exclusions, and an asset container for reference imagery. Those have different lifecycles and different owners and they share one screen.

Concrete symptoms observed. The imagery card is collapsed by default when a record has no images, so a required input hides itself, and three MycoPop records reached production with empty image arrays and nobody noticed until renders were traced. Only the first isolated image is ever used by `service.js`, while the bucket accepts many. The product detail route is a long way from the studio, where the absence is actually felt. Isolated and in context are set by which bucket a file is dropped into, which works but is undiscoverable.

Worth a proper look rather than patching the upload affordance.

## A replacement for the phase 1 word count gate

The pre-registered phase 1 gate required compiled prompts between 500 and 900 words. It is recorded as failed and as wrong in `docs/evaluations/2026-08-17-adr-0018-phase0-baseline.md`: prompts run near 2,200 and the added words are the only changes that improved renders.

A replacement should measure whether every compiled statement is a physical fact that can change pixels, and whether any two statements make competing claims about the same property. Both are mechanically checkable against a captured package, and both would have caught the overlay bug and the golden coating bug without a render.

## Three model names in the copied code

Recorded 2026-08-21 at the Meridian fork, from the tree at BWS `b11e994`. The code reads three different OpenAI models. Brain synthesis (`src/brand-brain/chat-completions-provider.js`) and products (`src/products/service.js`) default to `gpt-5.6` when `OPENAI_MODEL` is unset. Copy generation (`src/copy/generate.js`, `src/claims/copy-audit.js`, `api/production/generate-copy.js`) is hard-coded to `gpt-4o`. Image rendering (`src/renderers/openai-images.js`, `src/production/composite.js`) is hard-coded to `gpt-image-2`. One environment value does not govern all three. `OPENAI_MODEL` is left unset on the Meridian deployment so the brain uses `gpt-5.6`. Decide in step 2 which of these paths survive before consolidating the setting.

## The Scene record has one actor until people can log in

Every fact on the Scene record carries Higher Roads as the actor. The app has one shared password and one login, so there is no identity to write down, and a fact naming a person the system cannot stand behind would be worse than one that names the company. The record's shape already holds an actor per fact, so nothing has to be rebuilt.

Recorded 2026-08-22 when the Scene record landed. Bring it back when: roadmap step 4 replaces the shared password with real logins for the two user types. At that point the actor comes from the person doing the work, and the facts already written keep saying Higher Roads, because a record that is rewritten to look better answers a different question than the one a tour team needs answered.

## The mechanical check between artboard assumptions and the playback line

The stand-in returns technical assumptions and the review surface shows them as written. Nothing compares them to the tour's playback line.

Recorded 2026-08-22. The comparison was drafted and cut before it was built. The playback line is one prose field, the stand-in is ours, so its assumptions are ours to invent, and a check comparing our invention to our prose would only prove that the check fires on data we wrote. It would be an instrument built before the thing it measures exists.

Bring it back when: Jim's side returns real technical assumptions and we know their shape, or a tour surfaces a technical disagreement that a person caught and the system did not.

## Findings do not name the claims behind them

Recorded 2026-08-22 while importing the first artist. The intake files carry a full evidence chain in two of its three links and not the third. Every claim in `02-claims.md` names its source and its locator. Every finding in `03-findings.md` names how many independent sources sit behind it and which tiers they came from. No finding names which claims those are.

So `get-evidence` returns the source count and the tiers and reports the chain as unlinked. It cannot open a finding down to the claims and the URLs, which is the thing the thesis means when it says anything the brain asserts carries its evidence. The gap is in the files, not in the code: a matcher that guessed which claims sit behind which finding would produce a confident wrong answer, which is worse than an honest empty one.

The fix belongs to stage 4 of `docs/intake-playbook.md`, which should require a claim id list on every finding. The first run's own log already says findings should be regenerated in one pass rather than patched, so this is a re-run of that stage on the existing claims rather than new research.

Bring it back when: the playbook is corrected and `03-findings.md` is regenerated with claim ids. The import parser reads `claimIds` and sets `evidenceLinked` already, so nothing in the app changes when the file does.

## A claim's source is prose, not a source id

Recorded 2026-08-22, same import. `02-claims.md` names a claim's source as text, for example `plsn.com Jands Vista article 2013`. `01-sources.md` numbers its rows. Nothing joins the two.

The parser resolves a claim to a source id only when exactly one source row carries that host, which covers 47 of 261 claims. The other 214 keep the prose and carry no id. Two reasons for the miss. Outlets with several rows, PLSN and Chauvet among them, are ambiguous by host alone. And 17 hosts named in claims are not in the source list at all, because batches 2 through 8 read articles the original list never held: `wwd.com`, `mr-mag.com`, `bluegrasstoday.com`, `cmt.com`, `songfacts.com`, `tribedesign.net` and others. The first run's own handoff already asks for two URL corrections and four additions to that file.

Bring it back when: the claims file carries a source number rather than a source name, and the source list holds every source a claim cites. Both are cheap and both belong in the playbook rather than in the parser.

## Venue and screen intelligence

Recorded 2026-08-22 when the brief's technical target was scoped. Grey ruled that in V1 the technical fact a brief needs is the tour's playback system, because most tours carry their own hardware and configure it per venue, and Jim has the technical side dialled on his render side. So `technicalTarget` carries the playback system from the tour and a `venueProfile` that is always null.

What is deferred is the ambition behind the thesis line about technical intelligence: knowing enough about a venue to make rigging recommendations or raise warnings before anyone builds. That needs venue and screen data we do not hold and a source for it we have not found. The intake's own thin list already names the gap on the artist side: trade coverage of his shows is strong from 2016 forward and thin before it, and no source in tiers 1 to 6 gives screen inventories per venue.

Bring it back when: a tour is running in Meridian and someone asks a question the playback line cannot answer, or Jim says a venue detail belongs on our side of the seam rather than his. Either way it is a change to the seam document first, agreed with him, and not a field we add on our own.

## The brief's field order is Reasoned, not agreed

Recorded 2026-08-22. The compiled brief leads with required elements and the technical target and trails with latitude, the direction, and meaning. That order comes from a BWS render finding that concrete facts placed early beat abstract description placed anywhere. It was a renderer finding and Jim's workflow is a different reader, so it is Reasoned here rather than Verified.

The compiled brief is the cheapest way to test it. Hand Jim a real one and let him say what sits in the wrong place. The sidecar labels itself provisional in its own `contractStatus` field for the same reason: its shape is our guess and it is not an obligation on his system until the seam document says both sides agreed to it.

Bring it back when: Jim has read a real brief and said what he would move.

## One avoid entry is a record about the intake, not about the artist

Recorded 2026-08-22 when the brief started carrying the brand's prohibitions whether or not anyone asked the brain for suggestions. Ten of the eleven entries in the avoid part of the first brain are facts about the artist and travel cleanly. One, `finding-78`, records that the prior's guesses were not testable and were dropped. It is Higher Roads writing to Higher Roads and it names our own vocabulary, so it cannot go to Jim.

The compile drops any avoid entry that still carries our vocabulary after the bookkeeping tail is stripped, and a test asserts the effect: nothing in a compiled brief says bin, facet, governance, candidate, proposed, or a finding id. The drop is mechanical rather than a judgment about content, so it cannot quietly remove a real prohibition on the grounds that someone disagreed with it.

The gap is in the file. An entry that records what was removed from the prior belongs in the intake log rather than in the artist's prohibitions, and a second entry, `finding-70`, buries its own operator commentary after the source count where a reader would take it for a fact about the artist.

Bring it back when: the findings file is regenerated and the intake playbook says an entry in the avoid part states something the artist avoids and nothing else. The filter can come out in the same commit that lands the corrected file.
