import { createVercelBlobBrandBrainStore } from "../../src/brand-brain/store.js";
import { createVercelBlobProductStore } from "../../src/products/store.js";
import {
  synthesizeAndPersistProduct,
  listProducts,
  readProduct,
  approveProduct,
  resolveReviewQuestion,
  deferReviewQuestion,
  deleteProductRecord,
  addProductImage,
  removeProductImage,
} from "../../src/products/service.js";
import {
  readJsonBody,
  requireUser,
  resolveClientId,
  sendJson,
  sendPublicError,
} from "../../src/server/http.js";
import { OPERATOR_ROLE } from "../../src/org/store.js";

// Single dispatching handler for product records (ADR 0012 step 2). Replaces
// the throwaway prototype endpoint. Stays at one serverless function to remain
// under the Vercel Hobby 12-function ceiling.
//
// GET                           -> list product index entries
// POST { action: "synthesize" } -> synthesize from a brain source and persist
// POST { action: "read" }       -> read one full product record
// POST { action: "approve" }    -> approve a candidate product record
export default async function handler(request, response) {
  const user = await requireUser(request, response, { role: OPERATOR_ROLE });
  if (!user) return;
  try {
    const clientId = resolveClientId(request);
    const productStore = createVercelBlobProductStore({ clientId });

    if (request.method === "GET") {
      const products = await listProducts({ store: productStore });
      sendJson(response, 200, { products });
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      sendJson(response, 405, {
        error: "GET lists products. POST dispatches by action.",
      });
      return;
    }

    const body = await readJsonBody(request);
    const action = String(body.action || "").trim();

    if (action === "synthesize") {
      await handleSynthesize(body, clientId, productStore, response);
      return;
    }

    if (action === "read") {
      await handleRead(body, productStore, response);
      return;
    }

    if (action === "approve") {
      await handleApprove(body, productStore, response);
      return;
    }

    if (action === "delete") {
      const productId = String(body.productId || "").trim();
      const result = await deleteProductRecord({ store: productStore, productId });
      sendJson(response, 200, result);
      return;
    }

    if (action === "add_image") {
      const record = await addProductImage({
        store: productStore,
        productId: String(body.productId || "").trim(),
        image: body.image || {},
      });
      sendJson(response, 200, { record });
      return;
    }

    if (action === "remove_image") {
      const record = await removeProductImage({
        store: productStore,
        productId: String(body.productId || "").trim(),
        imageId: String(body.imageId || "").trim(),
      });
      sendJson(response, 200, { record });
      return;
    }

    if (action === "defer_question") {
      const productId = String(body.productId || "").trim();
      const record = await deferReviewQuestion({
        store: productStore,
        productId,
        questionIndex: body.questionIndex,
      });
      sendJson(response, 200, { record });
      return;
    }

    if (action === "resolve_question") {
      const productId = String(body.productId || "").trim();
      const record = await resolveReviewQuestion({
        store: productStore,
        productId,
        questionIndex: body.questionIndex,
        note: body.note,
      });
      sendJson(response, 200, { record });
      return;
    }

    sendJson(response, 400, {
      error: `Unknown action "${action}". Supported: synthesize, read, approve, add_image, remove_image, resolve_question, defer_question, delete.`,
    });
  } catch (error) {
    sendPublicError(response, error);
  }
}

async function handleSynthesize(body, clientId, productStore, response) {
  const brainStore = createVercelBlobBrandBrainStore({ clientId });
  const stored = await brainStore.read();
  const sources = stored?.sources || [];

  const source = sources.find((s) => s.id === String(body.sourceId || ""));
  if (!source) {
    sendJson(response, 400, {
      error:
        "sourceId did not match a stored source. GET this route to list sources, or check the brain intake.",
      availableSources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
      })),
    });
    return;
  }

  const result = await synthesizeAndPersistProduct({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    source,
    store: productStore,
    brainStore,
  });

  sendJson(response, 200, {
    persisted: true,
    product_id: result.record.product_id,
    source_name: source.name,
    content_length: result.contentLength,
    vision_files: result.visionFiles,
    model: result.record.model,
    usage: result.usage,
    record: result.record,
  });
}

async function handleRead(body, productStore, response) {
  const productId = String(body.productId || "").trim();
  if (!productId) {
    sendJson(response, 400, { error: "productId is required." });
    return;
  }
  const record = await readProduct({ store: productStore, productId });
  sendJson(response, 200, { record });
}

async function handleApprove(body, productStore, response) {
  const productId = String(body.productId || "").trim();
  if (!productId) {
    sendJson(response, 400, { error: "productId is required." });
    return;
  }
  const record = await approveProduct({ store: productStore, productId });
  sendJson(response, 200, { record });
}

