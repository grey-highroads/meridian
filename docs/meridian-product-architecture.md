# Meridian Product Architecture

Date: 2026-08-24
Status: core reference beside the thesis and the experience document. The thesis says what Meridian is; this document says how the product is organized and how screens must behave. Where this document and the thesis speak to the same thing, three rulings dated 2026-08-24 reconcile them; they are recorded at the end of this file and as corrections in the thesis.

## Purpose

Meridian makes the creative production of live tour media easier to understand, manage, review, and deliver.

It replaces disconnected coordination across email, text, file-sharing services, and informal approvals with one versioned record of tour direction, Scene requests, creative concepts, feedback, approvals, production requirements, and final delivery.

Meridian should always help a user answer four questions:

1. Where am I?
2. What is current?
3. What needs my attention?
4. What happens next?

## Core mental model

Meridian is the shared workspace for one artist's active tour.

The primary creative loop: set tour direction, request Scenes, develop concepts, review and approve, produce, deliver.

The Scene is the primary unit of work. The Tour provides the shared creative, scheduling, technical, and team context for every Scene. Reviews move Scenes forward. The Artist Brain contributes approved context when useful; it is not a primary client workspace.

## Product hierarchy

```text
Client account
└── Artist
    ├── Artist Brain
    └── Active Tour
        ├── Tour Direction, versioned
        ├── Dates and venues
        ├── Production setup
        ├── Team and approval authority
        └── Scenes
            ├── Request and source material
            ├── Scene Direction, versioned
            ├── Concepts, versioned
            ├── Feedback and approvals
            ├── Production versions
            └── Final delivery
```

V1 assumes one active tour per artist. Past tours may be retained as records but should not shape the everyday interface.

Vocabulary mapping for builders: a "production version" is the artboard version the seam already defines; a "concept" is the concept record the Scene already holds. This document renames nothing in code or storage.

## Primary navigation

The normal tour workspace has four destinations.

**Home.** The current condition of the tour and what needs attention.

**Scenes.** Everything being requested, developed, reviewed, produced, or delivered.

**Reviews.** A user-specific queue of concepts, versions, questions, and approvals requiring action.

Ruled 2026-08-26. Reviews is no longer an attention queue. Home is the attention surface. Reviews is a gallery of the Artboard versions that exist, arranged by Scene with the newest version first. It carries no counts, badges, or notification language. The same gallery and full-screen viewer serve clients and Higher Roads; the signed-in role changes only the server projection and available actions.

**Tour details.** The shared foundation for the work: creative direction, dates and venues, production setup, team, approval authority.

Artist Brain does not appear in the primary client navigation. Higher Roads users receive a separate Admin utility area for client accounts, artists, Artist Brains, access, and system administration. Built 2026-08-26: Admin and Artist Brain are placed in the top right of every page by `app/shell.js` for the Higher Roads role, and no page carries either link in its markup. The route refuses a client session on its own; a link that is not drawn is never the enforcement. Admin tools stay separate from daily tour production, and Higher Roads operational users work through the same Tour and Scene workflows as everyone else.

## Roles

Roles describe what people do, not what they are locked into. See the attribution ruling at the end of this file.

**Artist management.** Stay informed across the tour, review creative progress, comment on concepts, approve work when holding that authority, see risks, unresolved decisions, and current versions.

**Creative director.** Establish and revise Tour Direction, request Scenes, provide source material and references, review concepts, give creative feedback, approve creative direction.

**Production tour support.** Maintain playback and integration requirements, record venue exceptions, review production versions, confirm technical readiness, identify delivery or compatibility risk.

**Media artist.** Receive an accepted Scene brief, develop and submit concepts, respond to feedback, submit production versions, deliver approved final media. Higher Roads may perform this role but the role is not exclusive to Higher Roads. The media artist's submissions enter Meridian as the inbound payloads the seam document defines; the making happens in the media artist's own system, and Meridian never produces the production artifact.

**Higher Roads administrator.** Create and manage client accounts, create or override Tours and Scenes, manage access, maintain Artist Brains, perform any client-side action when necessary, and correct records with a visible audit trail.

Ruled 2026-08-26. Two roles, attribution for the rest. A user is either a Higher Roads admin or a client. Admins can see and do anything, including acting on a client's behalf. All client users on an account carry the same permissions. What distinguishes a manager from a creative director from a production lead is attribution rather than authority: every action records which specific user performed it. The five roles above describe jobs people do, not permission tiers. Named approval authority per tour is not in this version.

## Approval authority

Approval is explicitly recorded rather than inferred from a broad role. A Tour may name creative approval authority, technical approval authority, and final delivery authority when different; one person may hold several. Naming authorities is available, not required; what is required is the record. Every approval identifies what was approved, the exact version, who approved it, when, and any conditions attached.

