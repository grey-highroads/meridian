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

Each request names the job, the missing state, and where it occurs. Use one of five plain status phrases: requested, being designed, available, use the existing pattern, or closed. A closed entry names the commit that closed it and stays here as the record of what the pattern was asked to do.

### Artboard version gallery

Status: requested

Job: a person scans every Artboard version that exists for each Scene without turning Reviews into another attention queue.

Missing state: There is no gallery pattern for rows of arbitrary-ratio images with a per-person unopened stroke. `app/reviews.js` uses `m-reference-grid`, ordinary buttons, `m-client-review__frame`, and `m-button--instrument` as the nearest available pieces.

Where: `app/reviews.html`, for the Reviews gallery. A real thumbnail pipeline becomes necessary when one Scene exceeds 12 versions or the original files entering the viewport exceed 40 MB in total.

### A tighter reading block for short entries

Status: requested

Job: a direction read stacks short observations, a title and two or three sentences each, under three group headings. The reader is scanning a set of related observations rather than reading one idea at a time.

Missing state: `m-intelligence-principle` is the only rule-separated reading block that exists and it was tuned for an idea, which carries a title, a paragraph, three qualifying notes, an evidence disclosure, and two actions. Its `var(--m-space-8)` vertical padding and `var(--m-space-5)` internal gap leave a short entry floating in a block sized for a long one, and a read of eight entries runs about a third longer than it needs to. `app/intelligence/direction-view.js` uses the pattern as it stands rather than inventing local spacing.

Where: `entryBlock` in `app/intelligence/direction-view.js`. It becomes worth doing when a second surface stacks short evidence-carrying entries, which job three, the artboard review, is likely to be.

### Full-viewport work viewer

Status: requested

Job: a person reads dense Artboard text at the size it needs, switches between fitted and actual-size views, and pans an arbitrary-ratio board without leaving the gallery.

Missing state: There is no full-viewport viewer or fit and actual-size control. `app/reviews.js` uses the dialog, client shell, workstation stage, and segmented control as the nearest pieces, then supplies viewport sizing and image fitting in the page. It deliberately does not use `m-work-frame`, whose widescreen ratio is wrong for square and portrait work.

Where: the full-screen Artboard view opened from `app/reviews.html`.

### Drawer over the work

Status: closed by `33b1054`

Job: a person opens a set of facts and actions over the work and closes it again, without the work moving, narrowing, or losing its place.

Closed state: `m-drawer` is a fixed right-edge rail that widens leftward over the full page. It never reserves page width. `m-drawer__action` keeps a field, action, and result together; `m-drawer__context` keeps supporting facts collapsed under the action they inform. Compact drawer type and control spacing come from shared tokens. Clients receive neither the operator content nor its trigger.

Where: the full-screen Artboard view opened from `app/reviews.html`, and the Higher Roads drawer on `app/scene.html`. Tour details carries the inline half of the same grammar and no drawer, because it holds no operator-only work. Grey accepted all three surfaces on the live app on 2026-08-28. The rule that governs when a page gets a drawer is recorded in `docs/meridian-product-architecture.md` under the page and the drawer ruling, and the rules for building one are in `docs/design-system.md`.

### The account switcher under the wordmark

Status: use the existing pattern

Job: a Higher Roads admin sees which client account they are working in, switches to another, and starts a new one, from the top of the rail rather than from the bottom of it.

Missing state: There is no pattern for an account switcher. The shell builds it from the rail's own classes, `m-shell__nav`, `m-shell__nav-link`, `m-shell__nav-label`, and `m-shell__nav-count`, inside a plain `details` element, so the labels collapse with the rail at narrow widths without a rule of its own. What the reference design has and this does not: the account tile with its initial, the account's description under its name, and a drawn open state on the list. The account being worked in is marked with `aria-current` and a check glyph.

Where: Every page that loads `app/shell.js`, under the wordmark, built in `mountAccountPicker`.

### A persistent group in the bar at the top of the page

Status: use the existing pattern

Job: a Higher Roads admin reaches Admin and Artist Brain from wherever they are, rather than from the one page that happens to carry the link.

