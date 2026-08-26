import { readCookie, readSession, SESSION_COOKIE, sessionSecret } from "../org/session.js";
import { createOrgStore } from "../org/store.js";
import { resolveActingAccount, selectedAccountFromRequest } from "../org/acting-account.js";

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

// Who is making this request. The cookie is verified first, then the user is
// read from storage by the id it carries. The stored role is the one that
// decides anything, so a cookie that survived a signature check still cannot
// name a role its user does not have.
export async function readSessionUser(request, options = {}) {
  const secret = options.secret || sessionSecret();
  const claim = await readSession(readCookie(request.headers.cookie || "", SESSION_COOKIE), secret);
  if (!claim) return null;
  const store = options.orgStore || createOrgStore(options);
  const user = await store.findUser(claim.userId);
  if (!user) return null;
  return { ...user, actingAccount: resolveActingAccount(user, selectedAccountFromRequest(request)) };
}

// The gate on every route. No session and a session that does not resolve to a
// person both stop here.
export async function requireUser(request, response, options = {}) {
  let user = null;
  try {
    user = await readSessionUser(request, options);
  } catch (error) {
    sendPublicError(response, error);
    return null;
  }
  if (!user) {
    sendJson(response, 401, { error: "Sign in to Meridian to continue." });
    return null;
  }
  if (options.role && user.role !== options.role) {
    sendJson(response, 403, { error: "That part of Meridian is for the Higher Roads team." });
    return null;
  }
  return user;
}

export function sendPublicError(response, error) {
  const status = error.status && Number.isInteger(error.status) ? error.status : 500;
  const message = error.message || "The server could not complete this request.";
  console.error(`[brand-world-api] ${message}`);
  sendJson(response, status, { error: message });
}

export function resolveClientId(request, user) {
  if (!user) return sanitizeClientId(selectedAccountFromRequest(request) || "default");
  return resolveActingAccount(user, selectedAccountFromRequest(request));
}

export function sanitizeClientId(value) {
  const cleaned = String(value).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "default";
}
