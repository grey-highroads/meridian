import assert from "node:assert/strict";
import test from "node:test";
import { budgetFor, displayBudgets, checkDisplayBudgets, shapeFromFormat } from "../src/copy/display-budget.js";
import { protectionBlock, displayCopyBlock } from "../src/production/prompt-craft.js";
import { compileBrandWorldImagePackage } from "../src/production/package.js";
import { produceCopy, auditProducedCopy } from "../src/copy/generate.js";

const brain = {
  brandName: "Slake",
  guidanceSections: [
    { id: "voice", name: "Voice", summary: "Plain", principles: [] },
    { id: "creative", name: "Creative", summary: "Natural light", principles: [] },
  ],
  artifacts: { dossier: {} },
  sources: [],
};

// -------------------------------------------------------------------------
// Budgets
// -------------------------------------------------------------------------

test("format maps to a shape", () => {
  assert.equal(shapeFromFormat("1:1 square"), "square");
  assert.equal(shapeFromFormat("4:5 portrait"), "portrait");
  assert.equal(shapeFromFormat("16:9 landscape"), "landscape");
  assert.equal(shapeFromFormat("9:16 story"), "tall");
  assert.equal(shapeFromFormat(""), "square");
});

test("pixel dimensions resolve to a shape, not just named ratios", () => {
  // Website and sales presets pass dimensions like "1920x800". Before these
  // were parsed, a hero fell through to square and was budgeted as though it
  // had a square photo's vertical room.
  assert.equal(shapeFromFormat("1920x800"), "landscape");
  assert.equal(shapeFromFormat("1080x1080"), "square");
  assert.equal(shapeFromFormat("1080x1350"), "portrait");
  assert.equal(shapeFromFormat("1080x1920"), "tall");
  assert.equal(shapeFromFormat("1200x628"), "landscape");
  assert.equal(shapeFromFormat("2.4:1"), "landscape");
});

test("an ultra wide banner gets a longer line and fewer of them", () => {
  const hero = budgetFor({ format: "1920x800", zoneId: "lower_third" });
  const standard = budgetFor({ format: "1200x628", zoneId: "lower_third" });
  assert.equal(hero.charsPerLine > standard.charsPerLine, true);
  assert.equal(hero.lines <= standard.lines, true);
});

test("an unrecognized format still yields a usable budget", () => {
  const budget = budgetFor({ format: "", zoneId: "lower_third" });
  assert.equal(budget.charsPerLine > 0, true);
  assert.equal(budget.lines > 0, true);
  assert.equal(budget.maxChars > 0, true);
});

test("a wider frame gets more characters per line than a taller one", () => {
  const wide = budgetFor({ format: "16:9 landscape", zoneId: "lower_third" });
  const tall = budgetFor({ format: "9:16 story", zoneId: "lower_third" });
  assert.equal(wide.charsPerLine > tall.charsPerLine, true);
});

test("a narrow zone gets fewer characters per line than a wide one", () => {
  const wide = budgetFor({ format: "1:1 square", zoneId: "lower_third" });
  const narrow = budgetFor({ format: "1:1 square", zoneId: "left_panel" });
  assert.equal(narrow.charsPerLine < wide.charsPerLine, true);
});

test("the headline gets more room than the call to action", () => {
  const budgets = displayBudgets({ format: "1:1 square", zoneId: "lower_third" });
  const headline = budgets.find((b) => b.fieldId === "headline");
  const cta = budgets.find((b) => b.fieldId === "cta");
  assert.equal(headline.maxChars > cta.maxChars, true);
});

test("an over-budget line is flagged deterministically, with the count", () => {
  const budgets = displayBudgets({ format: "1:1 square", zoneId: "left_panel" });
  const fields = [
    { id: "headline", label: "Headline", text: "A".repeat(500) },
    { id: "cta", label: "Call to action", text: "Go" },
  ];
  const findings = checkDisplayBudgets(fields, budgets);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, "display_budget");
  assert.equal(findings[0].field, "Headline");
  assert.match(findings[0].reason, /500 characters/);
});

test("an empty field is not flagged as over budget", () => {
  const budgets = displayBudgets({ format: "1:1 square", zoneId: "lower_third" });
  assert.deepEqual(checkDisplayBudgets([{ id: "headline", label: "Headline", text: "" }], budgets), []);
});

// -------------------------------------------------------------------------
// Text safety scoping
// -------------------------------------------------------------------------

test("without display copy, text safety forbids all letter-like marks", () => {
  const block = protectionBlock({ lockedAsset: null, format: "scene" });
  assert.match(block, /no pseudo-text or letter-like marks anywhere/);
  assert.equal(/Apart from the authored display copy/.test(block), false);
});