Ruled 2026-08-26. Naming approval authorities per tour is not in this version. The text above stands as the shape to return to. Today all client users on an account carry the same permissions, and every approval records the specific user who made it, the exact version, and when.

## Tour creation

Higher Roads creates the client account and invites the client team. An account is created with its first artist in the same step, because a tour sits under an artist and an account with none is an account nobody can work in. An authorized client or Higher Roads user can then create the active Tour with minimal information: artist, tour name, approximate dates, primary contact.

Built 2026-08-26 on `app/new-tour.html`, reached from Home when the account holds no tour. The tour name is the only required value. Rough dates and the main contact are offered and skippable, with the signed in person filled in as the contact. The artist is shown as context while the account holds one and becomes a picker when it holds more. A refused create leaves every typed value on the screen. Creating a tour is the client's own first job and no longer sits on the Higher Roads Admin page.

Ruled 2026-08-26. Tour creation now lives in the no-tour state of Tour details on `app/tour.html`. The standalone creation page is removed. The form and stored tour remain the same, but the work now begins in the section that holds direction, dates, and production details.

Tour setup continues progressively from Home: add Tour Direction, add dates and venues, add production details, assign the team and approval authority, request the first Scene. Dates and production setup are written on `app/tour.html`, each section on its own, neither waiting on the other. Both are stored versioned beside the direction, and every save records who made it and when.

Ruled 2026-08-26. Tour setup no longer continues progressively from Home. A client first receives a short introduction to Meridian. Home then explains the sections that will fill in as the team works, while Tour details holds tour creation, visual direction, dates, and production setup.

Creative work is not blocked because every technical detail is not yet known. Missing information becomes visible when it becomes relevant. A Scene can be requested with no direction, no dates, and no production setup.

## Home architecture

Home has three shapes, decided by what the tour holds.

**No tour in the account.** One sentence about what Meridian is for and one button that starts the tour. Nothing else on the page.

**A tour with no Scenes yet.** Four lines reporting what the tour holds: creative direction, dates and venues, production details, Scenes. Each line names what is stored rather than what the person owes, derives from the stored tour rather than from anything anyone ticks, and opens the place that thing lives. Exactly one line is marked as a good next step, chosen as the first unfilled one. No progress count, no ticks, no percentage, no wizard. Requesting the first Scene sits beside the lines and needs none of them filled in.

**Scenes underway.** The orientation screen below.

Ruled 2026-08-26. The three Home shapes above are superseded. Before Scenes exist, the same explained Home serves an account with no tour and a tour with no Scenes. It introduces what Scenes, Reviews, and Tour Details will hold and points tour creation into Tour Details. Once Scenes are underway, the operational Home below is unchanged.

Home is an orientation screen, not a project database. Its hierarchy:

**Needs your attention.** Only decisions, questions, and work assigned to the current user.

**Scenes in progress.** A concise list: Scene, current stage, owner, next milestone, due date or risk when relevant.

**Tour readiness.** Only missing, changed, or unresolved Tour information, shown prominently.

**Recent decisions.** A short record of meaningful approvals, revisions, and deliveries.

Static project facts are not repeatedly displayed unless they help the current decision.

## Scene lifecycle

```text
Draft request
→ Requested
→ Concept in development
→ Concept review
→ Approved for production
→ Production review
→ Final approved
→ Delivered
```

Feedback may return a Scene to its appropriate development stage without deleting or overwriting prior versions.

At every stage the interface identifies the current stage, the party Meridian is waiting on, the next required action, and the version under discussion. Nobody owns a stage; the record shows who the work waits on.

## Scene workspace

The Scene workspace leads with the current job, not every available record at once. Its hierarchy:

1. Scene name, status, owner, and next action
2. Current work or review surface
3. Relevant brief and Tour context
4. Feedback and approval controls
5. Version history
6. Delivery record

Tour Direction and Artist Brain context appear only when they help the current task. A Scene Direction is a separate, versioned object written against a named version of Tour Direction.

## Reviews

Reviews are a user-facing queue, not an independent creative object. A review points to a Scene, a specific concept or production version, the requested reviewer, the decision being requested, and the due date when applicable.

Ruled 2026-08-26. The queue description above is superseded. Reviews is a gallery of Artboard versions, one row per Scene and newest first. Opening a version gives the work the viewport, with fitting, actual-size panning, and previous or next movement within the Scene. Feedback and actions for that version live in a drawer that starts closed. An unopened stroke is stored per person and clears when that person opens the version; it is orientation, not a notification count. Earlier versions remain readable history and are not actionable.

