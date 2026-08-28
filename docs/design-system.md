# Meridian design system

Status: Phase-two foundation, shell, and Home reference available.

## Purpose

This system gives builders one visual and interaction language for new Meridian UI. It is separate from the inherited BWS prototype styles.

The system owns appearance, hierarchy, disclosure, responsive behavior, and interaction states. Builders own workflow logic, data loading, and service integration.

## Ownership

All Meridian design code lives in `app/design/`.

Builders use these files. Builders do not edit them. When a job needs a missing pattern, record the request in `docs/deferred-work.md` under Design pattern requests.

The request must name:

- the job a person is trying to complete;
- the missing state;
- where the need occurs.

Use one of four plain status phrases: requested, being designed, available, or use the existing pattern.

## Start here

Load one stylesheet:

```html
<link rel="stylesheet" href="/design/index.css">
```

Wrap each new Meridian surface in `.m-ui`. This keeps the foundation isolated from the inherited prototype.

```html
<div class="m-ui">
  <!-- Meridian UI -->
</div>
```

Class names use the `m-` prefix. Do not copy classes from `app/styles.css` or `app/polish.css` into new Meridian screens.

## File map

- `tokens.css` holds every color, type, spacing, size, motion, and layer value.
- `foundation.css` holds the scoped reset, base behavior, focus treatment, and small layout utilities.
- `components.css` holds controls, fields, labels, states, disclosures, and dialogs.
- `patterns.css` holds the shell, page rhythm, work surface, attention rows, lifecycle rows, inspectors, decision zones, attributed records, and work frames.
- `index.css` is the only stylesheet a Meridian screen imports.
- `samples/` holds static reference screens that show how the system composes around a job.

## Living reference screens

The new shell and Home fixture in `app/design/samples/index.html` are the composition source of truth for phase-two navigation, orientation, surface hierarchy, and Home. New work must not copy or extend the transitional shell in the live screens.

The real Meridian screens remain job and behavior references while their layouts transition to the revised foundation.

- `app/tour.html` and `app/tour.js` define the quiet reference page.
- `app/scene.html` and `app/scene.js` define the focused Workstation.
- `app/reviews.html` and `app/reviews.js` define the review and decision surface: a gallery of every Artboard version, and a full view with a drawer that carries the feedback and the decision. `app/review.html` and `app/client-review.html` were removed on 2026-08-27 and every road now points here.

Builders should copy workflow behavior from these screens only when it serves the same job. They should not copy their transitional shell or dense record layouts into another feature.

The files in `app/design/samples/` are controlled state fixtures. They show states that may be difficult to reach with current data. The Home fixture governs composition. Real screens govern stored behavior until their phase-two rebuild lands.

## Page rules

Every page starts with the job, not the data model.

1. Give the page one clear job.
2. Give it one obvious next step. A second action may exist when it is a real alternative.
3. Make the work the largest and brightest object.
4. Hide supporting detail until it is requested or blocks progress.
5. Do not repeat project details, state, or instructions in several regions.
6. Use empty space to show priority.
7. Attach feedback and decisions to the object they govern.
8. Separate functional planes with surface value and depth before adding another box or label.

Orient a person once with a quiet breadcrumb. Do not repeat the current object, location, version, or state in the rail, header, workspace, Inspector, and action bar.

Metadata earns space only when it changes the work or the decision in front of the person.

If a page needs a long explanation, simplify the page before adding help text.

## Artist Brain behavior

The Artist Brain contributes to work. It does not dominate the workspace.

After Higher Roads completes manual research and approves the Brain, ordinary scene work may ask for relevant context. Show a short cue such as `2 relevant notes`. Open the detail in a disclosure or dialog. A person may use a suggestion, edit it, or ignore it.

Brain guidance never becomes Scene Direction by itself. Do not reserve permanent page space for Brain history, scoring, or revision controls.

## Surface hierarchy

Meridian is dark without being flat. The shell, field, work plane, raised controls, Inspector, and record surfaces occupy distinct grayscale values.

Use the semantic surface and material tokens from `tokens.css`. Do not write local gradients, shadows, or colors. Gradients stay within neighboring charcoal values and should be felt before they are noticed.

Use color surgically:

- instrument cobalt and cyan for interaction, selection, and focus;
- amber for current attention;
- green for approval;
- rust for a real change or blockage.

Lifecycle stages do not receive individual colors. The words carry their meaning.

## Shell

The primary navigation is Home, Scenes, Reviews, and Tour details, as defined in `docs/meridian-product-architecture.md`. Artist Brain is a Higher Roads utility and contextual contributor, not a client destination.

Use `.m-shell` for the application frame.

- Home shows the condition of the active tour and the work that needs attention.
- Scenes holds all Scene work across the lifecycle.
- Reviews is the current person's decision queue.
- Tour details holds direction, dates, venues, setup, team, and approval authority.

Admin work is a quiet utility. Concept development, review, and handoff are states inside a Scene. They are not top-level navigation.

Use `.m-location` once for the client, artist, active production, and current Scene. Do not restate the same scope in the page body.

