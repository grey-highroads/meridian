import { scopedBody } from "./context.js";

// Higher Roads maintenance. The lists come first: the accounts Meridian holds,
// and inside the one being worked in its artists, its tours, and its people.
// Every act hangs off a row in one of them. Ruled 2026-08-26 in
// docs/spec-admin-surface.md.
//
// Starting a tour is not here. It lives on new-tour.html, and an admin working
// for a busy client switches into that account and uses the screen the client
// uses, so the two never drift apart.
//
// Nothing on this page removes anything yet, so no confirm step and no new
// pattern are needed.

const locationBar = document.getElementById("location");
const root = document.getElementById("admin");

const view = {
  loading: true,
  error: "",
  accounts: [],
  account: null,
  artists: [],
  tours: [],
  people: [],
  admins: [],
};

const acts = {
  account: { working: false, result: null, message: "", name: "", artistName: "" },
  artist: { working: false, result: null, message: "", name: "" },
};

async function post(route, payload) {
  const response = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scopedBody(payload)),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "That did not work.");
  return body;
}

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// A list that arrived empty says so in its own words rather than showing a
// blank where rows would be.
function rows(items, empty) {
  if (!items.length) return `<p class="m-copy">${escape(empty)}</p>`;
  return `<div class="m-directory-list m-rule-list">${items.join("")}</div>`;
}

function row(title, meta, href) {
  const body = `<div class="m-stack"><span class="m-rule-row__title">${escape(title)}</span><span class="m-meta">${escape(meta)}</span></div>`;
  if (!href) return `<article class="m-rule-row">${body}</article>`;
  return `<a class="m-rule-row" data-keep-href href="${escape(href)}">${body}</a>`;
}

// The way into another account. The link names its own account, so the active
// one is not written back over it on the way out.
function accountHref(accountId) {
  return `./admin.html?account=${encodeURIComponent(accountId)}`;
}

function resultBlock(state, label) {
  if (state.message) {
    return `<div class="m-callout m-callout--change"><p class="m-copy">${escape(state.message)}</p></div>`;
  }
  if (!state.result) return "";
  const lines = (state.result.lines || []).map((line) => `<li class="m-copy">${escape(line)}</li>`).join("");
  return `<div class="m-callout m-callout--approved">
      <span class="m-state m-state--approved">${escape(label)}</span>
      <p class="m-copy">${escape(state.result.summary)}</p>
    </div>
    ${lines ? `<div class="m-stack"><ul class="m-stack">${lines}</ul></div>` : ""}`;
}

function accountName() {
  return view.account ? view.account.name : "this account";
}

function render() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <span class="m-breadcrumb__current">Admin</span>
    </nav>
    <span class="m-state m-state--current">Higher Roads only</span>`;

  if (view.loading) {
    root.innerHTML = `<p class="m-copy">Reading the accounts.</p>`;
    return;
  }

  root.innerHTML = `<header class="m-job-header">
      <div class="m-job-header__copy">
        <span class="m-label">Maintenance</span>
        <h1 class="m-heading">Admin</h1>
        <p class="m-copy m-copy--large">Every account Meridian holds, and what sits inside the one you are working in.</p>
      </div>
    </header>
    ${view.error ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.error)}</p></div>` : ""}
    <section class="m-stack" aria-labelledby="accounts-heading">
      <h2 id="accounts-heading" class="m-section-heading">Accounts</h2>
      ${rows(
        view.accounts.map((entry) => row(
          entry.name,
          view.account && entry.id === view.account.id ? "Working in this one" : "Open",
          accountHref(entry.id),
        )),
        "No account is stored yet.",
      )}
    </section>
    <section class="m-stack" aria-labelledby="artists-heading">
      <h2 id="artists-heading" class="m-section-heading">Artists in ${escape(accountName())}</h2>
      ${rows(
        view.artists.map((entry) => row(entry.name, (entry.identities || []).join(", ") || "One identity")),
        "This account holds no artist yet.",
      )}
    </section>
    <section class="m-stack" aria-labelledby="tours-heading">
      <h2 id="tours-heading" class="m-section-heading">Tours in ${escape(accountName())}</h2>
      <p class="m-copy">A tour is started on the tour screen, the same one a client uses. Open the account and start it there.</p>
      ${rows(
        view.tours.map((entry) => row(entry.name || entry.id, entry.artistId ? `For ${entry.artistId}` : "No artist named")),
        "This account holds no tour yet.",
      )}
    </section>
    <section class="m-stack" aria-labelledby="people-heading">
      <h2 id="people-heading" class="m-section-heading">People in ${escape(accountName())}</h2>
      ${rows(
        view.people.map((entry) => row(entry.displayName, entry.login)),
        "Nobody has been invited into this account yet.",
      )}
      <h2 class="m-section-heading">Higher Roads</h2>
      <p class="m-copy">Higher Roads belongs to no account and sees every one of them.</p>
      ${rows(
        view.admins.map((entry) => row(entry.displayName, entry.login)),
        "No Higher Roads person is set up.",
      )}
    </section>
    <section class="m-stack" aria-labelledby="account-heading">
      <h2 id="account-heading" class="m-section-heading">Create an account</h2>
      <p class="m-copy m-copy--large">An account is one paying organization. It holds its own artists, its own tours, and its own work, and nothing stored in it is readable from another account.</p>
      <p class="m-copy">A tour sits under an artist, so the account and its first artist are made together and the account arrives ready to work in.</p>
      <div class="m-field">
        <label class="m-label" for="account-name">Account name</label>
        <input class="m-input" id="account-name" data-field="account" value="${escape(acts.account.name)}" placeholder="For example, Northstar Live">
      </div>
      <div class="m-field">
        <label class="m-label" for="account-artist">Artist name</label>
        <input class="m-input" id="account-artist" data-field="account-artist" value="${escape(acts.account.artistName)}" placeholder="For example, Wren Halloway">
      </div>
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-create-account ${acts.account.working ? "disabled" : ""}>${acts.account.working ? "Creating" : "Create the account"}</button>
      </div>
      ${resultBlock(acts.account, "Account created")}
    </section>
    <section class="m-stack" aria-labelledby="artist-heading">
      <h2 id="artist-heading" class="m-section-heading">Add another artist</h2>
      <p class="m-copy m-copy--large">The artist is the brand every tour is read against. An account gets its first artist when it is created, and this adds another to ${escape(accountName())}. Its brain stays empty until intake files are imported for it.</p>
      <div class="m-field">
        <label class="m-label" for="artist-name">Artist name</label>
        <input class="m-input" id="artist-name" data-field="artist" value="${escape(acts.artist.name)}" placeholder="For example, Wren Halloway">
      </div>
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-create-artist ${acts.artist.working ? "disabled" : ""}>${acts.artist.working ? "Creating" : "Create the artist"}</button>
      </div>
      ${resultBlock(acts.artist, "Artist created")}
    </section>`;
}