Feedback belongs to the version being reviewed. Creating a new version does not rewrite previous feedback or approvals.

## Artist Brain

The Artist Brain is built through manual research and approved before it contributes to production. Once approved, it acts as contextual intelligence that can sharpen Scene Direction, suggest relevant creative principles, surface known prohibitions, identify potential contradictions, and support Higher Roads during concept development.

It does not become a large daily management system. Clients do not browse or administer it unless a future product decision explicitly requires that access.

## Versioning and accountability

Meridian preserves an append-only history of material creative decisions. The system never silently overwrites Tour Direction, Scene Direction, concepts, production versions, feedback, approvals, or final deliverables.

Comments and decisions are different: a comment contributes discussion; an approval or change request moves the workflow.

Every material action is an attributed event: what happened, who performed it, when, which object and version it affected, on whose behalf when someone acted for another, and by which path when the route matters (for example brain-assisted or direct). A missing value stays missing; representation is never inferred from a role.

Higher Roads overrides are possible, visible, attributed, and dated.

## Interface consequences

- One dominant purpose per page
- One primary action for the current stage
- Familiar language instead of internal system vocabulary
- Progressive disclosure for history and supporting detail
- No duplicate project summaries in sidebars
- No action buttons unless the action is currently available
- Status, owner, and next step presented together
- Light, readable work surfaces inside a restrained dark shell
- Semantic color used for meaning, not decoration
- Icons paired with visible labels

## V1 non-goals

Multiple simultaneous Tours for one artist. Portfolio management across historic Tours. A general-purpose digital asset manager. A complex Artist Brain revision system. Fully configurable workflow builders. A replacement for casual conversation. Separate applications for every role. Extensive future-state scalability before the primary Tour workflow works.

## Product test

A Meridian screen is successful when a first-time invited user can determine within a few seconds: what this screen is for, what is current, whether anything needs them, and what they can do next. If the screen cannot answer those questions, additional detail is unlikely to fix it.

## Three rulings, 2026-08-24

**Acting on behalf, not gatekeeping.** Nothing requires the client to configure anything; nothing prevents an engaged client from doing so. Higher Roads can perform every act on the client's behalf. Same screens, same record either way. This replaces the earlier reading of "the first version is Higher Roads operating Meridian" as a restriction on clients.

**Stations required, tools optional.** The loop's stations are required: direction named, brief versioned, approvals recorded, versions preserved. The tools at each station are offered, not required. A media artist may paste a finished brief and use Meridian for version control and approval alone; the record shows which path the work took. Meridian still never produces the production artifact.

**Attribution over permissions.** Identity and attribution are mandatory; authority tiers are not. Every action carries who and when. Approval records name the exact version. Higher Roads corrections stay visible and dated. The one standing gate is about surfaces, not people: governance findings and internal review stay on the Higher Roads side of the glass, and the client review surface shows the work, a version, a rationale, and controls.

## One ruling, 2026-08-27

**One send, and the note is optional.** Getting a Scene to production took five gates: save the direction, compile the brief, freeze it, name who receives it, issue the handoff. Four of them carried no judgement. Verified against the committed tree at `a966d88`: `compile-brief` at `api/tour/index.js` line 733 stored nothing and said so at line 746; `freeze-brief` at line 750 discarded that draft and compiled the identical thing again from the identical inputs; `issue-brief` at line 828 derived every field of the handoff and fell back to "Media artist" at line 853, with the due date and contact optional and unused. The only judgement in the sequence is that the brief is right and should go.

The five collapse to one action, **Send to production**. It freezes the newest brief and issues the handoff in one move, always on the newest version rather than offering a version to choose. Both facts are still recorded exactly as before, "Froze the brief" and the sent-to-production fact, with the same actor, version, and path. Sending again returns the handoff that already exists rather than freezing a second brief.

The compiled brief stays on the page the whole time, because compiling is free and reading it is how a person decides. `compile-brief` remains as the read that feeds that view. `freeze-brief` and `issue-brief` remain reachable on the server, `issue-brief` for a second handoff of an already frozen brief. The freeze button and the recipient form are gone from the interface. The revision path is untouched.

**Scene notes are optional.** The Scene request already said what is wanted and the Tour Direction already governs, so the notes box is a small optional field, not the gating step it looked like. It was required in three places and is required in none of them. When nobody writes a note, the concept's idea field carries the Scene request, because a client reads that field back as the one-sentence rationale and it is never stored blank.

## Four rulings, 2026-08-27

Recorded against the committed tree at `8b252c30`.

