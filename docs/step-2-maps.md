# Step 2 maps

Date: 2026-08-21
Read from the committed tree at `ad08d3fcc2898524ff4bd63c75e9d1bc58de5a16`.
Purpose: roadmap step 2. Four maps, plus a fifth on decision records, plus the blockers list. Nothing here is a recommendation or a plan.

Every entry is labeled Verified (read from the tree at head), Reasoned (derived from something verified), or Assumed (needs checking).

Note on the fifth map: roadmap step 2 authorizes four maps and one blockers list. The decisions map was added by the instruction that produced this file. It is recorded so the count is not mistaken for drift. Verified against `docs/meridian-roadmap.md` at head.

---

## 1. Dependencies

### Top-level folders

| Folder | What it depends on | What depends on it | Label |
|---|---|---|---|
| `api/` | `src/` only, plus `@vercel/blob` in `api/blob/upload.js`. No file in `api/` imports another file in `api/`. | The browser calls it over HTTP from `app/app.js` and `app/upload-client.js`. Nothing imports it. | Verified |
| `app/` | Nothing at module level. `app/app.js`, `app/place.js`, and `app/upload-client.js` import no modules. They reach the server by `fetch` only. | Built by Vite into `dist/`. `test/browser-prototype.test.js` loads `app/app.js` through `node:vm` and reads it as text. | Verified |
| `src/` | Node built-ins, `@vercel/blob`, `ajv`, `ajv-formats`, `officeparser`. | `api/`, `scripts/`, `test/`. | Verified |
| `schemas/` | Nothing. Static JSON. | `src/validation.js` loads `schemas/v1` by directory path, not by import. | Verified |
| `fixtures/` | Nothing. Static JSON. | `scripts/validate-fixtures.js` reads four of them by path. `test/compiler.test.js` reads from the same tree. | Verified |
| `scripts/` | `src/`, Node built-ins. | `package.json` scripts `dev`, `predev`, `validate:fixtures`. `test/brand-brain-openai.test.js` imports `scripts/dev-server.js`. | Verified |
| `test/` | `src/`, `scripts/dev-server.js`, `app/app.js` as text. | Nothing. | Verified |
| `docs/` | Nothing. | Nothing in code. `test/vercel-deployment.test.js` reads `vercel.json` and `middleware.js`, not docs. | Verified |
| `specs/` | Nothing. Prose only, BWS era. | Nothing in code. | Verified |
| `legacy/` | Its `.mjs` harnesses import from BWS-era paths. | Nothing in `api/`, `app/`, `src/`, `scripts/`, or `test/` imports anything under `legacy/`. It can be deleted without touching a running path. | Verified |
| Root files | `middleware.js` imports `@vercel/functions`. `vite.config.js` builds `app/`. `vercel.json` sets the function config. | Vercel runtime. | Verified |

### Files under `api/`

Each row lists what the file imports and what reaches it. Nothing imports any file in `api/`, so the second column is the browser call site. Verified for every row.

