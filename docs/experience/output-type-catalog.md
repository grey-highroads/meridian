# Output Type Catalog

> Status: Design-sprint working model. This document records a product finding from the asset-creation wireframes. It is not a normative specification.

## Decision

The production chooser should contain client-configured deliverable presets, not a universal list of marketing intentions.

Each preset connects five layers:

1. A shared **output type** defines the structure of the deliverable.
2. A client **deliverable preset** gives that structure a useful name, defaults, and brand-specific constraints.
3. A job **output specification** resolves the preset for one request.
4. A **generation package** compiles the prompt, generation inputs, exclusions, and execution requirements for inspection or handoff.
5. An **artifact manifest** records what the system actually produced.

This separation allows Higher Roads to reuse most of the product across clients while keeping each client's chooser specific and credible. A B2B client may see Blog hero, LinkedIn ad, Case study, and Deck illustration. A CPG client may see Product lifestyle image, Static ad, Instagram story, and Product on white.

## Why the structure matters

Two deliverables with the same dimensions can require different production behavior. A social image may be an image-only asset, a composed graphic with an editable headline, a template adaptation, or one part of an advertising package. Aspect ratio alone cannot tell the system:

- whether text is present;
- which elements must remain exact;
- whether a background is generated, supplied, or absent;
- whether the result is one file or a coordinated package;
- which variants must be produced;
- which checks can be deterministic;
- which fields belong inside the artwork and which belong to the publishing platform.

The output type supplies that missing contract. The deliverable preset supplies the client-facing language.

## Product layers

### Output type

An output type is a reusable structural archetype. It defines composition, layers, inputs, variants, delivery, and validation. It is shared infrastructure and is usually invisible to producers.

Examples include `scene_image`, `composed_graphic`, `ad_package`, and `paged_document`.

### Deliverable preset

A deliverable preset is configured for one client. It references an output type, applies defaults, selects placement profiles, and uses language that reflects the client's recurring work.

Examples include Product lifestyle image, Blog post hero, LinkedIn single-image ad, and Case study.

### Output specification

An output specification is the resolved contract for one job. It contains the chosen product or subject, placement, format, copy, explicit variants, generation inputs, exactness rules, and other request-specific values. Placement constrains the formats available to the user; they are not unrelated fields.

### Generation inputs

Generation inputs are the assets supplied to generation or deterministic composition. A required source asset is resolved from the selected product, subject, template, or deliverable preset. An optional creative reference is added in the brief or proposed explicitly by the system. Every input records provenance, role, priority, and handling. Creative references also record influence. A reference without a declared purpose does not enter the generation package.

Influence is semantic creative priority, not authority or a mathematical blend coefficient. Governed context, explicit requirements, exclusions, and protected assets are resolved by policy and handling rather than weighted by the user. Confidence describes the system's read of a source and remains independent from influence. See [`production-input-model.md`](production-input-model.md) for the working input and resolution contract.

### Generation package

A generation package is a versioned, portable handoff produced before any renderer is invoked. It contains the named source-linked components used to assemble the prompt, the compiled prompt itself, negative instructions, generation inputs with explicit provenance and roles, the resolved output specification, and links to the governing policy snapshot and source knowledge.

Preflight presents the package as its deliverable. The compiled prompt is read-only in the product; the user may inspect or copy it and may export the complete package. Generate invokes the configured renderer adapter, which translates the package into a provider-specific payload without exposing provider or model selection inside the job.

Prompt components should convert structured brand knowledge into executable direction. Depending on the job, they may cover exact subject handling, world rituals, visual grammar, palette and material behavior, photography or illustration rules, casting, composition, voice and claims, output requirements, and scoped prohibitions. A component is omitted when it is irrelevant to the stage; the complete brand brain is never dumped into the prompt.

### Artifact manifest

The artifact manifest records the delivered result, including generated regions, composed layers, embedded brand elements, lineage, validation findings, and output files.

## Priority deliverables by client pattern

These lists are configuration inputs, not universal navigation.

### B2C and CPG

