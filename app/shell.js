const BOOT_PENDING_KEY = "meridian:boot-pending";

function takeBootRequest() {
  try {
    const requested = window.sessionStorage.getItem(BOOT_PENDING_KEY) === "1";
    window.sessionStorage.removeItem(BOOT_PENDING_KEY);
    return requested;
  } catch {
    return false;
  }
}

function mountBootSequence() {
  const shell = document.querySelector(".m-shell");
  const boot = document.createElement("div");
  boot.className = "m-boot";
  boot.setAttribute("role", "status");
  boot.setAttribute("aria-live", "polite");
  boot.innerHTML = `<span class="m-visually-hidden">Opening Meridian</span>
    <svg class="m-boot__glyph" aria-hidden="true" viewBox="0 0 100 100">
      <circle class="m-boot__ring" cx="50" cy="50" r="43" pathLength="100" />
      <circle class="m-boot__sweep" cx="50" cy="50" r="43" pathLength="100" />
      <g class="m-boot__longitude">
        <ellipse cx="50" cy="50" rx="18" ry="43" />
        <ellipse cx="50" cy="50" rx="31" ry="43" />
      </g>
      <g class="m-boot__latitude">
        <ellipse cx="50" cy="50" rx="43" ry="16" />
        <ellipse cx="50" cy="50" rx="43" ry="29" />
      </g>
      <path class="m-boot__ticks" d="M50 4v6M50 90v6M4 50h6M90 50h6" />
      <path class="m-boot__axis" pathLength="100" d="M50 7v86" />
      <path class="m-boot__scan" d="M11 50h78" />
      <circle class="m-boot__core" cx="50" cy="50" r="1.4" />
    </svg>`;

  document.body.classList.add("m-booting");
  shell?.setAttribute("aria-hidden", "true");
  document.body.prepend(boot);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const displayTime = reducedMotion ? 120 : 3120;
  window.setTimeout(() => {
    boot.classList.add("is-leaving");
    document.body.classList.remove("m-booting");
    shell?.removeAttribute("aria-hidden");
    window.setTimeout(() => boot.remove(), reducedMotion ? 20 : 520);
  }, displayTime);
}

if (takeBootRequest()) mountBootSequence();

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
  if (name && link.matches(".m-shell__nav-link") && !link.querySelector(".m-shell__nav-icon")) {
    link.insertAdjacentHTML("afterbegin", NAV_ICONS[name]);
  }
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
