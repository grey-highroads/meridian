// Shared copy generation and audit (ADR 0014, sequencing step 1).
//
// Every copy type runs through this module. The type supplies its prompt
// shape from the catalog; everything below is identical regardless of type.
// The claims spine from ADR 0013 is consumed unchanged: assembly, audit, and
// disclosure checking are imported, never reimplemented here.
//
// Audit states. The shipped audit returns findings on success and an error
// object on failure, and the calling code previously skipped it entirely when
// there were no claims to check. Those three situations have to look different
// to a reviewer, so this module normalizes them:
//
//   governed   the audit ran against a real claims set, findings are trustworthy
//   no_claims  nothing governs this copy yet, so nothing was checked
//   errored    the audit could not complete, so nothing was checked
//
// An errored audit must never render as a clean pass. The status field is the
// only thing the interface reads to make that distinction.

import { auditCopyAgainstClaims, checkDisclosurePresence } from "../claims/copy-audit.js";
import { checkDisplayBudgets } from "./display-budget.js";
import { checkProseRules, collapseProseFindings } from "./prose-check.js";
import { getCopyType } from "./types.js";

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const COPY_MODEL = "gpt-4o";

function section(brain, id) {
  return brain?.guidanceSections?.find((s) => s.id === id) || null;
}

function guidanceLine(entry, fallback) {
  if (!entry) return fallback;
  const principles = Array.isArray(entry.principles) ? entry.principles.join(". ") : "";
  return `${entry.summary}. ${principles}`.trim();
}

/**
 * Build the system prompt for a copy job. Brand guidance, product knowledge,
 * and the assembled claims steer generation; the copy type supplies its own
 * role line, length rule, structure, and output format.
 */
export function buildCopySystemPrompt({ copyType, brain, product, claimsSet, context }) {
  const dossier = brain?.artifacts?.dossier || {};
  const voice = section(brain, "voice");
  const foundation = section(brain, "foundation");
  const world = section(brain, "world");
  const rules = section(brain, "rules");

  const parts = [
    copyType.roleLine({
      brandName: brain?.brandName || "the brand",
      brandDescription: brain?.brandDescription || "",
      placement: context.placement,
    }),
    ``,
    `VOICE AND MESSAGING:`,
    guidanceLine(voice, "No voice guidance available."),
    ``,
    `BRAND FOUNDATION:`,
    guidanceLine(foundation, "No foundation guidance available."),
    ``,
    world ? `WORLD AND STORY:\n${guidanceLine(world, "")}` : "",
    ``,
    `BOUNDARIES:`,
    guidanceLine(rules, "No specific rules."),
    ...(dossier.guardrails || []).map((g) => `- ${g.title}: ${g.body}`),
  ];

  if (product) {
    parts.push(``, `PRODUCT KNOWLEDGE (${product.product_name}):`, product.one_true_thing || "");
    for (const feature of product.features || []) {
      const claim = feature.approved_claim_language
        ? ` Approved claim language: "${feature.approved_claim_language}"`
        : "";
      parts.push(`- ${feature.name}: ${feature.benefit}.${claim}`);
    }
  }

  if (claimsSet.approved.length > 0) {
    parts.push(``, `APPROVED CLAIMS (use these when relevant, do not invent new benefit or capability claims):`);
    for (const claim of claimsSet.approved) parts.push(`- "${claim.text}" (${claim.source})`);
  }
  if (claimsSet.prohibited.length > 0) {
    parts.push(``, `PROHIBITED CLAIMS AND EXCLUSIONS (never state or imply these):`);
    for (const claim of claimsSet.prohibited) parts.push(`- ${claim.text}`);
  }
  if (claimsSet.disclosures.length > 0) {
    parts.push(``, `REQUIRED DISCLOSURES (include these when their trigger conditions apply):`);
    for (const disclosure of claimsSet.disclosures) parts.push(`- ${disclosure.text}`);
  }
  // Directives are instructions, not claim strings. They steer generation and
  // are deliberately not handed to the claim auditor, which has no claim to
  // match them against and returns a topic match instead. See the ADR 0013
  // amendment of 2026-08-10.
  if ((claimsSet.directives || []).length > 0) {
    parts.push(``, `PRODUCTION DIRECTIVES (follow these instructions):`);
    for (const directive of claimsSet.directives) parts.push(`- ${directive.text}`);
  }

  if (copyType.structured) {
    parts.push(``, `FIELDS TO PRODUCE:`);
    const budgets = new Map((context.displayBudgets || []).map((budget) => [budget.fieldId, budget]));
    for (const field of copyType.fields) {
      const budget = budgets.get(field.id);
      const limit = budget
        ? `Maximum ${budget.maxChars} characters, which is about ${budget.charsPerLine} characters across up to ${budget.lines} ${budget.lines === 1 ? "line" : "lines"}.`
        : `Maximum ${field.maxWords} words.`;
      parts.push(`- ${field.id} (${field.label}): ${field.note} ${limit}`);
    }
    if (budgets.size) {
      parts.push(`These budgets exist because the copy is rendered into the image. Shorter is safer than longer.`);
    }
  }

  parts.push(
    ``,
    `STRUCTURAL RULES (non-negotiable):`,
    ...copyType.structuralRules.map((rule) => `- ${rule}`),
    `- ${copyType.lengthGuidance(context)}`,
    ``,
    `OUTPUT FORMAT:`,
    ...copyType.outputFormat,
  );

  return parts.filter(Boolean).join("\n");
}

