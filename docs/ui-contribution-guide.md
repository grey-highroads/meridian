# Legacy UI contribution guide

Status: Legacy BWS prototype reference.

New Meridian UI follows `docs/design-system.md` and uses `app/design/`. Do not use this guide to start a Meridian screen or add a Meridian pattern. This file remains only for a necessary fix to the inherited prototype while that prototype still runs.

## Why this exists

A designer did a consolidation pass across the full prototype (commit `ccf440f`, `app/polish.css`). That pass established a token system, a spacing grid, and a set of surface and control patterns that every screen now shares. Before the pass, screens drifted apart visually because each one made its own spacing, color, and border decisions. The pass fixed that.

New feature code that bypasses the token system reintroduces the same drift. It costs a second cleanup pass, and the second pass is harder because it has to reconcile the original tokens with whatever the new code invented. This guide prevents that.

## The two CSS files

**`app/styles.css`** owns feature-specific layout: screen compositions, component shapes, grid definitions, responsive breakpoints, and any CSS that belongs to a named feature (the brain review screen, the preflight sidebar, the studio setup). New features add their CSS here.

**`app/polish.css`** owns the shared visual layer: spacing rhythm, surface treatments, control sizing, border styles, pill/status semantics, card composition, and typography scale. It was written to apply the approved visual treatment without changing information architecture. New features do not add CSS here. They consume it.

When the two files conflict on a visual property (padding, border-radius, background, font-size on a shared class), `polish.css` wins. It loads second and its values are the approved ones.

## Tokens to use

All values come from the `:root` block in `polish.css`. These are the ones that matter most:

