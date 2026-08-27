# Meridian experience principles

Added 2026-08-26. This document is a design system reference showing sample screens. docs/meridian-product-architecture.md is the authority on hierarchy and navigation.

Status: Direction for Meridian V1. These principles guide new screens while workflow details and backend seams are reconciled.

## Purpose

Meridian is the shared working surface between a client, Higher Roads, and the production side responsible for screen content. It should make creative intent clear, keep decisions attached to the work, and let each person see the next job without carrying the full production model on every page.

The interface is not a report on everything the system knows. It is a focused place to do the work in front of you.

## Product hierarchy

The V1 hierarchy is intentionally small:

1. A client is responsible for one artist relationship.
2. That artist has one active upcoming tour in Meridian.
3. The tour contains Scenes.
4. A Scene moves through request, development, review, approval, and production handoff.

Do not add a multi-tour operations layer to ordinary V1 work. Past tours, unresolved items from past tours, and simultaneous tours for one artist are outside the current product need.

Scenes are the primary unit of work. Concept development, Artboard review, approval, and handoff are states inside a Scene. They are not separate top-level destinations.

## Experience principles

### One page, one job

The page title should name what the person is doing. The work should be the largest and brightest object on the page. Supporting context appears only when it helps complete the job or changes the decision.

Most pages should have one clear next step. A second action is appropriate only when it represents a real alternative, such as requesting clarification instead of developing a Scene.

### The shell orients, then gets quiet

Persistent navigation answers two questions: where am I, and where can I go next? It should not repeat the client, artist, tour, Scene, status, and version in several regions.

Scenes, Tour, and Artist Brain are the everyday destinations. Tour is a quiet reference for the active production. Admin is available to Higher Roads as a quiet utility. Page-specific stages do not become permanent navigation.

Corrected 2026-08-26. The sentences above describe destinations in sample screens rather than naming the product's navigation. They were read as an architecture claim this week and produced the wrong build. docs/meridian-product-architecture.md names the navigation.

### Client views remove operational weight

Clients should be able to set direction, add context, review work, and approve without learning Higher Roads process language. A short Scene request is valid. More detailed direction and inspiration are optional.

Client views favor a direct reading and writing surface. They do not inherit admin density simply because the same records exist behind them.

### Higher Roads adds authority, not clutter

Higher Roads needs access to source material, internal notes, relevant Brain context, versions, technical facts, and approval authority. Those details should appear at the moment they affect the job.

An admin view is not a dashboard of every known fact. It is the client view with the additional authority needed to prepare, decide, and hand off work.

### The Artist Brain contributes in context

Higher Roads builds the Artist Brain through manual research and approval. Once approved, the Brain may contribute relevant context during Scene work.

The Brain does not author Scene Direction on its own. A person may ask for suggestions, use one, edit one, or ignore them. Suggestions become part of the brief only through a deliberate Higher Roads action.

The Brain has a home for approved source review and maintenance, but it should not reserve permanent space in ordinary Scene work.

### Source, direction, and approved work remain distinct

Client input is preserved as received. Tour Direction is preserved as given by the director and stored as a named version. Higher Roads may consolidate Scene input into a Full Creative Brief and may add Scene Direction. Each Scene Direction names the Tour Direction version it was written against. Production work is reviewed against the issued brief. Approval locks an exact version of the work and the technical profile into Production Intent.

No later action silently replaces an approved source, brief, Artboard, or production record.

### State appears when it changes the next action

Status is not decoration. Show it when it tells someone what is waiting, what authority is active, or what action is now possible.

Version history belongs beside the work during comparison and review. It does not need to remain visible during intake or concept authoring.

## Canonical flows

### Tour reference

Tour Home holds the active dates, venues, playback system, themes, and the current director-provided Tour Direction. It is a governed reference, not a dashboard or a Scene authoring surface.

Tour Direction is stored as given with a named version. Scene Direction remains a separate object inside each Scene and records the Tour Direction version used when it was written.

