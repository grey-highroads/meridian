# Image pipeline contract

- Date: 2026-08-15
- Status: Complete. All twelve stages and the three cross-cutting sections. The practice gate (stages 6 and 7) passed owner review on 2026-08-15.
- Verified against commit: `8c74a5b9787a7860891e029e6d1c73c20170dd13`, the head this update was read against. The maintenance rule asks for this commit; a commit cannot carry its own SHA, so the parent is named and the deltas this commit introduces are stated below. Line anchors in `src/production/package.js`, `src/production/prompt-craft.js`, and `src/production/looks.js` read low against head by roughly 30 to 45 lines after this commit; every named function and constant is still present under its stated name.
- Override window note: commits `2551a13` through `8daea59` carried a temporary, guarded scene_brief override for the ADR 0016 step 1 captures, reverted byte-identical in the commit carrying the step 1 findings. Stage 6 describes the code outside that window, which is again the code at head. The override commits did not update this contract in the same commit; that maintenance-rule violation is recorded in the step 1 findings document.
- Delta since the verified commit: this commit adds one block to `SYSTEM_INSTRUCTIONS` in `src/brand-brain/chat-completions-provider.js`, the ADR 0016 step 3 cycle 2 revision covering where the rejects section comes from. Every other instruction block is byte-identical to the cycle 1 file, verified by block-level comparison. Anchors in that file below the honesty block read low against head by roughly 10 lines; anchors in every other module are unchanged. No compile-path behavior changes.
- Hotfix `ae392e9`, recorded rather than smoothed over: it changed `app/app.js`, a module this contract lists, without updating the contract in the same commit. That is the maintenance rule violated a second time, after the ADR 0016 step 1 override window. The change itself is correct and stands: brains synthesized before the visual grammar existed carry no fourth artifact, `applySynthesisResult` was spreading the missing key into a husk tab that rendered and then threw on click, freezing navigation on every real client. The tab is now gated on artifact presence and the shared reader header guards `sourceCount` and `categories`. This commit brings the contract current for both that fix and the work above.

- Delta from this commit, place on background arrives as a side path. Parent commit `b9e6233ae57f86efc9564c84aa6dc14d7b38c6d6`. A finished output becomes a background, a product picture with a cut out edge becomes the object standing on it, the browser flattens both onto one canvas and paints a second canvas marking only the ground where a shadow belongs, and the image edits endpoint fills the marked area. This is a spike run beside the pipeline rather than through it, at the owner's instruction of 2026-08-20 that it be non destructive and revert cleanly in one commit.

  **Where it lives, and what it deliberately does not touch.** New `src/production/composite.js` holds the shadow instruction and the masked edit call, and duplicates roughly fifteen lines of form assembly rather than adding a mask option to `src/renderers/openai-images.js`. The renderer is on the live path for every image the system makes and this is an experiment, so the duplication is the cheaper risk. `src/renderers/openai-images.js`, `src/production/service.js`, `src/production/package.js`, `src/production/prompt-craft.js`, `src/production/looks.js`, and `app/app.js` are unchanged, verified by diff. The interface is a separate page at `app/place.html`, `app/place.js`, and `app/place.css`, registered as a third build input in `vite.config.js` beside the existing landing page. It is behind the same middleware gate as every other path and reads the active client from the `bws_client` cookie the app already writes, so it follows the brand switcher without holding state of its own.

  **Four additive server branches, each unreachable without a new field.** `api/production/generate.js` dispatches on `body.action === "place-on-background"` before the existing call; a body without that field runs through the same code it ran through before, verified by reading the branch. `api/production/outputs.js` gains a GET `action=imageData` beside the existing `action=image` redirect. `api/blob/upload.js` gains `mode: "data"` beside the existing `mode: "read"`. `src/production/store.js` gains `readOutputImageBytes`, which nothing on the render path calls. Twelve function files, unchanged.

  **Why two handlers grew a way to send pixels through our own origin.** A canvas that has been handed a picture from another domain refuses to give its pixels back, and every image the browser sees today arrives through a signed link on the storage domain: the outputs image route answers with a redirect to one, and product thumbnails are handed one directly. Both readers therefore had to gain a path that returns image data from our own origin. Every existing reader keeps using the signed link, which stays cheaper.

  **The current job slot is not reused,** and this was the deliberate decision the work turned on. `production/current.json` is one record deep and a real render may be running in it. A composite run is a single fast call, so buying it reload recovery at the price of possibly standing on a render someone is waiting for is the wrong trade. Each run writes under its own server generated `place-` job id and touches the slot never. The cost, stated rather than left to be found: without the slot there is no duplicate guard, so a gateway retry runs the shadow pass twice and pays twice. Both attempts write to the same job id path, so the second replaces the first with a near identical picture rather than another job's work.

  **New invariant. A product placed through this path is composited in the browser and is never sent to a model on its own.** Its artwork and geometry are authored rather than drawn by a model, and the mask is what confines the model to the ground beneath it. Removing the mask silently removes that confinement, and the request would become an ordinary edit of the whole frame.

  **What that invariant does not say, stated because the difference has commercial consequence.** The picture that comes back is a new picture the model made, so the area outside the mask is re-encoded rather than returned untouched. The mask governs where the model is asked to paint; it is not a guarantee of byte identical pixels and must not be described as one. `docs/deferred-work.md` already records the same overclaim shape against the homepage line about assets being placed and never redrawn. Making the guarantee real is one canvas pass, drawing the product over the returned image a second time before saving, and it is deliberately not done here: for a spike, seeing the model's raw output is what tells you whether the shadow is any good.

  **Provenance is written, and deliberately not shaped as a compiled package.** The per job blob carries the background output id, the product id, the product image id, the placement box, the light note, and the prompt, under a `placement` key with no `generationPackage`. This output was not compiled from a brand brain and a record pretending otherwise would read as governed work. The consequence is intended and checked: opening one of these through `openOutputForReview` in `app/app.js` hits the existing guard at L8205 and shows "The compiled package for this output was not saved, so it cannot be evaluated" rather than rendering a broken screen. A second consequence, recorded rather than smoothed over: `api/production/outputs.js` strips every posted log entry to a fixed field list at L129 to L153, so the background and product ids cannot survive in the shared output log and live only in the per job blob.

  **Payload, measured rather than estimated.** The concern that two images would exceed the four megabyte body limit does not hold at the sizes this system produces. Encoded and measured on a deliberately hard photographic image: 406 KB total at 1024x1024, 591 KB at 1536x1024, 595 KB at 1024x1536, against a four megabyte ceiling. Two corrections to the original reasoning. The mask does not hold two tones, because its edge is a gradient, and softening that edge is what stops a visible seam where the shadow ends. And the friendly refusal in `readJsonBody` would never fire on the platform, because Vercel parses the body before the handler runs so the branch carrying the limit check is skipped; the browser measures before sending for that reason.

  **Size is derived, never accepted.** The page reads the background's own pixel dimensions and sends the matching one of 1024x1024, 1536x1024, or 1024x1536, and the server refuses anything else. A size that disagrees with the composite makes the model rescale the picture, which moves the product away from where it was placed.

  **What is not verified.** Nothing in this delta has run against the live model, real client storage, or a browser. The instruction text, the request shape, the guards, and the saved package shape are Verified by an offline run with a fake model and a fake store. Whether the shadow is any good, whether the mask geometry sits correctly under a real product, and whether a real background loads onto the canvas without tainting it are all unverified until the first run on the deployed app.

- Delta from this commit, the studio stops leaking scene detail into later briefs. `sceneComposition`, `sceneLighting`, and `sceneProps` reach the Assignment section as the Composition, Lighting, and Present-in-the-scene clauses after the scene text. They are written in `app/app.js` at one place only, the `use-scene-suggestion` handler, from the applied option's `composition`, `lighting`, and `props`. Until this commit they were cleared at one place only, the legacy `scene-input` handler. The Design Studio screens write the brief through `studio-brief-input`, which cleared nothing, so once any suggestion had been applied its three fields survived every hand-written brief, every category switch, and every later job.

  **The consequence in the prompt, Verified by compile.** A hand-pasted brief reading "A clinic front desk an hour before opening, lit by hard morning sun raking in through the entrance glass" compiled its Assignment section with an earlier suggestion's "Lighting: Uniform warm dusk with rim lighting on the subject" and "Present in the scene: park benches, a nylon track jacket, other joggers" appended after it. Two lighting statements about the same frame, which is the competing-claims shape, plus props from a different scene entirely. Observed in production by the owner on 2026-08-19 on a baseline render, which is how this was found.

  **The fix is a named function rather than three more assignments.** `retireSceneDetail()` clears all three, and six paths call it: the legacy `scene-input` handler, which is refactored onto it, `studio-brief-input`, `select-studio-category`, `switchClient`, `restore-brief-from-output`, and `use-scene-starter`. The last two were not in the reported set and were found by enumerating every write to `state.brief.scene` and `state.studio.brief`; the restore path is notable because the stored package records `brief.scene` and `brief.exclusions` only, so there is never scene detail to restore alongside a restored brief. `use-scene-suggestion` overwrites all three and is the one path that must not call it. The `switchClient` call is not load-bearing today, since the switch reloads, and it is there for the same reason `resetProtections` is: correctness should not depend on where the reload sits.

  **Recorded in `docs/ui-contribution-guide.md` as the fourth instance of the stale-state shape**, and the first where the correct rule already existed in the codebase and was not carried across when a new screen was built beside the old one. The rule the guide now states: a rule written as a comment on one handler is a note, not a rule. A behavior that must hold on every path gets a named function, so a new screen has something to call and its absence shows up in a grep rather than hiding in a diff.

  **Correction to the previous entry.** That entry said the tree was walked for the own-property class and five instances are what it held. That walk covered `src/` and not `app/app.js`, which carries a further thirteen externally keyed lookups into `placementFormats`, `salesOutputFormats`, `websiteOutputFormats`, `resolutions`, and `campaignEditDraft`, keyed from `state`, `source`, and `target.dataset`. They are unguarded and unaddressed here, since this commit is a state-clearing fix and mixing the two would make neither reviewable. Recorded as open so the earlier claim does not stand wider than the evidence behind it.

- Delta from this commit, the own-property class is closed. `resolveLook` was one instance of a class, and the other four are guarded here. New module `src/lookup.js` exports `ownEntry(map, key, fallback)`, which returns the fallback for anything that is not an own entry of the map. `resolveLook` is refactored onto it, and four more lookups adopt it: `imageSizeForFormat`'s `formatSizes[format]` and, inside `compileBrandWorldImagePackage`, `roleInstructions[prior.role]` and `textSideCopy[bannerTextSide]`, all in `src/production/package.js`, plus `getZone`'s `zones[zoneId]` in `src/copy/display-budget.js`. The helper carries the full account of the defect so the four call sites carry only a line each.

  **What each one did before, Verified by calling both versions side by side.** `imageSizeForFormat("constructor")` returned the source text of `function Object() { [native code] }` as the image size, which is the string handed to the renderer. `roleInstructions` and `textSideCopy` each interpolated that same source text directly into the compiled prompt, in the prior-outputs list and the banner composition section respectively. `getZone` returned `Object.prototype`, an object with no id, no label, no description, and no width fractions, to the display copy budget and prompt paths. None of the four threw and none logged.

  **Behavior for valid keys is unchanged**, verified by compiling seven scenes through both versions and comparing whole prompt strings: plain scene with a look, banner with a left-third text side, banner with no text area, campaign with a prior output carrying a role, display copy with a named zone, brand template, and sales enablement. All seven byte identical. After the guard, all five hostile keys fall back: 1024x1024 from `imageSizeForFormat`, the lower third zone from `getZone`, the reference-only instruction from `roleInstructions`, and the no-text-area line from `textSideCopy`.

  **One consequence outside the image path, stated rather than left to be found.** `fixtures/adr-0017-step4-parity-baseline.js` imports `getZone` from the live module rather than carrying its own copy, so the pinned baseline now gets the hardened behavior for invalid zone ids. Its compiled output is unchanged for every valid zone id, which is the only case the parity check exercises, and the file is not edited.

  **The rule, recorded so it is greppable.** Any map keyed by a value that arrives from a request body, a stored record, or a user field is read through `ownEntry`, not through `map[key] || fallback`. The tree was walked for this class and these five are what it held; a later addition of an externally keyed map is a later addition of this defect unless it uses the helper.

- Delta from this commit, `resolveLook` resolves own properties only. The function read `LOOKS[String(id)] || null`, and `LOOKS` is a plain object, so it inherits from `Object.prototype`. Ids like `constructor`, `hasOwnProperty`, `toString`, `valueOf`, and `__proto__` resolved to functions and objects that are not looks, and all of them are truthy, so they passed the `|| null` fallback and reached the compile path. Nothing validates `brief.look` against the library and the field is reachable through the API with any string. Both consumers were affected: the compile path in `package.js` and `api/production/generate-copy.js#handleSceneBrief`, which resolves the same way before appending a look's line to the scene writer prompt.

  **The symptom is worse than a stray word, and it changed shape between the report and the fix.** When this was first observed the Capture body was a template literal, so a look object with no `line` interpolated the word "undefined" into the prompt. The 2026-08-18 human texture commit rewrote that body as `.filter(Boolean).join(" ")`, which drops the undefined instead of printing it. The effect is that the ternary still took the "a look was selected" branch, so neither the look line nor the shared capture floor compiled and the entire capture character block left the prompt silently (Verified by compile at `dca6473`: with look `constructor`, the Capture section opened directly on the human texture floor with no capture character preceding it). A defect that prints a wrong word announces itself; one that removes a block does not.

  **The fix.** `Object.prototype.hasOwnProperty.call(LOOKS, key)` guards the return, so anything not an own entry of the library returns null and falls back to the shared capture floor exactly as an absent id does. A comment in the function states why, since a future refactor simplifying it back to a bare lookup would restore the defect silently. No interface change and no compile-shape change for any valid id. Verified by compiling one scene at three settings and comparing whole prompt strings: a valid look differs from no look, and `constructor`, `hasOwnProperty`, `toString`, `valueOf`, `__proto__`, an unknown string, and the empty string all produce a prompt byte identical to no look.

  **Recorded because it is the same defect class.** The first verification harness written for this fix stored results in a plain object keyed by look id, so its `__proto__` entry set the object's prototype instead of storing a value and read back wrong, reporting a failure that did not exist. The harness was replaced with one that compares against a single baseline string and holds no keyed map. Worth carrying: any map keyed by a value that arrives from outside the code wants an own-property discipline, not only this one.

- Delta from this commit, the scene-invariant middle cut. By owner ruling of 2026-08-19, four sections stop compiling into the prompt on the scene path in `compileBrandWorldImagePackage`: Brand foundation, the guidance sections block that spread `guidance.map` into the array, Audience and feeling, and Visual materials including its palette line. The phase 0 baseline measured the ground for this: between the two Dialog Health scenes every section except Assignment is word identical, roughly 1,290 of 1,450 words, so close to nine tenths of any compiled prompt was fixed brand payload competing with the two hundred words describing the actual frame (Verified, recorded 2026-08-18 in the phase 0 evaluations document). The same document records that the roughly 250 words of abstract guidance, palette provenance, and duplicate material vocabulary subtracted that day were never individually visible in a render, while every intervention that did move the image added concrete physical facts early. This cut removes the abstract half of the payload rather than trimming it.

  **Scene path only.** Template and sales-enablement paths compile exactly as before, since they were not part of the ruling and lean on the identity prose differently. Verified by compiling both placements before and after: prompt strings byte identical, 400 words for Brand template and 451 for Sales enablement.

  **What stays.** Assignment, Capture, The world this brand lives in, Product knowledge, the campaign sections, What this brand is not, Creative references, Protection, Display copy, and Output. Verified by compile on a fixture carrying a visual grammar: the world block still compiles at position three.

  **Audience and feeling is now dead on both paths** rather than conditional, since it was already excluded for template and sales, so the section is removed outright rather than gated. Visual materials survives for template and sales carrying its palette line only; its materials line was already suppressed on both paths before this cut, for template and sales because neither is a scene and for the scene path because the world block answers the same question with scene-bound facts.

  **The record is untouched.** The cut is to the compiled prompt string alone. `treatments`, `compiledComponents`, and the requirement checks all still read the brain exactly as they did, so what the brand asserts is still recorded on the package even while the prompt stops reciting it. Verified by compile: `compiledComponents` and `treatments` come back identical counts before and after.

  **Word loss, stated with its limitation.** Measured on a synthetic stand-in brain, the four sections were 97 words of 799, so the compile drops to 702. That stand-in is not MycoPop scale and the number should not be read as one: MycoPop's baseline is 2,610 words against this fixture's 799, and its guidance sections and read body are the parts that differ most, which are exactly the parts cut. The real MycoPop figure could not be measured in the session that made this change, because the approved brain, product record, and accepted protections live in Blob storage and are gitignored per ADR 0004 at `fixtures/adr-0018-phase0-inputs/`. It is one command for anyone holding those inputs: `node fixtures/adr-0018-phase0-capture.mjs --client mycopop` against `bfb4a24` and again against this commit. Labeled ASSUMED that the loss is materially larger than 97 words for MycoPop and requiring that run to verify.

  **Reversal is one revert commit**, per the ruling. The cut is a removal rather than a flag or option deliberately, so nothing has to be maintained in two states while the brands are watched.

