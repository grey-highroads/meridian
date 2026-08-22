import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseTourFixture } from "../../src/tour/parse-fixture.js";
import { assembleContext } from "../../src/tour/select.js";
import { proposeConcepts } from "../../src/tour/propose.js";
import { createTourStore } from "../../src/tour/store.js";
import { compileBrief, freeze, nextBriefVersion, renderBriefDocument, renderBriefSidecar } from "../../src/tour/brief.js";
import { createArtistStore } from "../../src/artist/store.js";
import { buildArtistView } from "../../src/artist/service.js";
import { readJsonBody, requireBrandWorldAccess, sanitizeClientId, sendJson, sendPublicError } from "../../src/server/http.js";

// The tour layer's one function. Actions: get-tour, get-assignment,
// assignment-context, propose-concepts, choose-concept, get-concept,
// compile-brief, freeze-brief, list-briefs, get-brief.
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

export async function handleAction(body, options = {}) {
  if (body.action === "get-tour") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    return {
      tour: fixture.tour,
      assignments: fixture.assignments.map((entry) => ({
        id: entry.id,
        title: entry.title,
        moment: entry.moment,
        requestedBy: entry.requestedBy,
        requestedOn: entry.requestedOn,
        directionVersion: entry.directionVersion,
      })),
    };
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
    const { fixture, assignment } = await contextFor(body, options);
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
      avoid: Array.isArray(source.avoid) ? source.avoid : [],
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
      directionSelectedBy: body.person || "Higher Roads",
      directionSelectedAt: new Date().toISOString(),
      shapedBy: body.person || "Higher Roads",
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
    const frozen = freeze(compiled, body.person);
    await tourStore.addBrief(fixture.tour.id, assignment.id, frozen);
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

  const error = new Error("That is not something this route does.");
  error.status = 400;
  throw error;
}

export default async function handler(request, response) {
  if (!requireBrandWorldAccess(request, response)) return;
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "This route takes an action." });
      return;
    }
    const body = await readJsonBody(request);
    sendJson(response, 200, await handleAction(body));
  } catch (error) {
    sendPublicError(response, error);
  }
}
