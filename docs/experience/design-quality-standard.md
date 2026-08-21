# Design Quality Standard

> Status: Active. This standard governs product design quality across Brand World System. It complements `docs/product-development-principles.md`, `docs/ui-contribution-guide.md`, and feature-specific handoffs.

## Purpose

Good design in Brand World System combines function, information architecture, interaction, language, aesthetics, accessibility, system consistency, and real-world validation.

A screen can be attractive and still be poorly designed. It can also be usable and still feel careless, dense, or generic. Quality comes from resolving the whole experience as one coherent system:

- the user understands where they are and what they can accomplish;
- the most important information is easiest to find;
- the interface asks only for decisions a person must make;
- actions happen where the user expects them to happen;
- the visual treatment creates rhythm, focus, and confidence;
- empty, filled, loading, error, locked, and responsive states feel intentional;
- the implementation belongs to the existing product rather than resembling a pasted-on reskin;
- the result improves through realistic content and direct use.

This document defines how to judge that quality. It is a working standard, not a style manifesto. Feature handoffs still govern local behavior and source contracts.

## Relationship to other documents

These documents answer different questions:

| Document | Primary question |
| --- | --- |
| `docs/product-development-principles.md` | Should this concept become a product feature? |
| This standard | Is the resulting experience thoughtful, elegant, and user-centered? |
| `docs/ui-contribution-guide.md` | Is the interface implemented consistently with the design system? |
| Feature handoffs | What local intent, behavior, and contracts must remain intact? |

Passing one document does not imply passing the others. A feature can be strategically valid and visually weak. A polished component can be attached to the wrong information architecture. A consistent implementation can faithfully reproduce an awkward workflow.

## The definition of thoughtful design

Thoughtful design shows evidence of judgment at every layer.

It decides:

- what belongs on the screen;
- what belongs somewhere else;
- what should be visible now;
- what should wait until requested;
- what the system already knows;
- what the user genuinely needs to decide;
- what deserves emphasis;
- what can remain quiet;
- how the experience behaves in incomplete and exceptional states;
- how the page feels as a full composition.

Thoughtfulness is visible in what has been removed as much as in what has been added.

## The definition of elegance

Elegance is low conceptual friction.

An elegant interface can support complex behavior. It does so with a small number of understandable ideas, stable patterns, and selective emphasis. It avoids making the user operate the architecture.

Elegance usually has these properties:

- the page has one clear organizing idea;
- hierarchy is legible without repeated explanation;
- related actions resolve locally;
- known values are inferred safely;
- advanced detail remains available without dominating the default state;
- visual cues carry distinct jobs rather than repeating the same message;
- every visible control earns its place;
- the design becomes quieter as certainty increases.

Lightness is therefore a quality of attention, not an absence of capability.

## The eight dimensions of design quality

### 1. Functional integrity

The experience must help the user complete a valuable job correctly.

Ask:

- What is the user's desired outcome?
- What decisions genuinely belong to them?
- Does every action have an immediate, understandable consequence?
- Can the task be completed without hidden prerequisites or architectural knowledge?
- Do safety and governance rules remain intact?

Common failures:

- a visually improved screen that preserves a broken workflow;
- an action label that does not match what happens;
- controls that imply capabilities the system does not have;
- a simplified interface that drops required data or weakens a contract;
- a polished empty state that gives the user no useful next action.

### 2. Information architecture

The page must express the user's mental model before the system's data model.

Ask:

- What are the few major jobs on this page?
- Which concepts are peers, and which are supporting detail?
- Is the same information competing in more than one place?
- Does the order match frequency, importance, and dependency?
- Can the user predict where a record, action, or explanation belongs?

Good information architecture creates durable boundaries. Guidance and inventory, creation and management, current state and future direction, and evidence and exact assets may share a page while remaining distinct jobs.

Common failures:

- organizing around schema categories ordinary users do not recognize;
- presenting optional or rare material as equal to foundational material;
- duplicating detailed records in both a guided layer and a library;
- using navigation styling for an action that happens in place;
- adding a summary layer that repeats the sections immediately below it.

### 3. Interaction continuity

The interface should preserve the user's location, context, and momentum.

Ask:

- Can a local task resolve locally?
- Does an expansion reveal only the fields needed for that choice?
- Does the user retain sight of the object or section they acted on?
- Are cancel, completion, and recovery paths obvious?
- Does progressive disclosure reduce simultaneous complexity?

Prefer an inline drawer, attached detail, or focused expansion when a task has a few fields and belongs to the current object. Use a new page when the task becomes a distinct job with its own navigation, history, or substantial decision sequence.

Common failures:

- replacing an entire page after a row click;
- asking the user to classify something they already selected by name;
- exposing a long generic form for a short specific task;
- opening several independent editors at once;
- hiding completion or error state outside the user's current context.

### 4. Language and decision clarity

Interface language should help a peer make a decision, not teach them the system's vocabulary.

Ask:

- Would the user use these words?
- Does the label describe the action and its consequence?
- Does helper copy answer a likely question?
- Can any sentence be removed because the layout already explains it?
- Are required distinctions described in plain language?

Good copy is specific, economical, and situated. It explains why a screenshot is needed at the point of upload. It distinguishes creative influence from governing authority without exposing those internal terms unnecessarily.

Common failures:

- schema names presented as user choices;
- labels that describe mechanism rather than intent;
- helper text repeated across the page without adding meaning;
- a short action surrounded by paragraphs of preemptive explanation;
- vague verbs such as Manage when a more precise action exists.

### 5. Visual hierarchy and craft

Visual design should direct attention, establish relationships, and make the product feel deliberate.

Judge the page as a vertical and spatial composition, not as a collection of isolated cards.

Ask:

- What should the eye see first, second, and third?
- Do spacing and alignment express grouping more clearly than borders alone?
- Is color carrying product meaning?
- Are typography, control size, density, and surface depth consistent?
- Does every section receive the amount of visual emphasis its job deserves?
- Are empty and filled states equally considered?

Craft includes small details: balanced card heights, aligned baselines, consistent icon geometry, calm borders, readable metadata, disciplined spacing, focused hover and selected states, and a convincing transition between sections.

Common failures:

- adding color, shadows, badges, and borders to every level;
- using several visual cues to communicate one status;
- translating a mockup literally without resolving page rhythm;
- letting one optional section feel more important than a foundational one;
- treating spacing as leftover room rather than an active design tool.

### 6. States, responsiveness, and accessibility

The design is the complete set of states, not the ideal screenshot.

At minimum, consider:

- empty;
- partially filled;
- complete;
- active or expanded;
- loading or processing;
- success;
- error;
- locked or read-only;
- narrow desktop, tablet, and mobile;
- keyboard and reduced-motion use.

Ask:

- Does the hierarchy survive when content wraps?
- Can every action be understood without color?
- Is keyboard order logical in collapsed and expanded states?
- Are focus, labels, live status, and disclosure semantics present?
- Does the narrow layout preserve job order rather than merely stack boxes?

Accessibility is part of design quality from the beginning. It is not a validation layer applied after visual approval.

### 7. System coherence

The feature should feel native to Brand World System.

Ask:

- Which existing components and interaction patterns already solve this problem?
- Which tokens express the needed spacing, surface, border, and semantic state?
- Does a new pattern deserve to become reusable?
- Is the variation meaningful, or is it accidental drift?
- Does the implementation preserve established behavior and data contracts?

Coherence does not require every screen to look identical. The system provides a shared grammar. Individual pages use that grammar to express different jobs.

Common failures:

- random inline styles;
- parallel token or component systems;
- near-duplicate cards with slightly different spacing and controls;
- importing an attractive pattern that conflicts with the product's interaction language;
- allowing technical convenience to determine visible hierarchy.

### 8. Evidence and refinement

Design quality must survive real content and real interaction.

Ask:

- Was the current repository and rendered screen inspected before redesign?
- Were nearby representative screens studied?
- Were multiple structural directions compared?
- Was the design tested with realistic mixed states?
- Did implementation receive a full-page visual review?
- Was user feedback interpreted as evidence about the system rather than a request for surface styling alone?

Mockups are probes. Code is another probe. The live product is the final test. Each stage can reveal an information-architecture problem that the prior stage hid.

## Design quality scorecard