- Delta from this commit, ADR 0018 ruling five executed, the aesthetic modes system is retired. This closes the largest known gap between ADR 0018 and the code. The system had four modes, each carrying an opening line that compiled into position one of the Assignment section, ahead of Capture and ahead of the scene. The 2026-08-17 audit established that an early positive instruction outranks a later one, so a line reading "A photograph made in a real environment, framed wide enough to show the place" was governing framing above both the selected look and the scene the person wrote (Verified by compile at `601853d`: every package opened with that line regardless of look, because `selectAestheticMode` fell back to cinematic film still and the look library sits downstream in Capture rather than replacing it in Assignment). Two systems describing the register of the photograph is the conflict shape ADR 0018 exists to remove.

  **What was removed.** `src/production/prompt-craft.js` loses `AESTHETIC_MODES`, `MODE_SIGNAL_PATTERNS`, `selectAestheticMode`, and `openingLine`, replaced by a comment recording what stood there and why it went. `src/production/package.js` loses the two imports, the mode selection block including its `creativeText` and `hasProduct` locals, and the opening line from the Assignment body. The section now opens with "Create one {format} brand world image for {placement}." followed immediately by the scene, then composition, lighting, and props as before (Verified by compile).

  **The `aestheticMode` field was removed from the package shape rather than carried forward as null, and replaced with `look`.** A field naming a register that no longer compiles is worse than a field naming nothing, and the interface was displaying it as "Visual register" on the production contract card, which would have become a permanent lie. Every reader was checked. `buildConsumptionRecord` in `package.js` and the parallel record builder in `app/app.js` now read `pkg.look?.id`. Three display sites in `app/app.js` now read `pkg.look?.label`: the production contract card's collapsible pill, its Visual register list item, now labelled Look, and the production record's Mode rule, now labelled Look and falling back to "No look selected" rather than "Standard". `classifyChangeImpact` was checked and never read the field (Verified by reading the function; it consumes guidance sections, palette, applied rules, and locked asset name only). The package now carries `look: { id, label }` or null, so the production record can say which medium made the image.

  **The pinned ADR 0017 parity baseline carries its own copies now.** `fixtures/adr-0017-step4-parity-baseline.js` imported `selectAestheticMode` and `openingLine` from `prompt-craft.js`, so deleting the exports would have broken it at import. Both are inlined verbatim, copied from `prompt-craft.js` at `601853d`, which is the last commit carrying them and is behavior-identical to the pin at `1c00ac3` since neither function changed in between. This is not an edit made to pass a check; a pinned baseline should not import from a module that moves, and the compiled output is unchanged. The header carries a dated amendment saying so.

  **Tests and harness.** Four tests in `test/prompt-craft.test.js` covering signal matching, the tabletop clause, and the no-aspect-word rule are removed with the system they covered, replaced by a comment recording what they held. `fixtures/adr-0018-phase0-capture.mjs` reports the look instead of the mode in its metrics and summary line; its banked phase 0 captures are unaffected, since only the report shape changed.

- Delta from this commit, ADR 0018 two looks from the photographic character layer brief, and the photorealistic ban stated. `src/production/looks.js` gains `color_negative_daylight`, labelled Color negative handheld, and `long_lens_distance`, labelled Long lens from a distance, both `environment: "agnostic"`, both written to the file's convention of visible consequences ending in what the medium cannot do. Handheld negative names fine organic grain rising in the shadows and anywhere underexposed, highlights that roll off rather than clip, film color response with olive greens and cream whites, exposure that favors the subject and lets the rest of the frame fall where the light puts it, a horizon a degree or two off level, and one permitted imperfection chosen from a soft foreground edge, a small flare, or a motion smeared background detail. Long lens names 135 to 200mm compression with background planes stacked rather than receding, one thin focus plane with a possible unexplained soft foreground crossing, atmospheric haze lightening and cooling each further plane on exteriors, a muted earthy 1970s negative palette of ochres browns and sage greens, and grain heavier in the sky. They arrive as looks rather than as a parallel capture-profile system, because the library already is where a medium is described and a second system describing the same property is the conflict shape ADR 0018 exists to remove. `LOOK_IDS` is derived from `LOOKS`, so both reach it by being written; the picker order in `app/app.js` `lookOptions` is curated separately and runs cleanest to most extreme, and the two are placed among the cleaner half, handheld negative after overcast editorial and long lens after large format. Ids verified matching across the two files by hand, since nothing validates them (Verified by set comparison at build time). Sixteen looks. Neither is flagged `resolvesFineDetail: false`: handheld negative states fine grain and long lens holds a sharp plane, so both resolve fine detail and the full human texture floor compiles under them (Verified by compile).

  **The photorealistic ban, stated as a compile-path rule.** No compiled prompt and no scene writer instruction may contain the word "photorealistic" or its hyphenated and spaced variants. It is a perceptual target rather than a physical fact, and the 2026-08-17 audit established that this renderer obeys facts and ignores targets, so the word buys nothing and pulls toward the polished default finish the look library exists to escape. Enforcement is a grep at review time, deliberately not a runtime filter or check, per the standing rule against instrument-shaped work. Scanned at `e3be47d` across `src/`, `api/`, and `app/` for all three spellings: clean, so no code changed. Two occurrences exist elsewhere in the tree and are correct where they are, `fixtures/adr-0018-phase0-capture.mjs` counting the word as a baseline measure and ADR 0018 itself naming the ban. The rule is recorded here so it survives in the document a future session reads rather than only in the chat that set it.

- Delta from this commit, ADR 0018 fourth look declares it cannot resolve fine detail. By owner ruling of 2026-08-18, `consumer_negative_dusk` gains `resolvesFineDetail: false` in `src/production/looks.js`, on the same evidence that flagged the other three and recorded as an open finding in the previous commit. Its own line states coarse grain across the entire frame and heaviest in flat skin, focus that is approximate rather than exact, and precise focus as outside what the medium does. Under it the human texture floor now compiles without the fine-hair clause and the eyes-and-lips clause and keeps skin zoning, patchy sheen, facial asymmetry, and the age carried in hands and necks, dropping from 231 words to 162 (Verified by compile). Four of the fourteen looks carry the flag. The finding is closed; the second finding from that commit stays open, since `CAPTURE_CHARACTER` still carries an ungated skin sentence on the no-look path. No compile-path change: `package.js` reads the flag exactly as it did before through `lookResolvesFineDetail`.

- Delta from this commit, ADR 0018 Capture stops making competing claims. One constraint governs all three changes: no two statements inside the Capture section may make competing claims about the same property.

  **The floor compiled on frames with nobody in them.** Verified before the change: `src/production/package.js` appended `HUMAN_TEXTURE` to Capture under every look on every scene, so a can on a wet counter carried 231 words stating that skin is zoned, that sheen is patchy, and that the two sides of a face do not match. That is prompt budget this phase exists to reduce, spent on a property the frame does not have, and it asks for a face in a frame that was never given one (the compile is Verified from L584 at head; the invitation is Reasoned from the 2026-08-17 audit finding that an early positive statement outranks a later one). `package.js` gains `frameCarriesPeople`, a word check over the scene, the composition, and the props fields, and the floor compiles only when it passes. The scene writer authors people explicitly when the frame has them, and a hand written brief names them in the same three fields, so one check serves both. Lighting is not read, because a lighting note describes the source rather than what it falls on. The word "human" is deliberately absent from the list, since it matches "human resources", which is ordinary B2B scene vocabulary. The check is one directional by design: a false positive costs a texture paragraph and is exactly the behavior at head, a false negative costs a slightly plastic face, and neither countermands the brief. Measured on a fixture brand (Verified by compile): a no-person frame under Neutral drops from 537 words of Capture to 306.

  **The floor demanded detail three media cannot render.** The floor asks for individual fine hairs, an iris with visible fibers, and vessels in the white of an eye. Pushed black and white reportage states that individual hairs and fabric threads do not resolve into anything but texture; drugstore flash states that hair and fabric edges never fully resolve; bleach bypass lays coarse grain over every surface. Under those three looks the prompt asked for two incompatible things and left the renderer to arbitrate. `src/production/looks.js` gains a `resolvesFineDetail` field, declared false on those three and absent everywhere else, read through the new `lookResolvesFineDetail` helper. `src/production/prompt-craft.js` replaces the `HUMAN_TEXTURE` string with `HUMAN_TEXTURE_CLAUSES`, each clause carrying `needsFineDetail`, and exports `humanTexture({ resolvesFineDetail })` which drops the fine-hair clause and the eyes-and-lips clause when the medium cannot deliver them. The skin zoning, the patchy sheen, the facial asymmetry, and the age carried in hands and necks are structural rather than small and hold at any resolution, so they compile under every look. The reduced floor is 162 words against 231 (Verified by compile).

  **`peopleExcluded` resolved by removal, not by rewiring.** The parameter had been hardcoded false at its only call site since it was written, so it never once changed a compiled prompt. It was not wired to the inverted person check, and the reason is asymmetric failure: omitting a texture paragraph from a frame the check missed costs a slightly plastic face, while asserting "no people or hands appear in the frame" into a frame the check missed countermands a person the brief asked for. A word check is not a good enough witness to give an order that strong. A person who wants nobody in the frame already has an authored channel in the brief's exclusions field, which compiles verbatim into the same Protection section. The parameter and its three branches are removed from `protectionBlock`; the call site in `package.js` drops the argument. `test/prompt-craft.test.js` replaces the assertion that exercised the flag with one that holds the removal: no path through `protectionBlock` may assert an absence of people on its own authority. `fixtures/adr-0017-step4-parity-baseline.js` still passes `peopleExcluded: false` and is deliberately left byte-identical, since it is a frozen baseline and the extra key is destructured away.

  **Two findings recorded rather than designed around.** First, `consumer_negative_dusk` carries coarse grain across the whole frame and approximate focus and names precise focus as outside what its medium does, so it has a claim to `resolvesFineDetail: false` on the same evidence as the three that were flagged. It was not flagged in that commit, because widening the set is a look-quality judgment and belongs to the owner. It was flagged by owner ruling in the commit immediately following, and this finding is closed. Second, `CAPTURE_CHARACTER`, the fallback when a job carries no look, contains its own skin sentence covering pore texture, uneven color, and sheen, and that sentence is not gated by the person check. It is reachable only through the API or a brief predating the look picker, and the two statements agree rather than compete, so it was left alone. Both are open items for the next ruling surface.

