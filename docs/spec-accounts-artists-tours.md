# Spec: Accounts, Artists, and Tours Become Data

Date: 2026-08-25
Status: ruled by the owner 2026-08-25. Build runs as four briefs in the commit order below. Layers: organization and tour.
Why pre-registered: it changes what a stored record is scoped to, which is irreversible in effect once a second client exists.

## What is true today

One account is a constant in `src/org/store.js`. One artist is a constant map in `api/artist/index.js`. The tour is markdown committed at `tours/off-the-map-2026/`, with every page defaulting to that id. The store already writes tour-level additions (direction versions, Scene requests) and all Scene state into blob storage under the tour id. The store half exists; the creation half does not; nothing binds account to artist to tour.

## The rule

An account is the paying organization. It holds users, its artists, and its tours. Everything stored is scoped account, then artist or tour, and no read crosses accounts. Higher Roads administrators work across accounts; everyone else exists inside one. The demo account (Dierks Bentley, Off The Map) is an account like any other, seeded on request and resettable, with two refusal guards: reset refuses when the account has any non-seeded user or any client approval on record.

## The brain survives every reset. Ruled 2026-08-25.

The demo reset clears the tour namespace only: Scenes, briefs, artboards, approvals, records. It never touches the artist namespace. The brain, its approval, and its finding decisions persist across every reset. A reset serves a fresh tour walkthrough; the artist surviving resets is the product's own pitch. A blank-brain demo is a second account with no brain, never a wipe of this one. Before the first commit of this build lands, the operator exports the live artist state (approved findings and finding decisions) as a dated file held outside the repo.

## The changes, in build order

1. **Tour moves from tree to store.** `loadTour` reads a stored tour document first and falls back to the fixture only for the demo tour id. Create-tour writes the stored form: name, artist, approximate dates, primary contact. The fixture stays as the demo seed and stops being load-bearing for any other tour. Lands first and alone, because every tour action calls `loadTour`.
2. **Accounts become rows; scoping lands with its tests.** The single-account constant becomes a stored account list; env-seeded users attach to the demo account; sessions carry the account; every artist and tour handler resolves ids inside the session's account only. Each store's path change lands with its own cross-account test in the same commit. A Higher Roads session acting in an account records that account on every fact through the on-behalf field.
3. **Artists lose their constant.** Artists are stored objects under the account (id, name, identities), created by an admin; intake import requires an artist that exists. The demo seed creates Dierks Bentley's stored record; the brain content is untouched.
4. **The admin utility gains four acts:** create account, create artist, create tour, reset demo, on the new shell. No delete for real accounts in this phase; retirement is a later ruling.

Pages lose hard-coded defaults as part of 2: the shell resolves the session's account and active tour; the demo fallback fires only for the demo account.

## What does not change

Storage backend and client-scoped paths. Login mechanics. The seam, briefs, artboards, lifecycle, records: all tour-scoped already, inheriting account scope through the tour. The artist brain's content, approval, and integrate-only rule.

## Done when, on the live app, by the owner

1. As admin: create a second account with a fictional artist and tour; sign in as its user and see only that account's empty tour.
2. The demo account still runs the full loop; the Dierks Bentley brain is untouched.
3. Reset the demo account: Scenes and approvals clear, the seed reloads, the brain persists with its approval and decisions intact.
4. Reset on an account holding a client approval: refused in plain words.
5. Signed into each account, nothing anywhere shows the other's names, tours, or work.

## Tests, asserting effect

Cross-account reads return absence, not informative errors. Reset on a guarded account writes nothing. Reset clears the tour namespace and a byte-compare shows the artist namespace unchanged. Create-tour then get-tour round-trips with no fixture on disk. The demo fallback never fires for a non-demo id. Facts written by an admin acting in an account carry the on-behalf field.
