# Hybrid Production Flow

## Job to be done

Create a one-off product lifestyle image around an approved product package without changing the package, claim, or logo. The environment, casting, lighting, and narrative moment may be generated within approved world guidance. This deliverable does not include a text layer.

## Flow

1. The producer selects the client's configured Product lifestyle image preset.
2. The preset resolves a scene-image output type, required brief fields, placement defaults, and production-stage policies. The user is not asked to select a mode or confirm that brand guidance applies.
3. The producer chooses the approved product, describes the desired scene, selects a placement and one of its allowed formats, and may add creative references. Every creative reference requires a role and influence level.
4. Compilation applies approved brand rules. Inapplicable references are excluded automatically; incomplete or contradictory binding knowledge blocks the job or routes to brand governance before production.
5. Preflight confirms that locked assets can be placed deterministically and presents the compiled generation package: named brand-derived prompt components, a read-only operational prompt, negative instructions, resolved output requirements, and generation inputs with source and role.
6. The producer reviews the package and may copy the prompt or export the package. Prompt editing is not part of the in-app workflow.
7. The producer selects Generate or completes the workflow with an exported package. Generate uses the renderer and model configured outside the job; no provider selector appears in production.
8. When generation is requested, the adapter submits the provider-specific payload. The system generates the flexible context, then composes the locked assets into it.
9. Evaluation checks locked-element drift and unrequested changes before subjective quality.
10. The producer requests a targeted revision or sends the output to the workflow approver.
11. Approval records the output and artifact manifest for use. Corrections can become candidate rules; neither action changes canon automatically.

## Control comparison

Run a closely related stage request through a constrained preset with the same brand brain and approved assets. This is an internal policy-control test. It should show fewer flexible decisions, narrower tools, and a fidelity-first evaluation order without requiring a user-facing mode switch or duplicate canon.

## Questions the mockup must answer

- Can a producer tell what the system will reproduce exactly before running the job?
- Does the preset ask only for inputs that materially affect a product lifestyle image?
- Is it clear that this output contains no headline or other text layer?
- Do placement and format behave as connected output-schema choices?
- Does one render default to one image, with variants appearing only when the preset explicitly requires them?
- Can the producer inspect and reuse the compiled prompt and generation inputs before rendering?
- Does the prompt contain concrete brand-derived direction that would materially distinguish the output from a generic brief?
- Can the producer see which brand-brain components contributed to the prompt?
- Is the compiled prompt clearly a system-produced, read-only artifact rather than a form field?
- Does every generation input reveal where it came from and what it will influence?
- Can the producer export the generation package without using the configured renderer?
- Does Generate use the configured backend without making provider infrastructure part of the job?
- Does the workflow make the correct creative-control decisions without asking the producer to understand policy presets?
- Are scoped prohibitions compiled automatically unless the producer has a legitimate job decision to make?
- Are brand-brain conflicts filtered or routed to governance instead of presented as production fixes?
- Can reviewers distinguish a model-generated context from a deterministically composed asset?
- Are approval, guidance approval, and canonical promotion impossible to confuse?
- Can a correction improve later work without appearing to rewrite the brand?
