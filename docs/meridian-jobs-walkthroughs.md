# Meridian: Jobs Walkthroughs

Date: 2026-08-25
Status: draft for tearing up. Written by the architect against the live app at head, honestly, including what is missing and what is noise. The owner and the designer correct what it gets wrong about what people actually want. Once agreed, every screen build cites the job it serves, and review asks "can the person do the job" before it asks whether the record holds.

Format per job: who and the moment; what they want; what they are holding when they arrive; what the app gives them today, stated plainly; where it fights them; what the screen should be. "Today" describes the live app, not the architecture doc.

---

## Job 1: Request a Scene

**Who and when.** A creative director (or Higher Roads after a call with one) has a song and a one-line intention. "Storm and lightning for the closer. It builds and passes inside the song."

**What they want.** To hand that intention over in under five minutes and trust it will not be lost, flattened, or reinterpreted before someone works on it. Then leave.

**What they are holding.** A sentence or a paragraph. Maybe a voice memo's worth of context. Maybe references: a photo, a link, another artist's moment they loved. Almost never structure.

**Today.** There is no request surface. The request exists in the fixture because a builder typed it there. A real second Scene cannot be requested through the app at all.

**Friction.** Total; the job cannot be done. And the coming risk is the opposite failure: a request form with required fields that interrogates a person who has one sentence. The doc's word "draft request" matters: a request is allowed to be thin.

**What the screen should be.** One box that takes the sentence as spoken, a place to drop references without naming them, and done. Everything else (identity, era hooks, what the direction says) is Meridian's job to attach, not the requester's job to enter. The record marks who asked and when, silently.

---

## Job 2: Develop the concept

**Who and when.** Higher Roads, sitting with a request, the tour direction, and the brain. The working session.

**What they want.** To get from a sentence to a concept the client will recognize as this artist, with the reasoning attached, without re-reading a research binder every time. And to know what the brand would refuse before they propose it.

**What they are holding.** The request, their own taste, and partial memory of the artist.

**Today.** The best-served job in the app. The Scene page holds the request, direction paragraphs to mark, suggestions on demand with "why this artist" and "where it might miss," prohibitions attached on save, compile and freeze. This job is why the pilot worked.

**Friction.** The page runs top to bottom as a form rather than a session: direction marking, suggestion cards, and the compiled result all compete at once (the workspace re-hierarchy is aimed exactly here). Suggestions arrive as three finished essays rather than sparks to react to; there is no way to say "more like the second one." The marked-paragraph control speaks in indexes, [1] and [4], to a person thinking in Nadia's sentences.

**What the screen should be.** The concept in the center as the thing being made; the request, direction, and brain as material at hand, pulled in when wanted; the brief as the output that assembles from what happened, not a separate chore.

---

## Job 3: Receive the packet, deliver the work

**Who and when.** A media artist, twice. Day one: brief in hand, starting the work. Weeks later: finished artboard, needing to hand it back.

**What they want.** Day one: everything that governs the work in one packet they can take into their own tools, and certainty nothing will move under them while they work. Later: to hand back the work and one paragraph of how they read the brief, and be done until feedback comes.

**What they are holding.** Day one: a login they may use once. Later: files and an explanation.

**Today.** The packet exists and is good: frozen brief, two formats, versioned. But it is downloadable only from the Scene page, and nothing tells the media artist it exists or that it is final. And the way back in does not exist at all: no way to submit an artboard, no way to deliver final media. The stand-in occupies the door. This is the largest gap in the product and it was found by the owner asking a question, not by any review.

**Friction.** Half the job is impossible; the possible half is unannounced.

**What the screen should be.** For a media artist, Meridian is two moments, not a workspace: a packet page (the brief, the version, "this is frozen, nothing changes without a new version reaching you") and a submit page (drop the work, say how you read the brief, flag any technical assumption, send). Everything else in the app is someone else's job and should not be in their way.

---

## Job 4: Review what came back

