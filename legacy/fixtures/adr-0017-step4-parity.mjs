// ADR 0017 step 4 parity check. Run: node fixtures/adr-0017-step4-parity.mjs
//
// Three claims, each stated in the step 4 ruling and each checked here rather
// than asserted:
//   1. A brand with no protections document compiles byte-identical to the
//      compiler at the commit before this one, held at
//      fixtures/adr-0017-step4-parity-baseline.js.
//   2. A brand with a document and nothing accepted compiles byte-identical
//      too, which is the amended switch: a transition never dips protection.
//   3. A brand with accepted entries compiles avoid-clauses that are exactly
//      those entries' statements, with no livedWorld reject leaking in.
//
// Template and sales placements carry no avoid-clause section at all and are
// checked to be unaffected either way. Zero network, zero model calls, zero
// client storage.

import { compileBrandWorldImagePackage as oldCompile } from "./adr-0017-step4-parity-baseline.js";
import { compileBrandWorldImagePackage as newCompile } from "../src/production/package.js";
import { resolveBootstrapSlate } from "../src/refusals/bootstrap.js";

const brain = {
  brandName: "Parity Brand",
  guidanceSections: ["foundation", "identity", "world", "voice", "creative", "rules"].map((id) => ({
    id,
    name: id[0].toUpperCase() + id.slice(1),
    summary: `The ${id} summary for the parity fixture.`,
    principles: [`A ${id} principle.`],
    productionUse: `How ${id} is used in production.`,
  })),
  artifacts: {
    dossier: { palette: [{ name: "Ink", role: "Primary", color: "#101010" }], materials: ["paper", "glass"], guardrails: [{ title: "G", body: "B" }] },
    livedWorld: { rejects: ["Jitters and a hard crash", "Chalky or medicinal formats", "Vague wellness mysticism"], wants: [], tensions: [], patterns: [], social: [], environments: [] },
    storyArchitecture: {},
  },
  guidance: {},
  identity: { summary: "A parity fixture brand." },
};
const brief = { placement: "Social post", format: "Square 1080", scene: "A can on a wet stone counter in morning light, one hand reaching for it.", objective: "Parity check" };
const base = { approvedBrain: brain, brainVersion: 3, brief };

// Read the section off the package rather than pattern matching the JSON. The
// first version of this harness used a regex and ran past the section boundary,
// because JSON escapes a newline rather than quoting it, and reported a code
// fault that was a harness fault.
function avoidClause(pkg) {
  const section = (pkg.sections || []).find((s) => s.title === "What this brand is not");
  return section ? section.body : null;
}
let ok = true;
const check = (label, pass, detail = "") => { if (!pass) ok = false; console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`); };

const before = JSON.stringify(oldCompile({ ...base }));
check("document-less brand compiles byte-identical", before === JSON.stringify(newCompile({ ...base })), `${before.length} chars`);
check("document present, zero accepted, byte-identical", before === JSON.stringify(newCompile({ ...base, refusals: [] })));

for (const clientId of ["mycopop-fbad242f", "dialog-health-9c1a2b3d"]) {
  const slate = resolveBootstrapSlate(clientId);
  const accepted = slate.entries.slice(0, 5);
  const clause = avoidClause(newCompile({ ...base, refusals: accepted }));
  const expected = `This brand is not these things, and none of them belong in the frame: ${accepted.map((e) => e.statement).join(" ")}`;
  check(`${slate.key}: avoid-clause is exactly the accepted statements`, clause === expected);
  check(`${slate.key}: no livedWorld reject leaks in`, !brain.artifacts.livedWorld.rejects.some((r) => clause.includes(r)));
  const full = avoidClause(newCompile({ ...base, refusals: slate.entries }));
  check(`${slate.key}: all ${slate.entries.length} statements present`, slate.entries.every((e) => full.includes(e.statement)));
}

for (const placement of ["Sales enablement", "Brand template"]) {
  const b2 = { ...base, brief: { ...brief, placement } };
  check(`${placement} placement unaffected`, JSON.stringify(oldCompile({ ...b2 })) === JSON.stringify(newCompile({ ...b2, refusals: resolveBootstrapSlate("mycopop").entries })));
}
console.log(ok ? "\nPARITY PASS" : "\nPARITY FAIL");
process.exit(ok ? 0 : 1);