Missing state: There is no pattern for a group of destinations living in `m-location`, and no treatment for marking one of them as the page currently open. The shell builds the group from `m-cluster` and `m-button m-button--small`, which is the nearest thing the system supports, and marks the open one with `aria-current` alone, so the state is announced and not drawn. `m-shell__nav-link` was not used because it is styled for the rail.

Where: Every page that loads `app/shell.js`, top right, built in `mountOperatorDestinations`.

### Showing a real artboard file in the artboard frame

Status: available

Job: Higher Roads looks at the work that came back and compares one version against another.

Missing state: `m-work-frame` displays a submitted image or PDF as the primary work surface. `m-reference-pair` places an earlier version beside the current one only when a person asks to compare. Meridian uses this deliberate comparison instead of a wipe control in V1.

Where: The Artboard review job, in the full view opened from `app/reviews.html`. Corrected 2026-08-27 with the commit that removed `app/review.html`.

### Result log for a maintenance action

Status: requested

Job: A Higher Roads person runs a maintenance act and reads back what it did, file by file, to be sure it did what it said.

Missing state: There is no pattern for a plain result log. The Admin page prints each returned line as a `m-copy` item inside a `m-stack`, which reads as prose rather than as a record. Long storage paths wrap mid-path and two lines are hard to compare against each other.

Where: `app/admin.html`, under the copy action. It will recur on every act the accounts spec adds to that page.

### The rail's utility group sits below the fold

Status: requested

Job: A Higher Roads person reaches Artist Brain, Admin, or Sign out from any page without hunting for them.

Missing state: `m-shell__rail` is a grid item at `min-height: 100vh` with `position: sticky`, so it stretches to the height of the page beside it and never sticks. `m-shell__utility` is pushed to the bottom of that stretched rail by `margin-top: auto`, which puts the whole group below the fold on a normal laptop window. The three links are invisible until a person scrolls to the end of the page, on every page in the app. There is no pattern for a rail whose utility group stays in view while the main column scrolls.

Where: `app/design/patterns.css` lines 214 to 281, reaching every page that uses `m-shell`.

### A maintenance surface has no home in the rail

Status: requested

Job: A Higher Roads person opens the maintenance surface, works in it, and leaves.

Missing state: Admin sits in the utility group beside Sign out, which is where a session ends rather than where work happens. It is there because the utility group was the only place a fifth link fit. There is no pattern for a working surface that belongs to Higher Roads rather than to the tour, and the accounts spec adds four more acts to that surface.

Where: `app/admin.html`, and the rail markup every page repeats.

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

- **One `resolveClientId` call still has no session user.** The other ten call sites now pass the authenticated user. `api/blob/upload.js` line 45 still calls `resolveClientId(request)` with no user because that route is gated by the shared installation password rather than a session, so there is no user to consult. The resulting id becomes a Blob path segment at line 48. Closing this last call requires deciding how an installation-password route selects an account without weakening its path boundary.
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

## The session key comes from the two sign in values

Recorded 2026-08-23 when the shared password was replaced. The session cookie is signed with a key derived from `MERIDIAN_OPERATOR` and `MERIDIAN_CLIENT`, which is what the deployment already holds. Nothing extra to set, nothing extra to keep in step, and changing a password ends every session signed under the old one.

What it costs: a session cannot be ended without changing a password, and the key is only as good as the two passwords behind it.

Bring it back when: a client organization signs in rather than the one reviewer in the pilot, or someone needs to sign every session out without changing a password. At that point the key is its own value on the deployment and this file is one line different.

## People are changed by changing the deployment

Recorded 2026-08-23. Two people exist, seeded once from two environment values. There is no signup, no invite, no password change, no third person, and no screen that adds one. Higher Roads operates Meridian for the client and the pilot has one reviewer.

Changing a seed value after the first sign in changes the environment and not the stored person, because the users are written once and read after that. Replacing a person today means writing the users document.

Bring it back when: a second reviewer needs access, or a person has to change their own password. The account and user shape already holds both, so this is a screen and a write rather than a rebuild.

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

## The tour fixture's date list and its request disagreed

Recorded 2026-08-24 while the production setup landed. The storm and lightning request names four arena dates with no sky at all, and repeats it as a required element. The tour's date list held six dates and every one of them was an amphitheater, a pavilion, or a shed. The two halves of the same fixture asserted different routing, and nothing in the app could have caught it, because a required element is the tour manager's prose and the date rows are a separate list.

