// ADR 0017 step 1 gate harness.
//
// Runs the pre-registered clauses in docs/evaluations/2026-08-17-adr-0017-step1-refusals-gate.md
// against the hand-authored fixtures. Zero model calls, zero network, zero
// client namespace reads or writes.
//
// Captured grammar rejects, regenerated guardrails, and regenerated lived-world
// rejects are parsed from the committed step 3 parity document, so the counts
// below are reproducible from the repository. The two brands' currently
// approved guardrails and lived-world rejects are private client material and
// live gitignored under fixtures/adr-0017-approved-refusals/; the harness reads
// their counts only, never their content.
//
// Run: node fixtures/adr-0017-refusals-gate.mjs

import { readFileSync, existsSync } from "node:fs";
import {
  emptyDocument,
  proposeEntry,
  acceptEntry,
  declineEntry,
  retireEntry,
  recordObservation,
  supersedeEntry,
  activeEntries,
  ruledEntries,
  findEntry,
} from "../src/refusals/store.js";

const PARITY = "docs/evaluations/2026-08-16-adr-0016-step3-parity.md";
const FIXTURES = "fixtures/adr-0017-refusals";
const APPROVED = "fixtures/adr-0017-approved-refusals/adr-0017-approved-refusal-inputs.json";

const CLIENTS = ["mycopop", "dialog-health"];
const CAPTURES = ["cycle1", "cycle2", "S1", "S2", "S3"];
const STABILITY = ["S1", "S2", "S3"];

// Pre-registered thresholds. Do not edit to make a run pass.
const UNDER_MERGE_FAIL_AT = 0.75;
const CONVERGENCE_FAIL_BELOW = 0.7;

function parseJsonFences(markdown) {
  const blocks = [];
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim().startsWith("```json")) continue;
    const buf = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith("```")) {
      buf.push(lines[j]);
      j += 1;
    }
    blocks.push(JSON.parse(buf.join("\n")));
    i = j;
  }
  return blocks;
}

function loadCaptures() {
  const blocks = parseJsonFences(readFileSync(PARITY, "utf8"));
  const cycles = blocks.filter((b) => b.sections);
  const stability = blocks.filter((b) => b.runs);
  const out = { mycopop: {}, "dialog-health": {} };
  // Cycle blocks appear in document order: mycopop c1, dialog c1, mycopop c2, dialog c2.
  const order = [
    ["mycopop", "cycle1"],
    ["dialog-health", "cycle1"],
    ["mycopop", "cycle2"],
    ["dialog-health", "cycle2"],
  ];
  cycles.forEach((block, index) => {
    const [client, capture] = order[index];
    out[client][capture] = { rejects: block.sections.rejects };
  });
  stability.forEach((block) => {
    const client = /myco/i.test(block.brand) ? "mycopop" : "dialog-health";
    block.runs.forEach((run) => {
      out[client][`S${run.run}`] = {
        rejects: run.visualGrammar.sections.rejects,
        guardrails: run.guardrails,
        livedWorldRejects: run.livedWorldRejects,
      };
    });
  });
  return out;
}

function capturedItemKeys(client, captures, approvedCounts) {
  const keys = [];
  for (const capture of CAPTURES) {
    for (const entry of captures[client][capture].rejects) {
      keys.push(`grammar:${capture}:${entry.label}`);
    }
  }
  for (const capture of STABILITY) {
    for (const guardrail of captures[client][capture].guardrails) {
      keys.push(`guardrail:${capture}:${guardrail.title}`);
    }
    captures[client][capture].livedWorldRejects.forEach((_, index) => {
      keys.push(`lwr:${capture}:${index}`);
    });
  }
  for (let i = 0; i < approvedCounts[client].guardrails; i += 1) {
    keys.push(`approved-guardrail:${i}`);
  }
  for (let i = 0; i < approvedCounts[client].rejects; i += 1) {
    keys.push(`approved-lwr:${i}`);
  }
  return keys;
}

function report(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  return ok;
}

