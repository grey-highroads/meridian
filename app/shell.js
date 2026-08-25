const params = new URLSearchParams(window.location.search);
const tourId = params.get("tour") || "off-the-map-2026";

const NAV_ICONS = {
  "index.html": '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10H3Z"/></svg>',
  "scenes.html": '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  "reviews.html": '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14v16H5zM9 10h6M9 14h4"/></svg>',
  "tour.html": '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h10"/></svg>',
};

for (const link of document.querySelectorAll(".m-shell a[href^='./']")) {
  const url = new URL(link.href, window.location.href);
  if (["index.html", "scenes.html", "reviews.html", "tour.html", "artist.html", "request.html", "direction.html"].some((name) => url.pathname.endsWith(`/${name}`))) {
    url.searchParams.set("tour", tourId);
    link.href = url.href;
  }
  const name = Object.keys(NAV_ICONS).find((entry) => url.pathname.endsWith(`/${entry}`));
  if (name && !link.querySelector(".m-shell__nav-icon")) link.insertAdjacentHTML("afterbegin", NAV_ICONS[name]);
}

fetch("/api/tour", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "get-me", tourId }),
}).then((response) => response.ok ? response.json() : null).then((body) => {
  if (!body) return;
  document.querySelectorAll("[data-operator-utility]").forEach((entry) => {
    entry.hidden = body.user.role !== "higher-roads";
  });
}).catch(() => {});