Fixed in the same commit as the production setup: the four arena dates are in the routing, and the four venue exceptions sit on them. A first pass wrote the exceptions onto four of the outdoor dates instead, on the mistaken proof that no indoor date existed anywhere in the fixture. The request had named them all along.

The standing check this leaves: a claim in an assignment's prose about the tour's routing is only as good as the tour file agreeing with it. Nothing joins the two today.

Bring it back when: the real routing arrives and replaces the sample dates. The exceptions are rewritten against it at the same time and the setup version goes to 2. A check that every venue an exception names is a venue the tour plays is one line in the fixture validator, worth adding when a second tour exists.

## Venue and screen intelligence

Recorded 2026-08-22 when the brief's technical target was scoped. Grey ruled that in V1 the technical fact a brief needs is the tour's playback system, because most tours carry their own hardware and configure it per venue, and Jim has the technical side dialled on his render side. So `technicalTarget` carried the playback system from the tour and a `venueProfile` that is always null. Corrected 2026-08-24: the target now also carries the tour's production setup, its version, and the dates a person marked as differing from it, all supplied by the tour's production designer and stored as given. What is still deferred is venue and screen data we do not hold.

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

## Three Scene stages the current loop cannot show

Recorded 2026-08-25 when Scene lifecycle state landed in `src/tour/lifecycle.js`. The module derives all eight stages from durable stored objects and the append-only Scene record. Three of them are unreachable through the app as it stands, and the tests say so rather than pretending otherwise.

Approved for production is a real derived state that the current stand-in never exposes. Sending a brief stores the first artboard inside the same action, so the Scene passes from concept review to production review between one request and the next. It is unit-tested from a stored snapshot of a sent brief with no artboard back, and the loop test asserts the stage the stand-in actually produces.

Concept review rests on a frozen brief that has not gone out, because no record of a client approving a concept exists yet. Nothing on that stage says a client approved anything. When a concept-approval record lands, the mapping moves to it and the comment in the lifecycle module comes out with it.

Delivered rests on a delivery record, and nothing writes one. Production intent is frozen at client approval and the loop ends there.

Bring them back when: Jim's real system replaces the stand-in and a brief goes out before an artboard returns, which makes approved for production observable on its own; a concept-approval record exists; and a delivery is recorded against an approved version.

## The fact shape is written twice

Recorded 2026-08-25 at brief 1 of the accounts spec. The Scene record and the new tour-level record write the same fact shape in two modules. Extracting it was skipped on purpose: a refactor of tested code does not belong inside a storage change. Extract when a third writer appears or when either shape needs to change.

Updated 2026-08-25 at brief 3 of the accounts spec. The third writer has appeared: `appendArtistFact` in `src/org/artists.js` writes the same shape a third time, with an `artistId` field the other two do not carry. The named trigger has fired. Extraction was still not done inside brief 3, because the brief covers artist rows and the builder does not widen a brief on its own. This is now a ruling waiting on the architect, not a condition waiting on an event.

## The artist route is the admin handler now

Recorded 2026-08-26 when `create-account` and `list-accounts` landed on `api/artist/index.js`. That file carries the account acts, the artist acts, the file copy, and the tour seed. Its name says artist and its job is admin. It was not renamed in that commit because the hosting tier caps functions and every page and test names the route, so a rename is its own change with its own verification.

Bring it back when: another act lands there that has nothing to do with an artist, or the route list is reworked for another reason. Rename the route and the imports in one commit, with the page fetch paths in the same commit.

## A client may create a tour inside its own account

Recorded 2026-08-26. The instruction for the account acts said a client session should be refused on creating an account, an artist, and a tour. Two hold. `create-tour` is in `CLIENT_ACTIONS` in `api/tour/index.js` under the earlier ruling that client and Higher Roads users share the tour and Scene workflow, and `test/account-scope.test.js` asserts a client creating a tour and the fact naming the account. Closing it would reverse that ruling, so nothing was changed and the test asserts what is true: a client's tour lands in its own account and never in the account it names.

