# Handoff: source intake restructure (complete) and what it opened

> Update, 2026-08-14: The Brand Brain Sources landing page and its guided intake interactions were redesigned after this handoff. Read `docs/handoff-2026-08-14-brand-brain-sources.md` first. It supersedes the Sources-page interaction guidance below while preserving the underlying source contracts.

- Date: 2026-08-09
- Repository: `github.com/grey-highroads/brand-world-system`, branch `main`
- Status: shipped and iterated through live testing. Stable. One tracked synthesis follow-up.
- Companion doc: `docs/handoff-copy-governance.md` (the next planned slice, roadmap item 6)

## Why this exists

The copy-governance handoff named the intake page as partially restructured: products had gotten their own workflow, but the evidence and asset doors, the library cleanup, and the event-driven update flow were still queued. That remaining work is now done, and live testing pushed it past the original plan in two ways worth recording (intent-driven URL/text intake, and a reality-versus-aspiration signal). This doc captures the final state so the next session is not surprised by a screen that changed shape.

## What the intake page is now

The source intake screen (`renderBrainSources` in `app/app.js`) is organized around user intent, not the system's internal handling. The governing idea: the page was doing three jobs with three lifecycles under one undifferentiated funnel, and the copy had started leaking architecture to compensate.

**Two doors, plus a pointer.** The composer opens with a chooser (`intakeChooser`):
- **Brand usage** (`open-intake-door` with `data-door="evidence"`): material the system reads to build brand knowledge. Opens `evidenceDoor`.
- **Add an exact asset** (`data-door="asset"`): locked files, never synthesized. Opens `assetDoor`.
- A quiet text line points to the Products screen for adding a product. This is deliberately not a third door: a product is a governed record born on its own screen, not a source path. It routes via `open-product-from-intake`, which opens the Products add flow.

**The evidence door adapts to input method.**
- File tab: upload first, then the system suggests a material type from the filename and extension (`guessEvidenceMaterialType`), shown as a pre-selected confirmation in the type grid rather than a quiz. The user can correct it. File taxonomy is kept here because a file's type genuinely matters.
- URL and Written material tabs: no taxonomy grid. They ask intent instead (`sourceIntentBlock`): whose property this is (ours or someone else's to emulate), whether it reflects the brand today or a direction it is reaching for, how influential it should be, and a prose "how should this inform the brand." The material type is resolved implicitly from provenance (ours to `approved-guidance`, emulate to `cultural-reference`) so the source contract and synthesis payload keep their existing shape.

**The asset door** shows the two asset types (protected asset, background template), then the drop zone, then the contract fields including template ratio when relevant.

**The library is demoted.** Compact single-line rows (`sourceGroupRow`): kind mark, name, type and detail, one status pill. The pills that used to repeat identically on every row are gone from the row face. Rows group by lifecycle (`sourceLibraryGroups`) under quiet labels: Brand usage, Exact assets, Product briefs. Editing moved off the row into the Details expand.

**The update flow is event-driven.** The proposed-update callout and its Prepare button render only when sources are actually pending. At zero pending with an approved brain, that apparatus is gone; a quiet "Active v N" pill sits on the library header. The always-on no-op orange button is removed.

## The new data the intake now captures

Two fields were added to the source contract (`sourceContract` in `app/app.js`) and flow into the synthesis payload on every source:

- **`provenance`**: "ours" or "emulate". Whose property a URL or text source is.
- **`aspiration`**: "current" or "aspiration". Whether the source describes how the brand shows up today or a direction it is reaching for.

Both default to the safe descriptive reading ("ours", "current"). Both reach the synthesis request now because `requestSources` sends full source objects.

## The one tracked follow-up

**The synthesis prompt does not yet honor `aspiration` or `provenance`.** The fields are captured and delivered, but the brain synthesis instructions in `src/brand-brain/chat-completions-provider.js` treat every source the same. The intended behavior: an aspirational source should influence aesthetic direction without being recorded as a fact about the brand today (the "make us look like Prada" case for a repositioning CPG brand), and an emulate-provenance source should be understood as a reference drawn from, not the brand's own established truth.

This is a synthesis-prompt change, server-side, and it is the honest completion of the aspiration feature. The UI and data are live; the meaning is the next step. It is not blocking; sources marked aspirational currently behave like ordinary evidence, which is safe, just not yet special.

## Known cleanup left behind, not blocking

- **Dead CSS.** The old verbose row and old composer left unused classes: `source-row-meta`, `brain-source-count`, `source-upload-step`, `source-verification-note`, `source-step-label`, `source-sample-callout`. Harmless, worth a sweep.
- **Orphaned function.** `sourceMaterialOptions` (the old flat type list) is no longer called; `evidenceMaterialOptions` and `assetMaterialOptions` replaced it. Safe to delete when convenient.
- **SLAKE sample data still in the code.** The intake entry points to load the SLAKE sample batch are removed from the UI (evidence door and empty state), but the sample brain data itself remains in `app/app.js` and may still back the empty-state prototype walkthrough. Removing it wholesale is a separate, deliberate decision, since it could break the demo path. Grey signaled he is ready to be rid of SLAKE; the full teardown should be scoped on its own, with the prototype demo path checked first.
- **The recurring class-with-no-CSS bug.** Three spacing bugs across recent phases were the same failure: a class carrying layout meaning with no rule behind it. A CI grep flagging class names used in markup but undefined in either stylesheet would have caught all of them. Still worth adding.

## Rules that carry forward

- **Verified, Reasoned, Assumed** on every architectural claim.
- **No em dashes** anywhere, including code comments, commit messages, and docs.
- **Peer-to-peer, marketer-legible UI copy.** Schema field names never surface in the interface. This restructure was largely an application of that rule: the page now speaks the user's intent, not the system's handling.
- **Build-then-refine.** Grey reviews the live deployed app, not the JavaScript. This whole restructure was built, deployed, and then refined through Grey's live testing across several passes. That loop worked well here.
- **Fetch every file fresh before editing.** Held throughout this work.
- **Verify against a fresh browser session before considering a thing shipped.** The intake is the highest-traffic screen in the app; changes here especially need the live walk-through.
- **The 12-function Vercel Hobby ceiling.** Still 12 of 12. New endpoints must dispatch through an existing handler.

## Design principles this restructure reinforced, worth keeping

- Entry points should reflect what the user is doing, not the system's internal architecture. This is the same correction the concept-visibility map made for production entry points, now applied to intake.
- A navigation element that redirects is not a peer of elements that act in place. If one of N parallel choices teleports elsewhere, it should be demoted to a pointer, not dressed as a sibling.
- Ask the discriminating question. For a file, that is often its type. For a URL or a note, it is almost never the type; it is intent (whose, why, how much, reality or aspiration). Match the question to what actually varies.
- Progressive disclosure over upfront classification. Upload first, then confirm a suggestion, beats classify-then-upload.

## First action for the next session

If continuing on intake polish or the aspiration synthesis follow-up, read this doc and the intake functions named above. If moving to the planned next slice, read `docs/handoff-copy-governance.md`; the copy-governance work is unaffected by this restructure and its six open questions still stand. The aspiration-synthesis follow-up and copy governance are independent; either can go first.
