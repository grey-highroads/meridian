# Spec: The Admin Surface

Date: 2026-08-26
Status: ruled by the owner 2026-08-26. Build runs as four briefs in the commit order below. Layers: organization, and the tour layer where a tour is selected or removed.
Why pre-registered: it creates the person record and the two different ways a person leaves it. Once someone has approved something, how they are removed decides whether the record can lie about who decided what.

## What is true today

Verified against the committed tree at `4bad989`.

`app/admin.js` is a flat page of four acts with no lists on it: copy the artist's files, store the tour at the shared path, create an account with its first artist, add another artist. Every act stands on its own and none of them hangs off a row.

`src/org/store.js` seeds two people from `MERIDIAN_OPERATOR` and `MERIDIAN_CLIENT`. Each carries a login, a display name, a password hash, and a role. There is no first name, last name, phone, invite, reset, deactivation, or deletion. `usersPath` is scoped to an account and `publicUser` stamps the demo account onto anyone missing one, so every person in the system today lives inside an account.

Accounts and artists are stored rows already. The on behalf field is written onto facts through `src/org/acting-account.js`, so attribution when acting inside a client account is enforcement and display rather than new plumbing.

## The rule

Admin is the Higher Roads utility for setting up and maintaining client accounts. It is reachable from anywhere in the app for an admin and never visible to a client.

**What it shows.** Accounts, and inside an account its artists, its tours, and its people. The lists come first. Every act below hangs off a row in one of them.

**What it does.**

Create an account together with its first artist, because an account without an artist is a state nobody can work in.

Add a further artist to an existing account.

Create the empty artist brain and attach it to an artist, so an intake run has somewhere to land. Admin does not generate a brain. Intake is a Higher Roads craft performed with a model and imported. There is no rebuild. An approved brain grows only by adding sources.

Invite a person to an account, and afterwards resend, revoke, or see whether the invite was accepted.

Edit a person: first name, last name, phone, email, and whether they are a client or an admin. The email is the login. Admins never set another person's password. They send a reset the person completes.

Deactivate a person who has acted in the app. They keep their name on every approval and every note and cannot sign in. Deleting is available only for a person who has never done anything, because deleting someone who has acted makes the record lie about who decided what.

Set which tour is active when an account holds more than one.

Delete a tour. Delete an account.

**What it does not do.** Creating a tour. That lives in the product on `app/new-tour.html`, and an admin acting for a busy client switches into that account and uses the same screen the client uses. Two ways to create a tour would drift apart.

**Attribution when acting on behalf.** When an admin does something inside a client account, the record says Higher Roads acting for that account. It never shows the client as having done it.

**Where admins live.** Client users belong to an account. Higher Roads admins belong to none and see every account. This shapes the user record and is decided before the people work starts.

## How an invite and a reset reach a person. Ruled 2026-08-26.

Meridian mints the link. The admin sends it from their own inbox. No mail provider, no new service, no new secret on the deployment.

What follows from that. The invite state on a person's row records what Meridian knows and never claims delivery: invited, accepted, revoked. Resend mints a fresh link and replaces the one before it. A password reset works the same way and is the only route by which a password changes, because an admin never sets another person's password.

A link is good for 30 days. Ruled 2026-08-26. Whether it survives a second use inside that window is settled in the people brief, against the code that mints it.

## What this supersedes

`docs/spec-accounts-artists-tours.md` says no delete for real accounts in this phase and calls retirement a later ruling. This ruling has delete a tour and delete an account, and supersedes that line.

The deferred-work entry recording that the active tour is the first one an account holds, sorted by id, is closed by the act that sets which tour is active.

## The changes, in build order

1. **Admins stop belonging to an account.** The person record carries an account for a client and none for a Higher Roads admin. `publicUser` stops stamping the demo account onto anyone missing one. Every read that resolves a session's account handles a person who has none. Lands first and alone, because the person record and the invite both hang off it.
2. **Lists become the page.** Accounts, and inside an account its artists, its tours, and its people. The two migration acts come off the page once storage shows they have both run. Nothing is added to the page that is not a list or an act on a row.
3. **Row acts on artists and tours.** Create the empty brain and attach it. Set the active tour. Delete a tour. Delete an account. Each delete lands with the test that says what it removed and what it left.
4. **People.** The record, the invite and its states, editing, the reset, deactivation, and deletion only for a person who has never acted. Largest brief. Its own instruction paragraph and its own tests.

## Done when, on the live app, by the owner

1. Signed in as Higher Roads, you see every account, and inside one of them its artists, its tours, and its people.
2. You invite a person, copy the link, complete it in another browser, and that person signs in with their email.
3. You deactivate a person who has approved something. Their name is still on the approval and they cannot sign in. The delete control is not offered for them.
4. You delete a person who has never done anything.
5. An account holding two tours opens the one you set active.
6. A client signed into their own account sees no admin destination anywhere.

## Tests, asserting effect

A Higher Roads person with no account reads every account. A client with an account reads one.

A person who has acted cannot be deleted, and the attempt leaves the approval untouched.

A deactivated person fails sign in and still resolves by id everywhere their name is displayed.

A revoked invite link does not complete.

A reset link is the only path that changes a password.

Setting the active tour changes which tour the shell opens, with no tour named in the address.

Deleting a tour leaves the account's artists and its brain in place.

A fact written by an admin inside a client account names Higher Roads acting for that account.
