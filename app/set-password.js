// Setting a password from a link. This is the only page in Meridian a person
// reaches without signing in first, so it asks for nothing but the password and
// says plainly when the link is no longer good.
//
// Nothing here reads who the person is. The link carries that, and the server
// is what knows.

const root = document.getElementById("set-password");
const token = new URLSearchParams(window.location.search).get("token") || "";

const state = { password: "", again: "", working: false, message: "", done: false };

function escape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render() {
  if (!token) {
    root.innerHTML = `<h1 class="m-heading">This link is not complete</h1>
      <p class="m-copy m-copy--large">Open the link exactly as it was sent to you. If it was cut in half by a mail app, ask for a new one.</p>`;
    return;
  }
  if (state.done) {
    root.innerHTML = `<h1 class="m-heading">You are set</h1>
      <p class="m-copy m-copy--large">Your password is saved and you are signed in.</p>
      <div class="m-cluster"><a class="m-button m-button--primary" href="./index.html">Go to Meridian</a></div>`;
    return;
  }
  const short = state.password.length > 0 && state.password.length < 10;
  const mismatch = state.again.length > 0 && state.password !== state.again;
  root.innerHTML = `<h1 class="m-heading">Set your password</h1>
    <p class="m-copy m-copy--large">Meridian never sets a password for you. Pick one here and it is yours.</p>
    <div class="m-field">
      <label class="m-label" for="password">Password</label>
      <input class="m-input" id="password" type="password" data-field="password" value="${escape(state.password)}" autocomplete="new-password">
      <span class="m-meta">${short ? "Use at least ten characters." : "At least ten characters."}</span>
    </div>
    <div class="m-field">
      <label class="m-label" for="again">Type it again</label>
      <input class="m-input" id="again" type="password" data-field="again" value="${escape(state.again)}" autocomplete="new-password">
      ${mismatch ? `<span class="m-meta">The two do not match yet.</span>` : ""}
    </div>
    <div class="m-cluster">
      <button class="m-button m-button--primary" type="button" data-save ${state.working || short || mismatch || !state.password ? "disabled" : ""}>${state.working ? "Saving" : "Save it"}</button>
    </div>
    ${state.message ? `<div class="m-callout m-callout--change"><p class="m-copy">${escape(state.message)}</p></div>` : ""}`;
}

// Rewriting the whole block on every keystroke would drop the caret, so the two
// fields are read from the page rather than written back to it.
document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-field]");
  if (!field) return;
  if (field.getAttribute("data-field") === "password") state.password = field.value;
  if (field.getAttribute("data-field") === "again") state.again = field.value;
  const save = document.querySelector("[data-save]");
  if (save) save.disabled = !state.password || state.password.length < 10 || state.password !== state.again;
});

document.addEventListener("click", async (event) => {
  if (!event.target.closest("[data-save]")) return;
  state.working = true;
  state.message = "";
  render();
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-password", token, password: state.password }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "That did not work.");
    state.done = true;
  } catch (error) {
    state.message = error.message;
  }
  state.working = false;
  render();
});

render();
