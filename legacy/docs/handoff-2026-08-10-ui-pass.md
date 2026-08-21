# Handoff: UI and UX pass, Snapshot through Products

- Date: 2026-08-10
- Session scope: whole-product interface pass, section by section, plus the first Website image production flow and a Dialog Health campaign
- Repository: `github.com/grey-highroads/brand-world-system`, branch `main`
- Deployment: Vercel, all work deployed
- Serverless function count: 12 of 12, unchanged

---

## Read these first, in order

1. This document.
2. `docs/deferred-work.md`. Created this session. It records everything deliberately left undone, why, and what would bring it back. Read it before proposing work, because several obvious-looking gaps are deliberate.
3. `docs/ui-contribution-guide.md`. The token system and the rules for new feature CSS.
4. `app/app.js`. The full prototype. Roughly 6,000 lines, vanilla JS, no framework.
5. `app/styles.css` and `app/polish.css`. The two-file CSS contract. polish.css wins on shared visual properties.

---

## Working agreement established this session

Grey's stated preference, in his words: the value is in talking through the plan before writing. Diffs are not needed. Push when ready.

That resolves to a rhythm worth keeping:

1. Read the live repo before recommending anything. Never work from a stale copy or from memory.
2. Talk through findings and a plan. Name what is a cheap fix, what is structural, and what you would leave alone.
3. Ask only about decisions that are genuinely his to make: product judgment, an added dependency, a governance rule. Do not ask permission for implementation detail.
4. Build, validate, push, then summarize what landed and what to watch.
5. He reviews the deployed app, not the JavaScript. Screenshots come back with precise observations. Take them seriously; every one this session was correct.

He flags things by describing the symptom, not the cause. "The first card looks taller" was a CSS adjacency rule. "The line breaks happen early" was a measure I had introduced two commits earlier. Diagnose before fixing.

---

## What shipped, by section

### Snapshot, formerly Workspace

Renamed. Nothing is produced on that screen; every action is a redirect, so the name should say so. The CSS class `.workspace` is shared with other screens and was deliberately not renamed.

- Brand overview keeps name, brain version, source count, date, and palette. The brand description line and the guardrail pills were cut. Guardrail pills read as warnings, were not actionable, and were an arbitrary subset of brand knowledge.
- The six guidance sections now sit in a 2x3 grid in that same card, each linking into its Brand Brain section. This replaced the sidebar guidance card.
- Needs attention rows all have a real destination and a verb. Exceptions resolve in the Brand Brain, brain-version drift restores the brief and lands in production against current guidance, product-version drift opens the product record.
- Candidate rules were removed from that list. No review surface exists and the queue does not survive a reload, so a row that disappears on refresh does not belong on the screen that tells you what is outstanding.
- Campaigns moved to the right column, filtered to campaigns with no outputs, capped at three, with a next action. The section does not render when nothing qualifies.
- Quick-start cards removed from the built state, kept in the empty state where they are the only path forward.

### Output lifecycle

Three related pieces, built in this order deliberately.

**Thumbnails.** Generated images are stored privately and served through presigned URLs valid for fifteen minutes. The output log persisted that URL string, so every thumbnail older than fifteen minutes was broken by design. Image paths are deterministic from the job id and always PNG, so the GET branch of `api/production/outputs.js` now mints a fresh URL per output at read time. Bounded to the sixty most recent, each signature individually try-caught. Records carry `hadImage`, a durable boolean, because an expiring URL cannot be the signal for whether an image exists.

**Discard.** Hard delete, chosen over a tombstone deliberately: a discarded output has no downstream dependents, and a soft-deleted row means every future query has to remember to filter it. Removes the log record, the image blob, the package blob, and the entry in `state.outputs`. The subtle part is clearing `state.production.job` when the discarded output is the current one, because the result screen and the generation banner read from the job rather than the output record. Without that, the discarded work returns as a banner. Two-step confirm on both the result screen and the preview modal.

**Evaluating past work.** The compiled package is now written per job at generation time, at `clients/{clientId}/production/jobs/{jobId}/package.json`. The outputs GET accepts `?outputId=` and returns one record with its package and a fresh image URL. The preview modal's Open evaluation rebuilds a job-shaped object and hands it to the existing result screen, which avoided teaching a dozen actions to accept an output id. A `state.production.reviewing` flag guards the difference: approving a reviewed output flips the existing record rather than calling `recordOutput`, which would have relabelled old work with the current brief. Outputs made before this change have no saved package and show a plain message. No backfill is possible.

