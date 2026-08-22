import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseTourFixture } from "../../src/tour/parse-fixture.js";
import { assembleContext } from "../../src/tour/select.js";
import { proposeConcepts } from "../../src/tour/propose.js";
import { createArtistStore } from "../../src/artist/store.js";
import { buildArtistView } from "../../src/artist/service.js";
import { readJsonBody, requireBrandWorldAccess, sanitizeClientId, sendJson, sendPublicError } from "../../src/server/http.js";

// The tour layer's one function. Actions: get-tour, get-assignment,
// assignment-context, propose-concepts.
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
