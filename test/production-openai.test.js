import assert from "node:assert/strict";
import test from "node:test";
import { OPENAI_IMAGE_EDITS_ENDPOINT, OPENAI_IMAGE_GENERATIONS_ENDPOINT } from "../src/renderers/openai-images.js";
import { compileBrandWorldImagePackage } from "../src/production/package.js";
import { generateProductionImage, prepareProductionPackage } from "../src/production/service.js";

function approvedBrain() {
  const section = (id, name) => ({
    id,
    name,
    summary: `${name} summary from approved guidance.`,
    principles: [`Follow ${name.toLowerCase()} deliberately`],
    productionUse: `Use the approved ${name.toLowerCase()} direction.`,
  });
  return {
    brandName: "Fallow",
    brandDescription: "A quiet home goods brand",
    synthesisSummary: "Make ordinary domestic moments feel considered.",
    guidanceSections: [
      section("foundation", "Brand foundation"),
      section("identity", "Identity"),
      section("world", "World and story"),
      section("voice", "Voice and messaging"),
      section("creative", "Creative direction"),
      section("rules", "Creative rules"),
    ],
    artifacts: {
      dossier: {
        readBody: "Fallow finds character in useful, lived-in rooms.",
        audience: "People who value useful objects and unforced beauty.",
        desiredFeeling: "Calm, observant, and at home.",
        palette: [{ name: "Clay", role: "Warmth", color: "#A36F54" }],
        materials: ["Worn oak", "Washed linen", "Soft daylight"],
        guardrails: [{ title: "Never pristine", body: "The world should show real use." }],
      },
    },
  };
}

function brief() {
  return {
    scene: "A person arranging flowers at a worn kitchen table in morning light.",
    exclusions: "No showroom polish or readable copy.",
    placement: "Instagram feed",
    format: "4:5 portrait",
  };
}

test("the brand world package is deterministic and preserves the approved Brain version", () => {
  const input = { approvedBrain: approvedBrain(), brainVersion: 4, brief: brief(), references: [] };
  const first = compileBrandWorldImagePackage(input);
  const second = compileBrandWorldImagePackage(input);
  assert.deepEqual(first, second);
  assert.equal(first.brainVersion, 4);
  assert.equal(first.output.size, "1024x1280");
  assert.match(first.prompt, /Fallow finds character in useful, lived-in rooms/);
  assert.match(first.prompt, /A person arranging flowers/);
  assert.match(first.prompt, /No showroom polish/);
  assert.doesNotMatch(first.prompt, /SLAKE|Yuzu Ginger|4pm Reset/);
});

test("production uses Images edits for selected source images and saves a recoverable job", async () => {
  let savedJob = null;
  let renderCalls = 0;
  const storedBrain = {
    approvedResult: approvedBrain(),
    brain: { approvedVersion: 4, artifactStatus: "ready" },
    sources: [
      {
        id: "source-grid-123",
        name: "Material moodboard",
        authority: "creative-reference",
        usage: "Use the material contrast, not the objects.",
        exclusions: "Do not copy the room.",
        files: [{ name: "grid.png", type: "image/png", blobPathname: "brand-world-system/sources/grid.png" }],
      },
    ],
  };
  const brainStore = {
    async read() { return storedBrain; },
    async readSourceFile(pathname) {
      assert.equal(pathname, "brand-world-system/sources/grid.png");
      return { bytes: Buffer.from("reference"), mimeType: "image/png" };
    },
  };
  const productionStore = {
    async read() { return savedJob; },
    async write(value) { savedJob = value; },
    async writeImage(jobId, bytes) {
      assert.equal(jobId, "render-test-1234");
      assert.equal(bytes.toString(), "rendered-image");
      return { pathname: `production/${jobId}.png`, contentType: "image/png" };
    },
    async imageUrl(pathname) { return `https://private.example/${pathname}?signed=1`; },
  };
  const body = {
    jobId: "render-test-1234",
    brief: brief(),
    references: [{ id: "source-grid-123", role: "Materials", influence: "Strong", usageInstruction: "Use the rough and soft material contrast." }],
  };

  const preflight = await prepareProductionPackage(body, { brainStore });
  assert.match(preflight.generationPackage.prompt, /Material moodboard/);
  assert.match(preflight.generationPackage.prompt, /rough and soft material contrast/);

  const job = await generateProductionImage(body, {
    brainStore,
    productionStore,
    env: { OPENAI_API_KEY: "test-only" },
    async render(request) {
      renderCalls += 1;
      assert.equal(request.prompt, preflight.generationPackage.prompt);
      assert.equal(request.referenceImages.length, 1);
      assert.equal(request.quality, "medium");
      return { data: [{ b64_json: Buffer.from("rendered-image").toString("base64") }], usage: { total_tokens: 22 } };
    },
  });

  assert.equal(job.status, "complete");
  assert.equal(job.endpoint, OPENAI_IMAGE_EDITS_ENDPOINT);
  assert.match(job.imageUrl, /signed=1/);
  assert.equal(savedJob.generationPackage.brainVersion, 4);

  const recovered = await generateProductionImage(body, {
    brainStore,
    productionStore,
    env: { OPENAI_API_KEY: "test-only" },
    async render() { renderCalls += 1; },
  });
  assert.equal(recovered.status, "complete");
  assert.equal(renderCalls, 1);
});

