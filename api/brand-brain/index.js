import { createVercelBlobBrandBrainStore } from "../../src/brand-brain/store.js";
import { createVercelBlobClaimsStore } from "../../src/claims/store.js";
import { createVercelBlobRefusalsStore } from "../../src/refusals/store.js";
import { resolveBootstrapSlate } from "../../src/refusals/bootstrap.js";
import { auditCopyAgainstClaims } from "../../src/claims/copy-audit.js";
import { readJsonBody, requireUser, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { OPERATOR_ROLE } from "../../src/org/store.js";

// Dispatching handler for the Brand Brain and claims document.
//
// GET                                -> read the saved Brand Brain (unchanged)
// POST { action: "read_claims" }     -> read the brand-level claims document
// POST { action: "add_claim" }       -> add an entry to a claims section
// POST { action: "edit_claim" }      -> edit an existing claims entry
// POST { action: "remove_claim" }    -> remove a claims entry
// POST { action: "run_audit_test" }  -> run the ADR 0013 mechanism test
// POST { action: "read_refusals" }   -> read the client's protections document
// POST { action: "rule_refusal" }    -> accept or decline one proposed protection
// POST { action: "seed_refusals" }   -> bootstrap an initial slate, ADR 0017 step 3

export default async function handler(request, response) {
  const user = await requireUser(request, response, { role: OPERATOR_ROLE });
  if (!user) return;
  try {
    const clientId = resolveClientId(request, user);

    // GET: read the brain (existing behavior, unchanged).
    if (request.method === "GET") {
      const store = createVercelBlobBrandBrainStore({ clientId });
      sendJson(response, 200, { saved: await store.read() });
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      sendJson(response, 405, { error: "GET reads the brain. POST dispatches claims actions." });
      return;
    }

    // POST: dispatch claims operations.
    const body = await readJsonBody(request);
    const action = String(body.action || "").trim();
    const claimsStore = createVercelBlobClaimsStore({ clientId });

    if (action === "read_claims") {
      const doc = await claimsStore.read();
      sendJson(response, 200, {
        claims: doc,
        active: {
          approved: claimsStore.activeEntries(doc, "approved"),
          prohibited: claimsStore.activeEntries(doc, "prohibited"),
          disclosures: claimsStore.activeEntries(doc, "disclosures"),
        },
      });
      return;
    }

    if (action === "add_claim") {
      const section = String(body.section || "").trim();
      const result = await claimsStore.addEntry(section, {
        text: body.text,
        scope: body.scope,
        source_ref: body.source_ref,
        added_by: body.added_by,
        trigger_scope: body.trigger_scope,
      });
      sendJson(response, 200, result);
      return;
    }

    if (action === "edit_claim") {
      const section = String(body.section || "").trim();
      const entryId = String(body.entryId || "").trim();
      const result = await claimsStore.editEntry(section, entryId, {
        text: body.text,
        scope: body.scope,
        source_ref: body.source_ref,
        added_by: body.added_by,
        trigger_scope: body.trigger_scope,
      });
      sendJson(response, 200, result);
      return;
    }

    if (action === "remove_claim") {
      const section = String(body.section || "").trim();
      const entryId = String(body.entryId || "").trim();
      const result = await claimsStore.removeEntry(section, entryId);
      sendJson(response, 200, result);
      return;
    }

    // ADR 0017: the client's protections. Reading is always safe; ruling and
    // seeding write. Seeding exists for the two clients whose protections were
    // authored ahead of the matcher and refuses on a client that has any.
    if (action === "read_refusals") {
      const refusals = createVercelBlobRefusalsStore({ clientId });
      const doc = await refusals.read();
      sendJson(response, 200, {
        refusals: doc,
        proposed: refusals.proposedEntries(doc),
        active: refusals.activeEntries(doc),
        seedAvailable: doc.entries.length === 0 && Boolean(resolveBootstrapSlate(clientId)),
      });
      return;
    }

    if (action === "rule_refusal") {
      const entryId = String(body.entryId || "").trim();
      const decision = String(body.decision || "").trim();
      if (!["accepted", "declined"].includes(decision)) {
        sendJson(response, 400, { error: 'A ruling is either "accepted" or "declined".' });
        return;
      }
      const refusals = createVercelBlobRefusalsStore({ clientId });
      const result =
        decision === "accepted"
          ? await refusals.accept(entryId, { by: body.ruledBy || null })
          : await refusals.decline(entryId, { by: body.ruledBy || null });
      sendJson(response, 200, {
        refusals: result.document,
        ruled: result.result,
        proposed: refusals.proposedEntries(result.document),
        active: refusals.activeEntries(result.document),
      });
      return;
    }

    if (action === "seed_refusals") {
      const slate = resolveBootstrapSlate(clientId);
      if (!slate) {
        sendJson(response, 400, {
          error: "No prepared protections exist for this client. Protections arrive from synthesis once the matcher ships.",
        });
        return;
      }
      const refusals = createVercelBlobRefusalsStore({ clientId });
      const result = await refusals.seed(slate.entries);
      sendJson(response, 200, {
        refusals: result.document,
        seeded: result.seeded,
        slate: slate.key,
        proposed: refusals.proposedEntries(result.document),
        active: refusals.activeEntries(result.document),
      });
      return;
    }

    if (action === "run_audit_test") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OpenAI API key is not configured.");
      const result = await runMechanismTest(apiKey);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 400, {
      error: `Unknown action "${action}". Supported: read_claims, add_claim, edit_claim, remove_claim, read_refusals, rule_refusal, seed_refusals, run_audit_test.`,
    });
  } catch (error) {
    sendPublicError(response, error);
  }
}

