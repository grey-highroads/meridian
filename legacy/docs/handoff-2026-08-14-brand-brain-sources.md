# Handoff: Brand Brain Sources redesign

- Date: 2026-08-14
- Repository: `github.com/grey-highroads/brand-world-system`
- Branch: `main`
- Shipped commit: `bb8992d` (`Redesign Brand Brain Sources experience`)
- Status: live and intended as the baseline for incremental refinement
- Supersedes the Sources-page interaction guidance in `docs/handoff-intake-restructure.md`
- Product-wide design standard: `docs/experience/design-quality-standard.md`

## Read this first

The Sources page is no longer one generic classification workflow with several entry points. It is a guided landing page with four distinct jobs:

1. Brand foundation asks for the small set of official materials most brands have.
2. How the brand shows up asks for real examples of the brand in practice.
3. More context accepts other useful files and links without returning to the old classifier.
4. All sources remains the detailed source library and management surface.

The top of the page answers, "What should I give the Brain next?" The library answers, "What has the Brain already received?" Do not make both areas display the same records or metadata.

## Why the redesign happened

The prior implementation exposed the system's internal source taxonomy too early. Clicking a simple request such as Add website or Add logo replaced the calm landing page with a large, generic intake screen. The user had already chosen the source type, but the interface asked them to classify it again and displayed far more explanation and control than the task required.

The initial visual pass also carried too much repeated hierarchy. Progress summaries, large cards, detailed source records, and the full table all competed for attention. The redesign establishes a clearer rhythm and uses progressive disclosure:

- named source tasks open small drawers in place;
- only fields relevant to the chosen source are shown;
- detailed records remain in All sources;
- More context asks the discriminating questions that a named slot cannot answer;
- progress, color, spacing, and status cues clarify the page instead of decorating it.

The target is not a pixel-for-pixel mockup. The target is thoughtful layout design: section rhythm, useful visual cues, low density, consistent controls, and interactions that preserve context.

## Settled page structure

### 1. Brand foundation

The slots are intentionally ordered:

1. Website
2. Logo
3. Brand guide
4. Templates

Templates stay last. Many brands do not have them, and they should read as an additional asset rather than something more important than the website, logo, or guide.

Each row shows only:

- the source label;
- Added, Not added, or a count;
- one action.

Do not add filenames, thumbnails, dates, variations, provenance pills, or other record detail to these rows. Those details belong in All sources.

Selecting a row opens `sourceInlineDrawer(slot)` directly beneath that row. It does not navigate away, open a modal, or reveal the generic classifier.

The Logo drawer asks for the file first. Variation appears immediately below the upload. This ordering is deliberate: the person selects the artifact, then describes which variation it is.

### 2. How the brand shows up

This section uses three equal presence cards:

- Instagram
- LinkedIn
- Recent work

The cards carry enough practical guidance to make the ask understandable without becoming a second library.

Instagram explains that a recent full-screen grid capture works best and that direct Instagram access is unavailable. LinkedIn asks for the company page and a few recent posts and gives the same direct-access explanation. Recent work asks for a campaign, deck, launch, or other shipped work.

Recent work may show one compact latest-source record when filled. It is a useful completion cue, not a full record view. Do not grow this into a list. Complete management and metadata remain in All sources.

Selecting any card opens the same reusable inline drawer beneath the three-card grid. The page and section headings remain visible.

### 3. More context

More context is a lightweight entry point for competitors, category references, moodboards, aspirations, research, and other useful context.

It does not open the old four-card source classifier.

`sourceContextDrawer()` opens directly beneath the More context row and offers only File and Link. It asks:

- the file or web address;
- a required source name;
- whether it came from Our brand or is an Outside reference;
- whether it describes Today or a Direction to explore;
- a required usage instruction;
- what area it should teach;
- its influence;
- optional exclusions under More control.

These questions preserve the source contract without forcing the user to understand material taxonomy or authority vocabulary.

### 4. All sources

All sources is the detailed library. It owns source names, type, usage, status, actions, expanded details, provenance, role, influence, and asset metadata.

The library is not replaced when an inline drawer opens. This lets the user keep the page's context and see where the newly added source will live.

## Implementation map

The implementation is a vanilla JavaScript SPA. Render functions return HTML strings and action handling is centralized in `app/app.js`.

### Main JavaScript

Use these names when locating the current implementation:

- `sourceSlots`: declares the seven named slots, their matching rules, defaults, copy, and actions.
- `sourceSlotRows(slot)`: derives slot coverage from existing source records. Slots are a view over the existing data, not a new storage model.
- `sourceLayerCoverage()`: computes the section-level progress values.
- `sourceRhythmHeader(...)`: renders the shared number, label, title, description, status, and optional progress bar.
- `sourceFoundationRow(slot, locked)`: renders a compact foundation row and its attached drawer.
- `sourcePresenceCard(slot, locked)`: renders the richer low-density social and recent-work cards.
- `sourceInlineDrawer(slot)`: renders the compact drawer for a named slot.
- `sourceInlineMoreControl(kind)`: holds optional role, influence, and exclusions for named slots.
- `sourceContextDrawer()`: renders the File or Link flow for More context.
- `sourceGroupRow(source)` and `sourceLibraryGroups()`: render and group the detailed library.
- `renderBrainSources()`: composes the four sections.
- `sourceAddReady()` and `sourceMissingMessage()`: keep required-field gating and the visible explanation in sync.
- `sourceContract(...)`: creates the contract consumed downstream.
- `resetSourceComposer()`: clears all shared intake state, including `intakeSlotId`.

