// A stand-in for Jim's side of the seam.
//
// Stand-in artboard. Jim's system replaces this in step 7.
//
// It exists so our half of the return loop can be proved before Jim's system is
// connected. It takes a frozen brief and gives back a receipt and an artboard
// shaped like the inbound placeholder in docs/meridian-seam-with-jim.md. It
// calls no image model and it makes no production artifact. What it returns is
// a card that carries the job it belongs to, so a person looking at a screen
// can see which brief produced which version.
//
// Its shape is ours, not Jim's. Nothing here is an obligation on his side, and
// the label travels on the file, on every payload, and on every screen that
// shows its output so nobody mistakes it for his work.

export const STAND_IN_LABEL = "Stand-in artboard. Jim's system replaces this in step 7.";

export const STAND_IN_SOURCE = "Stand-in for Jim's system";

const CARD_WIDTH = 1280;
const CARD_HEIGHT = 720;

export function artifactPathFor(tourId, assignmentId, artboardVersion) {
  return `brand-world-system/clients/${tourId}/tour/${assignmentId}/artboards/v${artboardVersion}.svg`;
}

function xml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Long summaries wrap by word so the card stays readable at any length.
export function wrap(text, perLine, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > perLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines;
}

// The colors here are the design system's stage and chalk values. They are
// written out because this file produces a stored artifact rather than a page,
// so it sits outside the app and cannot read a CSS variable.
export function renderArtboardCard({ jobId, briefVersion, artboardVersion, conceptSummary }) {
  const lines = wrap(conceptSummary, 52, 6);
  const body = lines
    .map((line, index) => `    <text class="s-body" x="80" y="${300 + index * 52}">${xml(line)}</text>`)
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" role="img" aria-label="${xml(STAND_IN_LABEL)}">
  <title>${xml(STAND_IN_LABEL)}</title>
  <style>
    .s-plate { fill: #14161a; }
    .s-rule { stroke: #3a4048; stroke-width: 2; }
    .s-meta { fill: #8b939d; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 22px; letter-spacing: 2px; }
    .s-body { fill: #eceef1; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 40px; }
    .s-label { fill: #d6a45c; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 24px; }
  </style>
  <rect class="s-plate" x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" />
  <line class="s-rule" x1="80" y1="196" x2="${CARD_WIDTH - 80}" y2="196" />
  <text class="s-meta" x="80" y="120">JOB ${xml(String(jobId).toUpperCase())}</text>
  <text class="s-meta" x="80" y="164">BRIEF V0${xml(briefVersion)} / ARTBOARD V0${xml(artboardVersion)}</text>
${body}
  <line class="s-rule" x1="80" y1="${CARD_HEIGHT - 120}" x2="${CARD_WIDTH - 80}" y2="${CARD_HEIGHT - 120}" />
  <text class="s-label" x="80" y="${CARD_HEIGHT - 72}">${xml(STAND_IN_LABEL)}</text>
</svg>
`;
}

// What the concept looks like once it has been built, in the stand-in's words.
// It restates the brief rather than inventing anything, because inventing here
// would put words about the artist into a record with no evidence behind them.
export function conceptSummaryFor(brief) {
  const concept = brief.chosenConcept || {};
  const parts = [concept.title, concept.idea].map((entry) => String(entry || "").trim()).filter(Boolean);
  return parts.length ? parts.join(". ") : "The brief carried no concept to build from.";
}

export function receiptFor(brief, receivedAt) {
  return {
    jobId: brief.jobId,
    briefVersion: brief.briefVersion,
    receivedAt,
    receivedBy: STAND_IN_SOURCE,
    standIn: true,
    label: STAND_IN_LABEL,
  };
}

// The inbound shape from docs/meridian-seam-with-jim.md section 6. Every field
// is present even when it is empty, so the screens and the tests read the same
// shape whether or not the stand-in had anything to say.
export function artboardFor(brief, { artboardVersion, artifact, receivedAt }) {
  const playback = (brief.technicalTarget || {}).playbackSystem;
  return {
    jobId: brief.jobId,
    briefVersion: brief.briefVersion,
    artboardVersion,
    status: "Ready for internal review",
    artifact,
    conceptSummary: conceptSummaryFor(brief),
    technicalAssumptions: [
      playback
        ? `Built against the playback line the brief named: ${playback}`
        : "The brief named no playback line, so nothing technical was assumed.",
    ],
    technicalFindings: [],
    warnings: [],
    unresolvedQuestions: [],
    receivedAt,
    standIn: true,
    label: STAND_IN_LABEL,
  };
}

// One entry point. Given a frozen brief and the version this artboard should
// be, it returns the receipt, the artboard, and the SVG to store. It writes
// nothing itself, so the caller decides what is kept and in which order.
export function receiveBrief(brief, options = {}) {
  if (!brief || brief.status !== "frozen") {
    const error = new Error("Freeze the brief before sending it out.");
    error.status = 400;
    throw error;
  }
  const artboardVersion = options.artboardVersion || 1;
  const receivedAt = options.receivedAt || new Date().toISOString();
  const path = artifactPathFor(brief.tourId, brief.assignmentId, artboardVersion);
  const artboard = artboardFor(brief, {
    artboardVersion,
    artifact: { type: "artboard", format: "svg", location: path, label: STAND_IN_LABEL },
    receivedAt,
  });
  return {
    receipt: receiptFor(brief, receivedAt),
    artboard,
    artifactPath: path,
    artifactBody: renderArtboardCard({
      jobId: brief.jobId,
      briefVersion: brief.briefVersion,
      artboardVersion,
      conceptSummary: artboard.conceptSummary,
    }),
  };
}

// The same trip in the other direction. A revision against a named artboard
// version comes back as the next version. What changed is visible on the card,
// because a comparison between two versions that look the same tells a person
// nothing about whether their feedback landed.
export function receiveRevision(brief, revision, options = {}) {
  const artboardVersion = options.artboardVersion;
  if (!artboardVersion) {
    const error = new Error("A revision needs to know which version it is making.");
    error.status = 400;
    throw error;
  }
  const receivedAt = options.receivedAt || new Date().toISOString();
  const path = artifactPathFor(brief.tourId, brief.assignmentId, artboardVersion);
  const base = artboardFor(brief, {
    artboardVersion,
    artifact: { type: "artboard", format: "svg", location: path, label: STAND_IN_LABEL },
    receivedAt,
  });
  const changes = (revision.instructions || [])
    .map((entry) => (entry.regionAnchor ? `${entry.regionAnchor}: ${entry.text}` : entry.text))
    .filter(Boolean);
  const kept = (revision.preserve || []).filter(Boolean);
  const artboard = {
    ...base,
    conceptSummary: [
      base.conceptSummary,
      changes.length ? `Changed: ${changes.join(" ")}` : "",
      kept.length ? `Kept: ${kept.join(" ")}` : "",
    ].filter(Boolean).join(" "),
    builtFrom: {
      revisionId: revision.revisionId,
      sourceArtboardVersion: revision.sourceArtboardVersion,
    },
  };
  return {
    receipt: {
      ...receiptFor(brief, receivedAt),
      revisionId: revision.revisionId,
      sourceArtboardVersion: revision.sourceArtboardVersion,
    },
    artboard,
    artifactPath: path,
    artifactBody: renderArtboardCard({
      jobId: brief.jobId,
      briefVersion: brief.briefVersion,
      artboardVersion,
      conceptSummary: artboard.conceptSummary,
    }),
  };
}
