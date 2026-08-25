import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseTourFixture } from "../../src/tour/parse-fixture.js";
import { assembleContext } from "../../src/tour/select.js";
import { proposeConcepts } from "../../src/tour/propose.js";
import { createTourStore } from "../../src/tour/store.js";
import { compileBrief, findingSentence, freeze, nextBriefVersion, renderBriefDocument, renderBriefSidecar } from "../../src/tour/brief.js";
import { createArtboardStore } from "../../src/seam/artboard-store.js";
import { receiveBrief, receiveRevision, STAND_IN_LABEL } from "../../src/seam/stand-in.js";
import { createSceneRecord } from "../../src/tour/scene-record.js";
import { conceptPath, sceneLifecycle, SENT_TO_PRODUCTION } from "../../src/tour/lifecycle.js";
import { createArtistStore } from "../../src/artist/store.js";
import { buildArtistView } from "../../src/artist/service.js";
import { readJsonBody, requireUser, sanitizeClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { CLIENT_ROLE } from "../../src/org/store.js";

// The tour layer's one function. Actions: get-tour, get-assignment,
// assignment-context, propose-concepts, choose-concept, get-concept,
// compile-brief, freeze-brief, list-briefs, get-brief, send-brief,
// get-artboards, get-artboard-artifact, save-review, send-revision,
// get-reviews, approve-for-client, client-approve, client-comment,
// get-production-intent, get-scene-record.
//
// The tour reads the artist layer and never writes to it. Nothing here moves a
// finding, a claim, or a source. A tour is a temporary interpretation that sits
// above the brain without rewriting it.

export function tourDirectory(tourId) {
  return join(process.cwd(), "tours", tourId);
}

export async function readTourFixture(tourId, options = {}) {
  const reader = options.reader || readFile;
  const lister = options.lister || readdir;
  const directory = tourDirectory(tourId);
  const tour = await reader(join(directory, "tour.md"), "utf8");
  const names = (await lister(join(directory, "assignments"))).filter((name) => name.endsWith(".md")).sort();
  const assignments = [];
  for (const name of names) assignments.push(await reader(join(directory, "assignments", name), "utf8"));
  return { tour, assignments };
}

async function loadTour(tourId, options) {
  let texts;
  try {
    texts = await readTourFixture(tourId, options);
  } catch {
    const error = new Error("No tour is stored under that name.");
    error.status = 404;
    throw error;
  }
  return parseTourFixture(texts);
}

function findAssignment(fixture, assignmentId) {
  const assignment = fixture.assignments.find((entry) => entry.id === assignmentId);
  if (!assignment) {
    const error = new Error("That assignment was not found on this tour.");
    error.status = 404;
    throw error;
  }
  return assignment;
}

async function loadBrain(artistId, options) {
  const store = options.store || createArtistStore();
  const [record, decisions] = await Promise.all([store.readRecord(artistId), store.readDecisions(artistId)]);
  const brain = buildArtistView(record, decisions);
  if (!brain.approved || !brain.counts.inBrain) {
    const error = new Error("Approve this artist's brain before asking it to work on an assignment.");
    error.status = 400;
    throw error;
  }
  return brain;
}

async function contextFor(body, options) {
  const tourId = sanitizeClientId(body.tourId || "");
  const fixture = await loadTour(tourId, options);
  const assignment = findAssignment(fixture, body.assignmentId);
  const brain = await loadBrain(fixture.tour.artistId, options);
  return { fixture, assignment, context: assembleContext(brain, fixture.tour, assignment, options) };
}

// What the brand avoids is attached from the brain whether or not anyone asked
// it for suggestions, because a prohibition a person never saw is the one that
// costs the most. The brain's findings for this Scene's identity lead. Notes
// the brain wrote about this request follow, and a note that names a finding
// already attached is dropped.
export function avoidFor(context, notes) {
  const attached = (context.avoids || []).map((entry) => ({
    findingId: entry.findingId,
    text: findingSentence(entry.text),
  }));
  const seen = new Set(attached.map((entry) => entry.findingId));
  for (const note of Array.isArray(notes) ? notes : []) {
    const entry = typeof note === "string"
      ? { findingId: null, text: note }
      : { findingId: (note && note.findingId) || null, text: String((note && note.text) || "") };
    if (!entry.text.trim()) continue;
    if (entry.findingId && seen.has(entry.findingId)) continue;
    if (entry.findingId) seen.add(entry.findingId);
    attached.push(entry);
  }
  return attached;
}

// The nine places a person can point at on an artboard. The control that uses
// this is provisional: the register carries a pattern request for a real region
// anchor, and this list is the nearest thing the design system supports today.
export const REGIONS = [
  "Top left", "Top centre", "Top right",
  "Middle left", "Centre", "Middle right",
  "Bottom left", "Bottom centre", "Bottom right",
];

function textList(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => String(entry === null || entry === undefined ? "" : entry).trim())
    .filter(Boolean);
}

