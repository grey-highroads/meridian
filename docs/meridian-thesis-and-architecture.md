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

Corrected 2026-08-21. The paragraph above called for a rebuild that produces a candidate for approval. Ruled instead: after the first approval there is no rebuild. The brain changes only by integrating new or re-read sources, with every change ruled by a person. A brain wrong at its foundation is retired and a new artist record started, explicitly. Re-synthesis is not a concept in Meridian.

Nothing writes into this layer without a human ruling. A tour can propose candidate guidance when it closes. A person promotes it or does not.

Memory is built in three stages and the first is the only one in the pilot. First, facts: who approved what, what changed, which version replaced which, when direction moved. Later, pattern extraction from those facts. Much later, recommendations. "This artist prefers dark cinematic visuals" is an interpretation and is never recorded as a fact by the system.

Ruled 2026-08-21, two identities under one artist. An artist can carry more than one stage identity (for the first artist: main stage and Hot Country Knights). The brain holds them as named identities under one artist record. Every piece of evidence is tagged main stage, second identity, or shared (the voice, the catalog, career facts). Visual language, prohibitions, and stage history are kept per identity and never merged. A tour names which identity it is for, that choice carries into every brief under it, and the brain surfaces only that identity plus shared. A brief that needs the other identity says so on purpose and records why. Adding a third identity is adding a name, not re-ingesting.

Ruled 2026-08-21, what intake builds and from where. The brain is the public brand as crafted: what the artist and their team put out, what trade and music press reflect of it, and what past shows looked like. It is not what people think of the artist. Facets: catalog and eras; live history (tours, stage design, setlists, who built past shows); visual language by era; brand and story as the artist tells it; people and business; what the brand avoids, read from the brand itself. Fans and culture are in only as the brand uses them. Sources in order: official channels and releases, label and management, trade press including production and lighting outlets and designer portfolios, established music press, concert reviews, setlist and tour databases. Forums and social comment are out. The unit of storage is a claim with its date, facet, identity, and evidence; findings are synthesized per facet from claims and a person rules on findings. Before any source is read, the model's unresearched prior is written down and stored unseen; every finding is then confirmed, corrected, or new against it, and the step 3 gate is counted from the new bin. Nothing unsourced is shown. Intake is performed by Higher Roads with a model as the tool, following a short playbook written from the first run; nothing automates it until a later artist proves the need. The app holds what intake produces (sources, claims, findings) as versioned objects under the artist, with a surface for a person to approve findings into the brain. Ruled 2026-08-21: the brain's value is what it does with that context at decision time, and that is where build effort goes.

Ruled 2026-08-21, reference works as index. Reference works that aggregate other sources, Wikipedia among them, are not sources and are not admitted to the tier list. They are read as an index, to find the primary sources they cite. No claim may rest on an aggregator as its only evidence.

Ruled 2026-08-21, what evidence is made of. Evidence on a claim is the source URL plus a locator and a paraphrase sufficient for a Higher Roads reviewer to check it. Verbatim passages are not stored. A quoted fragment is kept only where the exact wording is itself the fact, and never more than one per source.

Ruled 2026-08-21, syndicated copies count once. A press release or wire story republished across many outlets is one source, not many. The origin document is the source and its republications are not counted. Where the origin cannot be identified, the earliest authoritative copy stands in for it and the rest are dropped. A finding's source count reflects independent sources, because a count inflated by republication overstates the confidence behind the finding.

Ruled 2026-08-21, album packaging credits are a source. Liner notes and physical release credits are the artist's own output and are admitted to the tier list. They are tier 1 when read from the release itself and tier 2 when read from a label page. Retail and discography aggregators that republish those credits remain index only under the reference works ruling. Raised because a full intake pass found no art director, designer, or packaging photographer in any admitted tier, leaving a real hole in visual language, which is the facet the production side asks about first.

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
- Tour direction and Scene direction are two objects. Tour direction is the director's words for the whole tour, stored as given, versioned, kept in the tour's own home with dates, venues, and playback system. Scene direction is Higher Roads' words for one Scene, written against a named version of the tour direction. A brief to Jim carries the parts of the tour direction a person selected as bearing on that Scene, and the version, never the whole text. Ruled 2026-08-22.
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