**Spacing.** `--space-1` (4px) through `--space-12` (48px). Use these for padding, margin, and gap. The most common are `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), and `--space-6` (24px). Do not write `padding: 14px` when `--space-4` (16px) is the nearest token.

**Layout rhythm.** `--card-padding` for card interiors. `--section-gap` for vertical space between cards and sections. `--field-gap` for space between form fields. `--cluster-gap` for tight groups of related elements.

**Surfaces.** `--surface-card` for card backgrounds. `--surface-inset` for inset panels within cards (the darker recessed areas). `--surface-control` for form inputs.

**Borders.** `--border-subtle` for default borders. `--border-strong` for emphasized borders (hover states, input fields). Never write `border: 1px solid var(--paper-200)` when `var(--border-subtle)` means the same thing and survives a palette change.

**Controls.** `--control-sm` (32px), `--control-md` (40px), `--control-lg` (44px) for button and input heights. `--radius-sm`, `--radius-md`, `--radius-lg` for corners.

**Colors.** `--text` for body text. `--muted` for secondary text. `--coral`, `--lavender`, `--celery`, `--success`, `--warning`, `--danger` for semantic accents. The pill classes (`pill-success`, `pill-warning`, `pill-governed`, etc.) handle status badges.

## Rules

**No inline `style=""` attributes in HTML.** Every visual decision belongs in a CSS class. Inline styles are invisible to the design system, cannot be overridden by polish.css, and scatter visual logic across 5,000+ lines of JavaScript. If you need a one-off spacing adjustment, create a utility class that uses a token.

**No hardcoded pixel values in new CSS.** Use the spacing tokens. If the design calls for a value that does not match any token, pick the nearest one and accept the 2px difference. The visual consistency across screens matters more than the exact value on one element.

**No raw color variables when a semantic alias exists.** `var(--paper-200)` is a palette value. `var(--border-subtle)` is a semantic alias for the same value. Use the alias. If the palette changes, the alias updates everywhere; the raw variable does not.

**No fallback values on established tokens.** `var(--surface-inset, #27313e)` is unnecessary when polish.css already defines `--surface-inset`. The fallback was written defensively during initial development. Now that the token system is stable, fallbacks on known tokens add noise.

**Match existing component patterns.** Before writing a new card, field, pill, toggle, or list, search styles.css and polish.css for the existing version. The card pattern (`.card` + `.card-header` + `h2`), the field pattern (`.field` + `label` + input), the additive-link pattern, the collapsible-card pattern, the exact-list pattern: these all exist and handle spacing, typography, and surface treatment consistently. A new component that reinvents these patterns will look slightly different even if the author tries to match them.

**Fetch files fresh before editing them.** This applies to CSS, JS, schemas, and any file being modified. When rebuilding a file from a copy that predates recent changes, exports and features silently disappear from the tree. The `polish.css` utility class system, the `approveProduct` export in `src/products/service.js`, and the schema fields declared in `schemas/v1/product-record.schema.json` have each been overwritten by stale-copy edits at least once. The rule is: pull the file from `main` immediately before editing it, edit only the specific block that changes, and diff before pushing.

## When you need something new

If the design requires a pattern that does not exist (the studio platform chips, the format resolution panel, the toggle row), add it to `styles.css` as a new block that uses the token vocabulary from `polish.css`. Follow the naming convention of the feature: `.studio-*` for Design Studio components, `.brain-*` for Brand Brain components. Group the new CSS together rather than scattering it among existing rules.

If the design requires a new token (a spacing value or color that genuinely does not fit the existing grid), add it to the `:root` block in `polish.css` alongside the existing tokens, not in a separate file or an inline declaration. This is rare. The existing grid covers almost everything.

## Data loading and async state

The app is a vanilla JS SPA. There is no framework-managed effect hook or component lifecycle. Every async load, mutation, and re-render is explicit code that must be placed deliberately. Three rules govern how loaders should be written.

**Render functions must be pure with respect to state.** `render*` functions read state and return HTML. They do not mutate state. They do not fire side effects that mutate state. When a render function calls an async loader, and that loader calls `render()` internally, and the loader is invoked before it records its completion, every render triggers another load, which triggers another render. The tab hangs.

If a screen needs data on entry, fire the loader from the action handler that navigates to the screen:

```js
if (action === "products") {
  navigate("products");
  void loadProducts();
}
```

Not from the render function.

**Async loaders need three guards, not one.** Every async function that mutates shared state and calls `render()` needs three protections:

1. **Concurrent-call guard.** `if (state.x.loading) return;` at the top. Without this, a re-render fired during the load can spawn a parallel load before the first completes.
2. **Successful-load idempotency.** After the load completes, record a flag that lets subsequent calls skip the fetch. For scoped loads (per-client, per-screen), the flag should include the scope: `state.x.loadedForClient = clientId`.
3. **Failed-load idempotency.** In the `finally` block, record the attempt even on failure. Otherwise a broken API turns into an infinite retry from repeated render passes. Explicit force reloads for user actions bypass this via a `force = true` argument.

A canonical implementation:

```js
async function loadX(force = false) {
  if (typeof fetch !== "function") return;
  if (state.x.loading) return;
  if (!force && state.x.loadedForClient === state.activeClientId) return;
  const attemptingClientId = state.activeClientId;
  state.x.loading = true;
  state.x.error = "";
  render();
  try {
    const response = await fetch("/api/x", { headers: { Accept: "application/json" } });
    const body = await readApiJson(response);
    if (!response.ok) throw new Error(body.error || "The list could not be loaded.");
    state.x.list = Array.isArray(body.list) ? body.list : [];
  } catch (error) {
    state.x.error = error.message || "The list could not be loaded.";
    state.x.list = [];
  } finally {
    state.x.loadedForClient = attemptingClientId;
    state.x.loading = false;
    render();
  }
}
```

**Test the empty state.** A feature works in the state where its data exists. It has to also work in the state where its data does not yet exist. Empty-state testing catches loops, null accesses, and misleading UI that happy-path testing misses. Before pushing a new loader-backed feature, cold-start the app with a client that has none of the relevant data. Every screen that references the feature must render cleanly and not fire loads it does not need.

**Test both presence states, on the sample and on a pre-existing real record.** Any interface keyed on whether a piece of data or an artifact exists has two states, and the one that breaks is almost never the one being built. New work is exercised against fresh or sample data, which has the thing. Records created before the work existed do not, and they are every record a real client already owns. The rule covers the same shape at any scale: a new artifact, a new field, a new placement, a new output type. Before pushing, render the feature twice, once against the sample or a newly created record and once against a record that predates the change, and confirm both. Spreading a missing key produces an object that is truthy and empty, which passes every presence check written as a truthiness test and fails at the first property access.

**Client-scoped interface state is tested across a client switch, not only across data states.** Rendering a feature against a brand that has the thing and a brand that does not is half the test. The other half is switching between them. State that hydrates once and is never keyed to the client it loaded for will show one brand's records under another brand's name, and nothing on screen says so, because a stale slate and a current one look identical. Anything a client owns needs the same three parts as the rest of the async work in this guide: a `loadedForClient` stamp, a reset to loading before the fetch rather than after it, and a discard of any response that arrives after the active client changed. Do not lean on a page reload to supply this. Reload is how the switch happens to work today, and correctness that depends on where the reload sits moves the bug into the next person's refactor.

### Reference incidents

Instances of the same failure shape, the code being right for the state the author had in front of them and wrong for the state everyone else was in.

On 2026-08-15, the ADR 0016 step 2 read path added a fourth Brand Brain artifact tab built by spreading `result.artifacts.visualGrammar` into a tab entry. Brains synthesized before the artifact existed carry no such key, so the spread produced a husk tab that rendered, threw on missing header fields when clicked, and killed the render loop until refresh. The implementing session render-tested the sample, which has the artifact, and the review passed it. Neither exercised a saved brain from before the schema, which is what every real client had. Fixed in `ae392e9` by gating the tab on artifact presence and guarding the shared reader header.

The screen orientation template regression is the same shape across placements rather than across records: logic correct for the placement it was written against, applied to placements that had never been exercised. The fix was scoping, and the invariant now sits in the image pipeline contract. In both cases the code was right for the state the author had in front of them and wrong for the state everyone else was in.

On 2026-08-09, the initial ADR 0012 step 5 implementation put `void loadProducts()` inside `renderWorkspace`, `renderChooser`, and `renderSalesSetup` to keep product-version drift cards populated. Combined with a guard that treated empty results as unloaded and no concurrent-call protection, this created a runaway render/fetch loop on any client with no products yet. Every existing client fit that description. The tab pegged 100% CPU, hydrateClients never got room to complete its render, the client switcher stayed empty, and hard refresh timed out. Full chain and fix in `docs/incidents/2026-08-09-loadproducts-render-loop.md`.

On 2026-08-17, the ADR 0017 step 3 protections block hydrated once at module load and carried no record of which client it had loaded for, so a switch left the previous brand's slate on screen under the new brand's name. The same push shipped a second fault of the same shape one layer down: the bootstrap slates were keyed `mycopop` and `dialog-health` while real client ids carry a suffix, as `clients/store.js#create` builds every id as `slugify(name)-shortId`. Slate lookup returned nothing for both real clients, the seed offer never appeared, and no refresh helped. Both were authored and reviewed against the bare fixture ids and a single client, which is the state the author had in front of them. Fixed by one shared resolver used by both the availability check and the seed action, so the button can never appear and then fail on press, and by the client-scoped loading discipline above. **This is the third recorded instance of this shape**, which is why the rule above is now stated separately rather than left implied by the presence-state rule. A fourth followed on 2026-08-19; see below.

On 2026-08-19, the studio scene detail fields. `sceneComposition`, `sceneLighting`, and `sceneProps` are written only when a scene suggestion is applied and describe the picture that suggestion described. When those fields were added, the retirement rule was written into the legacy `scene-input` handler with a comment saying why: once the scene is rewritten by hand they describe a different picture, so they are retired rather than carried onto a new one. The Design Studio screens were built afterward and write the brief through `studio-brief-input`, which cleared nothing. `select-studio-category` reset eleven pieces of studio state and none of these three. Neither `restore-brief-from-output` nor `use-scene-starter` cleared them either. So once any suggestion had been applied, its composition, lighting, and props survived every hand-written brief, every category switch, and every later job, compiling invisibly into the Assignment section after the scene text. Confirmed in production by the owner on 2026-08-19: a hand-pasted baseline brief compiled with a previous render's composition, lighting, and props appended after it, contradicting the pasted lighting and changing the image. **This is the fourth recorded instance of this shape**, and it is the first where the correct rule already existed in the codebase and simply was not carried across when a new screen was built alongside the old one.

The rule this adds: **a rule written as a comment on one handler is not a rule, it is a note.** When a behavior must hold on every path that does a thing, give it a named function and call it from each path, so a new screen has something to call and its absence is visible in a grep rather than invisible in a diff. The fix here is `retireSceneDetail()`, called from all six paths that change the scene by means other than applying a suggestion. Applying a suggestion overwrites all three and is the one path that must not call it.

## Shrink check before every push

Fetch-fresh was not enough; see the 2026-08-14 incident. Before committing, compare each pushed file's line count against the same file at the current remote head. If a file shrinks by more than two percent, stop. Either the shrink is intentional, in which case the commit message names what was removed and why, or the base was stale and the push would destroy other sessions' work. Whole-file pushes make this the single most important mechanical habit in the workflow.


## The image pipeline contract, before any image-path work

`docs/image-pipeline-contract.md` is the authoritative account of the twelve stages between a source entering intake and an image appearing on the result screen. It is mandatory reading before any session touches the image path, and it carries the second mechanical ritual of the push workflow: any commit that changes a module listed in the contract updates the contract in the same commit, or states in the commit message why no update is needed. The contract header's verified-against commit moves with every update. A contract more than ten commits behind the modules it covers is stale and must say so in its header until re-verified.

## A control's handler goes on the event its element actually fires

Found 2026-08-18 on the look grid. The look picker began as a `select` with its handler in the `change` listener. When it became a grid of buttons, the markup changed and the handler did not move, so every card was inert and the picker was stuck on its default. Nothing threw and nothing logged; the control simply did nothing, which is the failure mode hardest to catch by reading the diff.

The rule: when an element's type changes, move its handler to match. A `select` fires `change` and reports through `event.target.value`. A `button` fires `click` and reports through the `data-action` element's own dataset. The two listeners in `app/app.js` are separate, and an action registered in the wrong one is dead code that looks correct.

This is the second entry in this guide about a control that rendered but could not be used, after the look field first shipping on the legacy brief screen rather than the studio screens the same day. Both share a shape: the markup was verified and the path a person takes to reach and operate it was not. Rendering is not working.

A third instance the same day, same shape, different symptom: the look field was given `studio-setup-field` alone while every sibling field carries `field full studio-setup-field`. `.field.full` sets `grid-column: 1 / -1`, so without it the field occupied one column of a two column form grid and the picker rendered at half width with a large empty area beside it. Copying the class from a neighboring field is not a style choice, it is how a field declares its span. When adding a field to an existing form, read the classes on the field next to it and match them before writing any new CSS.


## A prompt change can break a control

Found 2026-08-18. Scene suggestion cards rendered a heading with no body, and clicking one returned the person to the generate button with no message. No markup had changed. The cause was a prompt edit: new rules referred to the world field repeatedly while the requested JSON shape named that key `brief`, so the model emitted `world` and the body was never there to render.

Two lessons. When rules and an output shape name the same thing differently, the model resolves the inconsistency however it likes, so name the key in the shape instruction and accept both on parse. And a card built from model output needs a state for the field being absent, because the model is not a schema. A control whose body is empty should say so and refuse to be selected rather than applying nothing and looking broken.
