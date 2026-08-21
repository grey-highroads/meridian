# ADR 0002: Model canon as a governed view across domains

- Status: Accepted
- Date: 2026-08-01
- Owner: Higher Roads

## Context

An earlier model risked treating Canon as a content layer alongside Foundation, Identity, World, Production, and Memory. That would mix what an entity means with how authoritative it is. Canonical logos, rituals, claims, and production rules belong to different content domains while sharing binding governance status.

Approval and canonical status also answer different questions. Approval permits use within scope. Canonical status makes an entity identity-defining and change-controlled.

## Decision

Content domain, governance role, lifecycle, and epistemic origin are orthogonal dimensions.

Canon is the governed view of current entities whose governance role is `canonical` and lifecycle is `approved`. It is not a sixth domain or a storage container.

Nothing becomes canonical without approval. Approval does not automatically confer canonical status.

Production effect belongs to scoped rules or policy relationships. A prohibition is a rule with a prohibited effect, not a lifecycle or entity status.

## Options considered

- A dedicated Canon domain.
- Authority encoded indirectly through metadata on a Canon layer.
- Canon as a governed cross-domain view.

## Rationale

The selected model prevents domain and authority from drifting together, permits identity-defining entities in every relevant domain, and makes approval and promotion separate governable actions.

## Consequences

- Schema validation enforces canonical approval but not the reverse.
- Queries construct canon from governance dimensions.
- Interfaces must separate approve, promote to canon, and revise canon.
- Migration tools must map former layer-based models to domains and governance metadata.