### Request and intake

The client names the Scene and explains what the moment needs to accomplish. Optional placement, feeling, files, and inspiration are disclosed without making the short path feel incomplete.

Higher Roads receives the original request as a vertical source document. The intake job is simple: request clarification or develop the Scene concept. Brain context does not compete with the source during this reading step.

### Develop Scene concept

Accepted input becomes the starting brief. Scene Direction is the primary workspace. Higher Roads may ask the Artist Brain for relevant suggestions and deliberately add or edit them.

The brief may be issued with Scene Direction or without it. Either action moves the Scene into development and preserves the accepted source.

### Review and approval

The Artboard is the primary review object. Feedback attaches to a region or version. Comparison controls and version history appear because they directly support the review decision.

Higher Roads may request internal changes or prepare the current version for client review. Client approval and internal pre-approval remain separate authorities even when they use the same review pattern.

### Production handoff

The handoff identifies the exact Scene, issued brief, approved work, and technical profile. Receipt and acknowledgement are visible because they affect whether production can begin.

The approved set becomes Production Intent. Later changes require a new governed version and approval.

## What is settled

- Scenes sit inside the active tour.
- One active tour is enough for Meridian V1.
- Tour Direction is a versioned tour-level source. Scene Direction remains a separate Scene-level object.
- Client and Higher Roads surfaces share a visual language but not the same density.
- The Artist Brain is a contextual contributor to Scene work.
- Source, Higher Roads direction, reviewed work, and approved production intent remain distinct.
- Review and approval are centered on an exact version of the work.
- The interface favors disclosure and focus over permanent summaries.

## What remains open

- Exact backend records and route boundaries for each stage.
- Permission rules for client, management, production, and Higher Roads roles.
- Notification behavior and timing.
- The final field contract exchanged with the production side.
- Edge cases that appear when real tours and real approval chains enter the system.
- Package terminology, if a distinct package object proves necessary.

The reference screens do not settle these questions. They give builders a stable visual and interaction pattern while the functional shape is resolved.

## Reference implementations

Real Meridian screens carry working behavior and the design system together. They are the primary source of truth for composition and component use.

- `app/index.html` shows the active Scenes directory.
- `app/tour.html` and `app/tour.js` show the active tour record and governed Tour Direction.
- `app/scene.html` and `app/scene.js` show the focused Scene Workstation.
- `app/reviews.html` and `app/reviews.js` show every Artboard version, and the full view opened from the gallery carries the feedback and the decision. Corrected 2026-08-27 with the commit that removed `app/review.html` and `app/client-review.html`.

The coded files in `app/design/samples/` are controlled state fixtures:

- `request.html` shows the client request surface.
- `intake.html` shows preserved source review.
- `develop.html` shows a Scene authoring fixture.
- `reviews.html` shows the Artboard gallery and its full view.
- `handoff.html` shows the issued record and Production Intent.

The anonymized Superdesign drafts remain useful as visual process references:

- [Scenes directory](https://p.superdesign.dev/draft/21785c10-074f-456c-8102-cb104c066953)
- [Tour Home](https://p.superdesign.dev/draft/6864b35b-b407-45a8-8894-e47bb970fe30)
- [Client Scene request](https://p.superdesign.dev/draft/099f74be-17c5-409b-aa57-942020c38106)
- [Higher Roads intake](https://p.superdesign.dev/draft/6219f7d6-69c5-4768-8fbf-6facdf65e89e)
- [Scene Workstation](https://p.superdesign.dev/draft/f927438d-0f94-4d0e-b538-62c6a5732983)
- [Artboard review](https://p.superdesign.dev/draft/82e14a80-0d5b-4b43-b71c-841c5c207266)
- [Production handoff](https://p.superdesign.dev/draft/90106322-1964-4300-a659-8de24dc64071)

Superdesign is the visual notebook. The repo is the durable design contract.
