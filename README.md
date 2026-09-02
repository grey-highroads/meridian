# Meridian

The creative intelligence and memory system behind live experiences. Built by Higher Roads Creative.

A tour has many people in it, each with a different picture of what is being made, and nobody sure when something is approved. Meridian is the one reference point they all decide from.

## What it does

Holds a durable, sourced record of who an artist is. Stores a tour's visual direction as given and versioned. Turns a one-sentence direction for a song into concept directions with the artist's history behind them. Sends the chosen concept to production as a versioned brief. Brings the artboard back for review, revision, and client approval. Freezes the approved version as what production must match. Keeps every decision on record with who made it and why.

Meridian makes ideas and keeps the record. Jim's system makes the pictures.

## Read these first

In this order. Each answers one question and none restates another.

| Document | Question it answers |
|---|---|
| `docs/meridian-thesis-and-architecture.md` | What is Meridian? Three layers, the seam, what it is not. Authority on scope. |
| `docs/meridian-roadmap.md` | What gets built, in what order, and what done means. |
| `docs/meridian-seam-with-jim.md` | Where the line with Jim's system sits, what crosses it, what we need from his side. Written for his agent. |

Changes to the thesis are decisions, recorded as such. Findings that conflict with it are recorded before anything is designed around them.

## Origin

Forked from `grey-highroads/brand-world-system` at commit `adab5f6` (2026-08-20), tagged there as the forensic baseline. Other clients' material was stripped in this repo's first commit. The BWS interface and its production stack were removed on 2026-08-31; the storage, versioning, and approval infrastructure were kept.

Meridian is purpose-built. There is no generic platform layer. Shared code is extracted only after two real uses exist.

## Current state

Step 1 of the roadmap. First artist: Dierks Bentley.

`docs/deferred-work.md` holds what is known and not yet done. Read it fresh; every handoff ages the moment it is written.

## Working here

Full rules for anyone pushing to this repo are in `CONTRIBUTING.md`. The short version:

- Read the thesis before forming any opinion. Read the seam document before forming any opinion about Jim's side.
- Fetch from the committed tree before any judgment. Never from memory or local copies.
- Anything not needed by the roadmap's fourteen-step loop waits.
- No em dashes anywhere, including generated text. Plain language everywhere a person reads it.
- Claims in architectural prose are labeled Verified, Reasoned, or Assumed.
- The one-sentence test for any proposal: which layer does it live in, what does it do for the tour in front of us, what does it leave behind for the next one.

## Deployment

Own Vercel project (paid tier), own Blob store, own environment. Nothing shared with BWS. Setup, environment values, and local development are in `docs/vercel-deployment.md`.
