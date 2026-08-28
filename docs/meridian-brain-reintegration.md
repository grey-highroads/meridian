# Bringing the Artist Brain back: the initiative and the journey

Date: 2026-08-28
Head at writing: `33b105453e936d050e4ff6511a3acef7282bce60`
Pushed: 2026-08-28, with job one, at head `b136590010f72cc3a2b590d89662fa88f7ca4c56`. The destination is named Intelligence, one word, ruled by Grey 2026-08-28 and corrected here in the commit that fixed the ideas view.
For: the designer first, then builders. This document is orientation and journey, not an assignment. Commit briefs follow separately and will name files.

## Why the brain left, and why it is coming back

The Artist Brain is Meridian's most valuable asset and the reason the company's pitch works: the artist's intelligence persists across tours, so the second tour starts knowing what worked on the first. For Dierks Bentley it holds 261 claims and 80 findings synthesized from 78 public sources, each with its evidence attached, approved by a person. Weeks of work.

And as of this week it has no working surface anywhere in the product. That was ruled deliberately, not lost. The brain's old home was a panel on the Scene page that Grey called a bin: it was shoved where it did not live, undiscoverable, and unclear how it would help. When the Scene page was rebuilt around its actual job, the panel came out, and the register records the gap with a closing condition. The reference view of the brain still exists as a utility page; nothing in the product asks the brain for help.

The lesson from the failed integration is the founding constraint of this one: **the brain does not get a panel, it gets jobs.** Four of them, each a moment where an admin has a question the brain can actually answer with evidence. If a proposed surface cannot say who is standing there and what they are trying to decide, it is the old panel again and it does not ship.

## What the brain is allowed to be

Rules already standing in the thesis and architecture, binding on every design choice here:

- The brain proposes ideas with evidence and never writes prompts. A prompt is execution instructions, and that is production's craft.
- Anything the brain asserts carries its trail: how many sources, which ones. A preference with no trail is a guess and is not shown.
- Governance never decides. Findings are for people to act on. Nothing the brain says gates any action.
- The client never sees a finding, a score, a verdict, or any trace of the brain's existence. Clients see the work, a version, a rationale, and controls.
- Nothing writes into the brain without a human ruling. These four jobs read from it; none of them adds to it.

## The surface

A new left-nav destination named Intelligence, admins only, enforced by the server like every other boundary. It is the brain's working surface, and the existing reference view (what the brain knows, by category, with evidence) becomes reachable from it, so the brain has one home instead of a corner utility. The nav says Intelligence and the page says Intelligence, one word in both places. The brain is what the thing holds; Intelligence is what the person opens. (Named 2026-08-28 so this document and the app never disagree.)

Clients never see the nav item, the surface, or any output from it. This is the first navigation destination that exists for one role only, which is a design question in itself: the client's nav simply does not have it, and nothing in the client's experience implies a missing item.

The page-and-drawer ruling applies with a twist worth thinking through: this whole surface is operator-only, so there is no shared page beneath it and no drawer needed. It is the one place in the app that is all admin. Actions-first still governs its composition: each job leads with the ask, context recruited beneath.

## The four jobs, in ship order

### Job one: Scene ideas (ships first)

**The moment.** A Scene request has arrived. The admin has read it, checked the venue facts, and now wants starting points before the work goes to production. They select a submitted Scene and ask.

**What comes back.** Two or three concept directions, each with a title, an idea a creative person can react to, which moments from the artist's history it rhymes with, and references with their sources. Ideas as kickstarters, not decisions.

**The export.** The packet leaves Meridian as a file, because the admitted reality is that a creative will feed it to a model outside the app. It is called a **concept packet**, never a brief. A brief in Meridian is frozen, versioned, names its direction version, and governs production across the seam; if this export shared the name, the record would hold two different things called brief and one of them is load-bearing. The packet names the Scene, the direction version it was generated against, and the generation date, so whatever happens downstream can be traced to what the brain knew when.

**Why first.** The server never forgot how. The propose action still works and nothing calls it; the register entry written when the Scene panel came out names this exact job as its closing condition.

### Job two: direction against the brain