Use `.m-shell__nav-icon` with a visible `.m-shell__nav-label`. Use `.m-shell__nav-count` only for assigned queue work, never as a general metric.

### Boot sequence

The Horizon Alignment boot sequence appears once after a successful login. It uses the production vector object in `app/design/assets/meridian/`, fills most of the viewport, and assembles over about three seconds while the real page loads behind it.

The sequence creates atmosphere. It does not claim that Meridian is running checks, show fake progress, or delay later navigation. Reduced motion receives a brief static resolve. Treat it as an identity moment, not a progress indicator.

### Meridian identity

Production identity assets live in `app/design/assets/meridian/`. Use `.m-wordmark` in the application shell. It displays the strengthened lockup at the full rail width and changes to the dedicated micro mark when the rail narrows. Do not recreate the wordmark with live type or substitute the full symbol at micro sizes.

Use the primary lockup outside the shell when the full signature has room to breathe. Use the application icon only as an application tile. Use the boot object only for the once-after-login sequence, with its named SVG groups animated by `patterns.css`.

## Home and workflow patterns

Use `.m-home` for the Home orientation screen. It has a broad primary plane and one purposeful sidecar that moves below the main work before either column becomes narrow.

Five patterns carry the phase-two workflow grammar:

- `.m-attention-list` and `.m-attention-row` show work assigned to the current person. The action stays attached to the object it affects.
- `.m-lifecycle-list` and `.m-lifecycle-row` show the Scene and one plain sentence about its current condition. Name who or what happens next only when it changes the current person's work.
- `.m-inspector` holds supporting context that affects the current job. It never repeats the main work.
- `.m-decision-zone` names the consequence and presents one primary action plus one real alternative when required.
- `.m-activity-list` and `.m-activity-row` show a short attributed record. Each event names who acted, when, the version, and on whose behalf when relevant.

The same patterns serve client and Higher Roads work. Available actions and internal context may differ. The shell and workflow grammar do not.

### Empty states

An empty state answers the question a person brought to the page. It does not announce an empty database.

- Use `.m-empty-state` when the page has no work object yet. Use one oversized line glyph, one plain headline, one short explanation, and at most one primary action.
- Use `.m-empty-state--compact` when the page still has other useful work. Use `.m-empty-inline` for a missing optional detail inside an existing object.
- Use `--action` for an available next step, `--waiting` for a named input that has not arrived, and `--clear` when the absence of work is a successful condition. These colors clarify the kind of moment. They do not replace the words or create a color-coded lifecycle.
- Name the real object and the real handoff. Say `Artboard V02 has not come back from production`, not `No data` or `Nothing here`.
- A client empty state explains what Higher Roads will do next. A Higher Roads empty state names the safe next move or who holds the work. An observer can simply be told that nothing needs a decision.
- Do not use a large empty state for every missing optional field. Optional Brain notes, themes, references, and setup exceptions use the compact inline treatment and must not read like blockers.

See `app/design/samples/empty-states.html` for the composition reference. The live Home, Scenes, Reviews, Tour Details, Scene, and review screens use the same family.

## Workstation

Use `.m-workstation` when one authored or reviewed object needs supporting context.

- `.m-workstation__stage` holds the dominant work object.
- `.m-workstation__inspector` holds context that can affect the work.
- `.m-workstation__tabs` switches between context families. Only one panel is visible at a time.
- `.m-workstation-notice` puts an urgent doorway or decision before the work. An Artboard ready for review must appear here, not only in a footer.
- `.m-action-bar` stays available for authoring steps that naturally follow the work. It must not be the only place a review or approval can be discovered.

The Inspector is not a summary column. Request and applicable Tour Direction belong with Scene Direction in the main work plane. Brain and Setup may appear in the Inspector because they can contribute to the work. Versions belong there only when comparing versions is the job. Do not add a panel merely because the backend has another record.

Compiled output stays behind a disclosure until a person asks to inspect or download it. Do not keep an output strip visible while the current job is authoring.

Work planes fill the available shell. Do not center a narrow page container inside a workstation. Constrain paragraph measure inside the work plane, not the width of the work plane itself.

Use `.m-page--fluid` for primary left-nav destinations and `.m-page--workstation` for canvas and Inspector compositions. The default `.m-page` remains available for genuinely reading-sized documents.

## Orientation pages

Use `.m-orientation` for a quiet destination with one primary reference and a compact supporting record.

- `.m-orientation__primary` holds the object the page exists to read.
- `.m-orientation__aside` holds facts that help interpret that object.
- `.m-orientation__section` groups one family of supporting facts.

Do not turn every available record into an equal section. On Tour Home, Tour Direction leads. Dates, playback, setup, and themes support it. Scenes remain in the Scenes destination.

## Intelligence browser

Use `.m-intelligence-browser` when a large approved reference needs to remain browsable without rendering every entry.

- `.m-intelligence-browser__index` selects one category and identity.
- `.m-intelligence-browser__reader` shows only the selected intelligence.
- `.m-intelligence-remainder` keeps a dense category to a short first read.
- `.m-intelligence-provenance` keeps source detail one disclosure deeper.
- `.m-intelligence-admin` contains maintenance tools that ordinary reading does not need.

