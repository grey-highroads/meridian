# Contributing to Meridian

This applies to anyone pushing to this repo, human or agent. It is short on purpose. The reasoning behind these rules lives elsewhere; here they are stated as rules.

## Before you change anything

Required reading before building any screen: docs/meridian-product-architecture.md. Every screen answers four questions within seconds: where am I, what is current, what needs my attention, what happens next. Its interface-consequences list is the review checklist, and the product test in that document is part of acceptance, checked by the owner on the live app.

Read `docs/meridian-thesis-and-architecture.md`. It says what Meridian is and what it is not. A change that does not fit one of its three layers, or the seam with Jim's system, does not belong here.

Read `docs/meridian-roadmap.md` to see what is being built now. Work that is not needed by the current step waits.

If your change touches the boundary with Jim's system, read `docs/meridian-seam-with-jim.md` first.

## Source of truth

- Fetch from the committed tree before editing or forming a judgment. Never edit from memory, a local copy, or a cached raw file. Raw CDN URLs serve stale content.
- Assert the current head commit before every push. If head moved, fetch again.
- Handoff notes and summaries age the moment they are written. The tree is authoritative; read it.

## Pushing

- One concern per commit. Name what changed and why in the message.
- Syntax-check any JavaScript before pushing (`node --check` on a copy works).
- Check the line count of every file you touched. An unexpected shrink is a sign something was dropped. Intentional shrinks are named in the commit message.
- Scripted find-and-replace asserts exactly one match before substituting.
- If a deploy does not fire after a push, a second empty commit on the same tree is the known workaround. Note it in the message.

## Code rules

- Any map keyed by a value from outside the system (a job ID, an artist ID, anything arriving from another service) is read with the own-property helper in `src/lookup.js`, never by direct property access.
- Guards check the effect, not a flag. A test that confirms a field is present is not a test that the requirement is met.
- Anything keyed on data presence is tested in both states, and across a switch of artist, tour, version, and actor. The failure mode is code that is right for the data in front of you and wrong after a switch.
- New Meridian UI uses `app/design/index.css`. Builders do not edit `app/design/`. Missing patterns go in `docs/deferred-work.md` under Design pattern requests.
- New stylesheets live in `app/design/`. Color hex values live in `app/design/tokens.css`. Visual decisions use classes, never inline styles.
- No generic platform layer. Shared code is extracted only after two real uses exist.
- Code that is uncertain goes in `/legacy` with a reason, an owner, a decision date, and a deletion default. Nothing lives there indefinitely.

## The /legacy folder

`/legacy` holds BWS client work that came across with the fork. It is kept for reference while the step 2 maps are made. Grey owns it. It is deleted when the real Jim adapter lands in roadmap step 7. If a pilot workflow references a file in there, that file is moved out of `/legacy` first, and the deletion is never postponed.

## Writing rules

These apply to comments, commit messages, interface copy, generated text, and docs.

- No em dashes. Check before pushing. Generated text counts.
- Plain language wherever a person reads it. System vocabulary never reaches the interface. "Needs your approval," not a state name.
- Claims in architectural prose are labeled Verified (read from the tree or a source), Reasoned (derived from verified facts), or Assumed (needs checking).
- Cut without replacement: really, genuinely, honestly, straightforward.

## Data rules

- Client files and unreleased assets never enter the repo.
- Public sources are synthesized, never reproduced.
- Credentials and tokens never enter the repo or any document in it.

## Findings

If you find that the thesis, roadmap, or seam document is wrong, do not design around it. Record the finding in `docs/deferred-work.md` first. Errors in pushed docs are corrected in place with a dated note citing the fix commit, never silently.

## Contributing from Jim's side

The seam document describes what crosses between the systems and in which direction. The adapter contract is provisional until both sides agree it is not; if your side needs the contract to change, record what and why in `docs/deferred-work.md` and the change is made together. Nothing in this repo is an obligation on Jim's system until it appears in the seam document as agreed.
