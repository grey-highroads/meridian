import { CLIENT_ROLE } from "./roles.js";
import { ACCOUNT, sanitizeAccountId } from "./store.js";

// The account every authenticated request acts inside. A client is fixed to
// the account on their stored user. Higher Roads may select another account;
// without that selection the stored account remains active.
export function resolveActingAccount(user, selectedAccount) {
  if (!user) {
    const error = new Error("Sign in to Meridian to continue.");
    error.status = 401;
    throw error;
  }
  const signedInAccount = sanitizeAccountId(user.accountId || ACCOUNT.id);
  if (user.role === CLIENT_ROLE) return signedInAccount;
  const selected = String(selectedAccount || "").trim();
  return selected ? sanitizeAccountId(selected) : signedInAccount;
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
