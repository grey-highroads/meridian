# Meridian: The Seam with Jim's System

Version: 0.1
Date: 2026-08-20
Audience: Jim, and the agent working in Jim's system. This document is written so that agent can understand what Meridian is, reason about the boundary between the two systems, and help build Jim's side of it.
Status: The contract described here is provisional. It is hardened through the pilot, and Jim's real workflow shapes it. Nothing in this document is an obligation on Jim's side until both sides agree it is.

---

## 1. What Meridian is, in enough depth to work with it

Meridian is the creative intelligence and memory system behind live experiences, built by Higher Roads. It exists because a tour has many people in it, each with a different picture of what is being made, and nobody is sure when something is approved. Meridian is the one reference point they all decide from.

It has three layers.

**Artist layer, permanent.** What the system knows about the artist: synthesized intelligence from the public record, the evidence behind each claim, prohibitions, visual language, stage history, what past tours did and what worked. It outlives every tour. Nothing writes into it without a human ruling.

**Tour layer, one cycle.** The tour's visual direction (often inherited from a creative director the artist hired, stored as given and versioned), the assignments under it, concept development for each assignment, creative briefs, artboards and their versions, every decision with who made it and why, feedback, approvals, and technical details of the venues and screens. This is where the work happens and where the seam lives.

**Organization layer, commercial.** Who is allowed to approve, reject, and comment. Jim's system never needs to know about this layer.

What Meridian sells is confidence: a tour team trusted what they approved, and what they approved is what reached the screen. That promise is kept at the seam. It depends on Jim's side as much as ours.

## 2. The line between the systems

The line is idea versus execution.

**Meridian's side.** The request. Artist and tour context. Concept development informed by the Artist Brain: a one-sentence direction for a song becomes a scene, with the moments from the artist's history it rhymes with, references pulled with their sources, and two or three concept directions with reasoning. A person chooses or shapes one. Jim works in Meridian during this stage; his concept thinking is recorded there alongside everyone else's. Exploratory visuals such as reference boards or scene sketches may live here.

**Jim's side.** Turning the chosen concept into an artboard, and the artboard into finished media. Technical interpretation, composition, compositing, stage and screen visualization, PIP treatment, media-system logic, final production, technical export. Every internal prompt, agent, script, or render tool needed to do those jobs. Meridian never produces the production artifact and never writes prompts; a prompt is execution instructions and that is Jim's craft.

**What Meridian will not ask of Jim's system.** To maintain artist intelligence. To track permissions. To run client review. To hold cross-tour memory. To expose internal prompting. To reshape its workflow around assumptions Meridian made before discovery.

**What Meridian will never do.** Recreate Jim's engine. Rebuild his compositor. Send the whole Artist Brain on every job. Auto-reject work on subjective AI judgment. Let governance become creative direction.

## 3. What crosses the seam

Three things travel, all scoped to one assignment. The artist layer and the organization layer never cross.

**Outbound: the chosen concept and its brief.** One assignment's worth of context, assembled and frozen as a version. It says what was asked, what is required, which concept direction was chosen and why, what to avoid, which references apply, which version of the tour direction it was written against, and which technical profile governs. Required elements and the technical target lead. Latitude and meaning follow. Meridian's working assumption, to be confirmed with Jim, is that concrete facts early matter more to his workflow than abstract description anywhere.

**Inbound: the artboard candidate.** The artifact plus enough metadata for Meridian to review it, show it to a client, version it, and trace it: which job, which brief version, which artboard version, a short summary of the concept as built, technical assumptions made, any technical findings or warnings, unresolved questions, and a status.

**Outbound again: revision.** Feedback against a specific artboard version, stating what to change and what to preserve, with a revision identifier. Jim's side returns a new artboard version against the same job.

**At the end: production intent.** When a client approves, Meridian freezes that artboard version as production intent and carries the job, brief, and artboard identifiers that final production should reference. Whether production reads those identifiers, and how, is one of the discovery questions below.

A provisional shape for these payloads is in section 6. It is a list of fields Meridian expects to need, not a format Jim's system must accept.

## 4. What Meridian needs to learn from Jim's side

Discovery works backward from real finished artboards. Five to ten completed projects across different artists, stages, and technical conditions would be enough. For each, the questions are:

**Inputs.** What did Jim receive, in what format, which parts were explicit, and which arrived by call, text, email, deck, diagram, or verbal direction? Which inputs were technical, which creative, which artist context?

