import { issueSignedToken, presignUrl } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { readJsonBody, requireUser, sanitizeClientId, sendJson, sendPublicError } from "../src/server/http.js";

const MAXIMUM_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

function safeFilename(value) {
  const cleaned = String(value || "submitted-work")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "submitted-work";
}

export function uploadPrefix(tourId, assignmentId, accountId) {
  // Demo data stays at its legacy path; other accounts get their own
  // namespace. Brief 2 of docs/spec-accounts-artists-tours.md.
  if (!accountId || accountId === "dierks-bentley") return `brand-world-system/clients/${sanitizeClientId(tourId)}/tour/${sanitizeClientId(assignmentId)}/uploads/`;
  return `brand-world-system/clients/${sanitizeClientId(accountId)}/tours/${sanitizeClientId(tourId)}/${sanitizeClientId(assignmentId)}/uploads/`;
}

export function uploadPathFor(tourId, assignmentId, filename, accountId, id = randomUUID()) {
  return `${uploadPrefix(tourId, assignmentId, accountId)}${sanitizeClientId(id)}-${safeFilename(filename)}`;
}

export default async function handler(request, response) {
  const user = await requireUser(request, response);
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
    const accountId = user.accountId || null;
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
      const validUntil = Date.now() + 15 * 60 * 1000;
      const signedToken = await issueSignedToken({ ...credentials, pathname, operations: ["get"], validUntil });
      const result = await presignUrl(signedToken, {
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
