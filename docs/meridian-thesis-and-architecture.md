# Meridian: Thesis and Architecture

Date: 2026-08-20
Status: Founding reference. This document answers "what are we building" so the question does not get reopened. Changes to it are decisions, recorded as such, never drift.
Applies to: the rules of the road, the roadmap, every builder prompt, every design choice.

## The thesis

Meridian is the creative intelligence and memory system behind live experiences. It helps a team explore what is possible within the artist's world before production begins, and keeps everyone deciding from the same reference point. A tour has fourteen people in it, each with a different picture of what is being made, and nobody sure when something is approved. Meridian is the one reference point they all decide from: the tour's creative command center.

Tour visuals are built today by shops that start from zero each cycle and keep their reasoning in email. Nobody holds the artist's history in a form that makes the next tour's creative better, and nobody keeps a record of why the visuals look the way they do.

Higher Roads will. The artist's intelligence persists across tours. Each tour produces a complete record of direction, decisions, versions, and approvals. The second tour for an artist starts knowing what worked on the first.

The biggest win is not the interface. It is that an approved artboard becomes finished media predictably and consistently. That promise is where Jim's technical layer and Meridian's approval layer meet, and it is what makes the whole process something a tour team can trust. Higher Roads is a creative production company whose software makes the creative process something people stop worrying about.

The pitch to a tour manager is the tour: a better, faster, clearer path from request to approved production intent. The reason they stay is the artist layer underneath it.

What Meridian sells is confidence: control, continuity, everyone on the same page, a predictable path from approval to screen. Speed follows from that and is never the pitch. The AI is not the product.

Three kinds of intelligence make that confidence real, and all three matter: artist intelligence (who this is), technical intelligence (what the venues and screens can do), and approval intelligence (who decided what and why). A product with only the first is a context tool with a production plugin. Most technical knowledge lives with Jim today; Meridian's job is to make it visible at decision time, not to own it.

The first version is a Higher Roads service operated through Meridian. Higher Roads builds the artist brain, builds or inherits the tour direction, and facilitates approvals. The client gets clarity. Software the client configures comes after repeated proof.

## The three layers

The system has three layers. They have different lifetimes, different owners, and different jobs. Most architectural questions are answered by asking which layer a thing belongs to.

### Artist layer: permanent

The artist is the brand. This layer holds what the system knows about them: synthesized intelligence from the public record, evidence behind each claim, prohibitions, visual language, stage history, what past tours did and what worked.

It outlives every tour. It is built first because the tour cannot be helped by a system that does not know the artist, and because it is the context every tour is read against.

It is the Brand Brain from BWS, kept nearly unchanged: storage, versioning, approval. One thing BWS planned and never built is required here before the first real brain exists: a rebuild that produces a candidate for approval instead of overwriting the approved brain. (Corrected 2026-08-21 against the committed tree; the earlier text described this as inherited.)

Nothing writes into this layer without a human ruling. A tour can propose candidate guidance when it closes. A person promotes it or does not.

Memory is built in three stages and the first is the only one in the pilot. First, facts: who approved what, what changed, which version replaced which, when direction moved. Later, pattern extraction from those facts. Much later, recommendations. "This artist prefers dark cinematic visuals" is an interpretation and is never recorded as a fact by the system.

The brain is not allowed to surprise the artist's team. Anything it asserts carries its evidence: how many sources, which ones, what kind. "Across twelve approved treatments and four interviews, these themes recur" is a finding. A preference with no trail is a guess and is not shown.

### Tour layer: one cycle

The tour is the latest product, the way an album is a product and the catalog is context. It lives for one cycle and gets the full attention of everyone using the app while it is live.

It holds the tour's visual direction (often inherited from a creative director the artist hired, stored as given and versioned), the people working on it and what each may do, assignments under the direction, creative briefs written against a named version of the direction, artboards and their versions, every decision with who made it and why, feedback, approvals, and the technical details of the venues and screens that need review.

It is additive to the artist layer, never a rewrite of it. When direction changes, the system names which assignments and artboards are affected.

This layer has no equivalent in BWS. It is the new build. The fourteen-step loop in the roadmap lives entirely here.