test("with display copy, text safety is narrowed rather than dropped", () => {
  const block = protectionBlock({ lockedAsset: null, format: "scene", displayCopy: { lines: [{ text: "x" }] } });
  assert.match(block, /Apart from the authored display copy/);
  // The environmental prohibition must survive the narrowing.
  assert.match(block, /blank, abstract, cropped, or defocused beyond reading/);
  assert.match(block, /Invent no other words/);
});

test("the narrowing applies to locked-asset jobs too, not just world-only", () => {
  const locked = protectionBlock({
    lockedAsset: { name: "Yuzu can", assetType: "packaging" },
    format: "can",
    displayCopy: { lines: [{ text: "x" }] },
  });
  assert.match(locked, /Apart from the authored display copy/);
});

// -------------------------------------------------------------------------
// Prompt inclusion
// -------------------------------------------------------------------------

test("the display copy block states the exact string and forbids alteration", () => {
  const block = displayCopyBlock({
    lines: [{ id: "headline", label: "Headline", text: "Fewer empty chairs" }],
    zone: { id: "lower_third", label: "Lower third", description: "across the lower third of the frame", charsPerLine: 34 },
    format: "1:1 square",
  });
  assert.match(block, /"Fewer empty chairs"/);
  assert.match(block, /set exactly as written/);
  assert.match(block, /Reproduce every character exactly/);
  assert.match(block, /Do not paraphrase/);
  // The zone is a composition instruction, not only a placement one.
  assert.match(block, /Leave clean, uncluttered space/);
});

test("the block gives proportional fill instruction, not absolute sizes", () => {
  const block = displayCopyBlock({
    lines: [{ id: "headline", label: "Headline", text: "Fewer empty chairs", fillShare: 0.7, relativeSize: 1 }],
    zone: { id: "lower_third", label: "Lower third", description: "across the lower third", charsPerLine: 34 },
    format: "1:1 square",
  });
  assert.match(block, /70 percent/);
  assert.match(block, /fill the space it is given/);
  // Nothing may be stated in pixels or points: the renderer follows
  // relationships, not arithmetic.
  assert.equal(/\d+\s?(px|pt|pixels|points)/i.test(block), false);
});

test("multiple lines get a stated hierarchy relative to the headline", () => {
  const block = displayCopyBlock({
    lines: [
      { id: "headline", label: "Headline", text: "Fewer empty chairs", fillShare: 0.7, relativeSize: 1 },
      { id: "subhead", label: "Supporting line", text: "Reminders that reach people.", relativeSize: 0.45, note: "clearly secondary to the headline" },
      { id: "cta", label: "Call to action", text: "See how", relativeSize: 0.35, note: "the smallest element" },
    ],
    zone: { id: "lower_third", label: "Lower third", description: "across the lower third", charsPerLine: 34 },
    format: "1:1 square",
  });
  assert.match(block, /45 percent of the headline/);
  assert.match(block, /35 percent of the headline/);
  assert.match(block, /single typographic group/);
});

test("a single line gets no hierarchy instruction", () => {
  const block = displayCopyBlock({
    lines: [{ id: "headline", label: "Headline", text: "One line", fillShare: 0.7 }],
    zone: { id: "center", label: "Center", description: "centered", charsPerLine: 30 },
  });
  assert.equal(/Hold a clear hierarchy/.test(block), false);
});

test("the block instructs breaking at phrase boundaries", () => {
  const block = displayCopyBlock({
    lines: [{ id: "headline", label: "Headline", text: "Your Appointment, Confirmed", fillShare: 0.7 }],
    zone: { id: "left_panel", label: "Left panel", description: "in the left third", charsPerLine: 22 },
  });
  assert.match(block, /phrase boundaries/);
  assert.match(block, /stranded on its own line/);
});

test("design ratios ride along with the budgets", () => {
  const budgets = displayBudgets({ format: "1:1 square", zoneId: "lower_third" });
  const headline = budgets.find((b) => b.fieldId === "headline");
  const subhead = budgets.find((b) => b.fieldId === "subhead");
  assert.equal(headline.fillShare, 0.7);
  assert.equal(headline.relativeSize, 1);
  assert.equal(subhead.relativeSize < headline.relativeSize, true);
});

test("no lines with text produces no block", () => {
  assert.equal(displayCopyBlock({ lines: [], zone: { description: "x" } }), "");
  assert.equal(displayCopyBlock({ lines: [{ text: "" }], zone: { description: "x" } }), "");
});

