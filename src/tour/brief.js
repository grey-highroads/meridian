// Compiling a brief.
//
// A brief is the one thing that leaves Higher Roads. It says what was asked,
// what is required, which concept was chosen and why, what to avoid, the parts
// tour direction it was written against with the version it came from, and what
// the tour plays back on. Once frozen it is never rewritten. Feedback makes a
// new version.
//
// Order is deliberate. Required elements and the technical target lead;
// latitude and meaning trail. That comes from a BWS render finding that
// concrete facts placed early beat abstract description placed anywhere. It is
// Reasoned rather than Verified here, because it was a renderer finding and
// Jim's workflow is a different reader. The compiled brief is the cheapest way
// to ask him: hand him a real one and let him say what sits in the wrong place.

import { findingStatement } from "../artist/finding.js";

// The director's words split into paragraphs. The whole direction travels with
// every brief, because it is the governing document and the brief names the
// version it was written against. Nobody selects parts of it. Ruled 2026-08-27,
// replacing the 2026-08-22 marking rule.
export function directionParagraphs(direction) {
  return String((direction && direction.words) || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

// The dates where the rig differs from the standard setup, in the order the
// tour file lists them. Every one of them travels with every brief, on the same
// ruling as the direction: a person deciding what to build should not also be
// deciding which rooms production is told about. Ruled 2026-08-27.
export function venueExceptions(setup) {
  return setup && Array.isArray(setup.venueExceptions) ? setup.venueExceptions : [];
}

// The direction a stored brief carries. A brief frozen before 2026-08-27 holds
// the paragraphs someone marked, under the old name, and a frozen brief is
// never rewritten. So the reader takes either shape and the stored artifact
// stays exactly as it was frozen. Renaming the field without this is what broke
// the review page in 670393e6: get-brief re-renders the stored object every
// time it is read, so an old brief threw on every read.
export function briefDirectionParagraphs(brief) {
  const direction = (brief && brief.tourDirection) || {};
  if (Array.isArray(direction.paragraphs)) return direction.paragraphs;
  if (Array.isArray(direction.selectedParagraphs)) return direction.selectedParagraphs;
  return [];
}

export function jobIdFor(tourId, assignmentId) {
  return `${tourId}--${assignmentId}`;
}

export function nextBriefVersion(versions) {
  return versions.reduce((highest, entry) => Math.max(highest, entry.briefVersion || 0), 0) + 1;
}

export function compileBrief({ tour, assignment, concept, artistId, briefVersion }) {
  if (!concept) {
    const error = new Error("Choose or write a concept before compiling a brief.");
    error.status = 400;
    throw error;
  }
  const setup = tour.productionSetup || null;
  return {
    jobId: jobIdFor(tour.id, assignment.id),
    briefVersion,
    status: "draft",
    artistId,
    tourId: tour.id,
    assignmentId: assignment.id,
    directionVersion: tour.direction.version,

    assignment: {
      title: assignment.title,
      moment: assignment.moment,
      requestedBy: assignment.requestedBy,
      requestedOn: assignment.requestedOn,
      // The tour manager's words, as they arrived.
      request: assignment.request,
    },

    // Binding first. The technical target is what the show plays on: the
    // standard rig as production supplied it, the version it came from, the
    // playback line, and the dates someone marked as differing from it.
    requiredElements: assignment.requiredElements || [],
    technicalTarget: {
      playbackSystem: tour.playbackSystem || null,
      setupVersion: setup ? setup.version : null,
      suppliedBy: setup ? setup.suppliedBy : null,
      standardRig: setup ? setup.words : null,
      venueExceptions: venueExceptions(setup),
      // Venue and screen profiles past what the tour supplied sit with Jim in
      // this version. See docs/deferred-work.md for what would bring them here.
      venueProfile: null,
    },

    chosenConcept: {
      title: concept.title,
      idea: concept.idea,
      whyThisArtist: concept.whyThisArtist,
      asksOfProduction: concept.asksOfProduction,
      whereItMightMiss: concept.whereItMightMiss,
      rhymesWith: concept.rhymesWith || [],
      shapedBy: concept.shapedBy || null,
      shapedAt: concept.shapedAt || null,
      cameFrom: concept.cameFrom || null,
    },

    avoid: avoidText(concept.avoid),

    // Every claim about the artist carries what it rests on.
    artistContext: (concept.artistContext || []).map((entry) => ({
      findingId: entry.findingId,
      part: entry.facetName,
      text: findingSentence(entry.text),
      why: entry.why || null,
      independentSourceCount: entry.independentSourceCount,
      tiers: entry.tiers || [],
    })),

    // Meaning last.
    tourDirection: {
      version: tour.direction.version,
      setBy: tour.direction.setBy,
      setOn: tour.direction.setOn,
      // The whole direction, carried as given.
      paragraphs: directionParagraphs(tour.direction),
    },
    creativeLatitude: concept.creativeLatitude || [],
    openQuestions: concept.openQuestions || [],

    frozenBy: null,
    frozenAt: null,
  };
}

export function freeze(brief, person) {
  if (brief.status === "frozen") {
    const error = new Error("That brief version is already frozen.");
    error.status = 409;
    throw error;
  }
  return { ...brief, status: "frozen", frozenBy: person || "Higher Roads", frozenAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// The two artifact forms
// ---------------------------------------------------------------------------

// A finding's text ends with the sentence the intake file used to record its
// evidence and its bin, for example "5 sources, tier 3. New." The brief states
// the evidence in its own line and the bin is our word, not Jim's, so the tail
// comes off rather than being printed twice.
export function findingSentence(text) {
  return findingStatement(text);
}

// Higher Roads' own vocabulary never leaves in a brief. An entry that still
// carries it after the bookkeeping is stripped is a record about the intake
// rather than a fact about the artist, so it stays here. See
// docs/deferred-work.md for the one entry this catches today.
const OUR_WORDS = /\b(bin|facet|governance|candidate|proposed|finding-)/i;

export function carriesOurWords(text) {
  return OUR_WORDS.test(String(text));
}

// What the brand avoids arrives from two places: the findings the brain holds
// for this Scene's identity, and any notes the brain wrote about this request.
// Both are text by the time they reach a brief, because a finding id is our
// word and not Jim's.
export function avoidText(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => (typeof entry === "string" ? entry : String((entry && entry.text) || "")))
    .map((text) => findingSentence(text))
    .filter((text) => text && !carriesOurWords(text));
}

// What the show plays on, in the order a reader needs it: the rig first, the
// playback line, the version it came from, then the dates that differ.
export function technicalTargetText(target) {
  const parts = [];
  if (target.standardRig) parts.push(target.standardRig);
  parts.push(target.playbackSystem || "Not recorded.");
  if (target.setupVersion) {
    parts.push(`Production setup version ${target.setupVersion}${target.suppliedBy ? `, supplied by ${target.suppliedBy}` : ""}.`);
  }
  const marked = target.venueExceptions || [];
  parts.push(marked.length
    ? ["On these dates the rig differs:", ...marked.map((entry) => `- ${entry.date}, ${entry.venue}. ${entry.text}`)].join("\n")
    : "No date on this tour was marked as differing from the rig above.");
  return parts.join("\n\n");
}

function bullets(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None recorded.";
}

// What a person reads. Same content as the sidecar, same version, same freeze.
// Neither form is authoritative over the other.
export function renderBriefDocument(brief) {
  const context = brief.artistContext.map((entry) => {
    const sources = entry.independentSourceCount
      ? `${entry.independentSourceCount} independent ${entry.independentSourceCount === 1 ? "source" : "sources"}${entry.tiers.length ? `, tier ${entry.tiers.join(", ")}` : ""}`
      : "source count not recorded";
    return `- ${findingSentence(entry.text)}\n  ${sources}.${entry.why ? ` ${entry.why}` : ""}`;
  });

  const direction = briefDirectionParagraphs(brief);

  return [
    `# ${brief.assignment.title}`,
    "",
    `Job: ${brief.jobId}`,
    `Brief version: ${brief.briefVersion}`,
    `Written against direction version: ${brief.directionVersion}`,
    brief.technicalTarget.setupVersion ? `Production setup version: ${brief.technicalTarget.setupVersion}` : null,
    `Status: ${brief.status === "frozen" ? `Frozen by ${brief.frozenBy} on ${brief.frozenAt}` : "Draft, not yet frozen"}`,
    brief.assignment.moment ? `Moment: ${brief.assignment.moment}` : null,
    brief.assignment.requestedBy ? `Asked for by: ${brief.assignment.requestedBy}` : null,
    "",
    "## Required",
    "",
    bullets(brief.requiredElements),
    "",
    "## Technical target",
    "",
    technicalTargetText(brief.technicalTarget),
    "",
    "## The concept",
    "",
    `### ${brief.chosenConcept.title}`,
    "",
    brief.chosenConcept.idea,
    brief.chosenConcept.asksOfProduction ? `\nWhat it asks of production: ${brief.chosenConcept.asksOfProduction}` : null,
    brief.chosenConcept.whereItMightMiss ? `\nWhere it might miss: ${brief.chosenConcept.whereItMightMiss}` : null,
    "",
    "## What to avoid",
    "",
    brief.avoid.length
      ? bullets(brief.avoid)
      : (brief.artistId ? "Nothing on record that this artist avoids." : "Nothing on record to avoid."),
    "",
    "## What was asked for",
    "",
    brief.assignment.request,
    "",
    // A job with no subject has no artist section. The brief still carries
    // artistId and artistContext, as null and empty, so its shape and the
    // production receiver's checks are untouched. A heading over nothing is
    // what changes.
    brief.artistId ? "## The artist behind this" : null,
    brief.artistId ? "" : null,
    brief.artistId ? (context.length ? context.join("\n") : "- None recorded.") : null,
    brief.artistId ? "" : null,
    "## The tour's direction",
    "",
    `Set by ${brief.tourDirection.setBy} on ${brief.tourDirection.setOn}. Version ${brief.tourDirection.version}.`,
    "",
    direction.length
      ? direction.join("\n\n")
      : "The tour has no direction text recorded. The version above is the reference.",
    "",
    "## Latitude",
    "",
    bullets(brief.creativeLatitude),
    brief.openQuestions.length ? "\n## Open questions\n\n" + bullets(brief.openQuestions) : null,
    "",
  ].filter((line) => line !== null).join("\n");
}

// What a machine reads. The shape is Higher Roads' guess and is not an
// obligation on Jim's system until both sides agree to it. That status is
// stated in docs/meridian-seam-with-jim.md, where both sides read it, rather
// than carried as a field in the payload. Nobody manages a field like that, so
// it would say provisional forever whatever the two sides had settled.
export function renderBriefSidecar(brief) {
  return {
    contract: "meridian.brief",
    ...brief,
  };
}