// An instruction carries what to change and, when someone marked one, where.
// The anchor is stored as given so it round trips to production unchanged, and
// an anchor that is not one of ours is dropped rather than passed on.
function instructionList(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => {
      const source = entry && typeof entry === "object" ? entry : { text: entry };
      const text = String(source.text === null || source.text === undefined ? "" : source.text).trim();
      const anchor = String(source.regionAnchor === null || source.regionAnchor === undefined ? "" : source.regionAnchor).trim();
      return { text, regionAnchor: REGIONS.includes(anchor) ? anchor : null };
    })
    .filter((entry) => entry.text);
}

// Everything at the end of the loop is about one artboard version, so they all
// resolve the same way.
async function atArtboard(body, options) {
  const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
  const assignment = findAssignment(fixture, body.assignmentId);
  const tourStore = options.tourStore || createTourStore();
  const artboardStore = options.artboardStore || createArtboardStore();
  const record = options.sceneRecord || createSceneRecord();
  const versions = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
  const wanted = Number(body.artboardVersion);
  const entry = versions.find((stored) => stored.artboard.artboardVersion === wanted);
  if (!entry) {
    const error = new Error("That artboard version was not found.");
    error.status = 404;
    throw error;
  }
  return { fixture, assignment, tourStore, artboardStore, record, entry, wanted };
}

// What a client reviewer may do. Their page shows the work, the version, the
// line saying what it is going for, and two controls, so these are the reads
// behind that page and the two things they can send. Everything else on this
// route is Higher Roads work.
//
// The check is here rather than on the page, because a page that hides a
// button is a page, and this route is what storage listens to.
const CLIENT_ACTIONS = new Set([
  "get-tour",
  "get-assignment",
  "get-artboards",
  "get-artboard-artifact",
  "get-brief",
  "get-production-intent",
  "client-approve",
  "client-comment",
]);

// Who is doing this. It comes from the signed session and never from the
// request body, so a name in a payload cannot put itself on an approval.
function signedIn(options) {
  const user = options.user;
  if (!user || !user.displayName || !user.role) {
    const error = new Error("Sign in to Meridian to continue.");
    error.status = 401;
    throw error;
  }
  if (user.role === CLIENT_ROLE && !CLIENT_ACTIONS.has(String(options.action || ""))) {
    const error = new Error("That part of Meridian is for the Higher Roads team.");
    error.status = 403;
    throw error;
  }
  return user;
}