**The Scene page has one job.** A request arrives. A Higher Roads person opens the Scene to read what was asked, see it beside what the tour direction says and what the venues can take, add a note if they have one, and then either ask the client something or start the work. The page as built did not serve that job. It opened with six paragraphs of the creative director's words and a checkbox against each, identical on every Scene in the tour, and carried an inspector holding whatever had nowhere else to go. The page is now one column: the request at full weight with the references attached to it, what the tour holds, the optional note, the questions, and the two ways out.

**Meridian decides what travels.** Nobody selects which parts of the tour direction bear on a Scene. All of it travels with every brief, because the direction is the governing document and the brief already names the version it was written against. The same rule now covers the dates where the rig differs: every one of them travels, marked by nobody. This is an intended change to the compiled brief. A brief compiled after this ruling carries direction paragraphs and venue exceptions that a brief compiled before it would have left behind. `directionParagraphs`, `venueExceptions`, `directionSelectedBy`, and `directionSelectedAt` are no longer written onto a concept, and `tourDirection.selectedParagraphs` in the brief and its sidecar is now `tourDirection.paragraphs` with no `selectedBy`. The seam contract is corrected in the same commit.

**No governance analysis on the Scene.** A request rarely contradicts the direction at this stage, and the real reading happens downstream during creative execution. Meridian puts the facts where the thought happens and the person decides. Nothing on this page scores, flags, or detects a conflict.

**Asking the client a question does not move the Scene.** A Higher Roads person writes a question against the Scene. It appears in the attention section of that client's Home. The client answers, and the answer lands back on the Scene next to the question, attributed by person and time. Both the question and the answer append a fact. The Scene keeps the stage, the next step, and the party it was already waiting on, because nothing about the work changed. This is a question, an answer, and who said each. It is not a message thread, and an answer is written once rather than edited.

**What came out with the inspector.** The Artist Brain panel was the only surface in the app that called `propose-concepts`. Removing it is the ruling and not an accident. A concept saved from the Scene page now carries a title, the note, and `cameFrom`, and stops carrying `whyThisArtist`, `asksOfProduction`, `whereItMightMiss`, `rhymesWith`, `artistContext`, `avoid`, and `openQuestions`, all of which were populated only by a brain suggestion a person used. The compiled brief still has those fields and they now read empty for new concepts. `propose-concepts` remains on the server, unreached by the interface. Recorded in `docs/deferred-work.md` with the condition that brings a surface back.

## Two rulings, 2026-08-27, second session

Recorded against the committed tree at `d94a4600`.

**The client's Scene answers a question and then gets out of the way.** A client opens a Scene for one reason: Home told her Higher Roads asked her something and she clicked it. So the question comes first, with the answer box already open under it and nothing above it, which is what puts the box in the first screen on a phone. Under it, one plain line saying whether anything else needs her. Under that, her own request as a quiet reference, labelled "What you asked for" rather than "Client request", because the page is talking to her and she is the client. Once answered, the exchange stays readable with both names on it. With no open question the page is the status line and her request, and that is the whole page.

The client Scene never shows the tour direction or any mention of it, venue or rig details, an uploader, notes Higher Roads wrote to itself, or any sentence about how briefs are assembled. This is enforced in the route rather than on the page: `get-scene-workspace` now returns the assignment, the concept, the tour's id and name, and an empty context. A page that hides a thing is a page; the route is what storage listens to.

**The interface never narrates plumbing.** The line "The whole tour direction travels with the brief. Nobody picks parts of it." came off the Higher Roads Scene, along with the sentence explaining that screen detail is prose rather than fields. The direction travels; that is a fact about the system and not something a reader needs told. Architecture vocabulary reaching a reader is a defect under the writing rules in `docs/CONTRIBUTING.md`. The section is now called Venues and screens and shows the dates, the setup, and the dates where the rig differs as facts.

**Attaching happens where the asking happens.** Reference images belong to asking for a Scene, so the upload control lives on the request screen at `app/request.html`, where a client attaches a photo as part of saying what she wants. Both Scene views list what is attached and neither takes an upload.

## One ruling, 2026-08-27, third session

Recorded against the committed tree at `9de17c61`.

**One review surface, and every road points at it.** The Reviews gallery had been live for some time while Home and the Scene still routed people to the two pages it replaced, so the old surface was what a person naturally reached. `app/review.html`, `app/review.js`, `app/client-review.html`, and `app/client-review.js` are removed.

From the Scene, the button announcing work that came back opens the gallery's full view of that Scene's newest version. From Home, a row about work needing a decision opens the same, for either role, at `reviews.html?scene=<id>&version=<n>`, which is the address the gallery already served. The full view opens board first with the drawer closed, and every action the old workstation carried lives in that drawer.