- Delta from this commit, ADR 0018 human texture floor. Faces read as plastic in frames where the scene, the light, and the product had all landed. The looks each described skin as a category, pore texture and uneven color and sheen, and a category is not a fact. `src/production/prompt-craft.js` exports `HUMAN_TEXTURE` and `src/production/package.js` appends it to the Capture section under every look, since it describes what a person is made of rather than how the photograph was taken. It states that skin is zoned rather than one even complexion, red at nostrils ears cheeks and knuckles, cooler under the eyes and jaw, yellower across the forehead, with those zones meeting unevenly; that sheen is patchy and located rather than an even glow; that fine hair catches light along the jaw, cheek edge, upper lip, and hairline with individual hairs out of place; that the two sides of a face do not match; that eyes carry lower lid moisture, vessels in the white, and a fibered iris; and that hands and necks show age before faces do. Clauses hold in monochrome, where the zones read as tonal difference. `src/production/looks.js` drops Neutral's own skin sentences, which the floor now covers better, rather than compiling the same instruction twice.
- Delta from this commit, ADR 0018 the protected object is photographed rather than pasted. The first render with a real locked asset returned the product correctly reproduced and sitting on the scene as an overlay: its own exposure, its own contrast, sharper and cleaner than everything around it, with no contact shadow or color spill. Cause verified in the compiled prompt: the preservation sentence read "preserve the supplied package exactly as pictured: logo, label hierarchy, typography, colors, proportions, silhouette, and open or closed state unchanged, fully readable", and the integration line arrived afterward. Colors unchanged and fully readable are absolutes, and the 2026-08-17 audit established that a strong early positive defeats a later qualifier, so the prompt asked for an overlay and then requested integration. `src/production/prompt-craft.js` now splits the authority explicitly: the reference governs artwork and geometry, meaning logo, wordmark, typography, label hierarchy, the relationships between its colors, proportions, and silhouette, with nothing redrawn or reinterpreted; and the scene governs light, meaning exposure, brightness, contrast, and speculars come from the frame, the object is lit by the same source as everything else, the side turned away falls into shadow by the same amount as any other surface at that distance, it picks up color from what is next to it, it casts a contact shadow, and it carries the same focus, grain, and tonal response as the rest of the picture rather than being sharper or cleaner. A third sentence resolves the readability conflict the old wording created: the wordmark stays identifiable but does not have to be evenly lit or fully legible across its whole surface, and part of it falling into shadow is correct rather than a fault. The separate integration line is reduced to placement, since its lighting content now lives in the preservation sentences where it can no longer be outranked.
- Delta from this commit, ADR 0018 scene suggestion regression fix. The world rules added in the previous commit refer to the world field six times, while the requested JSON shape names that key `brief` with the description "the world". The model followed the rules literally and emitted `world`, so every suggestion card rendered a heading with no body, and selecting one wrote an empty brief, cleared the panel, and returned the person to the generate button with nothing said. Three changes, at the source and behind it. `api/production/generate-copy.js` names the key in the shape instruction and states that there is no key named `world`; normalizes `world` to `brief` on parse rather than relying on the model to resolve our own naming inconsistency; and drops options with no body before responding. `app/app.js` disables a body-less card, labels it, and refuses to apply one, so the failure can never again present as a control that silently does nothing. Recorded as a fourth instance of the pattern in `docs/ui-contribution-guide.md`: a control that renders but cannot be operated. This one differs in origin, since the cause was a prompt change rather than markup, which is why the client guard exists as well as the fix.
- Delta from this commit, ADR 0018 the world becomes required content. The world block shipped in the previous commit and did not reach the render: MycoPop's grammar carries strong ambition entries naming boxy screens, square buttons, laminate desks, smoked glass, tiled panels, and screen light in restricted color pairs, and a test render carried none of it. Diagnosis: the grammar reached the scene writer as context, and context describes where rules oblige, so the writer treated the world as background reading and authored a consensus golden hour desk. Because the scene compiles first as the assignment, a consensus scene at position one outguns a world block at position three. Two changes. `api/production/generate-copy.js#handleSceneBrief` gains `worldRules`, compiled into the RULES block ahead of the look rules, stating that the world is required content, that the setting is built from the named places and materials, that at least two named objects appear in the props field with one of them doing something in the world field, that people cues carry into the person, that the sources named under light are the sources in the scene, and that a declared ambition belongs in the frame at full strength and is not to be softened or reduced to one small prop. The look and world seam is stated in the rules rather than left implied: the world decides what is in the frame and which sources are present and what color they emit, the look decides how it was photographed and how those sources render. `src/production/package.js#worldDirection` gains a lead sentence so the compiled block reads as content rather than as description. This does not touch look governance, ambition frequency, or the hedged wording inside the grammar's own ambition statements, which is a client question and is deliberately out of scope.
- Delta from this commit, ADR 0018 the world reaches the prompt. Verified before the change: `visualGrammar` appeared nowhere in `src/production/package.js` or `src/production/service.js`, so the artifact ADR 0016 built to carry a brand's visual world, including declared ambitions, reached only the scene writer and never the compiled image prompt. Across more than twenty renders the brand world arrived thinly or not at all, which is the exact failure ADR 0016 exists to prevent. `package.js` gains `worldDirection`, which compiles the grammar's five descriptive sections into a section titled The world this brand lives in, placed third, immediately after Capture, on the same reasoning that placed Capture second. Ambition entries compile at full strength and carry a sentence naming them as a direction the brand is reaching for, per ADR 0016; origin never dampens the direction. Templates and sales elements are excluded, since a world of people and places has nothing to say to a gradient. Authority against the look, owner delegated: the look owns light quality, meaning contrast, falloff, grain, and tonal response, and the grammar owns light content, meaning source, color, and time of day; grammar camera entries stay at settings level and never describe character. Three subtractions pay for it. The dossier materials line stops when the world compiles, because a global material vocabulary beside scene-bound facts is where the unexplained wet and glossy surfaces in the 2026-08-17 audit came from. Palette entries compile as name, first clause of role, and hex, dropping the authored provenance prose written for a person reading the brain rather than for a renderer. And the world and creative guidance summaries stop when the grammar is present, mirroring the ADR 0016 step 4 ruling that already displaces the identity, creative, and materials lines in the scene writer for the same reason; foundation, identity, and rules stay, since they carry positioning and governance rather than visual content. Net effect on a grammar brain is roughly 250 fewer words with the world now present. A brain without the grammar keeps every previous section and only loses the palette provenance.
- Delta from this commit, ADR 0018 look library consolidation, by owner ruling of 2026-08-18. `src/production/looks.js` removes `clean_digital` and renames `lit_location_portrait` to `neutral` with the label Neutral; `app/app.js` removes the No look card, makes Neutral the first card, and sets the brief default to `neutral`. The library is now fourteen looks, all of which are looks. Reason: Neutral beat clean digital on both comparisons, an interior with a hard source and an exterior with none, and two entries whose only difference is that one is weaker is a worse option sitting on the menu rather than a spectrum. The strobe language in Neutral was tested against the concern that it would demand equipment in a found-light scene; on the forest exterior it produced dappled sun with correct falloff rather than inventing a light stand, so it reads as a description of light behavior rather than of gear. `CAPTURE_CHARACTER` stays in `prompt-craft.js` as the fallback when a job carries no look, which is now reachable only through the API or a brief predating this change, not through the interface. Naming follows the interface-language rule: Neutral is what a marketer would say, where lit on location described a production method.
- Delta from this commit, ADR 0018 lit on location, from the owner's high end portraiture references of 2026-08-18. `src/production/looks.js` adds `lit_location_portrait`, and three of its clauses are folded into `clean_digital` because the same absences are what make any clean frame read as generated. The three: the light has a position in the room, not only on the face, so nearby surfaces are exposed, surfaces a few feet on are darker, and one side of the room goes nearly black, with the background two to three stops under the subject by distance from the light rather than by blur; the person carries age and asymmetry, meaning lines, uneven grey, weathered skin, visible veins and tendons, and hair, collar, lapel, and cuff each sitting differently left and right; and the room is not tidied, so an outlet, a cable along the baseboard, or worn carpet stays where it is. The look also names per material specular response rather than generic texture, and a long lens so nothing widens at the edges. It fills a gap the library had: every professional entry assumed natural light, and no entry covered a photograph that is deliberately lit and still in a real place, which is what most commercial portraiture is. `app/app.js` adds the picker entry and drops "visual clutter" from the default exclusions, which directly contradicted the untidiness clause and would have compiled as a conflict. Recorded because the default exclusions had been unexamined since before the look library existed.
- Delta from this commit, ADR 0018 clean digital replaces studio seamless: `src/production/looks.js` drops `studio_seamless_flash` and adds `clean_digital`, and `app/app.js` swaps the picker entry. Studio seamless failed twice, most recently after the precedence fix, returning a co-working space when it required a studio with no room, window, furniture, or location in frame. The cause is structural rather than wording: the compiled prompt is built to place a product in a lived setting, so a paragraph asking for seamless paper argues with the assignment line, the protection block, and the scene writer's earned environments, and loses. Recorded in `docs/deferred-work.md` along with what a studio path would actually require. `clean_digital` answers the B2B request for something clean and professional without a studio and without a color personality: it carries no era, no stock, and no palette, so it never reads as a filter, and it defeats the generated look by restoring optical consequence rather than by adding character. Its clauses name a legible key direction with a shadow side one to two stops down, real depth falloff, skin texture and sheen, clipped speculars, unlifted shadows with luminance noise only in them, corner falloff, fringing on out of focus high contrast edges, one white balance so a second source stays its own color, and a palette that is whatever the scene contains. No compile path change.
- Delta from this commit, ADR 0018 look precedence and signature rewrite, from the owner's fifteen look render grid of 2026-08-18. Two changes, from one diagnosis. **Precedence.** Every look in `src/production/looks.js` gains an `environment` field of `agnostic` or `binding`, and binding looks gain `requires` naming the condition the medium needs. `api/production/generate-copy.js#handleSceneBrief` moves the look from the user prompt into the system RULES block ahead of the kind rules, and the earned-environments rule is narrowed to say that when a look requires a condition, the writer chooses among the earned environments that can provide it rather than treating the most familiar one as fixed. This repairs a precedence failure visible in three renders: studio seamless returned a living room, overcast daylight editorial returned a dark interior, and daylight street documentary returned a night campfire, because the earned-environments rule sat in the system prompt and the look sat under it in the user prompt. The redundant user prompt copy is removed so the instruction is not sent twice. **Signatures.** Four looks whose renders under-delivered are rewritten from gradual descriptions into binary tells: pushed black and white now states that grain reads as distinct visible specks and that hair and fabric do not resolve, after returning polished and grain free; bleach bypass now states that the frame reads as black and white at first glance with only a single strong red holding hue; anamorphic now requires both artifacts by name, tall vertical oval highlights and one horizontal streak of flare crossing the frame; and color slide now states that anything bright clips to blank paper white and every shadow falls to near black with almost nothing between. No compile path change; `package.js` reads the look exactly as before.
- Delta from this commit, ADR 0018 look grid width: the look field carried `studio-setup-field` without `field full`, so `grid-column: 1 / -1` never applied and the picker rendered in one column of the two column form grid with empty space beside it. `app/app.js` matches the classes its sibling fields use; `app/polish.css` restores card padding and label size now that the row has full width. Recorded in `docs/ui-contribution-guide.md` as the third same-day instance of the same shape.
- Delta from this commit, ADR 0018 look grid fixes: the grid's `look-select` action was registered in the `change` listener while the cards are buttons that fire `click`, so no card was selectable and the picker was stuck on its default. The handler moves to the `click` listener in `app/app.js`, reads the id from the `data-action` element's dataset, and clears scene suggestions on a change, because the scene writer is now briefed with the look and directions drafted under the previous one describe a photograph the new medium would not make. `app/polish.css` sets the grid to four fixed columns, two below 640px, with tighter card padding and type so four per row stay legible. The lesson is recorded in `docs/ui-contribution-guide.md` as the second same-day instance of a control that rendered but could not be operated.
- Delta from this commit, ADR 0018 looks become user facing: per the owner ruling of 2026-08-18 amending ADR 0018 Decision 1, `app/app.js` replaces the Look select with a grid of tone cards and moves it above `sceneSuggestField` on all four studio setup screens, so the medium is chosen before the scene is written. The selected look id now travels on the `scene_brief` request, and `api/production/generate-copy.js#handleSceneBrief` resolves it through `resolveLook` and appends the look's line to the user prompt with an instruction to write the world, composition, lighting, and props for that medium and not to restate the medium itself, since capture character compiles separately and repeating it would send the same instruction twice. This is the ordering fix, not a cosmetic one: a look and a scene can contradict each other, and choosing the medium first removes the conflict instead of asking the compiler to arbitrate two authored intents at the end. `app/polish.css` gains the look grid styles on existing tokens. The compile path is unchanged; `package.js` still reads `brief.look` exactly as before.
- Delta from this commit, ADR 0018 look library expansion: `src/production/looks.js` grows from six looks to fourteen, and the `app/app.js` picker is reordered to run from the cleanest options to the most extreme rather than in authoring order. The eight added are studio seamless with direct strobe, overcast daylight editorial, anamorphic widescreen film, bleach bypass, flash on a night street, pushed black and white reportage, saturated daylight outdoors, and daylight street documentary. Two of them fill a slot the first six did not cover: a look that is commercially professional without reading as generated. The distinction they encode is that clean is not the problem and clean with no medium behind it is, so the seamless look states its catchlight position, its shadow edge, its backdrop falloff, and skin texture surviving because the light is soft rather than because it was retouched, while the overcast look states a single overhead source, low contrast held entirely in the midtones, and cool slightly desaturated color. Same discipline as the first six: visible consequences only, and each look ends by naming what its medium cannot do, which is what separates a medium from a mood. Source: the owner's reference collage of 2026-08-18 and the confirmed noir and drugstore flash renders that proved look language reaches the render.
- Delta from this commit, ADR 0018 look field placement fix: the Look select shipped only on `renderBrief`, the legacy production screen, while real use runs through the Design Studio, so the control was unreachable. `app/app.js` gains `studioLookField` and renders it on all four studio setup screens, social, website, sales, and template. Recorded rather than smoothed over because the failure shape is the one the UI contribution guide already names: a control added to the screen the author was reading rather than the screen the user is on.
- Delta from this commit, ADR 0018 phase 1 look library: `src/production/looks.js` is new and holds six looks as code, per ADR 0018 Decision 2 that the library is code. Each is a photographic medium at a moment in time compiled as one paragraph of visible consequences, and each ends by stating what the medium cannot do, which is what separates a medium from a mood. `src/production/package.js` takes a `look` option and the Capture section compiles the selected look in place of the shared floor rather than stacking both, since two finish descriptions in one prompt is the conflict shape this work removes. `src/production/service.js` reads the look from `body.brief.look`, so it travels with the brief through preflight and generate with no new request field and is recorded on the package. `app/app.js` gains a Look select on the brief screen and a `look` field on brief state. The select is a test affordance for learning whether look language reaches the render at all, not the product picker; ADR 0018 Decision 1 makes any user-facing look choice contingent on looks proving themselves headless first, and that ruling stands. Nothing selects a look automatically and the default remains the shared capture floor.
- Delta from this commit, ADR 0018 phase 1 capture character: `src/production/prompt-craft.js` exports a new `CAPTURE_CHARACTER` constant and `src/production/package.js` compiles it as a `Capture` section positioned second, immediately after Assignment, excluded for template surfaces and sales elements because neither is a photograph. This closes a gap present since the pipeline was written: every compiled prompt described content and none described finish, so the renderer supplied its own finish, which is the quality that reads as generated regardless of the scene beneath it. The block states grain by zone, clipped speculars and blocked shadows, one sharp plane with progressive falloff and motion softness, skin and fabric texture, corner falloff and edge fringing, and imperfect white balance, all as visible consequences rather than settings or mood, per the audit's reverse-engineering result. Position is deliberate: the audit found early instructions defeat later ones. The four `AESTHETIC_MODES` opening lines are also stripped of their finish claims; the cinematic mode opened every prompt for both real clients with a request for a cinematic campaign-film still with depth and atmosphere, which is a direct order for the polished commercial look the work is trying to escape. The modes now state register only, and finish belongs to the capture block. Adds roughly 200 words per prompt, which is an addition inside a subtraction phase and is recorded as such: it buys the one attribute no amount of scene direction reaches.
- Delta from this commit, ADR 0018 phase 1 scene writer, second pass: three more instruction levers in the `scene` kind, from reading the first render after the rewrite. Lighting was obeyed on that render and composition and expression were not, so those two are hardened and background population is added ahead of the MycoPop test. The crop event becomes required rather than encouraged, off center subject placement is stated as its own rule, and the placement craft guidance is explicitly scoped to cropping and text space rather than subject placement, because the card craft direction says to center the subject and was winning against the scene rule. Expression now requires a stated mouth position and a stated eye direction per person, with the default named as closed and unsmiling for a person alone with a task, because prohibiting mood words alone still returned the pleasant half smile. Background population requires an exact count with per person distance, facing, and at least one occlusion, which is the correction the external audit's own v3 test proved against the procession failure. Instruction text only; no branch or response shape moves.
- Delta from this commit, ADR 0018 phase 1 scene writer: `api/production/generate-copy.js#handleSceneBrief` rewrites the `scene` kind rules into the physical register and adds one shared register rule to every kind. Behavior change is instruction text only; no branch, no context assembly, and no response shape moves, so the grammar path and the legacy path are both unaffected structurally. Substance: each subject performs one action and simultaneous actions are named as unphotographable; expression is stated as eye direction, mouth, and hands rather than as mood; depth is stated as one sharp plane plus what loses acuity, replacing the eye-travel ranking that compiled as narrative and rendered as uniform sharpness; one crop event is required by name and edge; lighting names one source with its position relative to camera, the surfaces that catch it, what stays in shadow, and whether anything fills, with uniform framewide light and universal rim light both named as the same failure; props carry a state and the cause of that state; and the brand's material vocabulary is barred from scenes it does not appear in. Source: ADR 0018 and the four baseline renders in `docs/evaluations/2026-08-17-adr-0018-phase0-baseline.md`, where the golden coating was traced to the lighting field requesting consistent light across the frame. Stage 6 below is unchanged in structure.
- Delta from this commit, ADR 0018 phase 0 harness: `fixtures/adr-0018-phase0-capture.mjs` gains `--baseline` and `--briefs`. The baseline comparison reports any section other than Assignment that moved between two captures, and separately reports whether `neutralizeStateLanguage` or `neutralizeScreenOrientation` rewrote the scene's own words, since those edits land inside Assignment where a section comparison cannot see them. Recorded because it establishes what a scene writer test may and may not attribute. Verified during construction: `screenContentAbstracted` is computed and carried in package metadata but changes no section text, so a scene gaining a screen keyword does not move the prompt.
- Delta from this commit, ADR 0016 step 4: `api/production/generate-copy.js#handleSceneBrief` briefs the scene writer from the visual grammar's five descriptive sections when the approved brain carries the artifact, displacing the `IDENTITY:`, `CREATIVE DIRECTION:`, and `MATERIALS AND LIGHT:` lines. Per client on artifact presence; a brain without the artifact assembles byte-identical context, proved by `fixtures/adr-0016-step4-parity.mjs`. Grammar rejects are not sent, per ADR 0017. The response carries `grammarEntries` so the entries that fed the writer can be recorded downstream. Stage 6 below is rewritten and ambient state 8 is retired.
- Prior delta, ADR 0017 step 4: `src/production/package.js#rejectsDirection` takes a second argument and compiles the client's accepted protections as avoid-clauses when at least one exists, falling back to `livedWorld.rejects` otherwise; `compileBrandWorldImagePackage` gains a `refusals` option defaulting to null; `src/production/service.js#prepareProductionPackage` reads the protections document once and passes the accepted entries, mirroring how `claimsSet` is assembled; `api/production/preflight.js` and `api/production/generate.js` inject the store. **The switch is on at least one accepted entry, not on the document existing**, per the ADR 0017 amendment of 2026-08-17, so a transition never dips protection. Parity is proved rather than asserted by `fixtures/adr-0017-step4-parity.mjs` against a pinned copy of the prior compiler.
- Prior delta: documentation only. The ADR 0017 step 3 blob path is confirmed by its first real write and ambient state 16 is amended to say so. No module changed.
- Prior delta: two fixes to the ADR 0017 step 3 surface, neither touching the compile path. `src/refusals/bootstrap.js` replaces `bootstrapSlateFor` with `resolveBootstrapSlate`, which matches a slate key against a real client id by slug plus hyphen boundary, because ids are built as `slugify(name)-shortId` in `clients/store.js#create` and the bare keys matched no real client. `api/brand-brain/index.js` uses that one resolver for both the availability check and the seed. `app/app.js` gives the protections block a `loadedForClient` stamp, a reset before the fetch, and a discard of responses arriving after the active client changed. The lesson is recorded in `docs/ui-contribution-guide.md` as the third instance of its failure shape.
- Delta from this commit, ADR 0017 step 3 bootstrap: `src/refusals/bootstrap.js` is new and holds the two prepared slates; `src/refusals/store.js` gains a guarded `seed` operation and now distinguishes a missing protections document from an unreadable one rather than returning empty for both; `api/brand-brain/index.js` gains three actions, `read_refusals`, `rule_refusal`, and `seed_refusals`, with no new function file; `app/app.js` gains the protections block on the brain review screen with all four presence states. The compile path is unchanged: `package.js#rejectsDirection` still reads `livedWorld.rejects`. Ambient state 16 is rewritten to describe what now exists.
- Delta from this commit: `src/refusals/store.js` is new, the ADR 0017 step 1 store. Nothing calls it. It is listed here in the same commit that creates it, per the maintenance rule, and its unconsumed state is recorded as ambient state 16. No compile-path behavior changes and no existing module changed.
- Prior delta, from the commit that landed the schema: `src/brand-brain/schema.js` gained the `visualGrammar` artifact, the `ambition` origin, a `grammar` reader id, and per-property `description` guidance; `src/brand-brain/chat-completions-provider.js` gained one Lived World sentence fencing `ambition` off until step 3. Stage 1's transformation 5 describes the resulting state.
- Standing delta from `381d3b7`: that commit deleted `src/production/package.js#compileProductSection` and its comment (L334 to L361), retiring known ambient state 4. Every `package.js` anchor below L334 in this document reads 28 lines high against head; anchors in every other module were unchanged at that point. Re-anchoring is outstanding work, stated here rather than left silent.
- Spec: `docs/image-pipeline-contract-spec.md` (the prep artifact defining the template, the twelve stages, and the acceptance test)
- Line anchors below are line numbers in the named file at the verified commit. Every claim is Verified by reading the code at that commit unless labeled Reasoned or Assumed inline.

## What this document is

One authoritative account of everything the system does when making an image. Every stage answers the same eight fields: trigger, inputs, owner, transformations, outputs and artifacts, invariants, failure states, consumers. "None" is an answer; silence is not. The ADRs explain why the machinery exists; this document states what the code does at the commit named above. Where the two disagree, the disagreement is recorded in Known ambient states, never silently reconciled.

## Maintenance rule

Any commit that changes a module listed in the contract updates the contract in the same commit, or states in the commit message why no update is needed. The contract header's verified-against commit moves with every update. A contract more than ten commits behind the modules it covers is stale and must say so in its header until re-verified. This joins the shrink check as the second mechanical ritual of the push workflow.

---

## Stage 1: Brain synthesis and approval

### Trigger

Synthesis: a POST to `/api/brand-brain/synthesize` (`api/brand-brain/synthesize.js#handler`, L5), fired by the brain build journey in the interface. `body.mode === "incremental"` selects the incremental update path; anything else is a first synthesis.

Approval is a separate act and never a model call: the `approve-brain-artifact` action handler in `app/app.js` (L9180 to L9184) sets `artifactStatus` to `ready` and copies the current synthesis result into `state.brain.approvedResult`, and the whole brain snapshot is persisted through POST `/api/brand-brain/save` (`api/brand-brain/save.js#handler`, calling `src/brand-brain/service.js#saveBrandBrainSnapshot`, L21 to L25). The server performs no validation of the approval itself; it saves the snapshot it is sent.

### Inputs

Request body (`src/brand-brain/service.js#synthesizeBrandBrain`, L27 to L96):

- `sources`: at least one required (L31 to L35). Each carries name, type, `declaredType`, `authority` (`exact-asset`, `approved-guidance`, or evidence), `role`, `influence`, `usage`, `exclusions`, `provenance` (`ours` or `emulate`, default ours), `aspiration` (`current` or `aspiration`, default current), optional `url`, optional `content`, and `files` (data URLs or Blob pathnames). A `single-source-v1` source may carry at most one file (L36 to L40). Total uploaded bytes across the request are capped at 40 MB (L41 to L49); the endpoint's body limit is 45 MB (`api/brand-brain/synthesize.js` L14); each individual file is capped at 20 MB (`src/brand-brain/source-normalizer.js#MAX_SOURCE_FILE_BYTES`, L4, enforced L68 to L72 and L88 to L92).
- `mode`, `baselineVersion`, `requestId`.

From storage on incremental: the stored brain state, from which `#selectApprovedBaseline` (L12 to L14) resolves the approved baseline. Note the fallback: when no `approvedResult` exists but `brain.artifactStatus === "ready"`, the raw `result` counts as the approved baseline.

