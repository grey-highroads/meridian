import { TOUR_ID, scopedBody } from "./context.js";

// One returned artboard, resolved to something a page can put on screen.
//
// The seam hands work back in three shapes. A small file arrives inline as a
// data address. A real uploaded file arrives as a path into private storage and
// has to be exchanged for a link that opens. The stand-in returns drawing
// markup as text. Both the operator page and the client page need all three, so
// the resolution lives here once rather than twice.
//
// A read that does not come back leaves the source empty. The page shows its
// empty frame and the person is not handed a broken link.

const DRAWING_PREFIX = "data:image/svg+xml;charset=utf-8,";
const DRAWING_TYPE = "image/svg+xml";

async function postUpload(body) {
  const response = await fetch("/api/tour-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed.error || "That work file could not be opened.");
  return parsed;
}

async function openLink(pathname, options) {
  const post = options.readUpload || postUpload;
  try {
    const parsed = await post(scopedBody({
      mode: "read",
      tourId: options.tourId || TOUR_ID,
      assignmentId: options.assignmentId || null,
      pathname,
    }));
    return (parsed && parsed.presignedUrl) || null;
  } catch {
    return null;
  }
}

export async function resolveArtifact(item, options = {}) {
  const returned = item || {};
  const resolved = {
    src: null,
    contentType: returned.contentType || null,
    name: returned.name || null,
  };
  if (returned.dataUrl) return { ...resolved, src: returned.dataUrl };
  if (returned.blobPathname) {
    const link = await openLink(returned.blobPathname, options);
    if (link) return { ...resolved, src: link };
  }
  if (returned.svg) {
    return {
      ...resolved,
      src: DRAWING_PREFIX + encodeURIComponent(returned.svg),
      contentType: returned.contentType || DRAWING_TYPE,
    };
  }
  return resolved;
}