| Priority | Deliverable family | Common examples | Typical structure |
| --- | --- | --- | --- |
| 1 | Product imagery | Lifestyle image, product showcase, product on white | Scene image or composed image |
| 2 | Paid advertising | Static social ad, display ad, carousel ad | Ad package or card sequence |
| 3 | Organic social | Feed image, story, carousel | Composed graphic or card sequence |
| 4 | Web and ecommerce | Product detail image, category banner, site hero | Scene image or composed graphic |
| 5 | Email | Banner, product module image | Composed graphic or template adaptation |
| 6 | Adaptation | Resize, crop, localization, retailer variation | Template adaptation |
| 7 | Motion | Short social video, product loop | Motion sequence |

### B2B and services

| Priority | Deliverable family | Common examples | Typical structure |
| --- | --- | --- | --- |
| 1 | Paid advertising | LinkedIn ad, display ad, retargeting creative | Ad package |
| 2 | Organic social | Feed image, quote card, announcement graphic | Composed graphic |
| 3 | Editorial content | Blog hero, report cover, article illustration | Scene image or composed graphic |
| 4 | Sales collateral | One-sheet, solution brief, leave-behind | Paged document |
| 5 | Case study | Customer story PDF, summary card | Paged document |
| 6 | Presentations | Deck, slide illustration, cover slide | Slide deck or composed graphic |
| 7 | Web | Feature hero, landing-page section art, card thumbnail | Composed graphic |
| 8 | Events | Booth graphic, session slide, event social asset | Composed graphic or template adaptation |
| 9 | Email | Banner, newsletter module image | Composed graphic |

## Shared output types

### 1. Scene image

A largely photographic or illustrative image. The system may generate the surrounding scene while preserving supplied subjects or products exactly.

Typical examples include product lifestyle images, editorial illustrations, and product showcases.

Important controls include subject source and exactness, scene-generation latitude, composition, crop, negative space, placement variants, and text policy. Text often defaults to none.

### 2. Composed graphic

A visual assembled from a background, assets, and optional text layers.

Typical examples include social feed images, stories, blog heroes, email banners, and quote cards.

Important controls include background source, asset layers, headline and CTA slots, typography, safe areas, layer editability, and placement variants.

### 3. Template adaptation

A known composition with bounded substitutions, resizing, localization, or cropping.

Typical examples include approved-source resizes, retailer variations, localized graphics, and recurring email modules.

Important controls include template version, editable slots, locked regions, substitution rules, overflow, crop behavior, and required variants.

### 4. Card sequence

A related ordered set of cards.

Typical examples include social carousels, multi-panel product stories, and document teaser sequences.

Important controls include card count, cover and closing-card rules, repeated elements, sequence-level narrative, per-card text limits, and cross-card consistency.

### 5. Ad package

A coordinated package of artwork and publishing fields for a placement or placement family.

Typical examples include paid-social single-image ads, responsive display ads, retargeting packages, and carousel ads.

Important controls include placement profile, image and logo assets, on-art headline policy, platform headline, description, CTA, destination fields, aspect-ratio variants, file-size checks, safe areas, and package completeness.

An ad headline may be an editable visual layer, a platform field, or both. The output type must make that distinction explicit.

### 6. Paged document

A multi-page deliverable with repeated structure and content hierarchy.

Typical examples include case studies, one-sheets, solution briefs, and reports.

Important controls include page model, content sections, master template, overflow behavior, charts, image slots, editable source, and export requirements.

### 7. Slide deck

A sequence of slides built from approved layouts and content.

Typical examples include sales decks, presentations, and reusable slide modules.

Important controls include slide masters, slide types, content density, chart and image behavior, editable delivery, speaker notes, and accessibility.

### 8. Motion sequence

A timed sequence of scenes, frames, text, and audio.

Typical examples include short social videos, product loops, and simple animated ads.

This output type should remain outside the first implementation slice until static composition, variants, and manifests are proven.

## Common schema

The following shape is a working design model. Defaults should minimize repetitive data entry.

