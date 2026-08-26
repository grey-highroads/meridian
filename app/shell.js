import { ACCOUNT_ID, TOUR_ID, preserveContextNavigation, scopedBody } from "./context.js";

const BOOT_PENDING_KEY = "meridian:boot-pending";
const BOOT_OBJECT_URL = new URL("./design/assets/meridian/08-boot-screen-object-4k.svg", import.meta.url);
const BOOT_FALLBACK_URL = new URL("./design/assets/meridian/01-standalone-symbol.svg", import.meta.url);

function takeBootRequest() {
  try {
    const requested = window.sessionStorage.getItem(BOOT_PENDING_KEY) === "1";
    window.sessionStorage.removeItem(BOOT_PENDING_KEY);
    return requested;
  } catch {
    return false;
  }
}

async function mountBootSequence() {
  const shell = document.querySelector(".m-shell");
  const boot = document.createElement("div");
  boot.className = "m-boot";
  boot.setAttribute("role", "status");
  boot.setAttribute("aria-live", "polite");
  boot.innerHTML = `<span class="m-visually-hidden">Opening Meridian</span>
    <div class="m-boot__stage" aria-hidden="true"></div>`;

  document.body.classList.add("m-booting");
  shell?.setAttribute("aria-hidden", "true");
  document.body.prepend(boot);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = boot.querySelector(".m-boot__stage");
  try {
    const response = await fetch(BOOT_OBJECT_URL, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) throw new Error("Meridian boot object unavailable");
    stage.innerHTML = await response.text();
    const glyph = stage.querySelector("svg");
    glyph?.classList.add("m-boot__glyph");
    glyph?.removeAttribute("width");
    glyph?.removeAttribute("height");
  } catch {
    stage.innerHTML = `<img class="m-boot__glyph" src="${BOOT_FALLBACK_URL}" alt="">`;
  }

  window.requestAnimationFrame(() => boot.classList.add("is-building"));
  const displayTime = reducedMotion ? 120 : 3120;
  window.setTimeout(() => {
    boot.classList.add("is-leaving");
    document.body.classList.remove("m-booting");
    shell?.removeAttribute("aria-hidden");
    window.setTimeout(() => boot.remove(), reducedMotion ? 20 : 520);
  }, displayTime);
}

if (takeBootRequest()) void mountBootSequence();

const NAV_ICONS = {
  "index.html": '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10H3Z"/></svg>',
  "scenes.html": '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  "reviews.html": '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14v16H5zM9 10h6M9 14h4"/></svg>',
  "tour.html": '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h10"/></svg>',
};

for (const link of document.querySelectorAll(".m-shell a[href^='./']")) {
  const url = new URL(link.href, window.location.href);
  if (["index.html", "scenes.html", "reviews.html", "tour.html", "artist.html", "request.html", "direction.html"].some((name) => url.pathname.endsWith(`/${name}`))) {
    if (ACCOUNT_ID) url.searchParams.set("account", ACCOUNT_ID);
    if (TOUR_ID) url.searchParams.set("tour", TOUR_ID);
    link.href = url.href;
  }
  const name = Object.keys(NAV_ICONS).find((entry) => url.pathname.endsWith(`/${entry}`));
  if (name && link.matches(".m-shell__nav-link") && !link.querySelector(".m-shell__nav-icon")) {
    link.insertAdjacentHTML("afterbegin", NAV_ICONS[name]);
  }
}

preserveContextNavigation();

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// The account a Higher Roads session is working in. The server already decides
// what any session may reach, so this selects and reloads and nothing more. It
// is built only for the Higher Roads role and carries the same attribute the
// Artist Brain and Admin links carry, so it is hidden by the one rule that
// hides them. A client reviewer never receives it and gains no way to name
// another account from here.
async function mountAccountPicker(active) {
  const host = document.querySelector(".m-shell__utility");
  if (!host) return;
  let accounts = [];
  try {
    const response = await fetch("/api/artist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scopedBody({ action: "list-accounts" })),
    });
    if (!response.ok) return;
    const body = await response.json();
    accounts = Array.isArray(body.accounts) ? body.accounts : [];
  } catch {
    return;
  }
  if (!accounts.length) return;

  const field = document.createElement("div");
  field.className = "m-field";
  field.setAttribute("data-operator-utility", "");
  field.innerHTML = `<label class="m-label" for="m-account-picker">Account</label>
    <select class="m-select" id="m-account-picker">${accounts.map((entry) => `<option value="${escape(entry.id)}"${entry.id === active ? " selected" : ""}>${escape(entry.name || entry.id)}</option>`).join("")}</select>`;
  host.prepend(field);

  // A different account has different tours and different Scenes, so the ids
  // naming this one are dropped rather than carried into the next.
  field.querySelector("select").addEventListener("change", (event) => {
    const url = new URL(window.location.href);
    url.searchParams.set("account", event.target.value);
    url.searchParams.delete("tour");
    url.searchParams.delete("scene");
    window.location.href = url.href;
  });
}

fetch("/api/tour", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(scopedBody({ action: "get-me", tourId: TOUR_ID })),
}).then((response) => response.ok ? response.json() : null).then((body) => {
  if (!body) return;
  document.querySelectorAll("[data-operator-utility]").forEach((entry) => {
    entry.hidden = body.user.role !== "higher-roads";
  });
  if (body.user.role === "higher-roads") void mountAccountPicker(body.actingAccount || ACCOUNT_ID);
}).catch(() => {});