What a client may receive is unchanged. The server projection from `2481978d` is what decides, and this commit did not touch it: `get-reviews` hands a client their own comments and approvals and no internal review or revision, and a deep link to a version nobody presented still gets the refusal the server already gave. The middleware drops the deleted client page from the paths a client may load; the gallery was already on that list, so nothing was opened up.

The build is the check. Whether a road still leads to a removed page is asserted by scanning the built output rather than a list of source files, because a source list goes stale in exactly the way that hides this class of mistake.

## One ruling, 2026-08-27, accepted on the live app 2026-08-28

**The page and the drawer.** Ruled by Grey 2026-08-27, accepted on the live app 2026-08-28. Every surface is one page shared by every role. Actions that belong to the work itself sit inline and are the same for everyone who can act. Everything Higher Roads does about the work, rather than in it, lives in an overlay drawer that clients do not have. No exceptions for importance: if an action is not shared, it is in the drawer. The drawer leads with actions; context sits beneath the action it informs, collapsed until asked for, never consumed as a prerequisite. The page never reflows when the drawer opens. A page with no operator-only work has no drawer. What a role receives remains a server decision; the drawer is where operator work lives, never how it is protected. The pattern primitive lives in `app/design/` and pages consume it.

Built and accepted across Scene, Reviews, and Tour details. The pattern primitive landed in `33b1054`, which added `m-drawer`, `m-drawer__action`, and `m-drawer__context` to `app/design/patterns.css` and recorded the rules for their use in `docs/design-system.md`. Scene and Reviews consume the drawer. Tour details carries the inline half of the grammar and no drawer, because it holds no operator-only work. The design pattern request that covered the drawer is closed in `docs/deferred-work.md` against the same commit.

## One ruling, 2026-08-28

Recorded against the committed tree at `b1365900`.

**The artist's intelligence gets jobs, not a panel.** The Artist Brain panel came off the Scene page on 2026-08-27 for being a bin: it held the content and answered no question anyone had. It returns as a destination of its own, named Intelligence in the rail and on the page, carrying four asks in the words of the person making them. (Corrected 2026-08-28 in the commit that fixed the ideas view. This paragraph first read Artist Intelligence, two words; Grey ruled Intelligence, one word, and the app was changed to match.) Job one is live: pick a submitted Scene, ask for ideas, read what comes back with the research under each one. The other three are visible with honest states. The direction read and the board review say they are coming. The tour stops job names what it needs, which is venue and screen specifications as fields rather than prose.

This is the one surface in the app that belongs to a single role, so it has no shared page beneath it and no drawer. The page-and-drawer grammar still governs its composition: the asks lead, context sits under the ask it informs. The rail link is built by the shell for a Higher Roads session and a client is refused by the middleware and by the route, which is where the boundary lives. `run-scene-ideas`, `get-scene-ideas`, and `get-concept-packet` are absent from `CLIENT_ACTIONS`, so a client session reaching `/api/tour` with any of them gets the same refusal it gets for internal review.

**The export is a concept packet and never a brief.** A brief in Meridian is the frozen versioned document that governs production across the seam with Jim. One word naming two things in the same record costs more than it saves, so the packet does not carry that name in copy, in filenames, or in identifiers. `docs/meridian-brain-reintegration.md` is the orientation for the four jobs and was corrected in this commit so its name for the destination matches the app's.

**Every run is kept.** An analysis names the Scene, the tour direction version it was read against, when it ran, who ran it, the approved brain it came from, the answer, and the evidence. Asking again appends a run and changes nothing about the earlier one, because an idea somebody already acted on is the only record of why the work went the way it did. The record shape is in `src/intelligence/analysis.js` and the other three jobs write the same shape with their own `result`.

## One ruling, 2026-08-28, second session

Recorded against the committed tree at `d9ff1ff0`.

**Intelligence, one word.** The destination is named Intelligence in the rail, on the page, in the browser title, and in `docs/meridian-brain-reintegration.md`. The first build shipped it as Artist Intelligence and the ruling above is corrected in place.

**An idea is what a person takes away, so an idea is what leaves.** The run-level export is gone. Each idea carries Download idea and Copy idea, and both produce the same words: that one idea with the full lineage of the run behind it, which is the Scene, the tour, the direction version, the generation date, the artist knowledge approval date, the run number, and the evidence counts the idea cites. The stored run is unchanged by either. This governs what leaves Meridian, never what Meridian keeps.

**Composition rules for a reading surface.** One column at one measure, shared by everything on the page. An idea is a block with internal hierarchy: title largest, the idea itself as the body, the three qualifying notes clearly subordinate, the two actions at the end. The run and its lineage are context and sit small above the first idea, and nothing on the page is larger than an idea's title. Emphasis comes from the order and the scale; weight is never scattered through running text. A disclosure opens onto something, so where a finding has nothing behind it but its counts and tiers, those are one quiet line and no label is written over a void. An empty section does not render its heading.

