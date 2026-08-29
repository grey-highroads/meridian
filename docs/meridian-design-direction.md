# Meridian design direction

> Status: Active. Written 2026-08-29 against `0bbcbde9`. This document explains the judgment behind Meridian's visual and interaction language. `docs/meridian-product-architecture.md` governs product hierarchy and navigation. `docs/design-system.md` governs implementation patterns and tokens. `docs/experience/design-quality-standard.md` governs review and acceptance.

## Purpose

Meridian is the creative intelligence and memory system behind live touring productions. A touring production can involve a dozen or more people, each carrying a different picture of what is being made and whether it has been approved. Meridian gives them one reference point for the work, the reasoning behind it, and the decisions that move it forward.

The product sells confidence. It makes creative intent legible, preserves continuity, identifies the exact work under discussion, and provides a predictable path from request to approved production intent. Speed may result. Speed is not the promise.

Meridian is not an AI product. Intelligence supports the work and stays accountable to evidence, but a person still asks, reads, decides, and carries an idea forward. Meridian is not a project management suite. It does not turn creative production into tickets, metrics, burndowns, or a dashboard of everything the system knows.

This document exists so a designer or builder can make a coherent decision when an accepted pattern does not answer the whole question. It is not a license to reinterpret settled product constraints or redesign the system screen by screen.

## The visual argument

Meridian is a dark instrument surrounding creative work.

The darkness is not a theme switch and not an imitation of backstage software. It creates a neutral black surround in which an Artboard, a direction, or a consequential decision can hold the stage. The application recedes. The work becomes the brightest and most substantial object. Signal color arrives only when a person must notice, choose, or understand a consequential state.

The black surround also keeps unrelated artist identities from rewriting the product every time the active tour changes. Meridian's chrome stays fixed and neutral. The artist enters through the artwork, source material, language, and evidence inside the work. The application does not tint itself to match an artist. A bespoke creative relationship is expressed through what Meridian holds, not through a skin.

Venue and backstage use support the dark direction but do not cause it. Real use in dim rooms, on phones, and under time pressure governs contrast, target size, density, and responsive behavior. Those requirements must be tested independently rather than assumed to follow from a dark palette.

## Stage and instrument are relationships, not decoration

The surface vocabulary describes how parts of the interface relate:

- the stage is the deepest surround;
- the shell provides orientation and access;
- the field holds the current composition;
- the work surface carries the object being read or changed;
- a raised surface is available to act on;
- a sidecar carries supporting reference that must remain nearby without competing.

Instrument means purposeful, legible, and responsive to deliberate input. Every control should have a job, every signal should have one meaning, and every state should tell a person something they can use.

The vocabulary does not license theatrical skeuomorphism. Do not add control-room decoration, technical grid overlays, artificial scan lines, knobs, glowing edges, or stage machinery as atmosphere. It also does not license AI decoration such as sparkles, magic gradients, synthetic activity, or an omnipresent conversational panel. The metaphor is carried by hierarchy, depth, restraint, and precision.

## What Meridian should feel like

Meridian should feel calm under consequential work. Calm does not mean empty, slow, or precious. It means that the interface has already decided what deserves attention and has withheld everything else until it helps.

It should feel authored rather than templated. Authorship appears in the proportion of the page, the order of the work, the handling of evidence, the exactness of language, and the restraint of the controls. It does not require novelty at every surface.

It should feel precise without reading as technical administration. A person can always tell which Scene, version, action, and authority are in play. They do not need to learn the underlying record shape to do so.

It should become quieter as certainty increases. An unresolved decision may carry an action and a clear consequence. Approved work needs less signal, not a celebratory layer of badges and color.

It should feel worthy of the creative work it frames. High style comes from judgment and proportion, not oversized type, exaggerated whitespace, or decorative gestures that reduce how much useful work the page can hold.

## The work holds the stage

When Meridian presents an Artboard, the Artboard is the primary review object.

- Give it the largest continuous area and the strongest visual presence.
- Frame it with a neutral surround. Meridian should neither tint the work nor compete with it.
- Preserve the complete Artboard by default. Cropping is a deliberate viewing action, never a side effect of the page layout.
- Offer fit-to-view first. Actual-size viewing and panning belong where they help someone inspect the work.
- Keep application controls outside the artwork unless the interaction is direct markup on that exact version.
- Keep the version attached to the artwork, rationale, feedback, and decision it governs. A version is not an isolated badge.
- Let empty margin around unusual aspect ratios read as a frame, not as unfinished layout.

