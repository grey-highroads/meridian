# Meridian design quality standard

> Status: Active. Rewritten for Meridian on 2026-08-29 against `0bbcbde9`. This standard governs the quality of meaningful interface changes from proposal through rendered acceptance.

## Purpose

Good design in Meridian combines functional integrity, information architecture, interaction continuity, language, visual hierarchy, accessibility, system coherence, and evidence from real use.

A screen can be attractive and still be poorly designed. It can be usable and still feel generic, awkward, or untrustworthy. It can follow the component rules perfectly and faithfully reproduce the wrong hierarchy.

Quality comes from resolving the whole experience as one coherent system:

- the person understands where they are and what they can accomplish;
- the work or decision that matters is easiest to find;
- the interface asks only for decisions that belong to that person;
- actions, feedback, evidence, and versions stay attached to the objects they govern;
- the composition directs attention without over-signalling;
- empty, mixed, complete, loading, error, locked, and responsive states feel intentional;
- the implementation belongs to Meridian rather than resembling a pasted-on pattern;
- the result has been read and operated as a rendered page with realistic content.

This is a review standard, not a component catalog and not a style manifesto. Product rulings and feature contracts remain authoritative. The design standard decides whether those constraints have become a coherent experience.

## Relationship to other documents

| Document | Primary question |
| --- | --- |
| `docs/meridian-product-architecture.md` | What is the product hierarchy, navigation, authority, and workflow ruling? |
| `docs/meridian-experience.md` | What experience principles and canonical flows govern Meridian V1? |
| `docs/meridian-design-direction.md` | Why does Meridian look and behave this way, and how should new design judgment be made? |
| `docs/design-system.md` | Which implementation patterns, tokens, and composition contracts are available? |
| This standard | Is the resulting experience coherent, complete, and ready to build or ship? |
| Feature handoffs and contracts | What local behavior, data, safety, and lineage must remain intact? |

Passing one document does not imply passing the others. A strategically valid feature may have weak information architecture. A polished component may be attached to the wrong object. A consistent implementation may preserve behavior while making the decision difficult to find.

## Quality is a gate, not a score

Meridian design is not graded with points. A numerical score invites tradeoffs that do not exist. Decorative craft cannot compensate for a broken workflow, unclear authority, inaccessible controls, or an ambiguous version.

Use four review states:

**Not ready.** The job, hierarchy, contract, or role boundary remains unresolved. Do not style or implement around the uncertainty.

**Ready for a design ruling.** The product job and constraints are known, but accepted patterns do not resolve the composition without inventing a new hierarchy.

**Ready to build.** The organizing idea, role behavior, states, copy intent, and responsive order are explicit. The implementation can use accepted patterns or a ruled extension.

**Ready to ship.** The committed implementation passes the critical gates, the applicable quality dimensions, and rendered review with realistic content.

The state is determined by the weakest critical requirement, not by averaging strengths and weaknesses.

## Critical gates

Every meaningful interface change must pass all applicable gates.

### The job is real and completable

The page has a named person, a clear outcome, and an immediate consequence. The primary path works without hidden prerequisites or knowledge of internal architecture.

### Product authority is preserved

Settled hierarchy, terminology, permissions, workflow transitions, evidence lineage, and data contracts remain intact. A visual simplification cannot weaken a production or approval contract.

### Role boundaries are honest

Shared surfaces preserve the shared page. Higher Roads authority appears in the operator drawer when it is about the work. Role-specific surfaces are reachable only by authorized roles. The server projection, not visual hiding, protects private information.

### Version identity is unambiguous

The exact version stays attached to the work, rationale, feedback, action, approval, copy, or download it governs. Earlier history cannot be mistaken for the current actionable version.

### Architecture vocabulary stays internal

The person is never required to understand a state machine, record type, model score, storage status, or system term to make a decision.

### The hierarchy survives responsive use

Job order remains coherent at laptop and phone widths. Controls meet target requirements, focus remains visible, and the primary action does not disappear behind stacked supporting material.

### The design system remains coherent

The implementation uses existing tokens and accepted patterns. Builders do not solve a page problem by changing `app/design/`. A missing hierarchy becomes a design ruling. A missing reusable pattern becomes a pattern request.

### Rendered review is complete

