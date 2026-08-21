import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSynthesisRequest,
  collectChatCompletionStream,
  extractChatCompletionText,
} from "../src/brand-brain/chat-completions-provider.js";
import { MAX_SOURCE_FILE_BYTES, normalizeSourcesForSynthesis, normalizeUploadedFile } from "../src/brand-brain/source-normalizer.js";
import { synthesizeBrandBrain } from "../src/brand-brain/service.js";
import {
  OPENAI_IMAGE_EDITS_ENDPOINT,
  OPENAI_IMAGE_GENERATIONS_ENDPOINT,
  buildOpenAIImageEditRequest,
  buildOpenAIImageGenerationRequest,
  chooseOpenAIImageEndpoint,
} from "../src/renderers/openai-images.js";
import { assertSafeRemoteUrl, mergeIncrementalSources, selectApprovedBaseline } from "../scripts/dev-server.js";

test("Chat Completions synthesis preserves authority, normalized document text, and image evidence", () => {
  const request = buildSynthesisRequest([
    {
      id: "approved-guidance",
      name: "Approved strategy",
      type: "Files",
      detail: "strategy.pdf and logo.png",
      authority: "approved-guidance",
      role: "Brand foundation",
      influence: "Not weighted",
      usage: "Follow the signed-off positioning.",
      exclusions: "Ignore workshop alternatives.",
      content: "SOURCE FILE: strategy.pdf\nApproved positioning text.",
      extractedFiles: [{ kind: "text", name: "strategy.pdf", type: "application/pdf", size: 12 }],
      files: [{ kind: "image", name: "logo.png", type: "image/png", size: 12, data: "data:image/png;base64,AAAA" }],
    },
  ]);

  assert.equal(request.model, "gpt-5.6");
  assert.equal(request.store, false);
  assert.equal(request.stream, true);
  assert.deepEqual(request.stream_options, { include_usage: true });
  assert.equal(request.response_format.type, "json_schema");
  assert.equal(request.response_format.json_schema.strict, true);
  const content = request.messages[1].content;
  assert.match(content[0].text, /approved-guidance/);
  assert.match(content[0].text, /declaredMaterialType/);
  assert.match(content[0].text, /Follow the signed-off positioning/);
  assert.match(content[0].text, /Approved positioning text/);
  assert.deepEqual(content[1], {
    type: "image_url",
    image_url: { url: "data:image/png;base64,AAAA", detail: "high" },
  });
  assert.doesNotMatch(JSON.stringify(request), /input_file|input_text|text\.format/);
});

test("incremental synthesis pins the approved baseline and isolates new source evidence", () => {
  const baseline = { brandName: "SLAKE", synthesisSummary: "Approved and active", guidanceSections: [] };
  const request = buildSynthesisRequest(
    [
      {
        id: "new-retail-brief",
        name: "Retail briefing",
        type: "Other business document",
        materialType: "business-document",
        declaredType: "Other business document",
        authority: "brand-evidence",
        role: "Brand foundation",
        influence: "Supporting",
        usage: "Use only as company background.",
        exclusions: "Do not treat growth targets as brand guidance.",
        content: "Expansion timing and operating context.",
      },
    ],
    { baseline, baselineVersion: 3 },
  );

  const prompt = request.messages[1].content[0].text;
  assert.match(prompt, /smallest supported update/);
  assert.match(prompt, /approved version 3/);
  assert.match(prompt, /Copy every unaffected field/);
  assert.match(prompt, /earlier review questions are already resolved/);
  assert.match(prompt, /Retail briefing/);
  assert.match(prompt, /Approved and active/);
});

test("raw Chat Completions JSON is extracted without an SDK helper", () => {
  const output = extractChatCompletionText({
    choices: [{ message: { role: "assistant", content: "{\"brandName\":\"SLAKE\"}" } }],
  });
  assert.equal(output, '{"brandName":"SLAKE"}');
});

test("streamed Chat Completions output is reassembled with usage metadata", async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"id":"chatcmpl_live","model":"gpt-5.6","choices":[{"delta":{"content":"{\\"brand"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"id":"chatcmpl_live","model":"gpt-5.6","choices":[{"delta":{"content":"Name\\":\\"Fallow\\"}"}}]}\r\n\r\n'));
      controller.enqueue(encoder.encode('data: {"id":"chatcmpl_live","model":"gpt-5.6","choices":[],"usage":{"total_tokens":42}}\n\ndata: [DONE]\n\n'));
      controller.close();
    },
  });

  const completion = await collectChatCompletionStream(stream);
  assert.equal(completion.id, "chatcmpl_live");
  assert.equal(completion.model, "gpt-5.6");
  assert.equal(completion.choices[0].message.content, '{"brandName":"Fallow"}');
  assert.deepEqual(completion.usage, { total_tokens: 42 });
});

test("plain-text uploads are normalized before they reach synthesis", async () => {
  const data = `data:text/plain;base64,${Buffer.from("Approved: make ordinary moments feel considered.").toString("base64")}`;
  const [source] = await normalizeSourcesForSynthesis([
    { id: "note", name: "Approved note", content: "", files: [{ name: "note.txt", type: "text/plain", size: 48, data }] },
  ]);
  assert.match(source.content, /Approved: make ordinary moments feel considered/);
  assert.equal(source.files.length, 0);
  assert.equal(source.extractedFiles[0].kind, "text");
});

