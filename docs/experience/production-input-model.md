# Production Input Model

> Status: Working interaction and contract model derived from the production design sprint and the PWP reference implementation.

## Product principle

Users may control the supplemental inputs that shape a production job. They may not use influence controls to weaken canon, policy, explicit requirements, exclusions, or protected-asset fidelity.

An input is not an attachment. It has a source, authority class, intended production role, handling, provenance, and a visible resolution into or out of the generation package.

## Input classes

| Input class | Typical source | User control | Production behavior |
| --- | --- | --- | --- |
| Governed context | Brand Brain entity or rule | Automatically selected and inspectable | Applied by authority and scope; never weighted |
| Protected subject | Approved product, logo, person, artwork, or template | User selects an eligible asset | Exact or bounded handling; never weighted |
| Job direction | Brief, explicit requirement, explicit exclusion | User authored | Binding within policy and actor authority |
| Creative reference | Image, grid, webpage, named reference, or positive precedent | User adds, removes, and directs | Flexible evidence with semantic influence |
| Negative reference | Off-brand example or differentiate-away precedent | User adds with explicit intent | Contributes scoped exclusions; never silently inferred from an image |
| System recommendation | Relevant approved reference proposed from the Brand Brain | User accepts or removes | Becomes a creative reference with a visible reason |

## Influence is not authority

Creative influence uses semantic levels:

- **Lead:** stay close to the supported characteristics of this source;
- **Strong:** carry its intended contribution clearly;
- **Supporting:** use selected characteristics without letting it control the direction; and
- **Light:** use as calibration or a tie-breaker.

These levels express relative creative priority and acceptable deviation. They are not mathematical blend percentages.

Confidence remains orthogonal. A lead reference may have an uncertain system read; the package must preserve both facts rather than allowing influence to overwrite confidence.

## Working input record

```yaml
production_input:
  id: reference_03
  source_type: image
  source_ref: asset_172
  source_label: Afternoon reset
  provenance:
    origin: approved_library
    reference: slake/library/asset_172

  authority_class: creative_evidence
  role: lighting_and_mood
  handling: flexible
  influence: strong
  usage_instruction: Use the warm side light and material contrast; ignore subject matter.

  reader:
    id: image_reference_reader
    version: 1
  confidence:
    level: high
    rationale: Light direction and material response are clearly observable.
  extracted_evidence:
    - low window light from camera left
    - muted terracotta against pale stone

  resolution:
    status: included
    reason: Relevant to the requested scene and compatible with applicable brand policy.
    component_ref: prompt_component/lighting_and_composition
```

System-known fields, reader metadata, provenance, and extracted evidence are populated automatically. The producer ordinarily chooses only the source, role, usage instruction, and influence.

## Resolution order

Input resolution follows production-policy precedence:

1. system safety and integrity invariants;
2. canonical and approved scoped rules;
3. authorized job requirements and exclusions;
4. exact or bounded handling for protected subjects;
5. creative references ordered by their semantic influence and usage instructions; and
6. workflow and provider defaults.

A creative reference cannot introduce a claim, relax an exactness rule, or create an exception. When sources conflict, the system resolves them through authority first and influence only among compatible creative evidence.

The executable compiler makes compatibility a two-sided declaration. A configured deliverable preset states which flexible components accept each source type and role. Reader evidence states which components its observations can support. Influence is applied only after both declarations agree. A mismatch produces an excluded receipt entry with a reason; the compiler does not use model judgment to force a source into the package.

## Reader boundary

Readers convert sources into compact evidence. They do not decide how authoritative the source is and do not create binding constraints from visible content alone.

- A written brief may yield requirements and exclusions only when the user stated them explicitly.
- An image, grid, webpage, or named cultural reference yields flexible evidence and reader confidence.
- A user-authored usage instruction may narrow what the reader should prioritize.
- A protected asset enters through an explicit protected-subject path, not through an inspiration weight.

## Preflight receipt

Preflight presents the generation package and a concise resolution receipt. For each supplemental input it shows:

- where it came from;
- what the user asked it to influence;
- its semantic influence;
- the evidence used;
- whether it was included or excluded; and
- which compiled component it affected or why it could not be used.

This receipt makes the system's reasoning inspectable without asking a producer to operate the underlying ontology or edit the compiled prompt.

## PWP adoption boundary

PWP's typed readers, source-specific usage instructions, semantic influence, confidence, provenance, and traceable conflict resolution should carry forward.

Its full per-job world ideation, comparative selection, visual-grammar selection, and scene-authoring chain should remain available only to workflows that genuinely create a new direction. Routine production should retrieve governed Brand Brain material rather than reconstructing the world for every asset.
