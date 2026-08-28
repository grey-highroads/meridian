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
  if (["index.html", "scenes.html", "reviews.html", "tour.html", "intelligence.html", "artist.html", "request.html", "direction.html"].some((name) => url.pathname.endsWith(`/${name}`))) {
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

// The account a Higher Roads session is working in, under the wordmark and
// above the tour navigation. The server already decides what any session may
// reach, so this selects and reloads and nothing more. It is built only for the
// Higher Roads role and carries the same attribute the Artist Brain and Admin
// links carry, so it is hidden by the one rule that hides them. A client
// reviewer never receives it and gains no way to name another account from
// here.
//
// It is built from the rail's own classes, so the labels collapse with the rail
// at narrow widths without a rule of its own. There is no design pattern for an
// account switcher; the gap is recorded in docs/deferred-work.md.
const CHEVRON = '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>';

function accountHref(accountId) {
  const url = new URL(window.location.href);
  url.searchParams.set("account", accountId);
  // A different account has different tours and different Scenes, so the ids
  // naming this one are dropped rather than carried into the next.
  url.searchParams.delete("tour");
  url.searchParams.delete("scene");
  return url.href;
}

async function mountAccountPicker(active) {
  const brand = document.querySelector(".m-shell__brand");
  if (!brand) return;
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

  const current = accounts.find((entry) => entry.id === active) || accounts[0];
  const rows = accounts.map((entry) => {
    const here = entry.id === current.id;
    return `<a class="m-shell__nav-link" data-keep-href href="${escape(accountHref(entry.id))}"${here ? ' aria-current="true"' : ""}>
        <span class="m-shell__nav-label">${escape(entry.name || entry.id)}</span>
        ${here ? '<span class="m-shell__nav-count" aria-hidden="true">\u2713</span>' : ""}
      </a>`;
  }).join("");

  const picker = document.createElement("nav");
  picker.className = "m-shell__nav";
  picker.setAttribute("aria-label", "Account");
  picker.setAttribute("data-operator-utility", "");
  picker.setAttribute("data-account-picker", "");
  picker.innerHTML = `<details data-account-list>
      <summary class="m-shell__nav-link">
        ${CHEVRON}
        <span class="m-shell__nav-label">${escape(current.name || current.id)}</span>
      </summary>
      ${rows}
      <a class="m-shell__nav-link" href="./admin.html"><span class="m-shell__nav-label">New account</span></a>
    </details>`;
  brand.after(picker);
}

// Where a Higher Roads session goes that a client never does. These used to be
// hard-coded into a page's markup, so reaching one meant landing on the one
// page that happened to carry the link. They are built here instead, on every
// page that loads the shell, and only for the Higher Roads role. The route
// still refuses a client session on its own; nothing here is the enforcement.
//
// Artist Intelligence used to sit here as Artist Brain, a corner link to the
// reference view. It is a working destination now and sits in the rail, and the
// reference view is reached from it, so the artist's intelligence has one home.
// Ruled 2026-08-28.
const OPERATOR_DESTINATIONS = [
  { page: "admin.html", label: "Admin" },
];

// The one rail destination a client never receives. It is appended to the
// tour navigation after the session comes back as Higher Roads, so a client's
// page is never built with it and then hidden. The page and the route refuse a
// client on their own; this is what a person sees, not what stops them.
const INTELLIGENCE_ICON = '<svg class="m-icon m-shell__nav-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></svg>';

function mountIntelligenceDestination() {
  const nav = document.querySelector(".m-shell__nav");
  if (!nav || nav.querySelector("[data-intelligence-destination]")) return;
  const here = window.location.pathname.endsWith("/intelligence.html");
  const link = document.createElement("a");
  link.className = "m-shell__nav-link";
  link.setAttribute("data-intelligence-destination", "");
  link.setAttribute("data-operator-utility", "");
  if (here) link.setAttribute("aria-current", "page");
  link.href = "./intelligence.html";
  link.innerHTML = `${INTELLIGENCE_ICON}<span class="m-shell__nav-label">Artist Intelligence</span>`;
  nav.append(link);
}

function operatorGroup() {
  const group = document.createElement("div");
  group.className = "m-cluster";
  group.setAttribute("data-operator-utility", "");
  group.setAttribute("data-operator-group", "");
  group.innerHTML = OPERATOR_DESTINATIONS.map((entry) => {
    const here = window.location.pathname.endsWith(`/${entry.page}`);
    return `<a class="m-button m-button--small" href="./${entry.page}"${here ? ' aria-current="page"' : ""}>${escape(entry.label)}</a>`;
  }).join("");
  return group;
}

// The group sits in the upper right, in the bar every page already has there.
// Pages write that bar whole on every render, so the group is put back when it
// goes, rather than the pages each being taught to keep it.
function mountOperatorDestinations() {
  const bar = document.getElementById("location");
  if (!bar) return;
  const place = () => {
    if (!bar.querySelector("[data-operator-group]")) bar.append(operatorGroup());
  };
  place();
  new MutationObserver(place).observe(bar, { childList: true });
}

// Client teams can return to the introduction from the rail on any page. The
// server decides whether it appears automatically; this link only asks Home to
// replay it. Higher Roads never receives the link.
function mountClientIntroduction() {
  const utility = document.querySelector(".m-shell__utility");
  if (!utility || utility.querySelector("[data-client-introduction]")) return;
  const url = new URL("./index.html", window.location.href);
  url.searchParams.set("introduction", "1");
  if (ACCOUNT_ID) url.searchParams.set("account", ACCOUNT_ID);
  if (TOUR_ID) url.searchParams.set("tour", TOUR_ID);
  const link = document.createElement("a");
  link.className = "m-shell__nav-link";
  link.setAttribute("data-client-introduction", "");
  link.setAttribute("data-keep-href", "");
  link.href = url.href;
  link.innerHTML = '<span class="m-shell__nav-label">Introduction</span>';
  utility.prepend(link);
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
  if (body.user.role === "higher-roads") {
    mountOperatorDestinations();
    mountIntelligenceDestination();
    void mountAccountPicker(body.actingAccount || ACCOUNT_ID);
  } else {
    mountClientIntroduction();
  }
}).catch(() => {});