The scorecard makes tradeoffs explicit. It does not turn design judgment into arithmetic. A critical failure cannot be offset by decorative polish.

| Dimension | Weight |
| --- | ---: |
| Functional integrity | 20 |
| Information architecture | 15 |
| Interaction continuity | 15 |
| Language and decision clarity | 10 |
| Visual hierarchy and craft | 15 |
| States, responsiveness, and accessibility | 10 |
| System coherence | 10 |
| Evidence and refinement | 5 |
| Total | 100 |

Interpretation:

- **90 to 100:** coherent, elegant, and ready to establish a reusable product pattern;
- **80 to 89:** strong and shippable, with refinements that can proceed incrementally;
- **70 to 79:** directionally sound but carrying a meaningful hierarchy, interaction, or state problem;
- **below 70:** redesign before implementation or release.

Every shippable design must also pass these gates:

- the core job can be completed;
- required contracts and safety rules remain intact;
- the user is not required to understand internal architecture;
- keyboard and responsive paths remain usable;
- the design uses the established system or deliberately extends it;
- no major section duplicates another section's job.

## The emphasis budget

Every page has a limited emphasis budget. Spend it on distinctions the user needs.

Typical hierarchy levels are:

1. product and location;
2. page and primary job;
3. sections or major decisions;
4. local tasks and records;
5. requested detail.

A sixth layer should be rare. Repeated summary strips, nested cards, status pills, section rails, accent borders, progress bars, and helper panels can each create another perceived level. Combining all of them makes the user re-parse the page several times.

Before adding a visual cue, state its unique job. Remove or demote it when another element already performs that job.

## Subtractive design review

After the first coherent design exists, run a subtractive pass.

For every surface, label, metric, border, icon, and control, ask:

1. What decision or understanding does this support?
2. Is that job already handled elsewhere?
3. What breaks if this becomes quieter?
4. What breaks if it disappears?
5. Can the system infer this safely?

The goal is not maximum removal. The goal is maximum clarity per visible element.

## Case study: the three Sources directions