| File | Imports | Reached by |
|---|---|---|
| `api/auth/login.js` | `src/server/http.js` | Public path in `middleware.js`. No `fetch` call in `app/` names it; the login form posts to it from `app/landing.html`. |
| `api/blob/upload.js` | `@vercel/blob`, `src/brand-brain/store.js`, `src/server/http.js` | `app/app.js` and `app/upload-client.js`, four call sites. Public path in `middleware.js`. |
| `api/brand-brain/index.js` | `src/brand-brain/store.js`, `src/claims/store.js`, `src/refusals/store.js`, `src/refusals/bootstrap.js`, `src/claims/copy-audit.js`, `src/server/http.js` | `app/app.js`, three call sites. |
| `api/brand-brain/save.js` | `src/brand-brain/service.js`, `src/brand-brain/store.js`, `src/server/http.js` | `app/app.js`, one call site. |
| `api/brand-brain/synthesize.js` | `src/brand-brain/service.js`, `src/brand-brain/store.js`, `src/server/http.js` | `app/app.js`, one call site. |
| `api/clients/index.js` | `src/clients/store.js`, `src/server/http.js` | `app/app.js`, two call sites. |
| `api/production/current.js` | `src/production/service.js`, `src/production/store.js`, `src/server/http.js` | `app/app.js`, one call site. |
| `api/production/generate-copy.js` | `src/brand-brain/store.js`, `src/products/store.js`, `src/claims/store.js`, `src/claims/assembly.js`, `src/scope/resolver.js`, `src/claims/copy-audit.js`, `src/copy/generate.js`, `src/production/looks.js`, `src/server/http.js` | `app/app.js`, six call sites. |
| `api/production/generate.js` | `src/brand-brain/store.js`, `src/products/store.js`, `src/claims/store.js`, `src/refusals/store.js`, `src/production/service.js`, `src/production/composite.js`, `src/production/store.js`, `src/server/http.js` | `app/app.js`, three call sites. |
| `api/production/outputs.js` | `src/production/store.js`, `src/server/http.js` | `app/app.js`, eight call sites including two query-string forms. |
| `api/production/preflight.js` | `src/brand-brain/store.js`, `src/products/store.js`, `src/claims/store.js`, `src/refusals/store.js`, `src/production/service.js`, `src/server/http.js` | `app/app.js`, one call site. |
| `api/products/index.js` | `src/brand-brain/store.js`, `src/products/store.js`, `src/products/service.js`, `src/server/http.js` | `app/app.js`, thirteen call sites. |

There are twelve files under `api/`, so twelve serverless functions. Verified by count.

### Reverse map for `src/`, so a deletion can be traced three steps out

Read this as: deleting the left column breaks the right column, and then whatever the right column feeds. Verified for every row.

| Module | Imported by |
|---|---|
| `src/server/http.js` | all twelve `api/` files |
| `src/brand-brain/store.js` | eight `api/` files, `scripts/dev-server.js` |
| `src/products/store.js` | `api/production/generate-copy.js`, `api/production/generate.js`, `api/production/preflight.js`, `api/products/index.js`, `src/production/service.js`, `src/products/service.js` |
| `src/brand-brain/service.js` | `api/brand-brain/save.js`, `api/brand-brain/synthesize.js`, `src/production/service.js`, `scripts/dev-server.js` |
| `src/brand-brain/chat-completions-provider.js` | `src/brand-brain/service.js`, `src/products/service.js`, `scripts/dev-server.js` |
| `src/brand-brain/schema.js` | `src/brand-brain/chat-completions-provider.js` only |
| `src/brand-brain/source-normalizer.js` | `src/brand-brain/service.js`, `src/products/service.js` |
| `src/brand-brain/source-reader.js` | `src/brand-brain/service.js`, `src/products/service.js`, `scripts/dev-server.js` |
| `src/production/service.js` | `api/production/current.js`, `api/production/generate.js`, `api/production/preflight.js`, `scripts/dev-server.js` |
| `src/production/store.js` | `api/production/current.js`, `api/production/generate.js`, `api/production/outputs.js`, `scripts/dev-server.js` |
| `src/production/package.js` | `src/production/service.js` only |
| `src/production/prompt-craft.js` | `src/production/package.js` only |
| `src/production/looks.js` | `src/production/package.js`, `api/production/generate-copy.js` |
| `src/production/composite.js` | `api/production/generate.js` only |
| `src/claims/store.js` | `api/brand-brain/index.js`, `api/production/generate-copy.js`, `api/production/generate.js`, `api/production/preflight.js` |
| `src/claims/assembly.js` | `api/production/generate-copy.js`, `src/production/service.js` |
| `src/claims/copy-audit.js` | `api/brand-brain/index.js`, `api/production/generate-copy.js`, `src/copy/generate.js` |
| `src/copy/generate.js` | `api/production/generate-copy.js`, `src/production/service.js` |
| `src/copy/display-budget.js` | `src/copy/generate.js`, `src/production/package.js`, `src/production/service.js` |
| `src/copy/prose-check.js` | `src/copy/generate.js` only |
| `src/copy/types.js` | `src/copy/generate.js` only |
| `src/scope/resolver.js` | `api/production/generate-copy.js`, `src/claims/assembly.js`, `src/production/package.js`, `src/production/service.js` |
| `src/refusals/store.js` | `api/brand-brain/index.js`, `api/production/generate.js`, `api/production/preflight.js` |
| `src/refusals/bootstrap.js` | `api/brand-brain/index.js` only |
| `src/clients/store.js` | `api/clients/index.js` only |
| `src/products/service.js` | `api/products/index.js` only |
| `src/renderers/openai-images.js` | `src/production/service.js` only |
| `src/lookup.js` | `src/copy/display-budget.js`, `src/production/looks.js`, `src/production/package.js` |
| `src/compiler.js` | `src/index.js` only |
| `src/validation.js` | `src/index.js`, `src/compiler.js` |
| `src/index.js` | `scripts/validate-fixtures.js` only |

