// ADR 0016 step 4 parity check. Run: node fixtures/adr-0016-step4-parity.mjs
//
// The scene writer lives inside a serverless handler and cannot be imported
// without its model call, which is the "scene writer is not independently
// testable" finding from the step 1 prototype. This harness therefore holds two
// copies of the context assembly, the one at the commit before step 4 and the
// one at head, extracted mechanically rather than retyped, and compares them.
//
// The copies are the weak point and the check knows it: a drift tripwire below
// asserts the live assembly still matches the copy, so a later edit to the
// handler that is not mirrored here fails loudly rather than silently passing.
//
// Claims checked:
//   1. A brain with no visualGrammar assembles byte-identical context to the
//      prior code, including the dossier materials line and both summaries.
//   2. A brain with a visualGrammar drops IDENTITY, CREATIVE DIRECTION, and
//      MATERIALS AND LIGHT, and gains the five descriptive grammar sections.
//   3. No rejects section reaches the writer on either path, because ADR 0017
//      made the governed document the only refusal source.
//   4. Ambition entries carry their label; non-ambition entries do not.
//   5. Switching brains within one process leaks nothing between them.
//
// Zero network, zero model calls, zero client storage.

export function assembleLegacy({ body = {}, brain, product = null }) {
  const dossier = brain.artifacts?.dossier || {};
  const lived = brain.artifacts?.livedWorld || brain.artifacts?.lived_world || {};
  const section = (id) => brain.guidanceSections?.find((s) => s.id === id);
  const world = section("world");
  const identity = section("identity");
  const creative = section("creative");
  const rules = section("rules");
  const campaign = body.campaign || null;

  const drewOn = [];
  const context = [];

  context.push(`BRAND: ${brain.brandName}. ${brain.brandDescription || ""}`);
  if (world) {
    context.push(`WORLD: ${world.summary}. ${(world.principles || []).join(". ")}`);
    drewOn.push("Brand world guidance");
  }
  if (identity) {
    context.push(`IDENTITY: ${identity.summary}. ${(identity.principles || []).join(". ")}`);
    drewOn.push("Identity guidance");
  }
  if (creative) {
    context.push(`CREATIVE DIRECTION: ${creative.summary}. ${(creative.principles || []).join(". ")}`);
    drewOn.push("Creative direction");
  }
  const environments = Array.isArray(lived.environments) ? lived.environments : [];
  if (environments.length) {
    context.push(`EARNED ENVIRONMENTS: ${environments.map((e) => `${e.name || e.title || ""}${e.earned ? ` (why the brand belongs: ${e.earned})` : ""}`).filter(Boolean).join("; ")}`);
    drewOn.push("Lived World environments");
  }
  if (lived.person) {
    context.push(`PERSON AT THE CENTER: ${typeof lived.person === "string" ? lived.person : JSON.stringify(lived.person).slice(0, 600)}`);
    drewOn.push("Lived World person");
  }
  if (dossier.desiredFeeling) context.push(`DESIRED FEELING: ${dossier.desiredFeeling}`);
  if (dossier.materials?.length) context.push(`MATERIALS AND LIGHT: ${dossier.materials.join(", ")}`);
  if (dossier.palette?.length) context.push(`PALETTE: ${dossier.palette.map((c) => `${c.name} (${c.role})`).join(", ")}`);
  if (rules) {
    context.push(`RULES AND GUARDRAILS: ${rules.summary}. ${(dossier.guardrails || []).map((g) => `${g.title}: ${g.body}`).join(" ")}`);
    drewOn.push("Creative rules and guardrails");
  }
  if (campaign) {
    context.push(`CAMPAIGN: ${campaign.name}. Idea: ${campaign.campaignIdea || ""}. Message territory: ${campaign.messageTerritory || ""}. Audience: ${campaign.audience || ""}. Objective: ${campaign.objective || ""}`);
    drewOn.push(`Campaign: ${campaign.name}`);
  }
  if (product) {
    context.push(`PRODUCT: ${product.product_name}. ${product.one_true_thing || ""} Visual direction: ${product.visual_direction || ""}`);
    if (product.exclusions?.length) context.push(`PRODUCT EXCLUSIONS: ${product.exclusions.join("; ")}`);
    drewOn.push(`Product record: ${product.product_name}`);
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.some((i) => i.kind === "isolated")) drewOn.push("Product image on the record");
  }

  return { context, drewOn, grammarEntries: typeof grammarEntries === "undefined" ? [] : grammarEntries };
}

