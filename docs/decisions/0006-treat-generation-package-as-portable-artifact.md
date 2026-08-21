# ADR 0006: Treat the generation package as a portable artifact

> Implementation clarification: [`0008-use-openai-as-the-initial-renderer.md`](0008-use-openai-as-the-initial-renderer.md) selects OpenAI as the sole initial renderer while preserving this adapter boundary.

- Status: Accepted
- Date: 2026-08-02
- Owner: Higher Roads

## Context

The production workflow compiles brand knowledge, job inputs, output requirements, and policy into instructions for a generative system. If those instructions remain hidden, users may try to write prompt-like language into brief fields without knowing what the system will actually submit. Hidden compilation also binds the product too closely to its built-in renderer and makes failures difficult to inspect.

Riggg demonstrates a more useful boundary. A user can review the prompt and generation inputs before generation. The compiled material remains valuable even when the user chooses to render somewhere else.

## Decision

Preflight produces and presents a versioned **generation package** before invoking a renderer. The package is the deliverable of preflight, not a gate leading to a second review interface.

The package contains:

- the compiled prompt;
- negative instructions and exclusions;
- generation inputs with their source, role, priority, and handling;
- the resolved output specification;
- a reference to the policy snapshot that governed compilation;
- provider-neutral generation settings where practical; and
- provenance linking each instruction to the brief, brand brain, workflow configuration, or policy.

The prompt is assembled from named, source-linked components rather than produced as a generic paraphrase of the brief. Compilation resolves the task-relevant parts of the brand brain into operational modules such as subject fidelity, world and ritual, visual grammar, materials and lighting, voice and claims, composition, output requirements, and prohibitions. Each module contributes concrete instructions that can meaningfully change the output. Preflight shows both the readable final prompt and the components that produced it.

The compiled prompt is read-only inside Brand World System. The user can inspect or copy it and can export the package without running generation through the system. Copying or exporting preserves portability without positioning manual prompt editing as part of the product workflow. If a user changes the prompt elsewhere, Brand World System can no longer attest that the result reflects the compiled package.

Generation inputs are not an undifferentiated reference bucket. A required source asset enters through the selected subject, product, or preset. An optional creative reference enters through the brief or an explicit system recommendation. Every input records its provenance and production role, such as exact subject, composition, lighting, mood, or style. Creative references also record influence and may not relax exactness rules or introduce unapproved claims.

Rendering is a separate, optional capability behind an adapter. An administrator configures the renderer, model, credentials, and connection for a workflow. The initial build uses OpenAI; later client installations may add another adapter without changing the package or routine workflow. The production interface exposes a single **Generate** action that uses the configured backend. Routine producers do not choose or inspect provider plumbing inside a job.

Compilation applies approved brand rules before the package reaches production. Inapplicable evidence and references that would introduce unapproved claims are excluded automatically. If binding brand knowledge is incomplete or genuinely contradictory, the system blocks compilation or routes the issue to brand governance. Production may ask for a decision about the current job; it must not ask a producer to repair the brand brain.

The system snapshots the exact package and adapter payload used for every render invocation.

## Options considered

- Keep prompts and references as hidden execution details.
- Show only a prompt preview while keeping rendering inseparable from the product.
- Produce an inspectable, portable generation package before an optional render step.

## Rationale

The portable package gives users a concrete checkpoint between intent and generation. It discourages prompt engineering in unrelated brief fields, makes brand reasoning inspectable, supports debugging, and prevents renderer lock-in. It also creates a stable integration boundary while models and media systems continue to change.

The prompt remains a derived execution artifact rather than a source of truth. Brand knowledge, policy, and the resolved output specification continue to govern compilation. Its value comes from converting those sources into specific, provider-usable direction—not from adding a generic “on brand” instruction.

## Consequences

- Preflight becomes the generation-package review interface and ends with a Generate action.
- Generation inputs require explicit provenance and roles such as exact subject, style, composition, or lighting.
- Prompt components retain their source entity or rule references and remain inspectable in the generation package.
- The compiled prompt is read-only in the product; copy and export remain available for external use.
- Users can export a package and complete rendering outside the system.
- Renderer, model, credential, and connection configuration belongs outside the production job in workflow administration or user settings.
- Brand-knowledge conflicts are filtered or routed upstream rather than presented as production decisions.
- A later workflow-contract revision should define generation-package and render-invocation schemas.
- Provider credentials and sensitive payload fields remain subject to tenant security and retention policy.
