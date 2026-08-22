import { get, put } from "@vercel/blob";
import { createBlobBackend, createMemoryBackend } from "../artist/store.js";
import { tourPathFor } from "../tour/store.js";

// Storage for what comes back across the seam, in the tour's blob scope beside
// the concept and the briefs. It has its own write because src/tour/store.js
// handles JSON only and an artboard is a file.
//
// Two things per assignment:
//
//   artboards.json          Every artboard version with the receipt that came
//                           with it, in order. Written once per version and
//                           never rewritten. A revision makes a new version.
//   artboards/v{n}.svg      The artifact for that version. Written once.

export { createBlobBackend, createMemoryBackend };

// The artifact is a file rather than a document, so it needs its own content
// type. Everything else about the write matches the JSON backend.
export function createArtifactBackend(options = {}) {
  const token = options.token || process.env.BLOB_READ_WRITE_TOKEN;
  const credentials = token ? { token } : {};
  return {
    async read(pathname) {
      const result = await get(pathname, { access: "private", ...credentials, useCache: false });
      if (!result) return null;
      if (result.statusCode !== 200 || !result.stream) throw new Error("That artboard could not be read.");
      return await new Response(result.stream).text();
    },
    async write(pathname, body) {
      await put(pathname, body, {
        access: "private",
        ...credentials,
        allowOverwrite: false,
        addRandomSuffix: false,
        contentType: "image/svg+xml",
        cacheControlMaxAge: 0,
      });
    },
  };
}

export function createArtboardStore(options = {}) {
  const backend = options.backend || createBlobBackend(options);
  // Tests hand one backend and get one place to look. On the deployment the
  // artifact goes through a write that sets the file's content type.
  const artifacts = options.artifactBackend || (options.backend ? options.backend : createArtifactBackend(options));

  return {
    async readArtboards(tourId, assignmentId) {
      const body = await backend.read(tourPathFor(tourId, assignmentId, "artboards"));
      if (body === null || body === undefined) return [];
      const stored = JSON.parse(body);
      return Array.isArray(stored.versions) ? stored.versions : [];
    },

    async readArtifact(pathname) {
      return await artifacts.read(pathname);
    },

    // Written once. A version that already exists is never touched again,
    // which is what lets a person be held to the version they reviewed.
    async addArtboard(tourId, assignmentId, entry, artifactBody) {
      const versions = await this.readArtboards(tourId, assignmentId);
      if (versions.some((stored) => stored.artboard.artboardVersion === entry.artboard.artboardVersion)) {
        const error = new Error("That artboard version already exists.");
        error.status = 409;
        throw error;
      }
      await artifacts.write(entry.artboard.artifact.location, artifactBody);
      versions.push(entry);
      versions.sort((left, right) => left.artboard.artboardVersion - right.artboard.artboardVersion);
      await backend.write(
        tourPathFor(tourId, assignmentId, "artboards"),
        JSON.stringify({ versions }, null, 2),
      );
      return entry;
    },
  };
}