The default view is the approved intelligence, not the research database. A category index and one reading plane replace a continuous stack of every category and entry.

## Intelligence jobs

Use `.m-intelligence-instruments` for the four jobs that ask something of the approved artist record. Each `.m-intelligence-instrument` is a compact tool with a title, a purpose, and its own action or honest state anchored at the foot. Use two columns at desktop width and one at narrow width. The field uses the broad Intelligence canvas, while idea prose beneath it keeps the shared copy measure. The field must leave enough of the next section visible in the first laptop viewport for a person to know an answer arrived. Do not turn the set into directory rows, make a whole instrument clickable, or make unavailable jobs smaller than the live one.

Use `.m-intelligence-evidence` after an idea's qualifying notes. It is closed by default and its summary names the evidence layer and counts unique findings. Opening it recruits the whole findings and the reason each bears on the idea. A finding's trail may open one layer further only when linked sources exist. Counts and tiers stay on the trail line and never repeat in finding prose.

Use `.m-intelligence-results` as the handoff from asking to reading. Its top rule and `Generated ideas` label must remain visible even when the first idea begins below the fold. The small count confirms that the answer arrived without turning the section into a metric.

## Type and language

Use `.m-heading` for the page job, `.m-section-heading` for a real section, `.m-copy` for explanation, `.m-label` for a compact label, and `.m-meta` for exact identifiers and time.

Writing rules apply to interface strings and CSS comments:

- no em dashes;
- plain language;
- peer register;
- action labels state the result;
- no system vocabulary when the person only needs the consequence.

Prefer `Prepare V03 for client` over `Submit`. Prefer `2 relevant notes` over a technical description of how the Brain found them.

## Controls

Use `.m-button` with one of these variants:

- `.m-button--primary` for the next step;
- the base button for a real alternative;
- `.m-button--quiet` for optional detail;
- `.m-button--change` for a change request or destructive consequence.

Use `.m-field`, `.m-label`, `.m-input`, `.m-select`, `.m-textarea`, and `.m-help` together. Do not create local field spacing or control sizes.

Use `.m-disclosure` for optional detail on the same page. Use `.m-dialog` when the detail needs focus and a clear close action.

## Operator drawer

Use `.m-drawer` only for work an operator does about the shared object. It is a fixed overlay: the page keeps its full measure while the closed rail widens leftward over it. A page with no operator-only work has no drawer or trigger.

- Lead with `.m-drawer__action`. Each action keeps its field, button, and result in one group.
- Put supporting facts in `.m-drawer__context` inside the action they inform. Keep it closed until requested.
- Use `.m-drawer__reference` only inside that recruited context.
- Keep shared comments, approvals, and attributed feedback on the object surface.
- Do not use an Inspector as a drawer. An Inspector permanently changes the work area.

Drawer copy is intentionally smaller and tighter than page copy. Do not counteract that density with page-scale headings, nested cards, or local spacing.

Use Lucide outline icons only. Apply `.m-icon`, with a small or large variant when needed. An icon does not replace the label for an action, state, or decision.

## State

Use `.m-state` only when the state changes what a person understands or can do. State must include words. Color is supporting information.

Available state variants are current, approved, and change. Add a new state only through the pattern request process.

## Contextual contribution

Use `.m-contribution` for advice or context that contributes to the current job. It is not a summary panel. Keep it short. The source may be available through `.m-contribution__source` when a person asks why the note exists.

## Responsive behavior

The shell narrows at laptop width and becomes a horizontal working header on small screens. Job order must survive the transition. Do not solve a narrow layout by stacking every desktop panel.

Controls keep a minimum target of 44 pixels. Focus remains visible. Motion respects reduced motion settings.

## Guard

`test/design-boundary.test.js` runs with the normal suite. It enforces three rules:

- new stylesheets live in `app/design/`;
- color hex values live in `app/design/tokens.css`;
- visual decisions use classes, not inline attributes or script-owned `.style` changes.

The inherited prototype has a frozen allowance for violations that existed when this foundation landed. The guard rejects any increase. The allowance is not permission to copy a legacy pattern.

Run the guard directly with:

```sh
npm run check:design
```

## Fixture samples

Use the static screens in `app/design/samples/` as composition references:

- `index.html` for the phase-two shell and active tour Home orientation;
- `tour.html` for the active tour record and governed Tour Direction;
- `request.html` for a client request with a short valid path;
- `intake.html` for vertical source review;
- `develop.html` for Scene Direction and contextual Brain contribution;
- `reviews.html` for Artboard feedback and the decision, in the full view opened from the gallery;
- `handoff.html` for the issued record and approved Production Intent.

Stage and status treatments stay restrained: the words carry the meaning. Active stages use the current treatment and completed states use the approved treatment; nobody invents a color per stage. Fixtures demonstrate hierarchy, disclosure, states, and component structure. They do not define backend mechanics, permissions, or data contracts. Read `docs/meridian-experience.md` for the product and experience reasoning behind them.
