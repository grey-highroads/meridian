import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { synthesizeWithChatCompletions } from "../src/brand-brain/chat-completions-provider.js";
import { saveBrandBrainSnapshot, synthesizeBrandBrain } from "../src/brand-brain/service.js";
import { createFileBrandBrainStore } from "../src/brand-brain/store.js";
import { generateProductionImage, prepareProductionPackage, readProductionJob } from "../src/production/service.js";
import { createFileProductionStore } from "../src/production/store.js";

export { mergeIncrementalSources, selectApprovedBaseline } from "../src/brand-brain/service.js";
export { assertSafeRemoteUrl, readRemotePage } from "../src/brand-brain/source-reader.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtAppRoot = path.join(projectRoot, "dist");
const appRoot = existsSync(builtAppRoot) ? builtAppRoot : path.join(projectRoot, "app");
const defaultStorePath = path.join(projectRoot, ".data", "brand-brain.json");
const defaultProductionRoot = path.join(projectRoot, ".data", "production");

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

async function readLocalEnv() {
  try {
    return loadEnvFile(await fs.readFile(path.join(projectRoot, ".env.local"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJson(request, limit = 55 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error("The source batch is larger than the 50 MB request limit.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("The request body is not valid JSON.");
    error.status = 400;
    throw error;
  }
}

async function serveStatic(request, response) {
  const requestPath = new URL(request.url, "http://localhost").pathname;
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(appRoot, relative);
  if (filePath !== appRoot && !filePath.startsWith(`${appRoot}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(data);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end(error.code === "ENOENT" ? "Not found" : "Server error");
  }
}

export function createBrandWorldServer(options = {}) {
  const storePath = options.storePath || process.env.BRAND_BRAIN_STORE_PATH || defaultStorePath;
  const store = options.store || createFileBrandBrainStore(storePath);
  const productionStore = options.productionStore || createFileProductionStore(options.productionRoot || defaultProductionRoot);
  const fetchImpl = options.fetchImpl || fetch;
  const synthesize = options.synthesize || synthesizeWithChatCompletions;
  const renderImage = options.renderImage;
  const envPromise = options.env ? Promise.resolve(options.env) : readLocalEnv();

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (request.method === "GET" && url.pathname === "/api/brand-brain") {
        sendJson(response, 200, { saved: await store.read() });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/brand-brain/save") {
        const snapshot = await readJson(request, 5 * 1024 * 1024);
        const saved = await saveBrandBrainSnapshot(snapshot, store);
        sendJson(response, 200, { savedAt: saved.savedAt });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/brand-brain/synthesize") {
        const body = await readJson(request);
        const env = { ...process.env, ...(await envPromise) };
        const saved = await synthesizeBrandBrain(body, { store, fetchImpl, synthesize, env });
        sendJson(response, 200, saved);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/production/preflight") {
        const body = await readJson(request, 1024 * 1024);
        const { generationPackage } = await prepareProductionPackage(body, { brainStore: store });
        sendJson(response, 200, { generationPackage });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/production/generate") {
        const body = await readJson(request, 1024 * 1024);
        const env = { ...process.env, ...(await envPromise) };
        const job = await generateProductionImage(body, {
          brainStore: store,
          productionStore,
          env,
          fetchImpl,
          render: renderImage,
        });
        if (job?.status === "complete") job.imageUrl = `/api/production/image?jobId=${encodeURIComponent(job.jobId)}`;
        sendJson(response, 200, { job });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/production/current") {
        const job = await readProductionJob({ productionStore });
        if (job?.status === "complete") job.imageUrl = `/api/production/image?jobId=${encodeURIComponent(job.jobId)}`;
        sendJson(response, 200, { job });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/production/image") {
        const job = await productionStore.read();
        if (!job?.imagePathname || job.jobId !== url.searchParams.get("jobId")) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }
        const bytes = await productionStore.readImage(job.imagePathname);
        response.writeHead(200, { "Content-Type": job.imageContentType || "image/png", "Cache-Control": "private, no-store" });
        response.end(bytes);
        return;
      }
      await serveStatic(request, response);
    } catch (error) {
      const status = error.status && Number.isInteger(error.status) ? error.status : 500;
      const publicMessage = status >= 500 && !error.message ? "The server could not complete this request." : error.message;
      console.error(`[brand-world-server] ${publicMessage}`);
      sendJson(response, status, { error: publicMessage });
    }
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 4173);
  createBrandWorldServer().listen(port, "127.0.0.1", () => {
    console.log(`Brand World System is running at http://localhost:${port}`);
  });
}
