# Client Installation Model

> Status: Working delivery model. This document describes the initial commercial deployment unit, not a generalized SaaS control plane.

## Objective

When Higher Roads sells a Brand World build, the team should be able to configure and deploy a useful client application from the shared core without creating a permanent client-specific codebase.

The target split is:

- **shared core:** application shell, contracts, readers, policy compilation, orchestration, renderer adapters, evaluation, and operational tooling;
- **installation configuration:** Brand Brain reference, enabled workflows, deliverable presets, roles, integrations, terminology, and theme; and
- **private installation state:** evidence, assets, jobs, outputs, approvals, memory, logs, and credentials.

## Working installation profile

The complete model may grow, but defaults should keep the profile small and honest.

```yaml
installation:
  id: slake-higher-roads
  client_name: SLAKE
  core_version: 0.1.0

  brand_brains:
    - id: slake
      snapshot_ref: slake/brain/approved-2026-08-02

  experience:
    default_brand: slake
    enabled_workflows:
      - product_lifestyle_image
      - social_feed_graphic
      - static_ad
    deliverable_preset_set: slake-marketing-v1
    theme: slake-editorial-v1
    terminology: {}

  access:
    provider: cloudflare_access
    roles:
      steward: [configure_workflows, govern_brand_brain, approve]
      producer: [create_jobs, generate, revise]
      reviewer: [review, approve]

  integrations:
    renderer_adapter: openai-image-v1
    asset_store: installation-r2
    job_store: installation-d1
    queue: installation-render-queue

  policy:
    retention_profile: standard-client
    export_enabled: true
```

The profile contains references and non-secret configuration. Credentials remain in the installation's protected runtime environment.

`openai-image-v1` is the sole initial renderer adapter. The adapter resolves a pinned OpenAI model and API configuration from the protected runtime. Alternative renderer adapters remain a supported architectural extension, not an initial installation requirement or a dependency for product completion. See [`decisions/0008-use-openai-as-the-initial-renderer.md`](decisions/0008-use-openai-as-the-initial-renderer.md).

## Isolation boundary

Each installation uses separate databases, object storage, queues, caches, credentials, logs, and access configuration. Storage keys may include `installation_id` for lineage, but the primary isolation guarantee is the deployment boundary.

Every durable job, package, artifact manifest, approval, and memory event receives `installation_id` from trusted server context. A browser request cannot claim or change it.

## Initial spin-up sequence

1. Select and pin a shared core version.
2. Provision the installation domain, access gate, storage, database, queue, and secrets.
3. Import or build the initial Brand Brain and approve its production-ready snapshot.
4. Select configured workflows and deliverable presets that match recurring client work.
5. Configure the OpenAI renderer and asset integrations outside job-level production screens.
6. Add the initial users and fixed roles.
7. Run a known control job and verify that policy, package compilation, rendering, evaluation, and export behave as configured.
8. Record the installation profile and release version.

This sequence may start as an internal checklist. Automation should follow only after repeated installations reveal stable steps.

## Upgrade posture

The shared core is versioned independently from installation configuration. An upgrade advances the pinned version, validates configuration compatibility, runs migrations, and repeats the control job. Client-specific fixes should become configuration, adapters, or reusable core changes rather than permanent forks.

## Explicitly deferred

- shared tenant switching;
- portfolio administration;
- self-service provisioning;
- generalized organization and permissions management;
- shared billing and metering; and
- cross-installation analytics over private client data.

See [`decisions/0007-deliver-isolated-client-installations-first.md`](decisions/0007-deliver-isolated-client-installations-first.md) for the decision and tradeoffs.