test("approved guidance can use a supported raster image as visual evidence", async () => {
  const data = `data:image/png;base64,${Buffer.from("brand-book-page").toString("base64")}`;
  const [source] = await normalizeSourcesForSynthesis([
    {
      id: "approved-brand-book-page",
      materialType: "approved-guidance",
      authority: "approved-guidance",
      files: [{ name: "brand-book-page.png", type: "image/png", size: 15, data }],
    },
  ]);

  assert.equal(source.files.length, 1);
  assert.equal(source.files[0].kind, "image");
  assert.equal(source.files[0].type, "image/png");
});

test("hosted source files are read from private storage before synthesis", async () => {
  const text = "Approved positioning from durable private storage.";
  const file = await normalizeUploadedFile(
    { name: "guidance.txt", type: "text/plain", size: Buffer.byteLength(text), blobPathname: "brand-world-system/sources/guidance.txt" },
    { authority: "approved-guidance" },
    {
      async readStoredFile(pathname) {
        assert.equal(pathname, "brand-world-system/sources/guidance.txt");
        return { bytes: Buffer.from(text), mimeType: "text/plain", size: Buffer.byteLength(text) };
      },
    },
  );
  assert.equal(file.kind, "text");
  assert.match(file.text, /durable private storage/);
});

test("portable document parsing does not depend on macOS metadata tools", async () => {
  const bytes = Buffer.from("{\\rtf1\\ansi Approved brand direction.}");
  const file = await normalizeUploadedFile(
    { name: "guidance.rtf", type: "application/rtf", size: bytes.length, data: `data:application/rtf;base64,${bytes.toString("base64")}` },
    { authority: "approved-guidance" },
  );
  assert.equal(file.kind, "text");
  assert.match(file.text, /Approved brand direction/);
});

test("the shared Brand Brain service writes the same durable result used by local and hosted APIs", async () => {
  let stored = null;
  const store = {
    async read() {
      return stored;
    },
    async write(value) {
      stored = value;
    },
  };
  const result = await synthesizeBrandBrain(
    {
      mode: "initial",
      requestId: "synthesis-recovery-test",
      sources: [
        {
          id: "approved-note",
          name: "Approved note",
          authority: "approved-guidance",
          content: "Make ordinary moments feel considered.",
          files: [],
        },
      ],
    },
    {
      store,
      env: { OPENAI_API_KEY: "test-only" },
      async synthesize({ sources }) {
        assert.match(sources[0].content, /ordinary moments/);
        return { result: { brandName: "Fallow" }, responseId: "chatcmpl-test", model: "gpt-5.6", usage: null };
      },
    },
  );
  assert.equal(result.result.brandName, "Fallow");
  assert.equal(stored.responseId, "chatcmpl-test");
  assert.equal(stored.sources[0].id, "approved-note");
  assert.equal(stored.synthesisRequestId, "synthesis-recovery-test");
});

test("protected unsupported files remain exact metadata and source size limits are enforced", async () => {
  const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>').toString("base64")}`;
  const [source] = await normalizeSourcesForSynthesis([
    {
      id: "protected-logo",
      authority: "exact-asset",
      files: [{ name: "wordmark.svg", type: "image/svg+xml", size: 72, data: svg }],
    },
  ]);
  assert.equal(source.files.length, 0);
  assert.equal(source.extractedFiles[0].kind, "metadata");
  assert.match(source.extractedFiles[0].note, /preserved as supplied/);

  await assert.rejects(
    () => normalizeUploadedFile({ name: "oversized.pdf", type: "application/pdf", size: MAX_SOURCE_FILE_BYTES + 1 }),
    /larger than the 20 MB source limit/,
  );
});

test("OpenAI image routing preserves the compiled prompt exactly", () => {
  const prompt = "STYLE ANCHOR\nExact tuned fragment; preserve punctuation and spacing.";
  const generation = buildOpenAIImageGenerationRequest({ prompt });
  assert.equal(generation.endpoint, OPENAI_IMAGE_GENERATIONS_ENDPOINT);
  assert.equal(generation.body.prompt, prompt);
  assert.equal(chooseOpenAIImageEndpoint([]), OPENAI_IMAGE_GENERATIONS_ENDPOINT);

  const edit = buildOpenAIImageEditRequest({
    prompt,
    referenceImages: [{ name: "canonical.png", type: "image/png", data: "data:image/png;base64,AAAA" }],
  });
  assert.equal(edit.endpoint, OPENAI_IMAGE_EDITS_ENDPOINT);
  assert.equal(edit.body.get("prompt"), prompt);
  assert.equal(chooseOpenAIImageEndpoint([{ name: "canonical.png" }]), OPENAI_IMAGE_EDITS_ENDPOINT);
});

test("URL intake rejects local and private network targets", async () => {
  await assert.rejects(() => assertSafeRemoteUrl("http://127.0.0.1:4173/private"), /Private network URLs/);
  await assert.rejects(() => assertSafeRemoteUrl("http://localhost:4173/private"), /Local network URLs/);
});

test("incremental synthesis keeps the stored approved baseline and merges only new source records", () => {
  const baseline = { brandName: "SLAKE", guidanceSections: [{ id: "foundation", summary: "Approved" }] };
  const stored = {
    result: { brandName: "Candidate" },
    approvedResult: baseline,
    brain: { artifactStatus: "draft" },
  };
  assert.deepEqual(selectApprovedBaseline(stored), baseline);

  const merged = mergeIncrementalSources(
    [
      { id: "approved-source", name: "Approved source" },
      { id: "replaced-source", name: "Old record" },
    ],
    [
      { id: "replaced-source", name: "Updated record" },
      { id: "new-source", name: "New source" },
    ],
  );
  assert.deepEqual(merged.map((source) => source.name), ["Approved source", "Updated record", "New source"]);
});
