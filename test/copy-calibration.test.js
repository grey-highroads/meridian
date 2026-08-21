import assert from "node:assert/strict";
import test from "node:test";
import { assembleClaimsSet, isDirective } from "../src/claims/assembly.js";
import { checkProseRules, collapseProseFindings } from "../src/copy/prose-check.js";
import { auditProducedCopy } from "../src/copy/generate.js";

// Regression fixtures taken verbatim from the first governed caption produced
// for the beta client on 2026-08-10. See the ADR 0013 amendment.

const betaCaption = [
  "In a world where healthcare communication is often cluttered and confusing, Dialog Health's RCS for Healthcare makes it simple and secure.",
  "This level of trust and clarity helps you make informed decisions without second-guessing.",
  "With a simple tap, you can confirm your appointment, knowing that this interactive message is directly delivered to your phone's native messaging system\u2014no extra apps needed.",
  "This is communication designed for action, helping patients and providers move forward with confidence.",
  "Isn't it time healthcare communication became as straightforward as the care itself?",
].join(" ");

const activeEntries = (doc, section) => (doc?.[section] || []).filter((e) => !e.retired_at);

// -------------------------------------------------------------------------
// Finding one: directive-shaped exclusions are not claims
// -------------------------------------------------------------------------

test("an imperative product exclusion is a directive, not a prohibited claim", () => {
  assert.equal(isDirective("Do not depict an app download as necessary"), true);
  assert.equal(isDirective("Never imply FDA clearance"), true);
  assert.equal(isDirective("Avoid showing clinical settings"), true);
  assert.equal(isDirective("Don't state a specific uptime figure"), true);
});

test("a claim-shaped exclusion stays a prohibited claim", () => {
  assert.equal(isDirective("HIPAA compliant"), false);
  assert.equal(isDirective("the fastest internal messaging platform"), false);
  assert.equal(isDirective("guaranteed 99.99% uptime"), false);
  assert.equal(isDirective("reduces employee turnover"), false);
  assert.equal(isDirective("eliminates email entirely"), false);
});

test("assembly routes the two kinds of exclusion to different lists", () => {
  const set = assembleClaimsSet({
    claimsDocument: null,
    activeEntries,
    jobScope: {},
    product: {
      product_name: "RCS for Healthcare",
      features: [],
      exclusions: [
        "Do not depict an app download as necessary",
        "HIPAA compliant",
      ],
    },
  });
  assert.equal(set.prohibited.length, 1);
  assert.equal(set.prohibited[0].text, "HIPAA compliant");
  assert.equal(set.directives.length, 1);
  assert.equal(set.directives[0].text, "Do not depict an app download as necessary");
});

test("the sentence that was wrongly flagged never reaches the auditor as a claim", () => {
  const set = assembleClaimsSet({
    claimsDocument: null,
    activeEntries,
    jobScope: {},
    product: {
      product_name: "RCS for Healthcare",
      features: [],
      exclusions: ["Do not depict an app download as necessary; the source says messages are delivered through the patient's native messaging system without requiring an app download."],
    },
  });
  // With nothing on the prohibited list, there is no rule for the auditor to
  // match "no extra apps needed" against, which is what produced the false
  // violation in the beta run.
  assert.deepEqual(set.prohibited, []);
  assert.equal(set.directives.length, 1);
});

// -------------------------------------------------------------------------
// Finding two: the prose check is deterministic and has no false positives
// -------------------------------------------------------------------------

test("the prose check catches both real violations in the beta caption", () => {
  const findings = collapseProseFindings(checkProseRules(betaCaption));
  const rules = findings.map((f) => f.rule);
  assert.equal(findings.length, 2);
  assert.equal(rules.some((r) => /em dash/i.test(r)), true);
  assert.equal(rules.some((r) => /straightforward/i.test(r)), true);
  for (const finding of findings) {
    assert.equal(finding.kind, "prose");
    assert.notEqual(finding.sentence, "", "a prose finding must locate the offending text");
  }
});

test("the prose check stays silent on compliant marketing prose", () => {
  const compliant = [
    "We help healthcare teams reach patients where they already are.",
    "Dialog Health connects, automates, and analyzes across the patient journey.",
    "Patients confirm appointments with one tap, and staff see the response immediately.",
    "Our platform is SOC 2 Type II certified and used by over 200 enterprise customers.",
    "It is not complicated to set up. Most teams are live within a week.",
  ];
  for (const sample of compliant) {
    assert.deepEqual(checkProseRules(sample), [], `false positive on: ${sample}`);
  }
});

test("the prose check catches a fragment stack but not two short sentences", () => {
  assert.equal(checkProseRules("Fast. Secure. Simple.").length, 1);
  assert.equal(checkProseRules("It works. Teams like it.").length, 0);
});

test("repeated violations of one rule collapse into a single finding with a count", () => {
  const findings = collapseProseFindings(checkProseRules("It is really good and really fast and really cheap."));
  assert.equal(findings.length, 1);
  assert.match(findings[0].reason, /appears 3 times/);
});

// -------------------------------------------------------------------------
// Prose findings survive every audit state, including a failed claim check
// -------------------------------------------------------------------------

test("prose findings appear even when there are no claims to check", async () => {
  const audit = await auditProducedCopy({
    text: betaCaption,
    claimsSet: { approved: [], prohibited: [], disclosures: [] },
    apiKey: "unused",
  });
  assert.equal(audit.status, "no_claims");
  assert.equal(audit.findings.length, 2);
  assert.equal(audit.findings.every((f) => f.kind === "prose"), true);
});

test("prose findings appear even when the claim check fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
  };
  try {
    const audit = await auditProducedCopy({
      text: betaCaption,
      claimsSet: { approved: [{ text: "Reduces no-shows by 30 percent", source: "Product" }], prohibited: [], disclosures: [] },
      apiKey: "unused",
    });
    assert.equal(audit.status, "errored");
    assert.equal(audit.findings.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// -------------------------------------------------------------------------
// A caption with no claims to check can still fail a check
// -------------------------------------------------------------------------

test("a prose violation is reported even when there are no claims to audit", async () => {
  // The caption produced for Columbia on 2026-08-11 contained an em dash and
  // sat under a neutral "No claims to check" pill, because the pill returned
  // on status before counting findings. The audit itself was correct; the
  // summary was not.
  const audit = await auditProducedCopy({
    text: "This moment captures the essence of adventure\u2014where preparation meets awe.",
    claimsSet: { approved: [], prohibited: [], disclosures: [] },
    apiKey: "unused",
  });
  assert.equal(audit.status, "no_claims");
  assert.equal(audit.findings.length, 1);
  assert.equal(audit.findings[0].kind, "prose");
  assert.match(audit.findings[0].rule, /em dash/i);
});

test("a clean caption with no claims produces no findings at all", async () => {
  const audit = await auditProducedCopy({
    text: "Standing on the summit, every step taken feels worth it.",
    claimsSet: { approved: [], prohibited: [], disclosures: [] },
    apiKey: "unused",
  });
  assert.equal(audit.status, "no_claims");
  assert.deepEqual(audit.findings, []);
});
