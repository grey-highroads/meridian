import { assembleContext } from "../../src/tour/select.js";
import { proposeConcepts } from "../../src/tour/propose.js";
import { createTourStore } from "../../src/tour/store.js";
import { compileBrief, findingSentence, freeze, nextBriefVersion, renderBriefDocument, renderBriefSidecar } from "../../src/tour/brief.js";
import { createArtboardStore } from "../../src/seam/artboard-store.js";
import { receiveBrief, receiveRevision, STAND_IN_LABEL } from "../../src/seam/stand-in.js";
import { createSceneRecord } from "../../src/tour/scene-record.js";
import { conceptPath, sceneLifecycle, SENT_TO_PRODUCTION } from "../../src/tour/lifecycle.js";
import { createArtistStore } from "../../src/artist/store.js";
import { createArtistDirectory } from "../../src/org/artists.js";
import { resolveActingAccount } from "../../src/org/acting-account.js";
import { createOrgStore } from "../../src/org/store.js";
import { uploadPrefix } from "../../src/tour/upload-path.js";
import { buildArtistView } from "../../src/artist/service.js";
import { readJsonBody, requireUser, sanitizeClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { CLIENT_ROLE } from "../../src/org/store.js";

// The tour layer's one function. Actions: create-tour, get-tour, list-tours,
// get-assignment, save-tour-dates, save-production-setup,
// assignment-context, propose-concepts, choose-concept, get-concept,
// compile-brief, freeze-brief, list-briefs, get-brief, send-brief,
// issue-brief, send-to-production, get-handoffs, submit-artboard, get-artboards,
// get-artboard-artifact, save-review, issue-revision, send-revision,
// get-reviews, approve-for-client, client-approve, client-comment,
// get-production-intent, get-scene-activity, get-scene-record, ask-question,
// answer-question, get-questions.
//
// The tour reads the artist layer and never writes to it. Nothing here moves a
// finding, a claim, or a source. A tour is a temporary interpretation that sits
// above the brain without rewriting it.

// A tour is read from the store and from nothing else. An id with nothing
// stored under it is absent for every account, the demo one included. The
// committed markdown under tours/ is the seed the Admin action reads once; the
// app never falls back to it, so a tour a person is looking at is a tour
// somebody stored.
async function loadTour(tourId, options) {
  const tourStore = options.tourStore || createTourStore({ accountId: options.actingAccount });
  const stored = await tourStore.readTour(tourId);
  if (!stored) {
    const error = new Error("We couldn't find this tour.");
    error.status = 404;
    throw error;
  }
  const [directions, requests, dateVersions, setupVersions] = await Promise.all([
    tourStore.readDirections(stored.tour.id),
    tourStore.readRequests(stored.tour.id),
    tourStore.readDateVersions(stored.tour.id),
    tourStore.readSetupVersions(stored.tour.id),
  ]);
  const direction = directions.length ? directions[directions.length - 1] : stored.tour.direction;
  // The tour document holds what the tour was seeded or created with. A later
  // version written through the app wins, and the earlier one stays stored.
  const dates = dateVersions.length ? dateVersions[dateVersions.length - 1].dates : (stored.tour.dates || []);
  const productionSetup = setupVersions.length ? setupVersions[setupVersions.length - 1] : (stored.tour.productionSetup || null);
  return {
    tour: { ...stored.tour, direction, dates, productionSetup },
    assignments: [...(stored.assignments || []), ...requests],
  };
}

function requestId(title, assignments, at = Date.now()) {
  const stem = sanitizeClientId(title || "scene");
  let value = `${stem}-${Number(at).toString(36)}`;
  let suffix = 2;
  const used = new Set(assignments.map((entry) => entry.id));
  while (used.has(value)) {
    value = `${stem}-${Number(at).toString(36)}-${suffix}`;
    suffix += 1;
  }
  return value;
}

// A question's id. Same shape as a Scene request id and unique inside the one
// Scene it belongs to.
function questionId(existing, at = Date.now()) {
  const used = new Set(existing.map((entry) => entry.id));
  let value = `question-${Number(at).toString(36)}`;
  let suffix = 2;
  while (used.has(value)) {
    value = `question-${Number(at).toString(36)}-${suffix}`;
    suffix += 1;
  }
  return value;
}

function findAssignment(fixture, assignmentId) {
  const assignment = fixture.assignments.find((entry) => entry.id === assignmentId);
  if (!assignment) {
    const error = new Error("We couldn't find that Scene on this tour.");
    error.status = 404;
    throw error;
  }
  return assignment;
}

async function loadBrain(artistId, options) {
  const store = options.store || createArtistStore({ accountId: options.actingAccount });
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

function textList(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => String(entry === null || entry === undefined ? "" : entry).trim())
    .filter(Boolean);
}

function instructionList(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => {
      const source = entry && typeof entry === "object" ? entry : { text: entry };
      const text = String(source.text === null || source.text === undefined ? "" : source.text).trim();
      return { text };
    })
    .filter((entry) => entry.text);
}

function optionalText(value) {
  const text = String(value === null || value === undefined ? "" : value).trim();
  return text || null;
}

// The note a person writes on a Scene is optional. The request already said what
// is wanted and the tour direction already governs, so a Scene saved with no
// note carries the request forward. A client reads this field back as the
// rationale, so it is never stored blank. Ruled 2026-08-27.
function sceneIdea(value, assignment) {
  const written = String(value === null || value === undefined ? "" : value).trim();
  return written
    || String((assignment && assignment.request) || "").trim()
    || String((assignment && assignment.title) || "").trim();
}