// ---------------------------------------------------------------------------
// ADR 0013 mechanism test
//
// Runs the copy audit against a synthetic fixture. The fixture is inlined
// here so the test is self-contained in the serverless function. The
// canonical fixture lives at fixtures/copy-audit-fixture.json.
//
// Pass criteria (code review 2026-08-09):
//   1. Every verbatim violation flagged as "prohibited".
//   2. Every paraphrase violation flagged as "prohibited".
//   3. No adjacent non-violation flagged as "prohibited".
//   4. Audit-error path exercised and distinguishable from clean.
// ---------------------------------------------------------------------------

const FIXTURE = {
  approved: [
    { text: "Helix Relay reduces average internal response time by 40%.", source: "Fixture: quantified benefit" },
    { text: "SOC 2 Type II certified.", source: "Fixture: regulatory property" },
    { text: "Used by over 200 enterprise customers.", source: "Fixture: quantified adoption" },
  ],
  prohibited: [
    { text: "HIPAA compliant", source: "Fixture: unverified regulatory" },
    { text: "the fastest internal messaging platform", source: "Fixture: superlative comparative" },
    { text: "eliminates email entirely", source: "Fixture: false capability" },
    { text: "guaranteed 99.99% uptime", source: "Fixture: uncontracted guarantee" },
    { text: "reduces employee turnover", source: "Fixture: unsubstantiated causal" },
  ],
  verbatim: [
    "Helix Relay is HIPAA compliant and ready for healthcare teams.",
    "As the fastest internal messaging platform on the market, Helix Relay is the obvious choice.",
    "Helix Relay eliminates email entirely, replacing every inbox with a unified channel.",
    "With guaranteed 99.99% uptime, your team will never experience downtime.",
    "Helix Relay reduces employee turnover by keeping distributed teams connected.",
  ],
  paraphrase: [
    "Helix Relay meets HIPAA requirements for protected health information.",
    "No other internal messaging tool matches Helix Relay's speed.",
    "After adopting Helix Relay, teams no longer need email at all.",
    "We guarantee nearly 100% availability for every customer.",
    "Companies using Helix Relay see lower staff attrition rates.",
  ],
  adjacent: [
    "Helix Relay takes security seriously and holds SOC 2 Type II certification.",
    "Internal messaging helps distributed teams stay aligned without waiting for email replies.",
    "Helix Relay is designed with healthcare teams in mind, though specific compliance certifications vary by deployment.",
    "Our platform is fast, with most messages delivered in under 200 milliseconds.",
    "Teams that communicate well tend to retain employees longer. Helix Relay helps teams communicate well.",
  ],
};

async function runMechanismTest(apiKey) {
  const approved = FIXTURE.approved;
  const prohibited = FIXTURE.prohibited;

  async function auditSample(copy) {
    const result = await auditCopyAgainstClaims({ copy, approvedClaims: approved, prohibitedClaims: prohibited, apiKey });
    const flagged = (result.sentences || []).filter((s) => s.classification === "prohibited");
    return { copy, prohibitedCount: flagged.length, flagged, error: result.error || null };
  }

  // Group 1: Verbatim violations
  const verbatimResults = [];
  for (const sample of FIXTURE.verbatim) {
    verbatimResults.push(await auditSample(sample));
  }

  // Group 2: Paraphrase violations
  const paraphraseResults = [];
  for (const sample of FIXTURE.paraphrase) {
    paraphraseResults.push(await auditSample(sample));
  }

  // Group 3: Adjacent non-violations
  const adjacentResults = [];
  for (const sample of FIXTURE.adjacent) {
    adjacentResults.push(await auditSample(sample));
  }

  // Group 4: Error path
  const errorResult = await auditCopyAgainstClaims({
    copy: "This is test copy.",
    approvedClaims: approved,
    prohibitedClaims: prohibited,
    apiKey: "sk-invalid-key-for-error-path-test",
  });

  // Evaluate
  const criterion1 = verbatimResults.every((r) => r.prohibitedCount > 0);
  const criterion2 = paraphraseResults.every((r) => r.prohibitedCount > 0);
  const criterion3 = adjacentResults.every((r) => r.prohibitedCount === 0);
  const criterion4 = !!errorResult.error && Array.isArray(errorResult.sentences) && errorResult.sentences.length === 0;
  const allPass = criterion1 && criterion2 && criterion3 && criterion4;

  return {
    overall: allPass ? "PASS" : "FAIL",
    criterion1: { label: "Verbatim violations flagged", pass: criterion1, results: verbatimResults.map((r) => ({ copy: r.copy.slice(0, 80), prohibited: r.prohibitedCount })) },
    criterion2: { label: "Paraphrase violations flagged", pass: criterion2, results: paraphraseResults.map((r) => ({ copy: r.copy.slice(0, 80), prohibited: r.prohibitedCount })) },
    criterion3: { label: "Adjacent non-violations clean", pass: criterion3, results: adjacentResults.map((r) => ({ copy: r.copy.slice(0, 80), prohibited: r.prohibitedCount })) },
    criterion4: { label: "Error path distinguishable", pass: criterion4, error: errorResult.error, sentencesEmpty: errorResult.sentences?.length === 0 },
  };
}
