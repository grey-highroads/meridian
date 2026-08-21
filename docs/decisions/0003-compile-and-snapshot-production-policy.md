# ADR 0003: Compile and snapshot production policy per job

- Status: Superseded in part by ADR 0005
- Date: 2026-08-01
- Owner: Higher Roads

## Context

Constrained, hybrid, and editorial modes must cause falsifiable changes in system behavior. Treating mode as prompt wording would hide asset locks, permissions, tool selection, evaluation priorities, and exceptions inside model context. Historical outputs would become difficult to explain after rules or provider behavior changed.

## Decision

Before execution, the system compiles system invariants, applicable brand rules, selected mode, request scope, actor authority, and available capabilities into an immutable policy snapshot.

The snapshot records required, permitted, conditional, and prohibited decisions; locked and flexible elements; allowed capabilities; deterministic operations; evaluation order; thresholds; approval route; and the source of every decision.

## Options considered

- Encode mode only in a master prompt.
- Evaluate compliance after generation without a preflight contract.
- Compile and pin an inspectable policy snapshot before execution.

## Rationale

Compilation makes policy testable, debuggable, and independent of any one provider. Snapshotting preserves historical explainability and allows the same brand brain to produce predictably different behavior under different modes.

## Consequences

- Scope or policy changes create a new snapshot.
- Execution plans target capabilities rather than named providers.
- Evaluation is derived from the snapshot, not improvised after generation.
- Binding conflicts block production before expensive work begins.

## Supersession note

ADR 0005 retains compilation and immutable snapshots but moves their boundary from one selected mode per job to configured policy per workflow stage.