Artwork can be visually loud. The application around it should be confident enough to disappear without looking incomplete.

The same principle applies beyond Artboards. On a reading page, the authored direction leads. On Intelligence, the idea leads. On Home, the decision leads. The data structure never becomes the largest object merely because it contains the most fields.

## Hierarchy is the primary material

Meridian relies on large and tight type against small and widely tracked labels, restrained surface steps, and deliberate space. These differences establish order before borders or color are added.

The page name establishes the job. The primary work establishes the reason to stay. Section headings divide real decisions or reading modes. Labels orient compactly. Metadata carries exact identifiers, dates, and lineage. One type treatment should not be asked to perform another treatment's role.

Do not shrink the type system to fit more content into a viewport. First correct the information architecture, disclosure, order, and measure. Type changes are system changes and require system evidence.

Running prose keeps a readable measure even when the composition needs a broad canvas. A tool field may widen so its instruments can breathe. The sentences beneath it do not widen with the page.

## Color is withheld until it means something

Most hierarchy belongs to grayscale value, depth, type, and space.

- cobalt and cyan identify interaction, selection, and focus;
- amber identifies current attention;
- green identifies approval;
- rust identifies a real change, blockage, or destructive consequence.

Color supports words. It never replaces them. Lifecycle stages do not receive a rainbow of their own. A state earns color only when the distinction changes what a person understands or can do.

Do not spend several color treatments on one message. A colored rail, tinted background, badge, icon, and button that all say current create noise rather than certainty.

## Material is quiet evidence of affordance

Meridian uses neighbouring charcoals, subtle gradients, inset top light, and bottom shadow to distinguish planes and controls. Material should be felt before it is noticed.

A raised surface suggests that it can be acted on or brought forward. A rule can separate one reading mode from another. A change in surface can identify a functional plane. None of these requires a card around every grouping.

Near-square geometry keeps the product direct and constructed. Rounded friendliness is not a substitute for clarity. Shadows do not create importance. They clarify depth where depth already has an interaction meaning.

## Motion confirms identity and consequence

Motion is brief, restrained, and attributable to a change the person can understand. It may confirm that a drawer opened, a disclosure changed, feedback landed, or the current object moved.

The once-after-login boot sequence is an identity moment. It does not claim that the system is checking, thinking, or making progress. Ordinary navigation does not replay it. Reduced motion receives a short static resolve.

Do not animate stable information to make the product feel alive. Meridian earns confidence through accurate state, not ambient motion.

## Two roles, one grammar

The operator and the client reviewer share the shell, work objects, and workflow grammar. They do not share density or authority.

The operator uses Meridian daily. Dense information is appropriate when every visible fact affects the job in front of them. Operator density is not permission to expose every record. Higher Roads adds authority, not clutter.

The client reviewer may visit only a few times during a tour, often on a phone and in a hurry. Their experience is designed around four moves:

1. arrive;
2. orient;
3. decide;
4. leave.

The work, version, rationale, and available decision should answer those moves without process language or internal context. The client never needs a finding, a score, a verdict, or an explanation of Meridian's architecture.

Shared actions stay on the shared page. Higher Roads actions about the work live in the operator drawer. Role security remains a server responsibility; hiding a control is never authorization.

## The interface voice

Meridian speaks as a capable peer inside an active production. It is specific, economical, calm, and accountable.

Every line should perform one of five jobs:

**Orientation** names where the person is or what they are looking at. It should be quiet and should not repeat information the shell or page already establishes.

**Consequence** says what happened or what an action will change. It belongs next to the action or result it explains.

**Evidence** says why a conclusion or recommendation deserves consideration. It follows the finding or idea and becomes more detailed only when requested.

**Instruction** tells the person what input is needed and why. It appears at the point of input and disappears when the question no longer exists.

**Action** names the result of pressing the control. Use `Prepare V03 for client`, not `Submit`. Use `Add playback system`, not `Manage`.

