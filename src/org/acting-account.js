import { CLIENT_ROLE } from "./roles.js";
import { ACCOUNT, sanitizeAccountId } from "./store.js";

// The account every authenticated request acts inside. A client is fixed to
// the account on their stored user. Higher Roads may select another account;
// without that selection the account on the record stays active.
//
// A Higher Roads admin belongs to no account, so their record carries a null
// and this returns null when they have selected nothing. The caller decides
// what to do with that; readSessionUser in src/server/http.js opens the first
// account the deployment holds. A record with no account field at all is a
// caller that built a user by hand, and it keeps the older fallback so a test
// or a script does not have to name an account it does not care about.
export function resolveActingAccount(user, selectedAccount) {
  if (!user) {
    const error = new Error("Sign in to Meridian to continue.");
    error.status = 401;
    throw error;
  }
  const own = user.accountId === null ? null : sanitizeAccountId(user.accountId || ACCOUNT.id);
  if (user.role === CLIENT_ROLE) return own;
  const selected = String(selectedAccount || "").trim();
  return selected ? sanitizeAccountId(selected) : own;
}

// Existing Brand World routes select an account with a header or cookie. New
// Meridian pages use the account query value. Both feed the same acting rule.
export function selectedAccountFromRequest(request) {
  const header = request.headers["x-account-id"] || request.headers["x-client-id"];
  if (typeof header === "string" && header.trim()) return header;
  try {
    const url = new URL(request.url || "", "http://meridian.local");
    const selected = url.searchParams.get("account");
    if (selected) return selected;
  } catch {}
  const cookies = request.headers.cookie || "";
  const match = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith("bws_client="));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice("bws_client=".length)) || null;
  } catch {
    return null;
  }
}