The 2026-08-14 Brand Brain Sources redesign produced three Superdesign directions from one reproduced baseline. They are retained in the [Brand World System Superdesign project](https://superdesign.dev/teams/5e8335ee-7354-43d1-94d6-77cd3d9b6150/projects/48e84143-282e-489c-86fc-f6c0dce4c1eb).

The scorecard can be applied retrospectively to show the relative movement. These are directional design-review scores, not empirical usability measurements:

| Direction | Approximate score | Qualification |
| --- | ---: | --- |
| Guided coverage | 76 / 100 | Correct information model, with duplicated orientation and too many simultaneous hierarchy bands |
| Section rhythm | 83 / 100 | Strong macro composition and visual craft, with emphasis spent at too many levels |
| Compact inline drawers | 87 / 100 | Best interaction continuity and restraint, with some card content still too thin |
| Shipped hybrid | 89 / 100 | Strong and shippable, combining section rhythm, local disclosure, and richer practical guidance; appropriate for small ongoing refinements |

The improvement came less from adding visual sophistication and more from allocating it selectively. The final two points came from restoring useful content without restoring structural weight.

### Direction A: Guided coverage

Draft: [Guided Sources Redesign](https://p.superdesign.dev/draft/53d91a39-f74b-4112-833c-07bde62f5024)

What it improved:

- converted foundation into four recognizable slots;
- separated real-world examples from core materials;
- introduced More context as a lighter entry point;
- made mixed completion states concrete;
- clarified the detailed library boundary.

What it added:

- one global orientation surface above the existing Brand Brain navigation;
- three coverage concepts summarized before the same concepts appeared as sections;
- a large container around Brand foundation;
- section helper copy, row status, actions, and library status all visible at once.

This direction solved the information model while adding a second dashboard to explain it. The orientation strip repeated the page architecture and increased the number of simultaneous hierarchy bands from four to five. It felt comprehensive, but less calm.

### Direction B: Section rhythm

Draft: [Brand Brain Sources Redesign](https://p.superdesign.dev/draft/b74fbaec-ba87-490a-a13d-4256d93c63fc)

What it improved:

- removed the extra orientation dashboard;
- established the strongest vertical rhythm of the three directions;
- used numbered sections and rails to make the four-part architecture legible;
- introduced a meaningful progress bar for finite foundation coverage;
- gave the social cards equal stature and generous spacing;
- created a clear transition into the detailed library.

What it added:

- a 48px section gap throughout the main stack;
- colored rails at the section level;
- colored state bars on each foundation row;
- several card-edge accents and status pills;
- right-aligned explanatory copy in multiple section headers;
- full-width card actions in the presence section.

This direction demonstrated the value of page-level composition. It was the most visibly designed version and the key source for the final section rhythm. Keeping every cue would have spent emphasis at the section, row, card, and status levels simultaneously. The right lesson was the macro hierarchy, not every decorative articulation.

### Direction C: Compact inline drawers

Draft: [Sources Redesign - Compact Inline Drawers](https://p.superdesign.dev/draft/f7ffe812-f9d5-4e71-b375-2c28128d6e5c)

What it improved:

- kept the four numbered sections and their vertical rails;
- removed the global orientation strip;
- made foundation rows compact and locally actionable;
- kept the three presence cards simple;
- reduced More context to one quiet entry row;
- attached the form directly beneath the selected row or card group;
- kept All sources visible as the one detailed library.

What it constrained:

- one inline task can be open at a time;
- a named slot asks only for the fields it cannot infer;
- More context offers two input methods instead of four source-category cards;
- advanced controls remain collapsed until requested;
- detailed records stay out of Brand foundation;
- only one compact recent-work example may appear above the library.

This direction was the lightest touch and the most elegant interaction model. It changed less of the product while solving more of the user's friction. Its restraint came from selective inference, local disclosure, and a stronger boundary between guidance and inventory.

## The shipped Sources landing point

The shipped page is a selective hybrid rather than a literal implementation of one canvas.

It retained from the section-rhythm direction:

- four numbered sections;
- deliberate vertical spacing;
- semantic section rails;
- equal presence cards;
- progress only where coverage has a finite denominator;
- a clear transition into All sources.

It retained from the compact-drawer direction:

- no global orientation dashboard;
- local expansion instead of page replacement;
- one active drawer at a time;
- direct forms for known source slots;
- collapsed advanced controls;
- a lightweight File or Link path for More context;
- the library as the only detailed inventory.

It then restored richer practical guidance inside the presence cards, because the lightest visual treatment still needed enough content to make Instagram, LinkedIn, and Recent work actionable.

The landing point can be quantified:

- **4** major page sections;
- **2** progress bars, used only for Brand foundation and How the brand shows up;
- **8** guided entry surfaces above the library: 4 foundation rows, 3 presence cards, and 1 More context row;
- **1** expanded task at a time;
- **0** detailed records inside Brand foundation;
- **1** compact Recent work example at most above the library;
- **2** More context input methods: File and Link;
- **1** detailed source library;
- **5 to 7** contract decisions safely inferred by a named slot, depending on the source: kind, form, material treatment, provenance, aspiration, usage default, and sometimes asset kind.

This is light-touch design with a high ratio of function to interface. The page retains every source contract and meaningful action while reducing repeated classification, page displacement, and competing hierarchy.

## Lessons from the comparison

### More designed is not automatically better designed

Direction B showed the strongest visible craft, but the final page became better when several of its signals were softened or removed. Good design chooses which craft decisions matter most.

### A progress cue earns its place through a denominator

Foundation has four known slots. Real-world examples have three. Their progress bars answer a concrete question. More context is open-ended, so a progress bar would imply a false target.

### Locality can simplify without weakening function

Named slots pre-answer several contract decisions. The compact drawer preserves the contract while removing redundant questions. More context asks provenance and aspiration because those answers remain genuinely unknown.

### Rich content and light structure can coexist

The social cards became more helpful after practical upload guidance returned. The improvement came from useful content inside a restrained structure, rather than from adding another panel or status system.

### The mockup is evidence, not an instruction sheet

The final implementation borrowed the best structural insight from one direction, the best interaction model from another, and content refinements from live review. Thoughtful implementation preserves the reasoning behind a mockup while adapting its literal details to contracts, components, and real states.

## Design workflow

### 1. Inspect before proposing

Read the current repository, render the current page, trace its actual interaction path, inspect the design system, and study two to four nearby screens. Confirm the branch is current.

### 2. Frame the user job and invariants

Write down:

- the outcome;
- the decisions the user must make;
- what the system can infer;
- contracts and safety rules that cannot change;
- the states that must exist;
- the current friction in user language.

### 3. Model the information architecture

Group content by user job. Establish order, hierarchy, ownership, and where detailed records live. Resolve duplicate jobs before styling.

### 4. Explore structurally distinct directions

Variations should test meaningful tradeoffs such as:

- guided versus direct;
- page replacement versus local disclosure;
- summary-first versus task-first;
- compact versus explanatory;
- centralized versus distributed control.

Changing color or card radius alone is not a meaningful design direction.

### 5. Compare, then subtract

Use the scorecard and critical gates. Identify which direction has the strongest organizing idea. Borrow selectively when another direction solves a local problem better. Run the subtractive review before implementation.

### 6. Implement through the system

Reuse components, tokens, spacing, typography, interaction patterns, and accessibility conventions. Create a reusable pattern when the system genuinely lacks one. Preserve contracts and settled behavior.

### 7. Verify the whole experience

Review realistic empty, mixed, complete, active, error, locked, and responsive states. Exercise keyboard behavior. Inspect the full-page rhythm and the transition between sections.

### 8. Refine from live evidence

Treat user reactions to spacing, density, wording, and unexpected workflows as product evidence. Diagnose the underlying hierarchy or interaction problem before applying a surface fix.

## Using Superdesign thoughtfully

Superdesign canvases are comparison tools. The workflow should preserve the distinctions between alternatives:

1. reproduce the current rendered target as ground truth;
2. branch directions around different information or interaction hypotheses;
3. keep the established visual system fixed while varying structure;
4. compare full pages rather than isolated components;
5. identify what each direction proves;
6. select or combine principles after user review;
7. implement only after the direction is understood.

The preferred result is often the least intervention that fully resolves the problem. Canvas density, novelty, and visible design effort are not quality measures by themselves.

## Review checklist

Before presenting a design:

- Can the primary job be stated in one sentence?
- Are the page's major sections organized around user jobs?
- Is any information doing the same job twice?
- Does the design ask only what remains unknown?
- Do local actions resolve locally when appropriate?
- Is there a clear first, second, and third level of attention?
- Has the emphasis budget been spent selectively?
- Are realistic mixed states represented?
- Are empty and filled states equally thoughtful?
- Is helper copy useful at the point of need?
- Do visual details use the existing design system?
- Does responsive behavior preserve job order?
- Are keyboard, focus, labels, and reduced motion considered?
- Has a subtractive pass been completed?

Before shipping:

- validate the core interaction path;
- validate required contracts and data output;
- test desktop and narrow layouts;
- check loading, error, locked, and partial states that apply;
- compare the implementation to the intended page rhythm;
- confirm no unrelated behavior changed;
- get user review for meaningful visual changes;
- record durable reasoning in a feature handoff when the pattern is new.

## Common warning signs

- The design is described mainly with adjectives rather than user outcomes.
- A new summary repeats the sections below it.
- Every section has a different card or control pattern.
- Several colors, borders, pills, and icons communicate the same state.
- A row click opens a workflow unrelated to the row's visible context.
- Optional content receives more visual weight than core content.
- The upper page and lower library both manage the same records.
- A user-facing choice exists because the schema has a field.
- The mockup looks good only in its ideal filled state.
- The implementation introduces hardcoded styles to match one screenshot.
- The design requires a long explanation of how to use it.
- The most elaborate direction is assumed to be the strongest.

## Definition of done

A design is done when:

- the primary job is understandable and completable;
- the information architecture matches the user's mental model;
- interaction preserves context and reveals complexity progressively;
- language supports decisions in plain terms;
- visual hierarchy and craft feel deliberate across the whole page;
- realistic states, responsiveness, and accessibility are resolved;
- the implementation uses or thoughtfully extends the design system;
- contracts and safety rules remain intact;
- user review confirms the design feels clear and considered;
- remaining changes are small refinements rather than unresolved structural problems.