The page has been judged with realistic mixed content, not only ideal fixture data. Shared surfaces are reviewed in both roles. Role-specific surfaces are reviewed in every authorized role, and excluded roles are verified to receive no trace. Markup inspection and computed-style inspection are not visual approval.

## Thoughtful design

Thoughtful design shows evidence of judgment at every layer.

It decides:

- what belongs on the page;
- what belongs somewhere else;
- what should be visible now;
- what should wait until requested;
- what the system can infer safely;
- what the person genuinely needs to decide;
- what deserves emphasis;
- what can remain quiet;
- how incomplete and exceptional states behave;
- how the page reads as a full composition.

Thoughtfulness is visible in what has been removed, combined, or demoted as much as in what has been added.

## Elegant design

Elegance is low conceptual friction.

An elegant interface can support complex behavior. It does so with a small number of understandable ideas, stable patterns, and selective emphasis. It avoids making the person operate the architecture.

Elegance usually means:

- the page has one organizing idea;
- hierarchy is legible without repeated explanation;
- related actions resolve locally;
- known values are inferred safely;
- advanced detail remains available without dominating the default state;
- visual signals carry distinct jobs rather than repeating one message;
- every visible control earns its place;
- the interface becomes quieter as certainty increases.

Lightness is a quality of attention, not an absence of capability.

## The eight dimensions of design quality

### 1. Functional integrity

The experience must help the person complete a valuable job correctly.

Ask:

- What outcome brought this person here?
- Which decisions genuinely belong to them?
- Does every action have an immediate and understandable consequence?
- Can the task be completed without hidden prerequisites?
- Do approval, evidence, versioning, and safety rules remain intact?
- Does failure preserve entered work and explain the next safe move?

Common failures:

- polishing a screen that preserves the wrong workflow;
- using an action label that does not match what happens;
- exposing a control the system cannot honor;
- removing data that a later production step requires;
- making a short client job depend on operator process knowledge;
- presenting a false success while a write or handoff is unresolved.

Required evidence:

- the core path is exercised from entry to visible consequence;
- failure and recovery are exercised where the action can fail;
- changed contracts have direct tests;
- no unrelated workflow behavior changes.

### 2. Information architecture

The page must express the person's mental model before the system's data model.

Ask:

- What is the page's one job?
- What object carries that job?
- Which concepts are peers and which are supporting detail?
- Is the same object or message competing in more than one place?
- Does order match importance, frequency, and dependency?
- Can the person predict where an action, record, or explanation belongs?

Good information architecture creates durable boundaries. Asking and reading, finding and auditing, shared work and operator authority, current action and history may coexist while remaining distinct.

Common failures:

- organizing one section per backend record;
- presenting optional material as equal to foundational work;
- repeating the same Scene in attention and progress regions;
- adding a summary that restates the sections below it;
- using directory styling for instruments or local actions;
- adding a panel because another record exists.

Required evidence:

- the page job can be stated in one sentence;
- the first, second, and third objects of attention are named;
- duplicate jobs are removed before styling;
- the full page remains coherent with mixed content lengths.

### 3. Interaction continuity

The interface should preserve location, context, and momentum.

Ask:

- Can a local task resolve locally?
- Does an expansion reveal only what the current choice needs?
- Does the person retain sight of the work or section they acted on?
- Are cancel, completion, and recovery paths obvious?
- Does progressive disclosure reduce simultaneous complexity?
- Does feedback land where the action occurred?

Use a disclosure for supporting detail that belongs to the current reading. Use the operator drawer for Higher Roads actions about the shared object. Use a new page when the task becomes a distinct job with its own history or decision sequence.

Common failures:

- replacing the whole page after a local row action;
- moving a result to a page-level message far from its trigger;
- opening several independent editors at once;
- hiding an arrived answer below the viewport without announcement;
- treating a disclosure as a label over content already given;
- changing page width when an overlay drawer opens.

Required evidence:

- every interactive path is operated in the rendered page;
- open and closed states preserve context and focus order;
- local success and failure appear beside the initiating object;
- browser history and deep links land on the intended object when applicable.

### 4. Language and decision clarity

Meridian should help a peer make a decision, not teach them the system.

Ask:

