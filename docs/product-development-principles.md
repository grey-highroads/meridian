# Product Development Principles

> Status: Active. These principles govern product, architecture, design, and implementation decisions in this repository.

## Product before architecture

Brand World System exists to help people build dependable brand knowledge and complete valuable brand-production work. Architecture supports those jobs; architectural concepts are not automatically product features.

The development sequence is:

1. define the user's job and desired outcome;
2. identify the decisions a person genuinely needs to make;
3. decide what the configured workflow can determine automatically;
4. model the interaction, exceptions, and failure recovery;
5. introduce the architecture required to support that experience;
6. generalize only after a pattern repeats across fixtures or clients.

## Product architecture test

Every major concept must answer:

1. **Who encounters it?** Name the role and context.
2. **What are they trying to accomplish?** State the job and outcome without system terminology.
3. **What decision must they make?** If there is no meaningful decision, the concept may not belong in the interface.
4. **Why can the system not decide automatically?** Expose only uncertainty, authority, preference, or risk that genuinely requires a person.
5. **What happens immediately afterward?** The action must have a visible consequence.
6. **What would the user call it?** Prefer the user's language to the architecture's language.
7. **What is lost if it is hidden?** If nothing important is lost, keep it internal.

Concepts that cannot pass this test are internal mechanisms, workflow configuration, or unproven hypotheses—not primary product features.

## Visibility classes

Every consequential concept is assigned one primary current visibility class:

- **User-facing:** a person understands and directly acts on it during a real job.
- **Workflow configuration:** a system steward or authorized administrator configures it while installing or maintaining a workflow.
- **Internal mechanism:** the system requires it for reliable behavior, but ordinary users do not need to see its native representation.
- **Unproven:** the concept remains a hypothesis until a journey, interface probe, fixture, or client engagement demonstrates value.

Classification can change with evidence. An internal mechanism may gain a derived user-facing summary without exposing its native representation; a proposed feature may disappear; an advanced control may remain restricted to system stewards.

The current classification is maintained in [`concept-visibility.md`](concept-visibility.md).

## Interface probes are architecture tests

An interface makes abstract decisions concrete. Early mockups should test:

- whether the user knows how they arrived at the screen;
- whether the system is asking them to make a decision they understand;
- whether terminology matches their mental model;
- whether configuration has leaked into everyday work;
- whether approval, failure, and recovery are legible;
- whether the promised value is visible before technical detail.

A mockup that reveals an awkward abstraction has succeeded as a probe. The resulting learning must update product and architecture documents before implementation hardens the mistake.

## The reusable 80 percent

The goal is to begin a client build with roughly 80 percent of the reusable system capability already available. It does not mean giving every client the same screens plus a large settings menu.

The reusable base should contain:

- brand-brain storage, versioning, provenance, governance, and retrieval;
- evidence and asset intake patterns;
- workflow runtime and durable state;
- policy primitives and compilation;
- deterministic and generative capability adapters;
- evaluation, revision, approval, memory, audit, and observability;
- reusable interaction patterns for intake, exceptions, review, and job history.

The client build configures and composes those capabilities around the client's actual workflows, language, roles, systems, and risk. The final experience may omit most platform concepts even though it depends on them.

## Evidence gates

- Do not add a top-level navigation item without a recurring user job.
- Do not add a setting when a workflow default can make the decision reliably.
- Do not add a universal field when an entity profile or system-derived default is sufficient.
- Do not expose an internal score without a clear interpretation and user action.
- Do not create a new workflow variation until repetition shows it cannot be expressed as configuration or a stage change.
- Do not generalize from one fixture when the abstraction claims to support several clients or media types.
- Do not treat implementation flexibility as user value unless it improves an observable outcome.

## Product review requirement

Before a major ADR or implementation commitment is accepted, its author should state:

- the user job it supports;
- the intended visibility class of each new concept;
- the simplest experience that could prove its value;
- the evidence that justifies making it reusable;
- the failure or maintenance burden it introduces.

Engineering quality remains essential. The requirement is that engineering rigor attach to a validated product need.
