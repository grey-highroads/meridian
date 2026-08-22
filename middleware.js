import { next } from "@vercel/functions";

const SESSION_COOKIE = "bws_session";

function authorized(request, password) {
  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const separator = decoded.indexOf(":");
      if (separator !== -1 && decoded.slice(0, separator) === "brandworld" && decoded.slice(separator + 1) === password) {
        return true;
      }
    } catch {}
  }
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.split(";").map(c => c.trim()).find(c => c.startsWith(SESSION_COOKIE + "="));
  if (match) {
    const token = match.slice(SESSION_COOKIE.length + 1);
    try {
      const decoded = atob(token);
      return decoded === "brandworld:" + password;
    } catch {}
  }
  return false;
}

// Paths that load without any authentication.
const PUBLIC_PATHS = new Set(["/landing.html", "/api/blob/upload", "/api/auth/login"]);

export default function middleware(request) {
  const pathname = new URL(request.url).pathname;
  if (PUBLIC_PATHS.has(pathname)) return next();

  const password = process.env.BRAND_WORLD_ACCESS_PASSWORD;
  if (!password) {
    return new Response("This Brand World installation still needs its access password configured.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  if (authorized(request, password)) return next();

  // Unauthenticated visitors hitting the root get the landing page.
  if (pathname === "/" || pathname === "/index.html" || pathname === "/bws.html") {
    return Response.redirect(new URL("/landing.html", request.url), 302);
  }

  // Everything else gets a 401 with Basic Auth challenge (preserves API/CLI access).
  return new Response("Enter the Brand World installation password to continue.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Brand World System", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