function handoffPath(accountId, tourId, assignmentId, extra = {}) {
  const params = new URLSearchParams({ account: accountId, tour: tourId, scene: assignmentId });
  for (const [key, value] of Object.entries(extra)) params.set(key, String(value));
  return `/handoff.html?${params}`;
}

function submissionArtifact(value, tourId, assignmentId, accountId) {
  const source = value && typeof value === "object" ? value : {};
  const contentType = optionalText(source.contentType) || "application/octet-stream";
  const name = optionalText(source.name) || "Submitted work";
  const size = Number(source.size) || null;
  const blobPathname = optionalText(source.blobPathname);
  const dataUrl = optionalText(source.dataUrl);
  const prefix = uploadPrefix(tourId, assignmentId, accountId);
  if (blobPathname && !blobPathname.startsWith(prefix)) {
    const error = new Error("That submitted file is outside this Scene.");
    error.status = 400;
    throw error;
  }
  if (dataUrl && !/^data:image\/(?:jpeg|png);base64,/i.test(dataUrl)) {
    const error = new Error("That submitted file format is not supported.");
    error.status = 400;
    throw error;
  }
  if (!blobPathname && !dataUrl) {
    const error = new Error("Add the work before submitting this version.");
    error.status = 400;
    throw error;
  }
  return {
    type: "artboard",
    location: blobPathname || "stored-with-submission",
    blobPathname,
    dataUrl,
    contentType,
    name,
    size,
  };
}

// Everything at the end of the loop is about one artboard version, so they all
// resolve the same way.
async function atArtboard(body, options) {
  const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
  const assignment = findAssignment(fixture, body.assignmentId);
  const tourStore = options.tourStore || createTourStore({ accountId: options.actingAccount || null });
  const artboardStore = options.artboardStore || createArtboardStore({ accountId: options.actingAccount || null });
  const record = options.sceneRecord || createSceneRecord({ accountId: options.actingAccount || null });
  const versions = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
  const wanted = Number(body.artboardVersion);
  const entry = versions.find((stored) => stored.artboard.artboardVersion === wanted);
  if (!entry) {
    const error = new Error("That artboard version was not found.");
    error.status = 404;
    throw error;
  }
  return { fixture, assignment, tourStore, artboardStore, record, versions, entry, wanted };
}

// The two action strings a question writes into the Scene record. They live
// here because the route writes them and get-scene-activity reads them, and two
// copies of either would drift.
export const ASKED_A_QUESTION = "Asked the client a question";
export const ANSWERED_A_QUESTION = "Answered a question";

function clientSurfaceError() {
  const error = new Error("That part of Meridian is for the Higher Roads team.");
  error.status = 403;
  return error;
}

function presentedVersions(approvals) {
  return new Set((approvals.readyForClient || []).map((entry) => Number(entry.artboardVersion)));
}

function refuseSupersededArtboard(versions, wanted) {
  if (versions.some((stored) => stored.artboard.artboardVersion > wanted)) {
    const error = new Error("A newer version already came back. Work with that one instead.");
    error.status = 409;
    throw error;
  }
}

function clientApprovalView(approvals) {
  const visible = presentedVersions(approvals);
  return {
    readyForClient: (approvals.readyForClient || [])
      .filter((entry) => visible.has(Number(entry.artboardVersion)))
      .map((entry) => ({ artboardVersion: entry.artboardVersion })),
    clientApprovals: (approvals.clientApprovals || [])
      .filter((entry) => visible.has(Number(entry.artboardVersion)))
      .map((entry) => ({
        artboardVersion: entry.artboardVersion,
        approvedBy: entry.approvedBy,
        approvedAt: entry.approvedAt,
      })),
    comments: (approvals.comments || [])
      .filter((entry) => visible.has(Number(entry.artboardVersion)))
      .map((entry) => ({
        artboardVersion: entry.artboardVersion,
        text: entry.text,
        writtenBy: entry.writtenBy,
        writtenAt: entry.writtenAt,
      })),
  };
}

