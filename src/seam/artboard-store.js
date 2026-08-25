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
//   reviews.json            Higher Roads' review of one artboard version.
//                           One per version, written once.
//   revisions.json          What went back across the seam against a named
//                           version. Written once per revision.
//   handoffs.json           Briefs and revisions issued to a named recipient.
//                           A handoff is the durable outbound half of the seam.
//   approvals.json          Who cleared which version for the client to see,
//                           which version the client approved, and what the
//                           client said. Three separate authorities.
//   production-intent.json  What production builds against. One record per
//                           client approval, appended, never replaced.

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
    async readApprovals(tourId, assignmentId) {
      const body = await backend.read(tourPathFor(tourId, assignmentId, "approvals"));
      const empty = { readyForClient: [], clientApprovals: [], comments: [] };
      if (body === null || body === undefined) return empty;
      const stored = JSON.parse(body);
      return {
        readyForClient: Array.isArray(stored.readyForClient) ? stored.readyForClient : [],
        clientApprovals: Array.isArray(stored.clientApprovals) ? stored.clientApprovals : [],
        comments: Array.isArray(stored.comments) ? stored.comments : [],
      };
    },

    async writeApprovals(tourId, assignmentId, approvals) {
      await backend.write(tourPathFor(tourId, assignmentId, "approvals"), JSON.stringify(approvals, null, 2));
      return approvals;
    },

    async readIntents(tourId, assignmentId) {
      const body = await backend.read(tourPathFor(tourId, assignmentId, "production-intent"));
      if (body === null || body === undefined) return [];
      const stored = JSON.parse(body);
      return Array.isArray(stored.intents) ? stored.intents : [];
    },

    // Appended. A later approval on a later version writes a new record and
    // the earlier one stays exactly as it was, because production may already
    // have built against it.
    async addIntent(tourId, assignmentId, intent) {
      const intents = await this.readIntents(tourId, assignmentId);
      if (intents.some((entry) => entry.artboardVersion === intent.artboardVersion)) {
        const error = new Error("That version is already the approved version.");
        error.status = 409;
        throw error;
      }
      intents.push(intent);
      await backend.write(tourPathFor(tourId, assignmentId, "production-intent"), JSON.stringify({ intents }, null, 2));
      return intent;
    },

    async readArtboards(tourId, assignmentId) {
      const body = await backend.read(tourPathFor(tourId, assignmentId, "artboards"));
      if (body === null || body === undefined) return [];
      const stored = JSON.parse(body);
      return Array.isArray(stored.versions) ? stored.versions : [];
    },

    async readArtifact(pathname) {
      return await artifacts.read(pathname);
    },

    async readReviews(tourId, assignmentId) {
      const body = await backend.read(tourPathFor(tourId, assignmentId, "reviews"));
      if (body === null || body === undefined) return [];
      const stored = JSON.parse(body);
      return Array.isArray(stored.reviews) ? stored.reviews : [];
    },

    // One review per artboard version. Changing a review after the fact would
    // let the record say something other than what the revision was sent on.
    async addReview(tourId, assignmentId, review) {
      const reviews = await this.readReviews(tourId, assignmentId);
      if (reviews.some((entry) => entry.artboardVersion === review.artboardVersion)) {
        const error = new Error("A review of that version is already written. Feedback on it makes a new version.");
        error.status = 409;
        throw error;
      }
      reviews.push(review);
      reviews.sort((left, right) => left.artboardVersion - right.artboardVersion);
      await backend.write(tourPathFor(tourId, assignmentId, "reviews"), JSON.stringify({ reviews }, null, 2));
      return review;
    },

    async readRevisions(tourId, assignmentId) {
      const body = await backend.read(tourPathFor(tourId, assignmentId, "revisions"));
      if (body === null || body === undefined) return [];
      const stored = JSON.parse(body);
      return Array.isArray(stored.revisions) ? stored.revisions : [];
    },

    async readHandoffs(tourId, assignmentId) {
      const body = await backend.read(tourPathFor(tourId, assignmentId, "handoffs"));
      if (body === null || body === undefined) return [];
      const stored = JSON.parse(body);
      return Array.isArray(stored.handoffs) ? stored.handoffs : [];
    },

    async addHandoff(tourId, assignmentId, handoff) {
      const handoffs = await this.readHandoffs(tourId, assignmentId);
      if (handoffs.some((entry) => entry.handoffId === handoff.handoffId)) {
        const error = new Error("That handoff has already been issued.");
        error.status = 409;
        throw error;
      }
      handoffs.push(handoff);
      await backend.write(tourPathFor(tourId, assignmentId, "handoffs"), JSON.stringify({ handoffs }, null, 2));
      return handoff;
    },

    async addRevision(tourId, assignmentId, revision) {
      const revisions = await this.readRevisions(tourId, assignmentId);
      if (revisions.some((entry) => entry.revisionId === revision.revisionId)) {
        const error = new Error("That revision has already been sent.");
        error.status = 409;
        throw error;
      }
      revisions.push(revision);
      await backend.write(tourPathFor(tourId, assignmentId, "revisions"), JSON.stringify({ revisions }, null, 2));
      return revision;
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

    // A human submission already put its artifact in private storage. Meridian
    // appends the version and receipt without copying or rewriting the file.
    async addSubmittedArtboard(tourId, assignmentId, entry) {
      const versions = await this.readArtboards(tourId, assignmentId);
      if (versions.some((stored) => stored.artboard.artboardVersion === entry.artboard.artboardVersion)) {
        const error = new Error("That artboard version already exists.");
        error.status = 409;
        throw error;
      }
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
