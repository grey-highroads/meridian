// Copy audit (ADR 0013).
//
// Extracted from generate-copy.js so the mechanism test can call it
// independently. The audit function detects claim-like sentences in
// marketing copy and classifies each against approved and prohibited
// claims lists.
//
// Safe-harbor semantics:
//   approved  -> passes cleanly
//   prohibited -> violation, hard stop
//   unapproved -> advisory, review recommended
//   description -> no finding

/**
 * Run the claim audit against a piece of copy.
 *
 * @param {object} options
 * @param {string} options.copy - The copy to audit.
 * @param {Array} options.approvedClaims - Assembled approved claims.
 * @param {Array} options.prohibitedClaims - Assembled prohibited claims.
 * @param {string} options.apiKey - OpenAI API key.
 * @param {string} [options.model="gpt-4o"] - Model to use for detection.
 * @returns {Promise<object>} Audit result with sentences, findings, and counts.
 */
export async function auditCopyAgainstClaims({ copy, approvedClaims, prohibitedClaims, apiKey, model }) {
  const approvedList = approvedClaims.map((c, i) => `  A${i + 1}. "${c.text}" (${c.source})`).join("\n");
  const prohibitedList = prohibitedClaims.map((c, i) => `  P${i + 1}. "${c.text}"`).join("\n");

  const auditSystemPrompt = [
    `You are a copy compliance auditor for a regulated brand. Your job is to identify claim-like sentences in marketing copy and classify each against approved and prohibited claims lists.`,
    ``,
    `DEFINITIONS:`,
    `The test for a claim is falsifiability. A "claim" is a sentence asserting something specific enough that a reader could check it and find it false. Statistics, regulatory or certification properties, comparative or superlative statements, guarantees, and specific capability assertions are claims. Examples: "Our messages achieve 3x engagement," "FDA-cleared device," "The only platform with read receipts," "Cuts response time by 40 percent."`,
    `A "description" is a sentence that describes what something is, how it works, sets context, or expresses a general benefit in terms nobody could check. Marketing language asserting ease, trust, clarity, confidence, simplicity, efficiency, or peace of mind is description, not a claim, because there is no fact of the matter to verify. Examples: "Healthcare organizations send thousands of messages daily," "The platform launched in 2019," "This is communication designed for action," "Experience the ease and efficiency of our platform," "Helps you move forward with confidence."`,
    `Apply the test to the specific assertion, not the topic. A sentence about security is only a claim if it asserts a checkable security property. "We take security seriously" is description; "SOC 2 Type II certified" is a claim.`,
    `A sentence that states compliance with a restriction is not a violation of that restriction. Copy that says an app is not required does not violate a rule against depicting an app as required.`,
    ``,
    `APPROVED CLAIMS (safe harbor, these pass cleanly):`,
    approvedList || "  (none)",
    ``,
    `PROHIBITED CLAIMS AND EXCLUSIONS (hard stop, these are violations):`,
    prohibitedList || "  (none)",
    ``,
    `CLASSIFICATION RULES:`,
    `- If a sentence is a description, classify it as "description". No finding.`,
    `- If a sentence makes a claim that closely matches an approved claim (same meaning, even if reworded), classify it as "approved". Note which approved claim it matches (e.g., A1).`,
    `- If a sentence makes a claim that matches or violates a prohibited claim or exclusion, classify it as "prohibited". Note which prohibition it matches (e.g., P1).`,
    `- If a sentence makes a claim that matches neither list, classify it as "unapproved". This is advisory, not a violation. Before using this classification, confirm the sentence passes the falsifiability test. General benefit language is "description" and produces no finding. When in doubt between "description" and "unapproved", choose "description": an advisory list padded with unfalsifiable marketing language trains reviewers to ignore findings, which is worse than no audit.`,
    ``,
    `Return ONLY a JSON array. Each element: {"sentence": "...", "classification": "description|approved|unapproved|prohibited", "match": "A1|P2|null", "reason": "brief explanation"}. No preamble, no markdown fences.`,
  ].join("\n");

  const auditResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o",
      messages: [
        { role: "system", content: auditSystemPrompt },
        { role: "user", content: `Audit this copy:\n\n${copy}` },
      ],
      max_tokens: 2000,
      temperature: 0,
    }),
  });

  if (!auditResponse.ok) {
    return { error: `Claim audit call failed with status ${auditResponse.status}.`, sentences: [] };
  }

  const auditData = await auditResponse.json();
  const auditText = (auditData.choices?.[0]?.message?.content || "").trim();

  let sentences = [];
  try {
    const cleaned = auditText.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
    sentences = JSON.parse(cleaned);
  } catch {
    return { error: "Claim audit returned unparseable output.", raw: auditText, sentences: [] };
  }

  const findings = [];
  let claimCount = 0;
  let descriptionCount = 0;

  for (const s of sentences) {
    if (s.classification === "description") {
      descriptionCount++;
      continue;
    }
    claimCount++;
    if (s.classification === "prohibited") {
      findings.push({ severity: "violation", sentence: s.sentence, match: s.match, reason: s.reason });
    } else if (s.classification === "unapproved") {
      findings.push({ severity: "review", sentence: s.sentence, reason: s.reason });
    }
  }

  return {
    totalSentences: sentences.length,
    descriptions: descriptionCount,
    claims: claimCount,
    approvedClaims: sentences.filter((s) => s.classification === "approved").length,
    unapprovedClaims: sentences.filter((s) => s.classification === "unapproved").length,
    prohibitedClaims: sentences.filter((s) => s.classification === "prohibited").length,
    findings,
    sentences,
  };
}

/**
 * Check whether required disclosures are present in copy.
 * Normalizes whitespace on both sides before comparing.
 */
export function checkDisclosurePresence(copy, disclosures) {
  const copyNorm = copy.replace(/\s+/g, " ").toLowerCase();
  return disclosures.map((d) => ({
    text: d.text,
    trigger_scope: d.trigger_scope,
    present: copyNorm.includes(d.text.replace(/\s+/g, " ").toLowerCase()),
  }));
}
