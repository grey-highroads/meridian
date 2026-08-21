# ADR 0009: Update Brand Brain from an approved baseline

- Status: Accepted
- Date: 2026-08-03
- Owner: Brand World System

## Context

The initial Brand Brain is intentionally a broad bootstrap. After it is reviewed and approved, users will continue to add assets, research, business context, and creative references. Rebuilding the Brand Brain from every accumulated source would be expensive, would reopen settled questions, and could introduce wording drift in guidance untouched by the new material. Silently writing new evidence into the active version would be worse because production could change without review.

Source intake also needs a safer contract. Asking users to choose an abstract authority label after uploading a folder or mixed batch encourages accidental misclassification. A pitch deck, protected logo, past campaign, and cultural reference should not inherit one shared instruction merely because they arrived together.

## Decision

Routine intake accepts one file, URL, or written source per record. The user declares a concrete material type first, then supplies the guidance area, a required usage instruction, optional exclusions, and influence only where interpretation is appropriate. The interface uses plain categories such as Protected brand asset, Approved brand guidance, Past brand work or research, Single creative image, Image grid or moodboard, Named cultural reference, and Other business document.

The material declaration is verified against the source. It does not grant authority by itself. Incompatible file formats are rejected before synthesis; content that does not match its declaration creates a review question and keeps the safer interpretation.

Once an approved Brand Brain exists, additions follow an incremental update path:

1. The approved result and version remain the active production baseline.
2. Only new source records are normalized and sent as update evidence.
3. Synthesis receives the stored approved baseline and must copy unaffected fields exactly.
4. Earlier resolved review questions stay closed. Only new unresolved questions are returned.
5. The complete candidate is compared with the baseline so affected guidance is visible.
6. Production continues using the approved baseline until the candidate is reviewed and approved as the next version.

A new source may affect many or all sections when the evidence genuinely requires it. That outcome is still a reviewed candidate, not a reset. Full re-bootstrap is an explicit recovery operation and is not the default addition path.

## Consequences

- Users can add material without taking the approved Brand Brain offline.
- Stable guidance avoids unnecessary rewriting and prompt drift.
- Compute and review focus on additions and their actual consequences.
- Existing approved sources cannot be silently removed through routine addition controls.
- Source retirement, full version browsing, rollback, and supersession remain later hardening work.
- The local prototype enforces a 20 MB limit per file and 40 MB of uploaded files per synthesis request. Production storage and ingestion may use different operational limits while preserving the same one-source contract.