- Would the person use these words?
- Does the action name its result?
- Does helper copy answer a likely question at the point of need?
- Is the line orientation, consequence, evidence, instruction, or action?
- Can it be removed because the composition already says the same thing?
- Are authority and version distinctions explicit where they matter?

Good copy is specific, economical, and situated. It names the real object, who acts next, and what will happen. It keeps evidence honest without making research bookkeeping the primary read.

Common failures:

- presenting schema names as user choices;
- vague verbs such as `Manage`, `Submit`, or `Continue`;
- repeating helper copy at several levels;
- surrounding one short action with preemptive explanation;
- using labels to compensate for weak grouping;
- calling a concept packet a brief;
- writing an em dash in interface copy, documentation, or CSS comments.

Required evidence:

- the complete rendered page receives a copy pass;
- action labels are checked against their actual consequence;
- empty and error copy identify the real condition;
- architecture terms and em dashes are absent.

### 5. Visual hierarchy and craft

Visual design should direct attention, express relationships, and make the product feel deliberate.

Judge the page as a spatial and vertical composition, not as isolated components.

Ask:

- What should the eye see first, second, and third?
- Is the work the largest and brightest object?
- Do spacing, alignment, and measure express grouping before borders do?
- Is color carrying one defined product meaning?
- Does every section receive the weight its job deserves?
- Does the page retain Meridian's type, surface, geometry, and material language?
- Are ideal and awkward content lengths equally considered?

Craft includes aligned baselines, controlled paragraph measure, calm borders, clear focus, useful hover states, consistent icon geometry, convincing section transitions, and intentional framing around artwork.

Common failures:

- adding color, shadows, badges, and borders at every level;
- shrinking type to bring more content into the viewport;
- using oversized type and whitespace as substitutes for hierarchy;
- literal translation of a mockup without resolving the full-page rhythm;
- letting optional context outweigh the decision;
- removing subtle material until every surface looks flat;
- inventing local styling to fix one composition.

Required evidence:

- a full-page rendered review at representative widths;
- comparison with nearby accepted screens;
- inspection of long, short, empty, and mixed content;
- confirmation that system tokens and patterns remain unchanged unless explicitly ruled.

### 6. States, responsiveness, and accessibility

The design is the complete set of states, not the ideal screenshot.

Consider every applicable state:

- empty;
- partially filled;
- complete;
- active or expanded;
- loading or processing;
- success;
- error;
- locked or read-only;
- current and historical versions;
- narrow laptop, tablet, and phone;
- keyboard and reduced-motion use.

Ask:

- Does the hierarchy survive wrapping and long content?
- Can every action and state be understood without color?
- Is keyboard order logical when disclosures and drawers change?
- Are focus, labels, live status, and disclosure semantics present?
- Does the narrow layout preserve job order rather than panel order?
- Can a hurried client act one-handed on a phone?

Common failures:

- stacking every desktop panel without reconsidering order;
- allowing supporting context to push the decision several screens away;
- testing only the state where the new data exists;
- relying on hover for essential meaning;
- animating identity or progress without a reduced-motion path;
- allowing text or controls to overflow at the narrowest supported width.

Required evidence:

- rendered review at laptop and phone widths;
- keyboard operation of every control in the changed path;
- visible focus and semantic labels;
- open and closed disclosure states;
- presence and absence data states;
- reduced-motion behavior when motion changes.

Accessibility is part of the design decision from the beginning. It is not a validation layer applied after visual approval.

### 7. System coherence

The feature should feel native to Meridian.

Ask:

- Which accepted pattern already solves this relationship?
- Which tokens express the needed surface, spacing, type, and signal?
- Is the variation meaningful or accidental drift?
- Does a missing pattern represent a repeated need?
- Does the implementation preserve settled behavior and data contracts?
- Has the intervention ladder stopped at the lowest sufficient level?

Coherence does not make every screen identical. Meridian provides a shared grammar. Individual pages use that grammar to express different jobs.

Common failures:

- local colors, gradients, shadows, type sizes, or spacing;
- near-duplicate components with incidental differences;
- importing an attractive pattern that conflicts with Meridian's hierarchy;
- copying the nearest screen despite a different job;
- changing shared tokens to solve one crowded page;
- editing `app/design/` without a design ruling.

Required evidence:

