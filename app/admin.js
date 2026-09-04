import { scopedBody } from "./context.js";
import { ARTIST_LABEL, artistLabel } from "./label.js";

// Higher Roads maintenance. The lists come first: the accounts Meridian holds,
// and inside the one being worked in its artists, its tours, and its people.
// Every act hangs off a row in one of them. Ruled 2026-08-26 in
// docs/spec-admin-surface.md.
//
// Starting a tour is not here. It lives in Project, and an admin working
// for a busy client switches into that account and uses the screen the client
// uses, so the two never drift apart.
//
// Every destructive act is confirmed in its own row before anything is sent.

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
  activeTourId: null,
  deleting: null,
  confirmName: "",
  deletingTour: null,
  confirmTourName: "",
  deletingPerson: null,
  confirmPersonName: "",
  editingArtist: null,
  artistLabelDraft: "",
  working: false,
  creatingAccount: false,
  editing: null,
  link: null,
  person: { firstName: "", lastName: "", email: "", phone: "", role: "client-reviewer" },
};

const acts = {
  account: { working: false, result: null, message: "", name: "", artistName: "", artistLabel: "" },
  artist: { working: false, result: null, message: "", name: "", label: "" },
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
  return `<div class="m-admin-list m-rule-list">${items.join("")}</div>`;
}

function row(title, meta, href, acts = "") {
  const body = `<div class="m-stack"><span class="m-rule-row__title">${escape(title)}</span><span class="m-meta">${escape(meta)}</span></div>`;
  if (!href) return `<article class="m-admin-row">${body}${acts ? `<div class="m-cluster">${acts}</div>` : ""}</article>`;
  return `<a class="m-admin-row" data-keep-href href="${escape(href)}">${body}</a>`;
}

// An account row carries its own delete, armed by typing the account's name
// back. Tours and people use the same confirmation in their own rows.
function accountRow(entry) {
  const here = view.account && entry.id === view.account.id;
  const arming = view.deleting === entry.id;
  const armed = view.confirmName.trim() === entry.name;
  const controls = arming
    ? `<div class="m-admin-confirm">
         <p class="m-copy">Deleting ${escape(entry.name)} removes its artists, its brains, its tours, and every approval on record. Nothing brings it back.</p>
         <div class="m-admin-confirm__actions">
           <input class="m-input" data-field="confirm" value="${escape(view.confirmName)}" placeholder="Type ${escape(entry.name)}" aria-label="Type the account name to delete it">
           <button class="m-button m-button--change" type="button" data-delete-account="${escape(entry.id)}" ${armed && !view.working ? "" : "disabled"}>${view.working ? "Deleting" : "Delete account"}</button>
           <button class="m-button" type="button" data-cancel-delete>Keep account</button>
         </div>
       </div>`
    : "";
  return `<article class="m-admin-account-row${here ? " is-current" : ""}">
      <div class="m-stack">
        <a class="m-admin-account-row__name" data-keep-href href="${escape(accountHref(entry.id))}" ${here ? 'aria-current="page"' : ""}>${escape(entry.name)}</a>
        ${here ? '<span class="m-state m-state--current">Current account</span>' : '<span class="m-meta">Account</span>'}
      </div>
      <div class="m-admin-account-row__actions">
        <a class="m-button m-button--small" data-keep-href href="${escape(accountHref(entry.id))}">Open</a>
        ${arming ? "" : `<button class="m-button m-button--quiet m-button--small" type="button" data-arm-delete="${escape(entry.id)}">Delete account</button>`}
      </div>
      ${controls}
    </article>`;
}