Environment: `OPENAI_API_KEY`; `OPENAI_MODEL`, defaulting to `gpt-5.6` (`src/brand-brain/chat-completions-provider.js#DEFAULT_BRAND_BRAIN_MODEL`, L3).

### Owner

`src/brand-brain/service.js#synthesizeBrandBrain` (L27). The model call is `src/brand-brain/chat-completions-provider.js#synthesizeWithChatCompletions` (L193), request construction `#buildSynthesisRequest` (L75), stream collection `#collectChatCompletionStream` (L171), parsing `#parseSynthesisCompletion` (L142). URL enrichment is `src/brand-brain/source-reader.js#enrichUrlSources` (L226); file normalization is `src/brand-brain/source-normalizer.js#normalizeSourcesForSynthesis` (L123). Persistence is `src/brand-brain/store.js#createVercelBlobBrandBrainStore` (L48).

### Transformations

In order:

1. **URL enrichment** (`source-reader.js#enrichUrlSources`, L226 to L234): each URL source's page is fetched and its text appended to the source content. `#assertSafeRemoteUrl` (L19 to L32) blocks non-http(s), localhost, `.local`, and any hostname resolving to a private address. `#readRemotePage` (L145 to L173) retries up to three times with exponential backoff on transient failures; `#readRemotePageOnce` (L175 to L226) follows up to eight redirects including meta-refresh, sends browser-like headers, caps pages at 2 MB, strips HTML to text capped at 120,000 characters, and throws named errors on bot-challenge pages (`#looksLikeChallenge`, L94 to L97) and near-empty shells (`#looksLikeThinContent`, L99 to L104). On rendering-shaped failures, `#readWithFirecrawl` (L114 to L143) is tried when `FIRECRAWL_API_KEY` is set.
2. **File normalization** (`source-normalizer.js#normalizeUploadedFile`, L67 to L121): raster images (gif, jpeg, png, webp) become vision entries; direct text types are decoded; docx, pdf, pptx, and rtf go through officeparser text extraction capped at 160,000 characters (`#extractPortableDocument`, L36 to L55); legacy `.doc` and `.ppt` are rejected with a conversion message. An `exact-asset` source's non-raster files are never content-interpreted: they pass through as metadata with a preservation note (L75 to L84 and L98 to L106). Extracted text is folded into `source.content` (L123 to L134).
3. **Incremental merge** (`service.js#mergeIncrementalSources`, L16 to L19): incoming sources replace stored sources with the same id; the union persists.
4. **Request construction** (`chat-completions-provider.js#buildSynthesisRequest`, L75 to L133): a developer message carries `SYSTEM_INSTRUCTIONS` (L5 to L52), which state the authority rules (protected assets never reinterpreted; approved guidance governs; evidence never silently becomes guidance; emulate provenance is reference, not evidence; aspiration is declared direction, never fact; influence is creative priority, not a blend percentage, L12, which is its only definition, with no rule mapping influence levels to synthesis behavior); the writing rules (trace claims to named sources, review question over gap-filling, all six guidance sections exactly once); the Lived World subject anchor and inference rules (the person the brand serves, two-layer inference from category then brand facts, every `patterns`, `environments`, and `social` entry carrying a `basis` object, ADR 0015 steps 1 and 2); the visual grammar rules (source reach beyond the guidance sections into source usage instructions and dossier fields; the ambition rule, which makes an entry ambition when its source is anything other than provenance ours with aspiration current, and nothing else; substitution into the brand's own physical version with original forms; camera entries as settings with mood adjectives banned outright by name and genre register words permitted only where the same sentence states the settings they resolve to; honesty over quantity, where a thin section is correct output when the sources are thin; no persona, segment, or audience language in any grammar section; and, added in the step 3 cycle 2 revision, the source of the rejects section, which makes the approved guardrails and stated prohibitions the primary ground for refusals, requires a rule in the brand's guidance to surface as something a camera can act on, names brand kits and canonical identity assets as the ground for identity-reconstruction rejects, requires a second reject against a borrowed territory arriving as a graphic overlay rather than as physical objects and light, and fixes rejects at an origin of evidence or inference and never ambition, because a reject is a rule in force today rather than a fact or a declared aim); and the review-question language rules. The user message carries either the first-synthesis source register or the incremental text with the full approved baseline JSON and the new register (L79 to L97), plus every raster file as an `image_url` at high detail (L105 to L113). The response format is strict structured output against `brandBrainSchema` (L124 to L131).
5. **Schema enforcement** (`src/brand-brain/schema.js`): the strict schema requires exactly six guidance sections, zero to eight review questions, and exactly four artifacts (`dossier`, `livedWorld`, `storyArchitecture`, `visualGrammar`). Lived World arrays carry floors the model must fill: `wants` 3 to 6, `rejects` 3 to 6, `tensions` 3 to 6, `patterns` 3 to 6, `social` 2 to 4, `environments` 3 to 6. `basis.origin` is an enum of `evidence`, `inference`, and `ambition`; the third value landed with ADR 0016 step 2 and is shared across every artifact that carries `basis`. Guardrails are 3 to 6 title/body pairs.

   **`visualGrammar` shape (ADR 0016 step 2).** Peer top-level fields `description`, `sourceCount`, and `categories`, matching what the artifact reader's header renders, plus `sections` holding the six camera-visible sections: `people`, `objects`, `places`, `light`, `camera`, `rejects`. Each section is an array of entries carrying `id`, `label`, `statement`, and `basis`. Bounds: `camera` 3 to 8, `light` 1 to 6, the other four 1 to 8. The floors are deliberately 1 outside `camera`, so a brand with one honest lighting statement is not forced by the validator to invent a second; under-filling is a synthesis-instruction problem for step 3 rather than a validator problem. `camera` keeps a floor of 3 because the step 1 evaluation found register adjectives riding alongside settings, and an underfed camera section is what produces them.

   **New convention: this schema carries field guidance in `description`.** Before ADR 0016 step 2, every instruction to the model lived in `SYSTEM_INSTRUCTIONS` and `schema.js` carried shape alone. The `visualGrammar` properties carry `description` text stating what each section and field means, including that camera entries are settings rather than adjectives and that `places` entries are not a copy of the Lived World environments. The rule is that a constraint belonging to the shape rather than to one prompt lives on the shape, so step 3's synthesis, the step 4 evaluation loop, and any later validator inherit it without restating it. Recorded here as a decision so it does not read later as drift. Guidance in the two places must agree; a change to one checks the other.
6. **Model call and parse**: streamed chat completion collected by `#collectChatCompletionStream` (L171 to L191); `#parseSynthesisCompletion` (L142 to L148) parses the JSON and throws unless all six section ids are present.
7. **Dry run and pre-destruction backup** (`service.js`): `body.dryRun === true` returns the computed snapshot with a `dryRun: true` marker and writes nothing, which is the only way to obtain a candidate without persisting one. Otherwise, when the synthesis is non-incremental and a stored payload exists, `store.writeBackup` writes it to `brand-world-system/clients/{clientId}/state/backups/brand-brain-backup-{timestamp}.json` with `allowOverwrite: false` before the main write proceeds. A failed backup throws 503 and the stored payload is left untouched, because destroying a brain to save a failed rebuild is the wrong trade.
8. **Persistence** (`service.js` L73 to L95): the snapshot is written to the brain store with file data stripped from sources (`#persistedSources`, L5 to L10). On incremental, the snapshot carries `approvedResult` (the baseline, unchanged), `baselineVersion`, and a `brain` block marking `stage: "review"` and `revisionPending: true`, so the new result is a candidate beside the still-active baseline.

### Outputs and artifacts

Returns the saved snapshot to the endpoint, which returns it to the interface. Persisted: the full brain state at `brand-world-system/clients/{clientId}/state/current.json` (`store.js#brainStatePathname`, L20 to L22, written L66 to L75), carrying `sources` (file bytes stripped), `result` (the candidate), `approvedResult` (the active baseline or null), `responseId`, `model`, `usage`, and the `brain` state block. Source files themselves live under `brand-world-system/clients/{clientId}/sources/` and are uploaded by the browser through `api/blob/upload.js`, which confines presigned puts and gets to the caller's own client namespace (L46 to L47).

### Invariants

- **Only supplied sources feed synthesis** (`SYSTEM_INSTRUCTIONS` L5). No web knowledge, no invented sources, approvals, quotes, or facts (L24). Source: the evidence discipline of ADR 0009 and ADR 0012.
- **Authority separation is stated in the prompt, enforced partly in code.** Exact-asset file contents are never text-extracted or handed to the model except as raster vision entries (`source-normalizer.js` L75 to L84); the rest of the authority model (evidence never becomes guidance, emulate is not evidence, aspiration is not fact) is prompt instruction on a strict schema, not code enforcement.
- **Incremental synthesis preserves the baseline.** The instructions require copying unaffected fields exactly and raising a review question instead of silently replacing on conflict (L82 to L87); the persisted snapshot keeps `approvedResult` untouched (service.js L78). Source: ADR 0009.
- **Schema floors override the review-question-over-gap instruction.** Structured output cannot return fewer entries than the minimums, so thin evidence produces inferred entries labeled with `basis` rather than gaps. Source: ADR 0015 context (verified there) and steps 1 and 2 (shipped).
- **Approval is a human act with no model in it.** `selectApprovedBaseline` is the single gate every production consumer reads (service.js L12 to L14). Its `artifactStatus === "ready"` fallback means a brain approved before the `approvedResult` field existed still compiles.
- **All state is client-namespaced** (store paths, L16 to L26; ADR 0011), with a legacy flat-path read-through for the default client only (L12 to L13, L61 to L64).

### Failure states

- 400: no sources; multiple files on a single-source-v1 source. 413: over 40 MB total, over 45 MB body, over 20 MB per file. 409: incremental with no approved baseline (service.js L54 to L58).
- URL reads throw named, user-facing errors: invalid URL, private network, bot challenge, thin content, too large, too many redirects, unreadable content type (source-reader.js).
- File normalization throws on undecodable files, legacy Office formats, and extraction failures, each naming the file.
- OpenAI non-2xx throws with the API's message and status (provider L203 to L208); a model refusal throws its text (L137); a response missing any of the six sections throws (L146).
- 503: a non-incremental synthesis whose pre-destruction backup failed. Nothing is written and the stored brain is unchanged.
- All surface through `sendPublicError`. There is no empty-success shape: synthesis either returns a full schema-valid brain or throws.

**Hazard, recorded here so the next reader of this stage meets it: a non-incremental synthesis destroys the approved brain rather than proposing a replacement.** An incremental synthesis writes the candidate as `result` and preserves `approvedResult` and the `brain` block. A non-incremental one writes `approvedResult: baseline` where `baseline` is null for that mode, and `brain: undefined`, so the approved brain, its version state, and its resolutions are replaced with nothing. The blob store writes with `allowOverwrite: true` and `addRandomSuffix: false` (`store.js`), so the previous payload is overwritten in place and the loss is permanent. The interface reaches this path through Rebuild, which sends `mode: "initial"`; a confirmation dialog stands in front of it, so this is one confirm click rather than a bare misclick. The timestamped backup in transformation 7 is the mitigation in place. The fix is candidate-not-erase and is recorded in `docs/deferred-work.md` as needing its own decision record.

### Consumers

- Stage 6 (`api/production/generate-copy.js` L24 to L27) and stage 7 via `service.js#approvedContext` consume the approved baseline.
- The copy path (`src/copy/generate.js#buildCopySystemPrompt`) consumes guidance sections and dossier guardrails.
- Stage 2 product synthesis reads the brain's stored sources to find the product brief (`api/products/index.js#handleSynthesize`, L126 to L131) and uses the brain store's `readSourceFile` for stored bytes.
- `api/brand-brain/index.js#handler` GET returns the saved state to the interface (L21 to L25); the same handler dispatches the claims document actions (stage 3).

---

## Stage 2: Product records

### Trigger

A POST to `/api/products` with `body.action === "synthesize"` and a `sourceId` naming a stored brain source (`api/products/index.js#handler` L53 to L56, `#handleSynthesize` L126 to L163). Fired from the product synthesis button on product-brief source rows in the interface. Approval is a second POST with `action === "approve"` (`#handleApprove`, L175). Other actions on the same handler: `read`, `delete`, `add_image`, `remove_image`, `defer_question`, `resolve_question` (dispatch at L51 to L119).

### Inputs

- The stored brain source matched by `sourceId` (L131). A miss returns 400 with the available source list (L132 to L143).
- Environment: `OPENAI_API_KEY`, `OPENAI_MODEL` defaulting to `gpt-5.6` (`src/products/service.js#DEFAULT_PRODUCT_MODEL`, L9).
- The existing product index, to detect re-synthesis: a product whose `provenance.source_ref` matches the source id is versioned up rather than duplicated (L240 to L263).

### Owner

`src/products/service.js#synthesizeAndPersistProduct` (L218). The model call is `#callSynthesis` (L184), request construction `#buildSynthesisRequest` (L125), reusing the brain's stream collector and text extractor. Record lifecycle owners: `#approveProduct` (L364), `#resolveReviewQuestion` (L386), `#deferReviewQuestion` (L433), `#addProductImage` (L321), `#removeProductImage` (L351), `#deleteProductRecord` (L419). Storage is `src/products/store.js#createVercelBlobProductStore` (L49).

### Transformations

1. The source is URL-enriched and normalized exactly as brain sources are, reusing `enrichUrlSources` and `normalizeSourcesForSynthesis` (L229 to L233).
2. One model call against `SYNTHESIS_SCHEMA` (L17 to L102), strict structured output. The instructions (L106 to L123) require verbatim evidence quotes, verbatim `approved_claim_language` or an empty string ("Never compose new claim language", L110), honest `origin` marking (`stated` or `inferred`), conditional capability recorded in `accuracy_note`, review questions over gap-filling, and 2 to 4 suggested answers per question phrased for verbatim resolution.
3. Version resolution (L240 to L263): re-synthesis of an existing source bumps the version; a first synthesis mints a product id via `store.js#generateProductId` (L40 to L47).
4. The record is assembled with `schema_version "1.0.0"`, provenance pointing at the source, `synthesized_at`, and `approved_at: null` (L265 to L281). **Every synthesis produces a candidate; re-synthesis explicitly resets approval** (comment L276 to L278).
5. `writeProduct` persists the record at its own key and updates the index entry with status (`approved` or `candidate`) and open question count (`store.js` L94 to L120).

### Outputs and artifacts

Returns `{ record, contentLength, visionFiles, usage }` to the endpoint. Persisted: the record at `brand-world-system/clients/{clientId}/products/{productId}.json` and the index at `.../products/index.json` (`store.js` L7 to L17).

### Invariants