- the changed page names the accepted patterns it uses;
- any gap is recorded as a pattern request before implementation;
- design-system changes cite the repeated evidence that requires them;
- representative screens are checked for regression when a shared primitive changes.

### 8. Evidence and refinement

Design quality must survive the repository, realistic content, and direct use.

Ask:

- Was current remote `main` confirmed before the work began?
- Was the committed source read before editing?
- Was the current page rendered and operated before a direction was proposed?
- Were nearby accepted screens and product rulings studied?
- Were structural alternatives compared when the hierarchy was uncertain?
- Did the committed implementation receive full-page review?
- Was user feedback interpreted as evidence about the underlying system?

Mockups are probes. Code is another probe. The deployed product is the final test. Each can reveal an information architecture problem the prior stage hid.

Common failures:

- judging a screenshot without operating the path;
- auditing markup and computed styles as a substitute for looking;
- implementing a generated canvas literally without project context;
- applying surface changes to feedback about hierarchy or usefulness;
- verifying the sample record while old records remain broken;
- reporting a local working tree as deployed behavior.

Required evidence:

- the exact source head is named;
- before and after suite counts are reported;
- the production build is verified;
- the rendered states and widths are named;
- committed blobs are checked before publication;
- deployment status is reported separately from push success.

## The emphasis budget

Every page has a limited emphasis budget. Spend it on distinctions the person needs.

Typical hierarchy levels are:

1. product and location;
2. page and primary job;
3. major work or decision;
4. local tasks and records;
5. requested detail.

A sixth perceived level should be rare. Summary strips, nested cards, status pills, colored rails, accent borders, large labels, progress bars, and helper panels each consume emphasis. Combining them makes the person re-parse the page several times.

Before adding a cue, state its unique job. Remove or demote it when another element already performs that job.

An element may be important and quiet. Version lineage, evidence counts, and attributed history matter, but they should not compete with the decision until they change it.

## Subtractive design review

After the first coherent composition exists, inspect every surface, label, metric, border, icon, control, and paragraph.

Ask:

1. What decision or understanding does this support?
2. Is that job already handled elsewhere?
3. What breaks if this becomes quieter?
4. What breaks if it disappears?
5. Can the system infer this safely?
6. Is this element compensating for unclear hierarchy?

The goal is not maximum removal. The goal is maximum clarity per visible element.

Do not remove material that makes a decision trustworthy. Subtraction should quiet evidence access, not erase evidence; simplify version presentation, not detach the version; reduce operator clutter, not hide operator authority.

## Design and build workflow

### 1. Confirm the source

Fetch current remote `main`, name the exact head, and read from the committed tree. Inspect working-tree changes before editing. Do not overwrite another session's work or design from a stale copy.

### 2. Inspect before proposing

Render the current page and operate the actual path. Read the product architecture, experience principles, design direction, design system, feature contract, and nearby accepted screens that govern the job.

### 3. Frame the job and invariants

Write down:

- the person and context;
- the desired outcome;
- the decisions that genuinely belong to them;
- what the system already knows;
- settled product and authority rules;
- records and lineage that cannot change;
- the states that must exist;
- the current friction in user language.

### 4. Model the information architecture

Group content by user job. Establish the primary object, order, hierarchy, ownership, and location of supporting detail. Resolve duplicate jobs before styling.

### 5. Use the intervention ladder

Correct information architecture first, then order and disclosure, then weighting, spacing, and measure. Builders may make these changes with accepted patterns. A missing pattern goes to the designer. Typography, tokens, and system changes require explicit systemic evidence.

### 6. Explore only when the decision is real

Create structurally distinct alternatives when two defensible organizing ideas remain. Useful comparisons may test:

- guided versus direct;
- page replacement versus local disclosure;
- task-first versus reading-first;
- broad instrument field versus narrow reading measure;
- shared inline action versus operator drawer;
- visible evidence versus recruited evidence.

Changing color, type size, or card radius alone is not a meaningful direction.

### 7. Record the design ruling

Name the chosen option, the defensible alternatives rejected, and what made the difference. A builder needs the rejection reasoning because future cases will not reproduce the same screenshot.

### 8. Implement through the system

Use accepted patterns and preserve contracts. Keep source edits narrow. Do not make unrelated design-system changes. Attach feedback and consequences to the action that produces them.

### 9. Verify the whole experience

