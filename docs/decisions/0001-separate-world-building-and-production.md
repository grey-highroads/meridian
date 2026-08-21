# ADR 0001: Separate world-building from production

- Status: Accepted
- Date: 2026-08-01
- Owner: Higher Roads

## Context

PWP demonstrated inference from incomplete evidence and editorial articulation of a brand world. Riggg demonstrated controlled production from explicit assets and rules. Combining these responsibilities in one prompt or undifferentiated workflow obscures provenance, makes approvals ambiguous, and causes production requests to reconstruct brand intelligence repeatedly.

## Decision

The system has two workflows sharing one persistent brand brain:

1. world-building ingests evidence and creates, reviews, and evolves governed knowledge;
2. production retrieves a versioned subset of that knowledge, compiles policy, produces an output, evaluates it, and records memory.

Production may propose learning but cannot write directly to canon.

## Options considered

- One end-to-end generative workflow per deliverable.
- Separate world-building and production with duplicated storage.
- Two workflows over one shared persistent brand brain.

## Rationale

The selected model preserves a durable source of truth while allowing inference-first and canon-first work to use different operating patterns. It also makes approval and failure boundaries explicit.

## Consequences

- The workflows require separate contracts and state transitions.
- Production jobs pin brand-brain versions rather than reading mutable state throughout execution.
- Corrections become memory proposals before governance.
- User experience must show whether a person is changing the brand brain or producing from it.
