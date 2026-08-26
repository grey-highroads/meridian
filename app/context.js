const DEMO_ACCOUNT_ID = "dierks-bentley";
const DEMO_TOUR_ID = "off-the-map-2026";
const params = new URLSearchParams(window.location.search);

export const ACCOUNT_ID = params.get("account") || null;
export const TOUR_ID = params.get("tour") || (!ACCOUNT_ID || ACCOUNT_ID === DEMO_ACCOUNT_ID ? DEMO_TOUR_ID : null);

export function scopedBody(body = {}) {
  return { accountId: ACCOUNT_ID, ...body };
}

function carryContext(link) {
  if (!link || !link.href) return;
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
