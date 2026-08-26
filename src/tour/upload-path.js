import { randomUUID } from "node:crypto";
import { sanitizeClientId } from "../server/http.js";

function safeFilename(value) {
  const cleaned = String(value || "submitted-work")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "submitted-work";
}

// One shape for every account, the same one the tour store writes beside.
export function uploadPrefix(tourId, assignmentId, accountId) {
  if (!accountId) {
    const error = new Error("An upload path needs the account it belongs to.");
    error.status = 400;
    throw error;
  }
  return `brand-world-system/clients/${sanitizeClientId(accountId)}/tours/${sanitizeClientId(tourId)}/${sanitizeClientId(assignmentId)}/uploads/`;
}

export function uploadPathFor(tourId, assignmentId, filename, accountId, id = randomUUID()) {
  return `${uploadPrefix(tourId, assignmentId, accountId)}${sanitizeClientId(id)}-${safeFilename(filename)}`;
}