**A view is tested on its markup.** The first version of this view was checked by matching strings in the page source and shipped a two-column layout of unequal measures, built by dropping ideas into `m-orientation`, a pattern for a primary panel and an aside. The rendering now lives in `src/intelligence/ideas-view.js` so tests assert what a person receives. Reading a design pattern before using it is the cheaper half of this lesson.


## One ruling, 2026-08-28, third session

Recorded against the committed tree at `4dfc4fd0`. The designer's pass on the Intelligence surface.

**A control opens onto something the reader has not already been given.** The finding and why it belongs here are always read in full and are never behind a disclosure. What degrades is the trail. With independent source counts and tiers alone, the trail is one quiet static line and nothing in it invites a click, because opening it would show the reader the sentence they just read. With claims and sources stored behind it, the same line becomes a disclosure that says what it opens onto and opens onto the sources. Cited findings sit under one visible label, "What this rests on in the artist's history".

**A stored run copies its evidence rather than pointing at it.** An analysis says what the system knew on the day it ran. Storing finding ids alone would have meant a later evidence view resolving an old run against a newer brain, which rewrites what a past analysis rested on. The run now carries the claims and sources as of generation time.

**Feedback lands where the person is looking.** An answer from an idea's own actions renders inside that idea, in a live region, and repaints that idea alone. The page-level callout is for page-level failures. A message about a button at the bottom of the page, rendered at the top of the page, is a message nobody reads.

**The page's own name reads at page scale.** The hierarchy sentence in the previous ruling was about the run header competing with the ideas, not about shrinking the page's name. `m-heading` is restored on the Intelligence heading. The ideas dominate by where they sit and how much of the surface they take.

**Browser rendering lives under `app/`.** `app/intelligence/ideas-view.js` holds the ideas rendering. Testability is not a reason to move an interface into the domain layer, and the earlier placement under `src/` is not a precedent. `src/intelligence/` keeps the analysis record and the packet.

## Three rulings, 2026-08-28, fourth session

Recorded against the committed tree at `db823ea3`. The composition pass on the finished Intelligence behavior.

**The four asks are four instruments over one research archive.** They are not rows in a directory and no whole instrument pretends to be clickable. They sit as a two-by-two field at desktop width and one column at narrow width. Each instrument names the job, says what it returns, and anchors its own action or honest state at the foot. The first holds a labelled Scene choice and Ask for ideas. Two say Coming. Tour stops says Waiting on tour data. Equal stature describes the four jobs; the controls describe which job is live.

**Evidence is recruited after the idea, not imposed before its actions.** An idea, its three notes, and its actions must hold together before a person chooses to read the research. "What this rests on in the artist's history" is therefore one disclosure, closed by default, placed before the actions. Its closed state names the layer and counts the unique findings inside it. It does not sum sources, because findings may rest on overlapping sources. Opening it shows every finding and why it bears on the idea in full. Where a finding carries linked claims and sources, its trail may then open one layer further onto those sources. A counts-only trail remains static.

**The trail line owns source counts and tiers.** Finding prose ends at the substantive finding. The independent source count, tiers, and the intake run's New, Confirmed, or Corrected comparison are metadata and do not repeat inside creative reading prose. The trail line beneath the finding carries the count and tier summary once. This keeps evidence honest without making evidence bookkeeping compete with the finding.

## One ruling, 2026-08-28, fifth session

Recorded after the fourth-session composition landed at `e774400`.

**An answer announces itself in the first viewport.** The four asks remain equal instruments in a two-by-two field, but their first treatment spent enough height that generated ideas began beyond an ordinary laptop viewport. The instruments are compact: tighter padding and type, shorter internal gaps, and the live Scene choice and action on one line. A rule and the visible label "Generated ideas" separate asking from reading, with a quiet count confirming what arrived. The first idea may continue below the fold; the fact that an answer exists may not.

## One ruling, 2026-08-28, sixth session

Recorded after the first-viewport correction landed at `2db05f4`.

**The instrument canvas is wider than the reading measure.** The single-column correction was right about order and wrong to give every kind of content the same narrow frame. Intelligence uses a 70rem canvas so the four instruments can breathe and wrap less. Idea and evidence prose remain capped at the shared 44rem copy measure. The page gets broader; the sentences do not get longer.

## Four rulings, 2026-08-29

Recorded against the committed tree at `23732390`. Job two of Intelligence, the direction read, and the review pass that came with it.