### Interaction routing

`state.brain.intakeSlotId` is UI routing state only.

- A foundation or presence slot stores its slot ID, such as `logo` or `instagram`.
- More context stores `context`.
- The generic composer leaves it empty.

`open-slot-intake` initializes a named slot with the source kind, form, material type, provenance, aspiration, and usage instruction that follow from the selected task.

`open-context-intake` initializes the compact context drawer with:

- `intakeKind = "reference"`;
- `sourceForm = "files"`;
- `sourceMaterialType = "past-work-research"`;
- empty provenance and aspiration, because the user must answer both.

`close-intake-door` calls the shared reset path. Do not create a second cleanup path for a new inline drawer.

### CSS

Feature layout is in `app/styles.css`. Shared visual tokens and global component polish remain in `app/polish.css`.

The Sources redesign uses the existing token and component vocabulary:

- `--space-*` for spacing;
- `--surface-card`, `--surface-inset`, and `--surface-control` for surfaces;
- `--border-subtle` and `--border-strong` for borders;
- shared radius, shadow, text, muted, and semantic color tokens;
- existing `.button`, `.source-choice`, `.source-method-tabs`, form, details, and status patterns.

Important Sources selectors include:

- `.source-rhythm-stack` and `.source-rhythm-section`;
- `.source-rhythm-header` and `.source-section-progress`;
- `.source-foundation-list`, `.source-foundation-row`, and `.source-foundation-item`;
- `.source-presence-grid`, `.source-presence-card`, and `.source-presence-record`;
- `.source-inline-drawer` and `.source-inline-fields`;
- `.source-context-entry` and `.source-context-drawer`;
- `.source-library-*`.

Do not add inline `style` attributes, hardcoded color values, arbitrary spacing, or another stylesheet for this feature. If a genuinely missing pattern is needed, create one reusable Sources component in `app/styles.css` using the existing tokens.

## Source contract invariants

The redesign changes presentation and routing. It does not weaken or replace the source data contract.

Every future change must preserve these rules:

- Every source has a required name.
- Every source has a required usage instruction.
- File, URL, and existing written-material code paths retain their stored source shapes, even though the Sources landing exposes only the appropriate forms.
- Protected assets remain exact assets and are not treated as synthesis evidence.
- Logo sources record `assetKind = "logo"`, a required variation, and a custom variation name when Other is chosen.
- Templates retain their required format ratio and template metadata.
- Asset-bearing brand guides retain the checkbox and `asset-bearing-guide` handling. A guide page that shows a logo does not make that embedded logo a placeable protected asset.
- Provenance remains `ours` or `emulate`.
- Aspiration remains `current` or `aspiration`.
- Outside material is demoted to creative reference by `sourceContract(...)`; it cannot become first-party brand evidence merely because of its declared file type.
- Influence remains creative priority, not authority and not a blend percentage.
- Role, influence, usage, exclusions, verification, authority, and material type continue to travel with the source.
- Adding sources after approval creates pending source IDs and a proposed update. It does not silently change the approved Brand Brain.
- Detailed source records remain managed through the existing library and storage logic.

`sourceAddReady()` now requires both provenance and aspiration for non-asset evidence. Named slots safely provide those answers because their labels define ownership and current state. More context must ask for them.

## Slot defaults and meaning

| Slot | Form | Material treatment | Provenance | Aspiration | Notes |
| --- | --- | --- | --- | --- | --- |
| Website | Link | Approved guidance | Ours | Current | Official site read as current guidance |
| Logo | File | Protected asset | Ours | Current | Requires variation after upload |
| Brand guide | File | Approved guidance or asset-bearing guide | Ours | Current | Retains assets-inside handling |
| Templates | File | Brand template | Ours | Current | Requires template format |
| Instagram | File | Single image | Ours | Current | Creative reference to real brand behavior |
| LinkedIn | File | Single image | Ours | Current | Creative reference to real brand behavior |
| Recent work | File | Work and research | Ours | Current | Evidence of behavior, not governing guidance |
| More context | File or link | Work and research baseline | User chooses | User chooses | Provenance can demote outside work to creative reference |

If a future slot can answer provenance, aspiration, material type, and form from the user's selection, add it to `sourceSlots` and reuse `sourceInlineDrawer(slot)`. If it cannot answer those questions, use or extend the compact context pattern. Do not send it to the generic classifier by default.

## Design principles to apply elsewhere

### Preserve the user's context

A local action should usually resolve locally. Expanding a short drawer beneath the selected row is preferable to replacing the entire page when the task has only a few fields.

### Ask only what remains unknown

The label Logo already answers source kind, provenance, aspiration, form, and asset kind. Asking those questions again is not thoroughness. It is redundant work.

