# ADR 0010: Route production feedback through candidate rules

- Status: Accepted
- Date: 2026-08-05
- Owner: Higher Roads

## Context

The result and evaluation screen introduced feedback routing: a user who dislikes a generated output can provide feedback scoped to the current output, a future-work proposal, or a brand-rule proposal. The design question was whether broader-than-this-output feedback should write directly to the Brand Brain.

The concern: a user who dislikes a result for subjective, emotional, or unrealistic reasons could provide feedback that gets processed and degrades the Brand Brain. "Make it pop more" is not a brand rule. "I don't like this one" is not a production pattern. If feedback auto-writes to the brain, the brain drifts from governed brand intelligence toward an accumulation of uncurated reactions.

## Decision

Production feedback never auto-writes to the Brand Brain. Three scopes exist:

**Fix this one.** Scoped to the current output. Routes back to preflight for a manual retry. Nothing is recorded in the Brand Brain.

**Propose for future work.** Creates a candidate rule. The feedback is logged in a review queue with the source output, the user's instruction, and a timestamp. A qualified reviewer must approve it before it affects anything. This is the "approve guidance" action.

**Propose as a brand rule.** Same queue, flagged as a potential canonical change. Requires brand-owner authority to promote. This is the path toward "promote to canon."

The glossary's definition of candidate rule already requires this pattern: "Promotion always requires human approval." The implementation matches the spec.

## Options considered

- Auto-write all feedback to the Brand Brain (rejected: degrades the brain).
- Auto-write feedback with a confidence threshold (rejected: the threshold is a judgment that belongs to a human reviewer, not a heuristic).
- Route all broader feedback to a candidate rule queue for human review (accepted).

## Rationale

The Brand Brain is the durable product. Its quality depends on governed, deliberate changes. Production is high-volume and often emotionally charged (the user just saw a result they may not like). Inserting a review step between production feedback and brain changes protects the brain's integrity while preserving the learning loop.

The candidate rule queue is session-scoped in the current prototype. Server-side persistence and a dedicated governance screen for reviewing candidate rules across jobs are deferred until a real workflow proves the queue's volume and value.

## Consequences

- The result screen offers three feedback scopes with clear language about what each one does.
- Candidate rules appear in a "Pending review" card on the result sidebar.
- The brain history log records every submission and dismissal for provenance.
- A future "Needs you" governance surface should aggregate candidate rules across jobs for batch review.
- The resolved-vs-unresolved distinction in the review queue is a known scaling concern: resolved items should eventually archive out of the active view.
