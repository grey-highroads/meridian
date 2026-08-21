import { issueSignedToken, presignUrl } from "@vercel/blob";
import { createVercelBlobBrandBrainStore } from "../../src/brand-brain/store.js";
import { hasBrandWorldAccess, readJsonBody, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";

// Combined upload + read presign endpoint. Hobby-plan function limits pushed
// the read variant into the same handler as upload. Mode is inferred from the
// request body: an explicit mode:"read" returns a GET presign; anything else
// (including the legacy body with no mode field) returns a PUT presign.
//
// Both modes are confined to the caller's own client namespace (ADR 0011).

const maximumSizeInBytes = 20 * 1024 * 1024;
const allowedContentTypes = [
  "application/json",
  "application/octet-stream",
  "application/pdf",
  "application/rtf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/xml",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "text/*",
];

function isAllowedContentType(contentType) {
  return allowedContentTypes.some((allowed) => allowed === contentType || (allowed.endsWith("/*") && contentType.startsWith(allowed.slice(0, -1))));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "This route only accepts source uploads and reads." });
    return;
  }
  try {
    if (!hasBrandWorldAccess(request)) {
      response.setHeader("WWW-Authenticate", 'Basic realm="Brand World System", charset="UTF-8"');
      sendJson(response, 401, { error: "Enter the Brand World installation password to access sources." });
      return;
    }
    const clientId = resolveClientId(request);
    const body = await readJsonBody(request, 1024 * 1024);
    const pathname = String(body.pathname || "");
    if (!pathname.startsWith(`brand-world-system/clients/${clientId}/sources/`)) throw new Error("The path is invalid.");

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const credentials = token ? { token } : {};

    // Sends a stored source file back as image data through our own origin.
    // Only the place on background page asks for this, for the same reason the
    // outputs handler grew its own version: a canvas will not give back pixels
    // it was handed from another domain. Thumbnails everywhere else keep using
    // the signed link below, which stays cheaper. The path check above already
    // confined this to the caller's own client.
    if (String(body.mode || "") === "data") {
      const stored = await createVercelBlobBrandBrainStore({ clientId }).readSourceFile(pathname);
      sendJson(response, 200, {
        pathname,
        dataUrl: `data:${stored.mimeType || "image/png"};base64,${stored.bytes.toString("base64")}`,
      });
      return;
    }

    if (String(body.mode || "") === "read") {
      const validUntil = Date.now() + 15 * 60 * 1000;
      const signedToken = await issueSignedToken({
        ...credentials,
        pathname,
        operations: ["get"],
        validUntil,
      });
      const result = await presignUrl(signedToken, {
        access: "private",
        operation: "get",
        pathname,
        validUntil,
      });
      sendJson(response, 200, { pathname, presignedUrl: result.presignedUrl });
      return;
    }

    const contentType = String(body.contentType || "application/octet-stream").toLowerCase();
    const size = Number(body.size);
    if (!Number.isFinite(size) || size <= 0 || size > maximumSizeInBytes) throw new Error("Choose one source file no larger than 20 MB.");
    if (!isAllowedContentType(contentType)) throw new Error("That file format is not supported for this source.");

    const validUntil = Date.now() + 10 * 60 * 1000;
    const signedToken = await issueSignedToken({
      ...credentials,
      pathname,
      operations: ["put"],
      validUntil,
      allowedContentTypes: [contentType],
      maximumSizeInBytes,
    });
    const result = await presignUrl(signedToken, {
      access: "private",
      operation: "put",
      pathname,
      validUntil,
      allowedContentTypes: [contentType],
      maximumSizeInBytes,
      allowOverwrite: false,
      addRandomSuffix: false,
    });
    sendJson(response, 200, { pathname, presignedUrl: result.presignedUrl });
  } catch (error) {
    sendPublicError(response, error);
  }
}
