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

import { CLIENT_ROLE } from "../org/roles.js";

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
// The newest artboard version as a number, or null when none has come back.
// The gallery is addressed by scene and version, so a link needs the number
// rather than the label currentVersionOf builds for a reader.
export function currentArtboardVersionOf(scene) {
  const artboards = list(scene.artboards);
  if (!artboards.length) return null;
  return highest(artboards.map((entry) => Number((entry.artboard || {}).artboardVersion) || 0)) || null;
}

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
//
// Two sentences per stage, because two people read them. The stage and who the
// work waits on are facts and read the same for everyone. The sentence under
// them is copy, and copy is addressed. Higher Roads is told what we do next.
// The client is told whether anything is needed from her, in words written to
// her. Nothing is withheld by this. The same Scene is described to two people
// who need different things from the description, and the description a client
// receives is a server decision rather than something a page decides to show.
function jobAt(stage, scene) {
  if (stage === STAGES.delivered) {
    return {
      waitingOn: PARTIES.noOne,
      nextAction: "Final media has been delivered.",
      clientAction: "This Scene has been delivered. Nothing is needed from you.",
    };
  }
  if (stage === STAGES.finalApproved) {
    return {
      waitingOn: PARTIES.production,
      nextAction: "Prepare the approved version for final delivery.",
      clientAction: "You approved this Scene. The media team is finishing it. Nothing is needed from you.",
    };
  }
  if (stage === STAGES.productionReview) {
    const artboards = list(scene.artboards);
    const versions = artboards.map((entry) => Number((entry.artboard || {}).artboardVersion) || 0);
    const latest = highest(versions);
    const cleared = list((scene.approvals || {}).readyForClient)
      .some((entry) => Number(entry.artboardVersion) === latest);
    return cleared
      ? {
        waitingOn: PARTIES.client,
        nextAction: "Review the latest version.",
        clientAction: "New work is ready for you to look at.",
      }
      : {
        waitingOn: PARTIES.higherRoads,
        nextAction: "Review the latest version before it goes to the client.",
        clientAction: "Higher Roads is looking at the work that came back. Nothing is needed from you.",
      };
  }
  if (stage === STAGES.approvedForProduction) {
    return {
      waitingOn: PARTIES.production,
      nextAction: "The media team is working on the next version.",
      clientAction: "The media team is building this Scene. Nothing is needed from you.",
    };
  }
  if (stage === STAGES.conceptReview) {
    return {
      waitingOn: PARTIES.higherRoads,
      nextAction: "Send the brief to the media team.",
      clientAction: "Higher Roads is getting this Scene ready for the media team. Nothing is needed from you.",
    };
  }
  if (stage === STAGES.conceptInDevelopment) {
    return {
      waitingOn: PARTIES.higherRoads,
      nextAction: "Prepare this Scene for production.",
      clientAction: "Higher Roads is developing this Scene. Nothing is needed from you.",
    };
  }
  if (stage === STAGES.requested) {
    return {
      waitingOn: PARTIES.higherRoads,
      nextAction: "Develop this Scene.",
      clientAction: "Higher Roads is developing this Scene. Nothing is needed from you.",
    };
  }
  return {
    waitingOn: PARTIES.higherRoads,
    nextAction: "Finish the request and submit it.",
    clientAction: "This request has not been sent yet.",
  };
}

// The reader decides which sentence comes back. A caller that names no role
// gets the Higher Roads sentence, because everything inside the app that reads
// a Scene without a session is us.
export function sceneLifecycle(scene = {}, role = "") {
  const stage = stageOf(scene);
  const job = jobAt(stage, scene);
  return {
    stage,
    currentVersion: currentVersionOf(scene),
    currentArtboardVersion: currentArtboardVersionOf(scene),
    waitingOn: job.waitingOn,
    nextAction: role === CLIENT_ROLE ? job.clientAction : job.nextAction,
  };
}

// Which route the work took, read from what the concept says it came from. A
// concept that names nothing keeps naming nothing, because a path invented
// after the fact is worth less than a blank.
export function conceptPath(concept) {
  const cameFrom = String((concept && concept.cameFrom) || "").trim();
  if (!cameFrom) return null;
  return /^(suggestion|proposal)\b/i.test(cameFrom) ? "brain-assisted" : "direct";
}
