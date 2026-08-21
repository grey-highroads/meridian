# BWS \- Campaign Context Layer Build Brief

Version: 0.1  
Purpose: Define the product model, UX direction, architecture implications, and MVP scope for introducing Campaigns as an optional strategic context layer.

---

# 1\. Executive Summary

Brand World System currently centers around the Brand Brain, a persistent understanding of a brand's identity, visual language, voice, and creative possibilities.

The next phase introduces Campaigns as an optional strategic context layer between the Brand Brain and individual generated outputs.

The purpose of Campaigns is not to organize files. Campaigns provide temporary strategic context around a business objective, audience, message territory, and creative direction.

The system must support three distinct creative modes:

1. Brand World Exploration  
2. Campaign Execution  
3. Standalone Asset Creation

All output formats remain available in every mode.

Campaigns add context. They do not constrain production.

---

# 2\. Problem Statement

Current generative workflows treat each output as an isolated request.

A marketer does not think this way.

Marketing teams operate across layers:

## Brand Layer

The evergreen identity.

Examples:

- Website redesign  
- Sales collateral system  
- Brand refresh  
- Visual language expansion

Question:

"Does this feel like us?"

## Campaign Layer

A strategic moment with a beginning, middle, and end.

Examples:

- Product launch  
- Seasonal initiative  
- New audience push  
- Perception shift  
- Demand generation campaign

Question:

"Does this help us achieve this moment's objective?"

## Asset Layer

Individual executions.

Examples:

- LinkedIn image  
- Email hero  
- Paid social creative  
- Website banner  
- Product image

Question:

"Does this solve the communication need?"

The product must reflect how marketers think.

---

# 3\. Core Product Principle

Campaigns are optional.

A user should never need to create a campaign to make useful creative.

The system must support:

## World Image

A visual exploration of the brand universe.

Example:

"Show what this brand feels like during a morning ritual."

Context: Brand Brain

Purpose: Expand visual language.

Evaluation: Does this represent the brand?

---

## Campaign Image

A visual execution inside a strategic campaign.

Example:

"Create a hero image for our Summer Reset campaign."

Context: Brand Brain \+ Campaign Brain

Purpose: Support a business objective.

Evaluation: Does this represent the brand and campaign?

---

## Standalone Image

A specific communication need.

Example:

"Create an image for our founder's LinkedIn post."

Context: Brand Brain \+ request-specific direction

Purpose: Solve a single communication requirement.

Evaluation: Does this represent the brand and accomplish the communication goal?

---

# 4\. Revised Information Architecture

Campaigns should not sit above assets as a mandatory hierarchy.

Recommended model:

Brand Brain

Persistent brand intelligence.

Contains:

- Brand identity  
- Visual principles  
- Voice  
- Audience understanding  
- Canonical assets  
- Approved visual directions  
- Brand learnings

Campaign Brain

Optional strategic context.

Contains:

- Business objective  
- Audience  
- Motivation  
- Messaging territory  
- Creative direction  
- Product focus  
- Campaign constraints  
- Campaign learnings

Asset Request

Specific production intent.

Contains:

- Format  
- Dimensions  
- Channel  
- Composition  
- Text requirements  
- Product requirements

Generated Output

The artifact.

---

# 5\. Campaign Definition

A Campaign is:

A persistent creative context that translates a business objective into a temporary brand expression.

A Campaign is not:

- A folder  
- A collection of assets  
- A deliverable list  
- A naming convention

---

# 6\. Campaign Brain Model

Campaign creation should collect strategic context.

Avoid recreating a traditional agency brief form.

The system should use conversational collection and synthesis.

Input:

"Tell me about this campaign."

The system extracts and structures:

---

## Campaign Identity

Name

Example: "Summer Reset"

Description

A simple explanation of the initiative.

---

## Business Objective

Why does this campaign exist?

Examples:

- Launch a product  
- Increase awareness  
- Shift perception  
- Enter a new audience  
- Support sales activity

---

## Audience

Who are we trying to influence?

Includes:

Primary audience

Audience insight

Current belief

Desired belief

Desired action

---

## Strategic Territory

What idea organizes the campaign?

Includes:

Campaign idea

Message territory

Supporting proof points

Competitive context

---

## Creative Direction

How does this campaign relate to the brand world?

Includes:

Preserve:

- Existing brand qualities

Explore:

- New visual territory

Campaign-specific elements:

- Palette shifts  
- Photography style  
- Environments  
- Motifs  
- Composition patterns

---

## Product Context

Includes:

Products involved

Canonical assets

Claims

Constraints

---

## Channel Context

Includes:

Primary channels

Required asset families

Distribution needs

---

# 7\. UX Recommendation

Do not expose "Campaign" as the first creative decision.

The user should start with intent.

Recommended entry:

"What are you creating?"

Options:

## Explore the Brand

Generate world images.

## Create for a Campaign

Use existing campaign context.

## Create Something Specific

Generate standalone assets.

---

# 8\. Asset Model Simplification

The introduction of Campaigns allows asset types to become simpler.

Current tendency:

Create separate workflows:

- Social image  
- Website hero  
- Email banner  
- Product image  
- Presentation image

Recommended:

Asset creation uses configuration.

Dimensions:

- Square  
- Portrait  
- Landscape  
- Custom

Composition:

- Product included  
- Human included  
- Environment only  
- Multiple products

Text:

- No text  
- User supplied text  
- Generated copy

Channel:

- LinkedIn  
- Instagram  
- Email  
- Website  
- Presentation

The strategic context comes from Brand Brain and Campaign Brain.

---

# 9\. Feedback and Learning Model

The introduction of Campaigns creates three learning loops.

## Brand Learning

Input: World explorations

Question: "What represents this brand?"

Updates: Brand Brain

---

## Campaign Learning

Input: Campaign outputs and feedback

Question: "What works for this campaign?"

Updates: Campaign Brain

Examples:

Approved: "Everyday rituals outperform extreme adventure imagery."

Rejected: "Aspirational luxury settings feel disconnected."

---

## Asset Learning

Input: Individual production feedback.

Question: "How do we make this output better?"

Updates: Generation process.

---

# 10\. MVP Scope

## Build

Campaign entity

Campaign creation flow

Campaign workspace

Campaign context compilation

Campaign-aware generation

Campaign output history

Campaign feedback capture

---

## Do Not Build Yet

Campaign analytics

Performance attribution

Complex approval workflows

Team collaboration

Automated campaign recommendations

Full marketing calendar

---

# 11\. Architectural Implications

The generation pipeline changes from:

Brand Context → Asset Request → Output

to:

Brand Context

Optional Campaign Context

Asset Request

↓

Creative Compilation

↓

Generation

↓

Evaluation

↓

Learning

---

# 12\. Success Criteria

The Campaign layer succeeds if:

A marketer can create a campaign once and produce many assets without restating strategy.

Generated assets feel related without looking repetitive.

Campaign outputs feel distinct from general brand exploration.

The system understands the difference between:

"This feels like our brand."

and:

"This feels like our campaign."

The user understands why they are generating something before choosing an asset format.

---

I would put this document alongside the Brand Brain architecture docs, not inside the implementation docs. This is a product thesis document that should guide implementation decisions. The next artifact after this should probably be a Campaign data model and UX flow spec, because those will force the transition from concept into architecture.  