**The direction read is written, and the three groups are the read.** An admin presses one control and Meridian holds the tour direction, at the version stored now, against the artist's approved record. What comes back is three groups: what the direction keeps, where it leaves the record, and what it echoes, the last including the ones only a fan who knows the catalog would catch. There is no summary sentence, no meter, no percentage, and no count of how aligned the direction is. Whether this direction is a departure or in lockstep is the reader's conclusion from the groups, and a model-written sentence saying so would be the verdict this surface is not allowed to produce. The model is instructed against writing one and `renderDirectionRead` in `app/intelligence/direction-view.js` has nowhere to put one.

**An entry the record cannot support does not appear.** Job one drops a citation the brain does not hold and keeps the idea. Job two drops the whole entry, because an idea with a thin trail is still an idea a person reacts to, while a departure nobody can trace reads as a finding about the direction. `checkDirectionRead` in `src/tour/direction-read.js` filters an entry with no surviving finding, and a read that survives with nothing in any group is an error rather than an empty page.

**A read belongs to the direction version it read.** Runs are stored under `directionSubjectId(version)` from `src/intelligence/analysis.js`, so reads chain within a version and start again at run one when the director's words move. `get-direction-read` returns every version's runs, oldest first, so a read made against V02 stays readable after V03 arrives and its run label names the version as well as the number. The evidence snapshot is copied at generation time exactly as job one copies it.

**The run a person is reading is named, not offered as a control.** Before this commit the run picker rendered every run as an identical button with `aria-current` that nothing styled, so the run on screen and the run in history looked the same. The current run is now a state and the earlier runs are buttons. That is the difference stated in words and in available actions rather than in color, which is what version identity asks for.

## Three rulings, 2026-08-29, second session

Recorded against the committed tree at `f1d9874e`. Job three of Intelligence, the board review, and the deploy pattern it shipped under.

**The board review is a read of the board, or it does not run.** An artboard comes back as a PNG or a JPEG, so the model call carries the image itself, in the `image_url` part `src/brand-brain/chat-completions-provider.js` already uses for source images. A version with no readable image, which today means the stand-in's SVG, is refused with a plain sentence rather than reviewed from its receipt and its brief. Reading the paperwork and presenting the answer as a read of the work would be the analysis quietly not looking, which is worse than the instrument still saying Coming. `boardImage` in `api/tour/index.js` holds that boundary and a test asserts a version with no image stores nothing.

What comes back is three groups: where the board sits with the artist's record and the direction it was briefed against, where it leaves them, and what it touches that this artist stays away from. There is no summary sentence, no meter, no percentage, and no risk level. The model is instructed against writing one and `renderBoardReview` in `app/intelligence/board-view.js` has nowhere to put one. The evidence rules follow job two exactly: an entry the record cannot support is dropped whole, the trail renders as the quiet line, and disclosure appears only where stored sources exist. The read is held against the direction version the board was **briefed** against, not against whatever the direction says today, because a board answers the words it was given.

**Findings never gate.** Present to client is one click whether the read flagged nothing or ten things, and no code path consults an analysis before allowing the action. A test runs two identical tours, stores a read full of departures on one, and asserts that presenting produces the same record on both; it also asserts that the `approve-for-client` branch names neither the job nor the analysis store. The read is recruited context under Present to client in the Reviews drawer, closed until asked for, and the action above it is written before it and never waits on it.

**Two doors, one record.** The same stored analysis renders on Intelligence, where a person picks any version of any Scene with a submitted board, and in the Reviews drawer, where the decision it informs is made. Runs chain per artboard version through `boardSubjectId` in `src/intelligence/analysis.js`, exactly as job two chains per direction version, so a read of V01 stays readable after V02 comes back and V02 starts again at run one. `run-board-review` and `get-board-review` are absent from `CLIENT_ACTIONS`, asserted against the allowlist itself, and a client's payloads carry no trace: a client looking at a presented board cannot tell a read ever ran.

**The trigger commit is retired.** Ruled by Grey 2026-08-29. The two-commit deploy, a content commit followed by an empty commit on the same tree, is dropped. The GitHub deployments endpoint confirmed that content commits reach Production without one, because Vercel builds the head of a push rather than each commit in it. What stands is unchanged: the push gate before anything is touched, the head SHA assertion with `force: false` on every ref update, and verification from committed blobs rather than from local state or a CDN.

## Three rulings, 2026-08-29, third session

Recorded against the committed tree at `b30d2e7a`. Grey's pass on how the four Intelligence instruments read.

**The instruments take the raised gradient.** Ruled by Grey. They were flat `--m-surface-work` and sat too close to the page behind them to read as four separate things. `--m-gradient-raised` already exists and already means an object you act on: `m-attention-row` on Home uses it, and so do controls. Four instruments each holding an action are that kind of object, so this applies a meaning the token already carries rather than borrowing a look. One declaration changed in `app/design/patterns.css`.