Bring it back when: Grey rules that tour creation is a Higher Roads act. `create-tour` comes out of `CLIENT_ACTIONS` and the account-scope test moves to a Higher Roads session in the same commit.

## The client review boundary lived in page markup

Recorded 2026-08-27 when the review boundary moved into the server. Before this commit, the client page displayed only presented work, a rationale, comments, and approvals, but the tour route still returned every Artboard and its storage key, Higher Roads reviews and revision instructions, the full frozen brief, and the production intent to the same client session. The private upload read checked the Scene prefix but did not check whether Higher Roads had presented the version. The page was narrow because it chose not to show the internal payload, not because the server refused it.

Fixed in the same commit as this entry. Client reads now project only presented version identities, presented files, that person's comments and approvals, and the one-sentence rationale for a presented version. The upload read checks both the Scene prefix and presentation. Higher Roads reads are unchanged.

Bring it back when: a new client-facing read is added. Its server response is reviewed as the boundary, even when the page that calls it displays less.

## An external designer is not a client-role person

Recorded 2026-08-27. Grey ruled that Jim is a Higher Roads user and the production handoff is a Higher Roads surface. A person carrying the client role cannot be an external designer, because that role receives the client review projection and never the frozen production brief, revision instructions, or production notes. There is no third role in Meridian today.

Bring it back when: a client invites an external designer who is not working as Higher Roads. That person needs a separate user type and an explicit production-handoff boundary rather than broader access on the client role.

## The no-tour state is one shared block on three pages

Recorded 2026-08-26 when the demo tour fallback came out of `app/context.js`. Updated 2026-08-26 when tour creation moved to Home. The named condition fired: a tour is now started from Home, so Home has a shape of its own and the shared block from `app/no-tour.js` covers Scenes, Reviews, and Tour details. Those three still say nothing about themselves and now point at Home rather than at Admin.

Bring it back when: Grey reviews the empty state on the live app and says what each of the three should say in that condition.

## Facts and approvals name people by display name, not by id

Recorded 2026-08-26 with brief 4 of the admin surface. Updated 2026-08-27 when the client review boundary began returning the whole tour team's client feedback. `src/org/artists.js`, `src/tour/scene-record.js`, `api/tour/index.js`, and `api/tour-upload.js` all write `actor` as the person's display name. Nothing on a fact points back at the person record. The approvals document also records `approvedBy` and `writtenBy` as display names without person ids.

Three effects. Editing somebody's name leaves earlier facts and approvals reading the name they had then, which is right for a record of who decided what and wrong for anyone trying to gather one person's acts. Two people with the same display name cannot be distinguished in the approvals document. And the delete guard cannot ask whether a person ever acted, which is why brief 4 reads never done anything as never signed in.

Bring it back when: something needs one person's acts or review decisions gathered, such as a page showing what somebody decided, or a delete guard that reads the ruling as written. The change is stable person ids written beside `actor`, `approvedBy`, and `writtenBy`, with the display names kept as they are so old records still read.

## Nobody can be invited into an account with no artist

Recorded 2026-08-26 with brief 4 of the admin surface. Nothing stops it. An account is created with its first artist, so the case takes deliberate work to reach, and a client with nothing to look at is a state Admin shows plainly in its lists.

Bring it back when: an invite is sent before the artist exists in real use and the person lands on an empty app.

## A deleted account left its name on the page

Recorded 2026-08-26, found by Grey on the live app after deleting a test account. The account list showed one account and the three sections under it were still headed with the deleted one's name, because the address still named it and nothing checked the name against the list. `resolveActingAccount` sanitizes whatever was selected and hands it back, so a Higher Roads session could go on acting inside an account with no row and write documents under it.

Fixed in the same commit as this entry. The admin route reads the account list and refuses an id that is not on it, which makes a deleted account and an account that never existed read the same way. Admin drops the name from the address when a read comes back refused, and drops it outright when the account being worked in is the one deleted. Seven tests in `test/artist-rows.test.js` were acting inside an account with no row and now create it first, which is what the app requires.

What is not covered: `api/tour/index.js` resolves the same way and has no such check. A dead account there reads as an account holding no tours rather than as absence, which is the same answer an empty account gives.

