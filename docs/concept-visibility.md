# Concept Visibility Map

> Status: Working audit. This map prevents implementation concepts from appearing in the product without a user job and decision.

| Concept | Current class and exposure | User job or decision | Product treatment |
| --- | --- | --- | --- |
| Brand workspace | User-facing | Understand what work exists and what needs attention | Organize around active workflows, exceptions, and recent decisions; avoid abstract dashboards |
| Brand brain | User-facing summary + internal mechanism | Trust that the system understands and preserves the brand | Show relevant knowledge in context; expose the full model mainly in governance and investigation views |
| Product record | User-facing | Trust that product-specific claims, exclusions, and visual direction are governed and traceable to source | Present as a reviewable candidate on the Products screen with approved claim language, features, proof points, and review questions; approval flips status; production consumes only approved records |
| World-building workflow | Workflow configuration | Turn scattered evidence into usable brand knowledge | Present as concrete onboarding, import, review, and gap-resolution tasks rather than “world-building” machinery |
| Production workflow | User-facing | Complete a named deliverable or campaign task | Users choose a useful workflow and provide a brief, not assemble system stages manually |
| Deliverable preset | User-facing, client-configured | Start a recurring kind of production job | Populate the chooser with familiar client-specific outputs; avoid universal intent categories |
| Output type and composition schema | Workflow configuration + internal mechanism | Understand required inputs and promised delivery when relevant | Resolve a preset into layers, text handling, variants, delivery, and validation; expose consequences in job language |
| Five content domains | Internal mechanism | None during ordinary production | Use for storage, retrieval, validation, and specialist governance; do not require routine manual classification |
| Canon | User-facing in governance contexts | Decide what is identity-defining and change-controlled | Surface when approving or changing binding brand knowledge; summarize implications in plain language |
| Lifecycle | Internal mechanism with contextual status | Know whether something may be used or needs review | Show actionable states such as “Needs approval” or “Replaced”; preserve native enums internally |
| Provenance | Internal mechanism with on-demand detail | Verify why the system believes or used something | Make traceability available from evidence and decision details, not as permanent page furniture |
| Epistemic confidence | Internal mechanism with exception visibility | Decide whether uncertain inferred guidance is trustworthy | Show rationale and evidence when confidence affects review; avoid universal scores and decorative badges |
| Production effects | Workflow configuration + internal mechanism | Understand a blocking requirement or exception | Compile required, permitted, conditional, and prohibited behavior; show plain-language consequences when relevant |
| Locked, bounded, flexible, excluded handling | Workflow configuration | Confirm unusual handling or resolve an exception | Workflows assign defaults; users see exactness promises and exceptions, not a taxonomy editor |
| Constrained, hybrid, editorial presets | Workflow configuration + internal mechanism | Usually none | Apply per workflow stage; do not present as a universal brand setting or routine job-level selector |
| Policy snapshot | Internal mechanism with user-facing summary | Understand what will remain exact or why work is blocked | Preserve the full snapshot for audit; show a concise preflight summary and exceptions |
| Generation package | User-facing preflight + durable execution artifact | Verify what will be sent or reuse it elsewhere | Show the read-only prompt, its named brand-derived components, generation inputs, exclusions, and output requirements before rendering; keep source-level provenance and the original compiled version |
| Provider and model selection | Administrator configuration + internal mechanism | None during an ordinary production job | Configure the initial OpenAI adapter, model, credentials, and connection outside the job; the Generate action uses that backend without exposing provider plumbing or a renderer picker |
| Asset registry | Internal mechanism with user-facing library access | Find and use the correct approved material | Integrate with existing systems; avoid recreating a full DAM or requiring duplicate asset administration |
| Evaluation pipeline | Internal mechanism with user-facing findings | Know what failed and what to fix | Present evidence-backed findings and affected elements, not evaluator architecture |
| Approval | User-facing | Authorize an output or brand decision within scope | Use specific actions for output approval, guidance approval, and canonical change |
| Candidate rule | Workflow configuration + governance queue | Decide whether repeated feedback should affect future work | Show only evidence-backed proposals to the appropriate owner; prove that review volume remains manageable |
| Memory | Internal mechanism with user-facing history | Recover context, understand prior decisions, or reuse a precedent | Present job history, corrections, and precedents; avoid a vague standalone “AI memory” feature |
| Brand-health score | Unproven | No validated decision yet | Do not implement or display until measurable inputs and a useful resulting action are established |
| General-purpose mode switch | Unproven and currently rejected | No validated recurring user decision | Reconsider only if workflow research shows users need to change a stage's policy directly |

## Current product correction

An early production mockup exposed constrained, hybrid, and editorial as a prominent selector. The controls made the architecture visible but did not help a producer understand the job. A real workflow may move from editorial concept development to hybrid hero production to constrained adaptations.

The accepted correction is to treat these modes as reusable policy presets applied to workflow stages. Ordinary users select a workflow and make job-relevant decisions. Higher Roads or an authorized administrator configures stage behavior. Advanced exceptions are exposed only when the user understands their consequence and has authority to make them.

