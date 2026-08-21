import assert from "node:assert/strict";
import test from "node:test";
import { generateProductionImage } from "../src/production/service.js";

// Regression tests for the incident of 2026-08-11: a render outran the
// platform gateway timeout, the gateway retried the invocation sixty seconds
// later, and both attempts rendered the same job into the same blob path. The
// second overwrote an image the user had already approved.
//
// See docs/incidents/2026-08-11-duplicate-render-overwrite.md

function buildOptions({ renderDelayMs = 0, onRender = () => {} } = {}) {
  let record = null;
  const images = [];
  let renderCount = 0;

  const brain = {
    brandName: "Slake",
    guidanceSections: [
      { id: "voice", name: "Voice", summary: "Plain", principles: [] },
      { id: "creative", name: "Creative", summary: "Natural light", principles: [] },
    ],
    artifacts: { dossier: {} },
    sources: [],
  };

  return {
    images,
    get renderCount() {
      return renderCount;
    },
    get record() {
      return record;
    },
    options: {
      env: { OPENAI_API_KEY: "unused" },
      brainStore: {
        async read() {
          return { approvedResult: brain, brain: { artifactStatus: "ready", artifactVersion: 1 } };
        },
        async readSourceFile() {
          return { bytes: Buffer.from(""), mimeType: "image/png" };
        },
      },
      productionStore: {
        async read() {
          return record;
        },
        async write(value) {
          record = value;
        },
        async writeImage(jobId, bytes) {
          images.push({ jobId, body: bytes.toString() });
          return { pathname: `jobs/${jobId}/output.png`, contentType: "image/png" };
        },
        async outputImageUrl() {
          return "https://example.test/image.png";
        },
      },
      async render() {
        renderCount += 1;
        const label = onRender(renderCount);
        if (renderDelayMs) await new Promise((resolve) => setTimeout(resolve, renderDelayMs));
        return { data: [{ b64_json: Buffer.from(label).toString("base64") }], usage: null };
      },
    },
  };
}

const body = {
  jobId: "render-abe3301b",
  brief: { scene: "A clinician at a workstation", placement: "LinkedIn feed", format: "1:1 square", assetType: "scene" },
};

test("a completed job is returned rather than rendered again", async () => {
  const harness = buildOptions({ onRender: (n) => `image-${n}` });
  await generateProductionImage(body, harness.options);
  assert.equal(harness.renderCount, 1);

  await generateProductionImage(body, harness.options);
  assert.equal(harness.renderCount, 1, "a completed job must not render a second time");
  assert.equal(harness.images.length, 1);
});

test("a retry arriving mid-render waits for the original instead of rendering again", async () => {
  const harness = buildOptions({ renderDelayMs: 300, onRender: (n) => `image-${n}` });

  const first = generateProductionImage(body, harness.options);
  // Let the first attempt claim the record before the retry arrives, which is
  // what the gateway retry did sixty seconds into a seventy-six second render.
  await new Promise((resolve) => setTimeout(resolve, 50));
  const second = generateProductionImage(body, harness.options);

  await Promise.all([first, second]);

  assert.equal(harness.renderCount, 1, "the retry must not start a second render");
  assert.equal(harness.images.length, 1, "only one image may be written for one job");
  assert.equal(harness.images[0].body, "image-1", "the surviving image must be the first attempt's");
});

test("the image the user approved is never replaced by a later attempt", async () => {
  const harness = buildOptions({ renderDelayMs: 200, onRender: (n) => `image-${n}` });
  const first = generateProductionImage(body, harness.options);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const second = generateProductionImage(body, harness.options);
  await Promise.all([first, second]);

  // This is the incident in one assertion: the blob at the job's path is the
  // render that completed first, not whichever attempt finished last.
  assert.deepEqual(harness.images.map((entry) => entry.body), ["image-1"]);
});

test("a job abandoned long ago may be rendered again", async () => {
  const harness = buildOptions({ onRender: (n) => `image-${n}` });
  // A record left working well beyond any plausible render duration.
  await harness.options.productionStore.write({
    jobId: body.jobId,
    attemptId: "dead-attempt",
    status: "working",
    createdAt: new Date(Date.now() - 600000).toISOString(),
  });

  await generateProductionImage(body, harness.options);
  assert.equal(harness.renderCount, 1, "a crashed job must not lock its id forever");
});

test("a different job is unaffected by an in-flight one", async () => {
  const harness = buildOptions({ onRender: (n) => `image-${n}` });
  await generateProductionImage(body, harness.options);
  await generateProductionImage({ ...body, jobId: "render-different" }, harness.options);
  assert.equal(harness.renderCount, 2);
  assert.deepEqual(harness.images.map((entry) => entry.jobId), ["render-abe3301b", "render-different"]);
});
