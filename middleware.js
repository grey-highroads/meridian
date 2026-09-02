import { next } from "@vercel/functions";
import { readCookie, readSession, SESSION_COOKIE, sessionSecret } from "./src/org/session.js";
import { CLIENT_ROLE } from "./src/org/roles.js";

// The front door. It decides which pages load for whoever is at the browser.
// What a person may change is decided in the route handlers, by the role read
// from storage, because a page that hides a button is a page.
//
// An invited client lands on Home and can use the Tour and Scene workflow.
// Internal review and Artist Brain stay on the Higher Roads side of the glass.

// Set-password is public because the person opening it has no way to sign in
// yet. The link is what stands in for a session, and the server is what checks
// it. Ruled 2026-08-26 in docs/spec-admin-surface.md.
const PUBLIC_PATHS = new Set([
  "/landing.html",
  "/set-password.html",
  "/api/auth/login",
]);

const CLIENT_PATHS = new Set([
  "/", "/index.html", "/home.js", "/shell.js",
  "/scenes.html", "/scenes.js", "/reviews.html", "/reviews.js",
  "/tour.html", "/tour.js", "/scene.html", "/scene.js",
  "/request.html", "/request.js", "/direction.html", "/direction.js",
  "/handoff.html", "/handoff.js",
  "/api/tour", "/api/tour-upload", "/api/auth/login",
]);

const CLIENT_HOME = "/";

function isPage(pathname) {
  return pathname === "/" || pathname.endsWith(".html");
}

// The build renames every script, stylesheet, and image on a page to a hashed
// file under /assets/, so those are what the browser asks for. They carry no
// account data. Everything that does comes from the API routes, and those stay
// closed. The set-password page has to work for someone with no session, which
// only happens if these load for anyone.
function isStaticAsset(pathname) {
  return pathname.startsWith("/assets/")
    || pathname.startsWith("/design/")
    || pathname === "/favicon.ico";
}

function clientMayLoad(pathname) {
  return CLIENT_PATHS.has(pathname);
}

function plain(message, status) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default async function middleware(request) {
  const pathname = new URL(request.url).pathname;
  if (isStaticAsset(pathname)) return next();
  if (PUBLIC_PATHS.has(pathname)) return next();

  const claim = await readSession(readCookie(request.headers.get("cookie") || "", SESSION_COOKIE), sessionSecret());
  if (!claim) {
    if (isPage(pathname)) return Response.redirect(new URL("/landing.html", request.url), 302);
    return plain("Sign in to Meridian to continue.", 401);
  }

  if (claim.role === CLIENT_ROLE && !clientMayLoad(pathname)) {
    return plain("That part of Meridian is for the Higher Roads team. Your tour is at " + CLIENT_HOME + ".", 403);
  }

  return next();
}