Two findings from the reverse map.

- The compiler subtree (`src/index.js`, `src/compiler.js`, `src/validation.js`, `schemas/v1`, `fixtures/`) is reached only by `scripts/validate-fixtures.js` and `test/compiler.test.js`. No `api/` route touches it. Verified.
- `src/production/service.js` is the widest module in the tree. It reaches the brain service, the product store, the OpenAI image renderer, claims assembly, copy generation, display budgets, scope resolution, and the package compiler. Deleting anything under it is a three-step trace through `api/production/generate.js`, `preflight.js`, and `current.js`. Verified.

---

## 2. Data

### Server state, Vercel Blob

Every path below is a Blob pathname. `{clientId}` comes from `resolveClientId`. All writes use `access: "private"`. Verified for every row.

| Path | Written by | Read by | Overwrite behavior |
|---|---|---|---|
| `brand-world-system/clients/index.json` | `src/clients/store.js` | `src/clients/store.js` | `allowOverwrite: true`, no random suffix |
| `brand-world-system/clients/{clientId}/state/current.json` | `src/brand-brain/store.js` | same | `allowOverwrite: true`, no random suffix |
| `brand-world-system/clients/{clientId}/state/backups/brand-brain-backup-{timestamp}.json` | `src/brand-brain/store.js` | by hand only | `allowOverwrite: false`, no random suffix |
| `brand-world-system/clients/{clientId}/sources/` prefix | `api/blob/upload.js` through a signed token | `src/brand-brain/store.js` `readSourceFile` | set by the upload |
| `brand-world-system/clients/{clientId}/claims.json` | `src/claims/store.js` | same | `allowOverwrite: true`, no random suffix |
| `brand-world-system/clients/{clientId}/refusals.json` | `src/refusals/store.js` | same | `allowOverwrite: true`, no random suffix |
| `brand-world-system/clients/{clientId}/products/index.json` | `src/products/store.js` | same | `allowOverwrite: true`, no random suffix |
| `brand-world-system/clients/{clientId}/products/{productId}.json` | `src/products/store.js` | same, deleted by `del` | `allowOverwrite: true`, no random suffix |
| `brand-world-system/clients/{clientId}/production/current.json` | `src/production/store.js` | same | `allowOverwrite: true`, no random suffix |
| `brand-world-system/clients/{clientId}/production/outputs.json` | `src/production/store.js` | same | `allowOverwrite: true`, no random suffix |
| `brand-world-system/clients/{clientId}/production/jobs/{jobId}/output.{ext}` | `src/production/store.js` | same, served through a signed URL | `allowOverwrite: true`, no random suffix |
| `brand-world-system/clients/{clientId}/production/jobs/{jobId}/package.json` | `src/production/store.js` | same | `allowOverwrite: true`, no random suffix |

Two legacy flat paths are still read as a fallback and are not written: `brand-world-system/state/current.json` and `brand-world-system/production/current.json`. `brand-world-system/sources/` is still accepted as a readable source prefix. Verified from the constants in `src/brand-brain/store.js` and `src/production/store.js`.

Every stored path begins with the literal string `brand-world-system`. Verified.

### Server state, local filesystem

`createFileBrandBrainStore` and `createFileProductionStore` write to a directory path instead of Blob. Reached only by `scripts/dev-server.js`, rooted on `BRAND_BRAIN_STORE_PATH` or a default under `.data/`, which is gitignored. Verified.

