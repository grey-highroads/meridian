# Incident: stale-copy overwrite deleted the governed copy studio surface

- Date of damage: 2026-08-13, 21:40 UTC, commit `d82ce16`
- Date of detection: 2026-08-14, reported by Grey after the design studio lost caption, headline set, display copy drafting, and copy findings surfaces
- Date of restoration: 2026-08-14, restored surgically onto main
- Severity: high. Two days of shipped product surface silently removed from production. No data loss; all server-side modules were untouched.

## What happened

An agent session working on Snapshot drift rows pushed `app/app.js`, `app/styles.css`, and `docs/deferred-work.md` as whole-file contents from a copy loaded before the governed copy studio work (ADR 0014 slice 1 and the display copy build, 2026-08-10 and 2026-08-11) existed. The push was a normal fast-forward commit, so nothing looked wrong in history: 67 lines added, 1,009 deleted, under a feature commit message. Four later sessions built on the damaged file, which made a blunt revert impossible and hid the damage until the missing features were noticed in use.

Deleted and now restored: the studio caption toggle and copy direction input, headline set field, display copy drafting and recheck, copy preflight panel, produced copy panel with rewrite actions, rendered copy check, copy audit findings with repair actions, their styles, and the copy governance entries in the deferred work register.

## Why the safeguards missed it

The fetch-fresh rule existed in the UI contribution guide and had already been established after two smaller regressions. It is a rule about behavior with no mechanical enforcement, and a session that never fetched had no signal that its base was stale. Reviews of later commits saw plausible diffs against an already-damaged base. Line-count monitoring did not exist.

## Restoration approach

Revert of `d82ce16` only, resolved surgically: the Brand Brain Sources redesign (which legitimately rewrote intake regions after the damage) kept in full; the result screen combined so the stable image route and the restored copy panels coexist; styles restored as exactly the 177 deleted lines rather than a wholesale re-add. Verified: every deleted function present exactly once, every restored data-action has a handler, state fields cross-checked against the pre-damage reference, syntax checks passed.

## Mechanical guardrail added with this incident

Whole-file pushes are the hazard, so the push ritual now includes a shrink check: before committing, compare the line count of each pushed file against the same file at the current remote head. A file that shrinks by more than two percent requires the session to stop and explain the shrink in the commit message, naming what was removed and why. This is a ritual for agent instructions and the contribution guide, not enforced infrastructure; CI enforcement is recorded in deferred work as the durable fix.

## Standing lessons

- A stale-copy overwrite presents as a normal feature commit. History review does not catch it; size deltas do.
- The longer damage goes undetected, the more later work builds on the damaged base and the more surgical the recovery must be. The four intervening sessions turned a one-command revert into an hour of conflict resolution.
- Session-scoped agents must treat the remote as the only source of truth. Any file content held in context from earlier in a session is stale the moment another session pushes.