// One read of everything the page shows. The account being worked in comes back
// from the server rather than from the address, because an admin belongs to no
// account and a page that names none is still working in one.
async function load() {
  view.loading = true;
  view.error = "";
  render();
  try {
    const people = await post("/api/artist", { action: "list-people" });
    const accountId = people.accountId;
    const [listed, artists, tours] = await Promise.all([
      post("/api/artist", { action: "list-accounts" }),
      post("/api/artist", { action: "list-artists", accountId }),
      post("/api/tour", { action: "list-tours", accountId }),
    ]);
    view.accounts = listed.accounts || [];
    view.account = view.accounts.find((entry) => entry.id === accountId) || { id: accountId, name: accountId };
    view.artists = artists.artists || [];
    view.tours = tours.tours || [];
    view.people = people.people || [];
    view.admins = people.admins || [];
  } catch (error) {
    view.error = error.message;
  }
  view.loading = false;
  render();
}

function run(state, work) {
  state.working = true;
  state.message = "";
  state.result = null;
  render();
  work().then((result) => {
    state.working = false;
    state.result = result;
    render();
    // The lists are read again, so a created account or artist appears in the
    // list it belongs to rather than only in the sentence reporting it.
    void load();
  }).catch((error) => {
    // A duplicate name and a name that makes no usable id both arrive here and
    // are shown in the words the server used, in the same place a finished run
    // reports itself.
    state.working = false;
    state.message = error.message;
    render();
  });
}

document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-field]");
  if (!field) return;
  const which = field.getAttribute("data-field");
  if (which === "account") acts.account.name = field.value;
  if (which === "account-artist") acts.account.artistName = field.value;
  if (which === "artist") acts.artist.name = field.value;
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-create-account")) {
    run(acts.account, async () => {
      const created = await post("/api/artist", {
        action: "create-account",
        name: acts.account.name,
        artistName: acts.account.artistName,
      });
      // The account can arrive without its artist. When it does, the account is
      // reported as made and the artist is reported as the half that failed,
      // in the words the server used.
      if (!created.artist) {
        return {
          summary: `${created.account.name} is an account now. The artist was not created: ${created.artistError}`,
          lines: ["Open the account in the list above and add the artist there."],
        };
      }
      return { summary: `${created.account.name} is an account now, with ${created.artist.name} in it. Open it in the list above to start the tour.` };
    });
  }
  if (target.hasAttribute("data-create-artist")) {
    run(acts.artist, async () => {
      const { artist } = await post("/api/artist", { action: "create-artist", name: acts.artist.name });
      return { summary: `${artist.name} is stored in ${accountName()}. Import intake files for it when they are ready.` };
    });
  }
});

void load();
