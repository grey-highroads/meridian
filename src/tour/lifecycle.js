// Where a Scene has got to, worked out from what is stored rather than from a
// status somebody typed. Every input here is either a durable stored object or
// a line in the append-only Scene record. Nothing compiled on demand is read,
// because a draft brief that exists only for the length of one request cannot
// tell you where the work is.
//
// The eight stages are the ones in docs/meridian-product-architecture.md. The
// most advanced durable evidence wins, so a Scene that has been through
// several rounds reports the round it is in now.
//
// One note on concept review. This phase has no separate record of a client
// approving a concept, so the available evidence for concept review is a
// frozen brief that has not gone out. When a later phase adds a distinct
// concept-approval record, the concept review mapping moves to that record and
// this comment comes out with it. Nothing here says a client approved a
// concept, because no such approval exists yet.

// The one action string that says a brief went out. It lives here because the
// lifecycle reads it and the tour route writes it, and two copies of it would
// drift.
export const SENT_TO_PRODUCTION = "Sent the brief to production";

export const STAGES = {
  draftRequest: "Draft request",
  requested: "Requested",
  conceptInDevelopment: "Concept in development",
  conceptReview: "Concept review",
  approvedForProduction: "Approved for production",
  productionReview: "Production review",
  finalApproved: "Final approved",
  delivered: "Delivered",
};

// Plain party names. The record says who the work waits on; nobody owns a
// stage.
export const PARTIES = {
  client: "the client",
  higherRoads: "Higher Roads",
  production: "production",
  noOne: "no one",
};

function list(value) {
  return Array.isArray(value) ? value : [];
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function frozenBriefs(briefs) {
  return list(briefs).filter((entry) => entry && entry.status === "frozen");
}

function highest(values) {
  return values.reduce((carried, value) => (value > carried ? value : carried), 0);
}

// A brief went out when the record says so, or when an artboard came back
// against it. Either one is durable and neither can be undone.
function briefWentOut(scene) {
  const said = list(scene.facts).some((entry) => entry && entry.action === SENT_TO_PRODUCTION);
  return said || list(scene.artboards).length > 0;
}

// The most advanced versioned Scene object. Briefs until an artboard exists,
// then artboards. Never the tour's direction version, which belongs to the
// tour and not to this Scene.
export function currentVersionOf(scene) {
  const artboards = list(scene.artboards);
  if (artboards.length) {
    const versions = artboards.map((entry) => Number((entry.artboard || {}).artboardVersion) || 0);
    return `Artboard V${pad(highest(versions))}`;
  }
  const frozen = frozenBriefs(scene.briefs);
  if (frozen.length) return `Brief V${pad(highest(frozen.map((entry) => Number(entry.briefVersion) || 0)))}`;
  return null;
}

function stageOf(scene) {
  const approvals = scene.approvals || {};
  if (list(scene.deliveries).length) return STAGES.delivered;
  if (list(approvals.clientApprovals).length) return STAGES.finalApproved;
  if (list(scene.artboards).length) return STAGES.productionReview;
  if (briefWentOut(scene)) return STAGES.approvedForProduction;
  if (frozenBriefs(scene.briefs).length) return STAGES.conceptReview;
  if (scene.concept) return STAGES.conceptInDevelopment;
  if (scene.request) return STAGES.requested;
  return STAGES.draftRequest;
}

// One job per stage, in the words a tour manager would use. Alternatives at a
// stage, and the buttons that carry them, belong to the Scene workspace.
function jobAt(stage, scene) {
  if (stage === STAGES.delivered) {
    return { waitingOn: PARTIES.noOne, nextAction: "Nothing is outstanding on this Scene." };
  }
  if (stage === STAGES.finalApproved) {
    return { waitingOn: PARTIES.production, nextAction: "Hand the approved version to production." };
  }
  if (stage === STAGES.productionReview) {
    const artboards = list(scene.artboards);
    const versions = artboards.map((entry) => Number((entry.artboard || {}).artboardVersion) || 0);
    const latest = highest(versions);
    const cleared = list((scene.approvals || {}).readyForClient)
      .some((entry) => Number(entry.artboardVersion) === latest);
    return cleared
      ? { waitingOn: PARTIES.client, nextAction: "Wait for the client's decision on the latest version." }
      : { waitingOn: PARTIES.higherRoads, nextAction: "Review the latest version." };
  }
  if (stage === STAGES.approvedForProduction) {
    return { waitingOn: PARTIES.production, nextAction: "Wait for production to send the artboard back." };
  }
  if (stage === STAGES.conceptReview) {
    return { waitingOn: PARTIES.higherRoads, nextAction: "Send the brief to production." };
  }
  if (stage === STAGES.conceptInDevelopment) {
    return { waitingOn: PARTIES.higherRoads, nextAction: "Freeze the brief for the chosen concept." };
  }
  if (stage === STAGES.requested) {
    return { waitingOn: PARTIES.higherRoads, nextAction: "Develop a concept for this Scene." };
  }
  return { waitingOn: PARTIES.higherRoads, nextAction: "Finish the request and submit it." };
}

export function sceneLifecycle(scene = {}) {
  const stage = stageOf(scene);
  return { stage, currentVersion: currentVersionOf(scene), ...jobAt(stage, scene) };
}

// Which route the work took, read from what the concept says it came from. A
// concept that names nothing keeps naming nothing, because a path invented
// after the fact is worth less than a blank.
export function conceptPath(concept) {
  const cameFrom = String((concept && concept.cameFrom) || "").trim();
  if (!cameFrom) return null;
  return /^(suggestion|proposal)\b/i.test(cameFrom) ? "brain-assisted" : "direct";
}