function buildUserPrompt({ copyType, context }) {
  const topic = copyType.topicFallbackOrder
    .map((field) => String(context[field] || "").trim())
    .find(Boolean);
  return [
    context.placement ? `The copy accompanies a ${context.placement} output.` : "",
    topic ? `Direction: ${topic}` : "Write about the brand's perspective on its category.",
    context.postType ? `Post type: ${context.postType}` : "",
    context.postClaims ? `Include these approved claims or facts: ${context.postClaims}` : "",
    context.postCta ? `End with this call to action: ${context.postCta}` : "",
    context.exclusions ? `Avoid: ${context.exclusions}` : "",
  ].filter(Boolean).join("\n");
}

// Resolve an audit match token (A1, P2) back to the claim it matched, so the
// interface can name the governing rule rather than printing a code.
function resolveGoverningRule(match, claimsSet) {
  const token = String(match || "").trim();
  const index = Number(token.slice(1)) - 1;
  if (!Number.isInteger(index) || index < 0) return null;
  if (token.startsWith("A")) return claimsSet.approved[index]?.text || null;
  if (token.startsWith("P")) return claimsSet.prohibited[index]?.text || null;
  return null;
}

/**
 * Run the ADR 0013 audit and normalize the result into one of three states.
 * Never throws: an audit that cannot complete reports as errored rather than
 * failing the copy that was successfully produced.
 */
export async function auditProducedCopy({ text, claimsSet, apiKey }) {
  const hasClaims = claimsSet.approved.length > 0 || claimsSet.prohibited.length > 0;
  // Deterministic and independent of the claim audit, so these findings are
  // present in every state, including the one where the claim check failed.
  const proseFindings = collapseProseFindings(checkProseRules(text));
  const disclosureFindings = claimsSet.disclosures.length > 0
    ? checkDisclosurePresence(text, claimsSet.disclosures)
    : [];

  const missingDisclosures = disclosureFindings
    .filter((finding) => !finding.present)
    .map((finding) => ({
      severity: "review",
      sentence: "",
      reason: "A required disclosure does not appear in this copy.",
      rule: finding.text,
      kind: "disclosure",
    }));

  if (!hasClaims) {
    return {
      status: "no_claims",
      message: "No approved or prohibited claims apply to this job yet, so there was nothing to check the wording against. The copy still follows your brand voice guidance.",
      findings: [...missingDisclosures, ...proseFindings],
      totals: null,
      disclosures: disclosureFindings,
    };
  }

  let raw = null;
  try {
    raw = await auditCopyAgainstClaims({
      copy: text,
      approvedClaims: claimsSet.approved,
      prohibitedClaims: claimsSet.prohibited,
      apiKey,
    });
  } catch (error) {
    return {
      status: "errored",
      message: `The claim check could not run: ${error.message || "the request failed"}. This copy has not been checked against your claims.`,
      findings: [...missingDisclosures, ...proseFindings],
      totals: null,
      disclosures: disclosureFindings,
    };
  }

  if (raw?.error) {
    return {
      status: "errored",
      message: `The claim check could not run: ${raw.error} This copy has not been checked against your claims.`,
      findings: [...missingDisclosures, ...proseFindings],
      totals: null,
      disclosures: disclosureFindings,
    };
  }

  const findings = (raw.findings || []).map((finding) => ({
    severity: finding.severity,
    sentence: finding.sentence || "",
    reason: finding.reason || "",
    rule: resolveGoverningRule(finding.match, claimsSet),
    kind: finding.severity === "violation" ? "prohibited" : "unapproved",
  }));

  return {
    status: "governed",
    message: findings.length === 0
      ? "No claim in this copy fell outside your approved list."
      : "",
    findings: [...findings, ...missingDisclosures, ...proseFindings],
    totals: {
      sentences: raw.totalSentences || 0,
      claims: raw.claims || 0,
      approved: raw.approvedClaims || 0,
      unapproved: raw.unapprovedClaims || 0,
      prohibited: raw.prohibitedClaims || 0,
    },
    disclosures: disclosureFindings,
  };
}