- **Production consumes approved records only.** Enforced at three doors: `service.js#resolveProduct` for image jobs (production service L142 to L159, 409), the copy endpoint's product resolution (`api/production/generate-copy.js` L30 to L40, 409), and re-synthesis clearing `approved_at` (L278). Source: ADR 0012.
- **Claim language is verbatim or absent** (instructions L109 to L110). The paraphrase risk on claim language is the highest-stakes failure in copy governance (ADR 0013), which is why the schema allows an empty string and the instruction forbids composition.
- **Images do not touch the approval gate.** Adding or removing a product image bumps nothing and resets nothing, because a picture is not a claim (comment L317 to L320). Review-question resolution and deferral likewise leave version and approval untouched (L382 to L385, L430 to L432).
- **Independent versioning.** One record changes without touching the brain or other records (ADR 0012; per-record keys in the store).
- **The record is bounded.** No inventory, pricing, or availability; the shape is the synthesis schema and nothing more (ADR 0012's stated PIM line).

### Failure states

- 400: unknown `sourceId` (with the available list), missing `productId` on read/approve, invalid image attachment, unknown question index, empty resolution note. 404: unknown product on read, approve, delete, image, and question actions. 409: consuming an unapproved record (raised by the consumers named above, not by this stage).
- Model-call failures throw with the API message and status (L197 to L205). All surface through `sendPublicError`. No empty-success shape exists; synthesis returns a schema-valid record or throws.

### Consumers

- Stage 5 claims assembly consumes `features[].approved_claim_language` and `exclusions` (`src/claims/assembly.js` L135 to L160).
- Stage 7 consumes the record through `compileProductSectionForImage` and the exclusions in the Protection section; `prepareProductionPackage` consumes product `images` as locked asset and references (production service L177 to L206).
- Stage 6 consumes name, one true thing, visual direction, exclusions (`generate-copy.js` L369 to L375).
- The copy path consumes name, one true thing, and features with claim language (`src/copy/generate.js` L70 to L78).
- `buildConsumptionRecord` and the interface's product screens read the record and index.

---

## Stage 3: Claims document

### Trigger

Claims actions dispatch through the brain endpoint: POST `/api/brand-brain` with `action` of `read_claims`, `add_claim`, `edit_claim`, or `remove_claim` (`api/brand-brain/index.js#handler`, L38 to L86), fired from the claims management interface. `run_audit_test` on the same handler runs the ADR 0013 mechanism test (L88 to L94). The document is human-authored only; nothing synthesizes into it.

### Inputs

For `add_claim` and `edit_claim`: `section` (`approved`, `prohibited`, or `disclosures`), `text` (required), `scope` (defaulting to `{ brand_wide: true }`), `source_ref`, `added_by`, and for disclosures `trigger_scope` (`src/claims/store.js#addEntry`, L77 to L104; `#editEntry`, L107 to L141). For `remove_claim`: `section` and `entryId`.

### Owner

`src/claims/store.js#createVercelBlobClaimsStore` (L37). One document per client at `brand-world-system/clients/{clientId}/claims.json` (L12 to L14).

### Transformations

- `addEntry` appends an entry with a generated id, `added_at`, and null supersession fields, then bumps the document version (L85 to L103).
- `editEntry` never mutates in place: the existing entry is marked `superseded_at` with a pointer to its replacement, the replacement is appended, and the version bumps (L107 to L141). The supersession chain is the audit trail ADR 0013 requires.
- `removeEntry` marks the entry superseded with no replacement (L144 to L158).
- A missing document reads as an empty one with version 1 (`#emptyDocument`, L26 to L35); the store never 404s on read.

### Outputs and artifacts

Each mutation returns the full document plus the affected entries. Persisted: the document, with `updated_at` refreshed on every persist (L54 to L67).

### Invariants

- **Human-authored, never synthesized** (module comment L3 to L10; no synthesis path writes to this store anywhere in `src/` or `api/`). Source: ADR 0013.
- **Nothing is ever deleted.** Every edit and removal is a supersession with a timestamp; consumers read only active entries through `#activeEntries` (L161 to L163), so history persists without governing.
- **The document versions independently** of the brain and product records (version bump on every mutation).
- **Three sections only.** Any other section name throws (L79 to L81). Directives are not a stored section: the directive split happens at assembly time (stage 5), never in this document.

### Failure states

- Throws on invalid section, empty text, and unknown entry id, each with the offending value named. Surfaced through the endpoint's `sendPublicError`. Reads cannot fail into an empty-vs-error ambiguity: a missing document is a well-formed empty document.

### Consumers

- Stage 5 assembly reads active entries per section (`assembly.js` L94 to L131).
- `listSegments` derives the client's segment list from scope declarations on active entries (`assembly.js` L49 to L62), served through the `segments` action on the copy endpoint (`generate-copy.js` L58 to L63).
- The claims management interface reads the document and active lists through `read_claims`.

---

## Stage 4: Job scope resolution

### Trigger

Never user-initiated and never an endpoint: `buildJobScope` is called wherever a job's context must be normalized for scope matching. Callers at the verified commit: claims assembly setup in `prepareProductionPackage` (production service L220 to L225), the copy endpoint's three claim-consuming actions (`generate-copy.js` L76 to L81, L106 to L111, L153 to L158), and `resolveTreatments` in the compiler (package.js L112).

### Inputs

`{ placement, productId, campaignId, segment }`, all optional (`src/scope/resolver.js#buildJobScope`, L80 to L98). Rules and claims bring their own scope declarations in one of two formats: the claims document's object format (`brand_wide`, `channel`, `placement`, `product_id`, `campaign_id`, `segment`) and the brain review question's array format of label/value pairs (module header, L8 to L19).

### Owner

`src/scope/resolver.js`: `#buildJobScope` (L80), `#objectScopeAppliesToJob` (L133), `#arrayScopeAppliesToJob` (L200), `#scopeAppliesToJob` (L256), the placement map `placementScopes` (L39 to L63).

### Transformations

- `buildJobScope` maps the placement string to a channel and platform through `placementScopes`; an unmapped placement sets `unknownPlacement: true` and logs a warning (L82 to L88), which under fail-closed matching excludes scoped approved claims rather than silently including them.
- `objectScopeAppliesToJob` checks each declared axis in turn: channel, placement (matching raw placement or mapped platform), product, campaign, segment (L133 to L185). `brand_wide` short-circuits to true (L134).
- `arrayScopeAppliesToJob` handles label/value entries with `all ...` wildcard values per axis (L200 to L241).
- The axis primitive returns true, false, or null-for-unresolvable (`#axisResult`, L106 to L110); the `unmatchedAxis` mode decides what null means (`#resolveNull`, L115 to L117).

### Outputs and artifacts

A boolean per rule per job, and the normalized job scope object. Persisted: none. Scope decisions leave their trace in what the assembled claims set and the treatments contain, not as their own record.

### Invariants

- **The fail direction is asymmetric and is this module's reason to exist.** `unmatchedAxis: "exclude"` (fail closed) governs approved claims and disclosures, so scoped safe-harbor language never leaks into a job that cannot evaluate the axis. `unmatchedAxis: "include"` (fail open) governs prohibited claims and brain review question rules, because over-blocking is the safe error (header, L21 to L33). Source: ADR 0013 revision of 2026-08-09. Any new scope axis must preserve this asymmetry; the segment axis (L178 to L182) is the worked example, with its silent fail-closed exclusion made visible by the preflight's withheld-for-segment report (stage 5).
- **One resolver for both paths.** Image treatments and copy claims share this module by design (header L3 to L6), so a scope semantics change cannot fork between them.

### Failure states

None of its own: the functions are pure and total over their inputs. An unrecognized placement is a logged warning plus the unmatched-axis posture, never a throw (L85 to L88). A malformed scope declaration matches nothing it cannot read and falls through to true only via the documented defaults.

### Consumers

Stage 5 assembly (both fail directions), stage 7 treatments (`arrayScopeAppliesToJob`, fail open default), and every claims-consuming action on the copy endpoint.

---

## Stage 5: Claims assembly

### Trigger

Called at compile-adjacent moments, never an endpoint of its own: `prepareProductionPackage` when the job declares copy outputs (production service L212 to L227); the copy endpoint's `copy_type`, `audit_copy`, and legacy LinkedIn actions (`generate-copy.js` L72 to L82, L100 to L112, L160 to L165).

### Inputs

`{ claimsDocument, product, activeEntries, jobScope }` (`src/claims/assembly.js#assembleClaimsSet`, L82). `activeEntries` is the claims store's filter; `product` is an approved record or null; `jobScope` comes from stage 4.

### Owner

`src/claims/assembly.js#assembleClaimsSet` (L82), with the directive classifier `#isDirective` (L64), the segment reporter `#withheldOnlyForSegment` (L34), and `#listSegments` (L49).

### Transformations

A union of two reads, in order, nothing paraphrased, merged, or reconciled (module header L3 to L10):

1. Brand document approved entries, scope-matched fail closed; entries dropped solely for a missing job segment are recorded in `withheldForSegment` so the exclusion is visible rather than silent (L94 to L111).
2. Brand document prohibited entries, scope-matched fail open (L112 to L121).
3. Brand document disclosures, matched on `trigger_scope`, fail closed (L122 to L131).
4. Product `approved_claim_language` per feature into approved with a product-scoped source string (L135 to L144).
5. Product `exclusions`, each classified by `isDirective`: a clearly imperative opening (L26 to L29) routes to `directives`; everything else, including anything ambiguous, stays on `prohibited` and gets audited, which costs noise rather than safety (comment L19 to L25, L145 to L160). Source: the ADR 0013 amendment of 2026-08-10.

### Outputs and artifacts

`{ approved, prohibited, disclosures, directives, withheldForSegment }` (L163). Persisted: nothing here. The set is recorded downstream in the compiled package's `governingClaims` (stage 7) and echoed in copy endpoint responses.

### Invariants

- **Derived, never stored.** No third claims catalog exists; the product record and the brand document each stay authoritative for their own scope, with no sync mechanism to fall out of date. Source: ADR 0013's central decision.
- **The fail-direction asymmetry is applied here** exactly as stage 4 defines it (`FAIL_CLOSED` and `FAIL_OPEN`, L71 to L72).
- **Directives never reach the claim auditor.** They steer generation through their own prompt section (`src/copy/generate.js` L96 to L99) and are excluded from the audited prohibited list, because a directive has no claim to match and hands the auditor a topic match. Source: ADR 0013 amendment, 2026-08-10.
- **The directive classifier fails toward auditing.** Ambiguous entries stay prohibited (comment L21 to L25), consistent with over-blocking as the safe error.

### Failure states

None of its own: pure function, total over inputs. A null document contributes nothing; a null product contributes nothing. The caller decides whether an empty set is a problem (the copy path reports `no_claims` as a distinct audit status, never a clean pass).

### Consumers

- Stage 7 records the set in the copy contract (`compileCopyContract`, package.js L641 to L669).
- Copy generation steers with all four lists (`src/copy/generate.js#buildCopySystemPrompt`, L80 to L99).
- The audit consumes approved and prohibited (`#auditProducedCopy`, L159 to L239); disclosures feed `checkDisclosurePresence`.
- The preflight copy panel renders the governing claims and the withheld-for-segment report (`app/app.js#copyPreflightPanel`, L5948 to L6001).

---

## Stage 6: Scene writing

### Trigger

A POST to `/api/production/generate-copy` with `body.action === "scene_brief"`. The dispatch is at `api/production/generate-copy.js#handler` (L46 to L49), which routes to `#handleSceneBrief` after the shared context load. In the interface, `app/app.js#suggestSceneBriefs` (L9728) sends the request when the user presses a suggest button in Design Studio setup (the `suggest-scene` action handler, `app/app.js` L8556 to L8559). Suggestion is user-initiated only; nothing fires this stage automatically.

### Inputs

From the request body, read by `#handleSceneBrief` and the handler above it:

- `kind`: one of `"scene"`, `"template_surface"`, `"sales_element"`. Any other value, or none, resolves to `scene` (L415).
- `placementLabel`, `placementRatio`, `placementCraft`: the output shape and its per-format composition advice, assembled client-side in `app/app.js#suggestSceneBriefs` (L9735 to L9748) from the studio's format presets.
- `hint`: the user's partial description, when they have started writing (L438). Absent, the user prompt asks for three directions the brand could credibly take.
- `campaign`: an object with `name`, `campaignIdea`, `messageTerritory`, `audience`, `objective`, sent by the interface when a campaign is selected (`app/app.js` L9757 to L9763), read at L331 and L365 to L368.
- `productId`: resolved by the handler before dispatch (L30 to L40). The record must exist and carry `approved_at`; an unapproved record throws with status 409.

From storage:

- The approved brain: `brainState.approvedResult` from the brand brain store (L24 to L27). No approved brain throws.
- `OPENAI_API_KEY` from the environment (L20 to L21).

What the writer receives from the approved brain, exactly (L336 to L375):

- `brandName` and `brandDescription` (L336).
- The `world`, `identity`, and `creative` guidance sections, each as summary plus all principles joined (L337 to L348). Identity principles are included as of commit `1a9357e`; see Known ambient states for the stale ADR 0016 claim on this point.
- `livedWorld.environments`: each entry's name and its `earned` justification (L349 to L353).
- `livedWorld.person` when present, as a string or a JSON slice capped at 600 characters (L354 to L357).
- `dossier.desiredFeeling`, `dossier.materials`, `dossier.palette` with name and role per color (L358 to L360).
- The `rules` section summary plus every `dossier.guardrails` entry as `title: body` (L361 to L364).
- From the product record when one is named: `product_name`, `one_true_thing`, `visual_direction`, and `exclusions` (L369 to L375).

What the writer does not receive: the `foundation` and `voice` guidance sections; `livedWorld.rejects`, `wants`, `tensions`, `patterns`, and `social`; `storyArchitecture`; product features, approved claim language, and proof points; guidance section prose paragraphs and `productionUse` notes.

### Owner

`api/production/generate-copy.js#handleSceneBrief` (L323 to L470), dispatched from `api/production/generate-copy.js#handler` (L46 to L49). The scene writer lives inside the copy endpoint because the serverless function count sits at the Vercel Hobby ceiling and the two paths share the same loaded context (comment at L42 to L54).

### Transformations

In order:

1. Context assembly: the brain, campaign, and product inputs above are flattened into labeled context lines. A parallel `drewOn` array records which sources contributed, for interface disclosure.

   **Two assemblies, branched on artifact presence (ADR 0016 step 4).**

   *Grammar path, taken when `brain.artifacts.visualGrammar.sections` exists.* Lines are `BRAND:`, `WORLD:`, the five grammar sections as `PEOPLE ON CAMERA:`, `OBJECTS AND ERA:`, `PLACES AND MATERIALS:`, `LIGHT:`, `CAMERA:`, then `EARNED ENVIRONMENTS:`, `PERSON AT THE CENTER:`, `DESIRED FEELING:`, `PALETTE:`, `RULES AND GUARDRAILS:`, `CAMPAIGN:`, `PRODUCT:`, `PRODUCT EXCLUSIONS:`. Three lines are displaced: `IDENTITY:` and `CREATIVE DIRECTION:`, because the grammar supersedes the summaries it replaces, and `MATERIALS AND LIGHT:`, because the grammar owns light and the dossier line duplicated it (step 1 finding, where on Dialog Health that line lists message threads and forms rather than light). An entry whose `basis.origin` is `ambition` compiles at full strength with the suffix `(declared ambition for this brand)`; origin never dampens direction. **The grammar's rejects section is not sent.** ADR 0017 made the governed refusals document the only refusal source for the image path and grammar rejects are never a compile source, so sending them here would restore a second, ungoverned refusal channel.

   *Legacy path, taken when the artifact is absent.* Exactly the assembly that predates step 4, including `IDENTITY:` with summary plus principles, which is the interim fix from `1a9357e`. That fix is superseded on the grammar path and retained here. Byte-identical output is proved rather than asserted by `fixtures/adr-0016-step4-parity.mjs`, which holds a copy of both assemblies and a drift tripwire asserting the live handler still matches its copy.

   The response carries `grammarEntries`, each with id, section, statement, and origin, so a job can record which grammar statements shaped its scene and an ambition label can persist beyond the prompt.
2. Kind selection (L379 to L415): each kind carries its own task line and rule list. The `scene` kind directs four separate authored fields (world, composition, lighting, props) with twelve rules covering camera behavior, spatial structure, eye-order ranking with the person first and the product never first or centered, one product unit, off-center composition, light behavior, worn props, three directions differing in world, and pursuit of a declared aesthetic ambition in one of the three (L380 to L395). `template_surface` directs reusable background surfaces with no subject (L396 to L404). `sales_element` directs one clean object with no invented interface copy (L405 to L413).
3. System prompt assembly (L417 to L433): task, context lines, the kind's rules, a structural prose rule (no em dashes, no fragment stacks, L424), a length rule (two to four sentences per field for scene, two or three per brief otherwise, L425 to L427), and a JSON-only output format that for `scene` names all four fields per option (L429 to L432).
4. User prompt assembly (L435 to L439): placement label and ratio, per-shape composition craft, and the hint or the default ask.
5. One model call to `https://api.openai.com/v1/chat/completions`, model `gpt-4o`, temperature 0.9, `max_tokens` 2200 for `scene` and 800 otherwise (L441 to L452).
6. Response parsing (L458 to L467): markdown fences stripped, JSON parsed, options sliced to at most three.

### Outputs and artifacts

Returns `{ options, drewOn, model: "gpt-4o" }` (L469). For the `scene` kind each option carries `label`, `brief` (the world), `composition`, `lighting`, and `props`; for the other kinds each option carries `label` and `brief` (L431 to L432).

Persisted: none. The output is job direction for a single image, never brand knowledge; nothing this stage writes is stored, and the user edits or discards it freely (comment at L42 to L45; the function contains no store writes).

### Invariants

- Suggestions compose only from the approved brain. The handler loads `approvedResult` and throws without it (L26); a candidate brain never feeds the writer. Source: the approval discipline of ADR 0009 and ADR 0002.
- An unapproved product record cannot feed the writer (L35 to L39, status 409). Source: ADR 0012's approval gate.
- Nothing is persisted. Scene suggestions are never a write path into the brain or any store (L42 to L45). Source: the ADR 0010 line that production feedback routes through candidate rules, never auto-writes.
- The stage dispatches through the existing handler rather than a new serverless function, because the deployment sits at the 12-function ceiling (L52 to L54). Source: ADR 0011 operating constraints as recorded in the handler comment.
- The structural prose rules (no em dashes, no fragment stacks) exist for this stage only as prompt instruction (L424). No deterministic check runs on scene brief output; `src/copy/prose-check.js` runs on produced copy blocks, not on scene briefs. Verified by absence: `handleSceneBrief` calls no check function on the parsed options.

### Failure states

- Missing API key: throws at L21 before any model call.
- No approved brain: throws at L26.
- Unknown product: throws at L34. Unapproved product: throws with status 409 (L36 to L39).
- Model call non-2xx: throws with the OpenAI status and the first 200 characters of the error body (L454 to L456).
- Unparseable response: throws "The suggestions came back in an unexpected shape. Try again." (L461 to L466).
- Zero options after parsing: throws "No suggestions came back. Try again." (L467), so an empty result is an error, never a silent empty success.

All of these are caught by `#handler` and sent through `sendPublicError` (L311 to L313). The interface surfaces the message in the suggestion panel error state (`app/app.js#sceneSuggestionPanel`, L4058 to L4060) and clears the options list (`app/app.js#suggestSceneBriefs` catch block, L9774 to L9776).

### Consumers

- `app/app.js#suggestSceneBriefs` (L9728 to L9781) stores the options in `state.studio.sceneSuggestions` and the disclosure list in `state.studio.sceneSuggestionsDrewOn`.
- `app/app.js#sceneSuggestionPanel` (L4056 to L4082) renders the option cards. It displays only `label` and `brief`; the composition, lighting, and props fields are not shown on the card. See Known ambient states.
- The `use-scene-suggestion` handler (`app/app.js` L8565 to L8581) applies all four fields on selection: `brief` into the active studio field, and `composition`, `lighting`, `props` into `state.brief.sceneComposition`, `state.brief.sceneLighting`, `state.brief.sceneProps`. Those three travel in the job brief and are consumed by stage 7 (`src/production/package.js` L373 to L375).

---

## Stage 7: Compilation

### Trigger

`src/production/service.js#prepareProductionPackage` (L161) calls `compileBrandWorldImagePackage` at L304 to L316. `prepareProductionPackage` is reached two ways:

1. `api/production/preflight.js#handler` (L7 to L26), when the user opens preflight. The compile runs before any spend so the user sees the package first.
2. `src/production/service.js#generateProductionImage` (L403), reached from `api/production/generate.js#handler` when the user confirms generation. The compile runs again inside the render invocation; the package the render uses is the one compiled in that invocation, not the one preflight showed.

### Inputs

Passed by `prepareProductionPackage` (service.js L304 to L316):

- `approvedBrain` and `brainVersion`: from `#approvedContext` (service.js L24 to L35), which selects the approved baseline via `src/brand-brain/service.js#selectApprovedBaseline` and throws 409 without one.
- `brief`: the request body's brief. The compiler validates and bounds it (package.js L369 to L381): `scene` required, at most 4,000 characters; `sceneComposition`, `sceneLighting`, `sceneProps` optional prose carried separately when the scene writer authored them (L373 to L375); `exclusions` at most 2,000; `placement` required, at most 120; `format` required, at most 120; `assetType` defaulting to `"scene"`; `bannerHeadline` at most 300; `bannerTextSide`.
- `references`: resolved by `service.js#resolveReferences` (L37 to L65): at most eight, each a stored source that is not `exact-asset` and not `approved-guidance`, with a raster file in Blob, a role from the allowed set, and an influence from Lead, Strong, Supporting, Light. When the job names a product, its `in_context` images join the references up to the cap of eight, with a fixed usage instruction (service.js L194 to L206).
- `lockedAsset`: resolved by `service.js#resolveLockedAsset` (L74 to L101) from an `exact-asset` source with a raster file. When no locked asset is chosen and the product record carries an `isolated` image, that image becomes the locked asset with `assetType: "product"` (service.js L177 to L193).
- `templateAsset`: resolved by `service.js#resolveTemplateAsset` (L108 to L135) from a source with `templateMeta.isTemplate` and a raster file.
- `campaign`: the request body's campaign object, passed through (service.js L311).
- `product`: resolved by `service.js#resolveProduct` (L142 to L159); must exist and carry `approved_at`, otherwise 400 or 409.
- `copyOutputs`: declared copy type ids, unknown ids dropped, capped at four (`service.js#resolveCopyOutputs`, L330 to L336).
- `claimsSet`: assembled by `src/claims/assembly.js#assembleClaimsSet` only when at least one copy output is declared and a claims store is available (service.js L212 to L227), scoped through `src/scope/resolver.js#buildJobScope` from the brief's placement, the product id, the campaign id, and the segment. The set carries `approved`, `prohibited`, `disclosures`, `directives`, and `withheldForSegment` (assembly.js L163). A job with no copy outputs does no claims work.
- `displayCopy`: built in `prepareProductionPackage` before the compile (service.js L238 to L302), only when `body.renderCopyIntoImage` is set, `copyOutputs` includes `headline_set`, and the API key exists. Copy drafted in setup arrives with the job and is used as sent, with the audit that traveled with it; when no draft arrives, `src/copy/generate.js#produceCopy` writes the block against display budgets from `src/copy/display-budget.js#displayBudgets`. The lines carried into the compile take their proportional design ratios from `#designFor` (service.js L294 to L296). A display copy failure sets `displayCopyError` and the job compiles without the block (service.js L299 to L301); a blocked image is the worse outcome, per the ADR 0014 revision of 2026-08-11.

### Owner

`src/production/package.js#compileBrandWorldImagePackage` (L362 to L627). Craft functions it calls live in `src/production/prompt-craft.js`: `#inferPackageFormat` (L41), `#inferScreenBearing` (L70), `#integrationSentence` (L93), `#protectionBlock` (L151), `#selectAestheticMode` (L313), `#openingLine` (L329), `#neutralizeStateLanguage` (L365), `#neutralizeScreenOrientation` (L407), `#auditConstraints` (L432), `#displayCopyBlock` (L267). The display copy zone comes from `src/copy/display-budget.js#getZone` (L114).

### Transformations

In order:

1. **Validation and bounding** (package.js L369 to L381): `requiredText` and `optionalText` (L256 to L279) throw 400 with a user-facing message on missing or over-length fields.
2. **Placement class and guidance order** (L383 to L387): `isTemplate` is `placement === "Brand template"`, `isSalesEnablement` is `placement === "Sales enablement"`. Those two compile from `templateGuidanceOrder` (`foundation`, `identity`, `rules`; L21); every other placement compiles from `guidanceOrder` (`foundation`, `identity`, `world`, `creative`, `rules`; L15). World and creative storytelling are deliberately withheld from template and sales jobs (comment at L17 to L20).
3. **Aesthetic mode** (L390 to L395): `selectAestheticMode` runs over the creative section rendered by `#sectionDirection` in its non-compact form, which includes summary, prose paragraphs, principles, and the production-use note (L287 to L297). The mode falls back to `cinematic_film_still` when no signal pattern matches (prompt-craft.js L313 to L323); the signal patterns cover only the other three modes (prompt-craft.js L245 to L249). `openingLine(mode, hasProduct)` strips the "not a tabletop product photo" clause when no locked asset is present (prompt-craft.js L329 to L333). Note the asymmetry: mode selection reads the full creative prose; the compiled guidance section uses the compact form (step 10 below).
4. **Format and screen inference** (L398 to L401): `packageFormat` from `inferPackageFormat(lockedAsset)`, keyword regexes over the asset's name, type, and file name with `"package"` as the fallback (prompt-craft.js L41 to L61). `screenBearing` is true only when the job is not a template job, not a sales enablement job, has no template asset, and the locked asset matches the screen-device regex (package.js L399; prompt-craft.js L70 to L82). This placement scoping is the seam where the template regression occurred; the exclusions are the fix. `sceneMentionsScreens` is a device-word regex over the scene (L400); `screenContentAbstracted` flags a scene that mentions screens without a screen-bearing locked asset (L401), a preflight disclosure, not a rewrite.
5. **State-lock neutralization** (L404 to L408): runs only when a locked asset is present. `neutralizeStateLanguage` rewrites open, unsealed, spilled, and tipped phrasing to closed and settled equivalents through eighteen fixed patterns (prompt-craft.js L340 to L358), returning the changed phrases, which the package records as `stateNeutralizations`.
6. **Screen orientation neutralization** (L409 to L413): runs only when `screenBearing` is true, so never on template or sales jobs and never when a template asset is present. `neutralizeScreenOrientation` rewrites mid-use phrasing (scrolling, typing, looking at, reading, using a device) to presentation poses through ten fixed patterns, participle forms kept participle and finite forms kept finite (prompt-craft.js L382 to L396). Changed phrases are recorded as `orientationAdjustments`.
7. **Protection block**: `protectionBlock({ lockedAsset, format, screenBearing, displayCopy })`. Three cases:
   - No locked asset: render only the authored environment, no invented focal object or identity mark, plus text safety and the screen content rule (L154 to L162).
   - Locked non-product asset: preserve identity, integrate through non-destructive light and depth only, plus text safety and the screen content rule; the three screen orientation lines (L145 to L149) are spliced in when screen-bearing (L170 to L181).
   - Locked product asset (matched by asset type regex at L165 to L167): format-noun preservation sentence; the one-readable-unit rule that turns any further unit of the product away from camera (L193); the closed-and-sealed state lock when the format is stateful (L195 to L199); screen orientation lines when screen-bearing (L200); the `integrationSentence` for physical grounding (L201, L93 to L101); text safety; the screen content rule (L202 to L203).
   - Text safety selection: `TEXT_SAFETY_WITH_DISPLAY_COPY` (permitting exactly the authored block, forbidding all other invented words) replaces the blanket `TEXT_SAFETY` when display copy is present (L152, L108 to L115).
   - Screen content rule selection: `SCREEN_CONTENT_RULE_WITH_ASSET` (the protected asset's own display shown exactly, every other screen abstract) when the locked asset is screen-bearing, otherwise `SCREEN_CONTENT_RULE` (every screen abstract, including a subject device) (L125 to L132). Case 1 always uses the no-asset rule (L158). Source: the ADR 0014 revision of 2026-08-11, screens are a governed surface.
8. **Campaign, continuity, and composition sections** (L434 to L479): the campaign direction section compiles when `campaign.campaignIdea` exists; campaign continuity compiles per prior output with one of five role instructions, defaulting to reference-only (L426 to L459); the composition section compiles for `assetType === "banner"` (quiet-third instruction from `bannerTextSide`, and when `bannerHeadline` exists an instruction that the headline is overlaid by layout and no text is rendered, L468 to L475) or `assetType === "product"` (the supplied product image is the subject, L476 to L479).
9. **Section assembly** (L481 to L559), in this exact order, empty sections dropped (L559): Assignment (opening line plus scene for standard jobs, with composition, lighting, and props appended as labeled sentences when authored, L488 to L494; template and sales jobs get their own assignment line and no opening line, L484 to L487); Brand foundation (`brandOpener`, L242 to L249, plus dossier read body or synthesis summary); Product knowledge (image variant only: name, one true thing, visual direction; claim language and features deliberately excluded from image prompts, `#compileProductSectionForImage` L313 to L322); the guidance sections in the active order, each compiled compact as summary plus bare principles (`#sectionDirection` with `compact: true`, L287 to L297, L504); template production instructions or sales element instructions when applicable (L505 to L506, L23 to L63); campaign direction; campaign continuity; banner or product composition; Audience and feeling (dossier audience and desired feeling, withheld from template and sales jobs, L510 to L513); Visual materials (palette always, materials withheld from template and sales jobs, L514 to L520); What this brand is not (`#rejectsDirection`, L303 to L308, compiling `livedWorld.rejects` as avoid-clauses, withheld from template and sales jobs, L521 to L524); Creative references (per-reference direction with influence, role, usage instruction, and do-not-carry-over exclusions, or the no-reference fallback line, L525 to L530); Protection (the protection block, template or sales overlays, every dossier guardrail as `title: body`, every product exclusion as `Product rule:`, and `Also avoid:` with the brief exclusions, L531 to L541); Display copy (`#displayCopyBlock` with the zone from `getZone(displayCopy.zoneId)`, only when a line has text, L543 to L548); Output (per-placement closing instruction, L549 to L558).
10. **Prompt join** (L561): each section as its uppercased title, a newline, the body, sections joined by blank lines. This string is the render prompt and the durable record.
11. **Constraint audit** (L564 to L568): `auditConstraints` checks each guardrail and the brief exclusions for presence in the compiled prompt, a deterministic text check, not semantic (prompt-craft.js L432 to L461). Because step 9 compiles guardrails and exclusions verbatim into the Protection section, presence is guaranteed while that compilation holds; the audit's live value is as a regression tripwire against a compile change that drops them (Reasoned; the guarantee itself is Verified from L538 to L540 against L442 and L452). An approved product with unanswered review questions appends a warning entry (L572 to L578).
12. **Treatments and requirements** (L581 to L584): `resolveTreatments` (L109 to L208) classifies locked assets, guardrails, scoped brain rules through `arrayScopeAppliesToJob`, guidance sections, references, palette, and materials into locked, suggested, and not-needed for the preflight panel. `checkRequirements` runs with the deliverable id hardcoded to `"brand-world-image"` for every placement, including template and sales jobs (L582; see Known ambient states). Treatments are display-only and do not govern the prompt, per ADR 0005 sprint finding 3.

### Outputs and artifacts

Returns one package object (L586 to L626): `version: "brand-world-image-v2"`; brand name, description, brain version, source count; `output` with placement, format, size from `#imageSizeForFormat` (L330 to L332, table at L210 to L236), quantity 1; `brief` with the neutralized scene and exclusions; `aestheticMode`; `lockedAsset` and `templateAsset` summaries; `stateNeutralizations`, `orientationAdjustments`, `screenContentAbstracted`; `prompt`; `sections`; `compiledComponents`; `references` summaries; `constraintAudit`; `treatments`; `requirementCheck` and `ready`; the product summary with its open question count; the copy contract via `#compileCopyContract` (L641 to L669), which returns nothing at all for a job with no declared copy outputs and otherwise records the declared types, the governing claims as text, source, and scope, the display block with `verified: false`, claims withheld for a missing segment, and an empty `produced` array; and `policy` with grounding, flexible elements, and exclusions.

Persisted by this stage: none. The compiler is a pure function over its inputs. Persistence of the package belongs to stage 10: the working job record carries `generationPackage` from the moment the render starts (service.js L419 to L428), and `writeOutputPackage` saves it beside the image after the render (service.js L513 to L524).

### Invariants

- **The compiled prompt is the durable record.** The package carries the exact prompt string the renderer receives, and it persists with the output. No stage between compilation and the API call may append or rewrite; stage 9 validates non-empty only. Source: ADR 0003 and ADR 0006; the persistence rule in stage 10.
- **Image-only parity.** A job that declares no copy outputs gets no `copy` key at all, and its compiled package is byte-identical to the pre-copy-contract compiler's output (`#compileCopyContract` L641 to L643, comment L633 to L636). Asserted by `test/copy-contract.test.js` ("a job with no copy output compiles identically across every placement shape", L57).
- **Neutralizer scoping.** State-lock neutralization runs only when a locked asset is present (L404). Screen orientation neutralization runs only when the job is screen-bearing, which excludes template jobs, sales jobs, and any job with a template asset (L399, L409). Source: the screen orientation template regression, fixed by exactly this scoping.
- **Protection is one compact block and is proven craft.** The protection text, integration sentence, and state lock carried through thirteen PWP iterations and are ported as-is (prompt-craft.js L1 to L12). ADR 0015 compressed guidance but left protection untouched.
- **The claims set is recorded as assembled, never re-filtered or paraphrased.** The compiler maps each claim to text, source, and scope and stores it (L650 to L655). Scope matching and the asymmetric fail directions (approved and disclosures fail closed, prohibited fails open) live upstream in `src/scope/resolver.js` (header, L21 to L33) and `src/claims/assembly.js` (L71 to L72); the compiler must not reimplement them. Source: ADR 0013 revision of 2026-08-09.
- **`verified: false` is never set true by assertion.** The display record carries it false until read-back verification exists (L656 to L661). Source: ADR 0014 revision of 2026-08-11.
- **Treatments are display-only.** They classify for the preflight panel and do not govern the compile (ADR 0005 sprint finding 3; verified: nothing in L481 to L559 reads `treatments`).
- **Screens are a governed surface.** Every compiled prompt carries a screen content rule; readable screen content enters only as a protected asset (prompt-craft.js L117 to L132). Source: ADR 0014 revision of 2026-08-11.
- **Deliverable requirements are advisory.** `ready` is computed and reported; nothing in the compile or the render path blocks on it (L583 to L584, L616). Source: ADR 0005 sprint finding 4.

### Failure states

- Missing or over-length brief fields throw status 400 with a user-facing message naming the field and the limit (`#requiredText` L256 to L269, `#optionalText` L271 to L279).
- No approved brain throws status 409, both in the compiler's own guard (L363 to L367) and earlier in `service.js#approvedContext` (L24 to L35), so the compiler's guard is a second wall rather than the live one.
- Upstream resolution failures reach the caller before the compile: bad references, locked asset, template, or product throw 400 or 409 from their resolvers in service.js (L37 to L159).
- The compile itself makes no model call and no network call; it is deterministic. Any throw surfaces through the endpoint's `sendPublicError` (preflight.js L23 to L25; generate.js catch). There is no empty-success shape: the compiler either returns a full package or throws.
- A display copy failure is not a compile failure: the error is recorded on the copy contract as `displayCopyError` and the job compiles and renders without the block (service.js L299 to L301, L317 to L318).

### Consumers

- `api/production/preflight.js#handler` returns `{ generationPackage }` to the interface, which renders exactness, adjustments, the screen abstraction disclosure, and governing claims from it (stage 8; the interface regions are stage 12's to document).
- `src/production/service.js#generateProductionImage` consumes `generationPackage.prompt` (L443), `output.size` (L446), and the copy contract for post-render copy production (L470 to L509); the endpoint choice reads the reference entries, not the package (L425).
- `src/production/store.js` persists the package on the working record and beside the output (stage 10).
- `src/production/package.js#buildConsumptionRecord` (L675 to L692) derives the consumption record from the package for change-impact classification.
- `app/app.js` preflight and result regions read the package fields (stage 12).

---

## Stage 8: Preflight

### Trigger

A POST to `/api/production/preflight` (`api/production/preflight.js#handler`, L7 to L26), fired when the user continues from Design Studio setup into preflight. The endpoint compiles the package and returns it; nothing is generated and nothing is spent beyond the display-copy pre-production described below.

### Inputs

The job body: brief, references, locked asset id, template asset id, product id, campaign, copy outputs, segment, display copy settings. The full resolution of these into compiler inputs is documented under stage 7's Inputs, which is the authoritative account; this stage adds nothing to it. The endpoint constructs the three stores from the resolved client id (preflight.js L17 to L21).

### Owner

`api/production/preflight.js#handler` (L7), delegating entirely to `src/production/service.js#prepareProductionPackage` (L161), whose internals stage 7 documents.

### Transformations

One: `prepareProductionPackage` runs, which resolves inputs, assembles claims when copy is declared, pre-produces display copy when requested (a real model call before any render spend, service.js L238 to L302), and compiles the package. The endpoint returns `{ generationPackage }` (L22).

### Outputs and artifacts

Returns the compiled package. Persisted: none. The preflight package is held in interface state (`state.production.package`); the package the render eventually uses is compiled again inside the generate invocation (stage 7 Trigger), not this one.

What the user is shown before spend, and the package fields each element reads (`app/app.js#renderPreflight`, L6008 to L6180):

- Compiled sections count and the full prompt text in a collapsible (`sections`, `compiledComponents`, L6023 to L6055).
- Grounding, protected asset, product record and version, visual register, flexible and excluded lists (`policy`, `lockedAsset`, `product`, `aestheticMode`, L6057 to L6065).
- Scene adjustments: state neutralizations and orientation adjustments, each naming the changed phrases (`stateNeutralizations`, `orientationAdjustments`, L6067 to L6068).
- The screen abstraction disclosure with the path to real content (`screenContentAbstracted`, L6069).
- The copy panel: declared types, governing claims in four groups, the segment, the withheld-for-segment report, and the nothing-to-enforce state (`copy.governingClaims`, `copy.declared`, `copy.segment`, `copy.withheldForSegment`, `#copyPreflightPanel` L5948 to L6001).
- Treatments grouped by locked, suggested, and not-needed with counts (`treatments`, L6074 to L6100).
- The requirement check and the ready/needs-input card; unmet requirements are named and generation is not blocked (`requirementCheck`, `ready`, L6102 to L6123).
- What travels with the render: brain version, protected asset, reference count (`brainVersion`, `lockedAsset`, `references`, L6131 to L6145).

### Invariants

- **Preflight precedes spend.** The compile is deterministic and free; the one model call this stage can make is display-copy pre-production, which exists because a string that must be rendered has to exist first (service.js comment L229 to L237). Source: ADR 0003's preflight contract; the ADR 0014 revision of 2026-08-11 for the inversion.
- **What is shown is what compiles.** The panel renders fields of the same package object the compiler returned; nothing is recomputed for display. The known gap: the render invocation compiles again from the same request body, so a store change between preflight and generate (a claims edit, a product re-synthesis clearing approval) changes or blocks the render relative to what preflight showed. The second compile re-runs every resolver, so the approval gates still hold; what is not guaranteed is that preflight's picture and the render's package are identical. Reasoned from the two call sites; no code pins the preflight package to the render.
- **Unmet requirements advise, never block** (ADR 0005 finding 4; `ready` is display only, stage 7 invariants).

### Failure states

Everything stage 7 and its resolvers throw, surfaced by `sendPublicError` (preflight.js L23 to L25). A display-copy failure is not a preflight failure: it is recorded on the copy contract and preflight renders without the block (stage 7 Failure states).

### Consumers

The interface preflight screen exclusively. The package it displays is the user's evidence for the generate decision; the render itself consumes the second compile.

---

## Stage 9: Render call

### Trigger

`src/production/service.js#generateProductionImage` (L377), reached from `api/production/generate.js#handler` when the user confirms generation after preflight. Before the render is reached, the duplicate-invocation guards run (stage 10's invariants cover the record semantics): a complete record for the same job id returns immediately (L380); a working record younger than five minutes turns this invocation into a poller that waits up to 200 seconds and returns the original's result (L384 to L396, intervals at L367 to L369); a working record older than five minutes is treated as abandoned and re-rendered.

### Inputs

The compiled package's prompt string (`generationPackage.prompt`, L443); up to ten reference images loaded from Blob as bytes, ordered template asset first, locked asset second, then creative references (L408 to L417, L431 to L440); the OpenAI API key from `options.env`; size from `generationPackage.output.size` via `imageSizeForFormat` (stage 7); quality fixed at `"medium"` and output format `"png"` (L447 to L448). The reference ceiling of eight applies to creative references at resolution time (`#resolveReferences`, L38); the template and locked asset ride above that count.

### Owner

`src/renderers/openai-images.js#renderWithOpenAIImages` (L53), with endpoint selection in `#chooseOpenAIImageEndpoint` (L17 to L19) and request construction in `#buildOpenAIImageGenerationRequest` (L21 to L33) and `#buildOpenAIImageEditRequest` (L35 to L52).

### Transformations

Endpoint chosen by reference presence: any reference images route to the edits endpoint as multipart form data with each image appended as `image[]`; none routes to generations as JSON (L17 to L19, L54 to L57). Model `gpt-image-2`, constants at L1 to L3. The prompt passes through unmodified: `#requiredPrompt` (L5 to L8) validates non-empty only. The response is returned as OpenAI sends it; the service decodes `data[0].b64_json` from base64 (service.js L451 to L453).

### Outputs and artifacts

Returns the OpenAI response object to the service; the service extracts the image bytes. Persists nothing itself. The service owns persistence (stage 10).

### Invariants

- **The prompt is the compiled package's prompt exactly**; no stage between compilation and the API call may append or rewrite (source: the compiled prompt is the durable record, ADR 0003 and ADR 0006; verified by `#requiredPrompt` being the only touch).
- **Endpoint selection is mechanical from reference count, never a user choice** (source: ADR 0005, presets not selectors; L17 to L19).
- **The renderer is provider-shaped, not policy-shaped.** No governance logic lives here; it takes a prompt, images, and options, and returns bytes or throws.

### Failure states

Non-2xx from OpenAI throws with the API's message and status (L66 to L70); a missing API key fails here, not silently upstream (L54). Empty image data throws in the service ("OpenAI returned no image data.", L452). The service's catch owns what happens next (stage 10).

### Consumers

Stage 10 consumes the bytes; the result screen consumes the job status; the package record persisted alongside the output is unaffected by render failure.

---

## Stage 10: Persistence

### Trigger

The render succeeding or failing inside `generateProductionImage` (service.js L419 to L552). Separately, the interface persists its output log through POST `/api/production/outputs` (stage 11) after saving or discarding work.

### Inputs

The working job record, the rendered bytes, the compiled package (including the copy contract), and the post-render copy production results.

### Owner

`src/production/store.js#createVercelBlobProductionStore` (L101): `write` for the current-job record (L126 to L135), `writeImage` (L136 to L148), `writeOutputPackage` (L160 to L169), `readOutputPackage` (L170 to L172), `deleteOutputArtifacts` (L175 to L180), `readOutputs` and `writeOutputs` (L181 to L194), `outputImageUrl` and `imageUrl` presigners (L105 to L112, L149 to L157). The write sequence is owned by `generateProductionImage`.

### Transformations

In order, on the success path:

1. The working record (job id, attempt id, status `working`, model, endpoint, the full compiled package) is written before the render starts (L419 to L428).
2. After the render, the ownership check: the record is re-read, and if another attempt now owns it, this attempt discards its result rather than overwriting (L458 to L461). Source: the 2026-08-11 duplicate-render incident.
3. The image bytes are written to the per-job deterministic path `brand-world-system/clients/{clientId}/production/jobs/{jobId}/output.png` (`#productionImagePathname`, store L22 to L24).
4. Governed copy is produced after the image, one block per declared type, pre-produced display blocks carried forward rather than regenerated; a block that fails is recorded as a failure with an errored audit rather than silently omitted (service L470 to L509).
5. The package, now carrying produced copy and findings, is written beside the image at `.../jobs/{jobId}/package.json` (`writeOutputPackage`, service L513 to L524); a failure here is swallowed, costing later review, never the image (comment L521 to L523).
6. The complete record is written with `imagePathname` and `imagePublicUrl: null` (L525 to L534).

On the failure path: only the attempt that owns the record may write the error record, so a failing retry cannot mark a succeeded job failed (L536 to L551).

### Outputs and artifacts

Persisted, per client namespace: the current-job record at `production/current.json` (one slot; a new job replaces it); the image at the per-job path; the package at the per-job path; the output log at `production/outputs.json`, written by the interface through stage 11 with at most 200 entries and every field stripped to the durable minimum (outputs.js L129 to L153).

### Invariants

- **No presigned URL is ever persisted.** `imagePublicUrl` is written null (service L531); the output log stores `hadImage` as a boolean and never a URL (outputs.js L142 to L147); presigned URLs live fifteen minutes and are minted per read (store L105 to L112, comment L150 to L153). Source: the broken-thumbnail class of bugs, closed structurally by stage 11's redirect route.
- **The compiled package persists with the output** and is the durable record of what the brand asserted; reopening past work reads it back (stage 11). Source: ADR 0003, ADR 0006, ADR 0014's copy contract.
- **Attempt ownership gates every durable write.** The `attemptId` check before the image write and before the error write are the two walls from the duplicate-render incident, covered by `test/duplicate-render.test.js`.
- **A duplicate is a reader, a dead job is retryable.** The three time constants (2-second poll, 200-second wait, 300-second abandonment) encode the incident's fix (L367 to L369).
- **Copy failure never costs the image** (L470 to L509); package-write failure never costs the image (L513 to L524).
- **The current-job slot is one deep.** Anything durable about an output beyond the latest job lives in the per-job blobs and the output log, which is why the package must be written per job.

### Failure states

A render failure writes an error record (if owned) and rethrows; the endpoint returns the message and the result screen renders the failed state with retry. A blob write failure on the image path fails the job; on the package path it is swallowed; on the output log it is the interface's problem (stage 11). Failure and empty are distinguishable everywhere: status is `working`, `complete`, or `error`, and a complete record without an image cannot exist because the image write precedes it.

### Consumers

Stage 11 serves the persisted image and package; `api/production/current.js#handler` returns the current job with a freshly minted image URL for recovery (`readProductionJob`, service L349 to L355); the interface's `recoverProductionJob` (app.js L7438) uses it when the gateway drops the response mid-render (app.js L7491 to L7495).

---

## Stage 11: Serving

### Trigger

GET and POST on `/api/production/outputs` (`api/production/outputs.js#handler`, L9). GETs: the stable image redirect (`?action=image&outputId=`), a single output with its package (`?outputId=`), or the full log. POSTs: save the trimmed log, or `action: "discard"` for a hard delete.

### Inputs

Query parameters or the posted output list. The interface builds every image `src` through `app/app.js#outputImageSrc` (L9524 to L9530), which returns the stable route for any output with an id and `hadImage`, and an empty string for pre-image-path legacy outputs so they fall to the missing state rather than a dead link.

### Owner

`api/production/outputs.js#handler` (L9), with the store functions from stage 10.

### Transformations

- **The stable image route** (L26 to L48): mints a fresh fifteen-minute presigned URL for the job's PNG and responds 302 with `Cache-Control: no-store, max-age=0`, because a cached redirect would pin a URL that expires, which is the bug this route exists to end (comment L38 to L39). Any failure is a 404 JSON body, never a broken redirect.
- **Single-output read** (L50 to L68): finds the log entry, mints an image URL when the output had one, and returns the entry together with the persisted per-job package, so the evaluation screen has the same material it had at generation time.
- **Log read** (L70 to L87): re-mints image URLs for at most the first 60 outputs (`MAX_SIGNED_IMAGES`, L7); the rest return without URLs, reachable through the stable route on demand.
- **Log write** (L121 to L155): caps at 200 (`MAX_OUTPUTS`, L4) and strips each entry to the durable fields, converting any incoming URL to the `hadImage` boolean and keeping `copySummary` as a marker while the produced text and audit live in the per-job package (comments L142 to L152).
- **Discard** (L100 to L119): removes the log entry, then best-effort deletes the image and package blobs; a blob-delete failure orphans the blobs rather than reporting the discard failed (comment L114 to L116).

### Outputs and artifacts

Responses only; the persisted artifacts are stage 10's. The legacy-output missing state is a contract with the interface: an empty `src` from `outputImageSrc` plus the `onerror` fallbacks on every figure (app.js L1410, L3396, L3537, L4442, L5102, L5713) render a visible missing state instead of a broken image.

### Invariants

- **Every image the interface shows travels through the stable route.** The browser never holds a presigned URL (comment L21 to L25); the durable fact is `hadImage`, never a URL. Source: the stable image route decision closing the broken-thumbnail bug class.
- **The redirect is never cacheable** (L40).
- **Discard is a hard delete of record, image, and package together**, so no surface has to remember to filter a ghost (comment L98 to L99; store `deleteOutputArtifacts`).
- **Failure is distinguishable from missing**: image route failures are 404 JSON; log reads that find no document return an empty list; a legacy output renders the missing state by construction.

### Failure states

400 on a discard without an id or a save without a list; 404 on unknown output id and on any image-route failure. All others via `sendPublicError`.

### Consumers

Every thumbnail and result figure in the interface via `outputImageSrc`; `persistOutputs` (app.js L7603), `openOutputForReview` (L7621, which navigates to the result screen and loads the per-job package, refusing evaluation when the package was never saved, L7633 to L7635), `discardOutput` (L7664), `hydrateOutputs` (L7698).

---

## Stage 12: Surfacing

The contract documents which package and job fields each surface reads, not the markup.

### Trigger

Rendering: `app/app.js#renderPreflight` (L6008) on the preflight screen and `#renderResult` (L6448) on the result screen. The result screen renders in three modes: live generation (navigated to at generate time with a working stub carrying the preflight package, L7474 to L7480), completed or failed current job, and reopened past work (`openOutputForReview` rebuilding the job from the persisted package).

### Inputs

`state.production.package` (preflight) and `state.production.job` with its `generationPackage` (result).

### Owner

`app/app.js`: `#renderPreflight` (L6008), `#copyPreflightPanel` (L5948), `#renderResult` (L6448), `#buildEvaluationFindings` (L6183), `#buildCopyFindings` (L6355), `#renderedCopyCheckPanel` (L6264), `#producedCopyPanel` (L6286), `#copyAuditPill` (L6326 region), `#outputImageSrc` (L9524).

### Transformations

Preflight field reads are enumerated under stage 8. Result-screen reads:

- Job status drives the working, failed, and complete states; `job.imageUrl` is the figure source; `job.endpoint` containing `/edits` labels the generation method (L6469 to L6474).
- `#buildEvaluationFindings` (L6183 to L6262) reads `pkg.lockedAsset` (fidelity check card), `pkg.output.format`, `pkg.output.size`, `pkg.output.placement` (composition card), `pkg.brandName` (brand fidelity card), and `pkg.constraintAudit` (rules cards for `excluded` and `warning` entries). The first four cards are fixed verify prompts for the human reviewer, not model findings; nothing at this commit examines the returned image (the ADR 0016 evaluation loop is unbuilt).
- `#buildCopyFindings` (L6355 onward) reads `pkg.copy.displayCopyError` (the headline-not-placed finding) and each `pkg.copy.produced[]` block's `audit.status` and `audit.findings`, rendering `errored` as unchecked with a rewrite action, `no_claims` as a verify note, and each finding with its field, kind, and governing rule.
- `#producedCopyPanel` reads each produced block's `label`, `fields` (with `overLength` pills and visible gaps for empty fields), `text`, and audit pill; failed blocks render the not-written state with the image explicitly still usable (L6286 to L6323).
- `#renderedCopyCheckPanel` reads `pkg.copy.display.lines` and renders the intended strings beside the image with the explicit statement that nothing checks the lettering automatically (comment L6260 to L6263). This is the manual stand-in for the unbuilt read-back verification.
- Reopened work banners read `generationPackage.brainVersion` (L6520 to L6521).

### Outputs and artifacts

Rendering only. The interface persists the output log through stage 11 after save and discard actions.

### Invariants

- **An errored audit never renders as a clean pass.** The audit pill and findings read `audit.status` and say so in words (`#copyAuditPill` comment; `src/copy/generate.js` header L8 to L18). This is the single field the interface trusts for that distinction.
- **Display copy is presented as unverified** until read-back verification exists, and the panel names the person as the check (ADR 0014 revision of 2026-08-11; `verified: false` on the package, stage 7).
- **Result figures degrade to a visible missing state**, never a dead link (stage 11 consumers).
- **The findings shown for a reopened output come from the persisted package**, the same material as at generation time (stage 11; `openOutputForReview`).

### Failure states

The result screen's failed state renders the job error with retry; `openOutputForReview` renders a named refusal when the package was never persisted; missing images render the missing state.

### Consumers

None downstream: this is the terminal stage. The person's approve, save, discard, feedback, and retry actions feed back through the endpoints already documented.

---

## Cross-cutting: the copy path on the image job

Copy has two riding positions on the image pipeline, plus a standalone endpoint.

**Declared copy outputs, produced after the render.** The job declares copy type ids (`#resolveCopyOutputs`, service L330 to L336, unknown ids dropped, capped at four). The claims set assembles once and serves both steering and the record (stage 5). After the image persists, each declared block is produced by `src/copy/generate.js#produceCopy` (L245 to L300): the catalog entry from `src/copy/types.js` supplies role line, length guidance (per-channel caption budgets, types.js L36 to L46), structural rules, and output format; generation is one `gpt-4o` call at temperature 0.7; structured types parse JSON into fields with empty fields kept visible rather than dropped (`#parseStructuredCopy`, L307 to L325). The catalog is configuration, the capability is code (types.js header; ADR 0011's line, ADR 0014 step 1). Placement defaults come from `#defaultCopyOutputsForPlacement` (types.js L131 to L137, social channels get a caption); `#availableCopyOutputsForPlacement` offers the headline set everywhere (L142 to L144).

**The audit on every produced block.** `#auditProducedCopy` (generate.js L159 to L239) normalizes three states that must look different to a reviewer: `governed`, `no_claims`, `errored` (header L8 to L18). It never throws: an audit that cannot complete reports errored rather than failing copy that was produced. The deterministic checks run in every state, including errored: the prose check (`src/copy/prose-check.js#checkProseRules`, L50 onward: em dashes anywhere, the banned-word list, hedging verbs, negation-first pairs, fragment stacks of three or more, each finding quoting its context; deduplicated by `#collapseProseFindings`), the disclosure presence check (`src/claims/copy-audit.js#checkDisclosurePresence`, L118 to L125, normalized substring), and the display budget check (`src/copy/display-budget.js#checkDisplayBudgets`, L179 to L197). The model-based claim audit is `src/claims/copy-audit.js#auditCopyAgainstClaims` (L25 to L116): `gpt-4o` at temperature 0, the falsifiability test as the claim definition, safe-harbor semantics (approved passes, prohibited is a violation, unapproved is advisory, description is no finding), the compliance-is-not-violation rule, and description-when-torn (all four ADR 0013 amendments of 2026-08-10 present in the prompt, L30 to L50). Match tokens resolve back to the governing claim text for the interface (`#resolveGoverningRule`, generate.js L145 to L152); findings are attributed to the field they landed on (`#attributeFindingsToFields`, L333 to L340).

**Display copy, produced before the render.** The inversion and its handling are documented in stage 7's Inputs and the service walkthrough (service L229 to L302). Budgets are characters, not words, and are a legibility floor rather than a fit ceiling; the per-line figures are REASONED from typographic practice, not measured against renders, and say so in the module (display-budget.js header L25 to L31, L146 to L148).

**Standalone actions on the copy endpoint** (`api/production/generate-copy.js`): `copy_type` produces one governed block outside an image job (L99 to L140); `audit_copy` re-audits user-edited copy without a generation call, attributing findings to fields (L69 to L97), which is what keeps an edited display string a produced-and-audited source; `segments` lists the client's segments (L58 to L63); the legacy LinkedIn path (L142 to L310) is the pre-catalog caption generator with the same steering, audit, and disclosure checks inline, still reachable when no `action` is set.

## Cross-cutting: invariant index

Every invariant above in one table. A change to any listed module is checked against every row naming it.

| Invariant | Where enforced | Source |
| --- | --- | --- |
| The 12-serverless-function ceiling: all new operations dispatch through existing handlers | `api/` contains exactly 12 function files at the verified commit; dispatch comments in `generate-copy.js` L52 to L54, `api/products/index.js` L22 to L24, `api/blob/upload.js` L4 to L7, `api/brand-brain/index.js` L6 | Vercel Hobby constraint; ADR 0011 operating reality |
| Only supplied sources feed synthesis; nothing invented | `chat-completions-provider.js` L5, L24; `products/service.js` L109 to L114 | ADR 0009, ADR 0012 |
| Exact-asset contents are never reinterpreted | `source-normalizer.js` L75 to L84; `prompt-craft.js#protectionBlock` | ADR 0002; PWP-proven protection |
| Approval gates every production consumer: brain, product, in both paths | `brand-brain/service.js#selectApprovedBaseline`; `production/service.js#resolveProduct` L153 to L157; `generate-copy.js` L35 to L39 | ADR 0009, ADR 0012 |
| Claims are derived at compile time, never stored as a third catalog | `claims/assembly.js` whole module | ADR 0013 |
| Fail-direction asymmetry: approved and disclosures fail closed, prohibited fails open, on every scope axis | `scope/resolver.js` header L21 to L33; `assembly.js` L71 to L72 | ADR 0013 revision 2026-08-09 |
| Directives never reach the claim auditor; ambiguity fails toward auditing | `assembly.js` L19 to L29, L145 to L160; `copy/generate.js` L92 to L99 | ADR 0013 amendment 2026-08-10 |
| The claims document is human-authored and append-only via supersession | `claims/store.js`; no synthesis write path exists | ADR 0013 |
| The refusals document is ruled by a person and never removed by synthesis; deletion does not exist, retirement and supersession do | `refusals/store.js`; no synthesis write path exists at this commit | ADR 0017 |
| Seeding writes only into a client with zero protections and refuses otherwise; a failed read throws rather than reporting emptiness | `refusals/store.js#seed` and its `readOrCreate`; `api/brand-brain/index.js` seed_refusals | ADR 0017 step 3 |
| A bootstrap slate resolves once, for both the offer and the write; the interface cannot offer a seed that fails on press | `refusals/bootstrap.js#resolveBootstrapSlate`, the single caller of record in `api/brand-brain/index.js` | ADR 0017 step 3 |
| The compiled prompt is the durable record; nothing between compile and render rewrites it | `openai-images.js#requiredPrompt`; package persisted per job | ADR 0003, ADR 0006 |
| Image-only package parity: no copy outputs, no copy key, byte-identical compile | `package.js#compileCopyContract` L641 to L643; `test/copy-contract.test.js` L57 | ADR 0014 step 2; the 2026-08-09 placement-shape regression |
| Protection compiles as one compact block and is ported PWP craft, not reworked | `prompt-craft.js` L1 to L12, L151 to L206 | PWP v13; ADR 0015 left it uncompressed |
| Neutralizers are scoped: state lock only with a locked asset; orientation never on template, sales, or template-asset jobs | `package.js` L399, L404 to L413 | The screen-orientation template regression |
| Screens are a governed surface; readable screen content enters only as a protected asset | `prompt-craft.js` L117 to L132 | ADR 0014 revision 2026-08-11 |
| Text safety narrows for authored display copy, never drops | `prompt-craft.js` L108 to L115, L152 | ADR 0014 revision 2026-08-11 |
| `verified: false` on display copy is never set true by assertion | `package.js` L656 to L661; result screen check panel | ADR 0014 part two; read-back verification unbuilt |
| Budget discipline: guidance compiles compact; the scene carries the budget; payload measured on change | `package.js#sectionDirection` L281 to L297, sections L481 to L559 | ADR 0015 steps 4 and 5 |
| Brand rejects reach the model as avoid-clauses. A client with at least one accepted protection compiles those statements; every other client compiles `livedWorld.rejects` unchanged. Proposed and declined entries never reach a prompt | `package.js#rejectsDirection`, its `refusals` argument, and the read in `service.js#prepareProductionPackage`; proved by `fixtures/adr-0017-step4-parity.mjs` | ADR 0015 step 5; ADR 0017 and its amendment of 2026-08-17 |
| Catalog is configuration; render and generation capabilities are code | `copy/types.js` header; deliverable catalogs per ADR 0011 | ADR 0011, ADR 0014 |
| Treatments are display-only and do not govern the compile | `package.js` L581; nothing in section assembly reads them | ADR 0005 finding 3 |
| Deliverable requirements advise, never block | `package.js` L583 to L584; preflight card L6119 to L6123 | ADR 0005 finding 4 |
| Mode labels never appear as user-facing selectors or status text | aesthetic mode is inferred (`prompt-craft.js#selectAestheticMode`); interface shows plain-language promises | ADR 0005 and its finding 1 |
| No presigned URL is ever persisted; the stable image route mints per read with no-store | `production/store.js`; `outputs.js` L26 to L48, L142 to L147; `service.js` L531 | The broken-thumbnail bug class |
| Attempt ownership gates durable writes; a duplicate is a reader; a dead job retries | `service.js` L380 to L401, L458 to L461, L541 to L551 | Incident 2026-08-11; `test/duplicate-render.test.js` |
| Copy failure never costs a rendered image; display-copy failure never blocks the render | `service.js` L299 to L301, L470 to L509 | ADR 0014 and its 2026-08-11 revision |
| An errored audit never renders as a clean pass; three audit states are distinct | `copy/generate.js` L8 to L18, L159 to L239; `#copyAuditPill` | ADR 0014 step 3 |
| The deterministic checks (prose, disclosure, budget) run in every audit state | `copy/generate.js` L161 to L166, L182, L200, L229 | ADR 0013 amendment 2026-08-10 |
| All durable state is client-namespaced; blob paths are confined to the caller's namespace | every store module; `api/blob/upload.js` L46 to L47; `resolveClientId` sanitization | ADR 0011, ADR 0004 |
| A product placed through the place on background path is composited in the browser and never sent to a model on its own; the mask confines the model to the ground beneath it. This confines where the model paints and is not a claim that the returned pixels are byte identical | `src/production/composite.js`; the mask field in `callShadowEdit`; `app/place.js#buildMask` | Owner ruling 2026-08-20; the overclaim shape recorded in `docs/deferred-work.md` |
| The current job slot is never written by the place on background path; each run saves under its own job id | `src/production/composite.js#placeOnBackground`; nothing in it calls `productionStore.write` | The 2026-08-11 duplicate-render incident, applied forward |
| Production feedback never auto-writes to the brain; scene suggestions persist nothing | `generate-copy.js` L42 to L45; candidate-rule queue design | ADR 0010 |

## Cross-cutting: known ambient states

Everything documented as broken-and-waiting or as a recorded disagreement between code and its records. Silent ambient states are the enemy; this section makes them loud. Items 1 through 8 were recorded at the practice gate and spot-verified by the owner on 2026-08-15; dispositions noted per item. Retired items keep their history and gain a retirement note; they are never deleted.

1. **Retired 2026-08-15. ADR 0016 carried a stale Verified claim about the scene writer.** The ADR's context stated, marked Verified, that `api/production/generate-copy.js` pushes `identity.summary` alone. Commit `1a9357e` changed the writer to include identity principles (L341 to L343). The spec for this contract carried the same stale statement from its verification at `bcee418`. Retirement: the ADR was amended in this commit, in place and dated, naming `1a9357e` as the fix. Four statements were covered: the context finding, step 5, the options-considered clause, and the step 1 prototype gate language. The spec half is unresolved rather than retired, because `docs/image-pipeline-contract-spec.md` is not present in the repo at `381d3b7` (Verified by directory listing); whether it exists outside the repo is unknown and this session did not chase it.
2. **The spec names a scene writer kind that does not exist.** The spec's stage 6 lists kinds `scene` and `object`; the kinds at the verified commit are `scene`, `template_surface`, and `sales_element` (`generate-copy.js` L379 to L414).
3. **Display copy governance is enforced client-side at the API seam.** `prepareProductionPackage` uses `body.draftedCopy` as sent (service L253 to L268); a draft arriving without an audit gets an errored-audit placeholder and still compiles into the render prompt. The interface is the gate (comment L249 to L252); a direct API caller can render an unaudited string; the package records the audit state, and nothing refuses the string. Disposition: recorded in `docs/deferred-work.md` as server-side refusal of unaudited display copy, required before any client-facing beta touches display copy; interface-as-gate accepted until then.
4. **Retired 2026-08-15. `compileProductSection` was dead code.** `src/production/package.js#compileProductSection` (L337 to L360 at `381d3b7`) compiled claim language into a prompt section and was called from nowhere. The live image path is `#compileProductSectionForImage` (L313 to L322), which deliberately excludes claim language, so a later session finding the dead function by search would have read the pipeline's claims posture backwards. Retirement: the function and its comment were deleted in this commit after a repo-wide search confirmed no caller in `src/`, `api/`, `app/`, `test/`, or `fixtures/`. `compileProductSectionForImage` is untouched. Anchor consequence is stated in the header.
5. **`checkRequirements` runs with a hardcoded deliverable id.** Every placement is checked against the `brand-world-image` requirement list (package.js L582); the `product-showcase` entry (L78 to L83) is unreachable at the verified commit. Requirements are advisory, so no blocking effect. Disposition: recorded, no action; note Product Showcase is separately slated for deprecation.
6. **The constraint audit is structurally satisfied by construction.** Guardrails and brief exclusions compile verbatim into Protection (package.js L538 to L540) and are then presence-checked against the same prompt (prompt-craft.js L442, L452). Its live value is a regression tripwire (Reasoned). Disposition: recorded, no action.
7. **The suggestion picker displays one of four authored fields.** `#sceneSuggestionPanel` (app.js L4056 to L4083) renders label and brief only; selection applies all four (L8565 to L8581). Display-only defect, already in deferred work; ADR 0016 notes its priority rises once the fields draw on the grammar.
8. **Retired 2026-08-17. ADR 0016 step 2 was complete with nothing consuming the artifact.** The scene writer now consumes it, per stage 6 above. What remains true from this item and is restated rather than dropped: `basisNote` labels `evidence` as "From your sources", `inference` as "Reasoned" with its confidence, `ambition` as "A direction you're reaching for" with no confidence, and anything else not at all; the artifact tab is gated on presence so pre-schema brains cannot reach a reader that would throw; `renderGrammarSample` renders the SLAKE sample read-only with the sample brand named. What changed: the scene writer receives the grammar's five descriptive sections instead of the identity and creative summaries, and `livedWorld.rejects` is no longer the avoid-clause source for a client with accepted protections (ADR 0017 step 4, ambient state 16). Still true: no render evaluation examines the returned image, which is ADR 0016 step 5.

    **Carried forward as its own open item: the ambition label reaches the prompt and stops there.** The scene writer returns `grammarEntries` with origins, and nothing downstream records them yet. The package does not carry them and the result screen does not render them. ADR 0016 names this as a risk in its own words, that ambition quietly becomes fact, and calls it cheap at build time and expensive to retrofit. The endpoint half is built; the package and result-screen half is not.

    **The scene writer is still not independently testable**, per the step 1 finding. Its context assembly is now covered by a parity fixture holding a copy of the code, with a drift tripwire, which is a mitigation rather than a fix. The underlying cause is the function ceiling.
9. **Read-back verification is unbuilt.** ADR 0014 part two specifies the system reads rendered text back out of the image and fails on mismatch. Nothing does. The person is the verification step, the result screen says so (`#renderedCopyCheckPanel`), and the package carries `verified: false` that nothing may set true by assertion.
10. **The ADR 0013 amended mechanism test is recorded as not yet run.** The ADR states the amended criteria (compliance-not-violation, puffery-as-description) require an API key the implementing session lacked; the falsifiability change is verified by construction and offline unit tests only. Whether it has been run since is not established from the code; the runnable path exists (`run_audit_test`, `api/brand-brain/index.js` L88 to L94, and `fixtures/copy-audit-mechanism-test.mjs`).
11. **The studio reference picker offers a narrow slice and cannot upload.** Recorded in `docs/deferred-work.md` (raster-only Blob-backed sources appear; links and documents never do; no upload of its own). The owner's 2026-08-15 decision keeps the picker manual; the automatic channel is ADR 0016's grammar.
12. **Preflight's package and the render's package are compiled separately.** The generate invocation recompiles from the request body (stage 8 invariants), so a store change in the gap changes or blocks the render relative to what preflight showed. The gates re-run, so nothing ungoverned slips through; the picture is what can drift.
13. **`resolveClientId` trusts the request.** The client id comes from a header or cookie with sanitization but no identity check, marked PROTOTYPE ONLY in `src/server/http.js` (L100 to L107) with the instruction not to ship real auth without closing the seam. Recorded in ADR 0011 as the shared-password gate's known deficiency.
14. **Legacy flat-path read-throughs remain** for the default client's brain state and production state (`brand-brain/store.js` L8 to L13; `production/store.js` L8 to L12), each marked for removal once the flat blobs are gone.
15. **The legacy LinkedIn copy path remains live** as the copy endpoint's no-action fallback (`generate-copy.js` L142 to L310), duplicating steering and audit logic that `src/copy/generate.js` now owns for catalog types. Divergence between the two is possible on any change to one; a change to either must check the other.

16. **ADR 0017 step 4 is live: the compile path reads accepted protections.** `src/refusals/store.js` holds the per-client protections document and its lifecycle: propose, accept, decline, retire, observe, supersede. Three actions on `api/brand-brain/index.js` reach it: `read_refusals`, `rule_refusal`, `seed_refusals`. The brain review screen renders proposals with a keep or decline control per entry and shows the derivation each one rests on. `package.js#rejectsDirection` compiles a client's accepted protections as avoid-clauses once at least one exists, and compiles `livedWorld.rejects` for every client that has none. MycoPop and Dialog Health are the two clients past that line; every other client is unaffected by the deploy. Grammar rejects remain synthesis output and are still not a compile source. **The known edge, from the ADR amendment: a client who declines every entry keeps `livedWorld.rejects` compiling despite having ruled.** That is over-blocking, the accepted error direction, and it resolves on the first acceptance or on a deliberate retirement.

    **Seeding from a fixture is the bootstrap mechanism for two clients and for no others.** MycoPop and Dialog Health have protections authored ahead of the matcher, in `src/refusals/bootstrap.js`, generated from the judged step 1 fixtures and carrying their derivations. Every entry enters as a proposal even where the fixture had it active, because nobody has ruled on it in this surface. Every client after these two receives proposals from synthesis through the concern matcher, which is ADR 0017 step 2 and is parked. A reader meeting `bootstrap.js` later should read it as a one-time bridge rather than as the design.

    Two departures from the claims store pattern are deliberate and recorded in `docs/evaluations/2026-08-17-adr-0017-step1-refusals-gate.md`: the lifecycle is a pure document layer with the blob factory composed on top, and deletion is absent, with retirement as a named status. A third was added here: a failed read throws rather than returning an empty document, because the seed guard decides on emptiness and a transient read failure reported as "no protections" could seed over a ruled slate.

    **The blob path is confirmed. Amended 2026-08-17.** The store's read and write were modeled on the claims store and carried no blob call through them, so this contract labeled the path Reasoned and told readers to treat it as unconfirmed. The first real write happened on 2026-08-17: the owner seeded both clients from the deployed app, ruled on entries, and reloaded, and the rulings came back in the state they were left in. That exercises the whole round trip on real client storage: `readOrCreate` against a namespace with no document, the seed write, `readOrCreate` against a namespace that now has one, a ruling write, and a read after it. The client switcher was exercised in the same pass and each brand showed its own protections. **The path is Verified from here.**

    Exercised by that confirmation: read, seed, accept, and persistence across a reload. **Not yet exercised on real storage:** decline, retire, supersede, and `recordObservation`. They share the same read and write functions, which is why this note calls the path confirmed rather than every operation confirmed, and the distinction is stated so a later reader does not read more into it than happened.

## Acceptance

Per the spec, verbatim: a session that has read only this contract can answer, without opening the code, what happens between the user clicking generate and the image appearing; which module owns any named behavior; which invariants a change to any listed module must be checked against; and which parts of the pipeline are known-broken-and-waiting. Spot check: the owner picks three behaviors from memory of past incidents and verifies the contract answers each with a correct citation.
