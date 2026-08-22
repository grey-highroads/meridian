# Meridian: Roadmap

Date: 2026-08-20
Owner: Grey. Agreed between both architects.

## What we are building

The thesis and the three layers (artist, tour, organization) are in the thesis and architecture document. This roadmap builds them bottom up. Each step names the layer it builds.

A system that takes a tour manager's request for a live visual, develops it into a concept with the artist's history behind it, hands the chosen concept to Jim, brings his artboard back for review, gets it approved by Higher Roads and then by the client, and hands the approved version to production with nothing left to memory.

The one sentence we are proving: a tour team trusted what they approved, and what they approved is what reached the screen. The loop below is how we prove it. If it works for one assignment, the business exists. Everything else waits.

The first version is Higher Roads operating Meridian for the client. Nothing the client configures.

## Why this order

Each step exists because the step after it cannot be trusted without it. Nothing on this list is there because it would be nice or because the old system had it.

## The steps

### 1. Copy the current system into a new home

What: a fresh copy of the Brand World System code in its own repo, its own hosting (paid tier), its own storage. Nothing shared with the marketing product.

Why: so nothing we do here can break MycoPop or Dialog Health, and so we can delete freely.

Done when: the copy runs on its own address and behaves like the original. No new features. The one change permitted in the first commit: other clients' material (campaign copy and refusal statements that live in code) is stripped and the commit message says so. The forensic baseline is the tagged source commit in the original repo, not the fork's first commit.

### 2. Find out what we can safely cut

What: four short maps. What depends on what. Where data lives. Which outside services we use. What each old word (brand, campaign, product) becomes in the new product, or does not. Plus one list: what blocks the first assignment from completing.

Why: the old system grew large. Deleting without these maps breaks things three steps away. Making more maps than these is wasted time; the old system did that and it cost weeks.

Done when: the four maps and the blockers list exist and both architects agree on them. One to two weeks, not more.

### 3. Build the first artist brain and assignment (artist layer, then tour layer)

What: pick one real artist with a tour coming that Higher Roads wants to pitch. Intake is done by a Higher Roads operator with a model, from the source tiers in the thesis, producing sources, claims, and findings with evidence; it synthesizes and does not reproduce. The first run is complete for the first artist (2026-08-21) and its method notes become the intake playbook. The app imports those files as versioned objects under the artist and gives a person a surface to approve findings into the brain; no intake automation is built. Then build one tour on top of it. The tour's visual direction is likely inherited from a creative director the artist hired, so the fixture treats it that way: the director's words stored as given, versioned, and kept apart from anything the brain suggests. One request under that tour shaped like the storm-and-lightning treatment. Every object the workflow needs: artist, tour, assignment, creative brief, artboard, review, revision, approval, production record. The ownership shape is built in now so nothing has to be rebuilt later: Higher Roads owns the app, accounts belong to the artist's organization, users belong to accounts, users carry permissions, and a tour reads those permissions to decide who may approve, reject, or comment on what. Higher Roads' role will differ from tour to tour; that is just different users with different permissions, not a special case. No login work yet.

Before intake runs: the rebuild path is removed, not fixed. The first synthesis is the only full one; after approval the brain changes only by integrating sources under ruling. The server refuses a full synthesis over an approved brain. Ruled 2026-08-21, replacing the earlier plan to make rebuild produce a candidate.

Memory in this step is facts only: who approved what, what changed, which version replaced which. The brain does not learn preferences from the tour.

Why: the artist is the brand and the tour is the latest product. The brain has to know the artist before it can help with the tour, and it is the context the tour is read against, so it is built first. Whether the intake can find detail that makes the creative unmistakably this artist's is the first thing worth knowing, and only a real artist with a real history can answer it. Building toward an artist you plan to pitch means the test output is the pitch.

Done when: you read the brain and find at least three things in it you did not know and would use in a creative conversation with that artist's team, each with its sources attached, and the system can represent every stage of the assignment start to finish without a screen. A second test follows inside this step: given the tour direction and the one assignment, the brain surfaces the findings that apply, says why, proposes two or three concept directions that are unmistakably this artist's with the history each rhymes with, and flags what the brand avoids before a person has to. That is the brain doing its job, and it is proven here before the seam, the screens, or client review.

