# Meridian: Roadmap, Phase 2

Date: 2026-09-05
Owner: Grey.
Status: governing. Phase 1 was the fourteen-step loop, proven live. Phase 2 turns a tour app with labels into the client work surface for everything Higher Roads makes. The ruling behind it, recorded 2026-09-05: Meridian is for all Higher Roads deliverables, and the shape is clients who pay, projects they engage Higher Roads for, subjects the client owns, and assets the projects produce.

The sentence this phase proves: a second kind of job runs the whole loop as natively as the first one did.

## Why this order

Each step unblocks real work or closes a recorded risk before the risk can bite. Nothing here is speculative capacity. Steps carry conditions, not dates.

## The steps

### 1. Fix the intake identities bug

What: `src/artist/parse-intake.js` hardcodes three identities from the first artist, including his side project. Any second artist is offered them.

Why: it is a bug, and it sits in the path every future subject's research goes through.

Done when: a second artist's import carries no trace of the first artist.

### 2. Projects without a subject

What: account creation without a first artist. Project creation with no artist attached. The parser stops demanding one. Intelligence degrades by capability per the amended ruling: each instrument states what it needs and runs when it has it; the ones needing subject research say so plainly.

Why: the projection mapping job cannot be entered today. This is the smallest change that unblocks a real, paying job, and it proves the loop stands on project material alone.

Done when: the mapping job is live in Meridian and runs request, concept, brief, and review without a placeholder artist anywhere.

### 3. Small hardening, all cheap, all found by the 2026-09-05 review

What: three bounded fixes. Sessions die when a person is deactivated or resets a password. New facts carry a stable actor id alongside the display name. The approve setting on a client person is built as ruled 2026-09-04: one field, one check in `client-approve`, one Admin control, off by default.

Why: each is small now and expensive later. The approve setting is a recorded ruling the code does not honor, and it must exist before the first real client logs in.

Done when: a deactivated person's open session is refused, new facts carry an actor id, and approval is refused for a client person without the setting.

### 4. The subjects model

What: subject records owned by the client, each with a stable id, a kind, a display label, and its own research. Projects link to zero, one, or many. No lead subject. Research publishes as immutable revisions, and every piece of evidence carries subject id, revision, and finding id so citations from two subjects cannot collide. The existing artist becomes the first subject kind without rewriting its data.

Why: this is the decision recorded in the subjects rulings of 2026-09-05. Research becomes something a client accumulates across projects instead of something welded to one artist.

Done when: one real project holds two subjects and Intelligence answers across both with every claim naming which subject and which revision it came from.

### 5. Research categories for a second kind

What: the mapping job's building gets researched with the intake playbook. Whatever categories that work actually needs become the venue kind's categories. Durable facts carry dates. Where category definitions live, code or storage, is decided here with a real example in hand.

Why: nobody can specify a building's categories in the abstract. The first real one is the specification.

Done when: the building's research is imported, readable on its subject, and used by Intelligence on the mapping job.

### 6. Brief contract, version two

What: the frozen brief gains an explicit contract version and a subjects list, each entry naming its kind and research revision. Additive only. Frozen briefs and copies on the production partner's machine stay exactly as sent. `artistId` remains readable on old briefs forever.

Why: brief field names are permanent once frozen, so the subjects change must land in the contract deliberately, not by drift. This step waits for step 4 and goes in the same commit as the seam document that describes it.

Done when: a new brief from a multi-subject project freezes with the versioned shape and the production partner's receiver accepts it unchanged.

### 7. Notifications, operators first

What: email through a transactional service. Operators only, one event to start: an artboard arriving. A notification is recorded as a fact so it cannot send twice. Client emails are a separate later step with their own rules, because a client email can carry only what the client boundary allows.

Why: ruled in conversation 2026-09-04: email to bring people back to the app. Operators first proves the plumbing with no client risk.

Done when: an artboard arriving sends one email with a link, and sending is on the record.

## Running alongside

**The production seam.** Delivery is built and switched off, waiting on the receiver's URL and secret. The return path, artboards coming back over the wire rather than through upload, gets its contract from Jim discovery, not designed here. Finished-media custody is settled by the same discovery.

**The mapping job as the test.** Every step from 2 onward should be checked against that job before being called done. It is the second kind, and phase 2 exists because of it.

## Gates, not steps

**Storage concurrency.** Recorded in the register 2026-09-05. Writes can drop a record when two people act at once. Must close before a second person routinely works in the app at the same time as the first, and before any real client account is active. The fix is chosen then with real usage in hand.

**Review media beyond still images.** Accepted with the scope ruling. Planned work when the first non-image deliverable reaches review, not before.

## What waits, deliberately

Cross-client subjects, until a real job presents one. Client notification emails, until operator email has behaved. Per-project membership within a client account, until an account has people who should not see everything. Seam hardening beyond what evidence demands: no outbox, no retry queue, no schema validation layers, no delivery contracts for payloads that do not exist yet. A person pressing Send again is the retry until numbers say otherwise.

## Rules that keep this honest

- Anything not needed by a real project in front of us waits. Good ideas are not an exception.
- Every step is checked against the mapping job, not against the artist job it grew up on.
- Contracts change additively. Frozen records are never rewritten.
- Gates close on their conditions, not on enthusiasm.
- Grey reviews the live app. Push first, then he reacts.