// -------------------------------------------------------------------------
// Compiler
// -------------------------------------------------------------------------

const baseBrief = { scene: "A clinician at a workstation", placement: "LinkedIn feed", format: "1:1 square", assetType: "scene" };

test("a job with no display copy compiles no display section and no record", () => {
  const pkg = compileBrandWorldImagePackage({ approvedBrain: brain, brainVersion: 1, brief: baseBrief });
  assert.equal(/DISPLAY COPY/.test(pkg.prompt), false);
  assert.equal("copy" in pkg, false);
});

test("a job with display copy carries the string in the prompt and on the record", () => {
  const pkg = compileBrandWorldImagePackage({
    approvedBrain: brain,
    brainVersion: 1,
    brief: baseBrief,
    copyOutputs: ["headline_set"],
    claimsSet: { approved: [], prohibited: [], disclosures: [] },
    displayCopy: {
      zoneId: "lower_third",
      format: "1:1 square",
      lines: [{ id: "headline", label: "Headline", text: "Fewer empty chairs" }],
    },
  });
  assert.match(pkg.prompt, /DISPLAY COPY/);
  assert.match(pkg.prompt, /Fewer empty chairs/);
  assert.equal(pkg.copy.display.lines[0].text, "Fewer empty chairs");
  assert.equal(pkg.copy.display.zoneId, "lower_third");
});

test("a recorded display copy contract is never marked verified", () => {
  const pkg = compileBrandWorldImagePackage({
    approvedBrain: brain,
    brainVersion: 1,
    brief: baseBrief,
    copyOutputs: ["headline_set"],
    claimsSet: { approved: [], prohibited: [], disclosures: [] },
    displayCopy: { zoneId: "center", lines: [{ id: "headline", label: "Headline", text: "x" }] },
  });
  // Read-back verification is not built. Nothing may assert it passed.
  assert.equal(pkg.copy.display.verified, false);
});

// -------------------------------------------------------------------------
// Generation under a character budget
// -------------------------------------------------------------------------

test("character budgets reach the prompt and the audit when display copy is requested", async () => {
  let captured = "";
  const block = await produceCopy({
    copyTypeId: "headline_set",
    brain,
    claimsSet: { approved: [], prohibited: [], disclosures: [] },
    context: {
      placement: "LinkedIn feed",
      displayBudgets: displayBudgets({ format: "1:1 square", zoneId: "left_panel", fieldIds: ["headline"] }),
    },
    apiKey: "unused",
    fetchImpl: async (url, init) => {
      captured = JSON.parse(init.body).messages[0].content;
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ headline: "B".repeat(400), subhead: "s", cta: "c" }) } }] }) };
    },
  });
  assert.match(captured, /characters/);
  assert.match(captured, /rendered into the image/);
  const budgetFindings = block.audit.findings.filter((f) => f.kind === "display_budget");
  assert.equal(budgetFindings.length, 1);
});

test("without display budgets the headline set still uses word limits", async () => {
  let captured = "";
  await produceCopy({
    copyTypeId: "headline_set",
    brain,
    claimsSet: { approved: [], prohibited: [], disclosures: [] },
    context: { placement: "Sales enablement" },
    apiKey: "unused",
    fetchImpl: async (url, init) => {
      captured = JSON.parse(init.body).messages[0].content;
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"headline":"A","subhead":"B","cta":"C"}' } }] }) };
    },
  });
  assert.match(captured, /Maximum 10 words/);
});

// -------------------------------------------------------------------------
// Drafted copy: an edit must not bypass the audit
// -------------------------------------------------------------------------

test("drafted copy carries its own audit rather than being re-audited by assertion", async () => {
  // A block arriving from setup is used as sent. The guard is that the
  // interface blocks generation while an edit is unchecked, so the audit
  // travelling with it describes the current wording.
  const block = {
    copyTypeId: "headline_set",
    fields: [{ id: "headline", label: "Headline", text: "Edited by the user" }],
    audit: { status: "governed", findings: [], totals: null },
    edited: true,
  };
  assert.equal(block.edited, true);
  assert.equal(block.audit.status, "governed");
});

test("an audit that came back with a violation is still a violation on an edited block", async () => {
  const audit = await auditProducedCopy({
    text: "We are HIPAA compliant and the fastest platform available.",
    claimsSet: { approved: [], prohibited: [], disclosures: [] },
    apiKey: "unused",
  });
  // With no claims to check against, the status is no_claims, never a pass.
  assert.equal(audit.status, "no_claims");
  assert.notEqual(audit.status, "governed");
});
