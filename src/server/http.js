import { timingSafeEqual } from "node:crypto";

export function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

export async function readJsonBody(request, limit = 4 * 1024 * 1024) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string" || Buffer.isBuffer(request.body)) {
    const body = Buffer.isBuffer(request.body) ? request.body.toString("utf8") : request.body;
    if (Buffer.byteLength(body) > limit) {
      const error = new Error("The request is too large.");
      error.status = 413;
      throw error;
    }
    try {
      return JSON.parse(body);
    } catch {
      const error = new Error("The request body is not valid JSON.");
      error.status = 400;
      throw error;
    }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error("The request is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("The request body is not valid JSON.");
    error.status = 400;
    throw error;
  }
}

function sameValue(left, right) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

const SESSION_COOKIE = "bws_session";

export function hasBrandWorldAccess(request, password = process.env.BRAND_WORLD_ACCESS_PASSWORD) {
  if (!password) return !process.env.VERCEL;
  const authorization = request.headers.authorization || "";
  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator !== -1 && sameValue(decoded.slice(0, separator), "brandworld") && sameValue(decoded.slice(separator + 1), password)) {
        return true;
      }
    } catch {}
  }
  const cookies = request.headers.cookie || "";
  const match = cookies.split(";").map(c => c.trim()).find(c => c.startsWith(SESSION_COOKIE + "="));
  if (match) {
    try {
      const decoded = Buffer.from(match.slice(SESSION_COOKIE.length + 1), "base64").toString("utf8");
      if (decoded === "brandworld:" + password) return true;
    } catch {}
  }
  return false;
}

export function requireBrandWorldAccess(request, response) {
  if (!process.env.BRAND_WORLD_ACCESS_PASSWORD && process.env.VERCEL) {
    sendJson(response, 503, { error: "This Brand World installation still needs its access password configured." });
    return false;
  }
  if (hasBrandWorldAccess(request)) return true;
  response.setHeader("WWW-Authenticate", 'Basic realm="Brand World System", charset="UTF-8"');
  sendJson(response, 401, { error: "Enter the Brand World installation password to continue." });
  return false;
}

export function sendPublicError(response, error) {
  const status = error.status && Number.isInteger(error.status) ? error.status : 500;
  const message = error.message || "The server could not complete this request.";
  console.error(`[brand-world-api] ${message}`);
  sendJson(response, status, { error: message });
}

// PROTOTYPE ONLY. The active client id is taken from the request and is NOT
// validated against the caller's identity, because the shared-password gate
// cannot express per-user client access (ADR 0011). When real authentication
// lands, the session must determine which clients a caller may load and this
// function must reject any id outside that set. Do not ship real auth without
// closing this seam. The id becomes a Blob path segment, so it is sanitized to
// a safe character set to prevent path traversal.
export function resolveClientId(request) {
  const header = request.headers["x-client-id"];
  if (typeof header === "string" && header.trim()) return sanitizeClientId(header);
  const cookies = request.headers.cookie || "";
  const match = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith("bws_client="));
  if (match) {
    try {
      const value = decodeURIComponent(match.slice("bws_client=".length));
      if (value) return sanitizeClientId(value);
    } catch {}
  }
  return "default";
}

export function sanitizeClientId(value) {
  const cleaned = String(value).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "default";
}