test("production uses Images generations when no source image is attached", async () => {
  let savedJob = null;
  const brainStore = { async read() { return { approvedResult: approvedBrain(), brain: { approvedVersion: 1 }, sources: [] }; } };
  const productionStore = {
    async read() { return savedJob; },
    async write(value) { savedJob = value; },
    async writeImage(jobId) { return { pathname: `${jobId}.png`, contentType: "image/png" }; },
  };
  const job = await generateProductionImage(
    { jobId: "render-clean-123", brief: brief(), references: [] },
    {
      brainStore,
      productionStore,
      env: { OPENAI_API_KEY: "test-only" },
      async render({ referenceImages }) {
        assert.deepEqual(referenceImages, []);
        return { data: [{ b64_json: Buffer.from("image").toString("base64") }] };
      },
    },
  );
  assert.equal(job.endpoint, OPENAI_IMAGE_GENERATIONS_ENDPOINT);
});

test("a locked asset uses the edits endpoint with format-aware protection", async () => {
  let savedJob = null;
  let renderPrompt = "";
  let renderRefCount = 0;
  const storedBrain = {
    approvedResult: approvedBrain(),
    brain: { approvedVersion: 2 },
    sources: [
      {
        id: "asset-yuzu-can-001",
        name: "SLAKE Yuzu Ginger Can",
        authority: "exact-asset",
        declaredType: "packaging",
        detail: "Primary can artwork",
        usage: "Use this file exactly as supplied.",
        files: [{ name: "yuzu-can.png", type: "image/png", blobPathname: "brand-world-system/sources/yuzu-can.png" }],
      },
    ],
  };
  const brainStore = {
    async read() { return storedBrain; },
    async readSourceFile(pathname) {
      assert.equal(pathname, "brand-world-system/sources/yuzu-can.png");
      return { bytes: Buffer.from("can-pixels"), mimeType: "image/png" };
    },
  };
  const productionStore = {
    async read() { return savedJob; },
    async write(value) { savedJob = value; },
    async writeImage(jobId, bytes) { return { pathname: `${jobId}.png`, contentType: "image/png" }; },
    async imageUrl(pathname) { return `https://private.example/${pathname}?signed=1`; },
  };

  const job = await generateProductionImage(
    {
      jobId: "locked-asset-test-01",
      brief: brief(),
      references: [],
      lockedAssetId: "asset-yuzu-can-001",
    },
    {
      brainStore,
      productionStore,
      env: { OPENAI_API_KEY: "test-only" },
      async render({ prompt, referenceImages }) {
        renderPrompt = prompt;
        renderRefCount = referenceImages.length;
        assert.equal(referenceImages[0].name, "yuzu-can.png");
        assert.equal(referenceImages[0].bytes.toString(), "can-pixels");
        return { data: [{ b64_json: Buffer.from("composed-result").toString("base64") }], usage: { total_tokens: 30 } };
      },
    },
  );

  assert.equal(job.status, "complete");
  assert.equal(job.endpoint, OPENAI_IMAGE_EDITS_ENDPOINT);
  assert.equal(renderRefCount, 1);
  // The prompt must contain the protection block, not the world-only block
  assert.match(renderPrompt, /Preserve the supplied can exactly as pictured/);
  assert.match(renderPrompt, /closed and sealed/);
  assert.match(renderPrompt, /condensation/);
  // The prompt must NOT contain the world-only "invented logos" language
  assert.doesNotMatch(renderPrompt, /no additional focal object/i);
  // The package should record the locked asset
  assert.equal(savedJob.generationPackage.lockedAsset.name, "SLAKE Yuzu Ginger Can");
  assert.equal(savedJob.generationPackage.lockedAsset.format, "can");
});

