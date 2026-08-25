# Meridian design system

Status: Foundation and living reference screens available.

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
- `patterns.css` holds the shell, page rhythm, work surface, action bar, contextual contribution, and work frame.
- `index.css` is the only stylesheet a Meridian screen imports.
- `samples/` holds static reference screens that show how the system composes around a job.

## Living reference screens

The real Meridian screens are the primary composition references. They use live application behavior and the isolated design foundation at the same time.

- `app/tour.html` and `app/tour.js` define the quiet reference page.
- `app/scene.html` and `app/scene.js` define the focused Workstation.
- `app/review.html` and `app/review.js` define the review and decision surface.

Builders should copy visual structure and classes from these screens. They should not copy their data loading or workflow logic into another feature.

The files in `app/design/samples/` are controlled state fixtures. They show states that may be difficult to reach with current data. When a fixture and a real screen differ, the real screen is the composition source of truth and the fixture must be brought back into alignment.

## Page rules

Every page starts with the job, not the data model.

1. Give the page one clear job.
2. Give it one obvious next step. A second action may exist when it is a real alternative.
3. Make the work the largest and brightest object.
4. Hide supporting detail until it is requested or blocks progress.
5. Do not repeat project details, state, or instructions in several regions.
6. Use empty space to show priority.
7. Attach feedback and decisions to the object they govern.

Orient a person once with a quiet breadcrumb. Do not repeat the current object, location, version, or state in the rail, header, workspace, Inspector, and action bar.

Metadata earns space only when it changes the work or the decision in front of the person.

If a page needs a long explanation, simplify the page before adding help text.

## Artist Brain behavior

The Artist Brain contributes to work. It does not dominate the workspace.

After Higher Roads completes manual research and approves the Brain, ordinary scene work may ask for relevant context. Show a short cue such as `2 relevant notes`. Open the detail in a disclosure or dialog. A person may use a suggestion, edit it, or ignore it.

Brain guidance never becomes Scene Direction by itself. Do not reserve permanent page space for Brain history, scoring, or revision controls.

## Shell

The current three-destination shell (Scenes, Tour, Artist Brain) is transitional. The target primary navigation is Home, Scenes, Reviews, and Tour details, as defined in docs/meridian-product-architecture.md, with Artist Brain becoming a Higher Roads utility and contextual contributor. Do not extend the transitional navigation into new screens; the revised foundation lands before the workspace, Home, and Reviews builds begin.

Use `.m-shell` for the application frame.

The everyday navigation has three destinations:

- Scenes
- Tour
- Artist Brain

Admin work is a quiet utility. Concept development, review, and handoff are states inside a Scene. They are not top-level navigation.

Use `.m-location` once for the client, artist, active production, and current Scene. Do not restate the same scope in the page body.

## Workstation

Use `.m-workstation` when one authored or reviewed object needs supporting context.

- `.m-workstation__stage` holds the dominant work object.
- `.m-workstation__inspector` holds context that can affect the work.
- `.m-workstation__tabs` switches between context families. Only one panel is visible at a time.
- `.m-action-bar` names the consequence and presents one primary next action.

The Inspector is not a summary column. Request, Brain, Direction, and Setup appear there because each can contribute to the Scene Direction. Do not add a panel merely because the backend has another record.

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
- visual decisions use classes, not inline styles.

The inherited prototype has a frozen allowance for violations that existed when this foundation landed. The guard rejects any increase. The allowance is not permission to copy a legacy pattern.

Run the guard directly with:

```sh
npm run check:design
```

## Fixture samples

Use the static screens in `app/design/samples/` as composition references:

- `index.html` for a quiet active Scenes directory;
- `tour.html` for the active tour record and governed Tour Direction;
- `request.html` for a client request with a short valid path;
- `intake.html` for vertical source review;
- `develop.html` for Scene Direction and contextual Brain contribution;
- `review.html` for Artboard feedback and version comparison;
- `handoff.html` for the issued record and approved Production Intent.

Stage and status treatments stay restrained: the words carry the meaning. Active stages use the current treatment and completed states use the approved treatment; nobody invents a color per stage. Fixtures demonstrate hierarchy, disclosure, states, and component structure. They do not define backend mechanics, permissions, or data contracts. Read `docs/meridian-experience.md` for the product and experience reasoning behind them.
