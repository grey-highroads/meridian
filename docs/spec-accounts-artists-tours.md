# Spec: Accounts, Artists, and Tours Become Data

Date: 2026-08-25
Status: ruled by the owner 2026-08-25. Build runs as four briefs in the commit order below. Layers: organization and tour.
Why pre-registered: it changes what a stored record is scoped to, which is irreversible in effect once a second client exists.

## What is true today

One account is a constant in `src/org/store.js`. One artist is a constant map in `api/artist/index.js`. The tour is markdown committed at `tours/off-the-map-2026/`, with every page defaulting to that id. The store already writes tour-level additions (direction versions, Scene requests) and all Scene state into blob storage under the tour id. The store half exists; the creation half does not; nothing binds account to artist to tour.

## The rule

An account is the paying organization. It holds users, its artists, and its tours. Everything stored is scoped account, then artist or tour, and no read crosses accounts. Higher Roads administrators work across accounts; everyone else exists inside one. The demo account (Dierks Bentley, Off The Map) is an account like any other, seeded on request.

Ruled 2026-08-26. One storage layout. The demo account is an ordinary account holding content we made up. It gets no special path, no fixture fallback, and no branch in any path builder. Every account stores its tours at `clients/{account}/tours/{tour}/` and its artists at `clients/{account}/artists/{artist}/`. This supersedes the demo carve-out in the paragraph above and the demo-path language in build steps 1 and 2 below, all of which describe a layout the code no longer has. The Dierks Bentley brain was copied to the uniform path and verified byte for byte before the fork was removed.

Ruled 2026-08-26. Reset is not a product feature. It existed to give Grey a clean demo, and once the demo account became ordinary it stopped earning a button, a confirmation pattern, and refusal guards. The refusal guards were removed from the paragraph above, the two reset items were removed from the acceptance list, and the two reset assertions were removed from the test list. The reset demo act named in build step 4 is dropped with them. The brain-survives ruling of 2026-08-25 stands and is unaffected.

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
3. Signed into each account, nothing anywhere shows the other's names, tours, or work.

## Tests, asserting effect

Cross-account reads return absence, not informative errors. Create-tour then get-tour round-trips with no fixture on disk. The demo fallback never fires for a non-demo id. Facts written by an admin acting in an account carry the on-behalf field.