// Client and Higher Roads users share the Tour and Scene workflow. Internal
// review and Artist Brain evidence remain on the Higher Roads side of the
// glass. The route enforces that surface boundary even when a page is bypassed.
//
// The check is here rather than on the page, because a page that hides a
// button is a page, and this route is what storage listens to.
const CLIENT_ACTIONS = new Set([
  "get-me",
  "mark-introduction-seen",
  "mark-review-version-seen",
  "get-tour",
  "list-tours",
  "get-assignment",
  "get-artboards",
  "get-artboard-artifact",
  "get-brief",
  "list-briefs",
  "get-handoffs",
  "get-reviews",
  "get-production-intent",
  "get-scene-activity",
  "submit-artboard",
  "add-tour-direction",
  "create-tour",
  "save-tour-dates",
  "save-production-setup",
  "create-scene-request",
  "get-scene-workspace",
  "save-scene-direction",
  "get-questions",
  "answer-question",
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
  // The acting account. Everyone acts inside their own account; a Higher
  // Roads session may name another account and that choice is recorded on the
  // facts it writes. Brief 2 of docs/spec-accounts-artists-tours.md.
  const actingAccount = resolveActingAccount(user, body.accountId || user.actingAccount);
  const actor = { actor: user.displayName, role: user.roleLabel, account: actingAccount };
  options = { ...options, actingAccount };

  if (body.action === "get-me") return { user, actingAccount };

  if (body.action === "mark-introduction-seen") {
    if (user.role !== CLIENT_ROLE) {
      const error = new Error("The introduction is for invited client teams.");
      error.status = 403;
      throw error;
    }
    const orgStore = options.orgStore || createOrgStore();
    const now = options.now ? new Date(options.now()) : new Date();
    return { user: await orgStore.markIntroductionSeen(user.id, now) };
  }

  if (body.action === "mark-review-version-seen") {
    const { fixture, assignment, artboardStore, entry, wanted } = await atArtboard(body, options);
    if (user.role === CLIENT_ROLE) {
      const approvals = await artboardStore.readApprovals(fixture.tour.id, assignment.id);
      if (!presentedVersions(approvals).has(wanted)) throw clientSurfaceError();
    }
    const orgStore = options.orgStore || createOrgStore();
    const now = options.now ? new Date(options.now()) : new Date();
    const seen = await orgStore.markReviewVersionSeen(
      user.id,
      actingAccount,
      fixture.tour.id,
      assignment.id,
      entry.artboard.artboardVersion,
      now,
    );
    return seen;
  }

  // Which tours this account holds. A page asks when no tour is named, so an
  // account with one lands on it and an account with none is told that plainly
  // instead of asking for a tour that does not exist. The account is the
  // session's, so this reads one account and never lists another's.
  if (body.action === "list-tours") {
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const tours = await tourStore.readTours();
    // Which one the account opens when the address names none. An account that
    // has never been pointed at one carries nothing here and the caller falls
    // back to the first tour it holds.
    const accounts = options.orgStore || createOrgStore({ backend: tourStore.backend });
    const row = (await accounts.readAccounts()).find((entry) => entry.id === actingAccount);
    const activeTourId = row && row.activeTourId && tours.some((entry) => entry.id === row.activeTourId)
      ? row.activeTourId
      : null;
    return { tours, activeTourId };
  }

  if (body.action === "get-tour") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
    const assignments = [];
    // Where each Scene has got to, read from what is stored for it. Nothing
    // here compiles a brief, because a draft that exists for the length of one
    // request is not evidence of anything.
    for (const entry of fixture.assignments) {
      const [concept, briefs, facts, artboards, approvals, questions] = await Promise.all([
        tourStore.readConcept(fixture.tour.id, entry.id),
        tourStore.readBriefs(fixture.tour.id, entry.id),
        record.readFacts(fixture.tour.id, entry.id),
        artboardStore.readArtboards(fixture.tour.id, entry.id),
        artboardStore.readApprovals(fixture.tour.id, entry.id),
        tourStore.readQuestions(fixture.tour.id, entry.id),
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
        // Questions nobody has answered yet, so Home can put them where the
        // person who has to answer is already looking. This does not touch the
        // stage or who the work waits on; an unanswered question changes
        // nothing about the work.
        openQuestions: questions
          .filter((question) => !question.answer)
          .map((question) => ({ id: question.id, text: question.text, askedBy: question.askedBy })),
        ...state,
      });
    }
    return { tour: fixture.tour, assignments };
  }
  if (body.action === "add-tour-direction") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const words = String(body.words || "").trim();
    if (!words) {
      const error = new Error("Add the tour's direction before saving.");
      error.status = 400;
      throw error;
    }
    if (words === fixture.tour.direction.words) {
      const error = new Error("That is already the current direction.");
      error.status = 409;
      throw error;
    }
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const direction = {
      version: fixture.tour.direction.version + 1,
      setBy: optionalText(body.onBehalfOf) || user.displayName,
      setOn: new Date().toISOString(),
      words,
      recordedBy: user.displayName,
      onBehalfOf: optionalText(body.onBehalfOf),
    };
    await tourStore.addDirection(fixture.tour.id, direction);
    const affectedScenes = fixture.assignments
      .filter((entry) => entry.directionVersion < direction.version)
      .map((entry) => ({ id: entry.id, title: entry.title, directionVersion: entry.directionVersion }));
    return { direction, affectedScenes };
  }

  if (body.action === "create-tour") {
    const name = String(body.name || "").trim();
    if (!name) {
      const error = new Error("Name the tour before creating it.");
      error.status = 400;
      throw error;
    }
    const artistId = String(body.artistId || "").trim();
    if (!artistId) {
      const error = new Error("Name the artist this tour belongs to.");
      error.status = 400;
      throw error;
    }
    const id = sanitizeClientId(name);
    if (id === "default") {
      // sanitizeClientId falls back to "default", which is the inherited BWS
      // namespace under the same storage root. Nothing lands there.
      const error = new Error("That name does not make a usable tour id. Use letters or numbers.");
      error.status = 400;
      throw error;
    }
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const createdAt = new Date().toISOString();
    const artistDirectory = options.artists || createArtistDirectory({
      ...((options.store?.backend || options.tourStore?.backend)
        ? { backend: options.store?.backend || options.tourStore.backend }
        : {}),
      accountId: actingAccount,
    });
    if (!await artistDirectory.findArtist(artistId)) {
      const error = new Error("No artist is stored under that name in this account.");
      error.status = 404;
      throw error;
    }
    const document = {
      tour: {
        id,
        name,
        artistId,
        playbackSystem: null,
        productionSetup: null,
        dates: [],
        themes: [],
        approximateDates: optionalText(body.approximateDates),
        primaryContact: optionalText(body.primaryContact),
        // An absent direction reads as version 0 with no words, so the first
        // direction someone writes becomes version 1 and Home shows the gap.
        direction: { version: 0, words: "", setBy: null, setOn: null, role: null },
      },
      assignments: [],
    };
    await tourStore.createTour(id, document);
    await tourStore.appendTourFact(id, {
      ...actor,
      action: "Created the tour",
      version: null,
      onBehalfOf: optionalText(body.onBehalfOf),
      at: createdAt,
    });
    return { tour: document.tour };
  }

  // The tour's route. A row keeps whatever it has, so a date with no venue yet
  // is a date and not an error, and a row with nothing in it is dropped rather
  // than stored empty.
  if (body.action === "save-tour-dates") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const dates = (Array.isArray(body.dates) ? body.dates : [])
      .map((entry) => {
        const source = entry && typeof entry === "object" ? entry : {};
        return {
          date: optionalText(source.date),
          venue: optionalText(source.venue),
          place: optionalText(source.place),
        };
      })
      .filter((entry) => entry.date || entry.venue || entry.place);
    if (!dates.length) {
      const error = new Error("Add at least one date before saving the route.");
      error.status = 400;
      throw error;
    }
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const existing = await tourStore.readDateVersions(fixture.tour.id);
    const entry = {
      version: existing.length + 1,
      dates,
      setBy: optionalText(body.onBehalfOf) || user.displayName,
      setOn: new Date().toISOString(),
      recordedBy: user.displayName,
      onBehalfOf: optionalText(body.onBehalfOf),
    };
    await tourStore.addDates(fixture.tour.id, entry);
    await tourStore.appendTourFact(fixture.tour.id, {
      ...actor,
      action: dates.length === 1 ? "Recorded 1 tour date" : `Recorded ${dates.length} tour dates`,
      version: `Dates V0${entry.version}`,
      onBehalfOf: entry.onBehalfOf,
      at: entry.setOn,
    });
    return { dates: entry };
  }

  // What the show plays on, stored as production gave it. Dates where the rig
  // differs are carried through from the version before, because this surface
  // does not edit them and a save must not drop what someone recorded.
  if (body.action === "save-production-setup") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const words = String(body.words || "").trim();
    if (!words) {
      const error = new Error("Write the production setup before saving it.");
      error.status = 400;
      throw error;
    }
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const existing = await tourStore.readSetupVersions(fixture.tour.id);
    const current = fixture.tour.productionSetup;
    if (current && words === current.words) {
      const error = new Error("Those words already are the current production setup.");
      error.status = 409;
      throw error;
    }
    const setup = {
      version: (existing.length ? existing[existing.length - 1].version : (current ? current.version : 0)) + 1,
      words,
      suppliedBy: optionalText(body.suppliedBy) || optionalText(body.onBehalfOf) || user.displayName,
      suppliedOn: new Date().toISOString(),
      venueExceptions: current && Array.isArray(current.venueExceptions) ? current.venueExceptions : [],
      recordedBy: user.displayName,
      onBehalfOf: optionalText(body.onBehalfOf),
    };
    await tourStore.addProductionSetup(fixture.tour.id, setup);
    await tourStore.appendTourFact(fixture.tour.id, {
      ...actor,
      action: "Recorded the production setup",
      version: `Setup V0${setup.version}`,
      onBehalfOf: setup.onBehalfOf,
      at: setup.suppliedOn,
    });
    return { productionSetup: setup };
  }

  if (body.action === "create-scene-request") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const request = String(body.request || "").trim();
    if (!request) {
      const error = new Error("Write the Scene request before submitting it.");
      error.status = 400;
      throw error;
    }
    const title = optionalText(body.title);
    if (!title) {
      const error = new Error("Name the Scene before submitting it.");
      error.status = 400;
      throw error;
    }
    const moment = optionalText(body.moment);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const requestedAt = new Date().toISOString();
    const assignment = {
      id: requestId(title, fixture.assignments, options.now ? options.now() : Date.now()),
      version: 1,
      tourId: fixture.tour.id,
      title,
      directionVersion: fixture.tour.direction.version,
      moment,
      identity: optionalText(body.identity) || null,
      requestedBy: user.displayName,
      requestedOn: requestedAt,
      onBehalfOf: optionalText(body.onBehalfOf),
      status: "Requested",
      request,
      requiredElements: textList(body.requiredElements),
      references: textList(body.references),
    };
    await tourStore.addRequest(fixture.tour.id, assignment);
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: "Requested the Scene",
      version: `Direction V0${assignment.directionVersion}`,
      onBehalfOf: assignment.onBehalfOf,
    });
    return { assignment };
  }
  if (body.action === "get-assignment") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    return { tour: fixture.tour, assignment: findAssignment(fixture, body.assignmentId) };
  }
  if (body.action === "get-scene-workspace") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const stored = await tourStore.readConcept(fixture.tour.id, assignment.id);
    const concept = stored ? {
      title: stored.title,
      idea: stored.idea,
      cameFrom: stored.cameFrom || null,
      shapedBy: stored.shapedBy || null,
      shapedAt: stored.shapedAt || null,
    } : null;
    // The client Scene reads a question, one line of status, and her own
    // request. The tour direction and the rig detail stay on the Higher Roads
    // side of the glass, so the route does not send them at all. A page that
    // hides something is a page; this is what storage listens to. Ruled
    // 2026-08-27.
    return {
      tour: { id: fixture.tour.id, name: fixture.tour.name },
      assignment,
      concept,
      context: {},
    };
  }

  if (body.action === "save-scene-direction") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const source = body.concept || {};
    if (!String(source.title || "").trim()) {
      const error = new Error("A Scene direction needs a name.");
      error.status = 400;
      throw error;
    }
    const briefs = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    if (briefs.some((entry) => entry.status === "frozen")) {
      const error = new Error("A brief is already frozen for this Scene. A change now needs a new brief version.");
      error.status = 409;
      throw error;
    }
    const concept = {
      title: String(source.title).trim(),
      idea: sceneIdea(source.idea, assignment),
      whyThisArtist: "",
      asksOfProduction: "",
      whereItMightMiss: "",
      rhymesWith: [],
      avoid: [],
      artistContext: [],
      creativeLatitude: [],
      openQuestions: [],
      cameFrom: "written directly",
      shapedBy: user.displayName,
      shapedAt: new Date().toISOString(),
    };
    await tourStore.writeConcept(fixture.tour.id, assignment.id, concept);
    return { concept };
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
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const source = body.concept || {};
    if (!String(source.title || "").trim()) {
      const error = new Error("A concept needs a title.");
      error.status = 400;
      throw error;
    }
    const briefs = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    if (briefs.some((entry) => entry.status === "frozen")) {
      const error = new Error("A brief is already frozen for this Scene. Changing the concept now means a new brief version.");
      error.status = 409;
      throw error;
    }
    // Intent, interpretation, and decision stay three separate things. What the
    // brain proposed is kept next to what the person made of it.
    const concept = {
      title: String(source.title).trim(),
      idea: sceneIdea(source.idea, assignment),
      whyThisArtist: String(source.whyThisArtist || "").trim(),
      asksOfProduction: String(source.asksOfProduction || "").trim(),
      whereItMightMiss: String(source.whereItMightMiss || "").trim(),
      rhymesWith: Array.isArray(source.rhymesWith) ? source.rhymesWith : [],
      avoid: avoidFor(context, source.avoid),
      artistContext: Array.isArray(source.artistContext) ? source.artistContext : [],
      creativeLatitude: Array.isArray(source.creativeLatitude) ? source.creativeLatitude : [],
      openQuestions: Array.isArray(source.openQuestions) ? source.openQuestions : [],
      cameFrom: source.cameFrom || null,
      // Nothing here records which parts of the tour direction or which dates
      // bear on this Scene. All of both travel with every brief. Ruled
      // 2026-08-27.
      shapedBy: user.displayName,
      shapedAt: new Date().toISOString(),
    };
    return { concept: await tourStore.writeConcept(fixture.tour.id, assignment.id, concept) };
  }
  if (body.action === "get-concept") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    return { concept: await tourStore.readConcept(fixture.tour.id, assignment.id) };
  }
  if (body.action === "compile-brief") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
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
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
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
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
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
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
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
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const versions = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    if (user.role === CLIENT_ROLE) {
      const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
      const [artboards, approvals] = await Promise.all([
        artboardStore.readArtboards(fixture.tour.id, assignment.id),
        artboardStore.readApprovals(fixture.tour.id, assignment.id),
      ]);
      const visible = presentedVersions(approvals);
      const artboardVersion = Number(body.artboardVersion);
      const artboard = artboards.find((entry) => (
        entry.artboard.artboardVersion === artboardVersion && visible.has(artboardVersion)
      ));
      if (!artboard) throw clientSurfaceError();
      const brief = versions.find((entry) => entry.briefVersion === artboard.artboard.briefVersion);
      if (!brief) {
        const error = new Error("That brief version was not found.");
        error.status = 404;
        throw error;
      }
      return { rationale: brief.chosenConcept.idea || brief.chosenConcept.title };
    }
    const brief = versions.find((entry) => entry.briefVersion === Number(body.briefVersion));
    if (!brief) {
      const error = new Error("That brief version was not found.");
      error.status = 404;
      throw error;
    }
    return { brief, document: renderBriefDocument(brief), sidecar: renderBriefSidecar(brief) };
  }

  // Issuing is the outbound half of a governed handoff. It records the exact
  // version, who was asked, and the direct path. It does not pretend the work
  // came back in the same click.
  if (body.action === "issue-brief") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
    const versions = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    const wanted = body.briefVersion === undefined || body.briefVersion === null
      ? null
      : Number(body.briefVersion);
    const frozen = versions.filter((entry) => entry.status === "frozen");
    const brief = wanted === null
      ? frozen[frozen.length - 1]
      : frozen.find((entry) => entry.briefVersion === wanted);
    if (!brief) {
      const error = new Error("Freeze the brief before issuing it.");
      error.status = 400;
      throw error;
    }
    const handoff = {
      handoffId: `brief-${brief.jobId}-v${brief.briefVersion}`,
      kind: "brief",
      jobId: brief.jobId,
      briefVersion: brief.briefVersion,
      sourceArtboardVersion: null,
      recipient: optionalText(body.recipient) || "Media artist",
      dueDate: optionalText(body.dueDate),
      contact: optionalText(body.contact),
      directPath: handoffPath(actingAccount, fixture.tour.id, assignment.id, { brief: brief.briefVersion }),
      issuedBy: user.displayName,
      issuedAt: new Date().toISOString(),
    };
    await artboardStore.addHandoff(fixture.tour.id, assignment.id, handoff);
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: SENT_TO_PRODUCTION,
      version: `Brief V0${brief.briefVersion}`,
      onBehalfOf: optionalText(body.onBehalfOf),
    });
    return { handoff };
  }

  // One action for the one judgement a person makes here: this is right, send
  // it. It freezes the newest brief if nothing is frozen yet and issues the
  // handoff in the same move, recording both facts exactly as the two separate
  // actions did. Sending again returns the handoff that already exists rather
  // than freezing a second brief. Ruled 2026-08-27.
  if (body.action === "send-to-production") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
    const concept = await tourStore.readConcept(fixture.tour.id, assignment.id);
    const versions = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    const frozenVersions = versions.filter((entry) => entry.status === "frozen");
    let brief = frozenVersions[frozenVersions.length - 1] || null;
    if (!brief) {
      const compiled = compileBrief({
        tour: fixture.tour,
        assignment,
        concept,
        artistId: fixture.tour.artistId,
        briefVersion: nextBriefVersion(versions),
      });
      brief = freeze(compiled, user.displayName);
      await tourStore.addBrief(fixture.tour.id, assignment.id, brief);
      await record.appendFact(fixture.tour.id, assignment.id, {
        ...actor,
        action: "Froze the brief",
        version: `Brief V0${brief.briefVersion}`,
        path: conceptPath(concept),
      });
    }
    const handoffs = await artboardStore.readHandoffs(fixture.tour.id, assignment.id);
    const existing = handoffs.find((entry) => entry.kind === "brief" && entry.briefVersion === brief.briefVersion);
    if (existing) {
      return { brief, handoff: existing, document: renderBriefDocument(brief), sidecar: renderBriefSidecar(brief) };
    }
    const handoff = {
      handoffId: `brief-${brief.jobId}-v${brief.briefVersion}`,
      kind: "brief",
      jobId: brief.jobId,
      briefVersion: brief.briefVersion,
      sourceArtboardVersion: null,
      recipient: "Media artist",
      dueDate: null,
      contact: null,
      directPath: handoffPath(actingAccount, fixture.tour.id, assignment.id, { brief: brief.briefVersion }),
      issuedBy: user.displayName,
      issuedAt: new Date().toISOString(),
    };
    await artboardStore.addHandoff(fixture.tour.id, assignment.id, handoff);
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: SENT_TO_PRODUCTION,
      version: `Brief V0${brief.briefVersion}`,
      onBehalfOf: optionalText(body.onBehalfOf),
    });
    return { brief, handoff, document: renderBriefDocument(brief), sidecar: renderBriefSidecar(brief) };
  }

  if (body.action === "get-handoffs") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    return { handoffs: await artboardStore.readHandoffs(fixture.tour.id, assignment.id) };
  }

  // The seam. What goes out is one frozen brief. What comes back is an
  // artboard version and the receipt that came with it. The stand-in is ours
  // and its label travels on everything it produces, so its shape never
  // becomes Jim's obligation.
  if (body.action === "send-brief") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });

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
    const handoffs = await artboardStore.readHandoffs(fixture.tour.id, assignment.id);
    if (handoffs.some((entry) => entry.kind === "brief" && entry.briefVersion === brief.briefVersion)) {
      const error = new Error("That brief was issued to a person and is waiting for their submission.");
      error.status = 409;
      throw error;
    }

    const produced = receiveBrief(brief, { artboardVersion: 1, accountId: actingAccount });
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
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const artboards = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
    if (user.role === CLIENT_ROLE) {
      const visible = presentedVersions(await artboardStore.readApprovals(fixture.tour.id, assignment.id));
      return {
        artboards: artboards
          .filter((entry) => visible.has(Number(entry.artboard.artboardVersion)))
          .map((entry) => ({ artboard: { artboardVersion: entry.artboard.artboardVersion } })),
      };
    }
    return {
      artboards,
      label: STAND_IN_LABEL,
    };
  }

  // The inbound half of the seam. The artifact is already in private storage
  // (or held as a local data URL during development); this action writes the
  // attributed version and receipt in the same shape as the stand-in.
  if (body.action === "submit-artboard") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
    const briefs = await tourStore.readBriefs(fixture.tour.id, assignment.id);
    const briefVersion = Number(body.briefVersion);
    const brief = briefs.find((entry) => entry.briefVersion === briefVersion && entry.status === "frozen");
    if (!brief) {
      const error = new Error("Submit work against a frozen brief version.");
      error.status = 400;
      throw error;
    }
    const artboards = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
    const nextVersion = artboards.length
      ? Math.max(...artboards.map((entry) => Number(entry.artboard.artboardVersion) || 0)) + 1
      : 1;
    const wanted = body.artboardVersion === undefined || body.artboardVersion === null
      ? nextVersion
      : Number(body.artboardVersion);
    if (!Number.isInteger(wanted) || wanted !== nextVersion) {
      const error = new Error(`The next work version is V0${nextVersion}.`);
      error.status = 409;
      throw error;
    }
    const handoffs = await artboardStore.readHandoffs(fixture.tour.id, assignment.id);
    const sourceArtboardVersion = body.sourceArtboardVersion === undefined || body.sourceArtboardVersion === null
      ? null
      : Number(body.sourceArtboardVersion);
    const issued = sourceArtboardVersion === null
      ? handoffs.find((entry) => entry.kind === "brief" && entry.briefVersion === briefVersion)
      : handoffs.find((entry) => entry.kind === "revision" && entry.sourceArtboardVersion === sourceArtboardVersion);
    if (!issued) {
      const error = new Error(sourceArtboardVersion === null
        ? "Issue this brief before work is submitted against it."
        : "Issue the revision before the next version is submitted.");
      error.status = 409;
      throw error;
    }
    const conceptSummary = String(body.conceptSummary || "").trim();
    if (!conceptSummary) {
      const error = new Error("Add one sentence about how you read the brief.");
      error.status = 400;
      throw error;
    }
    const submittedBy = user.displayName;
    const onBehalfOf = optionalText(body.onBehalfOf);
    const receivedAt = new Date().toISOString();
    const label = onBehalfOf ? `Submitted by ${submittedBy} for ${onBehalfOf}` : `Submitted by ${submittedBy}`;
    const artboard = {
      jobId: brief.jobId,
      briefVersion,
      artboardVersion: wanted,
      status: "received",
      artifact: submissionArtifact(body.artifact, fixture.tour.id, assignment.id, actingAccount),
      conceptSummary,
      technicalAssumptions: textList(body.technicalAssumptions),
      technicalFindings: textList(body.technicalFindings),
      warnings: textList(body.warnings),
      unresolvedQuestions: textList(body.unresolvedQuestions),
      receivedAt,
      standIn: false,
      label,
    };
    const receipt = {
      jobId: brief.jobId,
      briefVersion,
      artboardVersion: wanted,
      sourceArtboardVersion,
      receivedAt,
      receivedBy: "Meridian",
      submittedBy,
      onBehalfOf,
      standIn: false,
      label,
    };
    await artboardStore.addSubmittedArtboard(fixture.tour.id, assignment.id, { receipt, artboard });
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: "Submitted work",
      version: `Artboard V0${wanted}`,
      onBehalfOf,
      path: "direct",
    });
    return { receipt, artboard };
  }
  // The stored artifact is a file in private storage, so the review screen asks
  // for it by the location the artboard names rather than reaching for a path
  // of its own.
  if (body.action === "get-artboard-artifact") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const versions = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
    const wanted = Number(body.artboardVersion);
    const entry = versions.find((stored) => stored.artboard.artboardVersion === wanted);
    if (!entry) {
      const error = new Error("That artboard version was not found.");
      error.status = 404;
      throw error;
    }
    if (user.role === CLIENT_ROLE) {
      const approvals = await artboardStore.readApprovals(fixture.tour.id, assignment.id);
      if (!presentedVersions(approvals).has(wanted)) throw clientSurfaceError();
    }
    const artifact = entry.artboard.artifact || {};
    if (artifact.dataUrl || artifact.blobPathname) {
      return {
        artboardVersion: wanted,
        dataUrl: artifact.dataUrl || null,
        blobPathname: artifact.blobPathname || null,
        contentType: artifact.contentType || null,
        name: artifact.name || null,
        label: entry.artboard.label || null,
      };
    }
    const svg = await artboardStore.readArtifact(artifact.location);
    if (!svg) {
      const error = new Error("That artboard file could not be read.");
      error.status = 404;
      throw error;
    }
    return { artboardVersion: wanted, svg, contentType: "image/svg+xml", label: entry.artboard.label || STAND_IN_LABEL };
  }
  // Where one artboard version departs from the brief, and the technical items
  // a person has to decide about. Higher Roads' words. The client never reads
  // this. Nothing here scores or judges the work.
  if (body.action === "save-review") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });

    const versions = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
    const wanted = Number(body.artboardVersion);
    const entry = versions.find((stored) => stored.artboard.artboardVersion === wanted);
    if (!entry) {
      const error = new Error("That artboard version was not found.");
      error.status = 404;
      throw error;
    }
    refuseSupersededArtboard(versions, wanted);
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
  if (body.action === "issue-revision") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
    const versions = await artboardStore.readArtboards(fixture.tour.id, assignment.id);
    const source = Number(body.sourceArtboardVersion);
    const entry = versions.find((stored) => stored.artboard.artboardVersion === source);
    if (!entry) {
      const error = new Error("That artboard version was not found.");
      error.status = 404;
      throw error;
    }
    if (versions.some((stored) => stored.artboard.artboardVersion > source)) {
      const error = new Error("A newer version already came back. Send feedback against that one.");
      error.status = 409;
      throw error;
    }
    const revisionId = String(body.revisionId || "").trim();
    if (!revisionId) {
      const error = new Error("A revision needs an identifier.");
      error.status = 400;
      throw error;
    }
    const existingRevisions = await artboardStore.readRevisions(fixture.tour.id, assignment.id);
    if (existingRevisions.some((stored) => stored.revisionId === revisionId)) {
      const error = new Error("That revision has already been sent.");
      error.status = 409;
      throw error;
    }
    const existingHandoffs = await artboardStore.readHandoffs(fixture.tour.id, assignment.id);
    if (existingHandoffs.some((stored) => stored.kind === "revision" && stored.sourceArtboardVersion === source)) {
      const error = new Error("That revision was issued to a person and is waiting for their submission.");
      error.status = 409;
      throw error;
    }
    const instructions = instructionList(body.instructions);
    if (!instructions.length) {
      const error = new Error("Say what should change before you send it back.");
      error.status = 400;
      throw error;
    }
    const revision = {
      revisionId,
      jobId: entry.artboard.jobId,
      sourceArtboardVersion: source,
      instructions,
      preserve: textList(body.preserve),
      source: optionalText(body.source) || "Higher Roads review",
      sentBy: user.displayName,
      sentAt: new Date().toISOString(),
      receipt: null,
      producedArtboardVersion: null,
    };
    const handoff = {
      handoffId: `revision-${revisionId}`,
      kind: "revision",
      jobId: entry.artboard.jobId,
      briefVersion: entry.artboard.briefVersion,
      sourceArtboardVersion: source,
      revisionId,
      recipient: optionalText(body.recipient) || "Media artist",
      dueDate: optionalText(body.dueDate),
      contact: optionalText(body.contact),
      directPath: handoffPath(actingAccount, fixture.tour.id, assignment.id, { revision: revisionId }),
      issuedBy: user.displayName,
      issuedAt: revision.sentAt,
    };
    await artboardStore.addRevision(fixture.tour.id, assignment.id, revision);
    await artboardStore.addHandoff(fixture.tour.id, assignment.id, handoff);
    await record.appendFact(fixture.tour.id, assignment.id, {
      ...actor,
      action: "Requested internal changes",
      version: `Artboard V0${source}`,
      onBehalfOf: optionalText(body.onBehalfOf),
    });
    return { revision, handoff };
  }

  if (body.action === "send-revision") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });

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
    const existingRevisions = await artboardStore.readRevisions(fixture.tour.id, assignment.id);
    if (existingRevisions.some((stored) => stored.revisionId === revisionId)) {
      const error = new Error("That revision has already been sent.");
      error.status = 409;
      throw error;
    }
    const existingHandoffs = await artboardStore.readHandoffs(fixture.tour.id, assignment.id);
    if (existingHandoffs.some((stored) => stored.kind === "revision" && stored.sourceArtboardVersion === source)) {
      const error = new Error("That revision was issued to a person and is waiting for their submission.");
      error.status = 409;
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
    const produced = receiveRevision(brief, revision, { artboardVersion: source + 1, accountId: actingAccount });
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
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    if (user.role === CLIENT_ROLE) {
      const approvals = await artboardStore.readApprovals(fixture.tour.id, assignment.id);
      const visible = clientApprovalView(approvals);
      return { comments: visible.comments, approvals: visible.clientApprovals };
    }
    return {
      reviews: await artboardStore.readReviews(fixture.tour.id, assignment.id),
      revisions: await artboardStore.readRevisions(fixture.tour.id, assignment.id),
    };
  }
  // Four distinct authorities, kept apart on purpose. Higher Roads clears a
  // version for the client to see. The client approves the work. Neither is
  // the other, and neither moves anything into the artist layer.
  if (body.action === "approve-for-client") {
    const { fixture, assignment, artboardStore, record, versions, entry, wanted } = await atArtboard(body, options);
    refuseSupersededArtboard(versions, wanted);
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
    const { fixture, assignment, tourStore, artboardStore, record, versions, entry, wanted } = await atArtboard(body, options);
    refuseSupersededArtboard(versions, wanted);
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
    const { fixture, assignment, artboardStore, record, versions, wanted } = await atArtboard(body, options);
    refuseSupersededArtboard(versions, wanted);
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
    const artboardStore = options.artboardStore || createArtboardStore({ accountId: actingAccount });
    const approvals = await artboardStore.readApprovals(fixture.tour.id, assignment.id);
    if (user.role === CLIENT_ROLE) return clientApprovalView(approvals);
    return { ...approvals, intents: await artboardStore.readIntents(fixture.tour.id, assignment.id) };
  }
  if (body.action === "get-scene-activity") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
    const facts = await record.readFacts(fixture.tour.id, assignment.id);
    const clientVisible = new Set([
      "Requested the Scene",
      "Froze the brief",
      SENT_TO_PRODUCTION,
      "Submitted work",
      "Approved for the client to see",
      "Approved the work",
      "Left a comment",
      ASKED_A_QUESTION,
      ANSWERED_A_QUESTION,
    ]);
    return {
      facts: user.role === CLIENT_ROLE
        ? facts.filter((fact) => clientVisible.has(fact.action))
        : facts,
    };
  }
  // Asking the client something. The Scene does not move: it is still where it
  // was, because nothing about the work changed. The question shows up on the
  // client's home page and the answer lands back here.
  if (body.action === "ask-question") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
    const text = String(body.text || "").trim();
    if (!text) {
      const error = new Error("Write the question before you send it.");
      error.status = 400;
      throw error;
    }
    const existing = await tourStore.readQuestions(fixture.tour.id, assignment.id);
    const now = options.now ? new Date(options.now()) : new Date();
    const question = await tourStore.addQuestion(fixture.tour.id, assignment.id, {
      id: questionId(existing, now.getTime()),
      text,
      askedBy: user.displayName,
      askedAt: now.toISOString(),
      answer: null,
      answeredBy: null,
      answeredAt: null,
    });
    await record.appendFact(fixture.tour.id, assignment.id, { ...actor, action: ASKED_A_QUESTION });
    return { question };
  }

  if (body.action === "answer-question") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
    const text = String(body.text || "").trim();
    if (!text) {
      const error = new Error("Write the answer before you send it.");
      error.status = 400;
      throw error;
    }
    const now = options.now ? new Date(options.now()) : new Date();
    const question = await tourStore.answerQuestion(
      fixture.tour.id,
      assignment.id,
      String(body.questionId || ""),
      { answer: text, answeredBy: user.displayName, answeredAt: now.toISOString() },
    );
    await record.appendFact(fixture.tour.id, assignment.id, { ...actor, action: ANSWERED_A_QUESTION });
    return { question };
  }

  if (body.action === "get-questions") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const tourStore = options.tourStore || createTourStore({ accountId: actingAccount });
    return { questions: await tourStore.readQuestions(fixture.tour.id, assignment.id) };
  }

  if (body.action === "get-scene-record") {
    const fixture = await loadTour(sanitizeClientId(body.tourId || ""), options);
    const assignment = findAssignment(fixture, body.assignmentId);
    const record = options.sceneRecord || createSceneRecord({ accountId: actingAccount });
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