```yaml
output_type:
  id: composed_graphic
  version: 1

  inputs:
    required:
      - primary_asset
    optional:
      - headline
      - body
      - call_to_action
      - reference_asset

  composition:
    background:
      source: generated | supplied | template | solid | transparent | none
    layers:
      - id: primary_asset
        kind: image | logo | product | text | shape | template_region
        required: true
        source: canonical | approved | supplied | generated | derived
        handling: exact | bounded | flexible
        render_mode: embedded | editable_layer | template_slot | external
        constraints: {}

  variants:
    placement_profiles: []
    quantity: 1
    adaptation_rules: {}

  delivery:
    formats: []
    editable_source: false
    package_contents: []

  validation:
    technical: []
    fidelity: []
    content: []
    placement: []

  approval:
    route: workflow_default
    blocking_findings: []
```

## Defaults and required data

Every output type supports the complete model, but each preset should require only the fields that materially affect the result.

Recommended defaults:

- text policy defaults to `none`;
- background source defaults to `supplied` when a complete source is provided;
- a registered brand asset defaults to `exact` handling;
- output quantity defaults to one primary image per render;
- placement constrains the formats available for selection;
- additional crops or variants exist only when the deliverable preset explicitly promises them;
- delivery defaults to a flattened production file unless the preset promises editability;
- placement validation is required only when a placement profile is selected.

A person configuring or running fifty jobs should be able to supply accurate data without maintaining an ontology by hand.

## Text handling

Text must declare how it reaches the finished deliverable:

- `external`: the publishing platform or CMS renders the text separately;
- `editable_layer`: the delivered file contains an editable text layer;
- `template_slot`: text fills a controlled slot in an approved template;
- `embedded`: text is rendered into final artwork;
- `none`: the output does not contain text.

This distinction is especially important for ads, email, web modules, and social graphics.

## Placement profiles

Platform and channel rules change over time. The system should reference versioned placement profiles rather than hardcode them into a permanent output type.

A placement profile may define dimensions, aspect ratios, file formats, file size, safe areas, copy limits, package fields, destination fields, tracking fields, and accessibility requirements.

## Example client preset

```yaml
deliverable_preset:
  id: slake_static_ad
  label: Static ad
  client: slake
  output_type: ad_package@1

  defaults:
    placement_profiles:
      - meta_feed_static@2026-07
      - instagram_story_static@2026-07
    composition:
      background:
        source: generated
      layers:
        - id: product
          source: approved
          handling: exact
          render_mode: embedded
        - id: logo
          source: canonical
          handling: exact
          render_mode: embedded
        - id: headline
          source: supplied
          handling: bounded
          render_mode: editable_layer

  required_job_inputs:
    - product
    - visual_direction
    - platform_headline
    - destination_url
```

## Wireframe implications

The asset-creation wireframes should demonstrate these product truths:

1. The chooser contains client-configured deliverables with familiar names.
2. Different cards represent different structures, not only different dimensions.
3. The brief changes according to the selected preset, applies brand guidance without asking for confirmation, and treats placement and format as dependent choices.
4. Preflight explains which elements remain exact, which may be generated, and whether text is embedded, editable, or external.
5. Preflight itself exposes the named brand-derived components, read-only compiled prompt, exclusions, and generation inputs with provenance and roles; there is no separate generation-package review screen.
6. The user can copy or export the package without invoking a built-in renderer.
7. Generate uses the renderer configured outside the job; provider, model, credentials, and connection controls do not appear in production.
8. Ads are first-class outputs and include artwork plus publishing fields.
9. Producers do not select an architectural production mode.
10. The current SLAKE flow remains a one-off Product lifestyle image. It does not imply campaign ownership.

## Future contract implications

A later specification revision should decide whether workflow contracts explicitly reference the deliverable preset, output type, resolved output specification, generation package, render invocation, and placement profiles used for validation.

The artifact manifest already has the right responsibility: record generated regions, composed layers, embedded elements, composition lineage, findings, and delivered files.

## Open questions

- Which five to eight presets best represent each pilot client?
- Which output types belong in the first implementation slice?
- Where should the product boundary sit for documents and decks?
- Which outputs must preserve editable layers?
- How are placement profiles sourced, versioned, and retired?
- Which client roles may configure or publish deliverable presets?
