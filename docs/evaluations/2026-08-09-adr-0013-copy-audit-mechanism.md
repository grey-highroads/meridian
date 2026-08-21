# Evaluation: ADR 0013 copy audit mechanism test

- Date: 2026-08-09
- Author: Higher Roads
- Status: Passed. All four criteria met.
- Related: ADR 0013 (govern copy through derived claims and a copy audit)

## What this memo is

ADR 0013's sequencing step 1 gates subsequent work on a mechanism test of the copy audit's prohibited-match path. This memo records the test, its results, and what was explicitly deferred. It mirrors the shape of the ADR 0012 product synthesis evaluation.

The original step 1 defined pass criteria calibrated against Dialog Health copy (false-positive percentage, claim-vs-description boundary tuning). A code review identified this as a platform-mechanism-versus-client-calibration mismatch: tuning the detection boundary against one client's copy risks encoding that distribution into a global rule. The criteria were replaced by a fixture-based mechanism test covering the prohibited-match hard stop and audit-failure semantics. See the ADR 0013 revision note dated 2026-08-09.

## The test

**Fixture.** A synthetic B2B SaaS brand called Helix Relay (internal communications platform for distributed teams). No real company or product. The fixture carries:

- 3 approved claims: a quantified benefit ("reduces average internal response time by 40%"), a regulatory property ("SOC 2 Type II certified"), and a quantified adoption metric ("Used by over 200 enterprise customers").
- 5 prohibited claims spanning four types: an unverified regulatory property ("HIPAA compliant"), a superlative comparative ("the fastest internal messaging platform"), a false capability assertion ("eliminates email entirely"), an uncontracted quantified guarantee ("guaranteed 99.99% uptime"), and an unsubstantiated causal claim ("reduces employee turnover").
- 15 copy samples in three groups of five.

**Method.** Each copy sample was sent individually to the `auditCopyAgainstClaims` function (extracted to `src/claims/copy-audit.js`) with the fixture's approved and prohibited lists. The audit uses gpt-4o at temperature 0. A sixteenth call used an invalid API key to exercise the error path. The test ran server-side through the `run_audit_test` action on the brand-brain handler, triggered from the deployed app.

## Results

### Criterion 1: Verbatim violations flagged as prohibited

All five verbatim violations were correctly flagged. Each sample contained the prohibited claim's exact language (or a trivial syntactic embedding of it) and was classified as prohibited with the correct match reference.

| Sample | Prohibited | Match |
| --- | --- | --- |
| "Helix Relay is HIPAA compliant and ready for healthcare teams." | 1 | P1 |
| "As the fastest internal messaging platform on the market..." | 1 | P2 |
| "Helix Relay eliminates email entirely..." | 1 | P3 |
| "With guaranteed 99.99% uptime..." | 1 | P4 |
| "Helix Relay reduces employee turnover..." | 1 | P5 |

**Result: PASS.**

### Criterion 2: Paraphrase violations flagged as prohibited

All five paraphrase violations were correctly flagged. Each sample conveyed the same meaning as a prohibited claim using different words, and the auditor recognized the semantic match.

| Sample | Prohibited | Match |
| --- | --- | --- |
| "Helix Relay meets HIPAA requirements for protected health information." | 1 | P1 |
| "No other internal messaging tool matches Helix Relay's speed." | 1 | P2 |
| "After adopting Helix Relay, teams no longer need email at all." | 1 | P3 |
| "We guarantee nearly 100% availability for every customer." | 1 | P4 |
| "Companies using Helix Relay see lower staff attrition rates." | 1 | P5 |

**Result: PASS.**

### Criterion 3: Adjacent non-violations not flagged as prohibited

All five adjacent samples passed cleanly. Each sample was topically adjacent to a prohibition (mentioned the same domain, capability, or outcome) without making the prohibited claim. The auditor correctly distinguished proximity from violation.

| Sample | Prohibited |
| --- | --- |
| "Helix Relay takes security seriously and holds SOC 2 Type II certification." | 0 |
| "Internal messaging helps distributed teams stay aligned without waiting for email replies." | 0 |
| "Helix Relay is designed with healthcare teams in mind, though specific compliance certifications vary by deployment." | 0 |
| "Our platform is fast, with most messages delivered in under 200 milliseconds." | 0 |
| "Teams that communicate well tend to retain employees longer. Helix Relay helps teams communicate well." | 0 |

The fifth sample is the most demanding test. The copy mentions employee retention (the prohibited claim is "reduces employee turnover") but attributes the outcome to good communication in general, not to the product. The auditor correctly classified this as adjacent rather than violating.

**Result: PASS.**

### Criterion 4: Error path distinguishable from clean

The audit returned `{ error: "Claim audit call failed with status 401.", sentences: [] }` when called with an invalid API key. This is structurally distinguishable from a clean pass (`{ error: null, sentences: [...] }`). A future UI rendering audit results can detect the error field and display an explicit "audit could not run" state rather than showing silence as clean.

**Result: PASS.**

## What this evaluation does not prove

Named honestly so we do not mistake this for more than it is:

- **False-positive rate on real copy.** The test does not measure how often the auditor flags ordinary descriptive marketing copy as an unapproved claim. This is the original criterion (c), deferred until real client production volume provides a distribution to calibrate against. The safe-harbor design contains the risk at the product level: unapproved findings are advisory ("review recommended"), never blocking.
- **Advisory-findings quality.** The test does not evaluate whether "unapproved claim, review recommended" findings are actionable or noise. This is the original criterion (d), deferred for the same reason.
- **Claim-vs-description boundary stability.** The test does not measure boundary drift across model versions or prompt variations. A single model (gpt-4o) at temperature 0 was used. Boundary stability is a regression concern for future evaluation harnesses, not this mechanism test.
- **Multi-sentence reasoning.** Each test sample was a single sentence or two. Real marketing copy carries multi-sentence arguments where a prohibited claim may be implied across several sentences rather than stated in one. This is a harder detection problem that the fixture does not exercise.
- **Approved-claim matching quality.** The fixture carries approved claims but the mechanism test evaluates only the prohibited path and the error path. Safe-harbor matching quality (does the auditor correctly pass approved claims?) was observed in the earlier Dialog Health prototype run but is not part of this test's formal criteria.

## Unblocks

Per ADR 0013 sequencing:

1. ~~Mechanism test of the copy audit.~~ **Passed.**
2. ~~Brand-level claims document schema and store.~~ **Built** (commit `54ee614`).
3. ~~Assembly function in the compiler.~~ **Built** (commit `54ee614`).
4. ~~Copy audit wired to generate-copy.~~ **Built** (commit `102b13f`, updated `974c93c`).
5. ~~Applicability resolver extended.~~ **Built** (commit `9236bb6`, corrected `720694d`).
6. Copy audit surfaced in preflight and evaluation for image+copy production flows. **Not started.** This is the next step when the beta tester's workflow demands it.

ADR 0013 may move from Proposed to Accepted.