Bring it back when: a tour action needs to tell an empty account from one that is gone. The check is the same three lines and belongs beside the acting account resolution rather than in each route.

## Admin acts on tour rows and account rows, not on artist rows

Recorded 2026-08-26 with brief 2 of the admin surface and updated 2026-08-26 with brief 3. A tour row can be made the one the account opens and can be deleted. An account row can be opened and deleted. Artist rows and people rows still do nothing.

Bring it back when: brief 4 lands people. Artist rows have no act left to build; the reason is the entry below.

## Creating an empty brain is already what creating an artist does

Recorded 2026-08-26 at brief 3 of the admin surface. The ruling names an act that creates the empty artist brain and attaches it to an artist, so an intake run has somewhere to land. Reading the committed tree says the condition is already met and the act would write a document nothing reads.

`readRecord` in `src/artist/store.js` returns `EMPTY_RECORD` for an artist with nothing stored, so an artist created today already reads as an empty brain. `importIntake` in `api/artist/index.js` refuses an artist id with no row in the account and writes the record at that artist's path when the row is there. Creating the artist row is what gives intake somewhere to land, and the account's create-artist act already does it.

Bring it back when: a brain needs something written at creation time that an empty read cannot stand in for, such as its own approval state before any import. Nothing needs that today.

## The two migration acts are gone from the page and the route

Recorded 2026-08-26 with brief 2 of the admin surface. Copying the artist's files to the uniform account path and storing the demo tour at the shared path both ran and were verified. `pathFor` in `src/artist/store.js` has one shape and no demo branch, and the tour store has no fixture fallback, so neither act had anything left to do. Both came off `app/admin.js` and out of `api/artist/index.js`, and their two tests came out with them. `src/artist/copy-to-account-path.js` and `scripts/copy-artist-to-account-path.js` stay, and `seedTourFromFixture` stays because the tests use it to get a tour to work against.

Bring it back when: nothing brings this back. It is recorded so a reader of the route's action list knows where the two acts went.

## An admin with no account selected lands in the first one

Recorded 2026-08-26 with brief 1 of the admin surface. A Higher Roads admin belongs to no account, so a request that names none has nothing on the record to act inside. `readSessionUser` in `src/server/http.js` reads the account list and opens the first entry. The demo account is first because it is seeded first, so nothing about the live app changed when the account came off the admin's record.

An account list with several entries would open one of them for no stated reason, the same shape as the tour entry below.

Bring it back when: the account lists land on the admin page. The account an admin was last working in becomes something Meridian remembers, and the picker is the only thing that decides it.

## An admin row sits unread in the demo account's people

Recorded 2026-08-26 with brief 1 of the admin surface. The live deployment's `clients/dierks-bentley/org/users.json` was written when both people lived inside the account. `readUsers` filters admin rows out rather than rewriting the document, because a scoping change is no place to edit stored people. The row gives nobody account scope and a test asserts that effect.

Bring it back when: the people work lands. The document is rewritten to hold the account's own people and the filter comes out in the same commit.

## The active tour is the first one the account holds

Recorded 2026-08-26 with the `list-tours` action. With no tour named in the address, the shell opens the account's tours sorted by id and takes the first. Every account holds one tour today, so the choice never shows. An account with two would open one of them for no stated reason.

Bring it back when: an account holds more than one tour. The tour becomes something a person selects and Meridian remembers, rather than something resolved by sort order.

## Resolved documentation rulings

### Moment 6 feedback location

Recorded 2026-08-26 and resolved 2026-08-27. The walkthrough prescribed feedback anchored by pointing while the shipped review used a nine-name region dropdown. Grey ruled that Meridian has no feedback location field and nothing replaces it. New revision instructions carry the words against the named Artboard version. Historical revisions that already carry a location remain readable.

## Dates where the rig differs have no surface

Recorded 2026-08-26 with the production setup editor on `app/tour.html`. The editor writes the setup's words and who supplied them. Venue exceptions are carried forward from the version before, so a save never drops them, and nothing in the app can add or change one. The seeded tour's four exceptions came from the fixture.

Bring it back when: someone needs to record a date where the rig differs without editing a fixture. It is a row editor against the same versioned document, and it lands beside the setup editor.