function tourRow(entry) {
  const artist = view.artists.find((candidate) => candidate.id === entry.artistId);
  const subject = artistLabel(artist).toLowerCase();
  const active = entry.id === view.activeTourId;
  const arming = view.deletingTour === entry.id;
  const armed = view.confirmTourName.trim() === entry.name;
  const remove = arming
    ? `<div class="m-admin-confirm">
         <p class="m-copy">Deleting ${escape(entry.name)} removes its Scenes, files, reviews, and approvals. The ${escape(subject)} and ${escape(artistLabel(artist))} Brain stay in the account. This cannot be undone.</p>
         <div class="m-admin-confirm__actions">
           <input class="m-input" data-field="confirm-tour" value="${escape(view.confirmTourName)}" placeholder="Type ${escape(entry.name)}" aria-label="Type the tour name to delete it">
           <button class="m-button m-button--change" type="button" data-delete-tour="${escape(entry.id)}" ${armed && !view.working ? "" : "disabled"}>${view.working ? "Deleting" : "Delete tour"}</button>
           <button class="m-button" type="button" data-cancel-tour-delete>Keep tour</button>
         </div>
       </div>`
    : "";
  const controls = [
    active ? "" : `<button class="m-button m-button--small" type="button" data-make-active="${escape(entry.id)}">Open this tour by default</button>`,
    arming ? "" : `<button class="m-button m-button--quiet m-button--small" type="button" data-arm-tour-delete="${escape(entry.id)}">Delete tour</button>`,
  ].join("");
  return `<article class="m-admin-row">
      <div class="m-stack">
        <span class="m-rule-row__title">${escape(entry.name || entry.id)}</span>
        ${active ? '<span class="m-meta">Default tour</span>' : ""}
        <span class="m-meta">${escape(artist ? artist.name : `${ARTIST_LABEL} not found`)}</span>
      </div>
      <div class="m-cluster">${controls}</div>
      ${remove}
    </article>`;
}

// The way into another account. The link names its own account, so the active
// one is not written back over it on the way out.
function accountHref(accountId) {
  return `./admin.html?account=${encodeURIComponent(accountId)}`;
}