### Client scoping rule

`resolveClientId(request)` in `src/server/http.js` reads the `x-client-id` header, then a `bws_client` cookie, then falls back to the string `default`. The value is lowercased and stripped to `[a-z0-9_-]`, which is what keeps it safe as a path segment. It is not validated against the caller's identity. The file carries a `PROTOTYPE ONLY` comment saying so and naming ADR 0011. Verified.

Consequence, Verified: any authenticated caller can set `x-client-id` to any value and read or write that client's namespace. The shared password is the only gate in front of it.

`brand-world-system/clients/index.json` is deliberately outside the per-client namespace, so the client list is global. Verified.

### Browser state

- `app/app.js` holds one `state` object in memory, declared at line 1228. It resets on reload. Verified.
- `state.campaigns` is seeded in memory, is not client-scoped, and is not persisted. Verified, and recorded in `docs/deferred-work.md`.
- `state.dismissedDrift` and `state.dismissedOutputDrift` are in memory and reset on reload. Verified.
- `state.outputs` is the single store for generated outputs in the browser, populated from `api/production/outputs`. Verified.
- Two cookies: `bws_client` carries the active client id and is written by `app/app.js` line 10126 with a one-year max age; `bws_session` carries the base64 of `brandworld:{password}` and is checked by `middleware.js` and `src/server/http.js`. Verified.

---

## 3. Outside services

| Service | Endpoint | Env value | Files that call it | Label |
|---|---|---|---|---|
| OpenAI chat completions, brain synthesis | `https://api.openai.com/v1/chat/completions` | `OPENAI_API_KEY`, model from `OPENAI_MODEL` or the `gpt-5.6` default | `src/brand-brain/chat-completions-provider.js` | Verified |
| OpenAI chat completions, product synthesis | same | `OPENAI_API_KEY`, `OPENAI_MODEL` passed from `api/products/index.js`, default `gpt-5.6` | `src/products/service.js` | Verified |
| OpenAI chat completions, copy audit | same | `OPENAI_API_KEY`, model argument defaulting to `gpt-4o` | `src/claims/copy-audit.js` | Verified |
| OpenAI chat completions, copy generation | same | `OPENAI_API_KEY`, `gpt-4o` in a module constant | `src/copy/generate.js` | Verified |
| OpenAI chat completions, scene brief and copy routes | same | `OPENAI_API_KEY`, `gpt-4o` hard-coded at four sites | `api/production/generate-copy.js` lines 263, 302, 565, 606 | Verified |
| OpenAI image generations | `https://api.openai.com/v1/images/generations` | `OPENAI_API_KEY`, model `gpt-image-2` in a module constant | `src/renderers/openai-images.js`, called from `src/production/service.js` | Verified |
| OpenAI image edits | `https://api.openai.com/v1/images/edits` | `OPENAI_API_KEY`, model `gpt-image-2` | `src/renderers/openai-images.js` and `src/production/composite.js` | Verified |
| Firecrawl page scrape | `https://api.firecrawl.dev/v1/scrape` | `FIRECRAWL_API_KEY`, and the call returns null when it is unset | `src/brand-brain/source-reader.js` | Verified |
| Arbitrary remote pages | whatever URL a source names, guarded by `assertSafeRemoteUrl` and a DNS check | none | `src/brand-brain/source-reader.js` | Verified |
| Vercel Blob | the `@vercel/blob` client | `BLOB_READ_WRITE_TOKEN` when present, otherwise Vercel OIDC | `src/brand-brain/store.js`, `src/claims/store.js`, `src/clients/store.js`, `src/production/store.js`, `src/products/store.js`, `src/refusals/store.js`, `api/blob/upload.js` | Verified |
| Vercel edge middleware | `@vercel/functions` | `BRAND_WORLD_ACCESS_PASSWORD` | `middleware.js` | Verified |

Other env values read in code: `VERCEL` (platform flag, `api/auth/login.js` and `src/server/http.js`), `BRAND_BRAIN_STORE_PATH` and `PORT` (`scripts/dev-server.js` only). Verified.

`FIRECRAWL_API_KEY` is read by the code and is absent from `.env.example`. Verified.