test("a locked asset with creative references sends all images with the asset first", async () => {
  let savedJob = null;
  let referenceOrder = [];
  const storedBrain = {
    approvedResult: approvedBrain(),
    brain: { approvedVersion: 3 },
    sources: [
      {
        id: "asset-logo-001",
        name: "SLAKE wordmark",
        authority: "exact-asset",
        declaredType: "logo",
        files: [{ name: "wordmark.png", type: "image/png", blobPathname: "brand-world-system/sources/wordmark.png" }],
      },
      {
        id: "source-mood-001",
        name: "Desert moodboard",
        authority: "creative-reference",
        usage: "Use the warm palette.",
        files: [{ name: "mood.jpg", type: "image/jpeg", blobPathname: "brand-world-system/sources/mood.jpg" }],
      },
    ],
  };
  const brainStore = {
    async read() { return storedBrain; },
    async readSourceFile(pathname) {
      if (pathname.includes("wordmark")) return { bytes: Buffer.from("logo-bytes"), mimeType: "image/png" };
      return { bytes: Buffer.from("mood-bytes"), mimeType: "image/jpeg" };
    },
  };
  const productionStore = {
    async read() { return savedJob; },
    async write(value) { savedJob = value; },
    async writeImage(jobId, bytes) { return { pathname: `${jobId}.png`, contentType: "image/png" }; },
    async imageUrl(pathname) { return `https://private.example/${pathname}`; },
  };

  await generateProductionImage(
    {
      jobId: "locked-plus-refs-01",
      brief: brief(),
      references: [{ id: "source-mood-001", role: "Lighting + mood", influence: "Supporting" }],
      lockedAssetId: "asset-logo-001",
    },
    {
      brainStore,
      productionStore,
      env: { OPENAI_API_KEY: "test-only" },
      async render({ referenceImages }) {
        referenceOrder = referenceImages.map((img) => img.name);
        return { data: [{ b64_json: Buffer.from("result").toString("base64") }] };
      },
    },
  );

  // Locked asset must come first
  assert.equal(referenceOrder[0], "wordmark.png");
  assert.equal(referenceOrder[1], "mood.jpg");
  assert.equal(referenceOrder.length, 2);
  // Non-product asset gets identity preservation, not packaging protection
  assert.match(savedJob.generationPackage.prompt, /identity source of truth/);
  assert.doesNotMatch(savedJob.generationPackage.prompt, /closed and sealed/);
});

test("state-lock neutralization rewrites scene prose when a locked asset is present", async () => {
  const storedBrain = {
    approvedResult: approvedBrain(),
    brain: { approvedVersion: 1 },
    sources: [
      {
        id: "asset-jar-001",
        name: "Honey Jar",
        authority: "exact-asset",
        declaredType: "packaging",
        files: [{ name: "jar.png", type: "image/png", blobPathname: "brand-world-system/sources/jar.png" }],
      },
    ],
  };
  const brainStore = { async read() { return storedBrain; } };

  const { generationPackage } = await prepareProductionPackage(
    {
      brief: { scene: "A jar opened on the counter, lid off, contents spilling.", exclusions: "", placement: "Instagram feed", format: "4:5 portrait" },
      references: [],
      lockedAssetId: "asset-jar-001",
    },
    { brainStore },
  );

  // The scene in the prompt should be neutralized
  assert.match(generationPackage.prompt, /jar closed and sealed/);
  assert.match(generationPackage.prompt, /the lid on/);
  assert.doesNotMatch(generationPackage.prompt, /lid off/);
  // State neutralizations should be recorded
  assert.ok(generationPackage.stateNeutralizations.length >= 2);
});

test("locked asset resolution rejects non-exact-asset sources", async () => {
  const storedBrain = {
    approvedResult: approvedBrain(),
    brain: { approvedVersion: 1 },
    sources: [
      { id: "source-ref-001", name: "Moodboard", authority: "creative-reference", files: [{ name: "mood.png", type: "image/png", blobPathname: "x" }] },
    ],
  };
  const brainStore = { async read() { return storedBrain; } };
  await assert.rejects(
    () => prepareProductionPackage({ brief: brief(), references: [], lockedAssetId: "source-ref-001" }, { brainStore }),
    { message: /Only a protected brand asset/ },
  );
});