A sentence does not earn space merely because it is accurate. Remove it when the layout already communicates the same thing. Do not use helper copy to compensate for unclear structure. Do not announce an empty database. Name the missing object, who is expected to act, or the successful absence of work.

Use the person's language. Keep architecture vocabulary in architecture documents. No em dashes appear in interface copy, documentation, or CSS comments.

## Version identity

Versioning is part of Meridian's promise, not secondary metadata.

- Always name the object with its version when a person is comparing, reviewing, approving, copying, or downloading it.
- Keep the version adjacent to the work and to the decision that affects it.
- Distinguish the current version from readable history through words and available actions, not color alone.
- Earlier versions remain intact and readable. They do not inherit actions that belong only to the current version.
- Feedback, rationale, approval, and production intent name the exact version they govern.
- Never place one version in the page heading and another in an action area without making their relationship explicit.

If a person can reasonably ask which version an action will affect, the composition is not finished.

## How design decisions are made

Start with the job and work down through the intervention ladder. Stop at the first level that resolves the problem.

1. Correct the information architecture.
2. Correct order and disclosure.
3. Correct weighting, spacing, and measure.
4. Extend a shared pattern only when the page exposes a repeated gap.
5. Change typography, tokens, or the design system only when the problem is demonstrably systemic.

Builders may resolve levels 1 through 3 when the solution uses accepted patterns and preserves settled hierarchy. Level 4 becomes a pattern request for the designer. Level 5 requires an explicit design-system ruling.

A page composition problem is not permission to redesign the system. A content-volume problem is not permission to shrink the type. A new record is not evidence that the interface needs a new panel.

If the job cannot be composed from accepted patterns without inventing a new hierarchy, stop and request a design ruling. Do not resolve uncertainty by copying the nearest screen.

## Recurring failure patterns

### Starting from the records

The screen becomes one section per backend object. Everything appears complete and nothing has priority.

Ask what the person came to accomplish, which object carries that job, and which records merely support it. Organize around the answer rather than the schema.

### Making every available thing a peer

Four jobs, three statuses, and two optional references receive equal cards because they all exist. Equal geometry implies equal importance even when the work says otherwise.

Use equal stature only for true peers. Let actions and honest states express readiness inside the shared structure.

### Adding a box instead of making a relationship

Nested cards, panels, header strips, and status blocks appear wherever two items need grouping. The page becomes a collection of containers rather than a composition.

Try space, alignment, measure, a rule, or a surface change before adding another box.

### Repeating orientation

The shell, location bar, page heading, summary, sidecar, and action area all name the same Scene, state, or version. Repetition makes each instance less authoritative.

Orient once. Repeat only when the object must remain unambiguous after the original context leaves the viewport or the product.

### Confusing visibility with importance

The most important action is placed at the bottom because it follows the data in source order. A generated answer arrives below the viewport with no signal that it exists.

Place the doorway where the person will look for the next job. Keep local actions attached to their object. Make a consequential arrival visible without dragging all of its detail into the first viewport.

### Using copy as scaffolding

Headings, helper paragraphs, and labels explain the layout because the layout does not establish a hierarchy. The prose becomes clunky and the page still feels uncertain.

Remove repeated explanation, then repair the order and weighting. Add back only the words that answer a real question.

### Flooding the reader with proof

Evidence is treated as a demand to read the complete research record before acting. The result may be honest and still unusable.

Lead with the finding or idea. Recruit the evidence layer when the person asks why. Keep source detail one layer deeper only when it contains something the reader has not already been given.

### Making responsive mean stacked

Every desktop region becomes a full-width mobile block in source order. Supporting context can then appear before the decision or push the action several screens away.

Preserve job order, not panel order. Shared surfaces are reviewed in both roles. Role-specific surfaces are reviewed for every authorized role, and excluded roles are verified to receive no trace.

### Fixing composition through system drift

Font sizes, tokens, radii, and shared controls change because one page feels crowded. The page may fit more content while the product stops feeling like itself.

Use the intervention ladder. System changes require evidence across representative screens, not dissatisfaction with one composition.

## Five decisions that establish the method

### Intelligence asks are instruments, not directory rows

The four asks could have been a familiar rule list. That option was compact and already existed in Scenes. It was rejected because a list describes places to go, while these asks are four different operations over one research archive.