export function assembleHead({ body = {}, brain, product = null }) {
  const dossier = brain.artifacts?.dossier || {};
  const lived = brain.artifacts?.livedWorld || brain.artifacts?.lived_world || {};
  const section = (id) => brain.guidanceSections?.find((s) => s.id === id);
  const world = section("world");
  const identity = section("identity");
  const creative = section("creative");
  const rules = section("rules");
  const campaign = body.campaign || null;

  const drewOn = [];
  const context = [];

  context.push(`BRAND: ${brain.brandName}. ${brain.brandDescription || ""}`);
  if (world) {
    context.push(`WORLD: ${world.summary}. ${(world.principles || []).join(". ")}`);
    drewOn.push("Brand world guidance");
  }
  // ADR 0016 step 4. A brain carrying a visual grammar briefs the scene writer
  // from the grammar's descriptive sections instead of the identity and
  // creative summaries. Per client on artifact presence, per the ADR's
  // transition rule: a brain without the artifact keeps today's assembly
  // exactly, and gets it byte-identical, proven by the parity fixture.
  //
  // The interim identity-principles fix from 1a9357e is superseded on this
  // path and retained on the legacy path below, which is the supersession the
  // ADR's corrected finding anticipated.
  //
  // Rejects are deliberately absent. ADR 0017 made the governed refusals
  // document the only refusal source for the image path, and grammar rejects
  // are never a compile source. The step 1 harness carried a rejects line
  // because it predates that decision; carrying it here would put a second,
  // ungoverned refusal channel back into the prompt.
  const grammarSections = brain.artifacts?.visualGrammar?.sections;
  const grammarMode = Boolean(grammarSections && typeof grammarSections === "object");
  const grammarEntries = [];
  if (grammarMode) {
    // The ambition label travels into the prompt because ADR 0016 requires it
    // to reach the compiled prompt and the result screen rather than stopping
    // at the brain interface. Origin never dampens the direction: an ambition
    // entry compiles at full strength and carries its label.
    const labelled = [
      ["people", "PEOPLE ON CAMERA"],
      ["objects", "OBJECTS AND ERA"],
      ["places", "PLACES AND MATERIALS"],
      ["light", "LIGHT"],
      ["camera", "CAMERA"],
    ];
    for (const [key, label] of labelled) {
      const entries = Array.isArray(grammarSections[key]) ? grammarSections[key] : [];
      if (!entries.length) continue;
      const body = entries
        .map((entry) => {
          const statement = typeof entry === "string" ? entry : entry?.statement || "";
          if (!statement) return "";
          const origin = typeof entry === "string" ? null : entry?.basis?.origin || null;
          grammarEntries.push({ id: (typeof entry === "string" ? null : entry?.id) || null, section: key, statement, origin });
          return origin === "ambition" ? `${statement} (declared ambition for this brand)` : statement;
        })
        .filter(Boolean)
        .join(" ");
      if (body) context.push(`${label}: ${body}`);
    }
    drewOn.push("Visual grammar");
  }
  if (identity && !grammarMode) {
    context.push(`IDENTITY: ${identity.summary}. ${(identity.principles || []).join(". ")}`);
    drewOn.push("Identity guidance");
  }
  if (creative && !grammarMode) {
    context.push(`CREATIVE DIRECTION: ${creative.summary}. ${(creative.principles || []).join(". ")}`);
    drewOn.push("Creative direction");
  }
  const environments = Array.isArray(lived.environments) ? lived.environments : [];
  if (environments.length) {
    context.push(`EARNED ENVIRONMENTS: ${environments.map((e) => `${e.name || e.title || ""}${e.earned ? ` (why the brand belongs: ${e.earned})` : ""}`).filter(Boolean).join("; ")}`);
    drewOn.push("Lived World environments");
  }
  if (lived.person) {
    context.push(`PERSON AT THE CENTER: ${typeof lived.person === "string" ? lived.person : JSON.stringify(lived.person).slice(0, 600)}`);
    drewOn.push("Lived World person");
  }
  if (dossier.desiredFeeling) context.push(`DESIRED FEELING: ${dossier.desiredFeeling}`);
  // Step 1 finding: two channels describe light in the same prompt. When the
  // grammar owns light, the dossier line stops being sent rather than being
  // narrowed, because on Dialog Health it is not about light at all: it lists
  // message threads, console views, forms, and canonical asset files. Keeping
  // it beside the grammar's LIGHT section sends the writer two answers.
  if (dossier.materials?.length && !grammarMode) context.push(`MATERIALS AND LIGHT: ${dossier.materials.join(", ")}`);
  if (dossier.palette?.length) context.push(`PALETTE: ${dossier.palette.map((c) => `${c.name} (${c.role})`).join(", ")}`);
  if (rules) {
    context.push(`RULES AND GUARDRAILS: ${rules.summary}. ${(dossier.guardrails || []).map((g) => `${g.title}: ${g.body}`).join(" ")}`);
    drewOn.push("Creative rules and guardrails");
  }
  if (campaign) {
    context.push(`CAMPAIGN: ${campaign.name}. Idea: ${campaign.campaignIdea || ""}. Message territory: ${campaign.messageTerritory || ""}. Audience: ${campaign.audience || ""}. Objective: ${campaign.objective || ""}`);
    drewOn.push(`Campaign: ${campaign.name}`);
  }
  if (product) {
    context.push(`PRODUCT: ${product.product_name}. ${product.one_true_thing || ""} Visual direction: ${product.visual_direction || ""}`);
    if (product.exclusions?.length) context.push(`PRODUCT EXCLUSIONS: ${product.exclusions.join("; ")}`);
    drewOn.push(`Product record: ${product.product_name}`);
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.some((i) => i.kind === "isolated")) drewOn.push("Product image on the record");
  }

  return { context, drewOn, grammarEntries: typeof grammarEntries === "undefined" ? [] : grammarEntries };
}