**Who and when.** Higher Roads, artboard in, before the client sees anything.

**What they want.** Work-first: see it big, compare against last time, check it against what was asked, and either send it onward or say precisely what changes, fast.

**What they are holding.** Judgment, the brief in memory, maybe notes from the client's last reaction.

**Today.** The review page shows the artboard, the concept as built, technical items, review notes, feedback with a region dropdown, the wipe that is really side-by-side, the Scene record, and the client and handoff sections as they accrue. The mechanics all work.

**Friction.** This is the gobbledygook page. It reads as the record displaying itself: version tables, timestamps, the full Scene history, all at equal weight with the work. The artboard, the only thing the reviewer's eyes want, sits at a fixed 640 pixels inside the evidence. The brief being reviewed against is not on the page (it is a download, back on the Scene). The region control is a dropdown of nine place names instead of a mark on the picture. The review-notes-versus-feedback split makes a person decide which box their thought belongs in.

**What the screen should be.** The work at full size. The brief one glance away. One way to say "change this," anchored by pointing. History behind a disclosure for the day it is needed. The record still catches everything; it just stops performing.

---

## Job 5: Decide

**Who and when.** The client. A text says the new version is ready.

**What they want.** Ninety seconds on a phone: see it, trust that what they approve is what will exist, say yes or say what bothers them, in their own words, without learning software.

**What they are holding.** A login they were sent and whatever taste and anxiety they carry.

**Today.** The strongest page in the app, by design: the work, the version, a rationale, approve and comment, nothing else. The three rulings (attribution over permissions) fit it exactly.

**Friction.** Small but real for a ninety-second job: no notification reaches them (the "text that says it is ready" does not exist; someone sends it by hand, which is fine at this scale but is a person doing the product's job); the rationale is one static line where a client deciding between versions wants "what changed since what I said"; and the fixed-width artboard has not met a phone.

**What the screen should be.** Almost what it is. What changed since your last note, above the work. The work sized to the screen in hand. Nothing added.

---

## Job 6: Take it to the screen

**Who and when.** Production, holding an approved artboard, building the show.

**What they want.** The exact approved version, the technical profile it was approved against, and certainty that what plays matches what was approved. Months later, when someone asks why the wall looks like that, the answer on record.

**What they are holding.** The whole downstream pipeline.

**Today.** Production intent freezes the right things: job, brief version, artboard version, playback line, who, when. But it is a paragraph on the review page. Nothing is downloadable at handoff, no delivery record exists to close the loop, and the lifecycle honestly says "hand the approved version to production" with no hand to give it to.

**Friction.** The record exists; the handoff does not.

**What the screen should be.** A handoff packet mirroring the brief packet: the approved artifact, the intent record, the technical profile, one download. And a delivery confirmation coming back, which is the delivery record the lifecycle already defines and nothing writes.

---

## What the six say together

1. The middle of the loop (develop, review-mechanics, decide) is served; both ends (request, media artist, handoff) are missing or nearly so. We built the stations we operate and starved the stations others operate. Consistent with how the pilot was built; wrong for a product other people touch.
2. The evidence-table complaint is Job 4 and the directory, and the cure is one rule applied everywhere: the work in front, the record behind a disclosure. Nothing about the record weakens.
3. Two packets bracket the product: brief out, work back, handoff out. Packets are the product's native gesture at every boundary with the outside world, and they are what makes "use Meridian as version control and approval only" real.
4. Notification is a person's job right now. Fine at pilot scale; it becomes the product's job the first time a client wonders why nobody told them.

## Proposed build order once this document is agreed

1. The inbound door (Job 3's second half): submit-artboard and delivery, attributed, same shape the stand-in stores. Missing under any philosophy.
2. Workspace re-hierarchy (Jobs 2 and 4) on the revised foundation.
3. Request surface (Job 1) and the handoff packet (Job 6), both small.
4. Home and Reviews as designed, which mostly serve Jobs 4 and 5's arrival moments.
