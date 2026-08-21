# Handoff: Builder session, look library, 2026-08-18

This session builds and refines the look library. It is execution work. Architecture rulings, open structural questions, and code review belong to the architect thread and its handoff at `docs/handoff-2026-08-18-architect.md`.

## What a look is

A photographic medium at a moment in time, carrying every consequence of that medium. Not a mood, not a filter, and not imperfections sprinkled over a clean render. What makes a reference image unmistakable is that every attribute agrees: the light source, the color response, the grain structure, the tonal curve, the resolution, and what the medium physically cannot do.

The library is code, per ADR 0018. Nothing in it is synthesized from a brand's sources, because no brand's sources document camera character.

## The rules that make a look work

These were derived from roughly thirty renders across the 2026-08-18 session. They hold well enough to build on.

**Write physical facts, never perceptual targets.** This renderer obeys facts and ignores adjectives. "Grain reads as distinct visible specks and hair does not resolve into individual strands" works. "Authentic, gritty, filmic" does nothing. Every clause must be something a camera could be told to produce.

**Every look ends by naming what its medium cannot do.** This is what separates a medium from a mood, and it is the single most load bearing convention in the file. Bleach bypass failing to produce rich saturation is the look working.

**Binary tells beat gradual ones.** Four looks under-delivered when their signatures were written as characteristics and landed when rewritten as required visible artifacts. "Coarse grain" reads as a suggestion; "grain reads as distinct visible specks across every surface, coarse enough that individual hairs and fabric threads do not resolve into anything but texture" reads as a fact. Anamorphic went from a warm frame with no artifacts to both artifacts present when the oval highlights and the horizontal streak were made requirements rather than descriptions.

**Classify the environment.** Every look carries `environment: "agnostic"` or `"binding"`. A binding look also carries `requires`, naming the condition its medium needs. Agnostic looks work anywhere. Binding looks decide the setting, and `handleSceneBrief` gives them precedence over the preference for a familiar environment.

**A look that fights world building will lose.** Studio seamless was removed for this reason. The entire compiled prompt places a product in a lived setting, so a paragraph asking for seamless paper argues with roughly two thousand words asking for a place. Any look requiring the absence of a world needs compile path support that does not exist yet. See `docs/deferred-work.md`.

**Two entries whose only difference is that one is weaker is not a spectrum.** Clean digital was absorbed into Neutral after losing head to head on both an interior with a hard source and an exterior with none. A worse option on the menu is the consensus problem in miniature.

## Current state

Fourteen looks in `src/production/looks.js`, ordered in `app/app.js` `lookOptions` from cleanest to most extreme. Ids must stay in sync between the two files; there is no shared source and nothing validates it, so check both when adding or renaming.

`neutral` is the default and the only entry with no era, no stock, and no color personality. It is what a person means when they ask for something clean and professional, and it wins by restoring optical consequence rather than by adding character.

Proven to land: film noir, drugstore flash, flash at night, saturated daylight, negative at dusk, neutral, anamorphic after rewrite.

Not yet retested after their rewrites: bleach bypass, pushed black and white, color slide 1975. All three were rewritten from gradual to binary tells and none has been rendered since. **This is the first job of the next session.**

Never tested: overcast editorial, large format daylight, available light interior, daylight street documentary.

## How to test a look

1. Pick one scene and hold it fixed. Changing the scene between looks makes the comparison worthless.
2. Render the look. Read it against **its own claims**, not against the other looks. A medium succeeding at being what it is includes failing at what it says it cannot do.
3. The failure mode to watch for is a look coming back looking like the default with a tint. That means the language did not reach.
4. Separate two different failures. A look failing is the look's language. A scene that ignores the medium entirely, for example saturated daylight outdoors returning a dim interior, is the scene writer ignoring the look, which is a precedence problem and a different fix.
5. The renderer is nondeterministic. One render per look is a read, not a measurement.

## Where the code is

- `src/production/looks.js` the library. Shape: `{ id, label, environment, requires?, line }`.
- `src/production/package.js` compiles the selected look into the Capture section, second, followed by `HUMAN_TEXTURE`. Falls back to `CAPTURE_CHARACTER` when no look is set, which is now reachable only through the API.
- `api/production/generate-copy.js#handleSceneBrief` receives the look and briefs the scene for it. Look rules live in the system RULES block, after the world rules.
- `app/app.js` `lookOptions` carries label, note, and a CSS tone swatch per look, plus `studioLookField` and the grid on all four studio setup screens.
- `app/polish.css` `.look-grid`, `.look-card`, `.look-swatch`. Four columns, two below 640px.

## Things that will bite

**The swatches are tone signatures, not renders.** Deliberately abstract rather than fake photographs. Real thumbnails need one render per look on a single fixed scene so the only variable is the look. That is a real job and it is not done.

**Adding a look means touching two files.** `looks.js` and `lookOptions` in `app/app.js`. Nothing validates the ids match. A mismatch renders a card that selects a look that does not exist.

**Look color claims currently outrank world color content.** Anamorphic says color is warm with reds favored, which beat MycoPop's screen light ambition. The owner deferred this deliberately as look governance rather than look proving. Do not fix it inside a look line without a ruling; it belongs to the architect thread.

**The Capture section is roughly 540 words under Neutral.** Suspected internal redundancy diluting the strongest clauses. If a look underperforms, cutting is a more likely fix than adding.

**Ordering in the picker is meaningful.** Cleanest to most extreme, so the list itself reads as a spectrum. Keep new entries in the right place rather than appending.

## House discipline for this repo

- Fetch every file fresh from the committed remote tree before editing. Never edit from memory or a local copy.
- Assert HEAD SHA before every push. Verify every pushed file by fetching its blob from the committed tree and comparing bytes.
- Multi file commits in a single tree call, always followed by a `chore: trigger deploy` commit on the same tree, since the deploy hook does not fire on Data API commits alone.
- Update `docs/image-pipeline-contract.md` in the same commit as the change it describes.
- `node --check` every `.mjs` and `.js` before pushing.
- No em dashes anywhere, including comments and commit messages.
- Session scoped PATs. Never persisted, revoked at session close.