**Human reasoning.** What did Jim infer or already know? Which decisions needed artist familiarity, which needed live-production familiarity, which came from constraints? What did he decide before his system started?

**System reasoning.** What enters the agent, as one brief or staged inputs? What structured data exists? What intermediate artifacts are created, which are reusable, which are ephemeral?

**Artboard generation.** Is it a composite? What software and code produce it? Which pieces are deterministic, which generative, which hand-adjusted? Which layout rules are fixed and which vary? How are PIP and stage geometry represented?

**Technical intelligence.** Where do hardware, software, device, stage, and screen profiles live? How are resolutions and codecs represented? Which validations are deterministic and which are Jim's judgment? Which rules are reusable across clients? Some of this may stay Jim-owned with Meridian holding only a reference; that is fine.

**Output.** What is the artboard format? Can the system produce a machine-readable sidecar, a concept summary, a job identifier, a version, a manifest?

**Revision.** How does feedback arrive today and how is it applied? Is prior state preserved? Can the system accept structured instructions against a specific version and report what changed?

**Final production.** How does an approved artboard become media? What carries forward, what is re-entered, where can drift occur? Which production steps could reference an immutable approved artboard?

## 5. What may need to be hardened on Jim's side

No claim that any of these is missing. They are what reliable integration will likely need, and the pilot will show which ones matter first.

- A stable job identifier that survives from assignment through artboard to final production.
- Version identity on outputs: brief version in, artboard version out, production version at the end.
- Machine-readable input, or a stable intermediary, rather than pasted prose alone.
- A machine-readable return package with the artboard.
- A way to get the artifact to Meridian. API response, shared storage, signed URL, manual upload during the pilot. The simplest reliable method wins.
- A way to accept revision instructions tied to a specific artboard version.
- Safe retry: a repeated request does not create a duplicate or conflicting job.
- Clear failure states rather than local logs.
- Technical findings exported in structured form when the system detects an incompatibility.
- Final production able to identify the exact artboard and technical profile it is producing against.
- Reusable technical configuration distinguishable from one-off project state.

During the pilot, every manual translation between the systems is logged. Those logs are the real specification for the adapter. Nothing is automated until repeated work shows a stable contract.

## 6. Provisional payload shapes

Placeholders for discovery. Field names and structure will change.

**Meridian to Jim: chosen concept and brief**

```json
{
  "jobId": "...",
  "artistId": "...",
  "tourId": "...",
  "directionVersion": 2,
  "briefVersion": 3,
  "assignment": { "title": "...", "objective": "..." },
  "requiredElements": [],
  "technicalTarget": { "profileRef": "..." },
  "chosenConcept": { "summary": "...", "reasoning": "...", "references": [] },
  "avoid": [],
  "artistContext": [],
  "tourContext": [],
  "continuity": [],
  "creativeLatitude": []
}
```

**Jim to Meridian: artboard candidate**

```json
{
  "jobId": "...",
  "briefVersion": 3,
  "artboardVersion": 1,
  "status": "...",
  "artifact": { "type": "artboard", "location": "..." },
  "conceptSummary": "...",
  "technicalAssumptions": [],
  "technicalFindings": [],
  "warnings": [],
  "unresolvedQuestions": []
}
```

**Meridian to Jim: revision**

```json
{
  "jobId": "...",
  "sourceArtboardVersion": 1,
  "revisionId": "...",
  "instructions": [],
  "preserve": []
}
```

**Meridian record at client approval: production intent**

```json
{
  "jobId": "...",
  "briefVersion": 3,
  "artboardVersion": 2,
  "technicalProfileRef": "...",
  "approvedBy": "...",
  "approvedAt": "..."
}
```

## 7. How Meridian will behave at the seam during the pilot

A stand-in adapter, labeled as a stand-in, proves Meridian's side before Jim's side is connected. Its shape is not Jim's obligation. When discovery produces a real contract, the stand-in is replaced and the app is not redesigned.

Anything Meridian asserts about Jim's workflow before reading it or walking through it with him is an assumption and is labeled as one.

## 8. The one thing both sides are protecting

An approved artboard becomes finished media predictably and consistently. Meridian guarantees the approval is real, versioned, and traceable. Jim's side guarantees the media matches what was approved. Neither promise holds without the other.
