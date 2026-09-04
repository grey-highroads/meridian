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

First artist: Dierks Bentley. First tour: Off The Map, seeded from a fixture whose direction, setup, dates, and themes are Higher Roads' sample content and are labeled as such in the file.

What the tree holds: the artist brain with intake, findings, and approval. A tour with its direction, dates, and production setup stored as given and versioned. Scene requests, concept proposals, and a compiled brief that freezes. A stand-in for Jim's system, a delivery module that posts a frozen brief to his receiver, and the acknowledgement fact that comes back. Higher Roads review, client review with a server-side boundary, and client approval that freezes production intent. An Intelligence surface carrying scene ideas, a direction read, and a board review. Two roles, sign in, and an admin surface.

This does not map to one roadmap step anymore. `docs/meridian-roadmap.md` still says what gets built and why in that order; it no longer says where we are.

`docs/deferred-work.md` holds what is known and not yet done. Read it fresh; every handoff ages the moment it is written.

Corrected 2026-09-04. This section read "Step 1 of the roadmap" from the fork until now, while the tree held everything listed above. Every chat is told to read this file on arrival, so the wrong line was handed to each one. Recorded rather than quietly replaced.

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