**The moment.** A creative director's words have just arrived, or moved to a new version. Before Scenes get briefed against it, the admin wants to know: is this direction a departure from who this artist has been, or in lockstep with the new record? Which past themes should the visuals lean on, which should they stay away from, and what older imagery would land as an if-you-know-you-know moment for the fans who know?

**What comes back.** An analysis tied to a named direction version, re-runnable when the direction moves. Every assertion carries its evidence: "across twelve approved treatments and four interviews, these themes recur" is a finding; anything without a trail does not appear. The departure-or-lockstep read, themes to consider and avoid, and the iykyk candidates with the history behind each.

**Why it matters most.** This is the thesis kept: the brain is the context every tour is read against, and until this job exists, nothing has ever actually read a tour against it.

### Job three: artboard review

**The moment.** An artboard has come back from production. Before presenting it to the client, the admin wants a second set of eyes from the artist's perspective: on brand, on tour, any red flags.

**What comes back.** Findings, each with evidence: where the board aligns with the artist's record and the direction, where it departs, anything touching a known prohibition. Findings inform the person; they never gate. Presenting to the client remains one click whether the brain flagged nothing or ten things, because governance checks, Higher Roads decides.

**Where it lives.** This job has two homes: runnable from the brain surface against any version, and surfaced as recruited context under Present to client in the Reviews drawer, because that is the moment of the decision it informs. Same analysis, two doors.

**The hard design problem.** An analysis placed beside an artboard reads as a verdict whatever the label says. The design has to make structurally clear that this is one input to a human decision. The client, on the same board later, sees no trace it ever ran.

### Job four: tour stop flags (ships last)

**The moment.** Ahead of the tour, the admin asks whether any venue raises a media-side concern, and wants something shareable with tour production if one does.

**What comes back, honestly.** Today, less than the job deserves. A venue in Meridian is a name and a place on a date row, and rig detail is free text in the production setup. The brain can read artist-side concerns against what is written; it cannot red-flag a screen count nobody recorded. The register already holds the closing condition: venue and screen specifications as structured fields. This job ships when that data exists, and the shareable artifact for tour production is the reason to build it on structure rather than on prose.

**Design it anyway.** The surface should show all four jobs from day one, with this one honest about what it needs: visible, dated, and saying what has to be true before it works. A grayed mystery button is the wrong version; a stated dependency is the right one.

## The journey, as the admin walks it

She opens Intelligence from the nav. The page leads with the four things she can ask, each in her words: ideas for a Scene, read the direction against the artist, review a board before the client sees it, check the tour stops. Beneath them, the reference: what the brain knows, browsable by category with evidence, the view that already exists.

She picks a Scene from a list of submitted ones and asks for ideas. The ask is one action; there is nothing to configure. What comes back reads like a colleague who knows the catalog: three directions, each saying what it rhymes with in the artist's history and where the evidence is. She exports the concept packet and drops it into her downstream workflow. Total time, a few minutes.

Another day, a new direction version lands. She runs the direction read, learns the new record leans somewhere the last two tours never went, sees which older themes the direction quietly echoes, and shares two iykyk candidates with the creative director, each with its sources. The analysis is on record against direction V02; when V03 arrives, she runs it again.

Job three she never visits this surface for: it meets her in the Reviews drawer at the moment she is deciding whether the client sees a board.

## What this is not

Not a chat window. Each job is an ask with a shaped answer, not a conversation. Not a place the brain volunteers opinions; it speaks when asked. Not a writing surface; nothing here adds to the brain, which grows only through intake and human approval. And never, in any form, visible to a client.

## Sequence and what exists

Ship order: Scene ideas, direction read, artboard review, tour flags. The propose action exists on the server today with no caller. The direction read and artboard review are new model work with the evidence rules above. Tour flags wait on venue structure, already registered.

For the designer, the immediate asks: the surface's composition under actions-first, the evidence presentation (the trail is the product; it must invite reading without burying the finding), the export as an artifact someone hands to tour production or a creative, and the verdict problem on job three. The failing example to avoid is on record: the old Scene panel, which had the content and no job.