Three model names are live across these calls and one environment value does not govern all three. Verified, and already recorded in `docs/deferred-work.md`.

---

## 4. Vocabulary

The Meridian column is taken from `docs/meridian-thesis-and-architecture.md` at head. Where the thesis names no successor, the row says the word does not survive.

| BWS word | Where it is met | Meridian word | Label |
|---|---|---|---|
| brand | interface, `brandName` in state, every Blob path prefix, package name | artist | Verified from the thesis line "The artist is the brand" |
| Brand Brain | interface, `api/brand-brain/*`, `src/brand-brain/*` | Artist Brain, the artist layer | Verified |
| brand world | interface, `compileBrandWorldImagePackage`, access password name | does not survive as a user word. The compiled artifact behind it is Jim's side | Reasoned from the thesis section on the seam |
| campaign | interface, seeded `state.campaigns` | tour | Reasoned. The thesis names the tour as the one-cycle layer and no campaign object survives it |
| product | Products screen, `src/products/*`, product records | does not survive. The nearest Meridian object is the assignment, and it is not the same shape | Reasoned |
| client | client switcher, `resolveClientId`, every Blob namespace | account in the organization layer, usually the artist's organization | Verified |
| package, generation package | `src/production/package.js`, `schemas/v1/generation-package.schema.json` | does not survive on our side. Prompt compilation is execution and belongs to Jim | Verified from the thesis line that the brain does not write prompts |
| render | interface verb, `src/renderers/*` | does not survive. Meridian does not render | Verified from "What this product is not" |
| refusal | interface, `src/refusals/*`, ADR 0017 | prohibition, in the artist layer | Verified. The thesis names prohibitions as artist-layer content |
| look | `src/production/looks.js`, the picker | does not survive as a governed object. Visual direction sits in the tour layer, stored as given | Reasoned |
| claim | `src/claims/*`, copy audit | evidence behind an artist-layer assertion. The copy-governance meaning does not survive | Reasoned |
| output | Snapshot screen, `outputs.json` | artboard, and its versions | Verified |
| job | `jobId` in Blob paths and the production store | assignment on our side, job on Jim's side of the seam | Verified from the seam document's `jobId` field |
| brief | `schemas/v1/job-brief.schema.json`, the brief flow | creative brief, versioned, naming the direction version it was written against | Verified |
| snapshot | the Snapshot screen | does not survive as a screen name. The record it showed becomes the decision trail | Reasoned |
| guidance, guardrail | brain sections, prompt protection block | artist-layer prohibitions and visual language | Reasoned |
| canon | ADR 0002, promote-to-canon action | artist layer, and promotion still needs a human ruling | Verified |
| drift | Snapshot drift rows | the thesis names no successor. The nearest idea is naming which assignments and artboards a direction change affects | Reasoned |
| studio, Design Studio | interface | does not survive. Concept development replaces it on our side | Reasoned |
| placement, format | brief flow, two disagreeing catalogs in `app/app.js` | technical profile, venue and screen details in the tour layer | Reasoned |
| display copy | ADR 0014, `src/copy/display-budget.js` | does not survive | Reasoned |
| aesthetic mode | `AESTHETIC_MODES` in the compile path | does not survive. ADR 0018 already retired it on paper | Verified |
| visual grammar | ADR 0016, brain artifact | visual language in the artist layer | Reasoned |
| protected asset, exact asset | intake, `schemas/v1/protected-production-asset.schema.json` | does not survive on our side. Asset handling is Jim's | Reasoned |
| segment | `src/scope/resolver.js`, claims scoping | does not survive | Reasoned |
| deliverable preset | `schemas/v1/deliverable-preset.schema.json` | does not survive | Reasoned |
| installation | ADR 0007, `schemas/v1/installation-profile.schema.json` | account in the organization layer | Reasoned |
| approval | brain approval, product approval | four distinct actions in Meridian: approve for client viewing, return for revision, client approval, promote to artist canon | Verified |
| evaluation, finding | evaluation screens, governance output | finding, and the client never sees one | Verified |