The chosen composition gives each ask a title, a purpose, and its own action or honest state. The instruments have equal stature because the jobs are peers. Their controls reveal that one is live, two are coming, and one waits on tour data. No whole instrument pretends to be clickable.

The transferable question: is the person choosing a destination, or using a tool on the object already in front of them?

### Intelligence evidence follows the finding

Rendering every finding in full was correct at the finding level and overwhelming at the idea level. Hiding findings individually behind repeated disclosures would have made the evidence feel optional and fragmented.

The chosen composition keeps the idea and its qualifying notes together, then recruits one evidence cluster labelled `What this rests on in the artist's history`. It starts closed and counts unique findings. Opening it shows each finding and why it bears on the idea in full. Linked sources may open one layer further. Counts-only trails remain static.

The transferable question: what must be read to understand the claim, and what is only needed to audit it?

### Home shows each Scene once

Separate attention and progress lists were individually defensible and collectively wrong. A Scene with a question or pending review appeared in both, turning Home into two directories and making the current job ambiguous.

The chosen composition gives each active Scene one place. Decisions and questions lead under `Needs you`. Scenes progressing independently follow under `In progress, nothing needed from you`. That group opens by default so progress remains visible and stays collapsible for anyone who wants it out of the way.

The transferable question: is the same object doing two jobs on the page, or is the page repeating one object because two backend filters found it?

### Reviews gives the Artboard the viewport

A review queue would have emphasized assignment state. A narrow workstation with permanent context would have made the Artboard one panel among several. Neither expressed the actual job, which is to read and decide on a specific version of the work.

The chosen composition uses a gallery to find the version, then gives the opened Artboard the viewport. Fit, actual-size inspection, version movement, feedback, and decisions remain attached to that version. Earlier versions stay readable history and lose current actions.

The transferable question: which object must remain visually dominant for the decision to be trustworthy?

### The operator drawer adds authority without changing the page

Operator actions could have been inserted inline, placed in a permanent Inspector, or moved to separate admin pages. Inline controls would have changed the shared composition for one role. An Inspector would have permanently reduced the work area. Separate pages would have broken context.

The chosen drawer overlays the page without reflowing it. It leads with operator actions and recruits supporting context under the action it informs. Clients receive neither the drawer nor its data. Shared comments and decisions remain on the shared object.

The transferable question: does this action belong to the work itself, or to Higher Roads operating the work?

## What Meridian must never resemble

### The project management dashboard

Warning signs are KPI tiles, stage-colored badges, workload summaries, burndowns, generalized urgency, and a page organized around status rather than creative decisions. Meridian may report what needs a person. It does not turn a tour into productivity telemetry.

### The AI cockpit

Warning signs are a dominant prompt box, chat as the universal interaction, synthetic activity, confidence scores, magical language, sparkles, and suggestions that appear to possess authority. Intelligence receives named jobs, cites evidence, and leaves the decision with a person.

### The database administration surface

Warning signs are tables before tasks, schema labels, permanent metadata panels, filters for internal classifications, and controls arranged around record maintenance. Exact records matter, but the interface translates them into the person's job.

### Generic card-grid SaaS

Warning signs are equal cards for unequal work, repeated icon-title-copy-action modules, padded emptiness, and layouts assembled from interchangeable rectangles. Meridian uses cards only when the objects are real peers or the surface meaningfully raises an action.

### The agency portfolio that trades utility for gestures

Warning signs are oversized type that forces useful work below the fold, excessive whitespace, theatrical transitions, and composition designed for a screenshot rather than repeated use. Meridian can be visually authored without making a hurried reviewer wait for the product to finish presenting itself.

## The test for a new screen

Before a composition becomes a pattern, answer:

1. Who is here, and what did they come to accomplish?
2. What is the one object or decision that must hold the stage?
3. What should they see first, second, and third?
4. What can remain hidden until requested?
5. What authority belongs inline, and what belongs in the operator drawer?
6. Which words orient, explain consequence, provide evidence, instruct, or act?
7. Is any object, state, or explanation doing the same job twice?
8. Does version identity remain attached to every consequential action?
9. Does the job order survive on a phone?
10. Can the screen be built from accepted patterns without changing the design system?

If the answer to the last question is no, request a design ruling before implementation.
