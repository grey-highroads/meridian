# ADR 0011: Operate a shared multi-client deployment alongside isolated installations

- Status: Accepted
- Date: 2026-08-07
- Owner: Higher Roads
- Supersedes: ADR 0007 in part (deployment isolation as the only delivery model; the deferral of tenant switching and cross-client administration)
- Related: ADR 0004 (shared platform vs. private brand data), ADR 0007 (isolated client installations)

## Context

ADR 0007 chose isolated client installations as the first commercial delivery unit and deferred tenant switching, cross-client administration, and row-level multitenant storage until later evidence.

That evidence has arrived, from operations rather than from a client request. Higher Roads acts as system steward for every client. Onboarding a new client means building and configuring their Brand Brain, which is work the steward performs inside the application. With isolated installations only, the steward must provision a full deployment before configuration can begin, and must move between deployments to operate multiple clients. Feature updates must be rolled out installation by installation. The current prototype makes the problem concrete: it is a single-brain deployment with one shared password and one storage namespace, and it cannot represent a second client at all.

Two additional needs surfaced at the same time. First, the application needs a distinction between steward, client admin, and client member, because the three approval actions (approve output, approve guidance, promote to canon) require different authority. Second, clients need different deliverable catalogs. A consumer brand needs marketing asset presets; a tour media operation needs different asset types and render configurations. The concept-visibility map already classifies deliverable presets as client-configured, but the mechanism does not exist: the current deliverable type is hardcoded.

## Decision

Higher Roads operates one **shared multi-client deployment** as the primary environment for onboarding, configuring, demonstrating, and running clients. **Isolated installations remain an available delivery unit** for clients whose engagement requires a hard ownership and security boundary. ADR 0007's fork prohibition and config-not-code principle are unchanged and now govern both models.

Inside the shared deployment:

**Client records and namespaced state.** Each client is a record with an id, name, status, and configuration reference. All durable state (brain, campaigns, outputs, candidate rules, consumption records, assets) is stored under the client's namespace. No state exists outside a client namespace except the client list and platform configuration itself. The `installation_id` concept from ADR 0007 carries over as the client id: server-assigned, recorded on durable artifacts, never user-managed.

**Client switching for the steward.** The system steward can switch the active client. Switching reloads all state from the selected client's namespace. Onboarding a new client is: create the client record, then run the existing brand-brain build journey inside that client's context. No separate onboarding workflow is introduced.

**Roles map to the existing governance roles.** The glossary's people roles become application roles. The system steward sees all clients and holds the switcher. A brand owner is scoped to their client and holds canonical approval authority there. A workflow approver is scoped to their client and approves outputs without touching canon. Role names in the interface use plain language per the standing rule.

**Deliverable catalogs are client configuration.** Each client's configuration declares its deliverable catalog: asset type names, dimensions, requirement rules, and which render recipe each entry uses. Catalog entries are configuration; render capabilities are code. A catalog entry may only reference recipes the platform implements. When a client needs genuinely new render behavior, that is a platform feature built once in the shared application, then available to any client whose catalog references it. This line is what prevents the fork problem from reappearing inside the configuration layer.

**Migration between models stays possible.** Because all client state lives under one namespace, a client can be exported from the shared deployment into an isolated installation, or imported from one, without transformation of the data model. The shared deployment and isolated installations run the same versioned application.

## Sequencing

The shared deployment is adopted in two steps, honoring the boundary between the prototype and the first implementation slice.

**Prototype scope.** Client records, namespaced storage, and the steward's client switcher. This is the minimum needed to onboard and demonstrate multiple clients now. The existing shared-password gate remains temporarily; it cannot express identity and is acknowledged as a placeholder.

**Implementation slice scope.** Real authentication, enforcement of the three roles, the deliverable-catalog mechanism as data, and server-side persistence of candidate rules and consumption records. These are scoped with Jim as part of the first implementation slice rather than threaded through the prototype.

## Still deferred

- Self-service client signup and automated provisioning
- Client-facing configuration editing (the steward edits configuration documents)
- Billing and usage metering
- Organization hierarchies and per-user permission matrices
- Portfolio-wide analytics across clients

## Options considered

- Continue with isolated installations only, provisioning a deployment per client before onboarding (rejected: operationally unworkable for the steward and slows every feature rollout).
- Replace isolated installations entirely with the shared deployment (rejected: discards a sellable ownership boundary that some clients will pay for, at no architectural savings).
- Operate a shared multi-client deployment as the primary environment while keeping isolated installation as an available delivery unit (accepted).

## Rationale

The steward's daily work is cross-client by nature. A delivery model chosen for client-facing boundaries should not dictate the steward's operating environment. The shared deployment serves operations; isolated installation serves engagements that need it; both run the same application with client differences in configuration and data.

The namespacing work required for the shared deployment is also what makes the isolated-installation model honest: an export boundary only exists if the data model has a client boundary. Building the shared deployment first therefore strengthens rather than weakens ADR 0007's delivery unit.

## Consequences

- The client record and namespace become first-class platform concepts.
- Every load and save path in the application carries a client context.
- The brand-brain build journey doubles as the client onboarding pass without modification.
- The deliverable chooser is populated from the active client's catalog rather than hardcoded definitions.
- ADR 0007 remains authoritative for isolated installations as a delivery unit; its assumption that isolation is the only initial model and its deferral of tenant switching are superseded.
- ADR 0004's separation of shared platform and private brand data is unchanged and is enforced by the namespace boundary.
- The shared-password access gate is now formally a known deficiency with a planned replacement rather than an accepted state.