Two corrections went with it, both exposed by the gradient rather than caused by it. `m-intelligence-instrument__body` is a grid inside a `1fr` row, so its two children were stretching apart and the four titles sat at four different heights, by as much as 13 pixels at laptop width. `align-content: start` holds them. And the base layer sets every `svg` to `display: block`, which put a mark on its own line inside a heading, so the mark in an instrument heading is `inline-block`.

**No colour separates the four asks.** Considered and ruled against. The palette is spoken for: cobalt and cyan mean interaction, amber means current attention, green means approval, rust means change. Four hues across four peers is the rainbow `docs/meridian-design-direction.md` forbids, and three of them would have landed on colours that already mean a state on the same screen, so a person who had learned amber would see it meaning "the direction one." Separation comes from the gradient and the border. Identity comes from the mark.

**Each ask carries a mark, drawn in the rail's vocabulary.** 24 by 24, stroked, geometric, nothing filled, inheriting the text colour, matching the nav icons in `app/shell.js`. Three branches from one request for the ideas, two columns side by side for the comparison, a frame with a lens for the Artboard, stops along a route for the tour. The mark sits inside the heading rather than in a row beside it: the first build used `m-cluster`, a wrapping flex row, and at phone width the title wrapped below the mark and left it stranded. A mark belongs to the words it names, so it travels with them. `MARKS` in `app/intelligence/asks-view.js`.

**The asks say what they do, and job three's object is an Artboard.** "Read the direction against the artist" and "a second read from the artist's side" were shorthand between two people who already knew the system. The asks now read "Compare the tour direction to this artist's history" and "Check an Artboard before you present it."

The object of job three is the Artboard that came back from production, never a concept. A concept goes out across the seam and an Artboard comes back, and this job runs after production has built the work, at the moment somebody decides whether the client sees it. Putting the word concept there would name the wrong object at the one moment it matters most. The rest of the app already says Artboard, on the Reviews gallery and in the drawer, and the Intelligence copy now agrees with it. The identifiers stay as they are, since architecture vocabulary is not interface copy.

## One ruling, 2026-08-30

Recorded against the committed tree at `3617cbb4`.

**The way back to production lives in the Reviews drawer.** Ruled by Grey 2026-08-30, after a regression he hit on the live app: uploading a new Artboard version no longer worked. Nothing refused it. The door was gone.

There was one link to the handoff page in the whole app, in `sendWork()` in `app/scene.js`, and it carried a brief version and never a revision. That function opens with a return as soon as an Artboard exists, so the moment the first version came back the link went with it. The Reviews rebuild on 2026-08-27 read `get-handoffs` only to decide a state label and a form, and never rendered the address the revision handoff carries. After requesting changes there was no route through the interface to the page that receives the next version, and the handoff page opened without a revision names the version already on record and shows no upload control at all.

Requesting changes is the only act that opens that page, so the way back belongs beside it. The Request changes block shows the link once the request is out, built from `directPath` on the stored handoff rather than from an address the page assembles, so the two cannot drift. This holds the page and the drawer grammar: the link is operator work about the Artboard, it sits in the drawer with the action it follows, and a client receives neither the action nor the link.

Two things go with it. The Scene keeps its collapsed shape from the 2026-08-27 ruling and gains nothing back. And issuing a revision stops repeating "Production has the change request" as a result underneath the same sentence in the block above it, which read as the app saying one thing twice.

The designer's tree read that any commit touching seam behaviour requires was waived by Grey for this change.

## Two rulings, 2026-08-30, second session

Recorded against the committed tree at `2de6718f`. The composition of Intelligence after three jobs began sharing one answer region.

**An answer belongs to the instrument that asked for it.** The four instruments remain the stable map of Intelligence. Once one has run, its foot names the latest run and becomes the way back to that answer. The answer head no longer carries links to other jobs. It carries only run history inside the job being read, labelled as history, with the current run written as state and earlier runs offered as controls. Tabs were considered and refused because a tab strip across answer types would turn four jobs back into a menu of answers, which is the panel this surface exists to avoid. The composition holds when job four arrives: one more instrument can own one more answer without adding another control to every answer head.

**A read is one object with parts, not a sequence of fresh page sections.** The direction read and Artboard check keep every word the model wrote and the 44rem copy measure, but their three groups move down one level. Group headings use object scale, internal rules and gaps tighten, and lineage recedes as quiet metadata. The answer label and first sentence lead; the run, generation date, subject version, and artist knowledge approval date remain exact without competing with them. No type token, page measure, or shared section pattern changes.