Governance lives here and reads from the artist layer. It checks a brief or artboard against the direction, the artist's prohibitions, and the technical profile. It produces findings for people to act on. It decides nothing on its own. Governance is how Higher Roads is confident before the client looks. Clients never see its output.

### Organization layer: commercial

Higher Roads owns the app. Accounts belong to the paying organization, usually the artist's. Users belong to accounts. Users carry permissions. A tour reads those permissions to decide who may approve, reject, or comment on which object at which stage.

Higher Roads' role differs from tour to tour: lead on one, collaborator on another. That is different users with different permissions, not a special case. A creative director who is not the client is a user on the account with permission over direction. A manager with final say is a user with permission over approvals. The record reads the same in every case.

BWS has the skeleton of this in client-scoped storage with a server-assigned id. The single shared password is what it never grew into. This layer's mechanics are built last, when a client needs to log in, but its shape is set from the first commit so nothing has to be rebuilt.

## The seam with Jim

The line is idea versus execution, not concept versus production.

Meridian's side: the request, the artist and tour context, and concept development informed by the brain. The brain informs; people create. A one-sentence direction for a song becomes a scene: what it could look like, which moments from the artist's history it rhymes with, references pulled with their sources, two or three conceptual directions with the reasoning attached. Ideas a creative person can react to. Jim works in Meridian too. His concept thinking can happen here and is recorded here alongside everyone else's.

Jim's side: turning the chosen concept into an artboard and the artboard into finished media. Technical interpretation, composition, compositing, the craft. Meridian does not replace visual production; it moves the team from artist intent to a clearly understood creative direction, and Jim turns that direction into the artboard and the media. Reference boards, scene sketches, and visual explorations can live in Meridian as part of concept development. The production artifact never does, and the brain does not write prompts, because a prompt is execution instructions.

The seam touches only the tour layer. A chosen concept goes out from an assignment. An artboard comes back to an assignment. Revisions travel the same path. The artist layer and the organization layer never cross the seam.

This placement also makes a rejected artboard diagnosable: the concept is on record with its references, so it is visible whether the idea missed or the execution did.

The contract is derived from Jim's real workflow. A stand-in adapter proves our side first and is labeled as a stand-in so its shape never becomes his obligation.

Meridian never produces the production artifact and never pretends to replace production expertise. Exploratory visuals in service of a concept are fair; a first draft of the artboard is not. Raising that line again is a reopening of this document, not a feature discussion.

## Rules that follow from the layers

- Build order is bottom up: artist, then tour, then organization mechanics. Daily use is tour-heavy. Commercial value is the organization layer plus the accumulated tour records.
- Nothing moves from tour to artist without a human ruling.
- Governance never decides. People decide. The client never sees a finding, a score, or a verdict; they see the work, a version, a rationale, and controls.
- Direction is stored as given. Interpretation is kept separate and labeled. Every brief says which version of direction it was written against.
- Intent, interpretation, and decision are three recorded things and are never collapsed into one. When a client says the work does not feel like the artist, the record shows which of the four moved: the request, the direction, the artist evidence, or Jim's interpretation. No one owns the gap; the record makes it diagnosable.
- Permissions come from the organization layer. Tours read them. Nothing grants permission inside a tour.
- Anything that does not belong to one of the three layers, or to the seam, is not in this product.

## What this product is not

A renderer of production artifacts. A prompt tool. A replacement for Jim's craft. A general brand platform adapted to concerts. A project-management suite. An AI that judges art. Software the client configures, in its first version: no self-service artist ingestion, no account setup flows, no configuration screens, no templates. Higher Roads operates; the client experiences the benefit.

Three things protected from day one: the artist brain proposes ideas with evidence and never becomes a prompt generator; governance never becomes a creative judge; the product never becomes a project-management system.

## Three boundaries to protect

- Meridian helps create direction; it does not replace artists or their teams.
- Jim creates production artifacts; he does not own the whole context.
- Clients approve confidence, not AI output.

## One-sentence test for any proposal

Which layer does it live in, what does it do for the tour in front of us, and what does it leave behind for the next one? If a proposal cannot answer all three, it waits.
