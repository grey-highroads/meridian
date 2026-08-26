import { createHash, randomBytes } from "node:crypto";
import { CLIENT_ROLE, OPERATOR_ROLE } from "./roles.js";

// The people of an account, and the two ways a person leaves.
//
// Brief 4 of docs/spec-admin-surface.md. A person carries a first name, a last
// name, a phone, an email that is also their login, and whether they are a
// client or a Higher Roads admin. An admin never sets another person's
// password. They send a link, and the person sets it themselves.
//
// How a link reaches someone was ruled on 2026-08-26: Meridian mints it and the
// admin sends it from their own inbox. Nothing here sends mail, and the state
// on a person's row records what Meridian knows rather than claiming delivery.

export const INVITED = "invited";
export const ACTIVE = "active";
export const DEACTIVATED = "deactivated";

// Thirty days, ruled 2026-08-26. Single use inside that window: accepting an
// invite or completing a reset clears the link, so a link read over someone's
// shoulder a week later opens nothing.
export const LINK_DAYS = 30;

export function linkExpiry(now = new Date()) {
  return new Date(now.getTime() + LINK_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// The token is minted here and handed back once. What is stored is its hash, so
// the stored people document cannot be read to sign in as anyone.
export function mintLink(purpose, now = new Date()) {
  const token = randomBytes(24).toString("hex");
  return {
    token,
    link: { purpose, hash: hashToken(token), createdAt: now.toISOString(), expiresAt: linkExpiry(now) },
  };
}

export function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function linkMatches(link, token, now = new Date()) {
  if (!link || !link.hash) return false;
  if (link.hash !== hashToken(token)) return false;
  return new Date(link.expiresAt).getTime() > now.getTime();
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// Two people with the same email could both answer a sign in, so the email is
// the login and the login has to be unique across every account.
export function validEmail(value) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function personId(now = new Date()) {
  return `person-${now.getTime().toString(36)}-${randomBytes(4).toString("hex")}`;
}

export function displayNameFor(firstName, lastName) {
  return [String(firstName || "").trim(), String(lastName || "").trim()].filter(Boolean).join(" ");
}

export function validRole(role) {
  return role === OPERATOR_ROLE || role === CLIENT_ROLE ? role : null;
}

// What an admin reads on a row. No hash and no token leave the store.
export function publicPerson(person) {
  if (!person) return null;
  return {
    id: person.id,
    firstName: person.firstName || "",
    lastName: person.lastName || "",
    displayName: person.displayName || displayNameFor(person.firstName, person.lastName) || person.login || "",
    phone: person.phone || "",
    email: person.email || person.login || "",
    login: person.login,
    role: person.role,
    accountId: person.accountId === undefined ? null : person.accountId,
    status: person.status || (person.password ? ACTIVE : INVITED),
    invitePending: Boolean(person.link && person.link.purpose === "invite"),
    linkExpiresAt: person.link ? person.link.expiresAt : null,
    acceptedAt: person.acceptedAt || null,
    // Deleting is offered only for a person who has never signed in. Signing in
    // is doing something, and the record has to keep naming whoever acted.
    deletable: !person.password && !person.acceptedAt,
  };
}

export function buildPerson(fields, accountId, now = new Date()) {
  const role = validRole(fields.role);
  if (!role) {
    const error = new Error("Say whether this person is a client or Higher Roads.");
    error.status = 400;
    throw error;
  }
  const email = validEmail(fields.email);
  if (!email) {
    const error = new Error("That email address does not look like one. The email is how they sign in.");
    error.status = 400;
    throw error;
  }
  const displayName = displayNameFor(fields.firstName, fields.lastName);
  if (!displayName) {
    const error = new Error("Give this person a name. It is the name that stays on everything they approve.");
    error.status = 400;
    throw error;
  }
  return {
    id: personId(now),
    firstName: String(fields.firstName || "").trim(),
    lastName: String(fields.lastName || "").trim(),
    displayName,
    phone: String(fields.phone || "").trim(),
    email,
    login: email,
    role,
    // An admin belongs to no account, whichever account they were invited from.
    accountId: role === OPERATOR_ROLE ? null : accountId,
    password: null,
    status: INVITED,
    link: null,
    acceptedAt: null,
    createdAt: now.toISOString(),
  };
}