This is a hard gate. It tests the thesis, not the software. If the brain does not surprise experienced creative people, nothing after this step starts.

### 4. Replace the things a paying client cannot see (organization layer mechanics)

What: real login for the two user types already shaped in step 3. Anything else from the blockers list.

Why: the current system has one shared password. The rebuild button is removed in step 3. Login matters only when a client needs to see something, which is step 5, so it lands here and not earlier. Nothing here carries forward from the BWS single-password model; replace rather than extend.

Done when: two people can log in as different roles and see different things.

### 5. Run the full loop with a stand-in for Jim (tour layer, at the seam)

What: a fake version of Jim's system that accepts our brief and returns an artboard, so we can test our side before his side is ready. Clearly labeled as a stand-in so nobody mistakes its shape for his.

Why: Jim's real inputs are unknown until his discovery work finishes. We cannot wait, and we cannot guess on his behalf.

Done when you, Grey, do this in the live app:

1. Open the tour. Its direction is there, versioned, with who set it.
2. Open the assignment under it.
3. Meridian proposes two or three concept directions with references and reasons, so the team sees what is possible in the artist's world before production begins. You pick one or shape your own. The chosen concept becomes a versioned creative brief that names which version of the direction it was written against.
4. The stand-in receives it with the right job and version numbers.
5. An artboard comes back.
6. You see the artboard next to where it departs from the brief, and any technical details for the tour's screens that need a decision.
7. You send it back for revision.
8. The stand-in receives the revision against the right version.
9. A second artboard comes back.
10. You approve it for the client.
11. A client reviewer logs in separately.
12. They see the artboard, a version label, a short rationale, and approve or comment controls. Nothing else.
13. They approve.
14. The system freezes that version as production intent, carrying the job, brief, and artboard numbers production would need.

If all fourteen happen, the product exists.

### 6. Design the real screens (all three layers; the tour is the working surface)

What: the interface, with the tour as the working surface: its direction, the assignments under it, each artboard's version history, who decided what and why, technical in-tour details surfaced for review, and the client review. The artist brain is the reference surface underneath, one step away whenever a concept needs a detail only someone who knows the artist would know. Screens are for Higher Roads operating and the client reviewing; no client-side setup. Old screens are not reused. Visual tokens from the old design system are kept where they fit.

Why: the old interface was built for a marketer reviewing a beverage brand and mixes nine jobs on one page. Designing from the loop that now works is faster than untangling it.

Done when: every step of the fourteen-step loop has a screen a tour manager could use without being told what any word means, and a tour manager who has never seen Meridian understands its value in five minutes from five screens: what you asked for, how Meridian understood the artist and tour, the approved concept, the feedback trail, and why production matches what was approved. The feeling to produce: more confidence before production starts than they have ever had.

### 7. Connect to Jim's real system (the seam only)

What: swap the stand-in for Jim's actual inputs and outputs. Change the connection, not the app.

Why: by now his discovery work has produced a real contract, and our side has been proven against the loop.

Done when: the fourteen-step loop completes with a real artboard from Jim's workflow.

## Running alongside from week one

**Jim discovery.** A document, not code, answering: what enters his system, what comes out, what an artboard contains, what a revision looks like, what final production consumes. His real workflow shapes the contract. Our stand-in never does.

## Rules that keep this honest

- Anything not needed by the fourteen-step loop waits. No exceptions for good ideas.
- Old code we are not sure about goes into a holding folder with a deletion date. Nothing lives there indefinitely.
- No generic platform layer. Shared code gets pulled out only after two real uses exist.
- You review the live app, not the code. Push first, then you react.
- The client never sees the word finding, a score, or a verdict. They see the work, a version, a rationale, and controls. Confidence is the product; the AI is not.

## What success looks like to the people we want to win

**Tour manager:** sees the concept before money is spent, approves it in two clicks, and can always answer "why does it look like this."
**Creative director:** their direction is stored as given and governs every brief, the artist's real history is one step away when a concept needs it, and when the direction changes the system names which assignments and artboards are affected. A tour's direction never silently becomes permanent canon.
**Technical lead:** final media traces back to the exact approved version and screen spec that governed it.
**Higher Roads:** every decision on record, every client's knowledge durable, and a process no competitor can describe.