## A tour date is whatever was typed

Recorded 2026-08-26 with the dates editor on `app/tour.html`. Each row is three free text fields, and a row keeps whatever it has, so a date with no venue is a date. `readableDate` in `app/tour.js` formats a row that reads as a plain year, month, and day and shows anything else as it came, which is the rule the fixture reader already followed. Nothing validates the date, orders the route, or notices two rows naming the same night.

Bring it back when: a Scene brief needs to name a specific date, or a tour manager reports a route that reads wrong on the tour page.

## The group is put back rather than the pages keeping it

Recorded 2026-08-26 with the persistent Admin and Artist Brain destinations. Every page writes `#location` whole on render, so the shell watches that element and puts the group back when a render drops it. Teaching each page to preserve it would touch eleven files and every future page would have to remember.

Bring it back when: the bar at the top becomes a shell-owned region a page fills through a named slot rather than by writing the whole element. The observer comes out in the same commit.

## The artist brain has no surface that offers ideas against a Scene

Recorded 2026-08-27 with the Scene page rebuild. The Artist Brain panel came out of the Scene page with the rest of the inspector, and it was the only caller of `propose-concepts` in the app. The action still works on the server and nothing in the interface reaches it. A concept saved today carries a title, the optional note, and where it came from, and nothing else; the brief fields that a brain suggestion used to fill read empty.

Bring it back when: a person deciding what to build asks for what the artist's history offers, from wherever that surface ends up living.

Closed 2026-08-28. Intelligence is that surface. An admin picks a submitted Scene, asks for ideas, and `propose-concepts` is reached again. Every run is stored and a second ask adds a run rather than replacing the first. The three fields a saved concept stopped carrying are still empty, because choosing an idea from this page and shaping it into a concept is a later commit.

## Venue and screen specifications are unstructured

Recorded 2026-08-27 with the Scene page rebuild. A tour date row carries a date, a venue name, and a place, all free text. Screen count, stage geometry, and rig detail live inside the production setup as one block of prose stored as the production designer supplied it. The Scene page shows what exists and says plainly that this is prose rather than fields, because inventing structure that is not there would be worse than the gap.

Bring it back when: a Higher Roads person deciding a concept will not fit a room needs the screen count and stage geometry as fields rather than prose.

## Reference facts carried no name or location until 2026-08-27

Recorded 2026-08-27 as a fix rather than a deferral, kept here because the gap outlived two commits. `appendFact` in `src/tour/scene-record.js` built a fixed entry and dropped `pathname`, `filename`, and `contentType`, while `reference-record` in `api/tour-upload.js` sent all three and `reference-list` read all three back. Every reference ever recorded was stored without a name or a location, so the list returned rows of undefined. Together with the undeclared identifier fixed in `670393e6`, reference images have never worked end to end. Both legs are now covered by tests that assert stored contents.

No condition to bring back. This entry is a record of how long a two-sided gap can sit between a writer and a reader that no test crossed.

## A frozen brief is re-rendered on every read, so its field names are permanent

Recorded 2026-08-27 after the review page threw on load. `670393e6` renamed `tourDirection.selectedParagraphs` to `tourDirection.paragraphs` in `compileBrief` and in `renderBriefDocument`. A frozen brief is stored exactly as it was compiled and is never rewritten, and `get-brief` re-renders that stored object every time somebody reads it. So every brief frozen before that commit threw `Cannot read properties of undefined` on the first read, the internal review page showed the error and the words "The governing brief could not be found", and no artboard could be decided on. Fixed by `briefDirectionParagraphs` in `src/tour/brief.js`, which takes either shape and rewrites nothing.

Bring it back when: nothing to bring back. The rule it establishes is that any field name inside a frozen brief is permanent once one has been frozen. A rename needs a reader that takes both shapes, in the same commit, with a test that stores the old shape and reads it back.

## The artist's intelligence has no durable version identifier

Recorded 2026-08-28 with Intelligence job one. Every analysis has to name which brain answered it, so a person reading an old run knows what the system knew that day. The brain has no version number. What exists is the date it was approved, in `decisions.json` under `brain.approvedAt`, written by `approveBrain` in `src/artist/store.js`. So `brainApprovedAt` in the analysis record is standing in for a version. Two approvals on the same day are indistinguishable, and re-approving after an import changes the reference without saying what changed.

