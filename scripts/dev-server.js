import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CLIENT_HOME,
  clientMayLoad,
  isPage,
  isStaticAsset,
  PUBLIC_PATHS,
} from "../middleware.js";
import { CLIENT_ROLE } from "../src/org/roles.js";
import { readCookie, readSession, SESSION_COOKIE, sessionSecret } from "../src/org/session.js";

// The local runtime for the whole application: every function under api/,
// behind the same page gate the edge middleware applies, in front of the
// built app in dist/. Before this, only the retired Brand World routes ran
// locally and every Meridian change was verified by deploying. That workflow
// is over: pnpm dev runs the same handlers the deployment runs.
//
// The gate mirrors middleware.js by importing its path sets rather than
// keeping a second list that has to agree with the first. The middleware
// itself is written for the edge runtime and its next() helper, so the
// decision logic is restated here against Node primitives; the sets and the
// helpers are shared, which is where drift would actually happen.
//
// Storage and the model are the real ones. Handlers read process.env, so
// .env.local is loaded into it below. A local run against the deployed data
// needs BLOB_READ_WRITE_TOKEN from the Vercel project's Blob store; point it
// at a separate dev store unless reading production data is the point.
// MERIDIAN_OPERATOR and MERIDIAN_CLIENT are required to sign in, exactly as
// on the deployment.

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtAppRoot = path.join(projectRoot, "dist");
const apiRoot = path.join(projectRoot, "api");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function loadEnvFile(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

async function loadLocalEnv() {
  let text;
  try {
    text = await fs.readFile(path.join(projectRoot, ".env.local"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  // Handlers read process.env directly, so the local values go there. A value
  // already set in the shell wins over the file.
  for (const [key, value] of Object.entries(loadEnvFile(text))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// api/tour -> api/tour/index.js, api/tour-upload -> api/tour-upload.js. The
// same file layout Vercel routes, resolved the same way, confined to api/.
async function apiHandler(pathname) {
  const trimmed = pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  if (!trimmed || trimmed.includes("..")) return null;
  const asFile = path.join(apiRoot, `${trimmed}.js`);
  const asIndex = path.join(apiRoot, trimmed, "index.js");
  const found = existsSync(asFile) ? asFile : existsSync(asIndex) ? asIndex : null;
  if (!found || !found.startsWith(apiRoot)) return null;
  const loaded = await import(pathToFileURL(found).href);
  return typeof loaded.default === "function" ? loaded.default : null;
}

function sendText(response, status, message, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(message);
}

async function sendStatic(response, pathname) {
  const wanted = pathname === "/" ? "/index.html" : pathname;
  const file = path.join(builtAppRoot, path.normalize(wanted));
  if (!file.startsWith(builtAppRoot)) return sendText(response, 404, "Not found.");
  let body;
  try {
    body = await fs.readFile(file);
  } catch {
    return sendText(response, 404, "Not found.");
  }
  response.writeHead(200, { "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream" });
  response.end(body);
}

// The same decisions middleware.js makes at the edge, from the same sets.
async function pageGate(request, pathname) {
  if (isStaticAsset(pathname)) return { allow: true };
  if (PUBLIC_PATHS.has(pathname)) return { allow: true };
  const claim = await readSession(readCookie(request.headers.cookie || "", SESSION_COOKIE), sessionSecret());
  if (!claim) {
    if (isPage(pathname)) return { redirect: "/landing.html" };
    return { deny: { status: 401, message: "Sign in to Meridian to continue." } };
  }
  if (claim.role === CLIENT_ROLE && !clientMayLoad(pathname)) {
    return { deny: { status: 403, message: "That part of Meridian is for the Higher Roads team. Your tour is at " + CLIENT_HOME + "." } };
  }
  return { allow: true };
}

async function main() {
  await loadLocalEnv();
  if (!existsSync(builtAppRoot)) {
    console.error("[meridian-dev] dist/ is missing. Run pnpm build first, or use pnpm dev, which builds before serving.");
    process.exit(1);
  }

  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://meridian.local").pathname;
    try {
      const gate = await pageGate(request, pathname);
      if (gate.redirect) return sendText(response, 302, "", { Location: gate.redirect });
      if (gate.deny) return sendText(response, gate.deny.status, gate.deny.message);

      if (pathname.startsWith("/api/")) {
        const handler = await apiHandler(pathname);
        if (!handler) return sendText(response, 404, "No function is deployed at this path.");
        return await handler(request, response);
      }
      return await sendStatic(response, pathname);
    } catch (error) {
      console.error(`[meridian-dev] ${request.method} ${pathname} failed:`, error);
      if (!response.headersSent) sendText(response, 500, "The server could not complete this request.");
      else response.end();
    }
  });

  const port = Number(process.env.PORT) || 4173;
  server.listen(port, () => {
    console.log(`[meridian-dev] Meridian is at http://localhost:${port}`);
    if (!process.env.MERIDIAN_OPERATOR || !process.env.MERIDIAN_CLIENT) {
      console.log("[meridian-dev] MERIDIAN_OPERATOR and MERIDIAN_CLIENT are not both set; nobody can sign in until they are.");
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.log("[meridian-dev] BLOB_READ_WRITE_TOKEN is not set; storage reads and writes will fail until it is.");
    }
  });
}

main();
