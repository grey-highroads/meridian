import { createOrgStore } from "../../src/org/store.js";
import { sessionCookie, sessionSecret, signSession } from "../../src/org/session.js";
import { readJsonBody, sendJson, sendPublicError } from "../../src/server/http.js";

// Signing in and signing out. Two ends of the same thing, so they sit on one
// route rather than adding a second function to the deployment.
//
// A POST with a login and a password sets the session cookie. A GET with
// signout on it clears the cookie and sends the person back to the front door.
//
// A POST carrying a token and a password completes an invite or a reset. It
// runs without a session, because the person completing it has no way to sign
// in yet. The link is what stands in for one, and it goes when it is used.

export default async function handler(request, response, options = {}) {
  try {
    const store = options.orgStore || createOrgStore(options);
    const secure = Boolean(process.env.VERCEL);

    if (request.method === "GET") {
      const url = new URL(request.url, "http://meridian.local");
      if (url.searchParams.has("signout")) {
        response.statusCode = 302;
        response.setHeader("Set-Cookie", sessionCookie("", { secure }));
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Location", "/landing.html");
        response.end();
        return;
      }
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "This route signs a person in." });
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "This route signs a person in." });
      return;
    }

    const body = await readJsonBody(request);

    // Setting a password from a link. The person is signed in on the way out,
    // so completing an invite lands them in the app rather than at a second
    // form asking for what they just typed.
    if (body.action === "set-password") {
      let person;
      try {
        person = await store.completeLink(body.token, body.password);
      } catch (error) {
        sendPublicError(response, error);
        return;
      }
      const accepted = await signSession({ userId: person.id, role: person.role }, sessionSecret());
      response.setHeader("Set-Cookie", sessionCookie(accepted, { secure }));
      sendJson(response, 200, { ok: true, user: person });
      return;
    }

    // Two different failures, two different sentences. The store throws when
    // the deployment has no sign in values set, and that sentence goes to the
    // screen as it is, because a person hunting a typo will not find one. The
    // mismatch line below is only for a login and password that were both read
    // and did not match.
    let user;
    try {
      user = await store.signIn(body.login || body.username, body.password);
    } catch (error) {
      sendPublicError(response, error);
      return;
    }

    if (!user) {
      sendJson(response, 401, { ok: false, error: "That login and password did not match. Try again." });
      return;
    }

    const token = await signSession({ userId: user.id, role: user.role }, sessionSecret());
    response.setHeader("Set-Cookie", sessionCookie(token, { secure }));
    sendJson(response, 200, { ok: true, user });
  } catch (error) {
    sendPublicError(response, error);
  }
}
