import assert from "node:assert/strict";
import test from "node:test";
import { getCopyType, listCopyTypes, defaultCopyOutputsForPlacement } from "../src/copy/types.js";
import { produceCopy } from "../src/copy/generate.js";

const claimsSet = { approved: [], prohibited: [], disclosures: [] };
const brain = {
  brandName: "Slake",
  guidanceSections: [{ id: "voice", name: "Voice", summary: "Plain", principles: [] }],
  artifacts: { dossier: {} },
};

function stubModel(content) {
  return async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
}

test("the catalog gained a second entry without new generation code", () => {
  const type = getCopyType("headline_set");
  assert.equal(type.structured, true);
  assert.deepEqual(type.fields.map((f) => f.id), ["headline", "subhead", "cta"]);
  assert.equal(listCopyTypes().length, 2);
});

test("a headline set is off by default everywhere, including social", () => {
  assert.deepEqual(defaultCopyOutputsForPlacement("LinkedIn feed"), ["social_caption"]);
  assert.deepEqual(defaultCopyOutputsForPlacement("Sales enablement"), []);
});

test("a structured type returns labelled fields and a joined text for audit", async () => {
  const block = await produceCopy({
    copyTypeId: "headline_set",
    brain,
    claimsSet,
    context: { placement: "Sales enablement", copyDirection: "reduce no-shows" },
    apiKey: "unused",
    fetchImpl: stubModel('{"headline":"Fewer empty chairs","subhead":"Reminders that reach patients where they already are.","cta":"See how it works"}'),
  });
  assert.deepEqual(block.fields.map((f) => f.text), [
    "Fewer empty chairs",
    "Reminders that reach patients where they already are.",
    "See how it works",
  ]);
  assert.equal(block.fields[0].label, "Headline");
  assert.match(block.text, /Fewer empty chairs/);
  assert.match(block.text, /See how it works/);
});

test("a fenced JSON response is still parsed", async () => {
  const block = await produceCopy({
    copyTypeId: "headline_set",
    brain,
    claimsSet,
    context: { placement: "Sales enablement" },
    apiKey: "unused",
    fetchImpl: stubModel('```json\n{"headline":"A","subhead":"B","cta":"C"}\n```'),
  });
  assert.deepEqual(block.fields.map((f) => f.text), ["A", "B", "C"]);
});

test("a missing field comes back empty rather than absent", async () => {
  const block = await produceCopy({
    copyTypeId: "headline_set",
    brain,
    claimsSet,
    context: { placement: "Sales enablement" },
    apiKey: "unused",
    fetchImpl: stubModel('{"headline":"Only this one"}'),
  });
  assert.equal(block.fields.length, 3);
  assert.equal(block.fields[1].text, "");
  assert.equal(block.fields[2].text, "");
});

test("an unreadable structured response fails rather than producing a block", async () => {
  await assert.rejects(
    produceCopy({
      copyTypeId: "headline_set",
      brain,
      claimsSet,
      context: { placement: "Sales enablement" },
      apiKey: "unused",
      fetchImpl: stubModel("Here are some ideas for your headline!"),
    }),
    /could not read/,
  );
});

test("a field over its word limit is flagged without failing the job", async () => {
  const block = await produceCopy({
    copyTypeId: "headline_set",
    brain,
    claimsSet,
    context: { placement: "Sales enablement" },
    apiKey: "unused",
    fetchImpl: stubModel('{"headline":"One two three four five six seven eight nine ten eleven twelve","subhead":"Short","cta":"Go"}'),
  });
  assert.equal(block.fields[0].overLength, true);
  assert.equal(block.fields[1].overLength, false);
});

test("the prose check runs on display copy too", async () => {
  const block = await produceCopy({
    copyTypeId: "headline_set",
    brain,
    claimsSet,
    context: { placement: "Sales enablement" },
    apiKey: "unused",
    fetchImpl: stubModel('{"headline":"Simple, straightforward messaging","subhead":"Built for teams that move.","cta":"Start now"}'),
  });
  const prose = block.audit.findings.filter((f) => f.kind === "prose");
  assert.equal(prose.length, 1);
  assert.match(prose[0].rule, /straightforward/);
});

test("an unstructured type is unaffected and returns no fields", async () => {
  const block = await produceCopy({
    copyTypeId: "social_caption",
    brain,
    claimsSet,
    context: { placement: "LinkedIn feed" },
    apiKey: "unused",
    fetchImpl: stubModel("A plain caption that is not JSON at all."),
  });
  assert.equal(block.fields, null);
  assert.equal(block.text, "A plain caption that is not JSON at all.");
});

test("findings name the field they landed on", async () => {
  const originalFetch = globalThis.fetch;
  // The audit call goes through global fetch; the generation call is stubbed.
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify([
            { sentence: "We are the only platform that works", classification: "unapproved", match: null, reason: "Comparative claim." },
          ]),
        },
      }],
    }),
  });
  try {
    const block = await produceCopy({
      copyTypeId: "headline_set",
      brain,
      claimsSet: { approved: [{ text: "Reduces no-shows", source: "Product" }], prohibited: [], disclosures: [] },
      context: { placement: "Sales enablement" },
      apiKey: "unused",
      fetchImpl: stubModel('{"headline":"We are the only platform that works","subhead":"Short line.","cta":"Go"}'),
    });
    const finding = block.audit.findings.find((f) => f.kind === "unapproved");
    assert.equal(finding.field, "Headline");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