Bring it back when: intake or approval mints a durable identifier for the brain. The analysis record carries that identifier in place of the approval date, in the same commit, and `brainApprovedAt` comes out.

## A finding names how many sources it has, not which ones

Recorded 2026-08-28 with the concept packet. The packet is meant to carry every source behind an idea. What a finding holds is an independent source count and a list of tiers, because `claimIds` is empty and `evidenceLinked` is false on every finding this intake produced. So the packet prints the count and the tiers and says nothing it cannot support. This is the same gap as "Findings do not name the claims behind them" and "A claim's source is prose, not a source id", recorded here because the packet is the first thing that leaves Meridian and lands in front of somebody outside it.

Bring it back when: a finding names its claims and a claim names its source id. The packet then prints titles and links under each idea, and `evidenceBlock` in `src/intelligence/concept-packet.js` is where that goes.

## A reading measure comes from a reader pattern, not a page modifier

Recorded 2026-08-28 with the Intelligence ideas view. The surface needs one column for the asks and the ideas together, sharing one left edge, but the instrument field and the running prose do not need the same width. `m-page` is 76rem and `m-page--fluid` is the window. Neither expresses that hybrid measure, and there is no page modifier for one. So `app/intelligence.html` puts `m-intelligence-reader` on the page element itself, which is a block's own class doing a page's job. It is the nearest thing that exists and it carries the 70rem canvas, the padding, and the narrow-width padding collapse already. Running idea prose remains capped by the shared 44rem copy measure.

The same commit found the cost of not doing this. The ideas were first put inside `m-orientation`, a two-column grid of unequal measures meant for a primary panel and an aside, so three ideas alternated across two columns of different widths. The pattern was used without being read.

Reshaped 2026-08-28 to the designer's ruling. The close is a generic page modifier, `m-page--reader` or whatever it ends up called, that carries a single reading measure for any page that wants one. When it exists, `app/intelligence.html` takes it and `m-intelligence-reader` stops doing page-layout work, which it was never built for.

Bring it back when: that page modifier lands in `app/design/`. Both changes go in the same commit as the modifier.

## Prose blocks are not cards, and there is no prose-action footer

Closed 2026-08-28. Asked as a card pattern and ruled against by the designer: an idea is a reading block, and rule-separated blocks are correct for it. The ideas stay on `m-intelligence-principle` and no card pattern is wanted.

What the question was actually pointing at is recorded in its place. The two actions currently sit in a bare `m-cluster` at the end of the block, which is a row of buttons rather than a defined end to a piece of prose. A reusable prose-action footer, the closing region of a reading block that holds its actions and any answer they produce, does not exist.

Bring it back when: a second surface needs the same closing region. Two real uses, then the pattern, which is the rule for shared code and holds for patterns too. `ideaBlock` in `app/intelligence/ideas-view.js` takes it.

## The ideas view lived in src so its markup could be asserted

Closed 2026-08-28, ruled against. Browser rendering lives under `app/`. Testability is not a reason to move an interface into the domain layer, and putting it there set a precedent nobody wanted. The module is now `app/intelligence/ideas-view.js` and the tests import it from there. `src/intelligence/` keeps the analysis record and the packet, which are domain.

The reason it went to `src/` in the first place still stands and is met by the new location: a test imports the module and asserts the markup a person receives, which is what a source-matching test could not do.

No condition to bring back. This entry records a placement that was wrong for one commit.

## A stored run pointed at findings instead of copying their evidence

Closed 2026-08-28 by the commit that landed the designer's pass. `run-scene-ideas` stored a finding's id, its words, its independent source count, and its tiers, and dropped the claims and sources behind it. Anything later that wanted to show the evidence for an old run would have had to resolve those ids against the brain as it stands today, which rewrites what a past analysis rested on. A run exists to say what the system knew that day, so that would have defeated the record.

The snapshot now copies the trail out of the record at generation time: `evidenceLinked`, `claimIds`, `claims`, `sourceIds`, and `sources`, through `evidenceSnapshot` in `api/tour/index.js`. This intake links no claims to findings, so today the lists store empty and the page reads that as a counts-only trail. An intake that does link them is stored without another change, which is asserted by a test that links a claim in the record and reads the stored run back.