Build and test the working implementation before commit. Render realistic mixed states. Inspect full-page rhythm, responsive order, disclosure behavior, keyboard operation, copy, version attachment, and role projection. After commit, confirm that the committed blobs are the same work that passed review.

### 10. Refine from live evidence

Treat reactions about density, copy, hierarchy, and usefulness as evidence. Diagnose the underlying problem before changing the surface. Record a durable ruling when the correction establishes a reusable principle.

## Rendered review matrix

Every meaningful visual change records what was actually reviewed.

### Roles

- Shared pages: Higher Roads and client reviewer.
- Higher Roads-only pages: every authorized operator state, plus proof that a client receives no page, route data, or action trace.
- Client-specific compositions: the client path and the operator's corresponding shared-object path when one exists.

### Widths

- the ordinary laptop viewport where the product is primarily operated;
- the breakpoint where a multi-column composition changes shape;
- a phone viewport appropriate to hurried client use;
- any unusually wide or narrow work surface introduced by the change.

### Content

- no relevant records;
- one record;
- realistic mixed states;
- long titles, prose, evidence, or metadata;
- enough records to exercise disclosure and scrolling;
- a record created before a newly introduced field or artifact when applicable.

### Interaction states

- default arrival;
- open and closed disclosures;
- drawer closed and open when present;
- loading, success, and failure when asynchronous;
- current and historical versions;
- focus and keyboard traversal;
- reduced motion when motion changes.

Rendered review means reading the visible text, judging the spatial hierarchy, and operating the controls. Source matches and computed values may support that review. They cannot replace it.

## Using Superdesign thoughtfully

Superdesign is a visual notebook and comparison tool. It is not the product authority.

Use it to:

1. reproduce the current rendered target as ground truth;
2. explore different information or interaction hypotheses;
3. keep the established Meridian system fixed while varying structure;
4. compare full-page compositions rather than isolated components;
5. identify what each direction proves and what it damages;
6. choose principles after review;
7. implement only after the reasoning is understood.

Do not ask a generated canvas to infer the project from a screenshot alone. Supply the real job, role, constraints, accepted patterns, content, and nearby screen context. Do not carry type, tokens, radii, or decorative language back into Meridian merely because a direction looks polished.

The preferred result is often the least intervention that fully resolves the problem. Novelty, density, and visible design effort are not quality measures.

## Review record

A meaningful design review should leave a compact record:

- source head;
- person, job, and primary object;
- settled constraints;
- chosen hierarchy;
- alternatives rejected and why;
- patterns used or requested;
- roles, widths, content states, and interactions rendered;
- test and build results;
- unresolved risks;
- whether the result was pushed, deployed, and read live.

The record can live in a feature handoff, a product-architecture ruling, or a commit report. It should not become another permanent document when no durable principle emerged.

## Common warning signs

- The direction is described mainly with adjectives rather than user outcomes.
- A new summary repeats the sections below it.
- Every backend record becomes a visible section.
- Every section receives a different card or control pattern.
- Several colors, borders, pills, and icons communicate one state.
- A local action moves the person away from the object it affects.
- Optional content carries more weight than the decision.
- A finding and its evidence bookkeeping compete at the same level.
- The person must choose a value because the schema has a field.
- The design looks convincing only in an ideal filled state.
- Responsive behavior means stacking every desktop region.
- More content is brought into view by shrinking the design system.
- Copy explains what hierarchy should have made obvious.
- The most elaborate direction is assumed to be strongest.
- A generated canvas changes the product's type, tokens, or tone.
- Markup was audited and nobody looked at the page.
- A push is reported as a deployment without deployment evidence.

## Definition of done

A design is ready to ship when:

- the primary job is understandable and completable;
- the information architecture matches the person's mental model;
- the work or decision holds the stage;
- interaction preserves context and reveals complexity progressively;
- language supports decisions in plain and exact terms;
- version identity remains attached to consequential work;
- visual hierarchy and craft feel deliberate across the whole page;
- realistic states, responsiveness, and accessibility are resolved;
- each role receives the right composition and data;
- the implementation uses or deliberately extends the design system;
- product contracts, authority, evidence, and safety rules remain intact;
- the committed build and tests are reported honestly;
- rendered review confirms the result in context;
- remaining changes are refinements rather than unresolved structural problems.
