// The session. One cookie, set when a person signs in and read on every
// request after that.
//
// The cookie carries a small signed statement: which user this is and which
// role they carry. The signature is what makes it a session rather than a
// claim, so a cookie a person edits by hand stops verifying and is treated as
// no session at all.
//
// Two readers use this file and they run in different places. The middleware
// runs at the edge and decides which pages load. The API routes run in Node and
// decide which actions run. Both need the same answer from the same bytes, so
// the signing lives here once and uses Web Crypto, which both runtimes have.
//
// The role travels in the cookie because the middleware cannot read storage.
// It decides which pages load and nothing else. Every action re-reads the user
// from storage and uses the stored role, so a role in a cookie can never widen
// what a person may do.

export const SESSION_COOKIE = "meridian_session";
export const SESSION_MAX_AGE = 86400;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

// The key the cookie is signed with. It comes from the two values that already
// carry the passwords, so there is nothing extra to set on the deployment and
// nothing extra to keep in step. Changing a password ends every session signed
// under the old one, which is the behavior a password change should have.
export function sessionSecret(env = process.env) {
  return `meridian-session:${env.MERIDIAN_OPERATOR || ""}:${env.MERIDIAN_CLIENT || ""}`;
}

async function signingKey(secret) {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signature(body, secret) {
  const signed = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(body));
  return toBase64Url(new Uint8Array(signed));
}

// Compared character by character over the whole string so a wrong signature
// takes the same time as a right one.
function sameText(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function signSession(claim, secret) {
  const body = toBase64Url(encoder.encode(JSON.stringify(claim)));
  return `${body}.${await signature(body, secret)}`;
}

// Returns the claim, or null for anything that does not verify. Every failure
// returns the same null, because a caller that can tell a forged signature from
// a malformed cookie learns something it has no use for.
export async function readSession(value, secret) {
  if (!value || typeof value !== "string") return null;
  const split = value.indexOf(".");
  if (split === -1) return null;
  const body = value.slice(0, split);
  const given = value.slice(split + 1);
  if (!body || !given) return null;
  let expected;
  try {
    expected = await signature(body, secret);
  } catch {
    return null;
  }
  if (!sameText(given, expected)) return null;
  try {
    const claim = JSON.parse(decoder.decode(fromBase64Url(body)));
    if (!claim || typeof claim.userId !== "string" || !claim.userId) return null;
    return claim;
  } catch {
    return null;
  }
}

export function readCookie(header, name) {
  const cookies = String(header || "").split(";").map((part) => part.trim());
  const match = cookies.find((part) => part.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : null;
}

export function sessionCookie(value, options = {}) {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${value ? options.maxAge || SESSION_MAX_AGE : 0}`,
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}