No migration. Every run stored before this commit is test data.

## The direction read leaves nothing behind as a file

Recorded 2026-08-29 with Intelligence job two. Job one exports, because the admitted reality is that a creative feeds an idea to a model outside Meridian, and an idea is the unit a person takes away. Job two has no equivalent unit. The whole read is the artifact, and the one sharing behavior described for it, handing two echo candidates to the creative director with their sources, is a fragment of a read rather than a thing the record holds. So no export was built and no second packet renderer exists.

The name is settled in advance either way. If this ships it is a concept packet, never a brief, with the same lineage every packet carries: the tour, the direction version, the generation date, the artist knowledge approval date, and the run number.

Bring it back when: a person has read one and says what they would hand over. If the answer is the whole read, `src/intelligence/concept-packet.js` grows a second renderer against the same stored analysis and the Download and Copy actions sit at the foot of the read. If the answer is one entry, they sit at the foot of the entry, as they do on an idea.

## Answers share one answer area on Intelligence

Recorded 2026-08-29 with Intelligence job two. The page has one region below the instruments and two jobs now write into it. It shows one answer at a time: whichever job answered most recently on arrival, and whichever job the person just asked after that. The other job's answer is one named button away in the head of the answer on screen, and that button also sits in the empty state so a Scene with no ideas is not a dead end to a direction read that exists.

This holds for two answers. It will not hold for four. Jobs three and four are not on this surface in the same way, since the artboard review meets the person in the Reviews drawer, but a fourth answer here would make the switch a menu, and a menu of answers is the panel this surface exists to avoid.

Bring it back when: a third job writes an answer into this region. The composition is reopened then rather than extended, and the question to answer first is whether the answers belong on this page at all or beside the object each one is about.

Reopened 2026-08-29 with job three, as this entry required, and held. The board review writes into the same region, so the head of an answer now carries up to two named buttons rather than one. Two buttons is still a row a person reads at a glance. The question this entry asked was answered rather than skipped: the board review belongs beside the object it is about, and it is there, in the Reviews drawer under Present to client. It is also on Intelligence because a person reviewing several versions in a row wants one place to run the read from, and because the four asks are peers and one of them going missing from the surface would say the wrong thing about the set.

Resolved 2026-08-30 after the third answer made the row fail in use. Cross-job movement belongs to the four instruments, not to the head of whichever answer happens to be open. An instrument with a stored run names its latest answer at its foot and becomes the way back to it. The answer head now carries only run history within that job, as a separately labelled relationship. Tabs were refused because they would make the answer types a menu and recreate the panel this surface replaced.

Bring it back when: an answer no longer has one stable instrument on this page, or a real comparison asks a person to keep two answer types visible at once. Job four alone does not reopen it; its instrument can own its answer by the same rule.

## A board review cannot read a stand-in artboard

Recorded 2026-08-29 with Intelligence job three. The read hands the model the board as an image. A submitted version carries a PNG or a JPEG and is read. The stand-in writes SVG, which the model cannot look at, so those versions are refused with a plain sentence and are not offered in the version list on Intelligence.

This is the honest state rather than a gap to close in code. The alternative was reading the receipt, the brief, and the concept summary, and presenting the answer as a read of the board, which would be the analysis quietly not looking at the work.

Bring it back when: the stand-in is replaced by Jim's real system, which returns finished media rather than drawing markup, or a rasterizing step exists for a reason other than this. If neither happens and stand-in versions still need reading during the pilot, the cheap version is a browser-side render of the SVG to a PNG at submission time, stored beside the artifact.

## Intelligence asks every Scene for its artboards to build one list

Recorded 2026-08-29 with Intelligence job three. The board instrument offers one version of one Scene, so the page calls `get-artboards` once per Scene on load to find which versions carry a readable image. On this tour that is a handful of calls and it is invisible.

Bring it back when: a tour holds enough Scenes that the Intelligence page is slow to become useful, or a second surface needs the same list. The close is one action that returns every version with a readable board for the tour, which `api/tour/index.js` can answer from the same reads it already does.