Words Meridian needs that have no BWS ancestor at all: tour direction, assignment, artboard version, production intent, technical profile, venue, screen, permission, actor. Verified by grep at head: `tour`, `artboard`, and `artistId` appear nowhere in `api/`, `src/`, `app/`, `scripts/`, `test/`, `schemas/`, or `specs/` as an entity. The four hits for the word assignment are comments and one section title inside the prompt compiler. Verified.

---

## 5. Decisions

Eighteen ADRs under `docs/decisions/`, plus a README index. Statuses below are read from the index at head. The binding column is Reasoned unless marked otherwise, and it is a reading of each ADR against the thesis, not a ruling.

| ADR | Status in the index | Binding on Meridian or BWS history | Reasoning |
|---|---|---|---|
| 0001 separate world-building from production | Accepted | Binding | The same line the thesis draws at the seam, one layer up. Meridian keeps idea and execution apart. |
| 0002 model canon as a governed view | Accepted | Binding | The artist layer is a governed view and nothing enters it without a human ruling. |
| 0003 compile and snapshot production policy per job | Superseded in part by 0005 | BWS history | Prompt compilation is execution and sits on Jim's side. |
| 0004 separate shared platform from private brand data | Superseded in part by 0007 | Binding | The storage separation it describes is what the organization layer inherits. |
| 0005 apply policy presets per workflow stage | Accepted | BWS history | Presets govern a render path Meridian does not have. |
| 0006 treat the generation package as a portable artifact | Accepted | BWS history | The package is a renderer artifact. The Meridian equivalent is the versioned brief, which is a different object. |
| 0007 deliver isolated client installations first | Superseded in part by 0011 | BWS history | Answered again by 0011, and the first Meridian version is one Higher Roads deployment. |
| 0008 use OpenAI as the initial renderer | Accepted | BWS history | Meridian does not render. |
| 0009 update Brand Brain from an approved baseline | Accepted | Binding | The artist layer keeps brain storage, versioning, and approval as they are. |
| 0010 route production feedback through candidate rules | Accepted | Binding in principle only | Nothing moves from a tour to the artist layer without a ruling. The candidate rule mechanism itself is BWS. |
| 0011 operate a shared multi-client deployment | Accepted | Binding | It is the skeleton of the organization layer and it names the `resolveClientId` deficiency Meridian inherits. |
| 0012 model products as governed records | Accepted, implemented | BWS history | Product records have no Meridian successor. |
| 0013 govern copy through derived claims | Accepted | BWS history | Copy governance is outside the three layers. |
| 0014 produce governed copy alongside imagery | Part one shipped, part two revised | BWS history | Same reason as 0013, and imagery is Jim's. |
| 0015 build render quality on people, scene, and rejects | Proposed, four steps shipped | BWS history | A render-quality decision for a renderer Meridian does not operate. |
| 0016 articulate visual grammar and evaluate renders | Proposed | BWS history | The brain artifact idea rhymes with artist-layer visual language. The evaluation half judges renders and does not carry over. |
| 0017 govern refusals as durable records | Proposed, steps 1 and 3 landed | Split | The refusals mechanism is BWS history. Its sequencing step 5, candidate-not-erase on rebuild, is binding and is the artist-layer fix the roadmap names before intake runs. Verified from `docs/deferred-work.md`. |
| 0018 compile scene-relevant prompts and govern looks | Accepted, owner ruled on all five decisions 2026-08-17 | BWS history | It is the newest record and the most likely to be read as current. Every one of its five decisions governs prompt compilation and look selection, which is execution and sits on Jim's side of the seam. |

One finding: the index entry for 0018 was added on 2026-08-21, after the fork. Its Accepted status is a BWS acceptance and carries no authority in this repo. Verified from the index line.

---

## Blockers

Everything that stops one assignment making the fourteen-step loop in `docs/meridian-roadmap.md`. Ordered by the step it blocks.

### No object exists for most of the loop

