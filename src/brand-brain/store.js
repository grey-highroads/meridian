import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

// Every client's durable state lives under its own namespace. The client id is
// server-resolved and threaded in through the store factory. See ADR 0011.
const DEFAULT_CLIENT_ID = "default";
// The pre-namespace deployment wrote the brain to a single flat path. The
// default client reads through to it once so existing state is not stranded,
// then the next save moves it into the namespace. Remove after the flat blob
// is gone.
const LEGACY_FLAT_STATE_PATHNAME = "brand-world-system/state/current.json";
const LEGACY_SOURCES_PREFIX = "brand-world-system/sources/";

function clientRoot(clientId) {
  return `brand-world-system/clients/${clientId}`;
}

function brainStatePathname(clientId) {
  return `${clientRoot(clientId)}/state/current.json`;
}

function sourcesPrefix(clientId) {
  return `${clientRoot(clientId)}/sources/`;
}

// A backup path is derived from the moment it is taken and is never reused.
// Colons and dots are stripped because the timestamp becomes part of a URL.
function brainBackupPathname(clientId, takenAt = new Date()) {
  const stamp = takenAt.toISOString().replace(/[:.]/g, "-");
  return `${clientRoot(clientId)}/state/backups/brand-brain-backup-${stamp}.json`;
}

export function createFileBrandBrainStore(storePath) {
  return {
    async read() {
      try {
        return JSON.parse(await fs.readFile(storePath, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async write(value) {
      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    },
    async writeBackup(value) {
      const backupPath = path.join(path.dirname(storePath), "backups", `brand-brain-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.writeFile(backupPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      return backupPath;
    },
    async readSourceFile() {
      throw new Error("Hosted source storage is not configured for this local server.");
    },
  };
}

export function createVercelBlobBrandBrainStore(options = {}) {
  const token = options.token || process.env.BLOB_READ_WRITE_TOKEN;
  const clientId = options.clientId || DEFAULT_CLIENT_ID;
  const credentials = token ? { token } : {};

  async function readJsonBlobOrNull(pathname) {
    const result = await get(pathname, { access: "private", ...credentials, useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream) throw new Error("The stored Brand Brain could not be read.");
    return JSON.parse(await new Response(result.stream).text());
  }

  return {
    async read() {
      const current = await readJsonBlobOrNull(brainStatePathname(clientId));
      if (current !== null) return current;
      if (clientId === DEFAULT_CLIENT_ID) return readJsonBlobOrNull(LEGACY_FLAT_STATE_PATHNAME);
      return null;
    },
    async write(value) {
      await put(brainStatePathname(clientId), JSON.stringify(value), {
        access: "private",
        ...credentials,
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    },
    // Written before a synthesis that would replace the stored payload rather
    // than add a candidate beside it. Overwrite is refused: a backup that can
    // be overwritten is not a backup. See the failure states in stage 1 of the
    // image pipeline contract.
    async writeBackup(value) {
      const backupPath = brainBackupPathname(clientId);
      await put(backupPath, JSON.stringify(value), {
        access: "private",
        ...credentials,
        allowOverwrite: false,
        addRandomSuffix: false,
        contentType: "application/json",
      });
      return backupPath;
    },
    async readSourceFile(pathname) {
      const namespaced = sourcesPrefix(clientId);
      const allowed = pathname && (String(pathname).startsWith(namespaced) || String(pathname).startsWith(LEGACY_SOURCES_PREFIX));
      if (!allowed) {
        throw new Error("The stored source file reference is invalid.");
      }
      const result = await get(pathname, { access: "private", ...credentials, useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) throw new Error("One of the stored source files could not be read.");
      return {
        bytes: Buffer.from(await new Response(result.stream).arrayBuffer()),
        mimeType: result.blob.contentType,
        size: result.blob.size,
      };
    },
  };
}