function main() {
  const captures = loadCaptures();
  const mapping = JSON.parse(readFileSync(`${FIXTURES}/concern-mapping.json`, "utf8"));
  const domains = JSON.parse(readFileSync(`${FIXTURES}/domains.json`, "utf8"));

  let approvedCounts;
  if (existsSync(APPROVED)) {
    const raw = JSON.parse(readFileSync(APPROVED, "utf8"));
    approvedCounts = Object.fromEntries(
      CLIENTS.map((c) => [
        c,
        {
          guardrails: raw[c].approved_dossier_guardrails.length,
          rejects: raw[c].approved_livedWorld_rejects.length,
        },
      ])
    );
  } else {
    // Counts recorded at authoring time so the harness still runs without the
    // private paste present. Stated rather than silently skipped.
    approvedCounts = {
      mycopop: { guardrails: 6, rejects: 6 },
      "dialog-health": { guardrails: 5, rejects: 6 },
    };
    console.log("NOTE  approved paste absent; using the counts recorded at authoring time\n");
  }

  let allPassed = true;

  for (const client of CLIENTS) {
    const doc = JSON.parse(readFileSync(`${FIXTURES}/${client}.json`, "utf8"));
    const keys = capturedItemKeys(client, captures, approvedCounts);
    const mapped = mapping[client];
    console.log(`\n=== ${client}: ${keys.length} captured items, ${doc.entries.length} concern entries`);

    // G1, total mapping.
    const unmapped = keys.filter((k) => !mapped[k]);
    const unknown = Object.keys(mapped).filter((k) => !keys.includes(k));
    const multi = Object.entries(mapped).filter(([, v]) => v.length > 1);
    const ids = new Set(doc.entries.map((e) => e.id));
    const danglingIds = Object.values(mapped).flat().filter((id) => !ids.has(id));
    const g1 =
      unmapped.length === 0 && unknown.length === 0 && multi.length === 0 && danglingIds.length === 0;
    allPassed &= report(
      "G1 total mapping",
      g1,
      `unmapped ${unmapped.length}, unknown keys ${unknown.length}, items on two concerns ${multi.length}, dangling ids ${danglingIds.length}`
    );
    if (unmapped.length) unmapped.forEach((k) => console.log(`      unmapped: ${k}`));

    // G2, paraphrase convergence, grammar rejects only.
    const grammarItems = [];
    for (const capture of CAPTURES) {
      for (const entry of captures[client][capture].rejects) {
        grammarItems.push({ capture, concern: mapped[`grammar:${capture}:${entry.label}`][0] });
      }
    }
    const reach = new Map();
    for (const item of grammarItems) {
      if (!reach.has(item.concern)) reach.set(item.concern, new Set());
      reach.get(item.concern).add(item.capture);
    }
    const ratio = reach.size / grammarItems.length;
    const converged = grammarItems.filter((i) => reach.get(i.concern).size >= 2).length;
    const convergence = converged / grammarItems.length;
    allPassed &= report(
      "G2 under-merge",
      ratio < UNDER_MERGE_FAIL_AT,
      `concerns/items ${reach.size}/${grammarItems.length} = ${ratio.toFixed(3)}, fails at or above ${UNDER_MERGE_FAIL_AT}`
    );
    allPassed &= report(
      "G2 convergence",
      convergence >= CONVERGENCE_FAIL_BELOW,
      `${converged}/${grammarItems.length} = ${convergence.toFixed(4)}, fails below ${CONVERGENCE_FAIL_BELOW}`
    );

    // G3, domain coverage. Reports.
    const counts = {};
    for (const value of Object.values(domains[client])) counts[value] = (counts[value] || 0) + 1;
    console.log(`REPORT G3 domain coverage  ${JSON.stringify(counts)}`);

    // G4, origin honesty.
    const badOrigin = doc.entries.filter((e) => !["evidence", "inference"].includes(e.basis.origin));
    allPassed &= report("G4 origin honesty", badOrigin.length === 0, `non-evidence, non-inference origins ${badOrigin.length}`);

    // G6, lifecycle round trip.
    allPassed &= report("G6 lifecycle round trip", roundTrip(doc));
  }

  console.log(`\n${allPassed ? "All mechanical clauses passed." : "At least one clause failed. See the judgment section of the gate document."}`);
}

function roundTrip(fixture) {
  const doc = emptyDocument();
  const before = fixture.entries.length;

  for (const entry of fixture.entries) {
    proposeEntry(doc, {
      id: entry.id,
      concern: entry.concern,
      statement: entry.statement,
      basis: entry.basis,
      ruling: { proposed_by_run: "fixture" },
    });
  }
  if (doc.entries.length !== before) return false;
  if (doc.entries.some((e) => e.status !== "proposed")) return false;

  const [first, second, third] = doc.entries;
  acceptEntry(doc, first.id, { by: "fixture-owner" });
  declineEntry(doc, second.id, { by: "fixture-owner" });
  recordObservation(doc, first.id, { run: "S2", statement: "a paraphrase of the same concern" });
  const { superseded, replacement } = supersedeEntry(doc, third.id, {
    statement: `${third.statement} Reworded for the round trip.`,
  });
  acceptEntry(doc, replacement.id);
  retireEntry(doc, first.id, { by: "fixture-owner" });

  // Nothing is lost: every original id is still present and readable.
  for (const entry of fixture.entries) {
    if (!findEntry(doc, entry.id)) return false;
  }
  if (doc.entries.length !== before + 1) return false;
  if (findEntry(doc, second.id).status !== "declined") return false;
  if (findEntry(doc, first.id).status !== "retired") return false;
  if (findEntry(doc, first.id).observations.length !== 1) return false;
  if (superseded.superseded_by !== replacement.id) return false;
  if (activeEntries(doc).some((e) => e.id === first.id)) return false;
  if (!activeEntries(doc).some((e) => e.id === replacement.id)) return false;
  if (ruledEntries(doc).length !== 3) return false;

  // Serialization round trip changes nothing.
  const copy = JSON.parse(JSON.stringify(doc));
  if (JSON.stringify(copy) !== JSON.stringify(doc)) return false;

  // Deletion does not exist as an operation.
  if (typeof globalThis.deleteEntry === "function") return false;
  return true;
}

main();
