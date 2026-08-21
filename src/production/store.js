import fs from "node:fs/promises";
import path from "node:path";
import { del, get, issueSignedToken, presignUrl, put } from "@vercel/blob";

// Client-namespaced production state and images. Client id is server-resolved
// and threaded in through the store factory. See ADR 0011.
const DEFAULT_CLIENT_ID = "default";
// Pre-namespace deployments wrote production state to a single flat path. The
// default client reads through to it once so an in-flight job is not stranded,
// then the next save moves it into the namespace. Remove after the flat blob
// is gone.
const LEGACY_FLAT_PRODUCTION_PATHNAME = "brand-world-system/production/current.json";

function clientRoot(clientId) {
  return `brand-world-system/clients/${clientId}`;
}

function productionStatePathname(clientId) {
  return `${clientRoot(clientId)}/production/current.json`;
}

function productionImagePathname(clientId, jobId, extension) {
  return `${clientRoot(clientId)}/production/jobs/${jobId}/output.${extension}`;
}

function outputPackagePathname(clientId, jobId) {
  return `${clientRoot(clientId)}/production/jobs/${jobId}/package.json`;
}

function outputsPathname(clientId) {
  return `${clientRoot(clientId)}/production/outputs.json`;
}

export function createFileProductionStore(rootPath) {
  const statePath = path.join(rootPath, "current.json");
  const imageRoot = path.join(rootPath, "images");
  return {
    async read() {
      try {
        return JSON.parse(await fs.readFile(statePath, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async write(value) {
      await fs.mkdir(rootPath, { recursive: true });
      await fs.writeFile(statePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    },
    async writeImage(jobId, bytes, contentType = "image/png") {
      await fs.mkdir(imageRoot, { recursive: true });
      const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
      const imagePath = path.join(imageRoot, `${jobId}.${extension}`);
      await fs.writeFile(imagePath, bytes, { mode: 0o600 });
      return { pathname: imagePath, contentType };
    },
    async readImage(pathname) {
      return fs.readFile(pathname);
    },
    async writeOutputPackage(jobId, value) {
      await fs.mkdir(path.join(rootPath, "packages"), { recursive: true });
      await fs.writeFile(path.join(rootPath, "packages", `${jobId}.json`), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    },
    async readOutputPackage(jobId) {
      try {
        return JSON.parse(await fs.readFile(path.join(rootPath, "packages", `${jobId}.json`), "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async deleteOutputArtifacts(jobId) {
      const targets = [path.join(rootPath, "packages", `${jobId}.json`)];
      for (const extension of ["png", "jpg", "webp"]) targets.push(path.join(imageRoot, `${jobId}.${extension}`));
      for (const target of targets) {
        try {
          await fs.unlink(target);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    },
    async readOutputs() {
      try {
        return JSON.parse(await fs.readFile(path.join(rootPath, "outputs.json"), "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async writeOutputs(value) {
      await fs.mkdir(rootPath, { recursive: true });
      await fs.writeFile(path.join(rootPath, "outputs.json"), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    },
  };
}

export function createVercelBlobProductionStore(options = {}) {
  const token = options.token || process.env.BLOB_READ_WRITE_TOKEN;
  const clientId = options.clientId || DEFAULT_CLIENT_ID;
  const credentials = token ? { token } : {};

  // Images are stored privately. Generate a short-lived presigned URL for the
  // client to display the image.
  async function signImageUrl(pathname) {
    const validUntil = Date.now() + 15 * 60 * 1000;
    const signedToken = await issueSignedToken({ ...credentials, pathname, operations: ["get"], validUntil });
    const result = await presignUrl(signedToken, { access: "private", operation: "get", pathname, validUntil });
    return result.presignedUrl;
  }

  async function readJsonBlobOrNull(pathname) {
    const result = await get(pathname, { access: "private", ...credentials, useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream) throw new Error("The saved production job could not be read.");
    return JSON.parse(await new Response(result.stream).text());
  }

  return {
    async read() {
      const current = await readJsonBlobOrNull(productionStatePathname(clientId));
      if (current !== null) return current;
      if (clientId === DEFAULT_CLIENT_ID) return readJsonBlobOrNull(LEGACY_FLAT_PRODUCTION_PATHNAME);
      return null;
    },
    async write(value) {
      await put(productionStatePathname(clientId), JSON.stringify(value), {
        access: "private",
        ...credentials,
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    },
    async writeImage(jobId, bytes, contentType = "image/png") {
      const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
      const pathname = productionImagePathname(clientId, jobId, extension);
      const blob = await put(pathname, bytes, {
        access: "private",
        ...credentials,
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType,
        cacheControlMaxAge: 60,
      });
      return { pathname, contentType, url: blob.url };
    },
    imageUrl: signImageUrl,
    // Output images are written at a path derived from the job id, always as
    // PNG (see renderProduction). Presigned URLs expire after fifteen minutes,
    // so the output log stores a stale string and callers mint a fresh one at
    // read time rather than trusting what was persisted.
    async outputImageUrl(jobId) {
      return signImageUrl(productionImagePathname(clientId, jobId, "png"));
    },
    // The compiled package is the durable record of what the brand asserted when
    // this output was made. It is written per job so an output stays reviewable
    // after the single current-job slot moves on.
    async writeOutputPackage(jobId, value) {
      await put(outputPackagePathname(clientId, jobId), JSON.stringify(value), {
        access: "private",
        ...credentials,
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    },
    async readOutputPackage(jobId) {
      return readJsonBlobOrNull(outputPackagePathname(clientId, jobId));
    },
    // Discarding an output is a hard delete. The image and the package go with
    // the log record so nothing is left to resurface or pay storage for.
    async deleteOutputArtifacts(jobId) {
      await Promise.all([
        del(productionImagePathname(clientId, jobId, "png"), { ...credentials }).catch(() => {}),
        del(outputPackagePathname(clientId, jobId), { ...credentials }).catch(() => {}),
      ]);
    },
    // Reads an output's picture back as bytes. Added for the place on
    // background page, which draws a finished output onto a canvas. A canvas
    // that has been given a picture from another domain refuses to hand its
    // pixels back, and every image the browser sees today arrives through a
    // signed link on the storage domain, so the pixels have to come through
    // our own origin instead. Nothing on the render path calls this.
    async readOutputImageBytes(jobId) {
      const pathname = productionImagePathname(clientId, jobId, "png");
      const result = await get(pathname, { access: "private", ...credentials, useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return {
        bytes: Buffer.from(await new Response(result.stream).arrayBuffer()),
        contentType: result.blob?.contentType || "image/png",
      };
    },
    async readOutputs() {
      return readJsonBlobOrNull(outputsPathname(clientId));
    },
    async writeOutputs(value) {
      await put(outputsPathname(clientId), JSON.stringify(value), {
        access: "private",
        ...credentials,
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    },
  };
}