// The account named in the address, which is the one this page is working in.
function namedAccount() {
  return new URLSearchParams(window.location.search).get("account");
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

// What a person's row says about them, in the words an admin would use rather
// than the words the record uses.
function personState(entry) {
  if (entry.status === "deactivated") return "Deactivated";
  if (entry.invitePending) return `Invite link expires ${new Date(entry.linkExpiresAt).toLocaleDateString()}`;
  if (entry.status === "invited") return "Invite link revoked";
  return entry.acceptedAt ? `Active since ${new Date(entry.acceptedAt).toLocaleDateString()}` : "Active";
}

function personRow(entry) {
  const editing = view.editing === entry.id;
  if (editing) return personForm(entry);
  const off = entry.status === "deactivated";
  const arming = view.deletingPerson === entry.id;
  const armed = view.confirmPersonName.trim() === entry.displayName;
  const remove = entry.deletable
    ? `<button class="m-button m-button--quiet m-button--small" type="button" data-arm-person-delete="${escape(entry.id)}">Delete person</button>`
    : "";
  const controls = [
    `<button class="m-button" type="button" data-edit-person="${escape(entry.id)}">Edit</button>`,
    entry.invitePending
      ? `<button class="m-button" type="button" data-person-act="resend-invite" data-person="${escape(entry.id)}">Create new link</button>
         <button class="m-button" type="button" data-person-act="revoke-invite" data-person="${escape(entry.id)}">Revoke link</button>`
      : `<button class="m-button" type="button" data-person-act="send-reset" data-person="${escape(entry.id)}">Create password reset link</button>`,
    off
      ? `<button class="m-button" type="button" data-person-act="reactivate-person" data-person="${escape(entry.id)}">Reactivate</button>`
      : `<button class="m-button" type="button" data-person-act="deactivate-person" data-person="${escape(entry.id)}">Deactivate</button>`,
    remove,
  ].join("");
  const confirmation = arming ? `<div class="m-admin-confirm">
      <p class="m-copy">Deleting ${escape(entry.displayName)} removes the invitation and person record. This cannot be undone.</p>
      <div class="m-admin-confirm__actions">
        <input class="m-input" data-field="confirm-person" value="${escape(view.confirmPersonName)}" placeholder="Type ${escape(entry.displayName)}" aria-label="Type the person's name to delete them">
        <button class="m-button m-button--change" type="button" data-delete-person="${escape(entry.id)}" ${armed && !view.working ? "" : "disabled"}>${view.working ? "Deleting" : "Delete person"}</button>
        <button class="m-button" type="button" data-cancel-person-delete>Keep person</button>
      </div>
    </div>` : "";
  return `<article class="m-admin-row">
      <div class="m-stack">
        <span class="m-rule-row__title">${escape(entry.displayName)}</span>
        <span class="m-meta">${escape(entry.email)}${entry.phone ? ` / ${escape(entry.phone)}` : ""}</span>
        <span class="m-meta">${escape(entry.roleLabel || (entry.role === "higher-roads" ? "Higher Roads" : "Client"))}. ${escape(personState(entry))}</span>
      </div>
      ${arming ? "" : `<details class="m-admin-manage">
        <summary class="m-button m-button--small">Manage</summary>
        <div class="m-admin-manage__actions">${controls}</div>
      </details>`}
      ${confirmation}
    </article>`;
}

// One form, used for inviting somebody and for editing them. The fields are the
// same five either way, so the page does not carry two of them.
function personForm(entry) {
  const editing = Boolean(entry);
  const values = editing ? entry : view.person;
  const field = (name, label, type = "text") => `<div class="m-field">
      <label class="m-label" for="person-${name}">${escape(label)}</label>
      <input class="m-input" id="person-${name}" type="${type}" data-person-field="${name}" value="${escape(values[name] || "")}">
    </div>`;
  return `<article class="m-admin-row m-admin-row--form">
      <div class="m-stack">
        ${field("firstName", "First name")}
        ${field("lastName", "Last name")}
        ${field("email", "Email", "email")}
        ${field("phone", "Phone")}
        <div class="m-field">
          <label class="m-label" for="person-role">Access</label>
          <select class="m-input" id="person-role" data-person-field="role">
            <option value="client-reviewer" ${values.role === "higher-roads" ? "" : "selected"}>A client on this account</option>
            <option value="higher-roads" ${values.role === "higher-roads" ? "selected" : ""}>Higher Roads</option>
          </select>
        </div>
        <div class="m-cluster">
          <button class="m-button m-button--primary" type="button" ${editing ? `data-save-person="${escape(entry.id)}"` : "data-invite-person"} ${view.working ? "disabled" : ""}>${view.working ? "Saving" : (editing ? "Save" : "Invite them")}</button>
          <button class="m-button" type="button" data-cancel-person>Cancel</button>
        </div>
      </div>
    </article>`;
}

// The link Meridian minted, shown once. Nothing sends it, so the admin copies
// it out of here into whatever they are already using to talk to the person.
function linkBlock() {
  if (!view.link) return "";
  const full = `${window.location.origin}${view.link.href}`;
  return `<div class="m-callout m-callout--approved">
      <span class="m-state m-state--approved">Link ready</span>
      <p class="m-copy">Send this link to ${escape(view.link.name)}. It works once and expires in 30 days. This is the only time Meridian will show it.</p>
      <div class="m-field"><input class="m-input" data-link value="${escape(full)}" readonly aria-label="The link to send"></div>
      <div class="m-cluster"><button class="m-button" type="button" data-copy-link>Copy link</button><button class="m-button" type="button" data-dismiss-link>Done</button></div>
    </div>`;
}

function accountName() {
  return view.account ? view.account.name : "this account";
}

function sectionHead(id, title, count, action = "") {
  return `<header class="m-admin-section__head">
      <div class="m-cluster">
        <h3 id="${escape(id)}" class="m-section-heading">${escape(title)}</h3>
        <span class="m-meta">${count}</span>
      </div>
      ${action}
    </header>`;
}

function accountForm() {
  if (!view.creatingAccount) return "";
  return `<div class="m-admin-account-form" id="admin-account-form">
      <p class="m-copy">Create the client account and its first artist together.</p>
      <div class="m-field">
        <label class="m-label" for="account-name">Account name</label>
        <input class="m-input" id="account-name" data-field="account" value="${escape(acts.account.name)}" placeholder="For example, Northstar Live">
      </div>
      <div class="m-field">
        <label class="m-label" for="account-artist">${escape(ARTIST_LABEL)} name</label>
        <input class="m-input" id="account-artist" data-field="account-artist" value="${escape(acts.account.artistName)}" placeholder="For example, Wren Halloway">
      </div>
      <div class="m-field">
        <label class="m-label" for="account-artist-label">What to call this subject</label>
        <input class="m-input" id="account-artist-label" data-field="account-artist-label" value="${escape(acts.account.artistLabel)}" placeholder="${escape(ARTIST_LABEL)}">
        <span class="m-help">Optional. Use Composer, Company, or whatever fits. Leave it blank for ${escape(ARTIST_LABEL)}.</span>
      </div>
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-create-account ${acts.account.working ? "disabled" : ""}>${acts.account.working ? "Creating" : "Create the account"}</button>
        <button class="m-button" type="button" data-cancel-account-form>Cancel</button>
      </div>
      ${resultBlock(acts.account, "Account created")}
    </div>`;
}

// An account cannot be worked in without an artist. Artist creation is the
// empty state itself; once an artist exists, no secondary add action competes
// with the account's ordinary maintenance.
// The word one subject is called on screen, changed in its own row. Nothing
// else about the row moves, and the word is display only.
function artistLabelForm(entry) {
  return `<article class="m-admin-row m-admin-row--form">
      <div class="m-stack">
        <div class="m-field">
          <label class="m-label" for="artist-label-${escape(entry.id)}">What to call ${escape(entry.name)}</label>
          <input class="m-input" id="artist-label-${escape(entry.id)}" data-field="row-artist-label" value="${escape(view.artistLabelDraft)}" placeholder="${escape(ARTIST_LABEL)}">
          <span class="m-help">Leave it blank to go back to ${escape(ARTIST_LABEL)}.</span>
        </div>
        <div class="m-cluster">
          <button class="m-button m-button--primary" type="button" data-save-artist-label="${escape(entry.id)}" ${view.working ? "disabled" : ""}>${view.working ? "Saving" : "Save the word"}</button>
          <button class="m-button" type="button" data-cancel-artist-label>Cancel</button>
        </div>
      </div>
    </article>`;
}

function artistContent() {
  if (view.artists.length) {
    return rows(
      view.artists.map((entry) => (view.editingArtist === entry.id
        ? artistLabelForm(entry)
        : row(
          entry.name,
          `${artistLabel(entry)} / ${(entry.identities || []).join(", ") || "One identity"}`,
          undefined,
          `<button class="m-button m-button--quiet m-button--small" type="button" data-edit-artist-label="${escape(entry.id)}">Change the word</button>`,
        ))),
      "No artists yet.",
    );
  }
  return `<div class="m-admin-empty">
      <p class="m-copy">Add the artist this account works on.</p>
      <div class="m-field">
        <label class="m-label" for="artist-name">${escape(ARTIST_LABEL)} name</label>
        <input class="m-input" id="artist-name" data-field="artist" value="${escape(acts.artist.name)}" placeholder="For example, Wren Halloway">
      </div>
      <div class="m-field">
        <label class="m-label" for="artist-label">What to call this subject</label>
        <input class="m-input" id="artist-label" data-field="artist-label" value="${escape(acts.artist.label)}" placeholder="${escape(ARTIST_LABEL)}">
        <span class="m-help">Optional. Leave it blank for ${escape(ARTIST_LABEL)}. You can change it later.</span>
      </div>
      <div class="m-cluster">
        <button class="m-button m-button--primary" type="button" data-create-artist ${acts.artist.working ? "disabled" : ""}>${acts.artist.working ? "Creating" : "Create the artist"}</button>
      </div>
      ${resultBlock(acts.artist, `${artistLabel(acts.artist.result)} created`)}
    </div>`;
}

function render() {
  locationBar.innerHTML = `<nav class="m-breadcrumb" aria-label="Breadcrumb">
      <span class="m-breadcrumb__current">Admin</span>
    </nav>
    <span class="m-state m-state--current">Higher Roads only</span>`;

  if (view.loading) {
    root.innerHTML = `<p class="m-copy">Loading accounts…</p>`;
    return;
  }

  root.innerHTML = `<div class="m-admin">
    <header class="m-job-header">
      <div class="m-job-header__copy">
        <span class="m-label">Higher Roads</span>
        <h1 class="m-heading">Admin</h1>
        <p class="m-copy m-copy--large">Manage accounts, artists, tours, and people.</p>
      </div>
    </header>
    ${view.error ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(view.error)}</p></div>` : ""}
    <div class="m-admin-workspace">
      <aside class="m-admin-accounts" aria-labelledby="accounts-heading">
        <header class="m-admin-accounts__head">
          <div class="m-cluster">
            <h2 id="accounts-heading" class="m-section-heading">Accounts</h2>
            <span class="m-meta">${view.accounts.length}</span>
          </div>
          <button class="m-button m-button--primary m-button--small" type="button" data-toggle-account-form aria-expanded="${view.creatingAccount}" aria-controls="admin-account-form">Create account</button>
        </header>
        ${accountForm()}
        ${rows(view.accounts.map(accountRow), "No accounts yet.")}
      </aside>
      <section class="m-admin-account" aria-labelledby="selected-account-heading">
        <header class="m-admin-account__head">
          <span class="m-label">Account</span>
          <h2 id="selected-account-heading" class="m-heading">${escape(accountName())}</h2>
        </header>
        <div class="m-admin-account__body">
          <section class="m-admin-section" aria-labelledby="artists-heading">
            ${sectionHead("artists-heading", "Artists", view.artists.length)}
            ${artistContent()}
          </section>
          <section class="m-admin-section" aria-labelledby="tours-heading">
            ${sectionHead("tours-heading", "Tours", view.tours.length)}
            ${rows(view.tours.map(tourRow), "No tours yet.")}
          </section>
          <section class="m-admin-section" aria-labelledby="people-heading">
            ${sectionHead("people-heading", "People", view.people.length, view.editing === "new" ? "" : '<button class="m-button m-button--primary m-button--small" type="button" data-new-person>Invite somebody</button>')}
            ${linkBlock()}
            ${view.editing === "new" ? personForm(null) : ""}
            ${rows(view.people.map(personRow), "No client users yet.")}
          </section>
        </div>
      </section>
    </div>
    <section class="m-admin-global" aria-labelledby="higher-roads-heading">
      <header class="m-admin-section__head">
        <div class="m-stack">
          <h2 id="higher-roads-heading" class="m-section-heading">Higher Roads</h2>
          <p class="m-copy">Higher Roads users can work across every account.</p>
        </div>
        <span class="m-meta">${view.admins.length}</span>
      </header>
      ${rows(view.admins.map(personRow), "No Higher Roads users yet.")}
    </section>
  </div>`;
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
    view.activeTourId = tours.activeTourId || null;
    view.people = people.people || [];
    view.admins = people.admins || [];
  } catch (error) {
    // The address can name an account that is gone, most often the one just
    // deleted. Meridian drops the name and reads again rather than showing
    // lists headed with an account nobody can reach.
    if (namedAccount()) {
      window.location.replace("./admin.html");
      return;
    }
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

// The person form is read from the page when it is submitted rather than
// written back on every keystroke, so the caret stays where it was typed.
function readPersonForm() {
  const values = {};
  for (const field of document.querySelectorAll("[data-person-field]")) {
    values[field.getAttribute("data-person-field")] = field.value;
  }
  return values;
}

document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-field]");
  if (!field) return;
  const which = field.getAttribute("data-field");
  if (which === "account") acts.account.name = field.value;
  if (which === "account-artist") acts.account.artistName = field.value;
  if (which === "artist") acts.artist.name = field.value;
  if (which === "account-artist-label") acts.account.artistLabel = field.value;
  if (which === "artist-label") acts.artist.label = field.value;
  if (which === "row-artist-label") view.artistLabelDraft = field.value;
  if (which === "confirm") {
    view.confirmName = field.value;
    render();
    const again = document.querySelector('[data-field="confirm"]');
    if (again) {
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    }
  }
  if (which === "confirm-tour") {
    view.confirmTourName = field.value;
    render();
    const again = document.querySelector('[data-field="confirm-tour"]');
    if (again) {
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    }
  }
  if (which === "confirm-person") {
    view.confirmPersonName = field.value;
    render();
    const again = document.querySelector('[data-field="confirm-person"]');
    if (again) {
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    }
  }
});

// The three acts that change or remove something. Each one reports what it did
// in the words the server used and reads the lists again, so the page never
// shows a row that is gone.
async function act(work) {
  view.working = true;
  view.error = "";
  render();
  let failure = "";
  try {
    view.link = null;
    await work();
    view.deleting = null;
    view.confirmName = "";
    view.deletingTour = null;
    view.confirmTourName = "";
    view.deletingPerson = null;
    view.confirmPersonName = "";
  } catch (error) {
    failure = error.message;
  }
  view.working = false;
  await load();
  if (failure) {
    view.error = failure;
    render();
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.hasAttribute("data-toggle-account-form")) {
    view.creatingAccount = !view.creatingAccount;
    render();
    return;
  }
  if (target.hasAttribute("data-cancel-account-form")) {
    view.creatingAccount = false;
    render();
    return;
  }
  if (target.hasAttribute("data-arm-delete")) {
    view.deleting = target.getAttribute("data-arm-delete");
    view.confirmName = "";
    render();
    return;
  }
  if (target.hasAttribute("data-cancel-delete")) {
    view.deleting = null;
    view.confirmName = "";
    render();
    return;
  }
  if (target.hasAttribute("data-arm-tour-delete")) {
    view.deletingTour = target.getAttribute("data-arm-tour-delete");
    view.confirmTourName = "";
    render();
    return;
  }
  if (target.hasAttribute("data-cancel-tour-delete")) {
    view.deletingTour = null;
    view.confirmTourName = "";
    render();
    return;
  }
  if (target.hasAttribute("data-arm-person-delete")) {
    view.deletingPerson = target.getAttribute("data-arm-person-delete");
    view.confirmPersonName = "";
    render();
    return;
  }
  if (target.hasAttribute("data-cancel-person-delete")) {
    view.deletingPerson = null;
    view.confirmPersonName = "";
    render();
    return;
  }
  if (target.hasAttribute("data-delete-account")) {
    const accountToDelete = target.getAttribute("data-delete-account");
    void act(async () => {
      await post("/api/artist", { action: "delete-account", accountToDelete, confirmName: view.confirmName });
      // Deleting the account being worked in leaves the address naming
      // something that is gone, so the name goes with the account.
      if (namedAccount() === accountToDelete) window.location.replace("./admin.html");
    });
    return;
  }
  if (target.hasAttribute("data-delete-person")) {
    const personId = target.getAttribute("data-delete-person");
    void act(() => post("/api/artist", { action: "delete-person", personId }));
    return;
  }
  if (target.hasAttribute("data-new-person")) {
    view.editing = "new";
    view.link = null;
    view.person = { firstName: "", lastName: "", email: "", phone: "", role: "client-reviewer" };
    render();
    return;
  }
  if (target.hasAttribute("data-edit-person")) {
    view.editing = target.getAttribute("data-edit-person");
    view.link = null;
    render();
    return;
  }
  if (target.hasAttribute("data-cancel-person")) {
    view.editing = null;
    render();
    return;
  }
  if (target.hasAttribute("data-dismiss-link")) {
    view.link = null;
    render();
    return;
  }
  if (target.hasAttribute("data-copy-link")) {
    const field = document.querySelector("[data-link]");
    if (field) {
      field.select();
      void navigator.clipboard.writeText(field.value).catch(() => {});
    }
    return;
  }
  if (target.hasAttribute("data-invite-person")) {
    const person = readPersonForm();
    void act(async () => {
      const created = await post("/api/artist", { action: "invite-person", person });
      view.editing = null;
      view.link = { href: created.link, name: created.person.displayName };
    });
    return;
  }
  if (target.hasAttribute("data-save-person")) {
    const personId = target.getAttribute("data-save-person");
    const person = readPersonForm();
    void act(async () => {
      await post("/api/artist", { action: "edit-person", personId, person });
      view.editing = null;
    });
    return;
  }
  if (target.hasAttribute("data-person-act")) {
    const action = target.getAttribute("data-person-act");
    const personId = target.getAttribute("data-person");
    void act(async () => {
      const result = await post("/api/artist", { action, personId });
      view.link = result.link ? { href: result.link, name: result.person.displayName } : null;
    });
    return;
  }
  if (target.hasAttribute("data-make-active")) {
    const tourId = target.getAttribute("data-make-active");
    void act(() => post("/api/artist", { action: "set-active-tour", tourId }));
    return;
  }
  if (target.hasAttribute("data-delete-tour")) {
    const tourId = target.getAttribute("data-delete-tour");
    void act(() => post("/api/artist", { action: "delete-tour", tourId }));
    return;
  }
  if (target.hasAttribute("data-create-account")) {
    run(acts.account, async () => {
      const created = await post("/api/artist", {
        action: "create-account",
        name: acts.account.name,
        artistName: acts.account.artistName,
        artistLabel: acts.account.artistLabel,
      });
      // The account can arrive without its artist. When it does, the account is
      // reported as made and the artist is reported as the half that failed,
      // in the words the server used.
      if (!created.artist) {
        return {
          summary: `${created.account.name} was created, but the artist was not: ${created.artistError}`,
          lines: ["Open the account above and add the artist there."],
        };
      }
      view.creatingAccount = false;
      return { summary: `${created.account.name} was created with ${created.artist.name}. Open the account above to start the tour.` };
    });
  }
  if (target.hasAttribute("data-edit-artist-label")) {
    const artistId = target.getAttribute("data-edit-artist-label");
    const found = view.artists.find((entry) => entry.id === artistId);
    view.editingArtist = artistId;
    view.artistLabelDraft = (found && found.label) || "";
    render();
    return;
  }
  if (target.hasAttribute("data-cancel-artist-label")) {
    view.editingArtist = null;
    view.artistLabelDraft = "";
    render();
    return;
  }
  if (target.hasAttribute("data-save-artist-label")) {
    const artistId = target.getAttribute("data-save-artist-label");
    void act(async () => {
      await post("/api/artist", { action: "save-artist-label", artistId, label: view.artistLabelDraft });
      view.editingArtist = null;
      view.artistLabelDraft = "";
    });
    return;
  }
  if (target.hasAttribute("data-create-artist")) {
    run(acts.artist, async () => {
      const { artist } = await post("/api/artist", {
        action: "create-artist",
        name: acts.artist.name,
        label: acts.artist.label,
      });
      return { summary: `${artist.name} was added to ${accountName()}. Import the intake files when they are ready.` };
    });
  }
});

void load();
