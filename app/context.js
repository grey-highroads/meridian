const params = new URLSearchParams(window.location.search);

export const ACCOUNT_ID = params.get("account") || null;

// The tour a page works on. A named tour wins. With none named, Meridian asks
// the account which tours it holds and opens the one an admin set active, or
// the one it has when nobody has set one. No account carries another account's
// tour id as a default, and an account holding none resolves to nothing so the
// pages show their empty state.
async function firstStoredTour() {
  try {
    const response = await fetch("/api/tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list-tours", accountId: ACCOUNT_ID }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const tours = Array.isArray(body.tours) ? body.tours : [];
    if (body.activeTourId) return body.activeTourId;
    return tours.length ? tours[0].id : null;
  } catch {
    return null;
  }
}

export const TOUR_ID = params.get("tour") || await firstStoredTour();

export function scopedBody(body = {}) {
  return { accountId: ACCOUNT_ID, ...body };
}

function carryContext(link) {
  if (!link || !link.href) return;
  // A link that names its own account is the way out of this one, so the
  // active context is not written back over it.
  if (link.hasAttribute && link.hasAttribute("data-keep-href")) return;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.endsWith(".html")) return;
  if (ACCOUNT_ID) url.searchParams.set("account", ACCOUNT_ID);
  else url.searchParams.delete("account");
  if (TOUR_ID) url.searchParams.set("tour", TOUR_ID);
  else url.searchParams.delete("tour");
  if (link.href !== url.href) link.href = url.href;
}

export function preserveContextNavigation(root = document) {
  const apply = (scope) => {
    if (scope.matches?.("a[href]")) carryContext(scope);
    scope.querySelectorAll?.("a[href]").forEach(carryContext);
  };
  apply(root);
  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === "attributes") apply(change.target);
      for (const node of change.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) apply(node);
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["href"], childList: true, subtree: true });
  document.addEventListener("click", (event) => carryContext(event.target.closest?.("a[href]")), true);
  return observer;
}
