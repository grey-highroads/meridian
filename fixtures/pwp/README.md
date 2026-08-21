# PWP Fixture

> Status: Journey definition with an initial executable-shape SLAKE intake fixture. Broader synthetic evidence and contracts remain to be added.

The sanitized [`slake-foundational-library.json`](slake-foundational-library.json) fixture supplies the first governance pressure-test batch: 50 assets, 47 clean items, one contradiction, one suspected duplicate, one suspected-canon proposal, an inferred ritual entity proposal, and separate contextual-approval and canon-promotion events. The compiler test suite checks its counts and governance separation. It is intentionally not yet a public schema contract.

## Product purpose

Test whether the system can help a strategist turn incomplete, contradictory brand material into useful governed knowledge and then use that knowledge in an exploratory campaign-development workflow.

This is a product-journey proof first and a schema fixture second.

## User and context

The primary user is a Higher Roads strategist onboarding a growing consumer brand. The client has a website, a strategy deck, campaign examples, product information, and stakeholder notes but no complete operational brand model.

The strategist needs to understand what the evidence supports, record honest local resolutions, and produce an approved foundation for later work without presenting inference as fact.

## Desired outcome

- A governed initial brand brain with traceable evidence.
- Approved contextual guidance for audiences, rituals, environments, voice, and narrative territory.
- Visible unresolved questions rather than false certainty.
- A campaign-territory workflow that uses the approved guidance.
- No accidental promotion of inferred material into canon.

## Journey

1. **Begin onboarding.** The strategist selects the brand-onboarding workflow and identifies available sources.
2. **Import evidence.** The system captures batch provenance, rights, file metadata, and extraction results automatically.
3. **Review exceptions.** The strategist sees contradictions, weak evidence, suspected duplicates, and high-impact inferences—not every extracted field.
4. **Record a local resolution.** For contradictions and suspected duplicates, the user can keep either item, keep both, or leave the affected guidance unresolved.
5. **Approve useful guidance.** The user approves selected contextual guidance and separately promotes identity-defining material when appropriate.
6. **Develop campaign territories.** An editorially configured stage synthesizes several directions from the governed brain.
7. **Select and record.** The team chooses a direction, records why, and saves useful precedents without changing canon automatically.

## User decisions

- Should either contradictory source govern, should both remain valid, or should the affected guidance remain unresolved?
- Should either suspected duplicate remain, should both remain distinct, or should both stay unresolved?
- Is an inference useful enough to approve as contextual guidance?
- Does any approved material deserve canonical promotion?
- Which campaign territory is worth advancing and why?

The user should not manually assign every domain, provenance field, confidence field, or policy preset. The system derives and proposes those values, surfacing only exceptions and consequential decisions.

## Automatic workflow decisions

- system-known metadata and batch provenance;
- candidate entity types and domains;
- duplicate and contradiction detection;
- confidence requirements for inferred assertions;
- editorial preset for campaign-territory development;
- appropriate evaluator.

## Failure and recovery path

The fixture must include contradictory audience descriptions and a repeated visual pattern with no authoritative guideline. The system shows supporting evidence and supports a complete local choice without requiring escalation. It must not convert repetition into canon.

The bootstrap does not model users, roles, permissions, notifications, assignment, email, or third-party review routing. Those concerns may be designed later if a real installation requires them.

## Required fixture artifacts

- synthetic evidence manifest;
- entity proposal batch;
- contradiction and exception set;
- contextual approval and canonical-promotion governance events;
- campaign-development workflow and stage definitions;
- production request, context manifest, and editorial stage policy snapshot;
- generated territory artifacts, evaluations, approval, and memory proposal;
- invalid and ambiguous schema cases with expected handling.

No real client-confidential material may be committed. Inputs and expected outputs must be synthetic or sanitized.
