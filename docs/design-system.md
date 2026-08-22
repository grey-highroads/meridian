# Meridian design system

Status: Foundation. Sample screens land in the next design commit.

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

## Page rules

Every page starts with the job, not the data model.

1. Give the page one clear job.
2. Give it one obvious next step. A second action may exist when it is a real alternative.
3. Make the work the largest and brightest object.
4. Hide supporting detail until it is requested or blocks progress.
5. Do not repeat project details, state, or instructions in several regions.
6. Use empty space to show priority.
7. Attach feedback and decisions to the object they govern.

If a page needs a long explanation, simplify the page before adding help text.

## Artist Brain behavior

The Artist Brain contributes to work. It does not dominate the workspace.

After Higher Roads completes manual research and approves the Brain, ordinary scene work may ask for relevant context. Show a short cue such as `2 relevant notes`. Open the detail in a disclosure or dialog. A person may use a suggestion, edit it, or ignore it.

Brain guidance never becomes Scene Direction by itself. Do not reserve permanent page space for Brain history, scoring, or revision controls.

## Shell

Use `.m-shell` for the application frame.

The everyday navigation has two destinations:

- Scenes
- Artist Brain

Admin work is a quiet utility. Concept development, review, and handoff are states inside a Scene. They are not top-level navigation.

Use `.m-location` once for the client, artist, active production, and current Scene. Do not restate the same scope in the page body.

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

## Samples

The next design commit adds focused sample screens. They will show Scene Direction, a contextual Brain contribution, Artboard Review, and the approved state. Samples demonstrate composition and behavior. They do not define backend mechanics.
