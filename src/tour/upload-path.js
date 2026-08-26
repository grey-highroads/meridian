import { randomUUID } from "node:crypto";
import { sanitizeClientId } from "../server/http.js";
import { DEMO_ACCOUNT_ID } from "./store.js";

function safeFilename(value) {
  const cleaned = String(value || "submitted-work")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "submitted-work";
}

export function uploadPrefix(tourId, assignmentId, accountId) {
  if (!accountId || accountId === DEMO_ACCOUNT_ID) {
    return `brand-world-system/clients/${sanitizeClientId(tourId)}/tour/${sanitizeClientId(assignmentId)}/uploads/`;
  }
  return `brand-world-system/clients/${sanitizeClientId(accountId)}/tours/${sanitizeClientId(tourId)}/${sanitizeClientId(assignmentId)}/uploads/`;
}

export function uploadPathFor(tourId, assignmentId, filename, accountId, id = randomUUID()) {
  return `${uploadPrefix(tourId, assignmentId, accountId)}${sanitizeClientId(id)}-${safeFilename(filename)}`;
}