More context cannot infer ownership or whether something is current versus aspirational, so it asks those questions explicitly.

### Separate guidance from inventory

The upper sections are a recommendation system for what to add next. The library is the inventory and management system. Do not duplicate inventory detail in the recommendation layer.

### Use progress as orientation

Section-level progress bars communicate coverage without turning every row into a dashboard. Keep them tied to clear counts and native progress semantics.

### Keep semantic color restrained

Section tone helps distinguish foundation, real-world examples, context, and the library. Color should reinforce meaning and state. It should not become decorative fill on every element.

### Design section rhythm, not isolated cards

Judge the page as a full vertical composition. Heading spacing, left rails, card height, drawer attachment, progress placement, and the transition into All sources matter as much as any individual component.

### Prefer reusable patterns over one-off polish

The inline drawer, rhythm header, slot status, presence card, and context choices are reusable patterns. Extend them before creating a visually similar parallel component.

## Responsive and accessibility expectations

The current layout deliberately changes shape at the existing breakpoints:

- the three presence cards stack below 900px;
- the detailed source table progressively removes secondary columns;
- drawers move from two field columns to one on small screens;
- context controls and actions wrap without horizontal overflow;
- touch targets continue to use shared button and control sizing.

Keep these conventions:

- visible text labels for every icon action;
- `aria-expanded` and `aria-controls` on drawer triggers;
- `role="region"` and an `aria-labelledby` relationship on drawers;
- `role="tablist"`, `role="tab"`, and `aria-selected` for File and Link;
- native `progress` elements with labels;
- native labels around inputs;
- visible focus behavior inherited from the design system;
- no information conveyed by color alone.

When adding a new interactive element, verify keyboard order in both the collapsed and expanded states.

## What not to reintroduce

- Do not make a named slot open the full-page Guided source workflow.
- Do not make More context open the four large Brand asset, Brand guidance, Brand work, and External reference cards.
- Do not ask the user to classify a source when the entry point already classified it.
- Do not show uploaded file lists inside Brand foundation.
- Do not turn the presence cards into detailed source tables.
- Do not put Templates above Website, Logo, or Brand guide.
- Do not move role, influence, provenance, aspiration, or asset metadata out of the existing source contract.
- Do not introduce inline styles or a parallel token system.
- Do not require an OpenAI API key to make or verify interface-only changes.

The old generic composer still exists because other prototype paths may reference it. Its presence is not permission to route the Sources landing back into it. Remove or consolidate it only after checking every entry point and test.

## Validation

The primary behavior coverage is in `test/browser-prototype.test.js`, especially:

- settled foundation ordering;
- inline slot drawers rather than the generic classifier;
- Logo upload before variation;
- logo variation and asset contract;
- template ratio handling;
- asset-bearing guide handling;
- Instagram and LinkedIn contract defaults;
- richer presence-card copy;
- More context File and Link tabs;
- required provenance and aspiration;
- outside-reference authority demotion;
- adding context after an approved version creates a pending update.

Before shipping Sources changes, run:

```sh
node --test test/browser-prototype.test.js
npm run build
git diff --check
```

The full `npm test` suite includes `fixtures/copy-audit-mechanism-test.mjs`, which requires `OPENAI_API_KEY`. Interface work does not need that key. Run the targeted browser test and build when no key is available, and report the fixture separately rather than requesting a credential for a reskin.

Also review the page in a fresh browser session at desktop and narrow widths. Exercise at least Logo, Instagram, More context File, More context Link, Cancel, and Add source.

## Safe extension checklist

Before changing this page:

1. Pull or fetch the current `main` and confirm it has not moved.
2. Read this handoff and `docs/ui-contribution-guide.md`.
3. Inspect `renderBrainSources`, `sourceSlots`, both inline drawer functions, the shared contract functions, and the nearby responsive CSS.
4. Inspect two to four nearby screens before creating a new visual pattern.
5. Decide whether the entry point already answers form, material type, provenance, and aspiration.
6. Reuse a named slot when it does. Reuse the context pattern when it does not.
7. Preserve source storage and contract logic.
8. Add or update browser-prototype assertions for ordering, routing, required fields, and contract output.
9. Check the full page rhythm, not only the expanded control.
10. Do not push until the user has reviewed meaningful visual changes.

## Likely small refinements

The shipped version is intentionally a baseline for small live adjustments. Reasonable future polish includes copy tightening, small spacing corrections, equal-height tuning, focus-state refinement, and improving how one recent-work item is summarized.

Treat a change as structural rather than small if it alters:

- the four-section hierarchy;
- which questions a slot asks;
- provenance, aspiration, authority, or influence behavior;
- source storage or pending-update behavior;
- the boundary between the recommendation layer and All sources;
- the existing design-token contract.

Discuss structural changes before implementing them.

## First action for the next agent

Open the live Sources page and compare it to this handoff before proposing changes. If the user reports a visual symptom, inspect the rendered page and trace it to the shared component or token first. Do not assume the latest request is asking for a new layout. The expected next phase is small, evidence-based refinement of the shipped structure.
