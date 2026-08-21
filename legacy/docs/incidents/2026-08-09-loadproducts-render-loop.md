# Incident: loadProducts render loop broke the client switcher

- Date: 2026-08-09
- Detected by: Grey, on the deployed app immediately after the ADR 0012 phase closing commit
- Duration: about 30 minutes from user report to fix deployed
- Severity: High. App unusable. Existing client work appeared lost until diagnosis.
- Fix commits: `0adf4c3` (partial, insufficient), `90b2d67` (complete)

## What broke

Every existing client's brand brains, sources, and outputs appeared to disappear from the app. Hard refresh timed out. The client switcher displayed only the fallback default client. On first report, this looked like data loss.

## What actually happened

The blob data was untouched throughout. Blob storage does not delete on deploys, and nothing in the ADR 0012 phase writes to or deletes anything at `brand-world-system/clients/index.json` (the client index) or under any existing client's brain/sources/outputs. The apparent data loss was a client-side symptom of a runaway JavaScript loop that prevented the client switcher from ever rendering past its empty initial state.

The ADR 0012 step 5 implementation added `void loadProducts()` calls to `renderWorkspace`, `renderChooser`, and `renderSalesSetup` to keep the product-version drift cards populated. `loadProducts` had a guard clause that read `state.products.list.length` and treated an empty product list as "not loaded yet." Any client with no product records passed the guard on every call.

The failure chain on cold start:

1. Initial render runs `renderWorkspace`, which calls `void loadProducts()` (call A).
2. Call A sets `state.products.loading = true` and calls `render()` before awaiting the fetch.
3. That render triggers `renderWorkspace` again, which calls `void loadProducts()` (call B).
4. Call B's guard checks `loadedForClient === activeClientId`. `loadedForClient` is still empty because call A has not finished. Guard fails, call B proceeds and calls `render()` again before its fetch.
5. Repeat. Every render synchronously spawns another load before any previous load can record its completion.
6. On any `/api/products` failure, the `finally` block did not record `loadedForClient`, so even failed loads retried infinitely from repeated render passes.

`hydrateClients` completed its fetch but its render call was drowned in the loop. The client switcher never displayed the real client list.

## Why the first fix was insufficient

Commit `0adf4c3` removed the `state.products.list.length` check from the guard, on the assumption that the empty-result check was the sole issue. This only helped once `loadedForClient` was set. Because `loadedForClient` was set only after the fetch resolved, and multiple render passes fired new loads before any could resolve, concurrent loads still stacked up. The loop continued at a slightly slower pace, and any API failure still produced infinite retry.

## What actually fixed it

Commit `90b2d67` did three things:

1. Added `if (state.products.loading) return;` at the top of `loadProducts`. Only one fetch is ever in flight, regardless of how many renders fire the loader.
2. Moved `state.products.loadedForClient = attemptingClientId` into the `finally` block. Failed loads also record the attempt, so a broken API does not retry forever. Explicit `force = true` bypasses this for after-mutation reloads.
3. Removed `void loadProducts()` from `renderWorkspace` and `renderChooser`. Product-version drift cards still work once the user has visited the Products screen or Sales enablement, both of which load the list on entry. Workspace and chooser stay lean.

## Lessons

**Render functions must not fire async side effects that call render.** The pattern is easy to write and easy to miss in review. The rule is architectural, not stylistic. See `docs/ui-contribution-guide.md`, section on data loading and async state, for the guarded loader pattern that new features should follow.

**Async loaders need three guards, not one.** Concurrent-call protection, successful-load idempotency, and failed-load idempotency. Any two without the third leaves a path to infinite retry.

**Cold-start empty-state testing catches this class of bug immediately.** A single fresh-client test after the initial ADR 0012 step 5 push would have surfaced the loop before it reached Grey. The feature worked in the state where product records existed. It broke in the state where they did not. Every existing client fit the second shape.

**Apparent data-loss symptoms often mask client-side rendering failures.** When users report data missing, rule out client-side render loops before assuming server-side data loss. Blob storage does not delete on deploys. Every new API endpoint should be verified against a fresh browser session before it is considered shipped.

## Preventive changes

- `docs/ui-contribution-guide.md` gained a "Data loading and async state" section with the guarded loader pattern and the empty-state testing rule.
- This document establishes the `docs/incidents/` directory. Future incident writeups should follow the same shape.