export async function handleAction(body, options = {}) {
  const user = signedIn({ ...options, action: body.action });
  const actor = { actor: user.displayName, role: user.roleLabel };

  if (body.action === "get-tour") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const tourStore = options.tourStore || createTourStore();
    const artboardStore = options.artboardStore || createArtboardStore();
    const record = options.sceneRecord || createSceneRecord();
    const assignments = [];
    // Where each Scene has got to, read from what is stored for it. Nothing
    // here compiles a brief, because a draft that exists for the length of one
    // request is not evidence of anything.
    for (const entry of fixture.assignments) {
      const [concept, briefs, facts, artboards, approvals] = await Promise.all([
        tourStore.readConcept(fixture.tour.id, entry.id),
        tourStore.readBriefs(fixture.tour.id, entry.id),
        record.readFacts(fixture.tour.id, entry.id),
        artboardStore.readArtboards(fixture.tour.id, entry.id),
        artboardStore.readApprovals(fixture.tour.id, entry.id),
      ]);
      const state = sceneLifecycle({
        request: entry.requestedBy ? { requestedBy: entry.requestedBy, requestedOn: entry.requestedOn } : null,
        concept,
        briefs,
        facts,
        artboards,
        approvals,
        // Nothing in this phase records a delivery, so delivered is a stage the
        // module supports and the app cannot yet reach.
        deliveries: [],
      });
      assignments.push({
        id: entry.id,
        title: entry.title,
        moment: entry.moment,
        requestedBy: entry.requestedBy,
        requestedOn: entry.requestedOn,
        directionVersion: entry.directionVersion,
        ...state,
      });
    }
    return { tour: fixture.tour, assignments };
  }
  if (body.action === "get-assignment") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    return { tour: fixture.tour, assignment: findAssignment(fixture, body.assignmentId) };
  }
  if (body.action === "assignment-context") {
    const { fixture, assignment, context } = await contextFor(body, options);
    return { tour: fixture.tour, assignment, context };
  }
  if (body.action === "propose-concepts") {
    const { fixture, assignment, context } = await contextFor(body, options);
    const proposed = await proposeConcepts(context, options);
    return { tour: fixture.tour, assignment, context, ...proposed };
  }

  if (body.action === "choose-concept") {
    const { fixture, assignment, context } = await contextFor(body, options);
    const tourStore = options.tourStore || createTourStore();
    const source = body.concept || {};
    if (!String(source.title || "").trim() || !String(source.idea || "").trim()) {
      const error = new Error("A concept needs a title and an idea.");
      error.status = 400;
      throw error;
    }
    const briefs = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    if (briefs.some((entry) => entry.status === "frozen")) {
      const error = new Error("A brief is already frozen for this assignment. Changing the concept now means a new brief version.");
      error.status = 409;
      throw error;
    }
    // Intent, interpretation, and decision stay three separate things. What the
    // brain proposed is kept next to what the person made of it.
    const concept = {
      title: String(source.title).trim(),
      idea: String(source.idea).trim(),
      whyThisArtist: String(source.whyThisArtist || "").trim(),
      asksOfProduction: String(source.asksOfProduction || "").trim(),
      whereItMightMiss: String(source.whereItMightMiss || "").trim(),
      rhymesWith: Array.isArray(source.rhymesWith) ? source.rhymesWith : [],
      avoid: avoidFor(context, source.avoid),
      artistContext: Array.isArray(source.artistContext) ? source.artistContext : [],
      creativeLatitude: Array.isArray(source.creativeLatitude) ? source.creativeLatitude : [],
      openQuestions: Array.isArray(source.openQuestions) ? source.openQuestions : [],
      cameFrom: source.cameFrom || null,
      // Which paragraphs of the tour direction bear on this Scene, by position,
      // and who said so. The brief carries those and the version, never the
      // whole text. Ruled 2026-08-22.
      directionParagraphs: Array.isArray(source.directionParagraphs)
        ? source.directionParagraphs
            .map((entry) => Number(entry))
            .filter((entry) => Number.isInteger(entry) && entry >= 0)
        : [],
      // Which dates the rig differs on that bear on this Scene, by position in
      // the tour's setup. Same marking pattern as the direction paragraphs.
      venueExceptions: Array.isArray(source.venueExceptions)
        ? source.venueExceptions
            .map((entry) => Number(entry))
            .filter((entry) => Number.isInteger(entry) && entry >= 0)
        : [],
      directionSelectedBy: user.displayName,
      directionSelectedAt: new Date().toISOString(),
      shapedBy: user.displayName,
      shapedAt: new Date().toISOString(),
    };
    return { concept: await tourStore.writeConcept(fixture.tour.id, assignment.id, concept) };
  }
  if (body.action === "get-concept") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore();
    return { concept: await tourStore.readConcept(fixture.tour.id, assignment.id) };
  }
  if (body.action === "compile-brief") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore();
    const concept = await tourStore.readConcept(fixture.tour.id, assignment.id);
    const versions = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    const brief = compileBrief({
      tour: fixture.tour,
      assignment,
      concept,
      artistId: fixture.tour.artistId,
      briefVersion: nextBriefVersion(versions),
    });
    // A draft is not stored. It is compiled on demand from the concept and the
    // fixture, so nothing half made sits in storage pretending to be a brief.
    return { brief, document: renderBriefDocument(brief), sidecar: renderBriefSidecar(brief) };
  }
  if (body.action === "freeze-brief") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore();
    const concept = await tourStore.readConcept(fixture.tour.id, assignment.id);
    const versions = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    const compiled = compileBrief({
      tour: fixture.tour,
      assignment,
      concept,
      artistId: fixture.tour.artistId,
      briefVersion: nextBriefVersion(versions),
    });
    const frozen = freeze(compiled, user.displayName);
    await tourStore.addBrief(fixture.tour.id, assignment.id, frozen);
    const record = options.sceneRecord || createSceneRecord();
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: "Froze the brief",
      version: `Brief V0${frozen.briefVersion}`,
      path: conceptPath(concept),
    });
    return { brief: frozen, document: renderBriefDocument(frozen), sidecar: renderBriefSidecar(frozen) };
  }
  if (body.action === "list-briefs") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore();
    const versions = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    return {
      briefs: versions.map((entry) => ({
        jobId: entry.jobId,
        briefVersion: entry.briefVersion,
        directionVersion: entry.directionVersion,
        status: entry.status,
        frozenBy: entry.frozenBy,
        frozenAt: entry.frozenAt,
        title: entry.chosenConcept.title,
      })),
    };
  }
  if (body.action === "get-brief") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore();
    const versions = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    const brief = versions.find((entry) => entry.briefVersion === Number(body.briefVersion));
    if (!brief) {
      const error = new Error("That brief version was not found.");
      error.status = 404;
      throw error;
    }
    return { brief, document: renderBriefDocument(brief), sidecar: renderBriefSidecar(brief) };
  }

  // The seam. What goes out is one frozen brief. What comes back is an
  // artboard version and the receipt that came with it. The stand-in is ours
  // and its label travels on everything it produces, so its shape never
  // becomes Jim's obligation.
  if (body.action === "send-brief") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore();
    const artboardStore = options.artboardStore || createArtboardStore();
    const record = options.sceneRecord || createSceneRecord();

    const versions = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    const wanted = body.briefVersion === undefined || body.briefVersion === null
      ? null
      : Number(body.briefVersion);
    const frozen = versions.filter((entry) => entry.status === "frozen");
    const brief = wanted === null
      ? frozen[frozen.length - 1]
      : frozen.find((entry) => entry.briefVersion === wanted);
    if (!brief) {
      const error = new Error("Freeze the brief before sending it out.");
      error.status = 400;
      throw error;
    }

    const already = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
    if (already.some((entry) => entry.artboard.briefVersion === brief.briefVersion)) {
      const error = new Error("That brief version has already gone out. Feedback on the artboard is what goes out next.");
      error.status = 409;
      throw error;
    }

    const produced = receiveBrief(brief, { artboardVersion: 1 });
    const entry = { receipt: produced.receipt, artboard: produced.artboard };
    await artboardStore.addArtboard(fixture.tour.id, assignment.id, entry, produced.artifactBody);
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: SENT_TO_PRODUCTION,
      version: `Brief V0${brief.briefVersion}`,
    });
    return { receipt: produced.receipt, artboard: produced.artboard, label: STAND_IN_LABEL };
  }
  if (body.action === "get-artboards") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const artboardStore = options.artboardStore || createArtboardStore();
    return {
      artboards: await artboardStore.readArtboards(fixture.tour.id, assignment.id),
      label: STAND_IN_LABEL,
    };
  }
  // The stored artifact is a file in private storage, so the review screen asks
  // for it by the location the artboard names rather than reaching for a path
  // of its own.
  if (body.action === "get-artboard-artifact") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const artboardStore = options.artboardStore || createArtboardStore();
    const versions = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
    const wanted = Number(body.artboardVersion);
    const entry = versions.find((stored) => stored.artboard.artboardVersion === wanted);
    if (!entry) {
      const error = new Error("That artboard version was not found.");
      error.status = 404;
      throw error;
    }
    const svg = await artboardStore.readArtifact(entry.artboard.artifact.location);
    if (!svg) {
      const error = new Error("That artboard file could not be read.");
      error.status = 404;
      throw error;
    }
    return { artboardVersion: wanted, svg, label: STAND_IN_LABEL };
  }
  // Where one artboard version departs from the brief, and the technical items
  // a person has to decide about. Higher Roads' words. The client never reads
  // this. Nothing here scores or judges the work.
  if (body.action === "save-review") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const artboardStore = options.artboardStore || createArtboardStore();
    const record = options.sceneRecord || createSceneRecord();

    const versions = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
    const wanted = Number(body.artboardVersion);
    const entry = versions.find((stored) => stored.artboard.artboardVersion === wanted);
    if (!entry) {
      const error = new Error("That artboard version was not found.");
      error.status = 404;
      throw error;
    }
    const departures = textList(body.departures);
    const technicalItems = textList(body.technicalItems);
    if (!departures.length && !technicalItems.length) {
      const error = new Error("A review needs at least one note.");
      error.status = 400;
      throw error;
    }
    const review = {
      artboardVersion: wanted,
      briefVersion: entry.artboard.briefVersion,
      departures,
      technicalItems,
      writtenBy: user.displayName,
      writtenAt: new Date().toISOString(),
    };
    await artboardStore.addReview(fixture.tour.id, assignment.id, review);
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: "Wrote the review",
      version: `Artboard V0${wanted}`,
    });
    return { review };
  }
  // Feedback goes back against a named version and comes back as the next one.
  // A revision against a version that has already been revised is refused, so
  // two people cannot send different feedback on the same picture and both
  // believe theirs is what production is building.
  if (body.action === "send-revision") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore();
    const artboardStore = options.artboardStore || createArtboardStore();
    const record = options.sceneRecord || createSceneRecord();

    const versions = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
    const source = Number(body.sourceArtboardVersion);
    const entry = versions.find((stored) => stored.artboard.artboardVersion === source);
    if (!entry) {
      const error = new Error("That artboard version was not found.");
      error.status = 404;
      throw error;
    }
    const later = versions.filter((stored) => stored.artboard.artboardVersion > source);
    if (later.length) {
      const error = new Error("A newer version of this artboard already came back. Send your feedback against that one.");
      error.status = 409;
      throw error;
    }
    const revisionId = String(body.revisionId || "").trim();
    if (!revisionId) {
      const error = new Error("A revision needs an identifier.");
      error.status = 400;
      throw error;
    }
    const instructions = instructionList(body.instructions);
    if (!instructions.length) {
      const error = new Error("Say what should change before you send it back.");
      error.status = 400;
      throw error;
    }
    const briefs = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    const brief = briefs.find((stored) => stored.briefVersion === entry.artboard.briefVersion);
    if (!brief) {
      const error = new Error("The brief this artboard was built against was not found.");
      error.status = 404;
      throw error;
    }

    const revision = {
      revisionId,
      jobId: entry.artboard.jobId,
      sourceArtboardVersion: source,
      instructions,
      preserve: textList(body.preserve),
      sentBy: user.displayName,
      sentAt: new Date().toISOString(),
    };
    const produced = receiveRevision(brief, revision, { artboardVersion: source + 1 });
    await artboardStore.addArtboard(
      fixture.tour.id,
      assignment.id,
      { receipt: produced.receipt, artboard: produced.artboard },
      produced.artifactBody,
    );
    await artboardStore.addRevision(fixture.tour.id, assignment.id, {
      ...revision,
      receipt: produced.receipt,
      producedArtboardVersion: produced.artboard.artboardVersion,
    });
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: "Requested internal changes",
      version: `Artboard V0${source}`,
    });
    return { revision, receipt: produced.receipt, artboard: produced.artboard, label: STAND_IN_LABEL };
  }
  if (body.action === "get-reviews") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const artboardStore = options.artboardStore || createArtboardStore();
    return {
      reviews: await artboardStore.readReviews(fixture.tour.id, assignment.id),
      revisions: await artboardStore.readRevisions(fixture.tour.id, assignment.id),
    };
  }
  // Four distinct authorities, kept apart on purpose. Higher Roads clears a
  // version for the client to see. The client approves the work. Neither is
  // the other, and neither moves anything into the artist layer.
  if (body.action === "approve-for-client") {
    const { fixture, assignment, artboardStore, record, entry, wanted } = await atArtboard(body, options);
    const approvals = await artboardStore.readApprovals(fixture.tour.id, assignment.id);
    if (approvals.readyForClient.some((stored) => stored.artboardVersion === wanted)) {
      const error = new Error("That version is already ready for the client.");
      error.status = 409;
      throw error;
    }
    const cleared = {
      artboardVersion: wanted,
      briefVersion: entry.artboard.briefVersion,
      approvedBy: user.displayName,
      approvedAt: new Date().toISOString(),
    };
    await artboardStore.writeApprovals(fixture.tour.id, assignment.id, {
      ...approvals,
      readyForClient: [...approvals.readyForClient, cleared],
    });
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: "Approved for the client to see",
      version: `Artboard V0${wanted}`,
    });
    return { readyForClient: cleared };
  }
  if (body.action === "client-approve") {
    const { fixture, assignment, tourStore, artboardStore, record, entry, wanted } = await atArtboard(body, options);
    const approvals = await artboardStore.readApprovals(fixture.tour.id, assignment.id);
    if (!approvals.readyForClient.some((stored) => stored.artboardVersion === wanted)) {
      const error = new Error("That version has not been sent to the client yet.");
      error.status = 409;
      throw error;
    }
    if (approvals.clientApprovals.some((stored) => stored.artboardVersion === wanted)) {
      const error = new Error("That version is already approved.");
      error.status = 409;
      throw error;
    }
    const approval = {
      artboardVersion: wanted,
      approvedBy: user.displayName,
      approvedAt: new Date().toISOString(),
    };
    const briefs = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    const brief = briefs.find((stored) => stored.briefVersion === entry.artboard.briefVersion);
    if (!brief) {
      const error = new Error("The brief this work was built against was not found.");
      error.status = 404;
      throw error;
    }
    // What production builds against. Frozen at this moment and never edited.
    await artboardStore.addIntent(fixture.tour.id, assignment.id, {
      jobId: entry.artboard.jobId,
      briefVersion: entry.artboard.briefVersion,
      artboardVersion: wanted,
      technicalProfileRef: (brief.technicalTarget || {}).playbackSystem || null,
      approvedBy: user.displayName,
      approvedAt: approval.approvedAt,
    });
    await artboardStore.writeApprovals(fixture.tour.id, assignment.id, {
      ...approvals,
      clientApprovals: [...approvals.clientApprovals, approval],
    });
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: "Approved the work",
      version: `Artboard V0${wanted}`,
    });
    return { approval };
  }
  if (body.action === "client-comment") {
    const { fixture, assignment, artboardStore, record, wanted } = await atArtboard(body, options);
    const text = String(body.text || "").trim();
    if (!text) {
      const error = new Error("Write something before you send it.");
      error.status = 400;
      throw error;
    }
    const approvals = await artboardStore.readApprovals(fixture.tour.id, assignment.id);
    if (!approvals.readyForClient.some((stored) => stored.artboardVersion === wanted)) {
      const error = new Error("That version has not been sent to the client yet.");
      error.status = 409;
      throw error;
    }
    const comment = { artboardVersion: wanted, text, writtenBy: user.displayName, writtenAt: new Date().toISOString() };
    await artboardStore.writeApprovals(fixture.tour.id, assignment.id, {
      ...approvals,
      comments: [...approvals.comments, comment],
    });
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: "Left a comment",
      version: `Artboard V0${wanted}`,
    });
    return { comment };
  }
  if (body.action === "get-production-intent") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const artboardStore = options.artboardStore || createArtboardStore();
    const approvals = await artboardStore.readApprovals(fixture.tour.id, assignment.id);
    return { ...approvals, intents: await artboardStore.readIntents(fixture.tour.id, assignment.id) };
  }
  if (body.action === "get-scene-record") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const record = options.sceneRecord || createSceneRecord();
    return { facts: await record.readFacts(fixture.tour.id, assignment.id) };
  }

  const error = new Error("That is not something this route does.");
  error.status = 400;
  throw error;
}

export default async function handler(request, response) {
  const user = await requireUser(request, response);
  if (!user) return;
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "This route takes an action." });
      return;
    }
    const body = await readJsonBody(request);
    sendJson(response, 200, await handleAction(body, { user }));
  } catch (error) {
    sendPublicError(response, error);
  }
}