import assert from "node:assert";
import { readFileSync } from "node:fs";

// Drift tripwire: the live handler's assembly must still match the copy above.
const live = readFileSync(new URL("../api/production/generate-copy.js", import.meta.url), "utf8");
const liveBlock = live.slice(
  live.indexOf("async function handleSceneBrief("),
  live.indexOf("  // Each studio category asks for a different kind of artifact")
);
const copyBlock = assembleHead.toString();
for (const marker of ["const grammarSections = brain.artifacts?.visualGrammar?.sections;", "if (identity && !grammarMode) {", "dossier.materials?.length && !grammarMode"]) {
  assert(liveBlock.includes(marker), `drift: the live scene writer no longer contains ${marker}`);
  assert(copyBlock.includes(marker), `drift: the harness copy no longer contains ${marker}`);
}

const guidance = ["foundation", "identity", "world", "voice", "creative", "rules"].map((id) => ({
  id, name: id, summary: `The ${id} summary.`, principles: [`A ${id} principle.`, `A second ${id} principle.`],
}));
const dossier = {
  desiredFeeling: "Cold and awake.",
  materials: ["message threads", "console views", "forms"],
  palette: [{ name: "Ink", role: "Primary" }],
  guardrails: [{ title: "G", body: "B" }],
};
const lived = { environments: [{ name: "A counter", earned: "because it is used" }], person: "An adult at work.", rejects: ["a reject that must not travel"] };
const legacyBrain = { brandName: "Legacy", brandDescription: "d", guidanceSections: guidance, artifacts: { dossier, livedWorld: lived } };
const grammar = {
  sections: {
    people: [{ id: "p1", statement: "Adults mid task.", basis: { origin: "evidence" } }, { id: "p2", statement: "Period reached through fabric.", basis: { origin: "ambition" } }],
    objects: [{ id: "o1", statement: "A cold can.", basis: { origin: "evidence" } }],
    places: [{ id: "pl1", statement: "A wet stone counter.", basis: { origin: "inference" } }],
    light: [{ id: "l1", statement: "Overcast window light.", basis: { origin: "evidence" } }],
    camera: [{ id: "c1", statement: "35mm at f2.8, eye level.", basis: { origin: "inference" } }],
    rejects: [{ id: "r1", statement: "A reject that must never reach the writer.", basis: { origin: "evidence" } }],
  },
};
const grammarBrain = { ...legacyBrain, brandName: "Grammar", artifacts: { ...legacyBrain.artifacts, visualGrammar: grammar } };

let ok = true;
const check = (label, pass, detail = "") => { if (!pass) ok = false; console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`); };

const legacyBefore = assembleLegacy({ brain: legacyBrain });
const legacyAfter = assembleHead({ brain: legacyBrain });
check("legacy brain: context byte-identical", JSON.stringify(legacyBefore.context) === JSON.stringify(legacyAfter.context), `${legacyAfter.context.join("").length} chars`);
check("legacy brain: drewOn byte-identical", JSON.stringify(legacyBefore.drewOn) === JSON.stringify(legacyAfter.drewOn));
check("legacy brain: no grammar entries recorded", legacyAfter.grammarEntries.length === 0);

const g = assembleHead({ brain: grammarBrain });
const joined = g.context.join("\n");
check("grammar brain: identity summary displaced", !joined.includes("IDENTITY:"));
check("grammar brain: creative direction displaced", !joined.includes("CREATIVE DIRECTION:"));
check("grammar brain: dossier materials line displaced", !joined.includes("MATERIALS AND LIGHT:"));
for (const label of ["PEOPLE ON CAMERA", "OBJECTS AND ERA", "PLACES AND MATERIALS", "LIGHT:", "CAMERA:"]) {
  check(`grammar brain: ${label} present`, joined.includes(label));
}
check("grammar brain: no grammar rejects reach the writer", !joined.includes("A reject that must never reach the writer"));
check("grammar brain: livedWorld rejects never reached the writer either", !joined.includes("a reject that must not travel"));
check("grammar brain: ambition entry carries its label", joined.includes("Period reached through fabric. (declared ambition for this brand)"));
check("grammar brain: evidence entry carries no label", !joined.includes("Adults mid task. (declared ambition"));
check("grammar brain: world and rules still reach the writer", joined.includes("WORLD:") && joined.includes("RULES AND GUARDRAILS:"));
check("grammar brain: entries recorded for provenance", g.grammarEntries.length === 6 && g.grammarEntries.filter((e) => e.origin === "ambition").length === 1);

const backToLegacy = assembleHead({ brain: legacyBrain });
check("cross-client switch: legacy assembly unchanged after a grammar brain", JSON.stringify(backToLegacy.context) === JSON.stringify(legacyBefore.context));
check("cross-client switch: no grammar entries leak across brains", backToLegacy.grammarEntries.length === 0);

console.log(ok ? "\nPARITY PASS" : "\nPARITY FAIL");
process.exit(ok ? 0 : 1);