1. **No tour object.** Step 1 needs a tour with its direction, versioned, with who set it. No tour entity exists in code or schema. Verified.
2. **No stored direction, and no version on it.** Step 1 and step 3 both depend on direction being stored as given and named by the brief. Nothing in the tree stores direction. Verified.
3. **No assignment object.** Step 2 opens an assignment under a tour. The word appears only in prompt-compiler comments. Verified.
4. **No concept development.** Step 3 needs two or three concept directions with references and reasons. The nearest live path is the scene brief in `api/production/generate-copy.js`, which writes render instructions rather than concepts. Verified.
5. **No versioned creative brief.** `schemas/v1/job-brief.schema.json` describes a render job, carries no version, and names no direction version. Verified.
6. **No artboard object and no artboard version.** Steps 5, 6, 7, 8, and 9 all address one. The nearest live object is an output record with a `jobId`, no version chain, and no brief version. Verified.
7. **No revision path against a version.** Step 7 and step 8 need feedback tied to a specific artboard version. Nothing in the production store models a revision. Verified.
8. **No production intent record.** Step 14 freezes a version with the job, brief, and artboard identifiers. No such record exists. Verified.

### No seam

9. **No stand-in for Jim.** Steps 4, 5, 8, and 9 all cross the seam. Nothing in the tree sends a brief out or accepts an artboard back. Verified.
10. **No job identifier that survives the loop.** `jobId` exists in production Blob paths and refers to a render job, not to an assignment. Verified.

### No people

11. **One shared password, no roles.** Steps 10 through 13 need Higher Roads approval and a separate client reviewer login. `middleware.js` and `src/server/http.js` check one installation password with no user identity. Verified.
12. **`resolveClientId` trusts the caller.** Any authenticated request can name any client id in a header. A client reviewer cannot be given a scoped view until this closes. Verified from the `PROTOTYPE ONLY` comment and the code under it.
13. **No permission model.** The thesis puts permissions in the organization layer and has tours read them. No permission field exists anywhere in the tree. Verified.
14. **No distinct approval actions.** Approve for client viewing, return for revision, client approval, and promote to canon are four actions. The tree has brain approval and product approval, both single-actor. Verified.

### Known damage on the artist layer

15. **Rebuild erases the approved brain.** `src/brand-brain/service.js` writes `approvedResult: null` on a non-incremental synthesis and the store overwrites in place. The roadmap puts the candidate-not-erase fix before intake runs. Verified from the code and from `docs/deferred-work.md`.
16. **Campaigns are seeded in memory and shared across clients.** Whatever a campaign becomes, its state today is not client-scoped and does not survive a reload. Verified.

### Five tests fail today

Run at head with Node 22.22.2: 125 tests, 120 pass, 5 fail. Verified.

17. `the brand world package is deterministic and preserves the approved Brain version`, `test/production-openai.test.js:49`. The compiled prompt no longer carries the creative-direction sentence the test matches on.
18. `a locked asset uses the edits endpoint with format-aware protection`, `test/production-openai.test.js:157`. The protection block no longer contains the phrase the test matches on.
19. `integrationSentence adds format-specific physical behaviors`, `test/prompt-craft.test.js:31`.
20. `locked product asset gets format-aware protection with state lock`, `test/prompt-craft.test.js:85`.
21. `non-stateful product format skips the state-lock sentence`, `test/prompt-craft.test.js:96`.

All five assert exact strings against output from `src/production/prompt-craft.js` and `src/production/package.js`. The wording in those two files changed and the assertions did not follow. Reasoned from reading both sides. All five sit on the prompt compile path, which the vocabulary map places on Jim's side.

### Platform

22. **Two-commit deploy is still required.** Verified at the fork on 2026-08-21 and recorded in `docs/deferred-work.md`. Every content commit needs a trigger commit behind it.
23. **Function count is at twelve.** Twelve files under `api/` means twelve serverless functions. `docs/deferred-work.md` names a twelve-function Hobby ceiling; `README.md` says this project is on a paid tier. Which limit applies here is unverified. Assumed until the Vercel project settings are read.
24. **The repo still calls itself Brand World System.** `package.json` name, the `brand-world-system` Blob prefix on every stored path, and `BRAND_WORLD_ACCESS_PASSWORD`. None of it blocks the loop mechanically. Recorded because a client reviewer in step 12 reaches a page behind a password named for another product. Reasoned.
