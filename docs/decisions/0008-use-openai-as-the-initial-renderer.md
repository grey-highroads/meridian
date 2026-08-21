# ADR 0008: Use OpenAI as the initial renderer

- Status: Accepted
- Date: 2026-08-03
- Owner: Higher Roads

## Context

Brand World System needs a concrete initial rendering path without making one renderer part of the product model. The generation package established by ADR 0006 is already provider-neutral and portable. The repository also needs an honest owner for the unresolved technical proof around protected-asset composition and drift detection.

An earlier sprint brief assigned that proof to an external collaborator. That assignment was incorrect. Brand World System cannot leave a product or pitch dependency waiting on an outside render system. An external renderer may become useful later, but it is not part of the initial application build.

OpenAI is the intended initial render engine. The Riggg build established a consequential implementation lesson: its carefully tuned style anchor and prompt fragments improved output quality, while routing them through an API path that automatically rewrote the prompt diluted that control. Riggg therefore used the Images API generation endpoint for prompt-only work. A later audit also confirmed that the Images API edits endpoint accepts reference images, making it the correct path for canonical gnome, machine, product, or other supplied visual references.

OpenAI also documents limits in precise composition and recurring-asset consistency. Those limits reinforce the existing policy decision to compose protected assets deterministically instead of asking a generative renderer to recreate them.

## Decision

OpenAI is the only renderer adapter wired for the initial product build.

The implementation keeps three responsibilities separate:

1. The production compiler emits a provider-neutral generation package.
2. The OpenAI renderer adapter sends the compiler's exact prompt to `/v1/images/generations` when there are no reference images and to `/v1/images/edits` when reference images are supplied.
3. Brand World System-owned deterministic tools compose exact protected assets and measure drift before approval.

The installation configuration pins the OpenAI adapter and its runtime model configuration outside the production job. The renderer invocation record captures the adapter, API, model, request identifier, parameter digest, output references, usage, cost, and failure state. Provider credentials remain in the protected installation runtime and never enter a generation package, fixture, prompt, or browser request.

The adapter must not rewrite, summarize, expand, or otherwise reinterpret the compiled prompt. Prompt identity is testable at the adapter boundary. Brand Brain synthesis uses Chat Completions after Brand World System normalizes source material; it is not part of the render path and never receives a compiled production prompt.

The initial build does not include provider fallback, a renderer picker, or a generic adapter marketplace. A failed OpenAI request follows the job's recorded error path and cannot weaken policy or silently switch providers.

The adapter contract remains capability-based so a later client installation can add another renderer without changing the compiler or user workflow. Such an adapter is optional future integration work. No current roadmap item, design screen, technical proof, or commercial claim depends on it.

## Options considered

- Wait for an external render system before proving composition and drift behavior.
- Make the generation package OpenAI-specific.
- Wire several renderers before one production journey is proven.
- Use OpenAI first behind the existing provider-neutral package and adapter boundary.

## Rationale

This choice creates one buildable path while preserving the architecture's replaceable-provider seam. It avoids premature fallback and administration work, keeps routine producers away from provider plumbing, and makes ownership of composition and drift detection explicit.

The OpenAI Images API matches the first single-render workflow and preserves the prompt contract proven in Riggg. The generations endpoint handles clean prompt-only work. The edits endpoint carries reference images without changing the adapter's prompt string. The provider-neutral package remains valuable for inspection and export, and exact asset handling remains a deterministic system responsibility rather than a promise delegated to any generative model.

See the official [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation) for the current API boundary and documented limitations.

## Consequences

- OpenAI adapter implementation and verification belong to Brand World System's roadmap.
- Deterministic protected-asset composition and drift detection are project-owned technical proofs.
- Initial installation profiles configure OpenAI without exposing provider or model selection inside a job.
- Prompt-only rendering uses `/v1/images/generations`; reference-image rendering uses `/v1/images/edits`.
- Adapter tests verify that the compiled prompt string reaches either endpoint unchanged.
- The Responses API is not part of Brand World System's production render architecture.
- The generation package and compiler remain provider-neutral.
- Alternative renderers remain possible, but none is required for the initial build.
- A future decision is required before provider fallback or multiple active adapters become product scope.
