// Deterministic prose check (ADR 0013 amendment, 2026-08-10).
//
// The house prose rules are already in the generation prompt as
// non-negotiable, and the model ignores some of them anyway. The first
// governed caption produced for the beta client contained an em dash and the
// word "straightforward", both of which the prompt explicitly forbids.
//
// These rules are string-matchable, so checking them needs no model and
// carries no false-positive risk. That matters beyond the rules themselves:
// while the claim side is being recalibrated, this is the part of the audit
// that is always right, and a reviewer who sees one reliable section is less
// likely to dismiss the whole findings list out of habit.
//
// Every finding names the exact offending text and quotes enough around it to
// locate the problem without hunting.

const CONTEXT_RADIUS = 40;

function context(text, index, length) {
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = Math.min(text.length, index + length + CONTEXT_RADIUS);
  return `${start > 0 ? "..." : ""}${text.slice(start, end).trim()}${end < text.length ? "..." : ""}`;
}

function sentencesOf(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

// Words cut without replacement by the house ruleset.
const bannedWords = ["really", "genuinely", "honestly", "straightforward"];

// Hedging constructions. "We try to bring" becomes "We bring."
//
// Only unambiguous hedges are listed. "We help you do X" was considered and
// left out: it is ordinary writing rather than a hedge, and a pattern that
// fires on it would cost this check the zero-false-positive property that is
// the reason it exists.
const hedgingPatterns = [
  /\b(try|tries|trying|aim|aims|aiming|seek|seeks|seeking|strive|strives|striving)\s+to\s+\w+/gi,
];

/**
 * Check produced copy against the structural prose rules.
 * Pure and synchronous. Returns findings in the same shape the claim audit
 * uses, so the interface renders both through one path.
 */
export function checkProseRules(copy) {
  const text = String(copy || "");
  const findings = [];

  // Em dashes, anywhere. The rule admits no exceptions.
  for (const match of text.matchAll(/[\u2014\u2013]/g)) {
    findings.push({
      severity: "review",
      kind: "prose",
      rule: "No em dashes. Use commas, periods, or semicolons instead.",
      sentence: context(text, match.index, 1),
      reason: `The character "${match[0]}" appears in the copy.`,
    });
  }

  for (const word of bannedWords) {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    for (const match of text.matchAll(pattern)) {
      findings.push({
        severity: "review",
        kind: "prose",
        rule: `Cut "${word}" without replacing it.`,
        sentence: context(text, match.index, match[0].length),
        reason: `"${match[0]}" is on the cut list.`,
      });
    }
  }

  // "It's not X. It's Y." The first sentence should become a dependent clause.
  for (const match of text.matchAll(/\b(it'?s|this is|that'?s|we'?re|they'?re)\s+not\b[^.!?]*[.!?]\s*(it'?s|this is|that'?s|we'?re|they'?re)\b/gi)) {
    findings.push({
      severity: "review",
      kind: "prose",
      rule: 'No "It is not X. It is Y." constructions. Convert the first sentence to a dependent clause.',
      sentence: context(text, match.index, match[0].length),
      reason: "A negation-first pair appears where one sentence would carry the idea.",
    });
  }

  for (const pattern of hedgingPatterns) {
    for (const match of text.matchAll(pattern)) {
      findings.push({
        severity: "review",
        kind: "prose",
        rule: 'No hedging verbs. "We bring," not "We try to bring."',
        sentence: context(text, match.index, match[0].length),
        reason: `"${match[0].trim()}" hedges. Either the brand does it or it does not.`,
      });
    }
  }

  // Fragment stacks: three or more consecutive short sentences with no verb
  // doing any work. Three is the threshold because two short sentences in a
  // row is ordinary writing.
  const sentences = sentencesOf(text);
  let run = [];
  const flushRun = () => {
    if (run.length >= 3) {
      findings.push({
        severity: "review",
        kind: "prose",
        rule: 'No fragment stacks ("Simple. Effective. Easy."). Convert to a complete sentence.',
        sentence: run.join(" "),
        reason: `${run.length} very short sentences run together where one complete sentence would carry the idea.`,
      });
    }
    run = [];
  };
  for (const sentence of sentences) {
    const words = sentence.replace(/[.!?]$/, "").split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.length <= 3) run.push(sentence);
    else flushRun();
  }
  flushRun();

  return findings;
}

/**
 * Deduplicate identical findings so a word repeated four times produces one
 * line rather than four. The count travels with the finding instead.
 */
export function collapseProseFindings(findings) {
  const byRule = new Map();
  for (const finding of findings) {
    const existing = byRule.get(finding.rule);
    if (existing) {
      existing.occurrences += 1;
      continue;
    }
    byRule.set(finding.rule, { ...finding, occurrences: 1 });
  }
  return [...byRule.values()].map((finding) => ({
    ...finding,
    reason: finding.occurrences > 1
      ? `${finding.reason} It appears ${finding.occurrences} times.`
      : finding.reason,
  }));
}
