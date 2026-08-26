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

Tour setup continues progressively from Home: add Tour Direction, add dates and venues, add production details, assign the team and approval authority, request the first Scene. Dates and production setup are written on `app/tour.html`, each section on its own, neither waiting on the other. Both are stored versioned beside the direction, and every save records who made it and when.

Creative work is not blocked because every technical detail is not yet known. Missing information becomes visible when it becomes relevant. A Scene can be requested with no direction, no dates, and no production setup.

## Home architecture

Home has three shapes, decided by what the tour holds.

**No tour in the account.** One sentence about what Meridian is for and one button that starts the tour. Nothing else on the page.

**A tour with no Scenes yet.** Four lines reporting what the tour holds: creative direction, dates and venues, production details, Scenes. Each line names what is stored rather than what the person owes, derives from the stored tour rather than from anything anyone ticks, and opens the place that thing lives. Exactly one line is marked as a good next step, chosen as the first unfilled one. No progress count, no ticks, no percentage, no wizard. Requesting the first Scene sits beside the lines and needs none of them filled in.

**Scenes underway.** The orientation screen below.

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