### Brand Brain

- Capitalized in the nav. It is a named surface like Design Studio.
- The readiness hero became a single-line status bar rendered above the tabs by `brainWorkspace`, so it appears on all five brain screens instead of only Overview.
- Sources is full width, single column, with the two intake doors side by side.
- **Exact asset became protected asset** throughout the interface. The word exact was carrying two meanings: a class of source, and the strictest preservation level in a scale that also has controlled, structural, guidance, and open. Protected is now the noun; exact stays the promise. A protected asset stays exact. Code identifiers were already `lockedAsset`, so nothing moved in the schema or the compiler. The glossary gained a Protected asset entry mapping the interface term to the frozen locked element definition.
- Needs review lost its epistemics row, its duplicated reasoning section, the rule-outcome card, and the What this decision changes card. The canon gate is now conditional, appearing when an item is actually eligible rather than as a disabled control on every item. Promotion remains a distinct action; a permanently disabled button trains people to ignore it, which is the opposite of keeping it distinct.
- Brand guidance: the Guidance and Artifacts switch now outweighs the six category tiles rather than the reverse, the decision card moved to the top of the rail, How this section was shaped was cut entirely, the duplicated section labels were removed, and the source trail collapses but opens by default.
- Review question copy is model output, not interface copy. The synthesis instructions in `src/brand-brain/chat-completions-provider.js` gained plain-language rules and a banned-word list covering canonical, declared, baseline, provenance, aspiration, lockup, unresolved, and verification. **This does not retroactively fix existing questions.** They are stored in the brain and only a re-synthesis rewrites them, which bumps the version.

### Design Studio

- Category order is now social, website, product showcase, sales enablement, brand template, ad image.
- The duplicate latest-output notice on the chooser was removed. The global completion banner already carries it.
- **Website image is the third category with a real setup flow.** Six placements, each carrying its own composition knowledge, which is the point of the flow rather than a detail of it. The user writes a sentence; the preset supplies art direction for that shape. That direction appends to the brief at compile time, so it appears in the compiled prompt. If renders come back generic, `websiteOutputFormats` in `app.js` is where to tune, and it is six strings in one object.
- Product records are now available on the website flow, not only sales enablement.

### Campaigns

- The SLAKE Summer Reset seed was replaced with a Dialog Health RCS campaign, "Before They Open It." Every proof point is sourced from dialoghealth.com/rcs. No performance figures appear anywhere in it, deliberately: the page makes directional claims without publishing numbers, and campaign fields steer generated copy, so inventing a percentage would push an unapproved claim into production.
- The campaign direction panel was a three-column grid, which stretched every row to its tallest cell. A one-line objective rendered as an empty box beside a six-line audience. It now stacks full width with the label in a left column.
- Each field has its own Edit control. Per-field inline editing already worked, but the whole card was the button.

### Products

- Cards were reshaping around their content: the name shared a flex row with both pills, so a long name pushed the pills down. Now four fixed regions: name, meta, stats, footer.
- Pills carry labels, Status and Open questions. A record with no open questions shows None rather than hiding the pill and changing the card shape again.
- Footer reads "Available in Design Studio."
- The product name input carried no styling class and fell back to the browser default, dark text on white inside a dark interface. Fixed, plus a rule so a bare text input inside a `.field` cannot fall back that way again.

---

## Conventions established this session

**Color.** Coral and red mean a constraint or a problem. Yellow means a status that needs a human. Blue, `--celery-ink`, means go do something. Apply consistently rather than relitigating per screen.

**Selectable cards.** The intake doors on Sources use a colored stroke on the dark surface with an inset ring, rather than a background lift. That is the intended treatment for selectable cards across the app; most other surfaces have not been converted yet.

**Interface language.** Design Studio, not production. Production is the system's word for the work; Design Studio is where the user goes. This replaced several instances of "production can use this version" and "available to production."

**A user-facing rename is not complete until the prompts use the new word.** The synthesis instructions still said "exact asset" after the interface renamed it, so the model wrote the old term into copy users read.

**Any slot rendering model output must survive text several times longer than the fixture provides.** The artifact reader clipped its own content because two heading slots were fed model-generated strings that the SLAKE fixture kept short.

