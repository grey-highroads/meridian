# Meridian: Intake Playbook

Date: 2026-08-21
Status: written from the log of the first intake run (Dierks Bentley, 2026-08-21). Corrected as later runs teach more. The rulings it applies live in the thesis; this file says how to carry them out.
Who runs it: a Higher Roads operator, with a model in a chat as the tool. Nothing here is automated. A later artist may prove the need for a script; until then the operator is the script.

## What a run produces

Five files, handed to the app for import:

1. `00-prior.md`: the model's unresearched brain, by facet and identity, each claim with the model's own confidence, plus written predictions of what research will change.
2. `01-sources.md`: the source list in tier order, every URL marked confirmed, index, or constructed.
3. `02-claims.md`: one line per claim: claim, era, facet, identity, source, locator, paraphrase.
4. `03-findings.md`: findings per facet and identity, each with its independent source count and tiers, each sorted confirmed, corrected, or new against the prior, with counts at the top.
5. `04-log.md`: every stage, every block, every judgment call, and timings.

The gate is counted from the new bin and called by a person who reads the findings.

## The stages, in order

**Stage 0: read the thesis at head.** Facets, tiers, identity rule, evidence rule, syndication rule, aggregator rule. From the committed tree, never a project copy; the first run lost fifteen minutes to a stale copy that was missing both rulings. If head cannot be reached, stop.

**Stage 1: write the prior before reading anything.** By facet, split by identity, confidence per claim. Add predictions of where research will change it. Close it. It is not opened again until stage 4 and it is never shown as the brain.

**Stage 2: build the source list against live search.** Remembered URLs fail at stage 3. Mark each URL confirmed, index, or constructed, and validate every constructed URL before extraction; two of seventeen were wrong on the first run and both were caught by accident. Exclude ticket resellers, fan SEO pages, forums, and wire copies. Raise anything not covered by the tier list as a judgment call rather than deciding it.

**Stage 3: extract in batches.** Read each source cold, without the prior. After each batch, name the thinnest facet and the thinnest identity and aim the next batch there. Collapse syndicated copies to their origin at extraction time, not later, or source counts inflate. Evidence is URL plus locator plus paraphrase; a quoted fragment only where the exact wording is the fact.

**Stage 4: close extraction, then write findings in one pass.** Open the prior. Synthesize per facet and identity, count independent sources and their tiers, sort each finding into its bin, compute the counts from the tags. Writing findings before extraction closes forced four patches on the first run; regenerate rather than patch.

**Stage 5: write the log as you go.** Blocks, judgment calls, timings, and what went wrong, at the same weight as results.

## Rules learned the hard way

- For every outlet in tiers 2 to 5, find and page the site's own search endpoint before any general web search. On the first run one trade outlet's search returned about ninety items where general search had returned six, and everything of value in a whole batch came from that enumeration. General search discovers outlets; site search retrieves from them.
- A page that one reader cannot open is not a page that cannot be opened. A trade magazine flipbook was a wall for the chat and a click for the operator. Exhaust the cheap enumeration first, then ask the operator for the one thing that needs a person.
- A site's terms footer is not a governance question. We synthesize, we do not reproduce, we do not train, and we pace retrieval. State that once and move on.
- Aggregators (Wikipedia, IMDb, IMVDb, Discogs, Tidal credits, and their imitators) point at sources and never supply evidence. One aggregator invented a band member on the first run.
- A label press release syndicated to eight radio sites is one source at origin; on the first run one of the eight misspelled a director's name.
- When the artist speaks about the second identity as himself, tag the claim shared, not second identity.
- Conflicts between sources are recorded as conflicts with both readings, never picked.
- Container paths and tool names belong in the log, never in an instruction to a person.

## Source tiers, with what the first run learned about each

1. Official channels and releases. The artist site hid everything behind a store and an age gate; the tour page and the second identity's site were the useful parts.
2. Label and management. Press sites carry full track, feature, and video credits; they are the origin for syndicated copies.
3. Trade press and designer portfolios (production, lighting, staging, video; the designers' and vendors' own sites). The richest tier by a wide margin and the one the production side will ask about. Site search first.
4. Established music press interviews.
5. Concert and local reviews.
6. Setlist and tour databases. Delivered more than expected on the first run, including a conflict with a finding from a higher tier.
7. Album packaging credits: liner notes and physical release credits are tier 1 when read from the release, tier 2 from a label page; credit aggregators stay index only. Added after the first run found no art director or photographer in any other tier. Ruling pending the owner's confirmation.

## Cost of the first run

About five hours of operator session time, roughly forty searches and eight full page fetches, no paid sources. 78 sources listed, 261 claims, 80 findings, 44 new.
