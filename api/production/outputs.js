import { createVercelBlobProductionStore } from "../../src/production/store.js";
import { readJsonBody, requireBrandWorldAccess, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";

const MAX_OUTPUTS = 200;
// Signing is per-image work. Only the most recent outputs are ever shown as
// thumbnails, so bound how many URLs one read mints.
const MAX_SIGNED_IMAGES = 60;

export default async function handler(request, response) {
  if (!requireBrandWorldAccess(request, response)) return;
  const clientId = resolveClientId(request);
  const store = createVercelBlobProductionStore({ clientId });

  if (request.method === "GET") {
    try {
      // A single output is requested when the user opens past work for review.
      // The compiled package comes back with it so the evaluation screen has
      // the same material it had at generation time.
      const params = new URL(request.url, "http://localhost").searchParams;

      // The stable image path. Every <img> in the app points here and the
      // browser never holds a presigned URL. Signed URLs live fifteen minutes;
      // this route mints a fresh one per request and redirects to it, so an
      // image link in the interface never goes stale no matter how long a
      // screen stays open or how long ago the output was made.
      if (params.get("action") === "image") {
        const imageId = String(params.get("outputId") || "");
        if (!imageId || !store.outputImageUrl) {
          sendJson(response, 404, { error: "That image is not available." });
          return;
        }
        try {
          const signed = await store.outputImageUrl(imageId);
          if (!signed) {
            sendJson(response, 404, { error: "That image is not available." });
            return;
          }
          // No caching of the redirect itself: a cached 302 would pin a URL
          // that expires, which is the bug this route exists to end.
          response.setHeader("Cache-Control", "no-store, max-age=0");
          response.setHeader("Location", signed);
          response.statusCode = 302;
          response.end();
        } catch {
          sendJson(response, 404, { error: "That image is not available." });
        }
        return;
      }

      // The same picture as the route above, sent through our own origin as
      // image data instead of as a redirect to storage. Only the place on
      // background page asks for this, because a canvas will not give back
      // pixels it was handed from another domain. Every other reader keeps
      // using the redirect, which stays cheaper.
      if (params.get("action") === "imageData") {
        const imageId = String(params.get("outputId") || "");
        if (!imageId || !store.readOutputImageBytes) {
          sendJson(response, 404, { error: "That image is not available." });
          return;
        }
        try {
          const stored = await store.readOutputImageBytes(imageId);
          if (!stored) {
            sendJson(response, 404, { error: "That image is not available." });
            return;
          }
          sendJson(response, 200, {
            dataUrl: `data:${stored.contentType};base64,${stored.bytes.toString("base64")}`,
          });
        } catch {
          sendJson(response, 404, { error: "That image is not available." });
        }
        return;
      }

      const requestedId = params.get("outputId");
      if (requestedId) {
        const log = await store.readOutputs();
        const output = (log?.outputs || []).find((entry) => entry.id === requestedId) || null;
        if (!output) {
          const error = new Error("That output is no longer saved.");
          error.status = 404;
          throw error;
        }
        let imageUrl = null;
        try {
          if (store.outputImageUrl && (output.hadImage || output.imageUrl)) imageUrl = await store.outputImageUrl(requestedId);
        } catch {
          imageUrl = null;
        }
        const savedPackage = store.readOutputPackage ? await store.readOutputPackage(requestedId) : null;
        sendJson(response, 200, { output: { ...output, imageUrl }, package: savedPackage });
        return;
      }

      const saved = await store.readOutputs();
      const outputs = saved?.outputs || [];
      // Presigned image URLs live for fifteen minutes, so any URL persisted in
      // the log is stale by the time it is read back. Mint a fresh one per
      // output instead. hadImage marks records that produced an image, so we
      // do not sign paths for outputs that never had one.
      const refreshed = await Promise.all(
        outputs.slice(0, MAX_SIGNED_IMAGES).map(async (output) => {
          if (!store.outputImageUrl) return output;
          if (!output.hadImage && !output.imageUrl) return output;
          try {
            return { ...output, imageUrl: await store.outputImageUrl(output.id) };
          } catch {
            return { ...output, imageUrl: null };
          }
        }),
      );
      sendJson(response, 200, { outputs: [...refreshed, ...outputs.slice(MAX_SIGNED_IMAGES)] });
    } catch (error) {
      sendPublicError(response, error);
    }
    return;
  }

  if (request.method === "POST") {
    try {
      const body = await readJsonBody(request);

      // Discarding an output is a hard delete. The image blob and the log
      // record both go, so no surface has to remember to filter it out.
      if (body.action === "discard") {
        const outputId = String(body.outputId || "");
        if (!outputId) {
          const error = new Error("The output to discard is missing.");
          error.status = 400;
          throw error;
        }
        const saved = await store.readOutputs();
        const remaining = (saved?.outputs || []).filter((output) => output.id !== outputId);
        await store.writeOutputs({ outputs: remaining, savedAt: new Date().toISOString() });
        // The record is gone either way. A missing or already-deleted image
        // should not fail the request.
        try {
          if (store.deleteOutputArtifacts) await store.deleteOutputArtifacts(outputId);
        } catch {
          // The blobs are orphaned rather than the delete being reported as failed.
        }
        sendJson(response, 200, { discarded: true, count: remaining.length });
        return;
      }

      if (!Array.isArray(body.outputs)) {
        const error = new Error("The outputs list is missing.");
        error.status = 400;
        throw error;
      }
      // Keep only the most recent outputs to bound storage size.
      // Strip any fields that are only useful in-session (large package data
      // is already saved on the production job itself).
      const trimmed = body.outputs.slice(0, MAX_OUTPUTS).map((output) => ({
        id: output.id,
        label: output.label,
        status: output.status,
        campaignId: output.campaignId || null,
        campaignName: output.campaignName || null,
        assetType: output.assetType || null,
        channel: output.channel || null,
        placement: output.placement || null,
        format: output.format || null,
        scene: output.scene || null,
        brainVersion: output.brainVersion || null,
        createdAt: output.createdAt || null,
        // Presigned URLs are never persisted. They expire in fifteen minutes,
        // so a stored one is guaranteed stale by the time it is read back and
        // becomes a broken image. The durable fact is whether this output ever
        // produced an image; the browser reaches it through the stable image
        // route above.
        hadImage: Boolean(output.hadImage || output.imageUrl),
        postCopy: output.postCopy || null,
        // A marker, not the copy itself. The produced text and its audit live
        // in the per-job package blob, which is what the evaluation screen
        // reads when past work is reopened.
        copySummary: output.copySummary || null,
      }));
      await store.writeOutputs({ outputs: trimmed, savedAt: new Date().toISOString() });
      sendJson(response, 200, { saved: true, count: trimmed.length });
    } catch (error) {
      sendPublicError(response, error);
    }
    return;
  }

  response.setHeader("Allow", "GET, POST");
  sendJson(response, 405, { error: "This route reads and saves the output log." });
}