**Any layout holding free-text fields must be checked against a filled-in real example.** Both the campaign grid and the product cards looked considered against fixture content and broke against real content. Tiling is the specific trap: a grid stretches every row to its longest cell, so one verbose field taxes its neighbours.

---

## Recurring bug class worth knowing

Three separate faults this session had the same shape: a shared component styled correctly, then a variant overriding a CSS shorthand and silently undoing part of it.

- `.card + .card { margin-top: 18px }` is correct in a column and wrong in a grid, where it pushes every card except the first one down. Patched by cancelling it inside nineteen named grid containers. **That list is debt.** A new grid holding `.card` children inherits the bug until someone adds it.
- `.artifact-section-heading` was a flex row whose text span had no `min-width: 0`, so it could not shrink and the row overflowed a container with `overflow: hidden`.
- `.campaign-inherit-list li` set `padding: 8px 0`, and the shorthand wiped the `padding-left: 18px` that positioned the bullets.

The durable fix for the first one is deleting the adjacency rule and giving every stacking container an explicit gap, which is how the rest of the design system already works. That is a stylesheet-wide pass with real regression surface and was deliberately not folded into a UI session.

---

## Renderer findings

`gpt-image-2` accepts arbitrary resolutions when both sides are divisible by 16, the aspect ratio is within 3:1, and the pixel count falls between 655,360 and 8,294,400. **VERIFIED** from the OpenAI API reference.

Website formats were snapped to natively valid sizes rather than adding a resize dependency. Card became 1024x768, card square 1024x1024, share and blog 1280x672. Hero at 1920x800 and feature at 1200x800 were already valid.

**Open question, unresolved.** A hero requested at 1920x800 came back at 1536x640: exact on ratio, short on pixels. The size reaches the request body correctly, so the model is choosing its own resolution within the requested shape. The leading hypothesis is that `quality: "medium"` in `src/production/service.js` caps resolution, **REASONED and not verified**. Grey ruled out testing `quality: "high"` because it reportedly runs 30 to 50 times slower. The interface now shows aspect ratios rather than pixel dimensions, since the ratio is what the system reliably delivers. If delivered sizes turn out to scatter across jobs, a real resize step becomes necessary and sharp returns to the table.

`gpt-image-2` does not support transparent backgrounds. This blocks presentation elements, product floating shots, and the "better building blocks" position for two unbuilt studio categories. Recorded in the deferred register.

---

## What not to change without discussion

- The three distinct approval actions: approve output, approve guidance, promote to canon. Architectural invariant.
- The candidate-rule-queue pattern. Feedback never auto-writes to the brain. ADR 0010.
- The frozen product record contract at `schemas/v1/product-record.schema.json`.
- The formal compiler at `src/compiler.js`. The live path is `src/production/package.js`. They remain parallel.
- The 12-function Vercel ceiling. New operations dispatch through existing handlers.
- The two-file CSS contract. New feature CSS goes in styles.css and consumes polish.css tokens.

---

## Candidate next moves

Offered rather than chosen, since Grey picks the section.

- **Preflight and the evaluation screen.** These affect every category rather than one, and neither has been seen with real Dialog Health content. Based on the campaign and product findings, both are likely to have the same free-text layout problems.
- **Product showcase.** The primers call it the image-generation sweet spot and it still routes to the legacy flow. Website results were strong, so this is the natural follow-on.
- **Campaign persistence and client scoping.** Campaigns are a shared constant, so every client sees the same list. Nothing leaks today because there is no per-client campaign data at all, but persisting without scoping first would create a real boundary breach. The app-side work is the larger half: campaigns are read synchronously from a constant in a dozen places and would become an async load, which is exactly the shape that caused the render-loop incident. Use the guarded loader pattern from the start.
- **The stylesheet pass.** Delete the card adjacency rule, convert stacking containers to explicit gap, remove orphaned selectors, unify hover treatments on selectable cards.

---

## Housekeeping

**The personal access token in the project instructions must be revoked.** It was pasted into persistent project storage rather than being session-scoped, which is contrary to the standing rule. A new one is needed for the next session.

Nothing is half-finished. Every change this session was validated with `node -c` and pushed with the two-commit pattern: a content commit, then a `chore: trigger deploy` commit reusing the same tree sha.