/**
 * Produce one governed copy block. Returns the text, the claims that governed
 * it, and the normalized audit. The caller decides where it lands.
 */
export async function produceCopy({ copyTypeId, brain, product, claimsSet, context, apiKey, fetchImpl }) {
  const copyType = getCopyType(copyTypeId);
  if (!copyType) {
    const error = new Error(`"${copyTypeId}" is not a copy type this system produces.`);
    error.status = 400;
    throw error;
  }
  const doFetch = fetchImpl || fetch;
  const systemPrompt = buildCopySystemPrompt({ copyType, brain, product, claimsSet, context });
  const userPrompt = buildUserPrompt({ copyType, context });

  const chatResponse = await doFetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: COPY_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });
  if (!chatResponse.ok) {
    const errorBody = await chatResponse.text();
    throw new Error(`OpenAI returned status ${chatResponse.status}: ${errorBody.slice(0, 200)}`);
  }
  const chatData = await chatResponse.json();
  const raw = chatData.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("OpenAI returned empty copy.");

  // A structured type returns fields; an unstructured one returns a string.
  // The audit runs on the joined text either way, so claims spanning two
  // lines are still caught, and findings carry the field they landed on.
  const fields = copyType.structured ? parseStructuredCopy(raw, copyType) : null;
  const text = fields ? fields.map((field) => field.text).join("\n") : raw;

  const audit = await auditProducedCopy({ text, claimsSet, apiKey });
  if (fields) attributeFindingsToFields(audit, fields);
  // Deterministic, like the prose check. A line over its character budget is
  // a fact about the string, not a judgment about it.
  if (fields && context.displayBudgets) {
    audit.findings.push(...checkDisplayBudgets(fields, context.displayBudgets));
  }

  return {
    copyTypeId: copyType.id,
    label: copyType.label,
    text,
    fields,
    model: COPY_MODEL,
    generatedAt: new Date().toISOString(),
    audit,
  };
}

// Parse a structured response. The model is told to return bare JSON and
// usually does; the fence strip handles the case where it wraps it anyway.
// A field the model omitted comes back empty rather than missing, so the
// interface renders a visible gap instead of silently showing two lines
// where three were asked for.
function parseStructuredCopy(raw, copyType) {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("The display copy came back in a shape this system could not read.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("The display copy came back in a shape this system could not read.");
  }
  return copyType.fields.map((field) => ({
    id: field.id,
    label: field.label,
    maxWords: field.maxWords,
    text: typeof parsed[field.id] === "string" ? parsed[field.id].trim() : "",
    overLength: countWords(parsed[field.id]) > field.maxWords,
  }));
}

function countWords(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

// Name the field a finding landed on, so "this claim is not on your approved
// list" points at the headline rather than at the set.
function attributeFindingsToFields(audit, fields) {
  for (const finding of audit.findings || []) {
    if (!finding.sentence) continue;
    const match = fields.find((field) => field.text && finding.sentence.includes(field.text));
    const containing = match || fields.find((field) => field.text && field.text.includes(finding.sentence));
    if (containing) finding.field = containing.label;
  }
}