The asset-creation wireframes exposed a second correction. A chooser organized around campaign intent asks the product to understand strategy that Higher Roads may not own. The accepted direction is a client-configured catalog of recurring deliverables. Each visible preset references an internal output type that defines layers, text handling, variants, delivery, and validation. Ads are a first-class structure because they may combine artwork, platform copy, destination fields, and placement variants. See [`experience/output-type-catalog.md`](experience/output-type-catalog.md).

Riggg exposed a third correction. Prompt compilation and rendering are distinct system responsibilities, but they do not require separate review screens. Preflight produces and presents a portable generation package containing the read-only compiled prompt, exclusions, and generation inputs. Users may copy or export it. Generate uses OpenAI in the initial build through configuration outside the production job; provider and model plumbing stays out of the routine workflow. The package remains portable so a later installation can add another adapter without redesigning production. See [`decisions/0006-treat-generation-package-as-portable-artifact.md`](decisions/0006-treat-generation-package-as-portable-artifact.md) and [`decisions/0008-use-openai-as-the-initial-renderer.md`](decisions/0008-use-openai-as-the-initial-renderer.md).

The prompt itself must make the compilation value legible. It should name the task-relevant components drawn from the brand brain and translate them into operational instructions for fidelity, world logic, visual grammar, materials, lighting, composition, claims, and exclusions. A generic prompt followed by “derived from brand rules” does not prove that the brand brain materially affects production.

The same interface review exposed a fourth correction. Production must not become an accidental brand-governance surface. Compilation filters evidence that is inapplicable under approved rules, including references that would introduce unapproved claims. Incomplete or contradictory binding knowledge is blocked or routed to brand governance upstream. The producer sees an exception only when there is a legitimate, authorized decision about the current job.

The brief review exposed a fifth correction. Ambient product promises should not appear as form fields: brand guidance is always applied. A render produces one primary image by default, while an explicit deliverable preset defines any promised adaptations or variants. Placement constrains the available formats through the output schema. Required source assets enter from the selected product or preset; optional creative references are added deliberately and always show provenance, role, and influence.

The Brand Brain review exposed a sixth correction. Architecture vocabulary must not leak into marketer-facing copy. The interface starts with the decision, evidence, and consequence using terms such as “brand rule,” “where this applies,” and “core brand guidance.” Schema terms such as scoped prohibition, epistemic origin, lifecycle, production effect, and governance event remain available in contracts and specialist documentation instead of becoming routine labels.

The evaluation and feedback sprint exposed a seventh correction. Production feedback must not auto-write to the Brand Brain. A user evaluating a generated result may dislike it for subjective, emotional, or unrealistic reasons. If that feedback writes directly to the brain, the brain drifts from governed brand intelligence toward uncurated reactions. The accepted direction routes all broader-than-this-output feedback through a candidate rule queue. A qualified reviewer must promote, modify, or dismiss each proposal before it affects anything. See [`decisions/0010-route-production-feedback-through-candidate-rules.md`](decisions/0010-route-production-feedback-through-candidate-rules.md).

The same sprint exposed an eighth correction. The result screen must show element-level evaluation findings, not a generic quality checklist. Each finding names a specific element (locked-asset fidelity, composition for the requested format, accidental text, brand-world specificity), states what the system did, and offers a targeted repair action when applicable. Repair actions route back to preflight with specific direction rather than presenting a generic "try again." This is not yet automated element-level repair (regenerating just the background while keeping the product), but it directs the user to the right fix.

The preflight review exposed a ninth correction. Job-specific treatments (locked, suggested, not needed, needs input) classify every brand element for the current job and show a plain-language summary of what the system will do. In the sprint prototype these are display-only. The formal compiler handles authoritative resolution. The preflight surface is collapsible so the production contract and ready state stay prominent while the treatment detail is available on demand.

The Dialog Health sales enablement test exposed a tenth correction. The brain models the audience, world, and rules of a brand in depth but modeled products in a single string. Product-specific outputs drew on brand-level guidance and model invention rather than governed product knowledge. The accepted direction models products as governed records stored alongside the brain rather than as fields inside the brain document. Each record synthesizes from its own product brief with the same evidence discipline, versions independently, and requires approval before production can consume it. Production jobs that name a product resolve the record and inject its approved claim language, exclusions, and visual direction into the compiled prompt. See [`decisions/0012-model-products-as-governed-records.md`](decisions/0012-model-products-as-governed-records.md).

## Audit questions still open

- Does “brand brain” help client users, or should most surfaces use more concrete language?
- Can approval and canonical promotion remain distinct without creating governance friction?
- How much evidence and provenance detail do reviewers actually need by default?
- Will candidate rules create a useful learning loop or an ignored review backlog?
- Which brand-brain views help complete work rather than merely display structured data?
- How should asset access feel when the client already uses a DAM?
- Which output structures belong in the first implementation slice, and which remain future client extensions?
