import { issueSignedToken, presignUrl } from "@vercel/blob";
import { createArtboardStore } from "../src/seam/artboard-store.js";
import { readJsonBody, requireUser, sanitizeClientId, sendJson, sendPublicError } from "../src/server/http.js";
import { resolveActingAccount } from "../src/org/acting-account.js";
import { CLIENT_ROLE } from "../src/org/roles.js";
import { uploadPathFor, uploadPrefix } from "../src/tour/upload-path.js";

export { uploadPathFor, uploadPrefix };

const MAXIMUM_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

function clientSurfaceError() {
  const error = new Error("That part of Meridian is for the Higher Roads team.");
  error.status = 403;
  return error;
}

export default async function handler(request, response, options = {}) {
  const user = options.user || await requireUser(request, response, options);
  if (!user) return;
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "This route only accepts work uploads and reads." });
      return;
    }
    const body = await readJsonBody(request, 1024 * 1024);
    const tourId = sanitizeClientId(body.tourId || "");
    const assignmentId = sanitizeClientId(body.assignmentId || "");
    const accountId = resolveActingAccount(user, body.accountId || user.actingAccount);
    const prefix = uploadPrefix(tourId, assignmentId, accountId);
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const credentials = token ? { token } : {};

    if (String(body.mode || "") === "reference-list") {
      const { createSceneRecord } = await import("../src/tour/scene-record.js");
      const record = createSceneRecord({ accountId });
      const facts = await record.readFacts(tourId, assignmentId);
      const references = facts.filter((fact) => fact.action === "Added reference").map((fact) => ({
        pathname: fact.pathname,
        filename: fact.filename,
        contentType: fact.contentType,
        addedBy: fact.actor,
        addedOn: fact.at,
      })).reverse();
      sendJson(response, 200, { references });
      return;
    }
    if (String(body.mode || "") === "reference-record") {
      const { createSceneRecord } = await import("../src/tour/scene-record.js");
      const record = createSceneRecord({ accountId });
      const pathname = String(body.pathname || "");
      if (!pathname.startsWith(prefix)) throw new Error("That file is outside this Scene.");
      await record.appendFact(tourId, assignmentId, {
        actor: user.displayName,
        role: user.roleLabel,
        account: accountId,
        action: "Added reference",
        pathname,
        filename: String(body.filename || "reference"),
        contentType: String(body.contentType || ""),
      });
      sendJson(response, 200, { ok: true });
      return;
    }
    if (String(body.mode || "") === "read") {
      const pathname = String(body.pathname || "");
      if (!pathname.startsWith(prefix)) throw new Error("That file is outside this Scene.");
      if (user.role === CLIENT_ROLE) {
        const artboardStore = options.artboardStore || createArtboardStore({ accountId });
        const [artboards, approvals] = await Promise.all([
          artboardStore.readArtboards(tourId, assignmentId),
          artboardStore.readApprovals(tourId, assignmentId),
        ]);
        const visible = new Set(approvals.readyForClient.map((entry) => Number(entry.artboardVersion)));
        const presented = artboards.some((entry) => (
          visible.has(Number(entry.artboard.artboardVersion))
          && entry.artboard.artifact?.blobPathname === pathname
        ));
        if (!presented) throw clientSurfaceError();
      }
      const validUntil = Date.now() + 15 * 60 * 1000;
      const sign = options.issueSignedToken || issueSignedToken;
      const presign = options.presignUrl || presignUrl;
      const signedToken = await sign({ ...credentials, pathname, operations: ["get"], validUntil });
      const result = await presign(signedToken, {
        access: "private",
        operation: "get",
        pathname,
        validUntil,
      });
      sendJson(response, 200, { pathname, presignedUrl: result.presignedUrl });
      return;
    }

    const contentType = String(body.contentType || "").toLowerCase();
    const size = Number(body.size);
    if (!ALLOWED_TYPES.has(contentType)) throw new Error("Choose an image or PDF for this submission.");
    if (!Number.isFinite(size) || size <= 0 || size > MAXIMUM_SIZE) {
      throw new Error("Choose one file no larger than 20 MB.");
    }
    const pathname = uploadPathFor(tourId, assignmentId, body.filename, accountId);
    const validUntil = Date.now() + 10 * 60 * 1000;
    const signedToken = await issueSignedToken({
      ...credentials,
      pathname,
      operations: ["put"],
      validUntil,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: MAXIMUM_SIZE,
    });
    const result = await presignUrl(signedToken, {
      access: "private",
      operation: "put",
      pathname,
      validUntil,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: MAXIMUM_SIZE,
      allowOverwrite: false,
      addRandomSuffix: false,
    });
    sendJson(response, 200, { pathname, presignedUrl: result.presignedUrl });
  } catch (error) {
    sendPublicError(response, error);
  }
}
