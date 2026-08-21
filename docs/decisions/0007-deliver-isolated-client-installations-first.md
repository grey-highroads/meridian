# ADR 0007: Deliver isolated client installations first

- Status: Superseded in part by ADR 0011
- Date: 2026-08-02
- Owner: Higher Roads

## Context

The fastest commercial path is not a generalized enterprise platform. It is a repeatable response to a concrete event: Higher Roads sells a Brand World build, configures the reusable system for that client, and gives the client's team a working production application.

Several users still need authentication, roles, durable jobs, and protected client data. Building dynamic multitenancy, cross-client administration, shared billing, and self-service provisioning before the first installations would delay learning and over-engineer assumptions that have not been validated.

ADR 0004 correctly separates shared product infrastructure from private client data, but it assumed tenant isolation inside a shared platform runtime. The initial delivery model can preserve the same boundary more simply through deployment isolation.

## Decision

The first commercial delivery unit is an **isolated client installation** of a versioned shared application.

Each installation receives:

- one pinned version of the shared application and contracts;
- its own Brand Brain, workflow configuration, assets, jobs, and memory;
- its own database, object storage, queues, caches, secrets, and provider credentials;
- its own domain and access boundary; and
- a small configured role set appropriate to the engagement.

The application records a server-assigned `installation_id` on durable artifacts and events. Users do not select or manage this value. It provides lineage and a migration handle without introducing tenant switching or row-level tenant administration.

Authentication and access control remain baseline requirements. A simple installation-wide identity gate and fixed roles are sufficient initially. CORS is not authentication.

Client differences live in configuration and data, not long-lived forks of the shared application. If a client has several materially different brands, they may initially receive separate installations.

## Deferred platform capabilities

- tenant switching and cross-client administration;
- row-level multitenant storage and search;
- self-service organization, user, and role management;
- automated customer provisioning;
- shared usage metering and billing;
- generalized enterprise permissions; and
- portfolio-wide multi-brand administration.

These capabilities require later evidence and a separate decision.

## Options considered

- Build a multitenant enterprise platform before the first client installation.
- Fork the entire application for every client.
- Reuse a shared versioned core while deploying isolated, configured client installations.

## Rationale

Deployment isolation provides a credible security and ownership boundary with far less platform machinery. It supports the intended sales motion, keeps private client systems separable, and lets the team learn which configuration surfaces are truly reusable.

Avoiding application forks preserves the commercial value of the reusable 80 percent. A client installation can be upgraded by advancing its pinned core version and migrating its configuration rather than manually reconciling divergent codebases.

## Consequences

- An installation profile becomes a first-class deployment artifact.
- Durable records inherit `installation_id` from the server rather than user input.
- Infrastructure bindings and credentials are provisioned per installation.
- Initial roles may remain small and fixed, but actors are still recorded on decisions and approvals.
- Shared code must not embed one client's secrets, assets, rules, or terminology.
- Installation creation may begin as an internal checklist and later become an automated template.
- ADR 0004 remains authoritative about separating shared infrastructure from private client material, but its row-level multitenant assumption is superseded for the initial delivery model.
